import { serverTimestamp, Timestamp } from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'

import type {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  PurchaseOrder,
  StatusHistoryEntry,
} from '@/types/b2b-orders'
import {
  serializeStatusHistory,
  serializeTimestamp,
  toTimestamp,
  type TimestampLike,
} from './b2b-order-utils'

export type SerializableInvoice = Omit<
  Invoice,
  'issueDate' | 'dueDate' | 'statusHistory' | 'createdAt' | 'updatedAt'
> & {
  issueDate: string | null
  dueDate: string | null
  statusHistory: Array<{
    status: InvoiceStatus
    changedBy: string
    changedByName?: string
    changedAt: string | null
    notes?: string
  }>
  createdAt: string | null
  updatedAt: string | null
}

export const serializeInvoice = (
  invoiceId: string,
  data: DocumentData,
): SerializableInvoice => {
  const invoice = data as Partial<Invoice>

  return {
    id: invoiceId,
    retailerOrgId: invoice.retailerOrgId ?? '',
    supplierOrgId: invoice.supplierOrgId,
    purchaseOrderId: invoice.purchaseOrderId ?? '',
    salesOrderId: invoice.salesOrderId,
    retailerId: invoice.retailerId ?? '',
    retailerName: invoice.retailerName ?? '',
    retailerUserId: invoice.retailerUserId,
    supplierId: invoice.supplierId ?? '',
    supplierName: invoice.supplierName ?? '',
    supplierUserId: invoice.supplierUserId,
    number: invoice.number ?? '',
    issueDate: serializeTimestamp(invoice.issueDate),
    dueDate: serializeTimestamp(invoice.dueDate),
    status: invoice.status ?? 'draft',
    items: invoice.items ?? [],
    amount: invoice.amount ?? { subtotal: 0, tax: 0, total: 0, currency: 'KES' },
    paymentStatus: invoice.paymentStatus ?? 'pending',
    paymentTerms: invoice.paymentTerms ?? 'cod',
    paymentIds: invoice.paymentIds ?? [],
    statusHistory: serializeStatusHistory(invoice.statusHistory ?? []),
    createdAt: serializeTimestamp(invoice.createdAt),
    updatedAt: serializeTimestamp(invoice.updatedAt),
  }
}

export const buildInvoiceStatusHistoryEntry = (
  status: InvoiceStatus,
  changedBy: string,
  changedByName?: string,
  note?: string,
): StatusHistoryEntry<InvoiceStatus> => ({
  status,
  changedBy,
  changedByName,
  changedAt: serverTimestamp() as unknown as Timestamp,
  notes: note,
})

export const calculateInvoiceItemLineTotal = (
  item: Omit<InvoiceItem, 'lineTotal'>,
): InvoiceItem => {
  const lineTotal = item.quantity * item.unitPrice
  return {
    ...item,
    lineTotal,
  }
}

export const generateInvoiceNumber = (
  supplierId: string,
  date: Date = new Date(),
): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const timestamp = Date.now().toString().slice(-6)
  const supplierPrefix = supplierId.slice(0, 4).toUpperCase()

  return `INV-${supplierPrefix}-${year}${month}-${timestamp}`
}

export const calculateDueDate = (
  issueDate: Date,
  paymentTerms: PurchaseOrder['paymentTerms'],
): Date => {
  const dueDate = new Date(issueDate)

  switch (paymentTerms) {
    case 'cod':
      return dueDate
    case 'net7':
      dueDate.setDate(dueDate.getDate() + 7)
      break
    case 'net14':
      dueDate.setDate(dueDate.getDate() + 14)
      break
    case 'net30':
      dueDate.setDate(dueDate.getDate() + 30)
      break
    case 'net60':
      dueDate.setDate(dueDate.getDate() + 60)
      break
  }

  return dueDate
}

export const parseIssueDate = (value?: TimestampLike): Timestamp => {
  const parsed = toTimestamp(value)
  return parsed ?? Timestamp.fromDate(new Date())
}

export const parseDueDate = (
  value?: TimestampLike,
  issueDate?: Timestamp,
  paymentTerms?: PurchaseOrder['paymentTerms'],
): Timestamp => {
  const parsed = toTimestamp(value)
  if (parsed) return parsed

  if (issueDate && paymentTerms) {
    return Timestamp.fromDate(calculateDueDate(issueDate.toDate(), paymentTerms))
  }

  return Timestamp.fromDate(new Date())
}
