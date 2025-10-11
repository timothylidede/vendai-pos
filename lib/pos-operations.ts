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

// Ensure db is initialized
function getDb() {
  if (!db) {
    throw new Error('Firestore is not initialized')
  }
  return db
}
import type {
  InventoryRecord,
  POSOrderDoc,
  POSOrderLine,
  POSProduct,
} from '@/lib/types'
import type {
  CreatePOSOrderOptions,
  POSOrderStatus,
  POSPayment,
  POSPaymentSummary,
} from '@/types/pos'

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
  // Fetch org-scoped products without requiring composite indexes
  try {
    const scopedLimit = Math.min(500, Math.max(hardLimit, 100))
    const qy = query(
      collection(getDb(), POS_PRODUCTS_COL),
      where('orgId', '==', orgId),
      limit(scopedLimit)
    )
    const snap = await getDocs(qy)
    let rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))

    if (!rows.length) {
      const allSnap = await getDocs(query(collection(getDb(), POS_PRODUCTS_COL), limit(scopedLimit)))
      rows = allSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    }

    rows.sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    const mapped = rows.map(toPOSItem)
    if (!isSearching) _posProductsCache.set(cacheKey, { ts: Date.now(), items: mapped })
    if (isSearching) {
      const s = search!.trim().toLowerCase()
      return mapped.filter(p => p.name.toLowerCase().includes(s) || p.brand?.toLowerCase().includes(s)).slice(0, hardLimit)
    }
    return mapped.slice(0, hardLimit)
  } catch (err) {
    console.error('Failed to list POS products', err)
    const allSnap = await getDocs(query(collection(getDb(), POS_PRODUCTS_COL), limit(500)))
    const rows = allSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
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
  const invRef = doc(getDb(), INVENTORY_COL, `${orgId}_${productId}`)
  const snap = await getDoc(invRef)
  if (!snap.exists()) return null
  return snap.data() as InventoryRecord
}

export async function addPosOrder(
  orgId: string,
  userId: string,
  lines: POSOrderLine[],
  options: CreatePOSOrderOptions = {},
  retryCount = 0
): Promise<string> {
  const total = lines.reduce((s, l) => s + l.lineTotal, 0)
  const orderRef = collection(getDb(), POS_ORDERS_COL)

  const payments: POSPayment[] = options.payments ?? []
  const totalApplied = payments.reduce((sum, payment) => sum + Math.max(0, payment.amount), 0)
  const totalTendered = payments.reduce((sum, payment) => sum + Math.max(0, payment.tenderedAmount ?? payment.amount), 0)
  const totalChange = payments.reduce((sum, payment) => sum + Math.max(0, payment.changeGiven ?? 0), 0)
  const balanceDue = options.balanceDue ?? Math.max(0, total - totalApplied)
  const status: POSOrderStatus = options.status ?? (balanceDue <= 0 ? 'paid' : 'awaiting_payment')
  const nowIso = new Date().toISOString()
  const completedAt = options.completedAt ?? (status === 'paid' ? nowIso : null)
  const lastPaymentAt = payments
    .map((payment) => payment.receivedAt)
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort()
    .pop()

  const paymentSummary: POSPaymentSummary | undefined = payments.length
    ? {
        totalApplied,
        totalTendered,
        totalChange,
        balanceDue,
        lastPaymentAt,
      }
    : undefined

  const baseOrderDoc: POSOrderDoc = {
    orgId,
    userId,
    cashierId: options.cashierId ?? userId,
    lines,
    payments,
    total,
    balanceDue,
    createdAt: nowIso,
    completedAt,
    status,
    updatedAt: nowIso,
  }

  // Multi-lane support: Add deviceId and laneId
  if (options.deviceId) {
    baseOrderDoc.deviceId = options.deviceId
  }
  if (options.laneId) {
    baseOrderDoc.laneId = options.laneId
  }

  if (paymentSummary) {
    baseOrderDoc.paymentSummary = paymentSummary
  }
  if (options.receiptNumber) {
    baseOrderDoc.receiptNumber = options.receiptNumber
  }
  if (options.checkoutContext) {
    baseOrderDoc.checkoutContext = options.checkoutContext
  }
  if (options.receipt) {
    baseOrderDoc.receipt = options.receipt
  }
  if (options.notes) {
    baseOrderDoc.notes = options.notes
  }
  const primaryPayment = payments[0]
  if (primaryPayment?.method) {
    baseOrderDoc.paymentMethod = primaryPayment.method
  }
  if (primaryPayment?.referenceId) {
    baseOrderDoc.paymentRef = primaryPayment.referenceId
  }

  const MAX_RETRIES = 3
  const RETRY_DELAY_MS = 100

  try {
    const id = await runTransaction(getDb(), async (tx) => {
      // Create order
      const orderDoc: POSOrderDoc = { ...baseOrderDoc }
      const created = await addDoc(orderRef, orderDoc)

      // Try to decrement inventory per product (but don't fail if inventory doesn't exist)
      for (const line of lines) {
        try {
          const invId = `${orgId}_${line.productId}`
          const invRef = doc(getDb(), INVENTORY_COL, invId)
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
    return id as string
  } catch (error) {
    // Implement exponential backoff retry for contention errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isContentionError = errorMessage.includes('contention') || 
                              errorMessage.includes('aborted') ||
                              errorMessage.includes('concurrent')

    if (isContentionError && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount)
      console.log(`Transaction contention detected. Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return addPosOrder(orgId, userId, lines, options, retryCount + 1)
    }

    console.error('Transaction failed:', error)
    // If transaction fails, create a simple order without inventory updates
    const fallbackOrder = await addDoc(orderRef, {
      ...baseOrderDoc,
      status: status === 'paid' && balanceDue > 0 ? 'awaiting_payment' : status,
    })
    console.log('Created fallback order without inventory updates:', fallbackOrder.id)
    return fallbackOrder.id
  }
}

export async function listRecentOrders(orgId: string, limitN = 30): Promise<{ orders: any[]; missingIndex: boolean; indexHint?: string }> {
  try {
    const qy = query(
      collection(getDb(), POS_ORDERS_COL),
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
      collection(getDb(), POS_ORDERS_COL),
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
    const q = query(collection(getDb(), INVENTORY_COL), where('orgId', '==', orgId), limit(1))
    const c = await getCountFromServer(q as any)
    if (typeof c.data?.().count === 'number') {
      const count = c.data().count
      if (count > 0) return true
    } else {
      // Fallback for SDKs without count
      const docs = await getDocs(q)
      if (!docs.empty) return true
    }
    // If no inventory records found, org is not ready
    return false
  } catch (error) {
    console.error('Error checking inventory:', error)
    // If we can't determine, assume no inventory to be safe
    return false
  }
}
