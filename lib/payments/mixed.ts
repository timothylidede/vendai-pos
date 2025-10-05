import type { POSPayment } from '@/types/pos'
import type { PaymentAdapter, PaymentAdapterResult, PaymentAdapterMap, PaymentProcessorContext } from './types'

export interface MixedTenderMetadata {
  splits: POSPayment[]
}

export const createMixedPaymentAdapter = (adapters: PaymentAdapterMap): PaymentAdapter => {
  return {
    method: 'mixed',
    async process(payment: POSPayment, context: PaymentProcessorContext): Promise<PaymentAdapterResult> {
      const metadata = payment.metadata as Partial<MixedTenderMetadata> | undefined
      const splits = Array.isArray(metadata?.splits) ? metadata!.splits : []

      if (splits.length === 0) {
        context.events?.onInfo?.('Mixed tender without explicit splits. Marking as pending.')
        return {
          payment: {
            ...payment,
            status: payment.status ?? 'pending',
          },
          status: 'pending',
        }
      }

      const processed: POSPayment[] = []
      for (const split of splits) {
        const adapter = adapters.get(split.method)
        if (!adapter) {
          throw new Error(`No adapter registered for split payment method: ${split.method}`)
        }

        const outcome = await adapter.process(split, context)
        processed.push(outcome.payment)
      }

      const allCompleted = processed.every((p) => p.status === 'completed' || p.status === 'captured')

      return {
        payment: {
          ...payment,
          status: allCompleted ? 'completed' : 'pending',
          metadata: {
            ...(payment.metadata ?? {}),
            splits: processed,
          },
        },
        status: allCompleted ? 'completed' : 'pending',
      }
    },
  }
}
