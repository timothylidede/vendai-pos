import type { POSPayment, POSPaymentMethod, POSOrderStatus, POSPaymentSummary, POSReceipt } from '@/types/pos'
import type { ReceiptArtifacts, ReceiptBuilderResult } from '@/lib/receipts'

export type PaymentAdapterStatus = 'completed' | 'pending' | 'failed'

export interface PaymentProcessorEvents {
  onStatus?(status: string): void
  onInfo?(message: string): void
  onError?(message: string): void
  onOpenCashDrawer?(): Promise<void> | void
}

export interface PaymentProcessorContext {
  orderId: string
  orgId: string
  userId: string
  registerId: string
  totalAmount: number
  attempt: number
  signal?: AbortSignal
  events?: PaymentProcessorEvents
}

export interface PaymentAdapterResult {
  payment: POSPayment
  status: PaymentAdapterStatus
  message?: string
  metadata?: Record<string, unknown>
  requiresPolling?: boolean
}

export interface PaymentAdapter {
  readonly method: POSPaymentMethod
  process(payment: POSPayment, context: PaymentProcessorContext): Promise<PaymentAdapterResult>
  cancel?(payment: POSPayment, context: PaymentProcessorContext): Promise<void>
}

export type PaymentAdapterMap = Map<POSPaymentMethod, PaymentAdapter>

export interface ProcessCheckoutSuccess {
  success: true
  orderId: string
  status: POSOrderStatus
  payments: POSPayment[]
  paymentSummary: POSPaymentSummary
  balanceDue: number
  receipt?: POSReceipt
  receiptBundle?: ReceiptBuilderResult
  receiptArtifacts?: ReceiptArtifacts
}

export class PaymentProcessorError extends Error {
  public readonly orderId?: string
  public readonly payment?: POSPayment
  public readonly code: string
  public readonly retry?: () => Promise<ProcessCheckoutResponse>
  public readonly cancel?: () => Promise<void>
  public readonly cause?: unknown

  constructor(params: {
    message: string
    code?: string
    orderId?: string
    payment?: POSPayment
    retry?: () => Promise<ProcessCheckoutResponse>
    cancel?: () => Promise<void>
    cause?: unknown
  }) {
    super(params.message)
    this.name = 'PaymentProcessorError'
    this.code = params.code ?? 'payment_failed'
    this.orderId = params.orderId
    this.payment = params.payment
    this.retry = params.retry
    this.cancel = params.cancel
    this.cause = params.cause
  }
}

export interface ProcessCheckoutFailure {
  success: false
  orderId?: string
  error: PaymentProcessorError
}

export type ProcessCheckoutResponse = ProcessCheckoutSuccess | ProcessCheckoutFailure

export type ProcessCheckoutCallback = (response: ProcessCheckoutResponse) => void
