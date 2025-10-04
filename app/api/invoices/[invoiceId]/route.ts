import { NextRequest, NextResponse } from 'next/server'
import { getDoc } from 'firebase/firestore'

import { invoiceDoc, updateInvoice } from '@/lib/b2b-order-store'
import { sanitizeInput, schemas } from '@/lib/validation'
import { buildInvoiceStatusHistoryEntry, parseDueDate, parseIssueDate, serializeInvoice } from '@/lib/b2b-invoice-utils'
import type { Invoice } from '@/types/b2b-orders'

interface InvoiceUpdateBody {
  status?: Invoice['status']
  paymentStatus?: Invoice['paymentStatus']
  paymentTerms?: Invoice['paymentTerms']
  paymentIds?: string[]
  amount?: Invoice['amount']
  issueDate?: string | Date | null
  dueDate?: string | Date | null
  statusNote?: string
  updatedByUserId?: string
  updatedByName?: string
}

type RouteParams = {
  params: {
    invoiceId: string
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const invoiceId = params?.invoiceId

  if (!invoiceId) {
    return NextResponse.json({ success: false, error: 'Invoice identifier is required' }, { status: 400 })
  }

  let body: InvoiceUpdateBody
  try {
    body = await request.json()
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 })
  }

  let parsed: InvoiceUpdateBody
  try {
    parsed = sanitizeInput(body, schemas.invoiceUpdate)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid invoice payload'
    return NextResponse.json({ success: false, error: message }, { status: 422 })
  }

  const snapshot = await getDoc(invoiceDoc(invoiceId))
  if (!snapshot.exists()) {
    return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })
  }

  const existing = {
    ...(snapshot.data() as Invoice),
    id: snapshot.id,
  }

  const updates: Partial<Invoice> = {}
  const history = [...(existing.statusHistory ?? [])]

  if (parsed.status) {
    const actorId = parsed.updatedByUserId ?? 'system'
    const actorName = parsed.updatedByName ?? 'System'
    history.push(buildInvoiceStatusHistoryEntry(parsed.status, actorId, actorName, parsed.statusNote))
    updates.status = parsed.status
    updates.statusHistory = history
  } else if (parsed.statusNote) {
    // Append note to last status entry when only note provided
    const last = history.length ? history[history.length - 1] : undefined
    if (last) {
      last.notes = parsed.statusNote
      updates.statusHistory = history
    }
  }

  if (parsed.paymentStatus) {
    updates.paymentStatus = parsed.paymentStatus
  }

  if (parsed.paymentTerms) {
    updates.paymentTerms = parsed.paymentTerms
  }

  if (parsed.paymentIds) {
    const merged = new Set([...(existing.paymentIds ?? []), ...parsed.paymentIds])
    updates.paymentIds = Array.from(merged)
  }

  if (parsed.amount) {
    updates.amount = parsed.amount
  }

  if (parsed.issueDate !== undefined) {
    updates.issueDate = parseIssueDate(parsed.issueDate)
  }

  if (parsed.dueDate !== undefined) {
    const baseIssue = (updates.issueDate ?? existing.issueDate) || undefined
    const baseTerms = updates.paymentTerms ?? existing.paymentTerms
    updates.dueDate = parseDueDate(parsed.dueDate, baseIssue ?? undefined, baseTerms)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: 'No updates were applied' }, { status: 400 })
  }

  await updateInvoice(invoiceId, updates)

  const refreshed = await getDoc(invoiceDoc(invoiceId))
  const payload = serializeInvoice(invoiceId, refreshed.data() ?? {})

  return NextResponse.json({ success: true, invoice: payload })
}
