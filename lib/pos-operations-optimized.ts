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
} from 'firebase/firestore'
import type {
  InventoryRecord,
  POSOrderDoc,
  POSOrderLine,
  POSProduct,
} from '@/lib/types'

// Legacy collections (backward compatibility)
export const POS_PRODUCTS_COL = 'pos_products'
export const INVENTORY_COL = 'inventory'
export const POS_ORDERS_COL = 'pos_orders'

// Optimized hierarchical structure
export const ORGANIZATIONS_COL = 'organizations'
export const ORG_PRODUCTS_SUBCOL = 'products'
export const ORG_INVENTORY_SUBCOL = 'inventory'
export const ORG_POS_ORDERS_SUBCOL = 'pos_orders'

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
      collection(db, ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL),
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
        collection(db, POS_PRODUCTS_COL),
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
        collection(db, POS_PRODUCTS_COL),
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
    const productDoc = await getDoc(doc(db, ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL, productId))
    
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
      const legacyInventoryDoc = await getDoc(doc(db, INVENTORY_COL, `${orgId}_${productId}`))
      if (legacyInventoryDoc.exists()) {
        inventory = legacyInventoryDoc.data() as InventoryRecord
      }
    }
    
  } catch (error) {
    console.warn('Optimized inventory query failed, trying legacy:', error)
    
    // Direct fallback to legacy structure
    try {
      const legacyInventoryDoc = await getDoc(doc(db, INVENTORY_COL, `${orgId}_${productId}`))
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
export async function addPosOrder(orgId: string, userId: string, lines: POSOrderLine[]): Promise<string> {
  const total = lines.reduce((s, l) => s + l.lineTotal, 0)
  const nowIso = new Date().toISOString()
  
  try {
    return await runTransaction(db, async (tx) => {
      // Create order in optimized structure first, fall back to legacy
      let orderRef
      let useOptimized = true
      
      try {
        orderRef = doc(collection(db, ORGANIZATIONS_COL, orgId, ORG_POS_ORDERS_SUBCOL))
      } catch (error) {
        console.warn('Using legacy order structure:', error)
        orderRef = doc(collection(db, POS_ORDERS_COL))
        useOptimized = false
      }

      const orderDoc: POSOrderDoc = {
        orgId,
        userId,
        lines,
        total,
        createdAt: nowIso,
        status: 'pending',
      }

      const optimizedStockUpdates: Array<{ ref: ReturnType<typeof doc>; stock: any }> = []
      const legacyInventoryUpdates: Array<{ ref: ReturnType<typeof doc>; updates: Partial<InventoryRecord> }> = []

      // Update inventory for each product line
      for (const line of lines) {
        try {
          let productRef
          
          if (useOptimized) {
            // Try optimized structure - update stock in product document
            productRef = doc(db, ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL, line.productId)
            const productSnap = await tx.get(productRef)
            
            if (productSnap.exists()) {
              const productData = productSnap.data()
              const currentStock = productData.stock || { qtyBase: 0, qtyLoose: 0, unitsPerBase: 1 }
              
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
                lastUpdated: nowIso
              }
              optimizedStockUpdates.push({
                ref: productRef,
                stock: updatedStock
              })
            } else {
              // Fallback to legacy inventory for missing optimized docs
              const invRef = doc(db, INVENTORY_COL, `${orgId}_${line.productId}`)
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

                legacyInventoryUpdates.push({
                  ref: invRef,
                  updates: {
                    qtyBase: Math.max(0, newQtyBase),
                    qtyLoose: Math.max(0, newQtyLoose)
                  }
                })
              }
            }
          } else {
            // Fallback to legacy inventory structure
            const invId = `${orgId}_${line.productId}`
            const invRef = doc(db, INVENTORY_COL, invId)
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
              legacyInventoryUpdates.push({
                ref: invRef,
                updates: {
                  qtyBase: Math.max(0, newQtyBase),
                  qtyLoose: Math.max(0, newQtyLoose)
                }
              })
            }
          }
          
        } catch (invError) {
          console.warn(`Failed to update inventory for product ${line.productId}:`, invError)
          // Continue with order creation even if inventory update fails
        }
      }

      // Perform writes after all reads to satisfy Firestore transaction requirements
      tx.set(orderRef, orderDoc)

      for (const update of optimizedStockUpdates) {
        tx.update(update.ref, {
          stock: update.stock,
          updatedAt: nowIso
        })
      }

      for (const update of legacyInventoryUpdates) {
        tx.update(update.ref, update.updates)
      }

      // Clear relevant cache entries
      clearCachePattern(`pos_products:${orgId}`)
      clearCachePattern(`inventory:${orgId}`)
      clearCachePattern(`pos_orders:${orgId}`)

      return orderRef.id
    })
    
  } catch (error) {
    console.error('Order creation failed:', error)
    throw error
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
      collection(db, ORGANIZATIONS_COL, orgId, ORG_POS_ORDERS_SUBCOL),
      orderBy('createdAt', 'desc'),
      limit(limit_)
    )
    
    const snapshot = await getDocs(optimizedQuery)
    
    if (!snapshot.empty) {
      orders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as POSOrderDoc))
    } else {
      // Fallback to legacy structure
      const legacyQuery = query(
        collection(db, POS_ORDERS_COL),
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
        collection(db, POS_ORDERS_COL),
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
      collection(db, ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL),
      limit(1)
    )
    
    const snapshot = await getDocs(optimizedQuery)
    
    if (!snapshot.empty) {
      hasInventoryData = true
    } else {
      // Check legacy structure
      const legacyQuery = query(
        collection(db, POS_PRODUCTS_COL),
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
        collection(db, POS_PRODUCTS_COL),
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