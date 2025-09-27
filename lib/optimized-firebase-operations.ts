import { db } from '@/lib/firebase'
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  writeBatch, 
  runTransaction,
  serverTimestamp,
  DocumentSnapshot,
  QueryDocumentSnapshot
} from 'firebase/firestore'

// ============================================================================
// OPTIMIZED COLLECTIONS STRUCTURE
// ============================================================================

// Main collections
export const ORGANIZATIONS_COL = 'organizations'
export const USERS_COL = 'users'
export const DISTRIBUTORS_COL = 'distributors'
export const RETAILERS_COL = 'retailers'
export const ORDERS_COL = 'orders'

// Subcollections under organizations/{orgId}/
export const ORG_PRODUCTS_SUBCOL = 'products'
export const ORG_INVENTORY_SUBCOL = 'inventory'
export const ORG_POS_ORDERS_SUBCOL = 'pos_orders'
export const ORG_MAPPINGS_SUBCOL = 'mappings'
export const ORG_SETTINGS_SUBCOL = 'settings'

// ============================================================================
// TYPES - Optimized Data Structures
// ============================================================================

export interface OptimizedProduct {
  id: string
  orgId: string
  
  // Product basics
  name: string
  sku: string
  brand?: string
  category: string
  description?: string
  
  // Inventory (denormalized for performance)
  stock: {
    qtyBase: number
    qtyLoose: number
    unitsPerBase: number
    reserved: number
    available: number
    lastUpdated: string
  }
  
  // Pricing
  pricing: {
    cost: number
    retail: number
    wholesale?: number
    distributor?: number
  }
  
  // Barcodes
  barcodes: {
    piece?: string
    carton?: string
    ean?: string
  }
  
  // Reorder info
  reorder: {
    minLevel: number
    maxLevel: number
    reorderPoint: number
    preferredSupplier?: string
  }
  
  // AI and images
  image?: string
  imageGeneratedAt?: string
  
  // Metadata
  createdAt: string
  updatedAt: string
  createdBy?: string
}

export interface OptimizedDistributor {
  id: string
  userId: string
  
  // Profile
  profile: {
    name: string
    email: string
    phone: string
    address: string
    businessType: string
    description?: string
  }
  
  // Business terms
  terms: {
    paymentTerms: string
    creditLimit: number
    taxRate: number
  }
  
  // Performance metrics (denormalized, updated via functions)
  stats: {
    totalRetailers: number
    totalProducts: number
    totalOrders: number
    monthlyGMV: number
    averageOrderValue: number
    lastActivity: string
  }
  
  // Quick access arrays
  activeRetailers: string[]
  topProducts: Array<{
    productId: string
    name: string
    monthlySales: number
  }>
  
  // Status
  status: 'active' | 'inactive' | 'suspended'
  
  // Metadata
  createdAt: string
  updatedAt: string
}

export interface OptimizedRetailer {
  id: string
  userId: string
  distributorId: string
  distributorName: string // denormalized
  
  // Profile
  profile: {
    name: string
    organizationName: string
    contactNumber: string
    email: string
    location: string
    coordinates?: {
      lat: number
      lng: number
    }
  }
  
  // Performance (denormalized)
  stats: {
    totalOrders: number
    monthlySpend: number
    averageOrderValue: number
    lastOrderDate?: string
    creditScore: number
  }
  
  // Status
  status: 'active' | 'inactive' | 'suspended'
  
  // Metadata
  createdAt: string
  updatedAt: string
}

export interface OptimizedOrder {
  id: string
  type: 'b2b' | 'pos' // B2B between distributor-retailer, POS for end-customer sales
  
  // Parties
  distributorId?: string
  distributorName?: string
  retailerId?: string
  retailerName?: string
  orgId?: string // for POS orders
  
  // Order details
  items: Array<{
    productId: string
    productName: string
    sku: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  
  // Totals
  totals: {
    subtotal: number
    tax: number
    discount: number
    total: number
  }
  
  // Status and timeline
  status: 'draft' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled'
  timeline: Array<{
    status: string
    timestamp: string
    note?: string
    updatedBy?: string
  }>
  
  // Invoice (embedded for B2B orders)
  invoice?: {
    number: string
    generatedAt: string
    dueDate: string
    paidAt?: string
    amount: number
  }
  
  // Metadata
  createdAt: string
  updatedAt: string
  createdBy?: string
}

// ============================================================================
// CACHING LAYER
// ============================================================================

class MemoryCache {
  private cache = new Map<string, { data: any; expiry: number }>()
  
  set(key: string, data: any, ttlMinutes: number = 30) {
    const expiry = Date.now() + (ttlMinutes * 60 * 1000)
    this.cache.set(key, { data, expiry })
  }
  
  get<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) return null
    
    if (Date.now() > cached.expiry) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data as T
  }
  
  clear() {
    this.cache.clear()
  }
  
  delete(key: string) {
    this.cache.delete(key)
  }
}

const cache = new MemoryCache()

// ============================================================================
// OPTIMIZED OPERATIONS
// ============================================================================

export class OptimizedFirebaseOperations {
  
  // ------------------------------------------------------------------------
  // PRODUCT OPERATIONS (Optimized)
  // ------------------------------------------------------------------------
  
  static async getProducts(
    orgId: string,
    options: {
      limit?: number
      startAfter?: DocumentSnapshot
      category?: string
      search?: string
    } = {}
  ): Promise<{ products: OptimizedProduct[]; lastDoc?: QueryDocumentSnapshot }> {
    const cacheKey = `products:${orgId}:${JSON.stringify(options)}`
    const cached = cache.get<{ products: OptimizedProduct[]; lastDoc?: QueryDocumentSnapshot }>(cacheKey)
    if (cached) return cached
    
    let q = query(
      collection(db, ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL),
      orderBy('updatedAt', 'desc'),
      limit(options.limit || 25)
    )
    
    if (options.category) {
      q = query(q, where('category', '==', options.category))
    }
    
    if (options.startAfter) {
      q = query(q, startAfter(options.startAfter))
    }
    
    const snapshot = await getDocs(q)
    const products: OptimizedProduct[] = []
    
    snapshot.forEach(doc => {
      const data = doc.data() as OptimizedProduct
      if (!options.search || data.name.toLowerCase().includes(options.search.toLowerCase())) {
        products.push({ ...data, id: doc.id })
      }
    })
    
    const result = {
      products,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] as QueryDocumentSnapshot
    }
    
    cache.set(cacheKey, result, 15) // Cache for 15 minutes
    return result
  }
  
  static async getProduct(orgId: string, productId: string): Promise<OptimizedProduct | null> {
    const cacheKey = `product:${orgId}:${productId}`
    const cached = cache.get<OptimizedProduct>(cacheKey)
    if (cached) return cached
    
    const docRef = doc(db, ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL, productId)
    const snapshot = await getDoc(docRef)
    
    if (!snapshot.exists()) return null
    
    const product = { ...snapshot.data(), id: snapshot.id } as OptimizedProduct
    cache.set(cacheKey, product, 30)
    return product
  }
  
  static async createProduct(orgId: string, productData: Partial<OptimizedProduct>): Promise<string> {
    const now = new Date().toISOString()
    
    const product: OptimizedProduct = {
      id: '', // Will be set by Firestore
      orgId,
      name: productData.name || '',
      sku: productData.sku || '',
      brand: productData.brand || '',
      category: productData.category || 'General',
      description: productData.description || '',
      
      stock: {
        qtyBase: 0,
        qtyLoose: 0,
        unitsPerBase: productData.stock?.unitsPerBase || 1,
        reserved: 0,
        available: 0,
        lastUpdated: now
      },
      
      pricing: {
        cost: productData.pricing?.cost || 0,
        retail: productData.pricing?.retail || 0,
        wholesale: productData.pricing?.wholesale || 0,
        distributor: productData.pricing?.distributor || 0
      },
      
      barcodes: {
        piece: productData.barcodes?.piece || '',
        carton: productData.barcodes?.carton || '',
        ean: productData.barcodes?.ean || ''
      },
      
      reorder: {
        minLevel: productData.reorder?.minLevel || 5,
        maxLevel: productData.reorder?.maxLevel || 100,
        reorderPoint: productData.reorder?.reorderPoint || 10,
        preferredSupplier: productData.reorder?.preferredSupplier || ''
      },
      
      image: productData.image || '',
      imageGeneratedAt: productData.imageGeneratedAt || '',
      
      createdAt: now,
      updatedAt: now,
      createdBy: productData.createdBy || ''
    }
    
    const docRef = doc(collection(db, ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL))
    await setDoc(docRef, product)
    
    // Clear cache for this organization
    this.clearProductCache(orgId)
    
    return docRef.id
  }
  
  static async updateProduct(
    orgId: string, 
    productId: string, 
    updates: Partial<OptimizedProduct>
  ): Promise<void> {
    const docRef = doc(db, ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL, productId)
    
    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    await updateDoc(docRef, updateData)
    
    // Clear specific product cache and general cache
    cache.delete(`product:${orgId}:${productId}`)
    this.clearProductCache(orgId)
  }
  
  static async updateStock(
    orgId: string,
    productId: string,
    stockUpdate: {
      qtyBase?: number
      qtyLoose?: number
      reserved?: number
    }
  ): Promise<void> {
    const docRef = doc(db, ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL, productId)
    
    await runTransaction(db, async (transaction) => {
      const productDoc = await transaction.get(docRef)
      if (!productDoc.exists()) throw new Error('Product not found')
      
      const product = productDoc.data() as OptimizedProduct
      const currentStock = product.stock
      
      const newStock = {
        qtyBase: stockUpdate.qtyBase ?? currentStock.qtyBase,
        qtyLoose: stockUpdate.qtyLoose ?? currentStock.qtyLoose,
        unitsPerBase: currentStock.unitsPerBase,
        reserved: stockUpdate.reserved ?? currentStock.reserved,
        available: 0, // Will be calculated
        lastUpdated: new Date().toISOString()
      }
      
      // Calculate available stock
      const totalPieces = (newStock.qtyBase * newStock.unitsPerBase) + newStock.qtyLoose
      newStock.available = Math.max(0, totalPieces - newStock.reserved)
      
      transaction.update(docRef, {
        stock: newStock,
        updatedAt: new Date().toISOString()
      })
    })
    
    // Clear cache
    cache.delete(`product:${orgId}:${productId}`)
    this.clearProductCache(orgId)
  }
  
  // ------------------------------------------------------------------------
  // BATCH OPERATIONS (Optimized)
  // ------------------------------------------------------------------------
  
  static async batchCreateProducts(orgId: string, products: Partial<OptimizedProduct>[]): Promise<string[]> {
    const batch = writeBatch(db)
    const productIds: string[] = []
    const now = new Date().toISOString()
    
    for (const productData of products) {
      const docRef = doc(collection(db, ORGANIZATIONS_COL, orgId, ORG_PRODUCTS_SUBCOL))
      
      const product: OptimizedProduct = {
        id: docRef.id,
        orgId,
        name: productData.name || '',
        sku: productData.sku || '',
        brand: productData.brand || '',
        category: productData.category || 'General',
        description: productData.description || '',
        
        stock: {
          qtyBase: productData.stock?.qtyBase || 0,
          qtyLoose: productData.stock?.qtyLoose || 0,
          unitsPerBase: productData.stock?.unitsPerBase || 1,
          reserved: 0,
          available: ((productData.stock?.qtyBase || 0) * (productData.stock?.unitsPerBase || 1)) + (productData.stock?.qtyLoose || 0),
          lastUpdated: now
        },
        
        pricing: {
          cost: productData.pricing?.cost || 0,
          retail: productData.pricing?.retail || 0,
          wholesale: productData.pricing?.wholesale || 0,
          distributor: productData.pricing?.distributor || 0
        },
        
        barcodes: {
          piece: productData.barcodes?.piece || '',
          carton: productData.barcodes?.carton || '',
          ean: productData.barcodes?.ean || ''
        },
        
        reorder: {
          minLevel: productData.reorder?.minLevel || 5,
          maxLevel: productData.reorder?.maxLevel || 100,
          reorderPoint: productData.reorder?.reorderPoint || 10,
          preferredSupplier: productData.reorder?.preferredSupplier || ''
        },
        
        image: productData.image || '',
        imageGeneratedAt: productData.imageGeneratedAt || '',
        
        createdAt: now,
        updatedAt: now,
        createdBy: productData.createdBy || ''
      }
      
      batch.set(docRef, product)
      productIds.push(docRef.id)
    }
    
    await batch.commit()
    this.clearProductCache(orgId)
    
    return productIds
  }
  
  // ------------------------------------------------------------------------
  // ORDER OPERATIONS (Optimized)  
  // ------------------------------------------------------------------------
  
  static async createOrder(
    orderData: Partial<OptimizedOrder>,
    updateInventory: boolean = true
  ): Promise<string> {
    const orderId = doc(collection(db, ORDERS_COL)).id
    const now = new Date().toISOString()
    
    const order: OptimizedOrder = {
      id: orderId,
      type: orderData.type || 'pos',
      distributorId: orderData.distributorId || '',
      distributorName: orderData.distributorName || '',
      retailerId: orderData.retailerId || '',
      retailerName: orderData.retailerName || '',
      orgId: orderData.orgId || '',
      items: orderData.items || [],
      totals: orderData.totals || { subtotal: 0, tax: 0, discount: 0, total: 0 },
      status: 'confirmed',
      timeline: [
        {
          status: 'confirmed',
          timestamp: now,
          note: 'Order created'
        }
      ],
      createdAt: now,
      updatedAt: now,
      createdBy: orderData.createdBy || ''
    }
    
    if (updateInventory && order.orgId) {
      // Update inventory atomically
      await runTransaction(db, async (transaction) => {
        // Create the order
        const orderRef = doc(db, ORDERS_COL, orderId)
        transaction.set(orderRef, order)
        
        // Update inventory for each item
        for (const item of order.items) {
          const productRef = doc(db, ORGANIZATIONS_COL, order.orgId!, ORG_PRODUCTS_SUBCOL, item.productId)
          const productDoc = await transaction.get(productRef)
          
          if (productDoc.exists()) {
            const product = productDoc.data() as OptimizedProduct
            const currentStock = product.stock
            
            // Calculate new stock levels
            const totalUnits = item.quantity
            const unitsPerBase = currentStock.unitsPerBase
            const baseToDeduct = Math.floor(totalUnits / unitsPerBase)
            const looseToDeduct = totalUnits % unitsPerBase
            
            let newQtyBase = currentStock.qtyBase
            let newQtyLoose = currentStock.qtyLoose
            
            // Deduct loose first
            if (newQtyLoose >= looseToDeduct) {
              newQtyLoose -= looseToDeduct
            } else {
              const shortfall = looseToDeduct - newQtyLoose
              newQtyLoose = unitsPerBase - shortfall
              newQtyBase -= 1
            }
            
            // Deduct base units
            newQtyBase -= baseToDeduct
            
            // Update stock
            const newStock = {
              ...currentStock,
              qtyBase: Math.max(0, newQtyBase),
              qtyLoose: Math.max(0, newQtyLoose),
              available: Math.max(0, ((Math.max(0, newQtyBase) * unitsPerBase) + Math.max(0, newQtyLoose)) - currentStock.reserved),
              lastUpdated: now
            }
            
            transaction.update(productRef, {
              stock: newStock,
              updatedAt: now
            })
          }
        }
      })
    } else {
      // Simple order creation without inventory update
      const orderRef = doc(db, ORDERS_COL, orderId)
      await setDoc(orderRef, order)
    }
    
    return orderId
  }
  
  // ------------------------------------------------------------------------
  // CACHE MANAGEMENT
  // ------------------------------------------------------------------------
  
  static clearProductCache(orgId: string) {
    // Clear all product-related cache entries for this organization
    const keysToDelete: string[] = []
    cache['cache'].forEach((_, key) => {
      if (key.startsWith(`product:${orgId}:`) || key.startsWith(`products:${orgId}:`)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => cache.delete(key))
  }
  
  static clearAllCache() {
    cache.clear()
  }
}