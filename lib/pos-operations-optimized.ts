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
  writeBatch,
  updateDoc,
} from 'firebase/firestore'
import type { DocumentReference, Transaction } from 'firebase/firestore'

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
  POSCheckoutContext,
  POSOrderStatus,
  POSPayment,
  POSPaymentSummary,
  POSReceipt,
  POSInventoryAdjustment,
  POSPaymentAuditEvent,
} from '@/types/pos'

// Legacy collections (backward compatibility)
export const POS_PRODUCTS_COL = 'pos_products'
export const INVENTORY_COL = 'inventory'
export const POS_ORDERS_COL = 'pos_orders'

// Optimized hierarchical structure
export const ORGANIZATIONS_COL = 'organizations'
export const ORG_PRODUCTS_SUBCOL = 'products'
export const ORG_INVENTORY_SUBCOL = 'inventory'
export const ORG_POS_ORDERS_SUBCOL = 'pos_orders'
export const ORG_POS_PAYMENT_AUDIT_SUBCOL = 'pos_payment_audit'
export const POS_PAYMENT_AUDIT_COL = 'pos_payment_audit'

// Performance cache
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>()

function getCached<T>(key: string): T | null {
  const cached = cache.get(key)
  if (!cached) return null
  
  if (Date.now() > cached.timestamp + cached.ttl) {
    cache.delete(key)
    return null
  }
  
  return cached.data as T
}

function setCache(key: string, data: any, ttlMinutes: number = 15) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMinutes * 60 * 1000
  })
}

function clearCachePattern(pattern: string) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key)
    }
  }
}

function compactRecord<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result as T
}

// Convert product doc to POS-ready item (supports both old and new structure)
export function toPOSItem(p: any): POSProduct {
  return {
    id: p.id || '',
    name: p.name || '',
    brand: p.brand || '',
    category: p.category || 'General',
    image: p.image || '',
    
    // Handle both old and new structure
    baseUom: p.baseUom || 'CTN',
    retailUom: p.retailUom || 'PCS',
    unitsPerBase: p.stock?.unitsPerBase || p.unitsPerBase || p.wholesaleQuantity || 1,
    
    // Barcodes - new structure has nested barcodes object
    pieceBarcode: p.barcodes?.piece || p.pieceBarcode || '',
    cartonBarcode: p.barcodes?.carton || p.cartonBarcode || '',
    
    // Pricing - new structure has nested pricing object
    piecePrice: p.pricing?.retail || p.piecePrice || p.price || 0,
    cartonPrice: p.pricing?.wholesale || p.wholesalePrice || undefined,
  }
}

export function computeIssueFromPieces(qtyPieces: number, unitsPerBase: number): { base: number; loose: number } {
  const base = Math.floor(qtyPieces / unitsPerBase)
  const loose = qtyPieces % unitsPerBase
  return { base, loose }
}

export function ensureSufficientStock(inv: InventoryRecord | null, qtyPieces: number): boolean {
  if (!inv) return false
  const available = (inv.qtyBase * (inv.unitsPerBase || 1)) + inv.qtyLoose
  return available >= qtyPieces
}

// Enhanced product listing with optimized structure support
export async function listPOSProducts(
  orgId: string, 
  search?: string,
  limit_?: number
): Promise<POSProduct[]> {
  const cacheKey = `pos_products:${orgId}:${search || 'all'}:${limit_ || 25}`
  const cached = getCached<POSProduct[]>(cacheKey)
  if (cached) return cached

  let products: POSProduct[] = []

  try {
    // Try optimized hierarchical structure first
    const optimizedQuery = query(
      collection(getDb(), ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL),
      orderBy('updatedAt', 'desc'),
      limit(limit_ || 25)
    )
    
    const snapshot = await getDocs(optimizedQuery)
    
    if (!snapshot.empty) {
      // Successfully got data from optimized structure
      products = snapshot.docs.map(doc => {
        const data = doc.data()
        return toPOSItem({ ...data, id: doc.id })
      })
    } else {
      // Fall back to legacy structure
      const scopedLimit = Math.min(500, Math.max(limit_ || 25, 100))
      const legacyQuery = query(
        collection(getDb(), POS_PRODUCTS_COL),
        where('orgId', '==', orgId),
        limit(scopedLimit)
      )
      
      const legacySnapshot = await getDocs(legacyQuery)
      const toLegacyItem = (doc: any) => toPOSItem({ ...doc.data(), id: doc.id })
      const getUpdated = (item: POSProduct) => {
        const meta = item as unknown as { updatedAt?: string; createdAt?: string }
        return new Date(meta?.updatedAt || meta?.createdAt || 0).getTime()
      }
      products = legacySnapshot.docs.map(toLegacyItem).sort((a, b) => getUpdated(b) - getUpdated(a))
    }
    
  } catch (error) {
    console.warn('Optimized query failed, trying legacy structure:', error)
    
    // Fallback to legacy structure
    try {
      const scopedLimit = Math.min(500, Math.max(limit_ || 25, 100))
      const legacyQuery = query(
        collection(getDb(), POS_PRODUCTS_COL),
        where('orgId', '==', orgId),
        limit(scopedLimit)
      )
      
      const legacySnapshot = await getDocs(legacyQuery)
      const toLegacyItem = (doc: any) => toPOSItem({ ...doc.data(), id: doc.id })
      const getUpdated = (item: POSProduct) => {
        const meta = item as unknown as { updatedAt?: string; createdAt?: string }
        return new Date(meta?.updatedAt || meta?.createdAt || 0).getTime()
      }
      products = legacySnapshot.docs.map(toLegacyItem).sort((a, b) => getUpdated(b) - getUpdated(a))
      
    } catch (legacyError) {
      console.error('Both optimized and legacy queries failed:', legacyError)
      return []
    }
  }

  // Apply search filter
  if (search) {
    const searchTerm = search.toLowerCase()
    products = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      p.brand?.toLowerCase().includes(searchTerm) ||
      p.pieceBarcode?.toLowerCase().includes(searchTerm) ||
      p.cartonBarcode?.toLowerCase().includes(searchTerm)
    )
  }

  setCache(cacheKey, products, 15) // Cache for 15 minutes
  return products
}

// Enhanced inventory retrieval with optimized structure support
export async function getInventory(orgId: string, productId: string): Promise<InventoryRecord | null> {
  const cacheKey = `inventory:${orgId}:${productId}`
  const cached = getCached<InventoryRecord>(cacheKey)
  if (cached) return cached

  let inventory: InventoryRecord | null = null

  try {
    // Try to get from optimized product document first
    const productDoc = await getDoc(doc(getDb(), ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL, productId))
    
    if (productDoc.exists()) {
      const productData = productDoc.data()
      if (productData.stock) {
        // Convert optimized stock format to legacy InventoryRecord format
        inventory = {
          productId,
          orgId,
          qtyBase: productData.stock.qtyBase || 0,
          qtyLoose: productData.stock.qtyLoose || 0,
          unitsPerBase: productData.stock.unitsPerBase || 1,
        } as InventoryRecord
      }
    } else {
      // Fallback to legacy inventory collection
      const legacyInventoryDoc = await getDoc(doc(getDb(), INVENTORY_COL, `${orgId}_${productId}`))
      if (legacyInventoryDoc.exists()) {
        inventory = legacyInventoryDoc.data() as InventoryRecord
      }
    }
    
  } catch (error) {
    console.warn('Optimized inventory query failed, trying legacy:', error)
    
    // Direct fallback to legacy structure
    try {
      const legacyInventoryDoc = await getDoc(doc(getDb(), INVENTORY_COL, `${orgId}_${productId}`))
      if (legacyInventoryDoc.exists()) {
        inventory = legacyInventoryDoc.data() as InventoryRecord
      }
    } catch (legacyError) {
      console.error('Both optimized and legacy inventory queries failed:', legacyError)
      return null
    }
  }

  if (inventory) {
    setCache(cacheKey, inventory, 10) // Cache for 10 minutes
  }

  return inventory
}

// Enhanced order creation with optimized inventory management
export async function addPosOrder(
  orgId: string,
  userId: string,
  lines: POSOrderLine[],
  options: CreatePOSOrderOptions = {},
): Promise<string> {
  const total = lines.reduce((s, l) => s + l.lineTotal, 0)
  const nowIso = new Date().toISOString()

  const payments: POSPayment[] = options.payments ?? []
  const totalApplied = payments.reduce((sum, payment) => sum + Math.max(0, payment.amount), 0)
  const totalTendered = payments.reduce(
    (sum, payment) => sum + Math.max(0, payment.tenderedAmount ?? payment.amount),
    0,
  )
  const totalChange = payments.reduce((sum, payment) => sum + Math.max(0, payment.changeGiven ?? 0), 0)
  const balanceDue = options.balanceDue ?? Math.max(0, total - totalApplied)
  const status: POSOrderStatus = options.status ?? (balanceDue <= 0 ? 'paid' : 'awaiting_payment')
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

  let lastInventoryAdjustments: POSInventoryAdjustment[] = []
  let lastInventoryCommitted = false

  try {
    const createdOrderId = await runTransaction(getDb(), async (tx) => {
      // Create order in optimized structure first, fall back to legacy
      let orderRef
      let useOptimized = true
      
      try {
        orderRef = doc(collection(getDb(), ORGANIZATIONS_COL, orgId, ORG_POS_ORDERS_SUBCOL))
      } catch (error) {
        console.warn('Using legacy order structure:', error)
        orderRef = doc(collection(getDb(), POS_ORDERS_COL))
        useOptimized = false
      }

  const orderDoc: POSOrderDoc = { ...baseOrderDoc }

  const optimizedStockUpdates: Array<{ ref: ReturnType<typeof doc>; stock: any }> = []
  const legacyInventoryUpdates: Array<{ ref: ReturnType<typeof doc>; updates: Partial<InventoryRecord> }> = []
  const inventoryAdjustments: POSInventoryAdjustment[] = []

      // Update inventory for each product line
      for (const line of lines) {
        try {
          let productRef
          
          if (useOptimized) {
            // Try optimized structure - update stock in product document
            productRef = doc(getDb(), ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL, line.productId)
            const productSnap = await tx.get(productRef)
            
            if (productSnap.exists()) {
              const productData = productSnap.data()
              const currentStock = productData.stock || { qtyBase: 0, qtyLoose: 0, unitsPerBase: 1 }
              const prevQtyBase = currentStock.qtyBase ?? 0
              const prevQtyLoose = currentStock.qtyLoose ?? 0
              
              // Calculate stock deduction
              const { base: baseToDeduct, loose: looseToDeduct } = computeIssueFromPieces(
                line.quantityPieces, 
                currentStock.unitsPerBase || 1
              )
              
              let newQtyBase = currentStock.qtyBase - baseToDeduct
              let newQtyLoose = currentStock.qtyLoose - looseToDeduct
              
              if (newQtyLoose < 0) {
                newQtyBase += Math.floor(newQtyLoose / (currentStock.unitsPerBase || 1))
                newQtyLoose = newQtyLoose % (currentStock.unitsPerBase || 1)
                if (newQtyLoose < 0) {
                  newQtyLoose += (currentStock.unitsPerBase || 1)
                  newQtyBase -= 1
                }
              }
              
              const updatedStock = {
                ...currentStock,
                qtyBase: Math.max(0, newQtyBase),
                qtyLoose: Math.max(0, newQtyLoose),
                available: Math.max(0, (Math.max(0, newQtyBase) * (currentStock.unitsPerBase || 1)) + Math.max(0, newQtyLoose)),
                lastUpdated: nowIso,
                updatedBy: baseOrderDoc.cashierId ?? userId,
              }
              optimizedStockUpdates.push({
                ref: productRef,
                stock: updatedStock
              })

              const deltaBase = (updatedStock.qtyBase ?? 0) - prevQtyBase
              const deltaLoose = (updatedStock.qtyLoose ?? 0) - prevQtyLoose
              if (deltaBase !== 0 || deltaLoose !== 0) {
                inventoryAdjustments.push({
                  productId: line.productId,
                  docPath: [ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL, line.productId],
                  qtyBaseDelta: deltaBase,
                  qtyLooseDelta: deltaLoose,
                  structure: 'optimized',
                  unitsPerBase: currentStock.unitsPerBase || 1,
                  appliedAt: nowIso,
                })
              }
            } else {
              // Fallback to legacy inventory for missing optimized docs
              const invRef = doc(getDb(), INVENTORY_COL, `${orgId}_${line.productId}`)
              const invSnap = await tx.get(invRef)
              if (invSnap.exists()) {
                const inv = invSnap.data() as InventoryRecord
                const { base: baseToDeduct, loose: looseToDeduct } = computeIssueFromPieces(line.quantityPieces, inv.unitsPerBase || 1)

                let newQtyBase = inv.qtyBase - baseToDeduct
                let newQtyLoose = inv.qtyLoose - looseToDeduct

                if (newQtyLoose < 0) {
                  newQtyBase += Math.floor(newQtyLoose / (inv.unitsPerBase || 1))
                  newQtyLoose = newQtyLoose % (inv.unitsPerBase || 1)
                  if (newQtyLoose < 0) {
                    newQtyLoose += (inv.unitsPerBase || 1)
                    newQtyBase -= 1
                  }
                }

                const clampedBase = Math.max(0, newQtyBase)
                const clampedLoose = Math.max(0, newQtyLoose)

                legacyInventoryUpdates.push({
                  ref: invRef,
                  updates: {
                    qtyBase: clampedBase,
                    qtyLoose: clampedLoose
                  }
                })

                const deltaBase = clampedBase - inv.qtyBase
                const deltaLoose = clampedLoose - inv.qtyLoose
                if (deltaBase !== 0 || deltaLoose !== 0) {
                  inventoryAdjustments.push({
                    productId: line.productId,
                    docPath: [INVENTORY_COL, `${orgId}_${line.productId}`],
                    qtyBaseDelta: deltaBase,
                    qtyLooseDelta: deltaLoose,
                    structure: 'legacy',
                    unitsPerBase: inv.unitsPerBase || 1,
                    appliedAt: nowIso,
                  })
                }
              }
            }
          } else {
            // Fallback to legacy inventory structure
            const invId = `${orgId}_${line.productId}`
            const invRef = doc(getDb(), INVENTORY_COL, invId)
            const invSnap = await tx.get(invRef)
            
            if (invSnap.exists()) {
              const inv = invSnap.data() as InventoryRecord
              const { base: baseToDeduct, loose: looseToDeduct } = computeIssueFromPieces(line.quantityPieces, inv.unitsPerBase || 1)
              
              let newQtyBase = inv.qtyBase - baseToDeduct
              let newQtyLoose = inv.qtyLoose - looseToDeduct
              
              if (newQtyLoose < 0) {
                newQtyBase += Math.floor(newQtyLoose / (inv.unitsPerBase || 1))
                newQtyLoose = newQtyLoose % (inv.unitsPerBase || 1)
                if (newQtyLoose < 0) {
                  newQtyLoose += (inv.unitsPerBase || 1)
                  newQtyBase -= 1
                }
              }
              const clampedBase = Math.max(0, newQtyBase)
              const clampedLoose = Math.max(0, newQtyLoose)

              legacyInventoryUpdates.push({
                ref: invRef,
                updates: {
                  qtyBase: clampedBase,
                  qtyLoose: clampedLoose
                }
              })

              const deltaBase = clampedBase - inv.qtyBase
              const deltaLoose = clampedLoose - inv.qtyLoose
              if (deltaBase !== 0 || deltaLoose !== 0) {
                inventoryAdjustments.push({
                  productId: line.productId,
                  docPath: [INVENTORY_COL, invId],
                  qtyBaseDelta: deltaBase,
                  qtyLooseDelta: deltaLoose,
                  structure: 'legacy',
                  unitsPerBase: inv.unitsPerBase || 1,
                  appliedAt: nowIso,
                })
              }
            }
          }
          
        } catch (invError) {
          console.warn(`Failed to update inventory for product ${line.productId}:`, invError)
          // Continue with order creation even if inventory update fails
        }
      }

      if (inventoryAdjustments.length) {
        orderDoc.inventoryAdjustments = inventoryAdjustments
        orderDoc.inventoryCommitted = true
      } else {
        orderDoc.inventoryCommitted = false
      }

      lastInventoryAdjustments = inventoryAdjustments
      lastInventoryCommitted = inventoryAdjustments.length > 0

      // Perform writes after all reads to satisfy Firestore transaction requirements
      tx.set(orderRef, orderDoc)

      for (const update of optimizedStockUpdates) {
        tx.update(update.ref, {
          stock: update.stock,
          updatedAt: nowIso
        })
      }

      for (const update of legacyInventoryUpdates) {
        tx.update(update.ref, {
          ...update.updates,
          updatedAt: nowIso,
          updatedBy: baseOrderDoc.cashierId ?? userId,
        })
      }

      // Clear relevant cache entries
      clearCachePattern(`pos_products:${orgId}`)
      clearCachePattern(`inventory:${orgId}`)
      clearCachePattern(`pos_orders:${orgId}`)

      return orderRef.id
    })

    if (payments.length) {
      try {
        await recordPaymentAuditEntries(orgId, createdOrderId, payments, {
          event: 'order_created',
          cashierId: baseOrderDoc.cashierId ?? userId,
          orderStatus: status,
        })
      } catch (auditError) {
        console.warn('[pos-operations] failed to record payment audit entry for order creation', auditError)
      }
    }

    return createdOrderId
    
  } catch (error) {
    console.error('Order creation failed:', error)
    const fallbackOrder = await addDoc(collection(getDb(), POS_ORDERS_COL), {
      ...baseOrderDoc,
      status: status === 'paid' && balanceDue > 0 ? 'awaiting_payment' : status,
      inventoryAdjustments: lastInventoryAdjustments,
      inventoryCommitted: lastInventoryCommitted,
    })
    clearCachePattern(`pos_orders:${orgId}`)
    if (payments.length) {
      try {
        await recordPaymentAuditEntries(orgId, fallbackOrder.id, payments, {
          event: 'order_created',
          cashierId: baseOrderDoc.cashierId ?? userId,
          orderStatus: status,
        })
      } catch (auditError) {
        console.warn('[pos-operations] failed to record payment audit for fallback order', auditError)
      }
    }
    return fallbackOrder.id
  }
}

// Enhanced recent orders with optimized structure support
export async function listRecentOrders(orgId: string, limit_: number = 10): Promise<POSOrderDoc[]> {
  const cacheKey = `pos_orders:${orgId}:recent:${limit_}`
  const cached = getCached<POSOrderDoc[]>(cacheKey)
  if (cached) return cached

  let orders: POSOrderDoc[] = []

  try {
    // Try optimized structure first
    const optimizedQuery = query(
      collection(getDb(), ORGANIZATIONS_COL, orgId, ORG_POS_ORDERS_SUBCOL),
      orderBy('createdAt', 'desc'),
      limit(limit_)
    )
    
    const snapshot = await getDocs(optimizedQuery)
    
    if (!snapshot.empty) {
      orders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as POSOrderDoc))
    } else {
      // Fallback to legacy structure
      const legacyQuery = query(
        collection(getDb(), POS_ORDERS_COL),
        where('orgId', '==', orgId),
        orderBy('createdAt', 'desc'),
        limit(limit_)
      )
      
      const legacySnapshot = await getDocs(legacyQuery)
      orders = legacySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as POSOrderDoc))
    }
    
  } catch (error) {
    console.warn('Optimized orders query failed, trying legacy:', error)
    
    try {
      const legacyQuery = query(
        collection(getDb(), POS_ORDERS_COL),
        where('orgId', '==', orgId),
        orderBy('createdAt', 'desc'),
        limit(limit_)
      )
      
      const legacySnapshot = await getDocs(legacyQuery)
      orders = legacySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as POSOrderDoc))
      
    } catch (legacyError) {
      console.error('Both optimized and legacy orders queries failed:', legacyError)
      return []
    }
  }

  setCache(cacheKey, orders, 5) // Cache for 5 minutes (shorter for orders)
  return orders
}

// Enhanced inventory check with optimized structure
export async function hasInventory(orgId: string): Promise<boolean> {
  const cacheKey = `has_inventory:${orgId}`
  const cached = getCached<boolean>(cacheKey)
  if (cached !== null) return cached

  let hasInventoryData = false

  try {
    // Check optimized structure first
    const optimizedQuery = query(
      collection(getDb(), ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL),
      limit(1)
    )
    
    const snapshot = await getDocs(optimizedQuery)
    
    if (!snapshot.empty) {
      hasInventoryData = true
    } else {
      // Check legacy structure
      const legacyQuery = query(
        collection(getDb(), POS_PRODUCTS_COL),
        where('orgId', '==', orgId),
        limit(1)
      )
      
      const legacySnapshot = await getDocs(legacyQuery)
      hasInventoryData = !legacySnapshot.empty
    }
    
  } catch (error) {
    console.warn('Error checking inventory existence:', error)
    
    // Fallback check
    try {
      const legacyQuery = query(
        collection(getDb(), POS_PRODUCTS_COL),
        where('orgId', '==', orgId),
        limit(1)
      )
      
      const legacySnapshot = await getDocs(legacyQuery)
      hasInventoryData = !legacySnapshot.empty
      
    } catch (legacyError) {
      console.error('Error checking legacy inventory:', legacyError)
      return false
    }
  }

  setCache(cacheKey, hasInventoryData, 30) // Cache for 30 minutes
  return hasInventoryData
}

// Utility function to clear all cache
export function clearPOSCache() {
  cache.clear()
}

function sanitizeOrderUpdatePayload(updates: Record<string, unknown>) {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      payload[key] = value
    }
  }
  payload.updatedAt = new Date().toISOString()
  return payload
}

async function updateOrderDocuments(orgId: string, orderId: string, updates: Record<string, unknown>) {
  const payload = sanitizeOrderUpdatePayload(updates)

  const optimizedRef = doc(getDb(), ORGANIZATIONS_COL, orgId, ORG_POS_ORDERS_SUBCOL, orderId)
  try {
    await updateDoc(optimizedRef, payload)
    clearCachePattern(`pos_orders:${orgId}`)
    clearCachePattern(`pos_orders:${orgId}:recent`)
    return
  } catch (error) {
    console.warn('[pos-operations] Failed optimized order update; falling back to legacy.', error)
  }

  const legacyRef = doc(getDb(), POS_ORDERS_COL, orderId)
  await updateDoc(legacyRef, payload)
  clearCachePattern(`pos_orders:${orgId}`)
  clearCachePattern(`pos_orders:${orgId}:recent`)
}

type OrderResolution = {
  ref: DocumentReference
  data: POSOrderDoc & {
    inventoryAdjustments?: POSInventoryAdjustment[]
    inventoryCommitted?: boolean
  }
  structure: 'optimized' | 'legacy'
}

async function resolveOrderDoc(
  orgId: string,
  orderId: string,
  tx?: Transaction,
): Promise<OrderResolution | null> {
  const optimizedRef = doc(getDb(), ORGANIZATIONS_COL, orgId, ORG_POS_ORDERS_SUBCOL, orderId)
  try {
    const optimizedSnap = tx ? await tx.get(optimizedRef) : await getDoc(optimizedRef)
    if (optimizedSnap.exists()) {
      return {
        ref: optimizedRef,
        data: { id: orderId, ...(optimizedSnap.data() as POSOrderDoc) },
        structure: 'optimized',
      }
    }
  } catch (error) {
    console.warn('[pos-operations] resolveOrderDoc optimized lookup failed', error)
  }

  const legacyRef = doc(getDb(), POS_ORDERS_COL, orderId)
  const legacySnap = tx ? await tx.get(legacyRef) : await getDoc(legacyRef)
  if (legacySnap.exists()) {
    return {
      ref: legacyRef,
      data: { id: orderId, ...(legacySnap.data() as POSOrderDoc) },
      structure: 'legacy',
    }
  }

  return null
}

interface PaymentAuditContext {
  event: POSPaymentAuditEvent
  cashierId?: string | null
  note?: string
  orderStatus?: POSOrderStatus
  metadata?: Record<string, unknown>
}

async function recordPaymentAuditEntries(
  orgId: string,
  orderId: string,
  payments: POSPayment[],
  context: PaymentAuditContext,
) {
  if (!payments?.length) {
    return
  }

  const recordedAtIso = new Date().toISOString()
  const primaryCollection = collection(getDb(), ORGANIZATIONS_COL, orgId, ORG_POS_PAYMENT_AUDIT_SUBCOL)

  await Promise.all(
    payments.map(async (payment, index) => {
      if (!payment) return

      const metadata: Record<string, unknown> = { ...(payment.metadata ?? {}) }
      if (context.metadata) {
        for (const [key, value] of Object.entries(context.metadata)) {
          if (value !== undefined) {
            metadata[key] = value
          }
        }
      }
      if (context.orderStatus) {
        metadata.orderStatus = context.orderStatus
      }
      metadata.sequence = index

      const baseEntry = compactRecord({
        orgId,
        orderId,
        paymentId: payment.id,
        method: payment.method,
        amount: Number(Number(payment.amount ?? 0).toFixed(2)),
        tenderedAmount: payment.tenderedAmount,
        changeGiven: payment.changeGiven,
        status: payment.status,
        cashierId: context.cashierId ?? payment.processedBy,
        processedBy: payment.processedBy ?? context.cashierId,
        event: context.event,
        note: context.note ?? payment.note,
        metadata: Object.keys(metadata).length ? metadata : undefined,
        receivedAt: payment.receivedAt,
        occurredAt: payment.receivedAt ?? recordedAtIso,
        recordedAt: recordedAtIso,
      })

      const payload = {
        ...baseEntry,
        createdAt: serverTimestamp(),
      }

      try {
        await addDoc(primaryCollection, payload)
      } catch (error) {
        console.warn('[pos-operations] primary payment audit write failed, retrying in legacy collection', error)
        await addDoc(collection(getDb(), POS_PAYMENT_AUDIT_COL), payload)
      }
    }),
  )
}

export interface FinalizePosOrderOptions {
  payments: POSPayment[]
  status: POSOrderStatus
  balanceDue: number
  paymentSummary: POSPaymentSummary
  completedAt?: string | null
  receiptNumber?: string
  checkoutContext?: POSCheckoutContext | null
  notes?: string
  receipt?: POSReceipt
}

export async function finalizePosOrder(
  orgId: string,
  orderId: string,
  options: FinalizePosOrderOptions,
) {
  await updateOrderDocuments(orgId, orderId, {
    payments: options.payments,
    status: options.status,
    balanceDue: Number(options.balanceDue.toFixed(2)),
    paymentSummary: options.paymentSummary,
    completedAt: options.completedAt ?? (options.status === 'paid' ? new Date().toISOString() : null),
    receiptNumber: options.receiptNumber,
    checkoutContext: options.checkoutContext,
    notes: options.notes,
    receipt: options.receipt,
  })

  if (options.payments?.length) {
    try {
      const resolved = await resolveOrderDoc(orgId, orderId)
      await recordPaymentAuditEntries(orgId, orderId, options.payments, {
        event: 'order_finalized',
        cashierId: resolved?.data?.cashierId ?? resolved?.data?.userId,
        orderStatus: options.status,
      })
    } catch (error) {
      console.warn('[pos-operations] failed to record payment audit entry during finalization', error)
    }
  }
}

export async function updatePosOrderPaymentState(
  orgId: string,
  orderId: string,
  update: {
    payments: POSPayment[]
    balanceDue?: number
    paymentSummary?: POSPaymentSummary
    status?: POSOrderStatus
  },
) {
  await updateOrderDocuments(orgId, orderId, {
    payments: update.payments,
    balanceDue: update.balanceDue,
    paymentSummary: update.paymentSummary,
    status: update.status,
  })

  const latestPayment = update.payments?.[update.payments.length - 1]
  if (!latestPayment) {
    return
  }

  try {
    const resolved = await resolveOrderDoc(orgId, orderId)
    await recordPaymentAuditEntries(orgId, orderId, [latestPayment], {
      event: 'payment_update',
      cashierId: resolved?.data?.cashierId ?? resolved?.data?.userId,
      orderStatus: update.status ?? resolved?.data?.status,
    })
  } catch (error) {
    console.warn('[pos-operations] failed to record payment audit entry during update', error)
  }
}

export async function voidPosOrder(orgId: string, orderId: string, reason?: string) {
  const nowIso = new Date().toISOString()
  let resolvedSnapshot: OrderResolution | null = null

  await runTransaction(getDb(), async (tx) => {
    const resolved = await resolveOrderDoc(orgId, orderId, tx)
    if (!resolved) {
      throw new Error(`Order ${orderId} not found for void operation`)
    }

    resolvedSnapshot = resolved

    const adjustments = resolved.data.inventoryAdjustments ?? []
    const operatorId = resolved.data.cashierId ?? resolved.data.userId

    for (const adjustment of adjustments) {
      if (!adjustment || !Array.isArray(adjustment.docPath) || adjustment.docPath.length < 2) {
        continue
      }

      const inventoryRef = doc(getDb(), ...adjustment.docPath)
      let inventorySnap
      try {
        inventorySnap = await tx.get(inventoryRef)
      } catch (error) {
        console.warn('[pos-operations] failed to load inventory doc during void', error)
        continue
      }

      if (!inventorySnap.exists()) {
        continue
      }

      const deltaBase = adjustment.qtyBaseDelta ?? 0
      const deltaLoose = adjustment.qtyLooseDelta ?? 0

      if (deltaBase === 0 && deltaLoose === 0) {
        continue
      }

      if (adjustment.structure === 'optimized') {
        const productData = inventorySnap.data() ?? {}
        const currentStock = productData.stock || { qtyBase: 0, qtyLoose: 0, unitsPerBase: adjustment.unitsPerBase || 1 }
        const unitsPerBase = currentStock.unitsPerBase || adjustment.unitsPerBase || 1
        const nextQtyBase = Math.max(0, (currentStock.qtyBase ?? 0) - deltaBase)
        const nextQtyLoose = Math.max(0, (currentStock.qtyLoose ?? 0) - deltaLoose)
        const nextAvailable = Math.max(0, nextQtyBase * unitsPerBase + nextQtyLoose)

        const stockUpdate = compactRecord({
          ...currentStock,
          qtyBase: nextQtyBase,
          qtyLoose: nextQtyLoose,
          available: nextAvailable,
          lastUpdated: nowIso,
          updatedBy: operatorId,
        })

        tx.update(inventoryRef, {
          stock: stockUpdate,
          updatedAt: nowIso,
        })
      } else {
        const invData = inventorySnap.data() as InventoryRecord
        const nextQtyBase = Math.max(0, (invData.qtyBase ?? 0) - deltaBase)
        const nextQtyLoose = Math.max(0, (invData.qtyLoose ?? 0) - deltaLoose)

        tx.update(inventoryRef, compactRecord({
          qtyBase: nextQtyBase,
          qtyLoose: nextQtyLoose,
          updatedAt: nowIso,
          updatedBy: operatorId,
        }))
      }
    }

    const voidPayload = compactRecord({
      status: 'void',
      balanceDue: 0,
      inventoryCommitted: false,
      inventoryAdjustments: [],
      voidReason: reason ?? resolved.data.voidReason ?? 'Cancelled after payment failure',
      voidedAt: nowIso,
      notes: reason ?? resolved.data.notes,
      updatedAt: nowIso,
    })

    tx.update(resolved.ref, voidPayload)
  })

  clearCachePattern(`pos_orders:${orgId}`)
  clearCachePattern(`pos_orders:${orgId}:recent`)
  clearCachePattern(`pos_products:${orgId}`)
  clearCachePattern(`inventory:${orgId}`)

  if (resolvedSnapshot?.data?.payments?.length) {
    try {
      await recordPaymentAuditEntries(orgId, orderId, resolvedSnapshot.data.payments, {
        event: 'order_voided',
        cashierId: resolvedSnapshot.data.cashierId ?? resolvedSnapshot.data.userId,
        note: reason,
        orderStatus: 'void',
      })
    } catch (error) {
      console.warn('[pos-operations] failed to record payment audit entry during void', error)
    }
  }
}