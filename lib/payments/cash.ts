import type { POSPayment } from '@/types/pos'
import type { PaymentAdapter, PaymentProcessorContext, PaymentAdapterResult } from './types'

export interface CashAdapterOptions {
  onOpenDrawer?: () => Promise<void> | void
}

export const createCashPaymentAdapter = (options: CashAdapterOptions = {}): PaymentAdapter => {
  return {
    method: 'cash',
    async process(payment: POSPayment, context: PaymentProcessorContext): Promise<PaymentAdapterResult> {
      try {
        await options.onOpenDrawer?.()
        await context.events?.onOpenCashDrawer?.()
      } catch (drawerError) {
        context.events?.onError?.('Failed to trigger cash drawer automatically.')
        console.warn('[payments][cash] drawer trigger failed', drawerError)
      }

      const completedPayment: POSPayment = {
        ...payment,
        status: 'completed',
        receivedAt: payment.receivedAt ?? new Date().toISOString(),
      }

      context.events?.onInfo?.('Cash payment recorded.')

      return {
        payment: completedPayment,
        status: 'completed',
      }
    },
  }
}
