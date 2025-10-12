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
import type { POSPayment, POSCheckoutContext, POSOrderStatus, POSPaymentSummary, POSReceipt } from '@/types/pos'
import type { POSOrderDoc, POSOrderLine } from '@/lib/types'
import {
  addPosOrder,
  finalizePosOrder,
  updatePosOrderPaymentState,
  voidPosOrder,
} from '@/lib/pos-operations-optimized'
import {
  buildReceipt,
  buildEscPosCommands,
  encodeEscPosAsBase64,
  renderReceiptToHtml,
  renderReceiptToPdfBytes,
  saveReceiptDocuments,
  type ReceiptArtifacts,
  type ReceiptBuilderResult,
} from '@/lib/receipts'

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
  laneId?: string
  deviceId?: string
  events?: PaymentProcessorEvents
}

type NormalizedPayment = POSPayment & { id: string }

interface ActivePaymentState {
  payments: NormalizedPayment[]
  orderId: string
  currentIndex: number
  createdAt: string
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
  const orderCreatedAtRef = useRef<string | null>(null)

  const resetState = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    stateRef.current = null
    baseParamsRef.current = null
    attemptsRef.current = new Map()
    eventsRef.current = undefined
    orderCreatedAtRef.current = null
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
        laneId: params.laneId,
        deviceId: params.deviceId,
      },
    }

    const createdAt = new Date().toISOString()
    orderCreatedAtRef.current = createdAt

    const orderId = await addPosOrder(params.orgId, params.userId, params.lines, {
      status: 'awaiting_payment',
      payments: [],
      receiptNumber: params.receiptNumber,
      cashierId: params.cashierId ?? params.userId,
      checkoutContext,
      notes: params.notes,
      balanceDue: params.total,
      laneId: params.laneId,
      deviceId: params.deviceId,
    })

    stateRef.current = {
      orderId,
      payments: normalizePayments(params.payments),
      currentIndex: 0,
      createdAt,
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
            createdAt: stateRef.current?.createdAt ?? orderCreatedAtRef.current ?? new Date().toISOString(),
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
            createdAt: stateRef.current?.createdAt ?? orderCreatedAtRef.current ?? new Date().toISOString(),
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

      const contextMetadata =
        params.checkoutContext.metadata && typeof params.checkoutContext.metadata === 'object'
          ? (params.checkoutContext.metadata as Record<string, unknown>)
          : {}

      const deriveString = (value: unknown): string | undefined =>
        typeof value === 'string' && value.trim().length > 0 ? value : undefined

      const orgAddressLines = (() => {
        const lines = contextMetadata.orgAddressLines
        if (Array.isArray(lines)) {
          return lines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
        }
        const single = deriveString(contextMetadata.orgAddress)
        return single ? [single] : undefined
      })()

      const receiptOrg = {
        id: params.orgId,
        name:
          deriveString(contextMetadata.displayOrgName) ??
          params.checkoutContext.location?.name ??
          params.orgId,
        legalName: deriveString(contextMetadata.orgLegalName),
        addressLines: orgAddressLines,
        contactEmail: deriveString(contextMetadata.orgEmail),
        contactPhone: deriveString(contextMetadata.orgPhone),
        taxRegistration: deriveString(contextMetadata.taxNumber),
        websiteUrl: deriveString(contextMetadata.orgWebsite),
        logoUrl: deriveString(contextMetadata.orgLogoUrl),
        footerNote: deriveString(contextMetadata.receiptFooter),
        currency: deriveString(contextMetadata.currencyCode) ?? 'KES',
      }

      const extraFields = [] as { label: string; value: string }[]
      if (params.checkoutContext.shiftId) {
        extraFields.push({ label: 'Shift', value: params.checkoutContext.shiftId })
      }
      if (params.checkoutContext.channel) {
        extraFields.push({ label: 'Channel', value: params.checkoutContext.channel })
      }

      const headerLinesCandidate = contextMetadata.receiptHeaderLines
      const footerLinesCandidate = contextMetadata.receiptFooterLines

      const receiptOptions = {
        org: receiptOrg,
        cashierName: deriveString(contextMetadata.cashierName) ?? params.cashierId ?? params.userId,
        registerId: params.checkoutContext.registerId ?? params.registerId,
        notes: params.notes,
        changeDueOverride: summary.totalChange,
        extraFields,
        metadata: {
          checkoutChannel: params.checkoutContext.channel,
          builder: 'useProcessPayment',
        },
        template: {
          headerLines:
            Array.isArray(headerLinesCandidate)
              ? headerLinesCandidate.filter((line): line is string => typeof line === 'string')
              : undefined,
          footerLines:
            Array.isArray(footerLinesCandidate)
              ? footerLinesCandidate.filter((line): line is string => typeof line === 'string')
              : undefined,
          accentColor: deriveString(contextMetadata.receiptAccentColor),
        },
      }

      const nowIso = new Date().toISOString()
      const orderForReceipt: POSOrderDoc = {
        id: orderIdForFinalize,
        orgId: params.orgId,
        userId: params.userId,
        cashierId: params.cashierId ?? params.userId,
        lines: params.lines,
        payments: finalPayments,
        total: params.total,
        balanceDue: summary.balanceDue,
        createdAt: orderCreatedAtRef.current ?? nowIso,
        completedAt: finalStatus === 'paid' ? nowIso : null,
        status: finalStatus,
        receiptNumber: params.receiptNumber,
        checkoutContext: enrichedCheckoutContext,
        paymentSummary: summary,
        updatedAt: nowIso,
        notes: params.notes,
      }

      let receiptResult: ReceiptBuilderResult | undefined
      let receiptArtifacts: ReceiptArtifacts | undefined
      let receiptRecord: POSReceipt | undefined

      try {
        receiptResult = buildReceipt({ order: orderForReceipt }, receiptOptions)
        const escposBuffer = buildEscPosCommands(receiptResult)
        const escposBase64 = encodeEscPosAsBase64(escposBuffer)
        const receiptHtml = renderReceiptToHtml(receiptResult)

        let pdfBytes: Uint8Array | undefined
        if (typeof window !== 'undefined') {
          try {
            pdfBytes = await renderReceiptToPdfBytes(receiptResult)
          } catch (pdfError) {
            console.warn('[payments] Receipt PDF generation failed', pdfError)
          }
        }

        const persisted: Pick<ReceiptArtifacts, 'documentUrls' | 'storagePaths'> = await (async () => {
          try {
            return await saveReceiptDocuments({
              orgId: params.orgId,
              orderId: orderIdForFinalize,
              html: receiptHtml,
              pdfBytes,
              metadata: {
                receiptNumber: receiptResult!.receipt.receiptNumber,
                builderVersion: receiptResult!.builderMeta.version,
                orgId: params.orgId,
              },
            })
          } catch (storageError) {
            console.warn('[payments] Failed to persist receipt documents', storageError)
            return {}
          }
        })()

        const documentUrls = {
          ...(receiptResult.receipt.documentUrls ?? {}),
          ...(persisted.documentUrls ?? {}),
        }
        const hasDocumentUrls = Boolean(documentUrls.html || documentUrls.pdf)

        const receiptMetadata: Record<string, unknown> = {
          ...receiptResult.receipt.metadata,
          escposBase64,
        }

        if (persisted.storagePaths && (persisted.storagePaths.html || persisted.storagePaths.pdf)) {
          receiptMetadata.storagePaths = persisted.storagePaths
        }

        receiptRecord = {
          ...receiptResult.receipt,
          documentUrls: hasDocumentUrls ? documentUrls : undefined,
          metadata: receiptMetadata,
        }

        receiptArtifacts = {
          html: receiptHtml,
          pdfBytes,
          escposBase64,
          documentUrls: persisted.documentUrls,
          storagePaths: persisted.storagePaths,
        }
      } catch (receiptError) {
        console.warn('[payments] Receipt generation failed', receiptError)
      }

      await finalizePosOrder(params.orgId, orderIdForFinalize, {
        payments: finalPayments,
        status: finalStatus,
        balanceDue: summary.balanceDue,
        paymentSummary: summary,
        checkoutContext: enrichedCheckoutContext,
        receiptNumber: params.receiptNumber,
        notes: params.notes,
        receipt: receiptRecord,
      })

      const response: ProcessCheckoutSuccess = {
        success: true,
        orderId: orderIdForFinalize,
        status: finalStatus,
        payments: finalPayments,
        paymentSummary: summary,
        balanceDue: summary.balanceDue,
        receipt: receiptRecord,
        receiptBundle: receiptResult,
        receiptArtifacts,
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
            createdAt: orderCreatedAtRef.current ?? new Date().toISOString(),
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
          createdAt: stateRef.current?.createdAt ?? orderCreatedAtRef.current ?? new Date().toISOString(),
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
