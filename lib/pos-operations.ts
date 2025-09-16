import { db } from '@/lib/firebase'
import {
  addDoc,
  collection,
  getCountFromServer,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore'
import type {
  InventoryRecord,
  POSOrderDoc,
  POSOrderLine,
  POSProduct,
} from '@/lib/types'

// Collections
export const POS_PRODUCTS_COL = 'pos_products'
export const INVENTORY_COL = 'inventory'
export const POS_ORDERS_COL = 'pos_orders'

// Convert a product doc + inventory doc into a POS-ready item
export function toPOSItem(p: any): POSProduct {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    image: p.image,
    baseUom: p.baseUom ?? 'CTN',
    retailUom: p.retailUom ?? 'PCS',
    unitsPerBase: p.unitsPerBase ?? p.wholesaleQuantity ?? 1,
    pieceBarcode: p.pieceBarcode,
    cartonBarcode: p.cartonBarcode,
    piecePrice: typeof p.piecePrice === 'number' ? p.piecePrice : (typeof p.price === 'number' ? p.price : 0),
    cartonPrice: typeof p.wholesalePrice === 'number' ? p.wholesalePrice : undefined,
  }
}

export function computeIssueFromPieces(qtyPieces: number, unitsPerBase: number): { base: number; loose: number } {
  const base = Math.floor(qtyPieces / unitsPerBase)
  const loose = qtyPieces % unitsPerBase
  return { base, loose }
}

export function ensureSufficientStock(inv: InventoryRecord | null, qtyPieces: number): boolean {
  if (!inv) return false
  const totalPieces = inv.qtyBase * inv.unitsPerBase + inv.qtyLoose
  return totalPieces >= qtyPieces
}

export async function listPOSProducts(orgId: string, search?: string, limitN = 64): Promise<POSProduct[]> {
  // For now, do a simple query and filter client-side; can be optimized with indexes
  const q = query(collection(db, POS_PRODUCTS_COL))
  const snap = await getDocs(q)
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  const mapped = all.map(toPOSItem)
  let res = mapped
  if (search && search.trim()) {
    const s = search.trim().toLowerCase()
    res = mapped.filter(p => p.name.toLowerCase().includes(s) || p.brand?.toLowerCase().includes(s))
  }
  return res.slice(0, limitN)
}

export async function getInventory(orgId: string, productId: string): Promise<InventoryRecord | null> {
  const invRef = doc(db, INVENTORY_COL, `${orgId}_${productId}`)
  const snap = await getDoc(invRef)
  if (!snap.exists()) return null
  return snap.data() as InventoryRecord
}

export async function addPosOrder(orgId: string, userId: string, lines: POSOrderLine[]): Promise<string> {
  const total = lines.reduce((s, l) => s + l.lineTotal, 0)
  const orderRef = collection(db, POS_ORDERS_COL)
  const id = await runTransaction(db, async (tx) => {
    // Create order
    const orderDoc: POSOrderDoc = {
      orgId,
      userId,
      lines,
      total,
      createdAt: new Date().toISOString(),
      status: 'pending',
    }
    const created = await addDoc(orderRef, orderDoc)

    // Decrement inventory per product
    for (const line of lines) {
      const invId = `${orgId}_${line.productId}`
      const invRef = doc(db, INVENTORY_COL, invId)
      const snap = await tx.get(invRef)
      if (!snap.exists()) {
        throw new Error(`Inventory missing for product ${line.productId}`)
      }
      const inv = snap.data() as InventoryRecord
      const unitsPerBase = inv.unitsPerBase || 1
      const { base, loose } = computeIssueFromPieces(line.quantityPieces, unitsPerBase)

      let newQtyBase = inv.qtyBase
      let newQtyLoose = inv.qtyLoose

      // Issue loose first, then base
      if (newQtyLoose >= loose) {
        newQtyLoose -= loose
      } else {
        const needed = loose - newQtyLoose
        // borrow one base if possible
        if (newQtyBase <= 0) throw new Error('Insufficient stock')
        newQtyBase -= 1
        newQtyLoose = unitsPerBase - needed
      }
      if (base > newQtyBase) throw new Error('Insufficient stock')
      newQtyBase -= base

      tx.update(invRef, {
        qtyBase: newQtyBase,
        qtyLoose: newQtyLoose,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      })
    }

    return created.id
  })
  return id
}

export async function listRecentOrders(orgId: string, limitN = 30): Promise<{ orders: any[]; missingIndex: boolean; indexHint?: string }> {
  try {
    const qy = query(
      collection(db, POS_ORDERS_COL),
      where('orgId', '==', orgId),
      orderBy('createdAt', 'desc'),
      limit(limitN)
    )
    const snap = await getDocs(qy)
    return { orders: snap.docs.map(d => ({ id: d.id, ...d.data() })), missingIndex: false }
  } catch (err: any) {
    const msg = String(err?.message || err)
    const isIndex = msg.includes('requires an index')
    // Fallback: no orderBy; client-side sort
    const qy2 = query(
      collection(db, POS_ORDERS_COL),
      where('orgId', '==', orgId),
      limit(limitN)
    )
    const snap2 = await getDocs(qy2)
    const rows = snap2.docs.map(d => ({ id: d.id, ...d.data() }))
    rows.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    if (isIndex) {
      console.warn('Firestore composite index missing for pos_orders(orgId, createdAt desc). Using fallback (client-side sort). Consider creating the index for better performance.')
    }
    return { orders: rows, missingIndex: isIndex, indexHint: 'Add composite index on pos_orders: where orgId ==, orderBy createdAt desc' }
  }
}

export async function hasInventory(orgId: string): Promise<boolean> {
  try {
    const q = query(collection(db, INVENTORY_COL), where('orgId', '==', orgId), limit(1))
    const c = await getCountFromServer(q as any)
    if (typeof c.data?.().count === 'number') {
      return c.data().count > 0
    }
    // Fallback for SDKs without count
    const docs = await getDocs(q)
    return !docs.empty
  } catch {
    // If we can't determine, assume no inventory to be safe
    return false
  }
}
