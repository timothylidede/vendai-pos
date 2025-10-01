import type { Timestamp } from "firebase/firestore"

export type PaymentMethod =
  | "mpesa"
  | "bank_transfer"
  | "card"
  | "vendai_credit"
  | "cash_on_delivery"
  | "escrow_release"

export type PaymentStatus = "pending" | "processing" | "partial" | "paid" | "failed" | "refunded"

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "fulfilled"
  | "cancelled"

export type SalesOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "in_transit"
  | "delivered"
  | "cancelled"

export type InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled"

export type ReconciliationStatus = "unmatched" | "partial" | "matched" | "flagged"

export interface StatusHistoryEntry<TStatus extends string = string> {
  status: TStatus
  changedBy: string
  changedByName?: string
  changedAt: Timestamp
  notes?: string
}

export interface MoneyBreakdown {
  subtotal: number
  tax: number
  total: number
  currency: string
}

export interface PurchaseOrderItem {
  productId: string
  productName: string
  sku?: string
  quantity: number
  unitPrice: number
  unit?: string
  vatRate?: number
  notes?: string
}

export interface DeliveryCheckpoint {
  label: string
  completed: boolean
  timestamp?: Timestamp
  notes?: string
}

export interface PurchaseOrder {
  id: string
  retailerOrgId: string
  supplierOrgId?: string
  retailerId: string
  retailerName: string
  retailerUserId?: string
  supplierId: string
  supplierName: string
  supplierUserId?: string
  createdByUserId: string
  createdByName?: string
  status: PurchaseOrderStatus
  paymentTerms: "cod" | "net7" | "net14" | "net30" | "net60"
  expectedDeliveryDate?: Timestamp
  deliveryAddress: string
  notes?: string
  items: PurchaseOrderItem[]
  amount: MoneyBreakdown
  statusHistory: StatusHistoryEntry<PurchaseOrderStatus>[]
  deliveryCheckpoints?: DeliveryCheckpoint[]
  relatedInvoiceId?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface SalesOrder {
  id: string
  purchaseOrderId: string
  retailerOrgId: string
  supplierOrgId?: string
  supplierId: string
  supplierName: string
  supplierUserId?: string
  retailerId: string
  retailerName: string
  retailerUserId?: string
  status: SalesOrderStatus
  fulfillmentEta?: Timestamp
  assignedDriverId?: string
  assignedWarehouseId?: string
  items: PurchaseOrderItem[]
  amount: MoneyBreakdown
  statusHistory: StatusHistoryEntry<SalesOrderStatus>[]
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface InvoiceItem extends PurchaseOrderItem {
  lineTotal: number
}

export interface Invoice {
  id: string
  retailerOrgId: string
  supplierOrgId?: string
  purchaseOrderId: string
  salesOrderId?: string
  retailerId: string
  retailerName: string
  retailerUserId?: string
  supplierId: string
  supplierName: string
  supplierUserId?: string
  number: string
  issueDate: Timestamp
  dueDate: Timestamp
  status: InvoiceStatus
  items: InvoiceItem[]
  amount: MoneyBreakdown
  paymentStatus: PaymentStatus
  paymentTerms: PurchaseOrder["paymentTerms"]
  paymentIds: string[]
  statusHistory: StatusHistoryEntry<InvoiceStatus>[]
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface PaymentRecord {
  id: string
  retailerOrgId: string
  supplierOrgId?: string
  invoiceId: string
  purchaseOrderId: string
  retailerId: string
  retailerName?: string
  retailerUserId?: string
  supplierId: string
  supplierName?: string
  supplierUserId?: string
  method: PaymentMethod
  status: PaymentStatus
  amount: number
  currency: string
  fees: {
    processor: number
    vendaiCommission: number
    other?: number
  }
  netAmount: number
  processor?: "stripe" | "adyen" | "flutterwave" | "mpesa_gateway" | "manual"
  processorReference?: string
  mpesaReference?: string
  metadata?: Record<string, unknown>
  receivedAt?: Timestamp
  releasedAt?: Timestamp
  statusHistory: StatusHistoryEntry<PaymentStatus>[]
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface LedgerEntry {
  id: string
  retailerOrgId: string
  supplierOrgId?: string
  purchaseOrderId: string
  invoiceId: string
  paymentId?: string
  supplierId: string
  supplierName?: string
  retailerId: string
  retailerName?: string
  grossAmount: number
  vendaiCommissionAmount: number
  processorFeeAmount: number
  netPayoutAmount: number
  currency: string
  reconciliationStatus: ReconciliationStatus
  payoutStatus: "pending" | "in_progress" | "paid" | "failed"
  payoutDate?: Timestamp
  notes?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface ReconciliationMatchSummary {
  purchaseOrderId: string
  invoiceId: string
  paymentId?: string
  ledgerEntryId?: string
  status: ReconciliationStatus
  lastCheckedAt: Timestamp
  mismatches?: string[]
}
