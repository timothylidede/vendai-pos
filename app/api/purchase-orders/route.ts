import { NextRequest, NextResponse } from 'next/server'
import {
  getDocs,
  getDoc,
  orderBy,
  limit as limitQuery,
  query,
  where,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore'

import {
  createPurchaseOrder,
  purchaseOrdersCollection,
  type PurchaseOrderCreateInput,
} from '@/lib/b2b-order-store'
import { sanitizeInput, schemas } from '@/lib/validation'
import type {
  DeliveryCheckpoint,
  PurchaseOrder,
  PurchaseOrderStatus,
  StatusHistoryEntry,
} from '@/types/b2b-orders'

type SerializableCheckpoint = Omit<DeliveryCheckpoint, 'timestamp'> & { timestamp: string | null }

type SerializableStatusHistory<TStatus extends string> = Omit<StatusHistoryEntry<TStatus>, 'changedAt'> & {
  changedAt: string | null
}

const DEFAULT_LIMIT = 50

const serializeTimestamp = (value: unknown): string | null => {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
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

const serializeDeliveryCheckpoint = (checkpoint: DeliveryCheckpoint): SerializableCheckpoint => (
  {
    ...checkpoint,
    timestamp: serializeTimestamp(checkpoint.timestamp),
  }
)

const serializeStatusHistory = <TStatus extends string>(history: StatusHistoryEntry<TStatus>[] = []): SerializableStatusHistory<TStatus>[] => {
  return history.map(entry => ({
    ...entry,
    changedAt: serializeTimestamp(entry.changedAt),
  }))
}

const serializePurchaseOrder = (id: string, data: DocumentData): Record<string, unknown> => {
  const po = data as Partial<PurchaseOrder>
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
    deliveryCheckpoints: (po.deliveryCheckpoints ?? []).map(serializeDeliveryCheckpoint),
    statusHistory: serializeStatusHistory(po.statusHistory ?? []),
    relatedInvoiceId: po.relatedInvoiceId ?? null,
    createdAt: serializeTimestamp(po.createdAt ?? null),
    updatedAt: serializeTimestamp(po.updatedAt ?? null),
  }
}

const buildStatusHistoryEntry = (
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

const toTimestamp = (value?: string | Date | null) => {
  if (!value) return undefined
  if (value instanceof Date) return Timestamp.fromDate(value)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return Timestamp.fromDate(date)
}

const mapDeliveryCheckpoints = (checkpoints?: Array<{ label: string; completed: boolean; timestamp?: string | Date; notes?: string }>): DeliveryCheckpoint[] | undefined => {
  if (!checkpoints) return undefined
  return checkpoints.map(checkpoint => ({
    ...checkpoint,
    timestamp: toTimestamp(checkpoint.timestamp),
  }))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const retailerId = searchParams.get('retailerId')
    const supplierId = searchParams.get('supplierId')
    const retailerOrgId = searchParams.get('retailerOrgId')
    const supplierOrgId = searchParams.get('supplierOrgId')
    const status = searchParams.get('status')
    const limitParam = searchParams.get('limit')

    const constraints = []

    if (retailerId) constraints.push(where('retailerId', '==', retailerId))
    if (supplierId) constraints.push(where('supplierId', '==', supplierId))
    if (retailerOrgId) constraints.push(where('retailerOrgId', '==', retailerOrgId))
    if (supplierOrgId) constraints.push(where('supplierOrgId', '==', supplierOrgId))
    if (status) constraints.push(where('status', '==', status))

    const limitValue = limitParam ? Math.min(Number.parseInt(limitParam, 10) || DEFAULT_LIMIT, 200) : DEFAULT_LIMIT

    const purchaseOrdersRef = purchaseOrdersCollection()
    const composedQuery = query(
      purchaseOrdersRef,
      ...constraints,
      orderBy('createdAt', 'desc'),
      limitQuery(limitValue),
    )

    const snapshot = await getDocs(composedQuery)
    const purchaseOrders = snapshot.docs.map(doc => serializePurchaseOrder(doc.id, doc.data()))

    return NextResponse.json({
      success: true,
      count: purchaseOrders.length,
      purchaseOrders,
    })
  } catch (error) {
    console.error('Failed to fetch purchase orders', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch purchase orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = sanitizeInput(body, schemas.purchaseOrderCreate)

    const {
      deliveryCheckpoints,
      expectedDeliveryDate,
      statusNote,
      ...base
    } = parsed

    const status = base.status ?? 'submitted'
    const historyEntry = buildStatusHistoryEntry(status, base.createdByUserId, base.createdByName, statusNote || 'Purchase order created')

    const payload: PurchaseOrderCreateInput = {
      ...base,
      expectedDeliveryDate: toTimestamp(expectedDeliveryDate),
      deliveryCheckpoints: mapDeliveryCheckpoints(deliveryCheckpoints),
      statusHistory: [historyEntry],
    }

    const ref = await createPurchaseOrder(payload)
    const snapshot = await getDoc(ref)

    if (!snapshot.exists()) {
      return NextResponse.json({ success: true, purchaseOrderId: ref.id })
    }

    const responsePayload = serializePurchaseOrder(snapshot.id, snapshot.data() || {})
    return NextResponse.json({ success: true, purchaseOrder: responsePayload })
  } catch (error) {
    console.error('Failed to create purchase order', error)
    return NextResponse.json({ success: false, error: 'Failed to create purchase order' }, { status: 500 })
  }
}
