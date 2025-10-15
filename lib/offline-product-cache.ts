/**
 * Offline Product Cache Manager
 * Caches products in IndexedDB for offline browsing
 */

import type { POSProduct } from './types'

const DB_NAME = 'vendai_product_cache'
const DB_VERSION = 1
const STORE_NAME = 'products'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

interface CachedProduct extends POSProduct {
  cachedAt: string
}

class OfflineProductCache {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('orgId', 'orgId', { unique: false })
          store.createIndex('cachedAt', 'cachedAt', { unique: false })
        }
      }
    })
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('IndexedDB not initialized. Call init() first.')
    }
    return this.db
  }

  /**
   * Cache products for offline access
   */
  async cacheProducts(products: POSProduct[]): Promise<void> {
    const db = this.ensureDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    const now = new Date().toISOString()
    
    for (const product of products) {
      const cachedProduct: CachedProduct = {
        ...product,
        cachedAt: now
      }
      store.put(cachedProduct)
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * Get cached products for an organization
   */
  async getCachedProducts(orgId: string): Promise<POSProduct[]> {
    const db = this.ensureDb()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('orgId')

    return new Promise((resolve, reject) => {
      const request = index.getAll(orgId)
      
      request.onsuccess = () => {
        const products = request.result as CachedProduct[]
        const now = Date.now()
        
        // Filter out expired products
        const validProducts = products.filter(product => {
          const cachedTime = new Date(product.cachedAt).getTime()
          return now - cachedTime < CACHE_DURATION
        })
        
        // Remove cachedAt field before returning
        const cleanProducts = validProducts.map(({ cachedAt, ...product }) => product)
        
        resolve(cleanProducts)
      }
      
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(): Promise<number> {
    const db = this.ensureDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('cachedAt')

    const now = Date.now()
    let deletedCount = 0

    return new Promise((resolve, reject) => {
      const request = index.openCursor()

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const product = cursor.value as CachedProduct
          const cachedTime = new Date(product.cachedAt).getTime()
          
          if (now - cachedTime >= CACHE_DURATION) {
            cursor.delete()
            deletedCount++
          }
          
          cursor.continue()
        } else {
          resolve(deletedCount)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Clear all cached products
   */
  async clearCache(): Promise<void> {
    const db = this.ensureDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalProducts: number
    cacheSize: number
    oldestEntry: Date | null
    newestEntry: Date | null
  }> {
    const db = this.ensureDb()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      
      request.onsuccess = () => {
        const products = request.result as CachedProduct[]
        
        let oldestDate: Date | null = null
        let newestDate: Date | null = null
        
        if (products.length > 0) {
          const dates = products.map(p => new Date(p.cachedAt))
          oldestDate = new Date(Math.min(...dates.map(d => d.getTime())))
          newestDate = new Date(Math.max(...dates.map(d => d.getTime())))
        }
        
        // Estimate cache size (rough calculation)
        const cacheSize = JSON.stringify(products).length
        
        resolve({
          totalProducts: products.length,
          cacheSize,
          oldestEntry: oldestDate,
          newestEntry: newestDate
        })
      }
      
      request.onerror = () => reject(request.error)
    })
  }
}

// Singleton instance
let productCacheInstance: OfflineProductCache | null = null

export function getProductCache(): OfflineProductCache {
  if (!productCacheInstance) {
    productCacheInstance = new OfflineProductCache()
  }
  return productCacheInstance
}

export type { CachedProduct }
