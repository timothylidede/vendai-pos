/**
 * Hook to manage offline product caching
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getProductCache } from '@/lib/offline-product-cache'
import type { POSProduct } from '@/lib/types'
import { useNetworkStatus } from './use-network-status'

export interface ProductCacheState {
  isInitialized: boolean
  cachedProducts: POSProduct[]
  cacheStats: {
    totalProducts: number
    cacheSize: number
    oldestEntry: Date | null
    newestEntry: Date | null
  } | null
  cacheProducts: (products: POSProduct[]) => Promise<void>
  getCachedProducts: (orgId: string) => Promise<POSProduct[]>
  clearCache: () => Promise<void>
  clearExpiredCache: () => Promise<number>
}

/**
 * Hook for managing offline product cache
 */
export function useProductCache(): ProductCacheState {
  const { isOnline } = useNetworkStatus()
  const [isInitialized, setIsInitialized] = useState(false)
  const [cachedProducts, setCachedProducts] = useState<POSProduct[]>([])
  const [cacheStats, setCacheStats] = useState<ProductCacheState['cacheStats']>(null)
  const cacheRef = useRef(getProductCache())

  // Initialize cache on mount
  useEffect(() => {
    const initCache = async () => {
      try {
        await cacheRef.current.init()
        setIsInitialized(true)
        console.log('[ProductCache] Cache initialized')
        
        // Load cache stats
        const stats = await cacheRef.current.getCacheStats()
        setCacheStats(stats)
      } catch (error) {
        console.error('[ProductCache] Failed to initialize cache:', error)
      }
    }

    initCache()
  }, [])

  // Clear expired cache entries periodically (every hour)
  useEffect(() => {
    if (!isInitialized) return

    const clearExpired = async () => {
      try {
        const deletedCount = await cacheRef.current.clearExpiredCache()
        if (deletedCount > 0) {
          console.log(`[ProductCache] Cleared ${deletedCount} expired entries`)
          
          // Update stats
          const stats = await cacheRef.current.getCacheStats()
          setCacheStats(stats)
        }
      } catch (error) {
        console.error('[ProductCache] Failed to clear expired cache:', error)
      }
    }

    // Run immediately
    clearExpired()

    // Then run every hour
    const intervalId = setInterval(clearExpired, 60 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [isInitialized])

  const cacheProducts = useCallback(
    async (products: POSProduct[]): Promise<void> => {
      if (!isInitialized) {
        console.warn('[ProductCache] Cannot cache products: not initialized')
        return
      }

      try {
        await cacheRef.current.cacheProducts(products)
        console.log(`[ProductCache] Cached ${products.length} products`)
        
        // Update stats
        const stats = await cacheRef.current.getCacheStats()
        setCacheStats(stats)
      } catch (error) {
        console.error('[ProductCache] Failed to cache products:', error)
        throw error
      }
    },
    [isInitialized]
  )

  const getCachedProducts = useCallback(
    async (orgId: string): Promise<POSProduct[]> => {
      if (!isInitialized) {
        console.warn('[ProductCache] Cannot get cached products: not initialized')
        return []
      }

      try {
        const products = await cacheRef.current.getCachedProducts(orgId)
        console.log(`[ProductCache] Retrieved ${products.length} cached products`)
        setCachedProducts(products)
        return products
      } catch (error) {
        console.error('[ProductCache] Failed to get cached products:', error)
        return []
      }
    },
    [isInitialized]
  )

  const clearCache = useCallback(async (): Promise<void> => {
    if (!isInitialized) {
      console.warn('[ProductCache] Cannot clear cache: not initialized')
      return
    }

    try {
      await cacheRef.current.clearCache()
      setCachedProducts([])
      setCacheStats({
        totalProducts: 0,
        cacheSize: 0,
        oldestEntry: null,
        newestEntry: null
      })
      console.log('[ProductCache] Cache cleared')
    } catch (error) {
      console.error('[ProductCache] Failed to clear cache:', error)
      throw error
    }
  }, [isInitialized])

  const clearExpiredCache = useCallback(async (): Promise<number> => {
    if (!isInitialized) {
      console.warn('[ProductCache] Cannot clear expired cache: not initialized')
      return 0
    }

    try {
      const deletedCount = await cacheRef.current.clearExpiredCache()
      console.log(`[ProductCache] Cleared ${deletedCount} expired entries`)
      
      // Update stats
      const stats = await cacheRef.current.getCacheStats()
      setCacheStats(stats)
      
      return deletedCount
    } catch (error) {
      console.error('[ProductCache] Failed to clear expired cache:', error)
      return 0
    }
  }, [isInitialized])

  return {
    isInitialized,
    cachedProducts,
    cacheStats,
    cacheProducts,
    getCachedProducts,
    clearCache,
    clearExpiredCache
  }
}
