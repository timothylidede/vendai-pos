import { NextRequest, NextResponse } from 'next/server'
import { getDoc } from 'firebase/firestore'

import {
  purchaseOrderDoc,
  updatePurchaseOrder,
  type PurchaseOrderCreateInput,
} from '@/lib/b2b-order-store'
import {
  buildStatusHistoryEntry,
  mapDeliveryCheckpoints,
  serializePurchaseOrder,
  toTimestamp,
} from '@/lib/b2b-order-utils'
import { sanitizeInput, schemas } from '@/lib/validation'
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/b2b-orders'

interface RouteContext {
  params: {
    purchaseOrderId?: string
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const purchaseOrderId = context.params.purchaseOrderId

    if (!purchaseOrderId) {
      return NextResponse.json(
        { success: false, error: 'Purchase order ID is required' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const parsed = sanitizeInput(body, schemas.purchaseOrderUpdate)

    const snapshot = await getDoc(purchaseOrderDoc(purchaseOrderId))
    if (!snapshot.exists()) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 },
      )
    }

    const existing = snapshot.data() as Partial<PurchaseOrder>
    const {
      status,
      statusNote,
      updatedByUserId,
      updatedByName,
      deliveryCheckpoints,
      expectedDeliveryDate,
      items,
      amount,
      paymentTerms,
      deliveryAddress,
      notes,
      relatedInvoiceId,
    } = parsed

    const updates: Partial<PurchaseOrderCreateInput> = {}

    if (paymentTerms !== undefined) {
      updates.paymentTerms = paymentTerms
    }

    if (deliveryAddress !== undefined) {
      updates.deliveryAddress = deliveryAddress
    }

    if (notes !== undefined) {
      updates.notes = notes
    }

    if (items !== undefined) {
      updates.items = items
    }

    if (amount !== undefined) {
      updates.amount = amount
    }

    if (relatedInvoiceId !== undefined) {
      updates.relatedInvoiceId = relatedInvoiceId ?? null
    }

    if (expectedDeliveryDate === null) {
      updates.expectedDeliveryDate = null
    } else if (expectedDeliveryDate !== undefined) {
      const parsedExpectedDeliveryDate = toTimestamp(expectedDeliveryDate)
      if (!parsedExpectedDeliveryDate) {
        return NextResponse.json(
          { success: false, error: 'Invalid expected delivery date' },
          { status: 400 },
        )
      }
      updates.expectedDeliveryDate = parsedExpectedDeliveryDate
    }

    if (deliveryCheckpoints === null) {
      updates.deliveryCheckpoints = []
    } else if (deliveryCheckpoints !== undefined) {
      updates.deliveryCheckpoints = mapDeliveryCheckpoints(deliveryCheckpoints) ?? []
    }

    const history = Array.isArray(existing.statusHistory)
      ? [...existing.statusHistory]
      : []

    if (status && status !== existing.status) {
      updates.status = status
    }

    if ((status && status !== existing.status) || statusNote) {
      const actorId = updatedByUserId || existing.createdByUserId || 'system'
      const actorName = updatedByName || existing.createdByName || 'System'
      const targetStatus = (status ?? existing.status ?? 'submitted') as PurchaseOrderStatus
      const historyEntry = buildStatusHistoryEntry(
        targetStatus,
        actorId,
        actorName,
        statusNote || (status ? `Status updated to ${status}` : undefined),
      )
      history.push(historyEntry)
      updates.statusHistory = history
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updatable fields provided' },
        { status: 400 },
      )
    }

    await updatePurchaseOrder(purchaseOrderId, updates)

    const refreshed = await getDoc(purchaseOrderDoc(purchaseOrderId))
    if (!refreshed.exists()) {
      return NextResponse.json({ success: true, purchaseOrderId })
    }

    const responsePayload = serializePurchaseOrder(
      purchaseOrderId,
      refreshed.data(),
    )

    return NextResponse.json({ success: true, purchaseOrder: responsePayload })
  } catch (error) {
    console.error('Failed to update purchase order', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update purchase order' },
      { status: 500 },
    )
  }
}
