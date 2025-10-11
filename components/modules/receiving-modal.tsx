/**
 * Receiving Modal Component
 * Allows warehouse staff to receive deliveries against purchase orders
 * Part of Phase 1.1 Receiving Flow Completion
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { useToast } from '../ui/use-toast'
import { Loader2, Package, CheckCircle2, Minus, Plus, AlertCircle } from 'lucide-react'
import { getPurchaseOrder } from '@/lib/purchase-order-operations'
import type { PurchaseOrder, PurchaseOrderLine } from '@/types/purchase-orders'

interface ReceivingModalProps {
  open: boolean
  onClose: () => void
  orgId: string
  onSuccess?: () => void
}

interface ReceivedLine {
  productId: string
  productName: string
  quantityOrdered: number
  quantityReceived: number
  quantityAlreadyReceived: number
  unitPrice: number
  unit: string
}

export function ReceivingModal({ open, onClose, orgId, onSuccess }: ReceivingModalProps) {
  const { toast } = useToast()
  const [poNumber, setPoNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [receivedLines, setReceivedLines] = useState<ReceivedLine[]>([])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setPoNumber('')
      setPo(null)
      setReceivedLines([])
    }
  }, [open])

  const handleFetchPO = useCallback(async () => {
    if (!poNumber.trim()) {
      toast({
        title: 'PO number required',
        description: 'Please enter a purchase order number',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const fetchedPO = await getPurchaseOrder(poNumber.trim())
      
      if (!fetchedPO) {
        toast({
          title: 'PO not found',
          description: `Purchase order ${poNumber} does not exist`,
          variant: 'destructive',
        })
        return
      }

      if (fetchedPO.orgId !== orgId) {
        toast({
          title: 'Access denied',
          description: 'This PO belongs to a different organization',
          variant: 'destructive',
        })
        return
      }

      if (fetchedPO.status === 'cancelled') {
        toast({
          title: 'PO cancelled',
          description: 'This purchase order has been cancelled',
          variant: 'destructive',
        })
        return
      }

      if (fetchedPO.status === 'received') {
        toast({
          title: 'Already received',
          description: 'This purchase order has already been fully received',
          variant: 'destructive',
        })
        return
      }

      setPo(fetchedPO)
      
      // Initialize received lines with 0 quantities
      const lines: ReceivedLine[] = fetchedPO.lines.map(line => ({
        productId: line.productId,
        productName: line.productName,
        quantityOrdered: line.quantityOrdered,
        quantityReceived: 0, // What we're receiving now
        quantityAlreadyReceived: line.quantityReceived || 0,
        unitPrice: line.unitPrice,
        unit: line.unit || 'PCS',
      }))
      
      setReceivedLines(lines)

      toast({
        title: 'PO loaded',
        description: `${fetchedPO.supplierName} - ${fetchedPO.lines.length} items`,
      })

    } catch (error: any) {
      console.error('Error fetching PO:', error)
      toast({
        title: 'Error loading PO',
        description: error.message || 'Failed to fetch purchase order',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [poNumber, orgId, toast])

  const updateReceivedQuantity = useCallback((productId: string, delta: number) => {
    setReceivedLines(prev => prev.map(line => {
      if (line.productId !== productId) return line
      
      const newQty = Math.max(0, line.quantityReceived + delta)
      const remaining = line.quantityOrdered - line.quantityAlreadyReceived
      
      // Don't allow receiving more than remaining
      return {
        ...line,
        quantityReceived: Math.min(newQty, remaining),
      }
    }))
  }, [])

  const setReceivedQuantity = useCallback((productId: string, value: string) => {
    const qty = parseInt(value) || 0
    setReceivedLines(prev => prev.map(line => {
      if (line.productId !== productId) return line
      
      const remaining = line.quantityOrdered - line.quantityAlreadyReceived
      return {
        ...line,
        quantityReceived: Math.max(0, Math.min(qty, remaining)),
      }
    }))
  }, [])

  const handleReceive = useCallback(async () => {
    if (!po) return

    const linesToReceive = receivedLines.filter(line => line.quantityReceived > 0)
    
    if (linesToReceive.length === 0) {
      toast({
        title: 'No quantities entered',
        description: 'Please enter received quantities for at least one item',
        variant: 'destructive',
      })
      return
    }

    setReceiving(true)
    try {
      const response = await fetch('/api/supplier/receiving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poId: po.id,
          orgId,
          receivedLines: linesToReceive.map(line => ({
            productId: line.productId,
            quantityReceived: line.quantityReceived,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to receive delivery')
      }

      toast({
        title: 'Delivery received',
        description: data.message,
        className: 'border-green-500/20 bg-green-950/90 backdrop-blur-xl text-white',
      })

      onSuccess?.()
      onClose()

    } catch (error: any) {
      console.error('Error receiving delivery:', error)
      toast({
        title: 'Failed to receive delivery',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setReceiving(false)
    }
  }, [po, orgId, receivedLines, toast, onSuccess, onClose])

  const totalReceiving = receivedLines.reduce((sum, line) => sum + line.quantityReceived, 0)
  const totalValue = receivedLines.reduce((sum, line) => sum + (line.quantityReceived * line.unitPrice), 0)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950/95 backdrop-blur-xl border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Package className="w-6 h-6 text-blue-400" />
            Receive Delivery
          </DialogTitle>
          <DialogDescription>
            Scan or enter PO number to receive goods into inventory
          </DialogDescription>
        </DialogHeader>

        {!po ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="po-number">Purchase Order Number</Label>
              <div className="flex gap-2">
                <Input
                  id="po-number"
                  placeholder="Enter PO number..."
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFetchPO()}
                  disabled={loading}
                  className="bg-slate-900/50 border-slate-700"
                />
                <Button onClick={handleFetchPO} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load PO'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* PO Info */}
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Supplier:</span>
                  <p className="font-medium">{po.supplierName}</p>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>
                  <p className="font-medium capitalize">{po.status.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-slate-400">Order Total:</span>
                  <p className="font-medium">KES {po.totalAmount.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-slate-400">Expected:</span>
                  <p className="font-medium">
                    {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <Label>Items to Receive</Label>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {receivedLines.map((line) => {
                  const remaining = line.quantityOrdered - line.quantityAlreadyReceived
                  const isFullyReceived = remaining === 0

                  return (
                    <div
                      key={line.productId}
                      className={`p-3 rounded-lg border ${
                        isFullyReceived 
                          ? 'bg-slate-800/30 border-slate-700/50 opacity-60' 
                          : 'bg-slate-900/50 border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{line.productName}</p>
                          <p className="text-sm text-slate-400">
                            Ordered: {line.quantityOrdered} {line.unit} • 
                            Already received: {line.quantityAlreadyReceived} {line.unit} • 
                            <span className={isFullyReceived ? 'text-green-400' : 'text-yellow-400'}>
                              Remaining: {remaining} {line.unit}
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateReceivedQuantity(line.productId, -1)}
                            disabled={line.quantityReceived === 0 || isFullyReceived}
                            className="h-8 w-8 p-0"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          
                          <Input
                            type="number"
                            value={line.quantityReceived}
                            onChange={(e) => setReceivedQuantity(line.productId, e.target.value)}
                            disabled={isFullyReceived}
                            className="w-20 text-center bg-slate-800 border-slate-700"
                            min="0"
                            max={remaining}
                          />
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateReceivedQuantity(line.productId, 1)}
                            disabled={line.quantityReceived >= remaining || isFullyReceived}
                            className="h-8 w-8 p-0"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {line.quantityReceived > 0 && (
                        <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Receiving {line.quantityReceived} {line.unit} (KES {(line.quantityReceived * line.unitPrice).toLocaleString()})
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 rounded-lg bg-blue-950/20 border border-blue-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Receiving Total</p>
                  <p className="text-lg font-bold">{totalReceiving} items</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Value</p>
                  <p className="text-lg font-bold text-blue-400">KES {totalValue.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleReceive}
                disabled={receiving || totalReceiving === 0}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
              >
                {receiving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Receiving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirm Receipt
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
