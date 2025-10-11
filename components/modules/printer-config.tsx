/**
 * Printer Configuration UI
 * Manage thermal printers for receipt printing
 */

'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Printer, Plus, Trash2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PrinterConfig } from '@/lib/receipt-types'

const panelShell =
  'rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/70 via-slate-900/45 to-slate-800/40 backdrop-blur-2xl shadow-[0_30px_80px_-35px_rgba(15,23,42,0.9)] text-slate-100'

interface PrinterConfigUIProps {
  orgId: string
}

export default function PrinterConfigUI({ orgId }: PrinterConfigUIProps) {
  const { toast } = useToast()
  const [printers, setPrinters] = useState<Record<string, PrinterConfig>>({})
  const [defaultPrinterId, setDefaultPrinterId] = useState<string>()
  const [autoPrint, setAutoPrint] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<PrinterConfig>>({})

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  async function loadSettings() {
    try {
      const response = await fetch(`/api/settings/printers?orgId=${orgId}`)
      if (!response.ok) throw new Error('Failed to load settings')
      
      const data = await response.json()
      setPrinters(data.settings.printers || {})
      setDefaultPrinterId(data.settings.defaultPrinterId)
      setAutoPrint(data.settings.autoPrint || false)
    } catch (error) {
      console.error('Error loading printer settings:', error)
      toast({
        variant: 'destructive',
        title: 'Load failed',
        description: 'Could not load printer settings',
      })
    } finally {
      setLoading(false)
    }
  }

  function startEdit(printerId: string) {
    setEditingId(printerId)
    setEditForm(printers[printerId] || {})
  }

  function startNew() {
    const newId = `printer_${Date.now()}`
    setEditingId(newId)
    setEditForm({
      type: 'thermal',
      model: 'epson-tm-t88',
      paperWidth: 80,
      characterWidth: 42,
      enableLogo: false,
    })
  }

  async function savePrinter() {
    if (!editingId) return

    try {
      const response = await fetch('/api/settings/printers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          printerId: editingId,
          config: editForm,
        }),
      })

      if (!response.ok) throw new Error('Failed to save printer')

      toast({
        title: 'Printer saved',
        description: 'Configuration updated successfully',
      })

      await loadSettings()
      setEditingId(null)
      setEditForm({})
    } catch (error) {
      console.error('Error saving printer:', error)
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: 'Could not save printer configuration',
      })
    }
  }

  async function deletePrinter(printerId: string) {
    if (!confirm('Delete this printer?')) return

    try {
      const response = await fetch(`/api/settings/printers?orgId=${orgId}&printerId=${printerId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete printer')

      toast({
        title: 'Printer deleted',
        description: 'Configuration removed',
      })

      await loadSettings()
    } catch (error) {
      console.error('Error deleting printer:', error)
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: 'Could not delete printer',
      })
    }
  }

  async function setDefault(printerId: string) {
    try {
      const response = await fetch('/api/settings/printers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          defaultPrinterId: printerId,
        }),
      })

      if (!response.ok) throw new Error('Failed to set default')

      toast({
        title: 'Default printer updated',
      })

      await loadSettings()
    } catch (error) {
      console.error('Error setting default:', error)
    }
  }

  async function toggleAutoPrint() {
    try {
      const newValue = !autoPrint
      const response = await fetch('/api/settings/printers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          autoPrint: newValue,
        }),
      })

      if (!response.ok) throw new Error('Failed to update')

      setAutoPrint(newValue)
      toast({
        title: 'Auto-print ' + (newValue ? 'enabled' : 'disabled'),
      })
    } catch (error) {
      console.error('Error toggling auto-print:', error)
    }
  }

  if (loading) {
    return (
      <div className={cn(panelShell, 'flex items-center justify-center p-12')}>
        <p className="text-slate-300">Loading printer settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cn(panelShell, 'relative overflow-hidden px-8 py-10')}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-purple-400/10" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <Printer className="h-6 w-6 text-violet-300" />
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-50">
                Receipt Printers
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Configure thermal printers for receipt printing
              </p>
            </div>
          </div>
          <Button
            onClick={startNew}
            className="bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Printer
          </Button>
        </div>
      </div>

      {/* Auto-print toggle */}
      <div className={cn(panelShell, 'p-6')}>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium text-slate-100">
              Auto-print Receipts
            </Label>
            <p className="text-sm text-slate-400">
              Automatically print receipts after completing transactions
            </p>
          </div>
          <Switch checked={autoPrint} onCheckedChange={toggleAutoPrint} />
        </div>
      </div>

      {/* Printer list */}
      <div className="space-y-3">
        {Object.entries(printers).map(([id, config]) => (
          <div key={id} className={cn(panelShell, 'p-6')}>
            {editingId === id ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Printer Type</Label>
                    <Select
                      value={editForm.type}
                      onValueChange={(v: any) => setEditForm({ ...editForm, type: v })}
                    >
                      <SelectTrigger className="border-white/10 bg-slate-950/80 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-slate-950/90 text-slate-100">
                        <SelectItem value="thermal">Thermal Printer</SelectItem>
                        <SelectItem value="browser">Browser Print</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editForm.type === 'thermal' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-slate-200">Model</Label>
                        <Select
                          value={editForm.model}
                          onValueChange={(v: any) => setEditForm({ ...editForm, model: v })}
                        >
                          <SelectTrigger className="border-white/10 bg-slate-950/80 text-slate-100">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-white/10 bg-slate-950/90 text-slate-100">
                            <SelectItem value="epson-tm-t88">Epson TM-T88 Series</SelectItem>
                            <SelectItem value="star-tsp100">Star TSP100</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-200">IP Address</Label>
                        <Input
                          value={editForm.ip || ''}
                          onChange={(e) => setEditForm({ ...editForm, ip: e.target.value })}
                          placeholder="192.168.1.100"
                          className="border-white/10 bg-slate-950/80 text-slate-100"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-200">Port</Label>
                        <Input
                          type="number"
                          value={editForm.port || 9100}
                          onChange={(e) => setEditForm({ ...editForm, port: parseInt(e.target.value) })}
                          className="border-white/10 bg-slate-950/80 text-slate-100"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label className="text-slate-200">Paper Width (mm)</Label>
                    <Select
                      value={editForm.paperWidth?.toString()}
                      onValueChange={(v) => setEditForm({ ...editForm, paperWidth: parseInt(v) as any })}
                    >
                      <SelectTrigger className="border-white/10 bg-slate-950/80 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-slate-950/90 text-slate-100">
                        <SelectItem value="58">58mm</SelectItem>
                        <SelectItem value="80">80mm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">Character Width</Label>
                    <Input
                      type="number"
                      value={editForm.characterWidth || 42}
                      onChange={(e) => setEditForm({ ...editForm, characterWidth: parseInt(e.target.value) })}
                      className="border-white/10 bg-slate-950/80 text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditingId(null)}
                    className="border-white/10 bg-slate-950/80 text-slate-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={savePrinter}
                    className="bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-100">
                      {config.model || config.type}
                    </h3>
                    {defaultPrinterId === id && (
                      <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 text-emerald-100">
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    {config.type === 'thermal' ? `${config.ip}:${config.port}` : 'Browser print'}
                    {' • '}
                    {config.paperWidth}mm
                  </p>
                </div>
                <div className="flex gap-2">
                  {defaultPrinterId !== id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDefault(id)}
                      className="border-white/10 bg-slate-950/80 text-slate-100"
                    >
                      Set Default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(id)}
                    className="border-white/10 bg-slate-950/80 text-slate-100"
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deletePrinter(id)}
                    className="border-red-400/40 bg-red-400/10 text-red-100 hover:bg-red-400/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {Object.keys(printers).length === 0 && !editingId && (
          <div className={cn(panelShell, 'flex flex-col items-center justify-center p-12 text-center')}>
            <Printer className="mb-4 h-12 w-12 text-slate-400" />
            <p className="text-slate-300">No printers configured</p>
            <p className="text-sm text-slate-400">Add a printer to start printing receipts</p>
          </div>
        )}
      </div>
    </div>
  )
}
