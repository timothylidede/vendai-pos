/**
 * Offline Queue Manager for POS transactions
 * Handles queuing, syncing, and conflict resolution when offline
 */

import type { POSOrderLine } from '@/lib/types'
import type { CreatePOSOrderOptions, QueuedPOSTransaction, OfflineQueueStats } from '@/types/pos'

const DB_NAME = 'vendai_offline_queue'
const DB_VERSION = 1
const STORE_NAME = 'pos_transactions'
const MAX_RETRY_ATTEMPTS = 3
const SYNC_BATCH_SIZE = 5

class OfflineQueueManager {
  private db: IDBDatabase | null = null
  private syncInProgress = false
  private listeners: Set<(stats: OfflineQueueStats) => void> = new Set()

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
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('queuedAt', 'queuedAt', { unique: false })
          store.createIndex('orgId', 'orgId', { unique: false })
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
   * Queue a POS transaction for later sync
   */
  async queueTransaction(
    orgId: string,
    userId: string,
    lines: POSOrderLine[],
    options: CreatePOSOrderOptions = {}
  ): Promise<string> {
    const transaction: QueuedPOSTransaction = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orgId,
      userId,
      lines,
      options,
      queuedAt: new Date().toISOString(),
      attemptCount: 0,
      status: 'pending',
    }

    return new Promise((resolve, reject) => {
      const db = this.ensureDb()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.add(transaction)

      request.onsuccess = () => {
        this.notifyListeners()
        resolve(transaction.id)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get all queued transactions
   */
  async getQueuedTransactions(status?: QueuedPOSTransaction['status']): Promise<QueuedPOSTransaction[]> {
    return new Promise((resolve, reject) => {
      const db = this.ensureDb()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)

      let request: IDBRequest
      if (status) {
        const index = store.index('status')
        request = index.getAll(status)
      } else {
        request = store.getAll()
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Update transaction status
   */
  async updateTransaction(id: string, updates: Partial<QueuedPOSTransaction>): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.ensureDb()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const transaction = getRequest.result
        if (!transaction) {
          reject(new Error(`Transaction ${id} not found`))
          return
        }

        const updated = { ...transaction, ...updates }
        const putRequest = store.put(updated)

        putRequest.onsuccess = () => {
          this.notifyListeners()
          resolve()
        }
        putRequest.onerror = () => reject(putRequest.error)
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.ensureDb()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => {
        this.notifyListeners()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<OfflineQueueStats> {
    const transactions = await this.getQueuedTransactions()

    const stats: OfflineQueueStats = {
      totalQueued: transactions.length,
      pending: transactions.filter(t => t.status === 'pending').length,
      syncing: transactions.filter(t => t.status === 'syncing').length,
      synced: transactions.filter(t => t.status === 'synced').length,
      failed: transactions.filter(t => t.status === 'failed').length,
      conflicts: transactions.filter(t => t.status === 'conflict').length,
    }

    const sortedByDate = transactions
      .filter(t => t.status !== 'synced')
      .sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime())

    if (sortedByDate.length > 0) {
      stats.oldestQueuedAt = sortedByDate[0].queuedAt
    }

    return stats
  }

  /**
   * Attempt to sync queued transactions
   */
  async syncQueue(
    syncFn: (
      orgId: string,
      userId: string,
      lines: POSOrderLine[],
      options: CreatePOSOrderOptions
    ) => Promise<string>
  ): Promise<{ synced: number; failed: number; conflicts: number }> {
    if (this.syncInProgress) {
      console.log('Sync already in progress')
      return { synced: 0, failed: 0, conflicts: 0 }
    }

    this.syncInProgress = true
    let synced = 0
    let failed = 0
    let conflicts = 0

    try {
      const pending = await this.getQueuedTransactions('pending')
      const batch = pending.slice(0, SYNC_BATCH_SIZE)

      for (const transaction of batch) {
        try {
          await this.updateTransaction(transaction.id, {
            status: 'syncing',
            lastAttemptAt: new Date().toISOString(),
            attemptCount: transaction.attemptCount + 1,
          })

          const orderId = await syncFn(
            transaction.orgId,
            transaction.userId,
            transaction.lines,
            transaction.options
          )

          await this.updateTransaction(transaction.id, {
            status: 'synced',
          })

          console.log(`✓ Synced offline transaction ${transaction.id} → order ${orderId}`)
          synced++

          // Clean up synced transactions after 24 hours
          setTimeout(() => {
            this.deleteTransaction(transaction.id).catch(console.error)
          }, 24 * 60 * 60 * 1000)
        } catch (error: unknown) {
          console.error(`Failed to sync transaction ${transaction.id}:`, error)

          const errorMessage = error instanceof Error ? error.message : String(error)
          const isConflict = errorMessage.toLowerCase().includes('stock') || 
                            errorMessage.toLowerCase().includes('insufficient')

          if (isConflict) {
            await this.updateTransaction(transaction.id, {
              status: 'conflict',
              error: errorMessage,
            })
            conflicts++
          } else if (transaction.attemptCount + 1 >= MAX_RETRY_ATTEMPTS) {
            await this.updateTransaction(transaction.id, {
              status: 'failed',
              error: errorMessage,
            })
            failed++
          } else {
            await this.updateTransaction(transaction.id, {
              status: 'pending',
              error: errorMessage,
            })
          }
        }
      }
    } finally {
      this.syncInProgress = false
      this.notifyListeners()
    }

    return { synced, failed, conflicts }
  }

  /**
   * Resolve a conflict manually
   */
  async resolveConflict(
    id: string,
    resolution: 'skip' | 'force' | 'manual',
    syncFn?: (
      orgId: string,
      userId: string,
      lines: POSOrderLine[],
      options: CreatePOSOrderOptions
    ) => Promise<string>
  ): Promise<void> {
    const transactions = await this.getQueuedTransactions('conflict')
    const transaction = transactions.find(t => t.id === id)

    if (!transaction) {
      throw new Error(`Conflict transaction ${id} not found`)
    }

    if (resolution === 'skip') {
      await this.deleteTransaction(id)
    } else if (resolution === 'force' && syncFn) {
      try {
        await this.updateTransaction(id, { status: 'syncing' })
        const orderId = await syncFn(
          transaction.orgId,
          transaction.userId,
          transaction.lines,
          transaction.options
        )
        await this.updateTransaction(id, { status: 'synced' })
        console.log(`✓ Force synced conflict transaction ${id} → order ${orderId}`)
      } catch (error) {
        await this.updateTransaction(id, {
          status: 'conflict',
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    } else {
      await this.updateTransaction(id, { conflictResolution: resolution })
    }
  }

  /**
   * Clear all synced transactions
   */
  async clearSynced(): Promise<void> {
    const synced = await this.getQueuedTransactions('synced')
    for (const transaction of synced) {
      await this.deleteTransaction(transaction.id)
    }
  }

  /**
   * Subscribe to queue stats changes
   */
  subscribe(listener: (stats: OfflineQueueStats) => void): () => void {
    this.listeners.add(listener)
    // Send initial stats
    this.getStats().then(listener).catch(console.error)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    this.getStats().then(stats => {
      this.listeners.forEach(listener => listener(stats))
    }).catch(console.error)
  }

  /**
   * Check if offline mode is supported
   */
  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined'
  }
}

// Singleton instance
let instance: OfflineQueueManager | null = null

export function getOfflineQueueManager(): OfflineQueueManager {
  if (!instance) {
    instance = new OfflineQueueManager()
  }
  return instance
}

export { OfflineQueueManager }
