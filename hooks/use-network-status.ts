import { useState, useEffect, useCallback } from 'react'

export interface NetworkStatus {
  isOnline: boolean
  isSlowConnection: boolean
  connectionType: string | null
  downlinkSpeed: number | null
  lastOnlineAt: Date | null
  lastOfflineAt: Date | null
}

export interface NetworkStatusHook extends NetworkStatus {
  checkConnectivity: () => Promise<boolean>
  wasRecentlyOffline: (thresholdMs?: number) => boolean
}

/**
 * Hook to monitor network connectivity status
 * Provides real-time online/offline detection with connection quality metrics
 */
export function useNetworkStatus(): NetworkStatusHook {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [isSlowConnection, setIsSlowConnection] = useState(false)
  const [connectionType, setConnectionType] = useState<string | null>(null)
  const [downlinkSpeed, setDownlinkSpeed] = useState<number | null>(null)
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(
    typeof navigator !== 'undefined' && navigator.onLine ? new Date() : null
  )
  const [lastOfflineAt, setLastOfflineAt] = useState<Date | null>(null)

  // Check connection quality using Network Information API
  const updateConnectionInfo = useCallback(() => {
    if (typeof navigator === 'undefined') return

    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection

    if (connection) {
      setConnectionType(connection.effectiveType || null)
      setDownlinkSpeed(connection.downlink || null)
      
      // Mark as slow if effective type is 'slow-2g' or '2g', or downlink < 0.5 Mbps
      const isSlow = connection.effectiveType === 'slow-2g' || 
                    connection.effectiveType === '2g' ||
                    (connection.downlink && connection.downlink < 0.5)
      setIsSlowConnection(!!isSlow)
    }
  }, [])

  // Perform active connectivity check (ping a lightweight endpoint)
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined') return true

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      return false
    }
  }, [])

  // Check if device was recently offline (useful for sync decisions)
  const wasRecentlyOffline = useCallback((thresholdMs: number = 60000): boolean => {
    if (!lastOfflineAt) return false
    return Date.now() - lastOfflineAt.getTime() < thresholdMs
  }, [lastOfflineAt])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setIsOnline(true)
      setLastOnlineAt(new Date())
      updateConnectionInfo()
      console.log('[NetworkStatus] Connection restored')
    }

    const handleOffline = () => {
      setIsOnline(false)
      setLastOfflineAt(new Date())
      console.warn('[NetworkStatus] Connection lost')
    }

    const handleConnectionChange = () => {
      updateConnectionInfo()
    }

    // Initial connection info
    updateConnectionInfo()

    // Listen to browser online/offline events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen to connection changes (if supported)
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection

    if (connection) {
      connection.addEventListener('change', handleConnectionChange)
    }

    // Periodic connectivity check (every 30s when online)
    const intervalId = setInterval(async () => {
      if (isOnline) {
        const actuallyOnline = await checkConnectivity()
        if (!actuallyOnline && isOnline) {
          // Browser thinks we're online but ping failed
          handleOffline()
        }
      }
    }, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange)
      }
      clearInterval(intervalId)
    }
  }, [isOnline, updateConnectionInfo, checkConnectivity])

  return {
    isOnline,
    isSlowConnection,
    connectionType,
    downlinkSpeed,
    lastOnlineAt,
    lastOfflineAt,
    checkConnectivity,
    wasRecentlyOffline
  }
}
