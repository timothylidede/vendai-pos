import type { POSPayment } from '@/types/pos'
import { detectElectron } from '@/lib/is-electron'
import type { PaymentAdapter, PaymentAdapterResult, PaymentProcessorContext } from './types'

export interface CardTerminalOptions {
  processCardPayment?: (params: {
    payment: POSPayment
    context: PaymentProcessorContext
  }) => Promise<{
    success: boolean
    referenceId?: string
    message?: string
    error?: string
  }>
}

export const createCardTerminalAdapter = (options: CardTerminalOptions = {}): PaymentAdapter => {
  return {
    method: 'card',
    async process(payment: POSPayment, context: PaymentProcessorContext): Promise<PaymentAdapterResult> {
      const handler = options.processCardPayment ?? defaultElectronHandler

      const response = await handler({ payment, context })

      if (!response.success) {
        context.events?.onError?.(response.error ?? 'Card terminal declined the payment.')
        throw new Error(response.error ?? 'Card terminal declined the payment.')
      }

      const completedPayment: POSPayment = {
        ...payment,
        status: 'completed',
        referenceId: response.referenceId ?? payment.referenceId,
        receivedAt: payment.receivedAt ?? new Date().toISOString(),
        metadata: {
          ...(payment.metadata ?? {}),
          terminalMessage: response.message,
        },
      }

      context.events?.onInfo?.('Card payment authorized successfully.')

      return {
        payment: completedPayment,
        status: 'completed',
        message: response.message,
      }
    },
  }
}

async function defaultElectronHandler({
  payment,
  context,
}: {
  payment: POSPayment
  context: PaymentProcessorContext
}): Promise<{ success: boolean; referenceId?: string; message?: string; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Card terminal unavailable in server environment.' }
  }

  const api = window.electronAPI as typeof window.electronAPI & {
    payments?: {
      processCardPayment?: (payload: {
        amount: number
        currency: string
        orderId: string
      }) => Promise<{ success: boolean; referenceId?: string; message?: string; error?: string }>
    }
  }

  if (optionsAvailable(api)) {
    try {
      const cardResponse = await api.payments!.processCardPayment!({
        amount: payment.amount,
        currency: payment.metadata?.currency?.toString() ?? 'KES',
        orderId: context.orderId,
      })
      return cardResponse
    } catch (error) {
      console.error('[payments][card-terminal] Electron card processing failed', error)
      return { success: false, error: error instanceof Error ? error.message : 'Card processing failed.' }
    }
  }

  if (!detectElectron()) {
    return { success: false, error: 'Card terminal not available in web build.' }
  }

  return { success: false, error: 'Card terminal bridge is not initialized.' }
}

function optionsAvailable(
  api: typeof window.electronAPI & {
    payments?: {
      processCardPayment?: (payload: { amount: number; currency: string; orderId: string }) => Promise<{
        success: boolean
        referenceId?: string
        message?: string
        error?: string
      }> }
  },
): api is typeof window.electronAPI & {
  payments: {
    processCardPayment: (payload: { amount: number; currency: string; orderId: string }) => Promise<{
      success: boolean
      referenceId?: string
      message?: string
      error?: string
    }>
  }
} {
  return Boolean(api && api.payments && typeof api.payments.processCardPayment === 'function')
}
