/**
 * Barcode Configuration UI Component
 * Configure weight-based barcode format per organization
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
import { Barcode, Weight, DollarSign, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  parseWeightBarcode, 
  validateEAN13CheckDigit,
  generateWeightBarcode,
  DEFAULT_WEIGHT_BARCODE_CONFIGS,
  type WeightBarcodeConfig,
  type OrgBarcodeSettings 
} from '@/lib/barcode-utils'

const panelShell =
  'rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/70 via-slate-900/45 to-slate-800/40 backdrop-blur-2xl shadow-[0_30px_80px_-35px_rgba(15,23,42,0.9)] text-slate-100'

interface BarcodeConfigProps {
  orgId: string
  initialSettings?: OrgBarcodeSettings
  onSave?: (settings: OrgBarcodeSettings) => void
}

export default function BarcodeConfig({ orgId, initialSettings, onSave }: BarcodeConfigProps) {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(initialSettings?.enableWeightBarcodes || false)
  const [config, setConfig] = useState<WeightBarcodeConfig>(
    initialSettings?.weightBarcodeConfig || DEFAULT_WEIGHT_BARCODE_CONFIGS['ean13-weight-standard']
  )
  const [testBarcode, setTestBarcode] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (testBarcode.length === 13) {
      const result = parseWeightBarcode(testBarcode, config)
      const isValid = validateEAN13CheckDigit(testBarcode)
      setTestResult({ ...result, isValid })
    } else {
      setTestResult(null)
    }
  }, [testBarcode, config])

  const handlePresetChange = (preset: string) => {
    if (preset in DEFAULT_WEIGHT_BARCODE_CONFIGS) {
      setConfig(DEFAULT_WEIGHT_BARCODE_CONFIGS[preset])
      toast({
        title: 'Preset loaded',
        description: `Applied ${preset} configuration`,
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const settings: OrgBarcodeSettings = {
        orgId,
        enableWeightBarcodes: enabled,
        weightBarcodeConfig: enabled ? config : undefined,
      }

      // Save to Firestore via API
      const response = await fetch('/api/settings/barcode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      toast({
        title: 'Settings saved',
        description: 'Barcode configuration updated successfully',
      })

      if (onSave) onSave(settings)
    } catch (error) {
      console.error('Error saving barcode settings:', error)
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: 'Could not update barcode settings',
      })
    } finally {
      setSaving(false)
    }
  }

  const generateTestBarcode = () => {
    try {
      const productCode = '12345'
      const weightGrams = 678.9 * 10 // 678.9g
      const generated = generateWeightBarcode(productCode, weightGrams, config)
      setTestBarcode(generated)
      toast({
        title: 'Test barcode generated',
        description: generated,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: 'Could not generate test barcode',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cn(panelShell, 'relative overflow-hidden px-8 py-10')}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-400/10" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <Barcode className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-50">
                Barcode Configuration
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Configure weight-based barcode scanning for scales and deli counters
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enable toggle */}
      <div className={cn(panelShell, 'p-6')}>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="enable-weight" className="text-base font-medium text-slate-100">
              Enable Weight-Embedded Barcodes
            </Label>
            <p className="text-sm text-slate-400">
              Parse barcodes with embedded weight or price information
            </p>
          </div>
          <Switch
            id="enable-weight"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
      </div>

      {enabled && (
        <>
          {/* Configuration */}
          <div className={cn(panelShell, 'p-6')}>
            <h3 className="mb-4 text-lg font-semibold text-slate-100">Format Configuration</h3>
            
            <div className="space-y-4">
              {/* Preset selector */}
              <div className="space-y-2">
                <Label className="text-slate-200">Preset Format</Label>
                <Select onValueChange={handlePresetChange} defaultValue="ean13-weight-standard">
                  <SelectTrigger className="border-white/10 bg-slate-950/80 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950/90 text-slate-100">
                    <SelectItem value="ean13-weight-standard">EAN-13 Weight (Standard)</SelectItem>
                    <SelectItem value="ean13-price-standard">EAN-13 Price (Standard)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">
                  Select a preset or customize below
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-200">Product Code Start</Label>
                  <Input
                    type="number"
                    value={config.productCodeStart}
                    onChange={(e) => setConfig({ ...config, productCodeStart: parseInt(e.target.value) })}
                    className="border-white/10 bg-slate-950/80 text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Product Code Length</Label>
                  <Input
                    type="number"
                    value={config.productCodeLength}
                    onChange={(e) => setConfig({ ...config, productCodeLength: parseInt(e.target.value) })}
                    className="border-white/10 bg-slate-950/80 text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Value Start Position</Label>
                  <Input
                    type="number"
                    value={config.valueStart}
                    onChange={(e) => setConfig({ ...config, valueStart: parseInt(e.target.value) })}
                    className="border-white/10 bg-slate-950/80 text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Value Length</Label>
                  <Input
                    type="number"
                    value={config.valueLength}
                    onChange={(e) => setConfig({ ...config, valueLength: parseInt(e.target.value) })}
                    className="border-white/10 bg-slate-950/80 text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Value Type</Label>
                  <Select 
                    value={config.valueType} 
                    onValueChange={(v: 'price' | 'weight') => setConfig({ ...config, valueType: v })}
                  >
                    <SelectTrigger className="border-white/10 bg-slate-950/80 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-950/90 text-slate-100">
                      <SelectItem value="weight">Weight (kg/g)</SelectItem>
                      <SelectItem value="price">Price (cents)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Divisor</Label>
                  <Input
                    type="number"
                    value={config.divisor}
                    onChange={(e) => setConfig({ ...config, divisor: parseInt(e.target.value) })}
                    className="border-white/10 bg-slate-950/80 text-slate-100"
                  />
                  <p className="text-xs text-slate-400">
                    {config.valueType === 'weight' ? '1000 for grams → kg' : '100 for cents → currency'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Barcode Prefix (Optional)</Label>
                  <Input
                    value={config.prefix || ''}
                    onChange={(e) => setConfig({ ...config, prefix: e.target.value || undefined })}
                    placeholder="e.g., 2 or 20"
                    className="border-white/10 bg-slate-950/80 text-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Test section */}
          <div className={cn(panelShell, 'p-6')}>
            <h3 className="mb-4 text-lg font-semibold text-slate-100">Test Barcode</h3>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={testBarcode}
                  onChange={(e) => setTestBarcode(e.target.value)}
                  placeholder="Enter 13-digit barcode"
                  maxLength={13}
                  className="border-white/10 bg-slate-950/80 text-slate-100"
                />
                <Button
                  onClick={generateTestBarcode}
                  variant="outline"
                  className="border-cyan-400/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"
                >
                  Generate
                </Button>
              </div>

              {testResult && (
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    {testResult.isValid ? (
                      <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 text-emerald-100">
                        <Check className="mr-1 h-3 w-3" />
                        Valid EAN-13
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-400/40 bg-red-400/10 text-red-100">
                        <X className="mr-1 h-3 w-3" />
                        Invalid Check Digit
                      </Badge>
                    )}
                    {testResult.isWeightEmbedded && (
                      <Badge variant="outline" className="border-cyan-400/40 bg-cyan-400/10 text-cyan-100">
                        Weight Embedded
                      </Badge>
                    )}
                  </div>

                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Product Code:</span>
                      <span className="font-mono text-slate-100">{testResult.productCode}</span>
                    </div>
                    {testResult.weight !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Weight:</span>
                        <span className="flex items-center gap-1 font-mono text-emerald-200">
                          <Weight className="h-4 w-4" />
                          {testResult.weight.toFixed(3)} kg
                        </span>
                      </div>
                    )}
                    {testResult.price !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Price:</span>
                        <span className="flex items-center gap-1 font-mono text-emerald-200">
                          <DollarSign className="h-4 w-4" />
                          ₹{testResult.price.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Save button */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  )
}
