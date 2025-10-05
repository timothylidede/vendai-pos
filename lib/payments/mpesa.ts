import type { POSPayment } from '@/types/pos'
import type { PaymentAdapter, PaymentAdapterResult, PaymentProcessorContext } from './types'

export interface MpesaAdapterOptions {
  initiateStkPush?: (params: {
    payment: POSPayment
    context: PaymentProcessorContext
  }) => Promise<{
    success: boolean
    referenceId?: string
    checkoutRequestId?: string
    customerMessage?: string
    error?: string
  }>
  pollTransaction?: (params: {
    referenceId?: string
    checkoutRequestId?: string
    payment: POSPayment
    context: PaymentProcessorContext
  }) => Promise<{
    success: boolean
    referenceId?: string
    error?: string
  }>
  autoSettleDelayMs?: number
  failOnPending?: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const createMpesaPaymentAdapter = (options: MpesaAdapterOptions = {}): PaymentAdapter => {
  return {
    method: 'mobile_money',
    async process(payment: POSPayment, context: PaymentProcessorContext): Promise<PaymentAdapterResult> {
      context.events?.onStatus?.('mpesa:initiate')

      const initiate = await (options.initiateStkPush
        ? options.initiateStkPush({ payment, context })
        : defaultInitiate({ payment, context, requestDelay: options.autoSettleDelayMs }))

      if (!initiate.success) {
        const errorMessage = 'error' in initiate ? initiate.error : 'Failed to initiate M-Pesa STK push'
        context.events?.onError?.(errorMessage ?? 'Failed to initiate M-Pesa STK push')
        throw new Error(errorMessage ?? 'Failed to initiate M-Pesa payment')
      }

      const referenceId = initiate.referenceId ?? ('checkoutRequestId' in initiate ? initiate.checkoutRequestId : undefined) ?? payment.referenceId

      let result: PaymentAdapterResult = {
        payment: {
          ...payment,
          referenceId: referenceId,
          status: 'authorized',
          metadata: {
            ...(payment.metadata ?? {}),
            customerMessage: initiate.customerMessage,
          },
        },
        status: 'pending',
        message: initiate.customerMessage,
      }

      if (options.pollTransaction) {
        context.events?.onStatus?.('mpesa:poll')
        const poll = await options.pollTransaction({
          referenceId,
          checkoutRequestId: 'checkoutRequestId' in initiate ? initiate.checkoutRequestId : undefined,
          payment,
          context,
        })

        if (!poll.success) {
          context.events?.onError?.(poll.error ?? 'M-Pesa payment still pending')
          if (options.failOnPending) {
            throw new Error(poll.error ?? 'M-Pesa payment pending confirmation')
          }
          return result
        }

        result = {
          payment: {
            ...payment,
            referenceId: poll.referenceId ?? referenceId,
            status: 'completed',
            receivedAt: payment.receivedAt ?? new Date().toISOString(),
          },
          status: 'completed',
        }
      } else if (options.autoSettleDelayMs !== undefined) {
        await sleep(options.autoSettleDelayMs)
        result = {
          payment: {
            ...payment,
            referenceId,
            status: 'completed',
            receivedAt: payment.receivedAt ?? new Date().toISOString(),
          },
          status: 'completed',
          message: initiate.customerMessage,
        }
      }

      context.events?.onInfo?.('M-Pesa payment initiated successfully.')

      return result
    },
  }
}

async function defaultInitiate({
  payment,
  context,
  requestDelay = 2000,
}: {
  payment: POSPayment
  context: PaymentProcessorContext
  requestDelay?: number
}) {
  if (requestDelay && requestDelay > 0) {
    await sleep(requestDelay)
  }

  return {
    success: true,
    referenceId: payment.referenceId ?? `MPESA-${context.orderId}-${Date.now()}`,
    customerMessage: 'STK push simulated. Awaiting confirmation.',
  }
}
