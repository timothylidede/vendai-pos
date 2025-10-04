import { serverTimestamp, Timestamp } from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'

import type {
  DeliveryCheckpoint,
  LedgerEntry,
  PurchaseOrder,
  PurchaseOrderStatus,
  StatusHistoryEntry,
} from '@/types/b2b-orders'

export type SerializableCheckpoint = Omit<DeliveryCheckpoint, 'timestamp'> & {
  timestamp: string | null
}

export type SerializableStatusHistory<TStatus extends string> = Omit<
  StatusHistoryEntry<TStatus>,
  'changedAt'
> & {
  changedAt: string | null
}

export const serializeTimestamp = (value: unknown): string | null => {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === 'string') return value
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in (value as Record<string, unknown>)
  ) {
    try {
      const asDate = (value as { toDate: () => Date }).toDate()
      return asDate.toISOString()
    } catch (error) {
      console.warn('Failed to serialize timestamp-like value', error)
      return null
    }
  }
  return null
}

export const serializeDeliveryCheckpoint = (
  checkpoint: DeliveryCheckpoint,
): SerializableCheckpoint => ({
  ...checkpoint,
  timestamp: serializeTimestamp(checkpoint.timestamp),
})

export const serializeStatusHistory = <TStatus extends string>(
  history: StatusHistoryEntry<TStatus>[] = [],
): SerializableStatusHistory<TStatus>[] => {
  return history.map((entry) => ({
    ...entry,
    changedAt: serializeTimestamp(entry.changedAt),
  }))
}

export const serializePurchaseOrder = (
  id: string,
  data: DocumentData | Partial<PurchaseOrder> | null | undefined,
): Record<string, unknown> => {
  const po = (data ?? {}) as Partial<PurchaseOrder>
  return {
    id,
    retailerOrgId: po.retailerOrgId ?? null,
    supplierOrgId: po.supplierOrgId ?? null,
    retailerId: po.retailerId ?? null,
    retailerName: po.retailerName ?? null,
    retailerUserId: po.retailerUserId ?? null,
    supplierId: po.supplierId ?? null,
    supplierName: po.supplierName ?? null,
    supplierUserId: po.supplierUserId ?? null,
    createdByUserId: po.createdByUserId ?? null,
    createdByName: po.createdByName ?? null,
    status: po.status ?? null,
    paymentTerms: po.paymentTerms ?? null,
    expectedDeliveryDate: serializeTimestamp(po.expectedDeliveryDate ?? null),
    deliveryAddress: po.deliveryAddress ?? null,
    notes: po.notes ?? null,
    items: po.items ?? [],
    amount: po.amount ?? null,
    deliveryCheckpoints: (po.deliveryCheckpoints ?? []).map(
      serializeDeliveryCheckpoint,
    ),
    statusHistory: serializeStatusHistory(po.statusHistory ?? []),
    relatedInvoiceId: po.relatedInvoiceId ?? null,
    createdAt: serializeTimestamp(po.createdAt ?? null),
    updatedAt: serializeTimestamp(po.updatedAt ?? null),
  }
}

export const serializeLedgerEntry = (
  id: string,
  data: DocumentData | Partial<LedgerEntry> | null | undefined,
): Record<string, unknown> => {
  const entry = (data ?? {}) as Partial<LedgerEntry>
  return {
    id,
    retailerOrgId: entry.retailerOrgId ?? null,
    supplierOrgId: entry.supplierOrgId ?? null,
    purchaseOrderId: entry.purchaseOrderId ?? null,
    invoiceId: entry.invoiceId ?? null,
    paymentId: entry.paymentId ?? null,
    supplierId: entry.supplierId ?? null,
    supplierName: entry.supplierName ?? null,
    retailerId: entry.retailerId ?? null,
    retailerName: entry.retailerName ?? null,
    grossAmount: entry.grossAmount ?? 0,
    vendaiCommissionAmount: entry.vendaiCommissionAmount ?? 0,
    processorFeeAmount: entry.processorFeeAmount ?? 0,
    netPayoutAmount: entry.netPayoutAmount ?? 0,
    currency: entry.currency ?? 'KES',
    reconciliationStatus: entry.reconciliationStatus ?? 'pending',
    payoutStatus: entry.payoutStatus ?? 'pending',
    payoutDate: serializeTimestamp(entry.payoutDate ?? null),
    notes: entry.notes ?? null,
    createdAt: serializeTimestamp(entry.createdAt ?? null),
    updatedAt: serializeTimestamp(entry.updatedAt ?? null),
  }
}

export const buildStatusHistoryEntry = (
  status: PurchaseOrderStatus,
  changedBy: string,
  changedByName?: string,
  note?: string,
): StatusHistoryEntry<PurchaseOrderStatus> => ({
  status,
  changedBy,
  changedByName,
  changedAt: serverTimestamp() as unknown as Timestamp,
  notes: note,
})

export type TimestampLike = Timestamp | string | Date | null | undefined

export const toTimestamp = (value?: TimestampLike) => {
  if (value == null) return undefined
  if (value instanceof Timestamp) return value
  if (value instanceof Date) return Timestamp.fromDate(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const date = new Date(trimmed)
    if (!Number.isNaN(date.getTime())) {
      return Timestamp.fromDate(date)
    }
    return undefined
  }
  return undefined
}

export const mapDeliveryCheckpoints = (
  checkpoints?: Array<{
    label: string
    completed: boolean
    timestamp?: TimestampLike
    notes?: string
  }> | null,
): DeliveryCheckpoint[] | undefined => {
  if (!checkpoints) return undefined
  return checkpoints.map((checkpoint) => ({
    ...checkpoint,
    timestamp: toTimestamp(checkpoint.timestamp),
  }))
}
