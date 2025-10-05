import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { checkRateLimit } from '@/lib/api-error-handler'
import { getRateLimitKey } from '@/lib/rate-limit'
import {
  createLedgerEntry,
  createPaymentRecord,
  invoiceDoc,
  purchaseOrderDoc,
  updatePurchaseOrder,
  type LedgerEntryCreateInput,
  type PaymentCreateInput,
  type PurchaseOrderCreateInput,
} from '@/lib/b2b-order-store'
import { buildInvoiceStatusHistoryEntry } from '@/lib/b2b-invoice-utils'
import { buildStatusHistoryEntry } from '@/lib/b2b-order-utils'
import {
  assessCredit,
  applyPaymentOutcomeToMetrics,
  type CreditAssessmentInput,
  type CreditAssessmentResult,
  type CreditMetricsSnapshot,
  type CreditPaymentOutcome,
} from '@/lib/credit-engine'
import type {
  Invoice,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PurchaseOrder,
  PurchaseOrderStatus,
  StatusHistoryEntry,
} from '@/types/b2b-orders'

const SIGNATURE_HEADER_KEYS = ['stripe-signature', 'x-vendai-signature', 'x-signature'] as const
const DEFAULT_ACTOR_ID = 'system-payments-webhook'
const DEFAULT_ACTOR_NAME = 'Payments Webhook'
const DEFAULT_CREDIT_LIMIT = 150000
const DEFAULT_DAYS_SINCE_SIGNUP = 180
const DEFAULT_REPAYMENT_LAG = 2

interface RawWebhookEvent {
  id?: string
  type?: string
  data?: unknown
  payload?: unknown
  created?: number
  [key: string]: unknown
}

type PaymentProcessor = 'stripe' | 'mpesa' | 'flutterwave' | 'manual' | 'unknown'

interface NormalizedPaymentEvent {
  eventId: string
  type: string
  processor: PaymentProcessor
  status: PaymentStatus
  method: PaymentMethod
  invoiceId?: string
  purchaseOrderId?: string
  retailerOrgId?: string
  supplierOrgId?: string
  retailerId?: string
  supplierId?: string
  amount: number
  currency: string
  vendaiCommission: number
  processorFee: number
  otherFee: number
  netAmount: number
  processorReference?: string
  mpesaReference?: string
  metadata: Record<string, unknown>
  rawStatus?: string
  reason?: string
  capturedAt?: Date
  rawEvent: Record<string, unknown>
}

interface CreditProfileDocument {
  retailerId: string
  metrics?: {
    trailingVolume90d?: number
    orders90d?: number
    successfulPayments?: number
    failedPayments?: number
    totalAttempts?: number
    disputeCount?: number
    currentOutstanding?: number
    existingCreditLimit?: number
    consecutiveOnTimePayments?: number
    daysSinceSignup?: number
    manualAdjustment?: number
    repaymentLagDays?: number
    sectorRisk?: 'low' | 'medium' | 'high'
    onTimePaymentRate?: number
    disputeRate?: number
    lastPaymentStatus?: PaymentStatus
    lastPaymentAmount?: number
    lastPaymentAt?: Timestamp
  }
  lastAssessment?: CreditAssessmentResult
  lastPaymentEvent?: {
    status: PaymentStatus
    amount: number
    processor: PaymentProcessor | undefined
    processorReference?: string | null
    mpesaReference?: string | null
    occurredAt: Timestamp
  }
  updatedAt?: Timestamp
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

const pickString = (source: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

const extractSignatureFromHeader = (headerValue: string | null): string | null => {
  if (!headerValue) return null
  const parts = headerValue.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith('v1=')) return trimmed.slice(3)
    if (trimmed.startsWith('sha256=')) return trimmed.slice(7)
  }
  if (headerValue.includes('=')) {
    return headerValue.substring(headerValue.lastIndexOf('=') + 1)
  }
  return headerValue
}

const verifyWebhookSignature = (request: NextRequest, rawBody: string): boolean => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret) {
    // Allow processing without signature verification in development if secret is missing
    return process.env.NODE_ENV !== 'production'
  }

  let receivedSignature: string | null = null
  for (const headerKey of SIGNATURE_HEADER_KEYS) {
    receivedSignature = extractSignatureFromHeader(request.headers.get(headerKey))
    if (receivedSignature) break
  }

  if (!receivedSignature) {
    return false
  }

  const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex')

  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8')
    const receivedBuffer = Buffer.from(receivedSignature, 'utf8')
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false
    }
    return timingSafeEqual(expectedBuffer, receivedBuffer)
  } catch (error) {
    console.error('Failed to verify webhook signature', error)
    return false
  }
}

const detectProcessor = (eventType: string): PaymentProcessor => {
  const lowerType = eventType.toLowerCase()
  if (lowerType.includes('mpesa')) return 'mpesa'
  if (lowerType.includes('flutter') || lowerType.includes('rave')) return 'flutterwave'
  if (lowerType.includes('stripe') || lowerType.includes('payment_intent') || lowerType.includes('checkout')) {
    return 'stripe'
  }
  if (lowerType.includes('manual')) return 'manual'
  return 'unknown'
}

const normalizePaymentMethod = (value?: string | null): PaymentMethod => {
  if (!value) return 'card'
  const normalized = value.toLowerCase()
  if (normalized.includes('mpesa')) return 'mpesa'
  if (normalized.includes('bank') || normalized.includes('ach')) return 'bank_transfer'
  if (normalized.includes('cash')) return 'cash_on_delivery'
  if (normalized.includes('credit')) return 'vendai_credit'
  if (normalized.includes('escrow')) return 'escrow_release'
  return 'card'
}

const inferPaymentStatus = (eventType: string, objectStatus?: string, fallback?: string): PaymentStatus => {
  const lowerType = eventType.toLowerCase()
  const lowerStatus = objectStatus?.toLowerCase()
  const lowerFallback = fallback?.toLowerCase()

  if (lowerType.includes('refund') || lowerStatus === 'refunded' || lowerFallback === 'refunded') {
    return 'refunded'
  }
  if (
    lowerType.includes('fail') ||
    lowerType.includes('canceled') ||
    lowerStatus === 'failed' ||
    lowerStatus === 'canceled' ||
    lowerStatus === 'requires_payment_method'
  ) {
    return 'failed'
  }
  if (lowerType.includes('pending') || lowerStatus === 'pending') {
    return 'pending'
  }
  if (lowerType.includes('processing') || lowerStatus === 'processing') {
    return 'processing'
  }
  if (lowerType.includes('partial') || lowerStatus === 'partial') {
    return 'partial'
  }
  return 'paid'
}

const maybeAsMajorUnits = (value: number | undefined, metadata: Record<string, unknown>): number | undefined => {
  if (value === undefined) return undefined
  if (value === 0) return 0
  const minorHintKeys = ['amount_unit', 'units', 'scale', 'quantization']
  for (const key of minorHintKeys) {
    const hintValue = metadata[key]
    if (typeof hintValue === 'string' && hintValue.toLowerCase().includes('minor')) {
      return value / 100
    }
  }
  if (metadata.useMinorUnits === true || metadata.minor_units === true) {
    return value / 100
  }
  if (value > 1000 && Number.isInteger(value)) {
    return value / 100
  }
  return value
}

const normalizePaymentEvent = (raw: RawWebhookEvent): NormalizedPaymentEvent | null => {
  if (!raw || typeof raw !== 'object') return null
  const eventId = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : undefined
  const type = typeof raw.type === 'string' ? raw.type : undefined
  if (!eventId || !type) {
    return null
  }

  const candidateObject = (raw as Record<string, unknown>).data && typeof (raw as Record<string, unknown>).data === 'object'
    ? ((raw as Record<string, { object?: unknown }>).data?.object ?? (raw as Record<string, unknown>).data)
    : raw.payload
  const extractedObject = candidateObject && typeof candidateObject === 'object' ? (candidateObject as Record<string, unknown>) : {}

  const metadataSource: Record<string, unknown> = {}
  const topLevelMetadata = (raw as Record<string, unknown>).metadata
  if (topLevelMetadata && typeof topLevelMetadata === 'object' && !Array.isArray(topLevelMetadata)) {
    Object.assign(metadataSource, topLevelMetadata)
  }
  const objectMetadata = extractedObject.metadata
  if (objectMetadata && typeof objectMetadata === 'object' && !Array.isArray(objectMetadata)) {
    Object.assign(metadataSource, objectMetadata)
  }

  const invoiceId = pickString(metadataSource, [
    'invoice_id',
    'invoiceId',
    'invoice',
    'invoiceID',
  ])

  const purchaseOrderId = pickString(metadataSource, [
    'purchase_order_id',
    'purchaseOrderId',
    'order_id',
    'orderId',
    'po_id',
  ])

  const retailerOrgId = pickString(metadataSource, ['retailer_org_id', 'retailerOrgId'])
  const supplierOrgId = pickString(metadataSource, ['supplier_org_id', 'supplierOrgId'])
  const retailerId = pickString(metadataSource, ['retailer_id', 'retailerId'])
  const supplierId = pickString(metadataSource, ['supplier_id', 'supplierId'])

  const amountFromMetadata = toNumber(
    metadataSource.amount_major ?? metadataSource.amountMajor ?? metadataSource.amount_total ?? metadataSource.amount,
  )

  const amountFromObject = toNumber(
    extractedObject.amount_received ??
      extractedObject.amount_captured ??
      extractedObject.amount ??
      extractedObject.amount_total ??
      extractedObject.total ??
      extractedObject.value,
  )

  const amountMajor = amountFromMetadata !== undefined
    ? amountFromMetadata
    : maybeAsMajorUnits(amountFromObject, metadataSource) ?? 0

  const commissionFromMetadata = toNumber(
    metadataSource.commission_amount ?? metadataSource.vendai_commission ?? metadataSource.application_fee_amount,
  )
  const processorFeeFromMetadata = toNumber(metadataSource.processor_fee ?? metadataSource.processorFee)
  const otherFeeFromMetadata = toNumber(metadataSource.other_fee ?? metadataSource.otherFee)

  const commission = maybeAsMajorUnits(commissionFromMetadata, metadataSource) ?? 0
  const processorFee = maybeAsMajorUnits(processorFeeFromMetadata, metadataSource) ?? 0
  const otherFee = maybeAsMajorUnits(otherFeeFromMetadata, metadataSource) ?? 0

  const netAmount = toNumber(metadataSource.net_amount ?? metadataSource.netAmount) ?? Math.max(amountMajor - commission - processorFee - otherFee, 0)

  const currency = pickString(metadataSource, ['currency']) ??
    (typeof extractedObject.currency === 'string' ? extractedObject.currency.toUpperCase() : 'KES')

  const objectStatus = typeof extractedObject.status === 'string' ? extractedObject.status : undefined
  const fallbackStatus = typeof (raw as Record<string, unknown>).status === 'string' ? (raw as Record<string, string>).status : undefined

  const status = inferPaymentStatus(type, objectStatus, fallbackStatus)

  const method = normalizePaymentMethod(
    pickString(metadataSource, ['payment_method', 'paymentMethod']) ??
      (Array.isArray((extractedObject.payment_method_types as unknown[]))
        ? ((extractedObject.payment_method_types as unknown[])[0] as string)
        : (typeof extractedObject.payment_method === 'string' ? extractedObject.payment_method : undefined)),
  )

  const processorReference = pickString(metadataSource, ['processor_reference', 'transaction_id', 'payment_intent_id']) ??
    (typeof extractedObject.id === 'string' ? extractedObject.id : undefined)

  const mpesaReference = pickString(metadataSource, ['mpesa_reference', 'mpesaReference']) ??
    (typeof extractedObject.mpesa_reference === 'string' ? extractedObject.mpesa_reference : undefined)

  const reason = pickString(metadataSource, ['failure_reason', 'failureReason', 'reason']) ??
    (typeof extractedObject.failure_message === 'string' ? extractedObject.failure_message : undefined)

  const capturedAtValue = toNumber(
    extractedObject.created ?? extractedObject.processed_at ?? extractedObject.updated ?? raw.created,
  )
  const capturedAt = capturedAtValue ? new Date(capturedAtValue * (capturedAtValue > 1e12 ? 1 : 1000)) : undefined

  return {
    eventId,
    type,
    processor: detectProcessor(type),
    status,
    method,
    invoiceId,
    purchaseOrderId,
    retailerOrgId,
    supplierOrgId,
    retailerId,
    supplierId,
    amount: Math.max(amountMajor, 0),
    currency,
    vendaiCommission: Math.max(commission, 0),
    processorFee: Math.max(processorFee, 0),
    otherFee: Math.max(otherFee, 0),
    netAmount: Math.max(netAmount, 0),
    processorReference,
    mpesaReference,
    metadata: metadataSource,
    rawStatus: objectStatus,
    reason,
    capturedAt,
    rawEvent: { ...raw, data: undefined, payload: undefined },
  }
}

const ensureEventIdempotency = async (event: NormalizedPaymentEvent) => {
  const ref = doc(db, 'payment_webhook_events', event.eventId)
  const snapshot = await getDoc(ref)
  if (snapshot.exists()) {
    return { ref, alreadyProcessed: true as const }
  }

  await setDoc(ref, {
    status: 'processing',
    receivedAt: serverTimestamp(),
    type: event.type,
    processor: event.processor,
  })

  return { ref, alreadyProcessed: false as const }
}

const mapProcessorForPaymentRecord = (
  processor: PaymentProcessor,
): PaymentCreateInput['processor'] => {
  switch (processor) {
    case 'stripe':
      return 'stripe'
    case 'flutterwave':
      return 'flutterwave'
    case 'mpesa':
      return 'mpesa_gateway'
    case 'manual':
      return 'manual'
    default:
      return undefined
  }
}

const buildPaymentStatusHistoryEntry = (
  status: PaymentStatus,
  notes?: string,
): StatusHistoryEntry<PaymentStatus> => ({
  status,
  changedBy: DEFAULT_ACTOR_ID,
  changedByName: DEFAULT_ACTOR_NAME,
  changedAt: serverTimestamp() as unknown as Timestamp,
  notes,
})

const applyInvoicePayment = async (
  invoiceId: string,
  invoice: Invoice,
  paymentId: string,
  payment: NormalizedPaymentEvent,
) => {
  const existingPaymentIds = Array.isArray(invoice.paymentIds) ? invoice.paymentIds : []
  const nextPaymentIds = existingPaymentIds.includes(paymentId)
    ? existingPaymentIds
    : [...existingPaymentIds, paymentId]

  const totalInvoiceAmount = invoice.amount?.total ?? 0
  const previousPaidAmount = toNumber(
    (invoice as unknown as { totalPaidAmount?: unknown }).totalPaidAmount,
  ) ?? 0
  const amountContribution = payment.status === 'paid'
    ? payment.amount
    : payment.status === 'refunded'
      ? -payment.amount
      : 0
  const totalPaidAmount = Math.max(previousPaidAmount + amountContribution, 0)

  let paymentStatus: PaymentStatus = invoice.paymentStatus ?? 'pending'
  if (payment.status === 'paid') {
    paymentStatus = totalPaidAmount >= totalInvoiceAmount ? 'paid' : 'partial'
  } else if (payment.status === 'refunded') {
    paymentStatus = totalPaidAmount <= 0 ? 'refunded' : 'partial'
  } else if (payment.status === 'failed') {
    paymentStatus = 'failed'
  } else if (payment.status === 'processing') {
    paymentStatus = payment.status
  }

  let invoiceStatus: InvoiceStatus = invoice.status
  if (paymentStatus === 'paid') {
    invoiceStatus = 'paid'
  } else if (paymentStatus === 'partial') {
    invoiceStatus = 'partially_paid'
  } else if (paymentStatus === 'failed' && invoice.status === 'issued') {
    invoiceStatus = 'overdue'
  } else if (paymentStatus === 'refunded' && invoice.status !== 'cancelled') {
    invoiceStatus = 'cancelled'
  }

  const statusHistory = Array.isArray(invoice.statusHistory) ? [...invoice.statusHistory] : []
  if (invoiceStatus !== invoice.status) {
    statusHistory.push(
      buildInvoiceStatusHistoryEntry(
        invoiceStatus,
        DEFAULT_ACTOR_ID,
        DEFAULT_ACTOR_NAME,
        `Invoice payment status updated to ${paymentStatus} via webhook`,
      ),
    )
  }

  await updateDoc(invoiceDoc(invoiceId), {
    paymentIds: nextPaymentIds,
    paymentStatus,
    status: invoiceStatus,
    statusHistory,
    totalPaidAmount,
    lastPaymentAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

const applyPurchaseOrderSideEffects = async (
  purchaseOrderId: string,
  purchaseOrder: PurchaseOrder,
  payment: NormalizedPaymentEvent,
  invoiceId: string,
  paymentId: string,
) => {
  const updates: Partial<PurchaseOrderCreateInput> = {}
  const history = Array.isArray(purchaseOrder.statusHistory)
    ? [...purchaseOrder.statusHistory]
    : []

  const targetStatus: PurchaseOrderStatus = payment.status === 'paid'
    ? 'fulfilled'
    : purchaseOrder.status ?? 'submitted'

  history.push(
    buildStatusHistoryEntry(
      targetStatus,
      DEFAULT_ACTOR_ID,
      DEFAULT_ACTOR_NAME,
      `Payment ${payment.status} via webhook (payment ${paymentId})`,
    ),
  )

  updates.statusHistory = history

  if (payment.status === 'paid' && purchaseOrder.status !== 'fulfilled') {
    updates.status = 'fulfilled'
  }

  if (!purchaseOrder.relatedInvoiceId) {
    updates.relatedInvoiceId = invoiceId
  }

  await updatePurchaseOrder(purchaseOrderId, updates)
}

const createLedgerEntryForPayment = async (
  invoice: Invoice,
  purchaseOrderId: string,
  paymentId: string,
  payment: NormalizedPaymentEvent,
) => {
  const payload: LedgerEntryCreateInput = {
    retailerOrgId: invoice.retailerOrgId,
    supplierOrgId: invoice.supplierOrgId,
    purchaseOrderId,
    invoiceId: invoice.id,
    paymentId,
    supplierId: invoice.supplierId,
    supplierName: invoice.supplierName,
    retailerId: invoice.retailerId,
    retailerName: invoice.retailerName,
    grossAmount: payment.amount,
    vendaiCommissionAmount: payment.vendaiCommission,
    processorFeeAmount: payment.processorFee,
    taxAmount: invoice.amount?.tax ?? 0,
    netPayoutAmount: payment.netAmount,
    currency: payment.currency,
    reconciliationStatus: payment.status === 'paid' ? 'matched' : payment.status === 'partial' ? 'partial' : 'flagged',
    payoutStatus: payment.status === 'paid' ? 'pending' : payment.status === 'refunded' ? 'failed' : 'pending',
    notes: `Webhook ${payment.type} (${payment.status})`,
  }

  const ledgerRef = await createLedgerEntry(payload)
  return ledgerRef.id
}

const updateCreditProfile = async (
  invoice: Invoice,
  payment: NormalizedPaymentEvent,
): Promise<CreditAssessmentResult | null> => {
  const retailerId = invoice.retailerId
  if (!retailerId) return null

  const creditProfileRef = doc(db, 'credit_profiles', retailerId)
  const snapshot = await getDoc(creditProfileRef)
  const existing = snapshot.exists() ? (snapshot.data() as CreditProfileDocument) : undefined

  const metrics = existing?.metrics ?? {}
  const prevSuccess = metrics.successfulPayments ?? 0
  const prevFailed = metrics.failedPayments ?? 0
  const prevDisputes = metrics.disputeCount ?? 0
  const prevVolume = metrics.trailingVolume90d ?? 0
  const prevOrders = metrics.orders90d ?? 0
  const prevOutstanding = metrics.currentOutstanding ?? invoice.amount?.total ?? 0
  const existingLimitFallback = metrics.existingCreditLimit ?? DEFAULT_CREDIT_LIMIT
  const prevAttempts = metrics.totalAttempts ?? prevSuccess + prevFailed
  const daysSinceSignup = metrics.daysSinceSignup ?? DEFAULT_DAYS_SINCE_SIGNUP

  const baseMetrics: CreditMetricsSnapshot = {
    trailingVolume90d: prevVolume,
    orders90d: prevOrders,
    successfulPayments: prevSuccess,
    failedPayments: prevFailed,
    totalAttempts: prevAttempts,
    disputeCount: prevDisputes,
    currentOutstanding: prevOutstanding,
    existingCreditLimit: existingLimitFallback,
    consecutiveOnTimePayments: metrics.consecutiveOnTimePayments ?? 0,
    manualAdjustment: metrics.manualAdjustment ?? 0,
    repaymentLagDays: metrics.repaymentLagDays ?? DEFAULT_REPAYMENT_LAG,
    sectorRisk: metrics.sectorRisk ?? 'medium',
  }

  const resolveOutcome = (status: PaymentStatus): CreditPaymentOutcome | null => {
    if (status === 'paid' || status === 'partial' || status === 'failed' || status === 'refunded') {
      return status
    }
    return null
  }

  const paymentOutcome = resolveOutcome(payment.status)
  const metricsAfterEvent = paymentOutcome
    ? applyPaymentOutcomeToMetrics(baseMetrics, payment.amount, paymentOutcome)
    : baseMetrics

  const trailingVolume90d = metricsAfterEvent.trailingVolume90d
  const orders90d = metricsAfterEvent.orders90d
  const successfulPayments = metricsAfterEvent.successfulPayments
  const failedPayments = metricsAfterEvent.failedPayments
  const totalAttempts = metricsAfterEvent.totalAttempts
  const disputeCount = metricsAfterEvent.disputeCount
  const currentOutstandingBase = metricsAfterEvent.currentOutstanding
  const existingLimit = metricsAfterEvent.existingCreditLimit
  const consecutiveOnTimePayments = metricsAfterEvent.consecutiveOnTimePayments
  const manualAdjustmentNext = metricsAfterEvent.manualAdjustment
  const repaymentLag = metricsAfterEvent.repaymentLagDays
  const sectorRisk = metricsAfterEvent.sectorRisk

  const volumeDelta = trailingVolume90d - prevVolume

  const trailingGrowthRate = prevVolume > 0
    ? volumeDelta / prevVolume
    : volumeDelta > 0
      ? 1
      : 0

  const onTimePaymentRate = totalAttempts > 0 ? successfulPayments / totalAttempts : 1
  const disputeRate = totalAttempts > 0 ? disputeCount / totalAttempts : 0
  const averageOrderValue = orders90d > 0 ? trailingVolume90d / orders90d : payment.amount
  const creditUtilization = existingLimit > 0 ? currentOutstandingBase / existingLimit : 0

  const eventTimestamp = Timestamp.fromDate(payment.capturedAt ?? new Date())

  const creditInput: CreditAssessmentInput = {
    retailerId,
    trailingVolume90d,
    trailingGrowthRate,
    orders90d,
    averageOrderValue,
    onTimePaymentRate,
    disputeRate,
    repaymentLagDays: repaymentLag,
    creditUtilization,
    currentOutstanding: currentOutstandingBase,
    existingCreditLimit: existingLimit,
    consecutiveOnTimePayments,
    daysSinceSignup,
    sectorRisk,
    manualAdjustment: manualAdjustmentNext,
  }

  const assessment = assessCredit(creditInput)

  await setDoc(
    creditProfileRef,
    {
      retailerId,
      metrics: {
        trailingVolume90d,
        orders90d,
        successfulPayments,
        failedPayments,
        totalAttempts,
        disputeCount,
        currentOutstanding: currentOutstandingBase,
        existingCreditLimit: existingLimit,
        consecutiveOnTimePayments,
        daysSinceSignup,
        manualAdjustment: manualAdjustmentNext,
        repaymentLagDays: repaymentLag,
        sectorRisk,
        onTimePaymentRate,
        disputeRate,
        lastPaymentStatus: payment.status,
        lastPaymentAmount: payment.amount,
        lastPaymentAt: eventTimestamp,
      },
      lastAssessment: assessment,
      lastPaymentEvent: {
        status: payment.status,
        amount: payment.amount,
        processor: payment.processor,
        processorReference: payment.processorReference ?? null,
        mpesaReference: payment.mpesaReference ?? null,
        occurredAt: eventTimestamp,
      },
      updatedAt: eventTimestamp,
    },
    { merge: true },
  )

  return assessment
}

export async function POST(request: NextRequest) {
  const rateLimitKey = getRateLimitKey(request, 'payments-webhook')
  checkRateLimit(rateLimitKey, 300, 60_000)

  const rawBody = await request.text()

  if (!verifyWebhookSignature(request, rawBody)) {
    return NextResponse.json(
      { success: false, error: 'Invalid webhook signature' },
      { status: 401 },
    )
  }

  let rawEvent: RawWebhookEvent
  try {
    rawEvent = JSON.parse(rawBody)
  } catch (error) {
    console.error('Failed to parse webhook payload', error)
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400 },
    )
  }

  const normalized = normalizePaymentEvent(rawEvent)
  if (!normalized) {
    return NextResponse.json(
      { success: false, error: 'Unsupported webhook payload' },
      { status: 400 },
    )
  }

  if (normalized.invoiceId) {
    checkRateLimit(getRateLimitKey(request, 'payments-webhook', normalized.invoiceId), 60, 60_000)
  }

  const { ref: eventRef, alreadyProcessed } = await ensureEventIdempotency(normalized)

  if (alreadyProcessed) {
    return NextResponse.json({ success: true, idempotent: true, eventId: normalized.eventId })
  }

  try {
    if (!normalized.invoiceId) {
      await updateDoc(eventRef, {
        status: 'ignored',
        reason: 'Missing invoice identifier',
        updatedAt: serverTimestamp(),
      })
      return NextResponse.json(
        { success: false, error: 'Invoice identifier is required' },
        { status: 422 },
      )
    }

    const invoiceSnapshot = await getDoc(invoiceDoc(normalized.invoiceId))
    if (!invoiceSnapshot.exists()) {
      await updateDoc(eventRef, {
        status: 'invoice_not_found',
        invoiceId: normalized.invoiceId,
        updatedAt: serverTimestamp(),
      })
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 },
      )
    }

    const invoice = {
      ...(invoiceSnapshot.data() as Invoice),
      id: invoiceSnapshot.id,
    }

    const resolvedPurchaseOrderId = normalized.purchaseOrderId ?? invoice.purchaseOrderId
    if (!resolvedPurchaseOrderId) {
      await updateDoc(eventRef, {
        status: 'ignored',
        reason: 'Missing purchase order linkage',
        updatedAt: serverTimestamp(),
      })
      return NextResponse.json(
        { success: false, error: 'Purchase order identifier is required' },
        { status: 422 },
      )
    }

    const paymentPayload: PaymentCreateInput = {
      retailerOrgId: invoice.retailerOrgId,
      supplierOrgId: invoice.supplierOrgId,
      invoiceId: invoice.id,
      purchaseOrderId: resolvedPurchaseOrderId,
      retailerId: invoice.retailerId,
      retailerName: invoice.retailerName,
      retailerUserId: invoice.retailerUserId,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplierName,
      supplierUserId: invoice.supplierUserId,
      method: normalized.method,
      status: normalized.status,
      amount: normalized.amount,
      currency: normalized.currency,
      fees: {
        processor: normalized.processorFee,
        vendaiCommission: normalized.vendaiCommission,
        other: normalized.otherFee || undefined,
      },
      netAmount: normalized.netAmount,
      processor: mapProcessorForPaymentRecord(normalized.processor),
      processorReference: normalized.processorReference,
      mpesaReference: normalized.mpesaReference,
      metadata: normalized.metadata,
      receivedAt: Timestamp.fromDate(normalized.capturedAt ?? new Date()),
      statusHistory: [
        buildPaymentStatusHistoryEntry(
          normalized.status,
          normalized.reason ? `Processor message: ${normalized.reason}` : undefined,
        ),
      ],
    }

    const paymentRef = await createPaymentRecord(paymentPayload)
    const paymentId = paymentRef.id

    await applyInvoicePayment(invoiceSnapshot.id, invoice, paymentId, normalized)

    let ledgerEntryId: string | null = null
    if (normalized.status === 'paid' || normalized.status === 'refunded' || normalized.status === 'partial') {
      ledgerEntryId = await createLedgerEntryForPayment(invoice, resolvedPurchaseOrderId, paymentId, normalized)
    }

    if (resolvedPurchaseOrderId) {
      const purchaseOrderSnapshot = await getDoc(purchaseOrderDoc(resolvedPurchaseOrderId))
      if (purchaseOrderSnapshot.exists()) {
        await applyPurchaseOrderSideEffects(
          resolvedPurchaseOrderId,
          purchaseOrderSnapshot.data() as PurchaseOrder,
          normalized,
          invoiceSnapshot.id,
          paymentId,
        )
      }
    }

    const shouldReassessCredit = ['paid', 'partial', 'failed', 'refunded'].includes(normalized.status)
    const creditAssessment = shouldReassessCredit
      ? await updateCreditProfile(invoice, normalized)
      : null

    await updateDoc(eventRef, {
      status: 'processed',
      paymentId,
      invoiceId: invoiceSnapshot.id,
      purchaseOrderId: resolvedPurchaseOrderId,
      ledgerEntryId: ledgerEntryId ?? null,
      paymentStatus: normalized.status,
      updatedAt: serverTimestamp(),
      creditAssessment,
    })

    return NextResponse.json({
      success: true,
      eventId: normalized.eventId,
      paymentId,
      ledgerEntryId,
      creditAssessment,
    })
  } catch (error) {
    console.error('Failed to process payment webhook', error)
    await updateDoc(eventRef, {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      updatedAt: serverTimestamp(),
    })
    return NextResponse.json(
      { success: false, error: 'Failed to process payment webhook' },
      { status: 500 },
    )
  }
}
