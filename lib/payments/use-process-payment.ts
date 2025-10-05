import { useCallback, useMemo, useRef, useState } from 'react'
import { createPaymentAdapterMap, type CreatePaymentAdaptersOptions } from './index'
import type {
  PaymentAdapterMap,
  PaymentProcessorEvents,
  PaymentAdapterResult,
  ProcessCheckoutResponse,
  ProcessCheckoutSuccess,
} from './types'
import { PaymentProcessorError, type ProcessCheckoutFailure } from './types'
import type { POSPayment, POSCheckoutContext, POSOrderStatus, POSPaymentSummary } from '@/types/pos'
import type { POSOrderLine } from '@/lib/types'
import {
  addPosOrder,
  finalizePosOrder,
  updatePosOrderPaymentState,
  voidPosOrder,
} from '@/lib/pos-operations-optimized'

type AsyncRetry = () => Promise<ProcessCheckoutResponse>

type AsyncCancel = () => Promise<void>

const COMPLETION_THRESHOLD = 0.01

interface UseProcessPaymentOptions {
  adapterOptions?: CreatePaymentAdaptersOptions
}

export interface ProcessCheckoutParams {
  orgId: string
  userId: string
  registerId: string
  lines: POSOrderLine[]
  total: number
  payments: POSPayment[]
  checkoutContext: POSCheckoutContext
  status: POSOrderStatus
  balanceDue: number
  notes?: string
  receiptNumber: string
  cashierId?: string
  events?: PaymentProcessorEvents
}

type NormalizedPayment = POSPayment & { id: string }

interface ActivePaymentState {
  payments: NormalizedPayment[]
  orderId: string
  currentIndex: number
}

export interface UseProcessPaymentResult {
  processCheckout: (params: ProcessCheckoutParams) => Promise<ProcessCheckoutResponse>
  processing: boolean
  lastError: PaymentProcessorError | null
  reset: () => void
}

type SummaryInput = {
  payments: POSPayment[]
  total: number
}

const computeSummary = ({ payments, total }: SummaryInput): POSPaymentSummary => {
  const totalApplied = payments.reduce((sum, payment) => sum + Math.max(0, payment.amount), 0)
  const totalTendered = payments.reduce(
    (sum, payment) => sum + Math.max(0, payment.tenderedAmount ?? payment.amount),
    0,
  )
  const totalChange = payments.reduce((sum, payment) => sum + Math.max(0, payment.changeGiven ?? 0), 0)
  const lastPaymentAt = payments
    .map((payment) => payment.receivedAt)
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort()
    .pop()

  return {
    totalApplied,
    totalTendered,
    totalChange,
    balanceDue: Math.max(0, Number((total - totalApplied).toFixed(2))),
    lastPaymentAt,
  }
}

const normalizePayments = (payments: POSPayment[]): NormalizedPayment[] => {
  const timestamp = new Date().toISOString()
  return payments.map((payment, index) => ({
    ...payment,
    id: payment.id ?? `payment-${index}-${Date.now()}`,
    receivedAt: payment.receivedAt ?? timestamp,
    status: payment.status ?? 'pending',
  }))
}

const shouldMarkPaid = (payments: POSPayment[], balanceDue: number) => {
  if (balanceDue > COMPLETION_THRESHOLD) {
    return false
  }
  return payments.every((payment) => payment.status === 'completed' || payment.status === 'captured')
}

export const useProcessPayment = (options: UseProcessPaymentOptions = {}): UseProcessPaymentResult => {
  const adapterMap = useMemo<PaymentAdapterMap>(() => createPaymentAdapterMap(options.adapterOptions), [
    options.adapterOptions,
  ])

  const [processing, setProcessing] = useState(false)
  const [lastError, setLastError] = useState<PaymentProcessorError | null>(null)

  const stateRef = useRef<ActivePaymentState | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const eventsRef = useRef<PaymentProcessorEvents | undefined>(undefined)
  const baseParamsRef = useRef<ProcessCheckoutParams | null>(null)
  const attemptsRef = useRef<Map<number, number>>(new Map())

  const resetState = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    stateRef.current = null
    baseParamsRef.current = null
    attemptsRef.current = new Map()
    eventsRef.current = undefined
  }, [])

  const resolveOrderId = useCallback(async (): Promise<string> => {
    if (stateRef.current?.orderId) {
      return stateRef.current.orderId
    }

    const params = baseParamsRef.current
    if (!params) {
      throw new Error('Unable to resolve order context for payment processing.')
    }

    const checkoutContext = {
      ...params.checkoutContext,
      payments: [],
      metadata: {
        ...(params.checkoutContext.metadata ?? {}),
        plannedPayments: params.payments.length,
        initialStatus: params.status,
      },
    }

    const orderId = await addPosOrder(params.orgId, params.userId, params.lines, {
      status: 'awaiting_payment',
      payments: [],
      receiptNumber: params.receiptNumber,
      cashierId: params.cashierId ?? params.userId,
      checkoutContext,
      notes: params.notes,
      balanceDue: params.total,
    })

    stateRef.current = {
      orderId,
      payments: normalizePayments(params.payments),
      currentIndex: 0,
    }

    return orderId
  }, [])

  const processFromIndex = useCallback(
    async (startIndex = 0): Promise<ProcessCheckoutResponse> => {
      const params = baseParamsRef.current
      const activeState = stateRef.current

      if (!params || !activeState) {
        throw new Error('Payment processing context has not been initialized.')
      }

      const orderId = activeState.orderId
      const normalizedPayments = activeState.payments

      for (let idx = startIndex; idx < normalizedPayments.length; idx++) {
        const payment = normalizedPayments[idx]
        const adapter = adapterMap.get(payment.method)

        if (!adapter) {
          const error = new PaymentProcessorError({
            message: `No payment adapter registered for method: ${payment.method}`,
            code: 'adapter_missing',
            orderId,
            payment,
          })
          setLastError(error)
          setProcessing(false)
          return { success: false, orderId, error }
        }

        const attempt = (attemptsRef.current.get(idx) ?? 0) + 1
        attemptsRef.current.set(idx, attempt)

        try {
          const controller = controllerRef.current
          const context = {
            orderId,
            orgId: params.orgId,
            userId: params.userId,
            registerId: params.registerId,
            totalAmount: params.total,
            attempt,
            signal: controller?.signal,
            events: eventsRef.current,
          }

          const result: PaymentAdapterResult = await adapter.process(payment, context)

          normalizedPayments[idx] = {
            ...result.payment,
            id: payment.id,
          }

          const appliedPayments = normalizedPayments.slice(0, idx + 1)
          const summary = computeSummary({ payments: appliedPayments, total: params.total })
          const interimStatus: POSOrderStatus = shouldMarkPaid(appliedPayments, summary.balanceDue)
            ? 'paid'
            : 'awaiting_payment'

          await updatePosOrderPaymentState(params.orgId, orderId, {
            payments: appliedPayments,
            balanceDue: summary.balanceDue,
            paymentSummary: summary,
            status: interimStatus,
          })

          stateRef.current = {
            orderId,
            payments: normalizedPayments,
            currentIndex: idx + 1,
          }
        } catch (adapterError) {
          const appliedPayments = normalizedPayments.slice(0, idx)
          const failurePayment: NormalizedPayment = {
            ...payment,
            status: 'failed',
          }
          const summary = computeSummary({ payments: appliedPayments, total: params.total })

          await updatePosOrderPaymentState(params.orgId, orderId, {
            payments: [...appliedPayments, failurePayment],
            balanceDue: summary.balanceDue,
            paymentSummary: summary,
            status: 'awaiting_payment',
          })

          const retry: AsyncRetry = async () => {
            setProcessing(true)
            setLastError(null)
            return processFromIndex(idx)
          }

          const cancel: AsyncCancel = async () => {
            try {
              await voidPosOrder(params.orgId, orderId, 'Cancelled after payment failure.')
            } finally {
              resetState()
              setProcessing(false)
              setLastError(null)
            }
          }

          const message =
            adapterError instanceof Error ? adapterError.message : 'Payment attempt failed unexpectedly.'

          const processorError = new PaymentProcessorError({
            message,
            code: 'payment_failed',
            orderId,
            payment,
            retry,
            cancel,
            cause: adapterError,
          })

          stateRef.current = {
            orderId,
            payments: normalizedPayments,
            currentIndex: idx,
          }

          setLastError(processorError)
          setProcessing(false)

          return {
            success: false,
            orderId,
            error: processorError,
          }
        }
      }

      const currentState = stateRef.current
      if (!currentState) {
        throw new Error('Payment state unavailable during finalization.')
      }

      const finalPayments = [...currentState.payments]
      const summary = computeSummary({ payments: finalPayments, total: params.total })
      const finalStatus: POSOrderStatus = shouldMarkPaid(finalPayments, summary.balanceDue)
        ? 'paid'
        : 'awaiting_payment'

      const enrichedCheckoutContext: POSCheckoutContext = {
        ...params.checkoutContext,
        payments: finalPayments,
        metadata: {
          ...(params.checkoutContext.metadata ?? {}),
          lastStatus: finalStatus,
          attempts: Array.from(attemptsRef.current.entries()),
        },
      }

      const orderIdForFinalize = currentState.orderId

      await finalizePosOrder(params.orgId, orderIdForFinalize, {
        payments: finalPayments,
        status: finalStatus,
        balanceDue: summary.balanceDue,
        paymentSummary: summary,
        checkoutContext: enrichedCheckoutContext,
        receiptNumber: params.receiptNumber,
        notes: params.notes,
      })

      const response: ProcessCheckoutSuccess = {
        success: true,
        orderId: orderIdForFinalize,
        status: finalStatus,
        payments: finalPayments,
        paymentSummary: summary,
        balanceDue: summary.balanceDue,
      }

      resetState()
      setProcessing(false)
      setLastError(null)

      return response
    },
    [adapterMap, resetState],
  )

  const processCheckout = useCallback(
    async (params: ProcessCheckoutParams): Promise<ProcessCheckoutResponse> => {
      try {
        setProcessing(true)
        setLastError(null)

        const isSameSession =
          stateRef.current && baseParamsRef.current &&
          baseParamsRef.current.receiptNumber === params.receiptNumber &&
          stateRef.current.payments.length === params.payments.length

        if (!isSameSession) {
          resetState()
          attemptsRef.current = new Map()
          const payments = normalizePayments(params.payments)
          stateRef.current = {
            orderId: stateRef.current?.orderId ?? '',
            payments,
            currentIndex: 0,
          }
        }

        baseParamsRef.current = params
        eventsRef.current = params.events
        controllerRef.current = new AbortController()

        const orderId = await resolveOrderId()
        stateRef.current = {
          orderId,
          payments: stateRef.current?.payments ?? normalizePayments(params.payments),
          currentIndex: stateRef.current?.currentIndex ?? 0,
        }

        const startIndex = stateRef.current.currentIndex ?? 0
        return await processFromIndex(startIndex)
      } catch (error) {
        const failure: ProcessCheckoutFailure = {
          success: false,
          orderId: stateRef.current?.orderId,
          error:
            error instanceof PaymentProcessorError
              ? error
              : new PaymentProcessorError({
                  message: error instanceof Error ? error.message : 'Payment processing failed.',
                  code: 'payment_failed',
                  orderId: stateRef.current?.orderId,
                  cause: error,
                }),
        }

        setLastError(failure.error)
        setProcessing(false)
        return failure
      }
    },
    [processFromIndex, resolveOrderId, resetState],
  )

  const reset = useCallback(() => {
    resetState()
    setLastError(null)
    setProcessing(false)
  }, [resetState])

  return {
    processCheckout,
    processing,
    lastError,
    reset,
  }
}
