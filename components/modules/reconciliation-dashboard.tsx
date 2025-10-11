/**
 * Reconciliation Dashboard — glassmorphic refresh
 */

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Equal,
  FileText,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import type { DeliveryReconciliation, ReconciliationSummary } from '@/types/reconciliation'
import { cn } from '@/lib/utils'

interface ReconciliationDashboardProps {
  orgId: string
}

const panelShell =
  'rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/70 via-slate-900/45 to-slate-800/40 backdrop-blur-2xl shadow-[0_30px_80px_-35px_rgba(15,23,42,0.9)] text-slate-100'

const statusTone: Record<DeliveryReconciliation['status'], string> = {
  pending_review: 'border-sky-400/40 bg-sky-400/10 text-sky-100',
  approved: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
  disputed: 'border-rose-400/40 bg-rose-400/10 text-rose-100',
  resolved: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100',
}

const matchTone: Record<DeliveryReconciliation['matchStatus'], string> = {
  perfect_match: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
  minor_variance: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  significant_variance: 'border-orange-400/40 bg-orange-400/10 text-orange-100',
  major_discrepancy: 'border-rose-400/40 bg-rose-400/10 text-rose-100',
}

const matchIcon: Record<DeliveryReconciliation['matchStatus'], React.ReactNode> = {
  perfect_match: <CheckCircle2 className="h-4 w-4" />,
  minor_variance: <AlertCircle className="h-4 w-4" />,
  significant_variance: <AlertCircle className="h-4 w-4" />,
  major_discrepancy: <XCircle className="h-4 w-4" />,
}

export default function ReconciliationDashboard({ orgId }: ReconciliationDashboardProps) {
  const { toast } = useToast()
  const [reconciliations, setReconciliations] = useState<DeliveryReconciliation[]>([])
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [matchStatusFilter, setMatchStatusFilter] = useState<string>('all')
  const [actionNotes, setActionNotes] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedReconciliation, setSelectedReconciliation] = useState<string | null>(null)

  useEffect(() => {
    loadReconciliations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, statusFilter, matchStatusFilter])

  async function loadReconciliations() {
    try {
      setLoading(true)
      const params = new URLSearchParams({ orgId })
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (matchStatusFilter !== 'all') params.append('matchStatus', matchStatusFilter)

      const response = await fetch(`/api/supplier/reconciliations?${params}`)
      if (!response.ok) {
        throw new Error('Unable to retrieve reconciliations')
      }

      const data = await response.json()
      setReconciliations(data.reconciliations)
      setSummary(data.summary)
    } catch (error) {
      console.error(error)
      toast({ title: 'Failed to load reconciliations', description: 'Please retry shortly.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(reconciliationId: string, action: 'approve' | 'dispute' | 'resolve') {
    try {
      setActionLoading(reconciliationId)
      const response = await fetch(`/api/supplier/reconciliations/${reconciliationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notes: actionNotes || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Action failed')
      }

      toast({
        title:
          action === 'approve'
            ? 'Reconciliation approved'
            : action === 'dispute'
            ? 'Reconciliation disputed'
            : 'Reconciliation resolved',
        description: 'Dashboard refreshed.',
      })

      setActionNotes('')
      setSelectedReconciliation(null)
      await loadReconciliations()
    } catch (error) {
      console.error(error)
      toast({ title: 'Something went wrong', description: 'Try again in a moment.', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const summaryMetrics = useMemo(() => {
    if (!summary) return []
    return [
      {
        label: 'Total reconciliations',
        value: summary.total,
        icon: <FileText className="h-6 w-6 text-slate-200" />,
      },
      {
        label: 'Pending review',
        value: summary.pendingReview,
        icon: <Clock className="h-6 w-6 text-sky-200" />,
      },
      {
        label: 'Discrepancy total',
        value: `₹${summary.totalDiscrepancyAmount.toLocaleString()}`,
        icon: <TrendingUp className="h-6 w-6 text-rose-200" />,
      },
      {
        label: 'Perfect matches',
        value: summary.perfectMatches,
        icon: <CheckCircle2 className="h-6 w-6 text-emerald-200" />,
      },
    ]
  }, [summary])

  if (loading) {
    return (
      <div className={cn(panelShell, 'flex h-64 items-center justify-center text-sm text-slate-300')}>
        Syncing reconciliation data…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className={cn(panelShell, 'relative overflow-hidden px-8 py-10')}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-400/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-50">Reconciliation</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Compare purchase orders, deliveries, and invoices side-by-side. Spot variances instantly, resolve issues, and keep the ledger clean.
            </p>
          </div>
          {summary && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-300">
              <span>{statusFilter === 'all' ? 'All statuses' : statusFilter.replace('_', ' ')}</span>
              <span className="text-slate-100">{summary.total}</span>
            </div>
          )}
        </div>
      </section>

      {summary && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryMetrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(panelShell, 'flex items-center justify-between p-6')}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-slate-400">{metric.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">{metric.value}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">{metric.icon}</div>
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
              <SelectItem value="pending_review">Pending review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className={cn(panelShell, 'flex items-center gap-3 px-4 py-3 text-slate-200')}>
          <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Match</span>
          <Select value={matchStatusFilter} onValueChange={setMatchStatusFilter}>
            <SelectTrigger className="w-44 border-white/10 bg-slate-950/80 text-slate-100">
              <SelectValue placeholder="Match" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-slate-950/90 text-slate-100">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="perfect_match">Perfect match</SelectItem>
              <SelectItem value="minor_variance">Minor variance</SelectItem>
              <SelectItem value="significant_variance">Significant variance</SelectItem>
              <SelectItem value="major_discrepancy">Major discrepancy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {reconciliations.length === 0 ? (
          <div className={cn(panelShell, 'flex items-center justify-center px-8 py-12 text-sm text-slate-300')}>
            No reconciliations match the current filters.
          </div>
        ) : (
          reconciliations.map((recon, index) => (
            <motion.div
              key={recon.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={cn(panelShell, 'p-6')}
            >
              <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3 text-slate-200">
                    <h3 className="text-lg font-semibold text-slate-50">PO {recon.poNumber || recon.purchaseOrderId}</h3>
                    <Badge
                      variant="outline"
                      className={cn('rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.3em]', statusTone[recon.status])}
                    >
                      {recon.status.replace('_', ' ')}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.3em]', matchTone[recon.matchStatus])}
                    >
                      {matchIcon[recon.matchStatus]}
                      {recon.matchStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>Invoice {recon.invoiceNumber || 'n/a'}</span>
                    <span>Supplier {recon.supplierName}</span>
                    <span>Delivered {new Date(recon.deliveredAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Discrepancy</p>
                  <p
                    className={cn(
                      'text-3xl font-semibold',
                      recon.totalDiscrepancyAmount > 0 ? 'text-rose-200' : 'text-emerald-200'
                    )}
                  >
                    ₹{recon.totalDiscrepancyAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">{recon.discrepancyPercentage.toFixed(2)}%</p>
                </div>
              </header>

              <section className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 md:grid-cols-3">
                <SummaryTile label="PO total" value={`₹${recon.poTotal.toLocaleString()}`} icon={<TrendingUp className="h-5 w-5 text-slate-200" />} />
                <SummaryTile label="Delivered" value={`₹${recon.deliveredTotal.toLocaleString()}`} icon={<Equal className="h-5 w-5 text-slate-200" />} />
                <SummaryTile label="Invoice" value={`₹${(recon.invoiceTotal || 0).toLocaleString()}`} icon={<TrendingDown className="h-5 w-5 text-slate-200" />} />
              </section>

              {recon.lineItems.some((line) => line.hasDiscrepancy) && (
                <section className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-slate-200">Items with variance</p>
                  {recon.lineItems
                    .filter((line) => line.hasDiscrepancy)
                    .map((line, idx) => (
                      <div
                        key={`${line.productId}-${idx}`}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200/30 bg-amber-500/10 p-4 text-sm text-amber-100"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-slate-50">{line.productName}</p>
                          {line.notes && <p className="text-xs text-amber-100/80">{line.notes}</p>}
                        </div>
                        <div className="flex gap-6 text-xs">
                          <QuantityColumn label="Ordered" value={line.poQuantity} />
                          <QuantityColumn label="Delivered" value={line.deliveredQuantity} />
                          <QuantityColumn label="Invoiced" value={line.invoiceQuantity ?? 0} />
                        </div>
                      </div>
                    ))}
                </section>
              )}

              {recon.flags.length > 0 && (
                <section className="mt-4 flex flex-wrap gap-2">
                  {recon.flags.map((flag) => (
                    <Badge
                      key={`${flag.type}-${flag.description}`}
                      variant="outline"
                      className={cn(
                        'rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.3em]',
                        flag.severity === 'critical'
                          ? 'border-rose-400/40 bg-rose-400/10 text-rose-100'
                          : flag.severity === 'high'
                          ? 'border-orange-400/40 bg-orange-400/10 text-orange-100'
                          : flag.severity === 'medium'
                          ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                          : 'border-sky-400/40 bg-sky-400/10 text-sky-100'
                      )}
                    >
                      {flag.type.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </section>
              )}

              {recon.invoiceAttachments.length > 0 && (
                <section className="mt-4 flex flex-wrap gap-2">
                  {recon.invoiceAttachments.map((attachment) => (
                    <Button
                      key={attachment.id}
                      asChild
                      variant="ghost"
                      className="rounded-2xl border border-white/10 bg-slate-900/60 text-slate-100 hover:bg-slate-800/60"
                    >
                      <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                        <FileText className="h-4 w-4" /> {attachment.fileName}
                      </a>
                    </Button>
                  ))}
                </section>
              )}

              {recon.status === 'pending_review' && (
                <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  {selectedReconciliation === recon.id ? (
                    <div className="space-y-4">
                      <Textarea
                        value={actionNotes}
                        onChange={(event) => setActionNotes(event.target.value)}
                        placeholder="Add quick context (required for disputes)."
                        className="min-h-[120px] border-white/10 bg-slate-950/80 text-slate-100 placeholder:text-slate-500"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="rounded-2xl bg-emerald-400/80 text-slate-950 hover:bg-emerald-300"
                          onClick={() => handleAction(recon.id!, 'approve')}
                          disabled={actionLoading === recon.id}
                        >
                          {actionLoading === recon.id ? 'Saving…' : 'Approve'}
                        </Button>
                        <Button
                          className="rounded-2xl bg-rose-500/80 text-slate-100 hover:bg-rose-500"
                          onClick={() => handleAction(recon.id!, 'dispute')}
                          disabled={actionLoading === recon.id || actionNotes.trim().length === 0}
                        >
                          Dispute
                        </Button>
                        <Button
                          variant="ghost"
                          className="rounded-2xl border border-white/10 text-slate-200"
                          onClick={() => {
                            setSelectedReconciliation(null)
                            setActionNotes('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="rounded-2xl bg-sky-500/80 text-slate-950 hover:bg-sky-400"
                      onClick={() => {
                        setSelectedReconciliation(recon.id!)
                        setActionNotes('')
                      }}
                    >
                      Review & decide
                    </Button>
                  )}
                </section>
              )}

              {(recon.approvalNotes || recon.disputeReason || recon.resolutionNotes) && (
                <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                  <p>{recon.approvalNotes || recon.disputeReason || recon.resolutionNotes}</p>
                  {recon.reviewedBy && (
                    <p className="mt-2 text-xs text-slate-500">
                      Reviewed by {recon.reviewedBy}
                      {recon.reviewedAt ? ` · ${new Date(recon.reviewedAt).toLocaleDateString()}` : ''}
                    </p>
                  )}
                </section>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

interface SummaryTileProps {
  label: string
  value: string
  icon: React.ReactNode
}

function SummaryTile({ label, value, icon }: SummaryTileProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-200">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
        <p className="mt-2 text-xl font-semibold text-slate-50">{value}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2">{icon}</div>
    </div>
  )
}

interface QuantityColumnProps {
  label: string
  value: number
}

function QuantityColumn({ label, value }: QuantityColumnProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] uppercase tracking-[0.3em] text-amber-100/80">{label}</span>
      <span className="text-base font-semibold">{value}</span>
    </div>
  )
}
