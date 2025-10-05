import type { POSPaymentMethod } from '@/types/pos'
import { createCashPaymentAdapter, type CashAdapterOptions } from './cash'
import { createMpesaPaymentAdapter, type MpesaAdapterOptions } from './mpesa'
import { createCardTerminalAdapter, type CardTerminalOptions } from './card-terminal'
import { createMixedPaymentAdapter } from './mixed'
import type { PaymentAdapter, PaymentAdapterMap } from './types'

export interface CreatePaymentAdaptersOptions {
  cash?: CashAdapterOptions
  mpesa?: MpesaAdapterOptions
  card?: CardTerminalOptions
  includeMixedAdapter?: boolean
  additionalAdapters?: PaymentAdapter[]
}

export const createPaymentAdapterMap = (
  options: CreatePaymentAdaptersOptions = {},
): PaymentAdapterMap => {
  const map: PaymentAdapterMap = new Map()

  const cashAdapter = createCashPaymentAdapter(options.cash)
  const mpesaAdapter = createMpesaPaymentAdapter(options.mpesa)
  const cardAdapter = createCardTerminalAdapter(options.card)

  map.set(cashAdapter.method, cashAdapter)
  map.set(mpesaAdapter.method, mpesaAdapter)
  map.set(cardAdapter.method, cardAdapter)

  if (options.includeMixedAdapter !== false) {
    map.set('mixed' as POSPaymentMethod, createMixedPaymentAdapter(map))
  }

  for (const adapter of options.additionalAdapters ?? []) {
    map.set(adapter.method, adapter)
  }

  return map
}

export { createCashPaymentAdapter } from './cash'
export { createMpesaPaymentAdapter } from './mpesa'
export { createCardTerminalAdapter } from './card-terminal'
export { createMixedPaymentAdapter } from './mixed'
export { useProcessPayment } from './use-process-payment'
export * from './types'
