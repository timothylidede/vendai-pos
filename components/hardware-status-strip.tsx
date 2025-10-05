'use client'

import { useMemo } from 'react'
import { ScanBarcode, CreditCard, Archive, RefreshCcw, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useHardware } from '@/contexts/hardware-context'
import { cn } from '@/lib/utils'

interface HardwareStatusStripProps {
  className?: string
}

const statusBadgeClass = (connected: boolean, simulated?: boolean) =>
  cn(
    'border px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors duration-200',
    connected
      ? 'bg-emerald-500/15 border-emerald-400/20 text-emerald-200'
      : 'bg-rose-500/10 border-rose-400/20 text-rose-200',
    simulated ? 'italic opacity-80' : null,
  )

export function HardwareStatusStrip({ className }: HardwareStatusStripProps) {
  const { hardwareAvailable, status, lastScan, refreshing, refreshDevices } = useHardware()

  const { scanners, cashDrawers, cardReaders } = status

  const connectionLabel = hardwareAvailable ? 'Hardware bridge active' : 'Simulated hardware mode'

  const nextRefreshLabel = refreshing ? 'Refreshing…' : 'Refresh'

  const summary = useMemo(
    () => [
      {
        label: 'Scanners',
        devices: scanners,
        icon: ScanBarcode,
      },
      {
        label: 'Cash Drawer',
        devices: cashDrawers,
        icon: Archive,
      },
      {
        label: 'Card Reader',
        devices: cardReaders,
        icon: CreditCard,
      },
    ],
    [scanners, cashDrawers, cardReaders],
  )

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-900/50 p-3 text-xs text-slate-200 shadow-[0_10px_30px_-20px_rgba(13,148,136,0.5)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[0.78rem] font-medium tracking-wide">
          <Radio className={cn('h-3.5 w-3.5', hardwareAvailable ? 'text-emerald-300 animate-pulse' : 'text-amber-300')} />
          <span>{connectionLabel}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[0.7rem] text-slate-200 hover:text-white"
          onClick={() => refreshDevices()}
          disabled={refreshing}
        >
          <RefreshCcw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          {nextRefreshLabel}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        {summary.map(({ label, devices, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-slate-300">
              <Icon className="h-3.5 w-3.5" />
              <span className="font-semibold uppercase tracking-wide text-[0.68rem]">{label}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {devices.length > 0 ? (
                devices.map((device) => (
                  <Badge
                    key={device.id}
                    variant="secondary"
                    className={statusBadgeClass(device.connected, device.simulated)}
                  >
                    {device.label}
                  </Badge>
                ))
              ) : (
                <Badge
                  variant="secondary"
                  className="border border-white/10 bg-slate-800/70 text-slate-300"
                >
                  None detected
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {lastScan ? (
        <div className="flex items-center justify-between gap-3 text-[0.7rem] text-slate-300">
          <span className="truncate">Last scan: <span className="text-slate-100">{lastScan.data}</span></span>
          {lastScan.deviceId && (
            <span className="text-slate-400">from {lastScan.deviceId}</span>
          )}
        </div>
      ) : (
        <div className="text-[0.7rem] text-slate-400">Awaiting first scan…</div>
      )}
    </div>
  )
}
