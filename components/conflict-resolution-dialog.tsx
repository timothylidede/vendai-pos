/**
 * Conflict Resolution Dialog
 * Shows details about offline orders that failed to sync due to conflicts
 */

import { useState } from 'react'
import { AlertTriangle, Package, Calendar, User, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import type { POSOrderLine } from '@/lib/types'

export interface ConflictOrder {
  id: string
  orderNumber?: string
  lines: POSOrderLine[]
  metadata: {
    orgId: string
    cashierName: string
    laneId?: string
    queuedAt: string
  }
  error: string | null
  retryCount: number
}

export interface ConflictResolutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: ConflictOrder[]
  onResolve: (id: string, resolution: 'skip' | 'force') => Promise<void>
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  conflicts,
  onResolve
}: ConflictResolutionDialogProps) {
  const [resolving, setResolving] = useState<string | null>(null)
  const [selectedConflict, setSelectedConflict] = useState<ConflictOrder | null>(
    conflicts.length > 0 ? conflicts[0] : null
  )

  const handleResolve = async (resolution: 'skip' | 'force') => {
    if (!selectedConflict) return

    setResolving(selectedConflict.id)
    try {
      await onResolve(selectedConflict.id, resolution)
      
      // Move to next conflict or close
      const remainingConflicts = conflicts.filter(c => c.id !== selectedConflict.id)
      if (remainingConflicts.length > 0) {
        setSelectedConflict(remainingConflicts[0])
      } else {
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
    } finally {
      setResolving(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTotal = (lines: POSOrderLine[]) => {
    return lines.reduce((sum, line) => sum + line.lineTotal, 0)
  }

  if (!selectedConflict) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <DialogTitle>Resolve Sync Conflicts</DialogTitle>
          </div>
          <DialogDescription>
            {conflicts.length} order{conflicts.length > 1 ? 's' : ''} failed to sync due to
            inventory conflicts. Review and resolve each conflict.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conflict Navigation */}
          {conflicts.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              {conflicts.map((conflict, index) => (
                <Button
                  key={conflict.id}
                  variant={conflict.id === selectedConflict.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedConflict(conflict)}
                >
                  Conflict {index + 1}
                </Button>
              ))}
            </div>
          )}

          {/* Selected Conflict Details */}
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-lg">
                  Order #{selectedConflict.orderNumber || selectedConflict.id.slice(0, 8)}
                </h4>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(selectedConflict.metadata.queuedAt)}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {selectedConflict.metadata.cashierName}
                  </div>
                  {selectedConflict.metadata.laneId && (
                    <Badge variant="secondary">{selectedConflict.metadata.laneId}</Badge>
                  )}
                </div>
              </div>
              <Badge variant="destructive" className="ml-2">
                Retry {selectedConflict.retryCount}
              </Badge>
            </div>

            <Separator className="my-3" />

            {/* Error Message */}
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-3">
              <p className="text-sm font-medium text-destructive">
                {selectedConflict.error || 'Inventory conflict detected'}
              </p>
            </div>

            {/* Order Lines */}
            <ScrollArea className="max-h-[240px] pr-4">
              <div className="space-y-2">
                {selectedConflict.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md bg-background/50 p-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{line.name}</span>
                      <Badge variant="outline">×{line.quantityPieces}</Badge>
                    </div>
                    <span className="font-mono">
                      KES {line.lineTotal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Separator className="my-3" />

            {/* Total */}
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span className="font-mono text-lg">
                KES {getTotal(selectedConflict.lines).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Resolution Options */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <h4 className="font-semibold mb-2">Resolution Options:</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="font-medium">Skip:</span>
                <span>Remove this order from the sync queue. Order will be lost.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium">Force Sync:</span>
                <span>
                  Attempt to create the order anyway. May cause negative inventory.
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleResolve('skip')}
            disabled={resolving !== null}
          >
            <X className="h-4 w-4 mr-2" />
            Skip This Order
          </Button>
          <Button
            variant="default"
            onClick={() => handleResolve('force')}
            disabled={resolving !== null}
          >
            {resolving === selectedConflict.id ? 'Processing...' : 'Force Sync'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
