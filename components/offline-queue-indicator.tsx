/**
 * Offline Queue Status Indicator
 * Shows connection status and queued transactions
 */

'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OfflineQueueStats } from '@/types/pos'
import {
  checkOnlineStatus,
  subscribeToQueueStats,
  triggerSync,
  resolveConflict
} from '@/lib/pos-offline-aware'

const panelShell =
  'rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/60 to-slate-800/50 backdrop-blur-xl shadow-[0_25px_60px_-20px_rgba(15,23,42,0.8)]'

export default function OfflineQueueIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [stats, setStats] = useState<OfflineQueueStats | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Initial status
    setIsOnline(checkOnlineStatus())

    // Listen to network status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Subscribe to queue stats
    const unsubscribe = subscribeToQueueStats(setStats)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      unsubscribe()
    }
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await triggerSync()
    } finally {
      setSyncing(false)
    }
  }

  const hasQueuedItems = stats && (stats.pending > 0 || stats.syncing > 0 || stats.failed > 0 || stats.conflicts > 0)

  if (!hasQueuedItems && isOnline) {
    // Minimal indicator when online and queue is empty
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(panelShell, 'px-3 py-2 text-emerald-200')}
        >
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.25em]">Online</span>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(panelShell, 'text-slate-100')}
      >
        {/* Compact View */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-emerald-300" />
            ) : (
              <WifiOff className="h-5 w-5 text-amber-300 animate-pulse" />
            )}
            <div>
              <div className="text-sm font-semibold">
                {isOnline ? 'Online' : 'Offline Mode'}
              </div>
              {stats && hasQueuedItems && (
                <div className="text-xs text-slate-400">
                  {stats.pending + stats.syncing} queued
                  {stats.failed > 0 && `, ${stats.failed} failed`}
                  {stats.conflicts > 0 && `, ${stats.conflicts} conflicts`}
                </div>
              )}
            </div>
          </div>
          
          {hasQueuedItems && (
            <Badge
              variant="outline"
              className="rounded-full border-amber-400/40 bg-amber-400/10 text-amber-100"
            >
              {stats!.totalQueued}
            </Badge>
          )}
        </button>

        {/* Expanded View */}
        <AnimatePresence>
          {expanded && stats && hasQueuedItems && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/10"
            >
              <div className="space-y-3 p-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {stats.pending > 0 && (
                    <div className="flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/5 px-3 py-2">
                      <Clock className="h-4 w-4 text-sky-300" />
                      <div>
                        <div className="font-medium text-sky-100">{stats.pending}</div>
                        <div className="text-slate-400">Pending</div>
                      </div>
                    </div>
                  )}

                  {stats.syncing > 0 && (
                    <div className="flex items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-400/5 px-3 py-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-300" />
                      <div>
                        <div className="font-medium text-blue-100">{stats.syncing}</div>
                        <div className="text-slate-400">Syncing</div>
                      </div>
                    </div>
                  )}

                  {stats.synced > 0 && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      <div>
                        <div className="font-medium text-emerald-100">{stats.synced}</div>
                        <div className="text-slate-400">Synced</div>
                      </div>
                    </div>
                  )}

                  {stats.failed > 0 && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/5 px-3 py-2">
                      <XCircle className="h-4 w-4 text-rose-300" />
                      <div>
                        <div className="font-medium text-rose-100">{stats.failed}</div>
                        <div className="text-slate-400">Failed</div>
                      </div>
                    </div>
                  )}

                  {stats.conflicts > 0 && (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2">
                      <AlertCircle className="h-4 w-4 text-amber-300" />
                      <div>
                        <div className="font-medium text-amber-100">{stats.conflicts}</div>
                        <div className="text-slate-400">Conflicts</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Oldest Queued */}
                {stats.oldestQueuedAt && (
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                    Oldest: {new Date(stats.oldestQueuedAt).toLocaleString()}
                  </div>
                )}

                {/* Actions */}
                {isOnline && (stats.pending > 0 || stats.failed > 0) && (
                  <Button
                    size="sm"
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full rounded-xl bg-sky-500/80 text-slate-950 hover:bg-sky-400"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync Now
                      </>
                    )}
                  </Button>
                )}

                {!isOnline && (
                  <div className="rounded-xl border border-amber-200/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    <AlertCircle className="mr-2 inline h-4 w-4" />
                    Transactions will sync automatically when online
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
