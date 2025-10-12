/**
 * Offline Status Indicator
 * Shows network status, queue count, and sync progress in POS
 */

import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export interface OfflineStatusProps {
  isOffline: boolean
  queuedCount: number
  isSyncing: boolean
  failedCount?: number
  conflictsCount?: number
  onSyncClick?: () => void
  className?: string
  compact?: boolean
}

export function OfflineStatus({
  isOffline,
  queuedCount,
  isSyncing,
  failedCount = 0,
  conflictsCount = 0,
  onSyncClick,
  className,
  compact = false
}: OfflineStatusProps) {
  const hasIssues = failedCount > 0 || conflictsCount > 0
  const canSync = !isSyncing && queuedCount > 0 && !isOffline

  const getStatusIcon = () => {
    if (isOffline) return <CloudOff className="h-4 w-4" />
    if (isSyncing) return <RefreshCw className="h-4 w-4 animate-spin" />
    if (hasIssues) return <AlertCircle className="h-4 w-4" />
    if (queuedCount > 0) return <Cloud className="h-4 w-4" />
    return <CheckCircle2 className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (isOffline) return 'Offline Mode'
    if (isSyncing) return 'Syncing...'
    if (queuedCount > 0) return `${queuedCount} pending`
    return 'All synced'
  }

  const getStatusColor = () => {
    if (isOffline) return 'bg-orange-500/10 text-orange-600 border-orange-500/20'
    if (isSyncing) return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
    if (hasIssues) return 'bg-red-500/10 text-red-600 border-red-500/20'
    if (queuedCount > 0) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
    return 'bg-green-500/10 text-green-600 border-green-500/20'
  }

  const getTooltipContent = () => {
    const parts: string[] = []
    
    if (isOffline) {
      parts.push('Device is offline. Orders will be queued automatically.')
    } else {
      parts.push('Device is online')
    }
    
    if (queuedCount > 0) {
      parts.push(`${queuedCount} order${queuedCount > 1 ? 's' : ''} waiting to sync`)
    }
    
    if (failedCount > 0) {
      parts.push(`${failedCount} failed sync${failedCount > 1 ? 's' : ''}`)
    }
    
    if (conflictsCount > 0) {
      parts.push(`${conflictsCount} conflict${conflictsCount > 1 ? 's' : ''} need attention`)
    }
    
    if (isSyncing) {
      parts.push('Syncing orders to cloud...')
    }
    
    return parts.join(' • ')
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'relative h-9 w-9 rounded-full p-0',
                getStatusColor(),
                className
              )}
              onClick={canSync ? onSyncClick : undefined}
              disabled={!canSync}
            >
              {getStatusIcon()}
              {queuedCount > 0 && (
                <Badge
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center"
                  variant={hasIssues ? 'destructive' : 'default'}
                >
                  {queuedCount}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{getTooltipContent()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
        getStatusColor(),
        className
      )}
    >
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="whitespace-nowrap">{getStatusText()}</span>
      </div>

      {canSync && onSyncClick && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSyncClick}
          className="h-6 px-2 text-xs hover:bg-background/50"
        >
          Sync Now
        </Button>
      )}

      {hasIssues && (
        <Badge variant="destructive" className="text-xs">
          {failedCount > 0 && `${failedCount} failed`}
          {failedCount > 0 && conflictsCount > 0 && ' • '}
          {conflictsCount > 0 && `${conflictsCount} conflicts`}
        </Badge>
      )}
    </div>
  )
}

/**
 * Minimal wifi/offline indicator for mobile
 */
export function OfflineIndicatorMini({ isOffline }: { isOffline: boolean }) {
  if (!isOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white px-4 py-1 text-center text-xs font-medium flex items-center justify-center gap-2">
      <WifiOff className="h-3 w-3" />
      <span>Offline Mode - Orders will be queued</span>
    </div>
  )
}
