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

// Lightweight in-memory cache to avoid re-fetching when navigating back/forward quickly
type _CacheEntry = { ts: number; items: POSProduct[] }
const _posProductsCache: Map<string, _CacheEntry> = new Map()

export async function listPOSProducts(orgId: string, search?: string, limitN = 64): Promise<POSProduct[]> {
  const isSearching = Boolean(search && search.trim())
  const ttlMs = 60_000
  const cacheKey = `${orgId}::base`

  // Serve cached base list for non-search calls
  if (!isSearching) {
    const cached = _posProductsCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < ttlMs) {
      return cached.items.slice(0, limitN)
    }
  }

  const hardLimit = Math.max(1, Math.min(500, limitN || 64))
  // Try org-scoped, ordered query (fast if index exists)
  try {
    const qy = query(
      collection(db, POS_PRODUCTS_COL),
      where('orgId', '==', orgId),
      orderBy('updatedAt', 'desc'),
      limit(hardLimit)
    )
    const snap = await getDocs(qy)
    let rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))

    // If nothing found (e.g., missing orgId on older docs), fallback to global collection once
    if (!rows.length) {
      const allSnap = await getDocs(query(collection(db, POS_PRODUCTS_COL), limit(500)))
      rows = allSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    }

    const mapped = rows.map(toPOSItem)
    if (!isSearching) _posProductsCache.set(cacheKey, { ts: Date.now(), items: mapped })
    if (isSearching) {
      const s = search!.trim().toLowerCase()
      return mapped.filter(p => p.name.toLowerCase().includes(s) || p.brand?.toLowerCase().includes(s)).slice(0, hardLimit)
    }
    return mapped.slice(0, hardLimit)
  } catch (err: any) {
    const msg = String(err?.message || err)
    const requiresIndex = msg.includes('requires an index')
    // Fallback without orderBy to avoid index requirement
    const qy2 = query(
      collection(db, POS_PRODUCTS_COL),
      where('orgId', '==', orgId),
      limit(500)
    )
    const snap2 = await getDocs(qy2)
    let rows = snap2.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    if (!rows.length) {
      const allSnap = await getDocs(query(collection(db, POS_PRODUCTS_COL), limit(500)))
      rows = allSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    }
    // Client-side sort by updatedAt desc if present
    rows.sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    const mapped = rows.map(toPOSItem)
    if (!isSearching) _posProductsCache.set(cacheKey, { ts: Date.now(), items: mapped })
    if (isSearching) {
      const s = search!.trim().toLowerCase()
      return mapped.filter(p => p.name.toLowerCase().includes(s) || p.brand?.toLowerCase().includes(s)).slice(0, hardLimit)
    }
    return mapped.slice(0, hardLimit)
  }
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
  
  try {
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

      // Try to decrement inventory per product (but don't fail if inventory doesn't exist)
      for (const line of lines) {
        try {
          const invId = `${orgId}_${line.productId}`
          const invRef = doc(db, INVENTORY_COL, invId)
          const snap = await tx.get(invRef)
          
          if (snap.exists()) {
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
              if (newQtyBase > 0) {
                newQtyBase -= 1
                newQtyLoose = unitsPerBase - needed
              } else {
                // If insufficient stock, just set to 0
                newQtyLoose = 0
              }
            }
            
            if (base > newQtyBase) {
              newQtyBase = 0 // Set to 0 instead of throwing error
            } else {
              newQtyBase -= base
            }

            tx.update(invRef, {
              qtyBase: newQtyBase,
              qtyLoose: newQtyLoose,
              updatedAt: new Date().toISOString(),
              updatedBy: userId,
            })
          }
          // If inventory doesn't exist, just continue without error
        } catch (invError) {
          console.warn(`Failed to update inventory for product ${line.productId}:`, invError)
          // Continue processing other items
        }
      }

      return created.id
    })
    return id
  } catch (error) {
    console.error('Transaction failed:', error)
    // If transaction fails, create a simple order without inventory updates
    const simpleOrderDoc: POSOrderDoc = {
      orgId,
      userId,
      lines,
      total,
      createdAt: new Date().toISOString(),
      status: 'pending',
    }
    const fallbackOrder = await addDoc(orderRef, simpleOrderDoc)
    console.log('Created fallback order without inventory updates:', fallbackOrder.id)
    return fallbackOrder.id
  }
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
    // First check inventory collection with exact orgId match
    const q = query(collection(db, INVENTORY_COL), where('orgId', '==', orgId), limit(1))
    const c = await getCountFromServer(q as any)
    if (typeof c.data?.().count === 'number') {
      const count = c.data().count
      if (count > 0) return true
    } else {
      // Fallback for SDKs without count
      const docs = await getDocs(q)
      if (!docs.empty) return true
    }
    
    // If no inventory records found with exact orgId, check pos_products collection
    // Some products might have been added with orgId field or without inventory stubs
    const productsQuery = query(collection(db, POS_PRODUCTS_COL), where('orgId', '==', orgId), limit(1))
    const productsSnap = await getDocs(productsQuery)
    if (!productsSnap.empty) return true
    
    // Final fallback - check if any POS products exist at all (for legacy data)
    const allProductsQuery = query(collection(db, POS_PRODUCTS_COL), limit(1))
    const allProductsSnap = await getDocs(allProductsQuery)
    const hasAnyProducts = !allProductsSnap.empty
    
    // If there are any products, consider inventory as available
    return hasAnyProducts
  } catch (error) {
    console.error('Error checking inventory:', error)
    // If we can't determine, assume no inventory to be safe
    return false
  }
}
