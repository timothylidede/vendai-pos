/**
 * Hook to manage offline POS operations
 * Combines network detection with offline queue management
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNetworkStatus } from './use-network-status'
import { getOfflineQueueManager } from '@/lib/offline-queue'
import type { POSOrderLine } from '@/lib/types'
import type { CreatePOSOrderOptions, OfflineQueueStats } from '@/types/pos'
import { addPosOrder } from '@/lib/pos-operations-optimized'

export interface OfflineMode {
  isOffline: boolean
  queueStats: OfflineQueueStats | null
  queueOrder: (
    orgId: string,
    userId: string,
    lines: POSOrderLine[],
    options?: CreatePOSOrderOptions
  ) => Promise<string>
  syncQueue: () => Promise<{ synced: number; failed: number; conflicts: number }>
  isSyncing: boolean
  lastSyncAt: Date | null
  autoSyncEnabled: boolean
  toggleAutoSync: () => void
}

/**
 * Hook for managing offline POS operations
 */
export function useOfflineMode(): OfflineMode {
  const { isOnline, wasRecentlyOffline } = useNetworkStatus()
  const [queueStats, setQueueStats] = useState<OfflineQueueStats | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const queueManagerRef = useRef(getOfflineQueueManager())
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize the queue manager
  useEffect(() => {
    const initQueue = async () => {
      try {
        await queueManagerRef.current.init()
        setIsInitialized(true)
        console.log('[OfflineMode] Queue manager initialized')
      } catch (error) {
        console.error('[OfflineMode] Failed to initialize queue:', error)
      }
    }

    initQueue()
  }, [])

  // Subscribe to queue stats changes
  useEffect(() => {
    if (!isInitialized) return

    const unsubscribe = queueManagerRef.current.subscribe((stats) => {
      setQueueStats(stats)
    })

    return unsubscribe
  }, [isInitialized])

  // Queue a POS order (when offline or if sync fails)
  const queueOrder = useCallback(
    async (
      orgId: string,
      userId: string,
      lines: POSOrderLine[],
      options: CreatePOSOrderOptions = {}
    ): Promise<string> => {
      if (!isInitialized) {
        throw new Error('Offline queue not initialized')
      }

      const queuedId = await queueManagerRef.current.queueTransaction(
        orgId,
        userId,
        lines,
        options
      )

      console.log(`[OfflineMode] Queued order: ${queuedId}`)
      return queuedId
    },
    [isInitialized]
  )

  // Sync queued orders to Firestore
  const syncQueue = useCallback(async (): Promise<{
    synced: number
    failed: number
    conflicts: number
  }> => {
    if (!isInitialized) {
      console.warn('[OfflineMode] Cannot sync: queue not initialized')
      return { synced: 0, failed: 0, conflicts: 0 }
    }

    if (!isOnline) {
      console.warn('[OfflineMode] Cannot sync: device is offline')
      return { synced: 0, failed: 0, conflicts: 0 }
    }

    setIsSyncing(true)

    try {
      const result = await queueManagerRef.current.syncQueue(
        async (orgId, userId, lines, options) => {
          // Use the existing addPosOrder function to create the order
          const orderId = await addPosOrder(orgId, userId, lines, options)
          return orderId
        }
      )

      setLastSyncAt(new Date())
      console.log('[OfflineMode] Sync complete:', result)
      
      return result
    } catch (error) {
      console.error('[OfflineMode] Sync failed:', error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [isInitialized, isOnline])

  // Auto-sync when coming back online
  useEffect(() => {
    if (!isInitialized || !autoSyncEnabled) return

    // If we just came back online and have pending items, sync
    if (isOnline && queueStats && queueStats.pending > 0) {
      // Wait a bit to ensure connection is stable
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }

      syncTimeoutRef.current = setTimeout(() => {
        console.log('[OfflineMode] Auto-sync triggered (came back online)')
        syncQueue().catch((error) => {
          console.error('[OfflineMode] Auto-sync failed:', error)
        })
      }, 2000)
    }

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [isOnline, queueStats, autoSyncEnabled, isInitialized, syncQueue])

  // Periodic sync check (every 2 minutes when online)
  useEffect(() => {
    if (!isInitialized || !autoSyncEnabled || !isOnline) return

    const intervalId = setInterval(() => {
      if (queueStats && queueStats.pending > 0) {
        console.log('[OfflineMode] Periodic sync check triggered')
        syncQueue().catch((error) => {
          console.error('[OfflineMode] Periodic sync failed:', error)
        })
      }
    }, 2 * 60 * 1000) // 2 minutes

    return () => clearInterval(intervalId)
  }, [isInitialized, autoSyncEnabled, isOnline, queueStats, syncQueue])

  const toggleAutoSync = useCallback(() => {
    setAutoSyncEnabled((prev) => !prev)
  }, [])

  return {
    isOffline: !isOnline,
    queueStats,
    queueOrder,
    syncQueue,
    isSyncing,
    lastSyncAt,
    autoSyncEnabled,
    toggleAutoSync
  }
}
