/**
 * Purchase Order utilities - create and manage supplier purchase orders
 * Part of Phase 1.1 Receiving Flow Completion
 */

import { getFirestore } from 'firebase/firestore'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore'
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  CreatePurchaseOrderRequest,
  ReceiveDeliveryRequest,
  ReceiveDeliveryResponse,
  LedgerEntryCoGS,
} from '@/types/purchase-orders'
import type { InventoryRecord } from '@/lib/types'
import { INVENTORY_COL } from '@/lib/pos-operations'

export const PURCHASE_ORDERS_COL = 'purchase_orders'
export const LEDGER_ENTRIES_COL = 'ledger_entries'

/**
 * Create a new purchase order from supplier cart
 */
export async function createPurchaseOrder(
  request: CreatePurchaseOrderRequest,
  userId: string
): Promise<string> {
  const db = getFirestore()
  if (!db) throw new Error('Firestore not initialized')

  const lines: PurchaseOrderLine[] = request.lines.map(line => ({
    productId: line.productId,
    productName: line.productName,
    quantityOrdered: line.quantity,
    quantityReceived: 0,
    unitPrice: line.unitPrice,
    unit: line.unit || 'PCS',
    lineTotal: line.quantity * line.unitPrice,
  }))

  const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0)

  const poData: Omit<PurchaseOrder, 'id'> = {
    orgId: request.orgId,
    supplierId: request.supplierId,
    supplierName: request.supplierName,
    lines,
    status: 'submitted',
    totalAmount,
    expectedDate: request.expectedDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: serverTimestamp() as any,
    createdBy: userId,
    submittedAt: serverTimestamp() as any,
    notes: request.notes,
    deliveryAddress: request.deliveryAddress,
    contactPhone: request.contactPhone,
  }

  const docRef = await addDoc(collection(db, PURCHASE_ORDERS_COL), poData)
  return docRef.id
}

/**
 * Get a purchase order by ID
 */
export async function getPurchaseOrder(poId: string): Promise<PurchaseOrder | null> {
  const db = getFirestore()
  if (!db) throw new Error('Firestore not initialized')
  
  const docRef = doc(db, PURCHASE_ORDERS_COL, poId)
  const snap = await getDoc(docRef)
  
  if (!snap.exists()) return null
  
  return {
    id: snap.id,
    ...snap.data(),
  } as PurchaseOrder
}

/**
 * List purchase orders for an organization
 */
export async function listPurchaseOrders(
  orgId: string,
  limitCount = 50
): Promise<PurchaseOrder[]> {
  const db = getFirestore()
  if (!db) throw new Error('Firestore not initialized')

  const q = query(
    collection(db, PURCHASE_ORDERS_COL),
    where('orgId', '==', orgId),
    orderBy('createdAt', 'desc'),
    firestoreLimit(limitCount)
  )

  const snap = await getDocs(q)
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as PurchaseOrder[]
}

/**
 * Receive delivery - atomically update inventory and mark PO as received
 */
export async function receiveDelivery(
  request: ReceiveDeliveryRequest
): Promise<ReceiveDeliveryResponse> {
  const db = getFirestore()
  if (!db) throw new Error('Firestore not initialized')

  // Store orgId for webhook trigger
  let orgId: string = request.orgId

  const result = await runTransaction(db, async (transaction) => {
    // 1. Fetch the PO
    const poRef = doc(db, PURCHASE_ORDERS_COL, request.poId)
    const poSnap = await transaction.get(poRef)
    
    if (!poSnap.exists()) {
      throw new Error(`Purchase order ${request.poId} not found`)
    }

    const po = { id: poSnap.id, ...poSnap.data() } as PurchaseOrder

    if (po.orgId !== request.orgId) {
      throw new Error('Organization mismatch')
    }

    if (po.status === 'received' || po.status === 'cancelled') {
      throw new Error(`Cannot receive delivery for PO with status: ${po.status}`)
    }

    // 2. Build a map of received quantities
    const receivedMap = new Map(
      request.receivedLines.map(rl => [rl.productId, rl.quantityReceived])
    )

    // 3. Update each line and increment inventory
    const updatedLines: PurchaseOrderLine[] = []
    const inventoryUpdated: string[] = []
    let totalReceived = 0
    let totalOrdered = 0

    for (const line of po.lines) {
      const receivedQty = receivedMap.get(line.productId) || 0
      const newReceivedQty = (line.quantityReceived || 0) + receivedQty

      updatedLines.push({
        ...line,
        quantityReceived: newReceivedQty,
      })

      totalOrdered += line.quantityOrdered
      totalReceived += newReceivedQty

      // Increment inventory if qty received
      if (receivedQty > 0) {
        const invId = `${po.orgId}_${line.productId}`
        const invRef = doc(db, INVENTORY_COL, invId)
        const invSnap = await transaction.get(invRef)

        if (invSnap.exists()) {
          const inv = invSnap.data() as InventoryRecord
          const unitsPerBase = inv.unitsPerBase || 1

          // Convert pieces to base + loose
          const currentTotalPieces = inv.qtyBase * unitsPerBase + inv.qtyLoose
          const newTotalPieces = currentTotalPieces + receivedQty
          const newBase = Math.floor(newTotalPieces / unitsPerBase)
          const newLoose = newTotalPieces % unitsPerBase

          transaction.update(invRef, {
            qtyBase: newBase,
            qtyLoose: newLoose,
            updatedAt: serverTimestamp(),
          })

          inventoryUpdated.push(line.productId)
        } else {
          // Create new inventory record if doesn't exist
          const unitsPerBase = 1 // Default, should ideally come from pos_products
          const newBase = Math.floor(receivedQty / unitsPerBase)
          const newLoose = receivedQty % unitsPerBase

          transaction.set(invRef, {
            orgId: po.orgId,
            productId: line.productId,
            qtyBase: newBase,
            qtyLoose: newLoose,
            unitsPerBase,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })

          inventoryUpdated.push(line.productId)
        }
      }
    }

    // 4. Determine new PO status
    let newStatus: PurchaseOrder['status']
    if (totalReceived >= totalOrdered) {
      newStatus = 'received'
    } else if (totalReceived > 0) {
      newStatus = 'partially_received'
    } else {
      newStatus = po.status // Keep current status if nothing received
    }

    // 5. Update the PO
    const poUpdate: any = {
      lines: updatedLines,
      status: newStatus,
      updatedAt: serverTimestamp(),
    }

    if (newStatus === 'received') {
      poUpdate.receivedAt = serverTimestamp()
    }

    transaction.update(poRef, poUpdate)

    // 6. Create COGS ledger entry
    if (inventoryUpdated.length > 0) {
      const cogsAmount = updatedLines
        .filter(l => receivedMap.has(l.productId))
        .reduce((sum, l) => {
          const qty = receivedMap.get(l.productId) || 0
          return sum + (qty * l.unitPrice)
        }, 0)

      const ledgerEntry: Omit<LedgerEntryCoGS, 'id'> = {
        orgId: po.orgId,
        type: 'COGS',
        poId: request.poId,
        supplierId: po.supplierId,
        amount: cogsAmount,
        productIds: inventoryUpdated,
        createdAt: serverTimestamp() as any,
        description: `COGS for PO ${request.poId} - ${po.supplierName}`,
      }

      await addDoc(collection(db, LEDGER_ENTRIES_COL), ledgerEntry)
    }

    return {
      success: true,
      poId: request.poId,
      inventoryUpdated,
      status: newStatus,
      message: newStatus === 'received' 
        ? 'Delivery fully received and inventory updated'
        : 'Partial delivery received',
    }
  })

  // 7. Trigger webhooks for inventory updates (non-blocking)
  if (result.success && result.inventoryUpdated.length > 0) {
    try {
      // Import dynamically to avoid circular dependencies
      const { triggerStockUpdateWebhook } = await import('./pos-sync-triggers')
      
      // Trigger webhook for each updated product
      for (const productId of result.inventoryUpdated) {
        await triggerStockUpdateWebhook(orgId, productId, {} as any)
      }
    } catch (error) {
      console.error('Failed to trigger stock update webhooks:', error)
      // Non-blocking: Don't fail the operation if webhooks fail
    }
  }

  return result
}

/**
 * Cancel a purchase order (before receiving)
 */
export async function cancelPurchaseOrder(
  poId: string,
  orgId: string,
  reason?: string
): Promise<void> {
  const db = getFirestore()
  if (!db) throw new Error('Firestore not initialized')

  const poRef = doc(db, PURCHASE_ORDERS_COL, poId)
  
  await runTransaction(db, async (transaction) => {
    const poSnap = await transaction.get(poRef)
    
    if (!poSnap.exists()) {
      throw new Error('Purchase order not found')
    }

    const po = poSnap.data() as PurchaseOrder
    
    if (po.orgId !== orgId) {
      throw new Error('Organization mismatch')
    }

    if (po.status === 'received' || po.status === 'partially_received') {
      throw new Error('Cannot cancel a PO that has already been received')
    }

    transaction.update(poRef, {
      status: 'cancelled',
      notes: reason ? `${po.notes || ''}\nCancelled: ${reason}` : po.notes,
      updatedAt: serverTimestamp(),
    })
  })
}
