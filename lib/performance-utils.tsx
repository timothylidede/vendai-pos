/**
 * Performance optimization utilities for VendAI POS
 */

import { lazy, Suspense, ComponentType, useCallback, useMemo, useRef, useState, useEffect } from 'react'

// Loading component for code splitting
export const LoadingSpinner = ({ message = 'Loading...' }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[200px] space-y-3">
    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-slate-400 text-sm">{message}</p>
  </div>
)

// Higher-order component for lazy loading with error boundary
export function withLazyLoading<P = any>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  fallback?: ComponentType,
  errorFallback?: ComponentType<{ error: Error; retry: () => void }>
) {
  const LazyComponent = lazy(importFunc)
  
  return function LazyLoadedComponent(props: P) {
    const FallbackComponent = fallback || (() => <LoadingSpinner />)
    const ErrorFallback = errorFallback || (() => <div>Error loading component</div>)

    return (
      <Suspense fallback={<FallbackComponent />}>
        <LazyComponent {...props as any} />
      </Suspense>
    )
  }
}

// Debounce hook for search and input optimization
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Throttle hook for scroll and resize events
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const throttleRef = useRef<NodeJS.Timeout>()
  const lastCallTime = useRef<number>(0)

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now()
      
      if (now - lastCallTime.current >= delay) {
        lastCallTime.current = now
        callback(...args)
      } else {
        if (throttleRef.current) {
          clearTimeout(throttleRef.current)
        }
        throttleRef.current = setTimeout(() => {
          lastCallTime.current = Date.now()
          callback(...args)
        }, delay - (now - lastCallTime.current))
      }
    }) as T,
    [callback, delay]
  )
}

// Intersection Observer hook for lazy loading content
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [node, setNode] = useState<Element | null>(null)

  const observer = useMemo(
    () =>
      typeof window !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => setIsIntersecting(entry.isIntersecting),
            options
          )
        : null,
    [options]
  )

  useEffect(() => {
    if (node && observer) {
      observer.observe(node)
      return () => observer.unobserve(node)
    }
  }, [node, observer])

  return [setNode, isIntersecting] as const
}

// Virtual scrolling hook for large lists
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5
}: {
  items: T[]
  itemHeight: number
  containerHeight: number
  overscan?: number
}) {
  const [scrollTop, setScrollTop] = useState(0)
  
  const visibleStart = Math.floor(scrollTop / itemHeight)
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  )

  const startIndex = Math.max(0, visibleStart - overscan)
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan)
  const visibleItems = items.slice(startIndex, endIndex + 1)

  const totalHeight = items.length * itemHeight
  const offsetY = startIndex * itemHeight

  return {
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
    setScrollTop
  }
}

// Memory-efficient data pagination hook
export function usePagination<T>({
  data,
  pageSize,
  initialPage = 1
}: {
  data: T[]
  pageSize: number
  initialPage?: number
}) {
  const [currentPage, setCurrentPage] = useState(initialPage)
  
  const totalPages = Math.ceil(data.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentData = data.slice(startIndex, endIndex)

  const nextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1))
  }, [])

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }, [totalPages])

  return {
    currentData,
    currentPage,
    totalPages,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    nextPage,
    prevPage,
    goToPage
  }
}

// Image lazy loading component
export const LazyImage = ({ 
  src, 
  alt, 
  placeholder = '/images/placeholder.png',
  className = '',
  ...props 
}: {
  src: string
  alt: string
  placeholder?: string
  className?: string
}) => {
  const [imageSrc, setImageSrc] = useState(placeholder)
  const [imageRef, isIntersecting] = useIntersectionObserver({
    threshold: 0.1
  })

  useEffect(() => {
    if (isIntersecting) {
      const img = new Image()
      img.onload = () => setImageSrc(src)
      img.src = src
    }
  }, [isIntersecting, src])

  return (
    <img
      ref={imageRef as any}
      src={imageSrc}
      alt={alt}
      className={`transition-opacity duration-300 ${className}`}
      {...props}
    />
  )
}

// Bundle analyzer utility
export const getBundleSize = () => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    return {
      transferSize: navigation.transferSize,
      encodedBodySize: navigation.encodedBodySize,
      decodedBodySize: navigation.decodedBodySize
    }
  }
  return null
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  useEffect(() => {
    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      if (renderTime > 16) { // More than one frame (60fps)
        console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms`)
      }
    }
  })

  const measureOperation = useCallback((operationName: string, fn: () => void) => {
    const start = performance.now()
    fn()
    const end = performance.now()
    console.log(`${componentName} ${operationName}: ${(end - start).toFixed(2)}ms`)
  }, [componentName])

  return { measureOperation }
}

// React Query-like data fetching hook with caching
export function useDataCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    staleTime?: number
    cacheTime?: number
    refetchOnWindowFocus?: boolean
  } = {}
) {
  const {
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus = true
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  const cacheRef = useRef<Map<string, {
    data: T
    timestamp: number
    staleAt: number
  }>>(new Map())

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const cached = cacheRef.current.get(key)
      const now = Date.now()
      
      if (cached && now < cached.staleAt) {
        setData(cached.data)
        setLoading(false)
        return
      }

      const result = await fetcher()
      
      cacheRef.current.set(key, {
        data: result,
        timestamp: now,
        staleAt: now + staleTime
      })
      
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [key, fetcher, staleTime])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (refetchOnWindowFocus) {
      const handleFocus = () => fetchData()
      window.addEventListener('focus', handleFocus)
      return () => window.removeEventListener('focus', handleFocus)
    }
  }, [fetchData, refetchOnWindowFocus])

  // Cleanup expired cache entries
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of cacheRef.current.entries()) {
        if (now - entry.timestamp > cacheTime) {
          cacheRef.current.delete(key)
        }
      }
    }, cacheTime)

    return () => clearInterval(cleanup)
  }, [cacheTime])

  return { data, loading, error, refetch: fetchData }
}

// Example lazy loading components (update paths as needed)
// Uncomment and update these when the actual components exist
/*
export const LazyPOSPage = withLazyLoading(
  () => import('@/components/modules/pos-page'),
  () => <LoadingSpinner message="Loading POS System..." />
)

export const LazySupplierModule = withLazyLoading(
  () => import('@/components/modules/supplier-module'),  
  () => <LoadingSpinner message="Loading Supplier Management..." />
)

export const LazyInventoryModule = withLazyLoading(
  () => import('@/components/modules/inventory-module'),
  () => <LoadingSpinner message="Loading Inventory System..." />
)

export const LazyAdminDashboard = withLazyLoading(
  () => import('@/components/admin-dashboard'),
  () => <LoadingSpinner message="Loading Admin Dashboard..." />
)
*/

