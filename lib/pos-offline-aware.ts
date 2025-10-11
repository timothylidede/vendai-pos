/**
 * Offline-aware POS operations wrapper
 * Automatically queues transactions when offline and syncs when back online
 */

'use client'

import { addPosOrder } from '@/lib/pos-operations'
import type { POSOrderLine } from '@/lib/types'
import type { CreatePOSOrderOptions } from '@/types/pos'
import { getOfflineQueueManager } from './offline-queue'

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
let syncInterval: NodeJS.Timeout | null = null

/**
 * Initialize offline mode detection and auto-sync
 */
export function initOfflineMode(): void {
  if (typeof window === 'undefined') return

  // Update online status
  const updateOnlineStatus = () => {
    isOnline = navigator.onLine
    console.log(`Network status: ${isOnline ? 'online' : 'offline'}`)
    
    if (isOnline) {
      // Trigger sync when coming back online
      triggerSync()
    }
  }

  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)

  // Initialize queue manager
  getOfflineQueueManager().init().catch(console.error)

  // Set up periodic sync (every 30 seconds when online)
  if (!syncInterval) {
    syncInterval = setInterval(() => {
      if (isOnline) {
        triggerSync()
      }
    }, 30000)
  }
}

/**
 * Clean up offline mode listeners
 */
export function cleanupOfflineMode(): void {
  if (typeof window === 'undefined') return

  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

/**
 * Check if currently online
 */
export function checkOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

/**
 * Offline-aware wrapper for addPosOrder
 * Automatically queues when offline, submits directly when online
 */
export async function addPosOrderOfflineAware(
  orgId: string,
  userId: string,
  lines: POSOrderLine[],
  options: CreatePOSOrderOptions = {}
): Promise<{ orderId: string; queued: boolean }> {
  const currentlyOnline = checkOnlineStatus()

  if (!currentlyOnline) {
    // Queue the transaction for later sync
    console.log('Device offline. Queuing transaction...')
    const queueManager = getOfflineQueueManager()
    const queuedId = await queueManager.queueTransaction(orgId, userId, lines, options)
    return { orderId: queuedId, queued: true }
  }

  try {
    // Try to submit directly
    const orderId = await addPosOrder(orgId, userId, lines, options)
    return { orderId, queued: false }
  } catch (error) {
    // If submission fails due to network, queue it
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isNetworkError = errorMessage.toLowerCase().includes('network') ||
                          errorMessage.toLowerCase().includes('fetch') ||
                          errorMessage.toLowerCase().includes('connection')

    if (isNetworkError) {
      console.log('Network error detected. Queuing transaction...')
      const queueManager = getOfflineQueueManager()
      const queuedId = await queueManager.queueTransaction(orgId, userId, lines, options)
      return { orderId: queuedId, queued: true }
    }

    // If it's not a network error, rethrow
    throw error
  }
}

/**
 * Trigger a sync of queued transactions
 */
export async function triggerSync(): Promise<{ synced: number; failed: number; conflicts: number }> {
  const queueManager = getOfflineQueueManager()
  
  const result = await queueManager.syncQueue(
    async (orgId, userId, lines, options) => {
      return addPosOrder(orgId, userId, lines, options)
    }
  )

  if (result.synced > 0) {
    console.log(`✓ Synced ${result.synced} offline transaction(s)`)
  }
  if (result.failed > 0) {
    console.warn(`⚠ ${result.failed} transaction(s) failed to sync`)
  }
  if (result.conflicts > 0) {
    console.warn(`⚠ ${result.conflicts} transaction(s) have conflicts`)
  }

  return result
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const queueManager = getOfflineQueueManager()
  return queueManager.getStats()
}

/**
 * Subscribe to queue stats updates
 */
export function subscribeToQueueStats(callback: (stats: any) => void): () => void {
  const queueManager = getOfflineQueueManager()
  return queueManager.subscribe(callback)
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  transactionId: string,
  resolution: 'skip' | 'force'
): Promise<void> {
  const queueManager = getOfflineQueueManager()
  
  if (resolution === 'force') {
    await queueManager.resolveConflict(
      transactionId,
      'force',
      async (orgId, userId, lines, options) => {
        return addPosOrder(orgId, userId, lines, options)
      }
    )
  } else {
    await queueManager.resolveConflict(transactionId, 'skip')
  }
}
