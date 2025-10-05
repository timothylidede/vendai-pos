import { NextRequest, NextResponse } from 'next/server'
import {
  getDocs,
  getDoc,
  orderBy,
  limit as limitQuery,
  query,
  where,
  startAfter,
  type QueryConstraint,
} from 'firebase/firestore'

import {
  createPurchaseOrder,
  purchaseOrderDoc,
  purchaseOrdersCollection,
  type PurchaseOrderCreateInput,
} from '@/lib/b2b-order-store'
import {
  buildStatusHistoryEntry,
  mapDeliveryCheckpoints,
  serializePurchaseOrder,
  toTimestamp,
} from '@/lib/b2b-order-utils'
import { sanitizeInput, schemas } from '@/lib/validation'
import { checkRateLimit } from '@/lib/api-error-handler'
import { getAuthScopedRateLimitKey, getRateLimitKey } from '@/lib/rate-limit'

const DEFAULT_LIMIT = 50

export async function GET(request: NextRequest) {
  try {
    const identifier = getRateLimitKey(request, 'purchase-orders', 'GET')
    checkRateLimit(identifier, 120, 60_000)

    const { searchParams } = new URL(request.url)
    const retailerId = searchParams.get('retailerId')
    const supplierId = searchParams.get('supplierId')
    const retailerOrgId = searchParams.get('retailerOrgId')
    const supplierOrgId = searchParams.get('supplierOrgId')
    const status = searchParams.get('status')
    const limitParam = searchParams.get('limit')
    const cursor = searchParams.get('cursor')

  const constraints: QueryConstraint[] = []

    if (retailerId) constraints.push(where('retailerId', '==', retailerId))
    if (supplierId) constraints.push(where('supplierId', '==', supplierId))
    if (retailerOrgId) constraints.push(where('retailerOrgId', '==', retailerOrgId))
    if (supplierOrgId) constraints.push(where('supplierOrgId', '==', supplierOrgId))
    if (status) constraints.push(where('status', '==', status))

    const limitValue = limitParam ? Math.min(Number.parseInt(limitParam, 10) || DEFAULT_LIMIT, 200) : DEFAULT_LIMIT

    const purchaseOrdersRef = purchaseOrdersCollection()
    const composedConstraints: QueryConstraint[] = [
      ...constraints,
      orderBy('createdAt', 'desc'),
    ]

    if (cursor) {
      const cursorSnapshot = await getDoc(purchaseOrderDoc(cursor))
      if (cursorSnapshot.exists()) {
        composedConstraints.push(startAfter(cursorSnapshot))
      }
    }

    composedConstraints.push(limitQuery(limitValue))

    const composedQuery = query(purchaseOrdersRef, ...composedConstraints)

    const snapshot = await getDocs(composedQuery)
    const purchaseOrders = snapshot.docs.map(doc => serializePurchaseOrder(doc.id, doc.data()))
    const lastDoc = snapshot.docs[snapshot.docs.length - 1]

    return NextResponse.json({
      success: true,
      count: purchaseOrders.length,
      purchaseOrders,
      nextCursor: lastDoc ? lastDoc.id : null,
      hasMore: snapshot.size === limitValue,
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

    const clientKey = getRateLimitKey(request, 'purchase-orders', 'POST')
    checkRateLimit(clientKey, 60, 60_000)

    const actorKey = parsed.createdByUserId ?? parsed.retailerUserId ?? parsed.retailerOrgId
    if (actorKey) {
      checkRateLimit(getAuthScopedRateLimitKey(request, actorKey, 'purchase-orders'), 20, 60_000)
    }

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
