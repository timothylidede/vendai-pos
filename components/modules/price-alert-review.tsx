'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import type { PriceChangeAlert } from '@/types/price-changes'
import { AlertTriangle, Check, Edit, TrendingDown, TrendingUp, X } from 'lucide-react'

interface PriceAlertReviewProps {
  orgId: string
}

interface AlertSummary {
  total: number
  pending: number
  approved: number
  rejected: number
  adjusted: number
  totalCostIncrease: number
}

const panelShell =
  'rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/70 via-slate-900/45 to-slate-800/40 backdrop-blur-2xl shadow-[0_30px_80px_-35px_rgba(15,23,42,0.9)]'

const statusTone: Record<string, string> = {
  pending: 'border-sky-400/40 bg-sky-400/10 text-sky-100',
  approved: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
  rejected: 'border-rose-400/40 bg-rose-400/10 text-rose-100',
  adjusted: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100',
}

export default function PriceAlertReview({ orgId }: PriceAlertReviewProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [alerts, setAlerts] = useState<PriceChangeAlert[]>([])
  const [summary, setSummary] = useState<AlertSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adjustedPrice, setAdjustedPrice] = useState<string>('')

  useEffect(() => {
    fetchAlerts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, statusFilter])

  async function fetchAlerts() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ orgId })
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const response = await fetch(`/api/supplier/price-alerts?${params}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error('Unable to load alerts')
      }

      setAlerts(data.alerts)
      setSummary(data.summary)
    } catch (error) {
      console.error(error)
      toast({ title: 'Failed to load alerts', description: 'Please retry shortly.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const selectAllPending = () => {
    const pendingIds = alerts
      .filter((alert) => alert.status === 'pending')
      .map((alert) => alert.id!)
      .filter(Boolean)
    setSelectedIds(pendingIds)
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]))
  }

  async function handleBulkAction(action: 'approve' | 'reject') {
    if (selectedIds.length === 0) {
      toast({ title: 'Pick alerts first', description: 'Select at least one alert to continue.' })
      return
    }

    try {
      const response = await fetch('/api/supplier/price-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertIds: selectedIds,
          action,
          userId: user?.uid,
        }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error('Bulk update failed')
      }

      toast({
        title: action === 'approve' ? 'Alerts approved' : 'Alerts rejected',
        description: `${data.processed} item${data.processed === 1 ? '' : 's'} updated`,
      })
      setSelectedIds([])
      await fetchAlerts()
    } catch (error) {
      console.error(error)
      toast({ title: 'Action failed', description: 'Retry the bulk update.', variant: 'destructive' })
    }
  }

  async function handleIndividualAction(alertId: string, action: 'approve' | 'reject' | 'adjust') {
    try {
      const body: Record<string, unknown> = {
        action,
        userId: user?.uid,
      }

      if (action === 'adjust' && adjustedPrice) {
        body.adjustedRetailPrice = parseFloat(adjustedPrice)
      }

      const response = await fetch(`/api/supplier/price-alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error('Action failed')
      }

      toast({
        title:
          action === 'approve'
            ? 'Alert approved'
            : action === 'reject'
            ? 'Alert rejected'
            : 'Retail price updated',
        description:
          action === 'adjust'
            ? 'Margin impact recalculated.'
            : 'Your decision was saved.',
      })

      setEditingId(null)
      setAdjustedPrice('')
      await fetchAlerts()
    } catch (error) {
      console.error(error)
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' })
    }
  }

  const getStatusBadge = (status: string) => (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.28em]',
        statusTone[status] ?? statusTone.pending
      )}
    >
      {status}
    </Badge>
  )

  const getChangeIcon = (percentageIncrease: number) =>
    percentageIncrease > 0 ? (
      <TrendingUp className="h-5 w-5 text-rose-300" />
    ) : (
      <TrendingDown className="h-5 w-5 text-emerald-300" />
    )

  const headerSummary = useMemo(
    () =>
      summary
        ? [
            { label: 'Total', value: summary.total },
            { label: 'Pending', value: summary.pending },
            { label: 'Approved', value: summary.approved },
            { label: 'Rejected', value: summary.rejected },
            {
              label: 'Cost impact',
              value: `₹${summary.totalCostIncrease.toLocaleString()}`,
              hint: 'Awaiting approval',
            },
          ]
        : [],
    [summary]
  )

  return (
    <div className="space-y-8">
      <section className={cn(panelShell, 'relative overflow-hidden px-8 py-10 text-slate-100')}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/15 via-transparent to-cyan-400/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Price Alerts</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Keep margin decisions quick and clean. Review supplier increases, approve what fits, and adjust what needs attention.
            </p>
          </div>
          {summary && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-300">
              <span>{statusFilter === 'all' ? 'All alerts' : `${statusFilter} view`}</span>
              <span className="text-slate-100">{summary.total}</span>
            </div>
          )}
        </div>
      </section>

      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {headerSummary.map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={cn(panelShell, 'p-5 text-slate-100')}
            >
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-400">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold">{card.value}</p>
              {card.hint && <p className="mt-1 text-xs text-slate-400">{card.hint}</p>}
            </motion.div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className={cn(panelShell, 'flex items-center gap-3 px-4 py-3 text-slate-200')}>
          <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Status</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 border-white/10 bg-slate-950/80 text-slate-100">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-slate-950/90 text-slate-100">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="adjusted">Adjusted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {statusFilter === 'pending' && alerts.some((alert) => alert.status === 'pending') && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="rounded-2xl border border-white/10 bg-slate-950/80 text-slate-200 hover:bg-slate-900/70"
              onClick={selectAllPending}
            >
              Select pending
            </Button>
            {selectedIds.length > 0 && (
              <>
                <Button
                  className="rounded-2xl bg-emerald-400/80 px-4 text-slate-950 hover:bg-emerald-300"
                  onClick={() => handleBulkAction('approve')}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve {selectedIds.length}
                </Button>
                <Button
                  className="rounded-2xl bg-rose-500/80 px-4 text-slate-100 hover:bg-rose-500"
                  onClick={() => handleBulkAction('reject')}
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className={cn(panelShell, 'flex items-center justify-center px-8 py-12 text-sm text-slate-300')}>
            Loading alerts…
          </div>
        ) : alerts.length === 0 ? (
          <div className={cn(panelShell, 'flex items-center justify-center px-8 py-12 text-sm text-slate-300')}>
            Nothing to review right now.
          </div>
        ) : (
          alerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className={cn(panelShell, 'p-6 text-slate-200')}
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {alert.status === 'pending' && alert.id && (
                      <Checkbox
                        checked={selectedIds.includes(alert.id)}
                        onCheckedChange={() => toggleSelection(alert.id!)}
                        className="mt-1 h-4 w-4 border-white/30 bg-transparent"
                      />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-50">{alert.productName}</h3>
                      <p className="text-sm text-slate-300">{alert.supplierName}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>Created {new Date(alert.createdAt).toLocaleDateString()}</span>
                        {alert.reviewedAt && <span>Updated {new Date(alert.reviewedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(alert.status)}
                    {getChangeIcon(alert.percentageIncrease)}
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm md:grid-cols-5">
                  <MetricPill label="Old cost" value={`₹${alert.oldCost.toFixed(2)}`} />
                  <MetricPill label="New cost" value={`₹${alert.newCost.toFixed(2)}`} tone="text-rose-300" />
                  <MetricPill
                    label="Change"
                    value={`${alert.percentageIncrease > 0 ? '+' : ''}${alert.percentageIncrease.toFixed(1)}%`}
                    tone={alert.percentageIncrease > 0 ? 'text-rose-300' : 'text-emerald-300'}
                  />
                  <MetricPill label="Retail" value={`₹${alert.currentRetailPrice?.toFixed(2) ?? '—'}`} />
                  <MetricPill
                    label="Margin"
                    value={alert.newMargin ? `${alert.newMargin.toFixed(1)}%` : '—'}
                    hint={alert.currentMargin ? `→ ${alert.currentMargin.toFixed(1)}%` : undefined}
                    tone={alert.newMargin !== undefined && alert.newMargin < 15 ? 'text-amber-300' : 'text-emerald-200'}
                  />
                </div>

                {alert.newMargin !== undefined && alert.newMargin < 15 && alert.status === 'pending' && (
                  <div className="flex items-center gap-2 rounded-2xl border border-amber-200/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    <AlertTriangle className="h-4 w-4" /> Margin dips below 15%. Adjust before release.
                  </div>
                )}

                {editingId === alert.id ? (
                  <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="min-w-[160px] flex-1">
                      <label className="text-[11px] uppercase tracking-[0.32em] text-slate-400">New retail</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={adjustedPrice}
                        onChange={(event) => setAdjustedPrice(event.target.value)}
                        className="mt-1 border-white/10 bg-slate-950/80 text-slate-100"
                        placeholder="Retail price"
                      />
                    </div>
                    {adjustedPrice && (
                      <span className="text-sm text-slate-300">
                        Margin →
                        {(((parseFloat(adjustedPrice) - alert.newCost) / parseFloat(adjustedPrice || '1')) * 100).toFixed(1)}%
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="rounded-2xl bg-sky-500/80 text-slate-950 hover:bg-sky-400"
                        onClick={() => handleIndividualAction(alert.id!, 'adjust')}
                        disabled={!adjustedPrice || parseFloat(adjustedPrice) <= alert.newCost}
                      >
                        <Edit className="mr-2 h-4 w-4" /> Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-2xl border border-white/10 text-slate-200"
                        onClick={() => {
                          setEditingId(null)
                          setAdjustedPrice('')
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {alert.status === 'pending' && alert.id && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="rounded-2xl bg-emerald-400/80 text-slate-950 hover:bg-emerald-300"
                      onClick={() => handleIndividualAction(alert.id!, 'approve')}
                    >
                      <Check className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-2xl bg-rose-500/80 text-slate-100 hover:bg-rose-500"
                      onClick={() => handleIndividualAction(alert.id!, 'reject')}
                    >
                      <X className="mr-2 h-4 w-4" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-2xl border border-white/10 text-slate-200"
                      onClick={() => {
                        setEditingId(alert.id!)
                        setAdjustedPrice(
                          alert.currentRetailPrice
                            ? (alert.currentRetailPrice * 1.05).toFixed(2)
                            : ''
                        )
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" /> Adjust
                    </Button>
                  </div>
                )}

                {alert.notes && (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                    {alert.notes}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

interface MetricPillProps {
  label: string
  value: string
  tone?: string
  hint?: string
}

function MetricPill({ label, value, tone, hint }: MetricPillProps) {
  return (
    <span className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</span>
      <span className={cn('text-base font-medium text-slate-100', tone)}>{value}</span>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </span>
  )
}
