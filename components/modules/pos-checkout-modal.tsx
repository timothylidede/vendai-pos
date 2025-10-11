"use client"

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { POSPayment, POSPaymentMethod, POSPaymentStatus, POSCheckoutContext, POSOrderStatus } from '@/types/pos'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, BadgeCheck, Banknote, Check, CreditCard, Layers, Smartphone, User, UserPlus, AlertTriangle } from 'lucide-react'

export interface CheckoutCartLine {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
  image?: string
}

export interface CheckoutResult {
  payments: POSPayment[]
  checkoutContext: POSCheckoutContext
  status: POSOrderStatus
  balanceDue: number
  notes?: string
  customerType: 'guest' | 'identified'
}

interface TenderDraft {
  id: string
  method: POSPaymentMethod
  amount: number
  tenderedAmount: number
  referenceId?: string
  phone?: string
  note?: string
  status: POSPaymentStatus
}

interface CustomerDraft {
  type: 'guest' | 'identified'
  name?: string
  phone?: string
  email?: string
  loyaltyId?: string
}

interface POSCheckoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lines: CheckoutCartLine[]
  total: number
  registerId: string
  submitting?: boolean
  onSubmit: (result: CheckoutResult) => Promise<void>
}

const PAYMENT_METHOD_LABELS: Record<POSPaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank Transfer',
  voucher: 'Voucher',
  store_credit: 'Store Credit',
  mixed: 'Mixed Tender',
  other: 'Other',
}

type PaymentIcon = React.ComponentType<{ className?: string }>

const PAYMENT_ICONS: Record<POSPaymentMethod, PaymentIcon> = {
  cash: Banknote,
  card: CreditCard,
  mobile_money: Smartphone,
  bank_transfer: Layers,
  voucher: BadgeCheck,
  store_credit: WalletIcon,
  mixed: Layers,
  other: Layers,
}

function WalletIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7.5C3 6.11929 4.11929 5 5.5 5H18.5C19.8807 5 21 6.11929 21 7.5V9.5C21 10.8807 19.8807 12 18.5 12H5.5C4.11929 12 3 10.8807 3 9.5V7.5Z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 9.5V16.5C3 17.8807 4.11929 19 5.5 19H18.5C19.8807 19 21 17.8807 21 16.5V14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M16.75 8.75H17.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
}

const DEFAULT_STATUS: POSPaymentStatus = 'completed'

const STEP_TITLES = ['Select payment & customer', 'Capture payments', 'Review & confirm']

export function POSCheckoutModal({
  open,
  onOpenChange,
  lines,
  total,
  registerId,
  submitting,
  onSubmit,
}: POSCheckoutModalProps) {
  const [step, setStep] = useState(0)
  const [customer, setCustomer] = useState<CustomerDraft>({ type: 'guest' })
  const [primaryMethod, setPrimaryMethod] = useState<POSPaymentMethod>('cash')
  const [tenders, setTenders] = useState<TenderDraft[]>([])
  const [notes, setNotes] = useState('')
  const [localSubmitting, setLocalSubmitting] = useState(false)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [insufficientAcknowledged, setInsufficientAcknowledged] = useState(false)

  useEffect(() => {
    if (open) {
      setStep(0)
      setCustomer({ type: 'guest' })
      setPrimaryMethod('cash')
      setTenders([
        {
          id: generateId(),
          method: 'cash',
          amount: total,
          tenderedAmount: total,
          status: DEFAULT_STATUS,
        },
      ])
      setNotes('')
      setValidationMessage(null)
      setInsufficientAcknowledged(false)
    }
  }, [open, total])

  const totalApplied = useMemo(
    () => tenders.reduce((sum, tender) => sum + (isFinite(tender.amount) ? tender.amount : 0), 0),
    [tenders],
  )

  const totalTendered = useMemo(
    () => tenders.reduce((sum, tender) => sum + (isFinite(tender.tenderedAmount) ? tender.tenderedAmount : 0), 0),
    [tenders],
  )

  const changeDue = useMemo(() => Math.max(0, totalTendered - total), [totalTendered, total])
  const balanceDue = useMemo(() => Math.max(0, total - totalApplied), [total, totalApplied])
  const status: POSOrderStatus = balanceDue > 0.01 ? 'awaiting_payment' : 'paid'

  useEffect(() => {
    if (totalApplied >= total) {
      setInsufficientAcknowledged(false)
    }
  }, [totalApplied, total])

  useEffect(() => {
    if (!open) {
      return
    }

    if (step === 1) {
      if (primaryMethod !== 'mixed' && tenders.length !== 1) {
        setTenders((prev) => {
          if (prev[0]) {
            return [{ ...prev[0], method: primaryMethod }]
          }
          return [createTender(primaryMethod, total)]
        })
      }

      if (primaryMethod === 'mixed' && tenders.length === 1) {
        setTenders((prev) => [prev[0], createTender('cash', Math.max(0, total - (prev[0]?.amount || 0)))])
      }
    }
  }, [open, step, primaryMethod, total, tenders.length])

  const handleNext = () => {
    setValidationMessage(null)
    if (step === 0) {
      if (!primaryMethod) {
        setValidationMessage('Please choose a payment method to continue.')
        return
      }

      if (customer.type === 'identified' && !(customer.name || customer.phone || customer.email)) {
        setValidationMessage('Add at least one customer detail (name, phone, or email).')
        return
      }
    }

    if (step === 1) {
      if (totalApplied <= 0) {
        setValidationMessage('Enter at least one payment amount to proceed.')
        return
      }

      if (totalApplied < total) {
        if (!insufficientAcknowledged) {
          setValidationMessage('Payments do not cover the total. Click next again to record the remaining balance.')
          setInsufficientAcknowledged(true)
          return
        }
      }
    }

    setStep((prev) => Math.min(prev + 1, STEP_TITLES.length - 1))
  }

  const handleBack = () => {
    setValidationMessage(null)
    setStep((prev) => Math.max(prev - 1, 0))
  }

  const handleSubmit = async () => {
    setValidationMessage(null)

    if (balanceDue > 0 && totalApplied < total && !insufficientAcknowledged) {
      setValidationMessage('Outstanding balance will remain due. Click complete again to confirm.')
      setInsufficientAcknowledged(true)
      return
    }

    const nowIso = new Date().toISOString()
    const payments: POSPayment[] = tenders.map((tender) => ({
      id: tender.id,
      method: tender.method,
      amount: Number(tender.amount.toFixed(2)),
      tenderedAmount: Number(tender.tenderedAmount.toFixed(2)),
      changeGiven: Math.max(0, tender.tenderedAmount - tender.amount),
      receivedAt: nowIso,
      status: tender.status,
      referenceId: tender.referenceId?.trim() || undefined,
      metadata: tender.phone ? { phone: tender.phone } : undefined,
      note: tender.note?.trim() || undefined,
    }))

    const checkoutContext: POSCheckoutContext = {
      channel: 'pos_web',
      registerId,
      subtotal: total,
      grandTotal: total,
      payments,
      changeDue: Number(changeDue.toFixed(2)),
      notes: notes.trim() || undefined,
      customer:
        customer.type === 'identified'
          ? {
              id: customer.loyaltyId?.trim() || undefined,
              name: customer.name?.trim() || undefined,
              phone: customer.phone?.trim() || undefined,
              email: customer.email?.trim() || undefined,
            }
          : undefined,
      metadata: {
        draftStatus: status,
        totalApplied,
        totalTendered,
      },
    }

    try {
      setLocalSubmitting(true)
      await onSubmit({
        payments,
        checkoutContext,
        status,
        balanceDue,
        notes: notes.trim() || undefined,
        customerType: customer.type,
      })
      onOpenChange(false)
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : 'Unable to complete checkout.')
    } finally {
      setLocalSubmitting(false)
    }
  }

  const disableNext = step === 1 && (totalApplied <= 0 || (totalApplied < total && !insufficientAcknowledged))
  const disableSubmit = localSubmitting || submitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-5xl translate-x-[-50%] translate-y-[-50%] gap-0 border border-white/10 bg-slate-900/95 p-0 shadow-[0_32px_64px_-24px_rgba(12,74,110,0.4)] backdrop-blur-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-2xl max-h-[90vh] overflow-hidden" showCloseButton>
        <DialogHeader className="px-8 pt-6 pb-4 border-b border-white/5">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-emerald-200">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 text-base">
              {step + 1}
            </span>
            {STEP_TITLES[step]}
          </DialogTitle>
          <DialogDescription className="text-slate-400 mt-2">
            Guide the customer through a polished checkout flow.
          </DialogDescription>
        </DialogHeader>

        <div className="flex h-full flex-col gap-8 overflow-y-auto px-8 py-6">
          <StepIndicators current={step} />

          {validationMessage && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-100">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm">{validationMessage}</p>
            </div>
          )}

          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6"
            >
              {step === 0 && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <MethodSelector
                    primaryMethod={primaryMethod}
                    onChange={(method) => {
                      setPrimaryMethod(method)
                      setTenders((prev) => {
                        const amount = method === 'mixed' ? Math.min(total, prev[0]?.amount ?? total) : total
                        return [
                          {
                            ...(prev[0] ?? createTender(method, amount)),
                            method: method === 'mixed' ? 'cash' : method,
                            amount,
                            tenderedAmount: amount,
                          },
                        ]
                      })
                    }}
                  />

                  <CustomerCapture customer={customer} onChange={setCustomer} />
                </div>
              )}

              {step === 1 && (
                <TenderForm
                  primaryMethod={primaryMethod}
                  tenders={tenders}
                  total={total}
                  onChange={setTenders}
                />
              )}

              {step === 2 && (
                <SummaryView
                  lines={lines}
                  total={total}
                  tenders={tenders}
                  customer={customer}
                  notes={notes}
                  onNotesChange={setNotes}
                  changeDue={changeDue}
                  balanceDue={balanceDue}
                  status={status}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 px-8 py-5 bg-slate-900/50">
          <div className="text-base text-slate-300">
            Total due: <span className="font-semibold text-emerald-300 text-lg ml-2">KSh {total.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-4">
            {step > 0 ? (
              <Button variant="ghost" onClick={handleBack} className="text-slate-300 hover:text-white h-11 px-6">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-300 hover:text-white h-11 px-6">
                Cancel
              </Button>
            )}
            {step < STEP_TITLES.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={disableNext}
                className="flex items-center gap-2 rounded-full bg-emerald-500/80 px-7 h-11 text-white shadow-[0_12px_28px_-18px_rgba(5,150,105,0.6)] transition hover:bg-emerald-500"
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={disableSubmit}
                className="flex items-center gap-2 rounded-full bg-emerald-500/90 px-7 h-11 text-white shadow-[0_14px_32px_-18px_rgba(4,120,87,0.6)] transition hover:bg-emerald-500"
              >
                {disableSubmit ? 'Completing...' : 'Complete Sale'} <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StepIndicators({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-emerald-300/70">
      {STEP_TITLES.map((title, index) => (
        <div key={title} className="flex items-center">
          <div
            className={cn(
              'h-2.5 w-2.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 backdrop-blur',
              index <= current ? 'bg-emerald-400/70' : 'opacity-50',
            )}
          />
          <span className={cn('ml-2 hidden text-xs font-medium text-slate-400 sm:inline', index === current && 'text-emerald-200')}>
            {title}
          </span>
          {index < STEP_TITLES.length - 1 && <span className="mx-3 h-px w-14 bg-gradient-to-r from-emerald-400/20 via-transparent to-emerald-400/20" />}
        </div>
      ))}
    </div>
  )
}

function MethodSelector({ primaryMethod, onChange }: { primaryMethod: POSPaymentMethod; onChange: (method: POSPaymentMethod) => void }) {
  const methods: POSPaymentMethod[] = ['cash', 'card', 'mobile_money', 'mixed', 'voucher', 'store_credit', 'bank_transfer', 'other']

  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-6 shadow-[0_18px_48px_-26px_rgba(15,118,110,0.42)]">
      <h3 className="text-base font-semibold text-slate-200">Payment method</h3>
      <p className="mt-2 text-sm text-slate-400">Choose how the customer is paying. Mixed tender lets you combine multiple methods.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {methods.map((method) => {
          const Icon = PAYMENT_ICONS[method]
          const active = primaryMethod === method
          return (
            <button
              key={method}
              type="button"
              onClick={() => onChange(method)}
              className={cn(
                'group relative flex items-center gap-4 rounded-xl border border-white/6 bg-slate-900/55 px-5 py-4 text-left transition-all duration-200 hover:border-emerald-400/40 hover:bg-emerald-500/10',
                active && 'border-emerald-400/50 bg-emerald-500/12 shadow-[0_16px_36px_-24px_rgba(16,185,129,0.5)]',
              )}
            >
              <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl border border-white/6 bg-slate-800/60 text-emerald-200', active && 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100')}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-200">{PAYMENT_METHOD_LABELS[method]}</div>
                <p className="text-xs text-slate-400 mt-1">
                  {method === 'mixed'
                    ? 'Split across cash, card and more.'
                    : method === 'cash'
                    ? 'Fast drawer checkout.'
                    : method === 'mobile_money'
                    ? 'Collect via STK push or wallet transfer.'
                    : method === 'card'
                    ? 'Swipe, chip or tap.'
                    : 'Capture alternative tender.'}
                </p>
              </div>
              <span
                className={cn(
                  'absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full border border-emerald-400/40 bg-emerald-500/10 p-1 text-emerald-200 shadow-sm md:inline-flex',
                  active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <Check className="h-3 w-3" />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CustomerCapture({ customer, onChange }: { customer: CustomerDraft; onChange: (draft: CustomerDraft) => void }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-5 shadow-[0_18px_48px_-26px_rgba(15,118,110,0.42)]">
      <h3 className="text-sm font-semibold text-slate-200">Customer</h3>
      <p className="mt-1 text-xs text-slate-400">Record who you’re selling to for receipts and loyalty.</p>

      <RadioGroup
        value={customer.type}
        onValueChange={(value) => onChange({ ...customer, type: value as CustomerDraft['type'] })}
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        <label
          className={cn(
            'group flex cursor-pointer items-center gap-3 rounded-xl border border-white/6 bg-slate-900/55 px-4 py-3 transition-all hover:border-emerald-400/30 hover:bg-emerald-500/10',
            customer.type === 'guest' && 'border-emerald-400/40 bg-emerald-500/12 shadow-[0_16px_36px_-24px_rgba(16,185,129,0.5)]',
          )}
        >
          <RadioGroupItem value="guest" className="sr-only" />
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-slate-800/60 text-emerald-200">
            <User className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-200">Guest checkout</div>
            <p className="text-xs text-slate-400">No customer details required.</p>
          </div>
          {customer.type === 'guest' && <Check className="ml-auto h-4 w-4 text-emerald-300" />}
        </label>
        <label
          className={cn(
            'group flex cursor-pointer items-center gap-3 rounded-xl border border-white/6 bg-slate-900/55 px-4 py-3 transition-all hover:border-emerald-400/30 hover:bg-emerald-500/10',
            customer.type === 'identified' && 'border-emerald-400/40 bg-emerald-500/12 shadow-[0_16px_36px_-24px_rgba(16,185,129,0.5)]',
          )}
        >
          <RadioGroupItem value="identified" className="sr-only" />
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-slate-800/60 text-emerald-200">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-200">Identify customer</div>
            <p className="text-xs text-slate-400">Capture loyalty or contact details.</p>
          </div>
          {customer.type === 'identified' && <Check className="ml-auto h-4 w-4 text-emerald-300" />}
        </label>
      </RadioGroup>

      {customer.type === 'identified' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-slate-400">Name</Label>
            <Input
              placeholder="Customer name"
              value={customer.name ?? ''}
              onChange={(event) => onChange({ ...customer, name: event.target.value })}
              className="mt-1 border-white/10 bg-slate-900/70 text-sm text-slate-100"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Phone</Label>
            <Input
              placeholder="e.g. 07xx..."
              value={customer.phone ?? ''}
              onChange={(event) => onChange({ ...customer, phone: event.target.value })}
              className="mt-1 border-white/10 bg-slate-900/70 text-sm text-slate-100"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Email</Label>
            <Input
              placeholder="customer@email.com"
              value={customer.email ?? ''}
              onChange={(event) => onChange({ ...customer, email: event.target.value })}
              className="mt-1 border-white/10 bg-slate-900/70 text-sm text-slate-100"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Loyalty ID (optional)</Label>
            <Input
              placeholder="Card or loyalty number"
              value={customer.loyaltyId ?? ''}
              onChange={(event) => onChange({ ...customer, loyaltyId: event.target.value })}
              className="mt-1 border-white/10 bg-slate-900/70 text-sm text-slate-100"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function TenderForm({
  primaryMethod,
  tenders,
  total,
  onChange,
}: {
  primaryMethod: POSPaymentMethod
  tenders: TenderDraft[]
  total: number
  onChange: (tenders: TenderDraft[]) => void
}) {
  const handleTenderChange = (index: number, patch: Partial<TenderDraft>) => {
    onChange(
      tenders.map((tender, tenderIndex) =>
        tenderIndex === index
          ? {
              ...tender,
              ...patch,
              amount: patch.amount !== undefined ? Number(patch.amount) : tender.amount,
              tenderedAmount:
                patch.tenderedAmount !== undefined ? Number(patch.tenderedAmount) : tender.tenderedAmount,
            }
          : tender,
      ),
    )
  }

  const addSplitTender = () => {
    onChange([...tenders, createTender('cash', 0)])
  }

  const removeTender = (index: number) => {
    if (tenders.length === 1) return
    onChange(tenders.filter((_, tenderIndex) => tenderIndex !== index))
  }

  const methodOptions: POSPaymentMethod[] = ['cash', 'card', 'mobile_money', 'voucher', 'store_credit', 'bank_transfer', 'other']

  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-5 shadow-[0_18px_48px_-26px_rgba(15,118,110,0.42)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Tender breakdown</h3>
          <p className="text-xs text-slate-400">Capture each payment leg. Change is calculated automatically.</p>
        </div>
        {primaryMethod === 'mixed' && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addSplitTender}
            className="rounded-full border border-emerald-300/30 bg-emerald-500/10 text-xs text-emerald-200 hover:bg-emerald-500/20"
          >
            Add tender
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {tenders.map((tender, index) => (
          <div
            key={tender.id}
            className="rounded-xl border border-white/6 bg-slate-900/55 p-4 shadow-[0_14px_36px_-28px_rgba(14,116,144,0.45)]"
          >
            <div className="grid gap-3 sm:grid-cols-5">
              {primaryMethod === 'mixed' && (
                <div className="sm:col-span-1">
                  <Label className="text-xs text-slate-400">Method</Label>
                  <Select
                    value={tender.method}
                    onValueChange={(value) => handleTenderChange(index, { method: value as POSPaymentMethod })}
                  >
                    <SelectTrigger className="mt-1 border-white/10 bg-slate-900/70 text-sm text-slate-100">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900/95 text-slate-100">
                      {methodOptions.map((method) => (
                        <SelectItem key={method} value={method} className="text-sm">
                          {PAYMENT_METHOD_LABELS[method]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="sm:col-span-2">
                <Label className="text-xs text-slate-400">Amount applied (KSh)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={tender.amount || ''}
                  onChange={(event) => handleTenderChange(index, { amount: parseFloat(event.target.value) || 0 })}
                  className="mt-1 border-white/10 bg-slate-900/70 text-sm text-slate-100"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-slate-400">Amount received (KSh)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={tender.tenderedAmount || ''}
                  onChange={(event) => handleTenderChange(index, { tenderedAmount: parseFloat(event.target.value) || 0 })}
                  className="mt-1 border-white/10 bg-slate-900/70 text-sm text-slate-100"
                />
              </div>

              {(tender.method === 'card' || tender.method === 'mobile_money' || tender.method === 'other' || tender.method === 'bank_transfer') && (
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-400">Reference</Label>
                  <Input
                    placeholder="Auth/reference code"
                    value={tender.referenceId ?? ''}
                    onChange={(event) => handleTenderChange(index, { referenceId: event.target.value })}
                    className="mt-1 border-white/10 bg-slate-900/70 text-sm text-slate-100"
                  />
                </div>
              )}

              {tender.method === 'mobile_money' && (
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-400">Customer phone</Label>
                  <Input
                    placeholder="e.g. 07xx..."
                    value={tender.phone ?? ''}
                    onChange={(event) => handleTenderChange(index, { phone: event.target.value })}
                    className="mt-1 border-white/10 bg-slate-900/70 text-sm text-slate-100"
                  />
                </div>
              )}

              <div className="sm:col-span-5">
                <Label className="text-xs text-slate-400">Internal note (optional)</Label>
                <Input
                  placeholder="e.g. Drawer 2, manual approval"
                  value={tender.note ?? ''}
                  onChange={(event) => handleTenderChange(index, { note: event.target.value })}
                  className="mt-1 border-white/10 bg-slate-900/70 text-sm text-slate-100"
                />
              </div>
            </div>

            {primaryMethod === 'mixed' && tenders.length > 1 && (
              <div className="mt-3 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTender(index)}
                  className="text-xs text-slate-400 hover:text-red-300"
                >
                  Remove tender
                </Button>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between rounded-lg border border-white/5 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
              <span>
                Change from this tender: <strong className="text-emerald-200">KSh {(Math.max(0, tender.tenderedAmount - tender.amount)).toFixed(2)}</strong>
              </span>
              <span className="text-slate-400">Applied</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm">
        <span>Total applied: <strong className="text-emerald-200">KSh {computeTotalApplied(tenders).toFixed(2)}</strong></span>
        <span>Total received: <strong className="text-emerald-200">KSh {computeTotalTendered(tenders).toFixed(2)}</strong></span>
        <span>Change due: <strong className="text-emerald-200">KSh {Math.max(0, computeTotalTendered(tenders) - total).toFixed(2)}</strong></span>
      </div>
    </div>
  )
}

function SummaryView({
  lines,
  total,
  tenders,
  customer,
  notes,
  onNotesChange,
  changeDue,
  balanceDue,
  status,
}: {
  lines: CheckoutCartLine[]
  total: number
  tenders: TenderDraft[]
  customer: CustomerDraft
  notes: string
  onNotesChange: (value: string) => void
  changeDue: number
  balanceDue: number
  status: POSOrderStatus
}) {
  return (
    <div className="grid gap-5 md:grid-cols-[1.2fr,0.8fr]">
      <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-5 shadow-[0_18px_48px_-26px_rgba(15,118,110,0.42)]">
        <h3 className="text-sm font-semibold text-slate-200">Sale summary</h3>
        <div className="mt-4 space-y-3">
          {lines.map((line) => (
            <div key={line.productId} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/55 px-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-100">{line.name}</div>
                <div className="text-xs text-slate-400">{line.quantity} × KSh {line.unitPrice.toFixed(2)}</div>
              </div>
              <div className="text-sm font-semibold text-emerald-200">KSh {line.lineTotal.toFixed(2)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 rounded-xl border border-white/5 bg-slate-900/60 p-4 text-sm">
          <div className="flex justify-between text-slate-300">
            <span>Subtotal</span>
            <span>KSh {total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Tax</span>
            <span>KSh 0.00</span>
          </div>
          <div className="flex justify-between text-slate-100 font-semibold text-base">
            <span>Grand total</span>
            <span>KSh {total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-5 shadow-[0_18px_48px_-26px_rgba(15,118,110,0.42)]">
          <h3 className="text-sm font-semibold text-slate-200">Payments</h3>
          <div className="mt-4 space-y-3 text-sm">
            {tenders.map((tender) => (
              <div key={tender.id} className="rounded-xl border border-white/5 bg-slate-900/55 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">{PAYMENT_METHOD_LABELS[tender.method]}</span>
                  <span className="font-semibold text-emerald-200">KSh {tender.amount.toFixed(2)}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Received: KSh {tender.tenderedAmount.toFixed(2)} • Change: KSh {Math.max(0, tender.tenderedAmount - tender.amount).toFixed(2)}
                </div>
                {tender.referenceId && <div className="mt-1 text-xs text-slate-500">Ref: {tender.referenceId}</div>}
                {tender.note && <div className="mt-1 text-xs text-slate-500">Note: {tender.note}</div>}
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-3 py-2 text-xs text-slate-200">
            <div className="flex justify-between">
              <span>Total received</span>
              <span>KSh {tenders.reduce((sum, tender) => sum + tender.tenderedAmount, 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Change due</span>
              <span className="text-emerald-200">KSh {changeDue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Balance</span>
              <span className={cn('font-semibold', balanceDue > 0 ? 'text-amber-300' : 'text-emerald-200')}>
                KSh {balanceDue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Resulting status</span>
              <span className={cn('font-semibold uppercase tracking-wide', status === 'paid' ? 'text-emerald-300' : 'text-amber-300')}>
                {status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-5 shadow-[0_18px_48px_-26px_rgba(15,118,110,0.42)]">
          <h3 className="text-sm font-semibold text-slate-200">Receipt notes</h3>
          <Textarea
            placeholder="Notes for the receipt or internal log"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            className="mt-3 min-h-[96px] resize-none border-white/10 bg-slate-900/70 text-sm text-slate-100"
          />

          {customer.type === 'identified' && (
            <div className="mt-4 rounded-xl border border-white/5 bg-slate-900/55 px-3 py-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Name</span>
                <span>{customer.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Phone</span>
                <span>{customer.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Email</span>
                <span>{customer.email || '—'}</span>
              </div>
              {customer.loyaltyId && (
                <div className="flex justify-between">
                  <span>Loyalty ID</span>
                  <span>{customer.loyaltyId}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function createTender(method: POSPaymentMethod, amount: number): TenderDraft {
  return {
    id: generateId(),
    method,
    amount,
    tenderedAmount: amount,
    status: DEFAULT_STATUS,
  }
}

function computeTotalApplied(tenders: TenderDraft[]) {
  return tenders.reduce((sum, tender) => sum + (isFinite(tender.amount) ? tender.amount : 0), 0)
}

function computeTotalTendered(tenders: TenderDraft[]) {
  return tenders.reduce((sum, tender) => sum + (isFinite(tender.tenderedAmount) ? tender.tenderedAmount : 0), 0)
}

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 11)
}

export type { POSCheckoutModalProps }
