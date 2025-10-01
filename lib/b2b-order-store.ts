import { db } from '@/lib/firebase'
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
  updateDoc,
} from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import type {
  Invoice,
  LedgerEntry,
  PaymentRecord,
  PurchaseOrder,
  SalesOrder,
} from '@/types/b2b-orders'

type WritableTimestamp = Timestamp | Date | null | undefined

export const PURCHASE_ORDERS_COL = 'purchase_orders'
export const SALES_ORDERS_COL = 'sales_orders'
export const INVOICES_COL = 'invoices'
export const PAYMENTS_COL = 'payments'
export const LEDGER_ENTRIES_COL = 'ledger_entries'

const withTimestamps = (
  payload: Record<string, unknown>,
  { includeCreate }: { includeCreate: boolean } = { includeCreate: false },
) => {
  const base: Record<string, unknown> = {
    ...payload,
    updatedAt: serverTimestamp(),
  }

  const hasCreatedAt = (payload as { createdAt?: unknown }).createdAt
  if (includeCreate && hasCreatedAt == null) {
    base.createdAt = serverTimestamp()
  }

  return base
}

const attachId = <T>(snapshot: QueryDocumentSnapshot<DocumentData>): T => {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as T
}

export const purchaseOrdersCollection = () => collection(db, PURCHASE_ORDERS_COL) as CollectionReference<DocumentData>
export const salesOrdersCollection = () => collection(db, SALES_ORDERS_COL) as CollectionReference<DocumentData>
export const invoicesCollection = () => collection(db, INVOICES_COL) as CollectionReference<DocumentData>
export const paymentsCollection = () => collection(db, PAYMENTS_COL) as CollectionReference<DocumentData>
export const ledgerEntriesCollection = () => collection(db, LEDGER_ENTRIES_COL) as CollectionReference<DocumentData>

export const purchaseOrderDoc = (purchaseOrderId: string) => doc(db, PURCHASE_ORDERS_COL, purchaseOrderId)
export const salesOrderDoc = (salesOrderId: string) => doc(db, SALES_ORDERS_COL, salesOrderId)
export const invoiceDoc = (invoiceId: string) => doc(db, INVOICES_COL, invoiceId)
export const paymentDoc = (paymentId: string) => doc(db, PAYMENTS_COL, paymentId)
export const ledgerEntryDoc = (entryId: string) => doc(db, LEDGER_ENTRIES_COL, entryId)

export const fromPurchaseOrderSnapshot = (snapshot: QueryDocumentSnapshot<DocumentData>) => attachId<PurchaseOrder>(snapshot)
export const fromSalesOrderSnapshot = (snapshot: QueryDocumentSnapshot<DocumentData>) => attachId<SalesOrder>(snapshot)
export const fromInvoiceSnapshot = (snapshot: QueryDocumentSnapshot<DocumentData>) => attachId<Invoice>(snapshot)
export const fromPaymentSnapshot = (snapshot: QueryDocumentSnapshot<DocumentData>) => attachId<PaymentRecord>(snapshot)
export const fromLedgerEntrySnapshot = (snapshot: QueryDocumentSnapshot<DocumentData>) => attachId<LedgerEntry>(snapshot)

export type PurchaseOrderCreateInput = Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: WritableTimestamp
  updatedAt?: WritableTimestamp
}

export type SalesOrderCreateInput = Omit<SalesOrder, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: WritableTimestamp
  updatedAt?: WritableTimestamp
}

export type InvoiceCreateInput = Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: WritableTimestamp
  updatedAt?: WritableTimestamp
}

export type PaymentCreateInput = Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: WritableTimestamp
  updatedAt?: WritableTimestamp
}

export type LedgerEntryCreateInput = Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: WritableTimestamp
  updatedAt?: WritableTimestamp
}

export async function createPurchaseOrder(payload: PurchaseOrderCreateInput): Promise<DocumentReference<DocumentData>> {
  return addDoc(purchaseOrdersCollection(), withTimestamps(payload, { includeCreate: true }))
}

export async function updatePurchaseOrder(purchaseOrderId: string, payload: Partial<PurchaseOrderCreateInput>) {
  await updateDoc(purchaseOrderDoc(purchaseOrderId), withTimestamps(payload as PurchaseOrderCreateInput))
}

export async function createSalesOrder(payload: SalesOrderCreateInput): Promise<DocumentReference<DocumentData>> {
  return addDoc(salesOrdersCollection(), withTimestamps(payload, { includeCreate: true }))
}

export async function createInvoice(payload: InvoiceCreateInput): Promise<DocumentReference<DocumentData>> {
  return addDoc(invoicesCollection(), withTimestamps(payload, { includeCreate: true }))
}

export async function createPaymentRecord(payload: PaymentCreateInput): Promise<DocumentReference<DocumentData>> {
  return addDoc(paymentsCollection(), withTimestamps(payload, { includeCreate: true }))
}

export async function createLedgerEntry(payload: LedgerEntryCreateInput): Promise<DocumentReference<DocumentData>> {
  return addDoc(ledgerEntriesCollection(), withTimestamps(payload, { includeCreate: true }))
}
