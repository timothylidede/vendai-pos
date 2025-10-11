/**
 * Three-way match reconciliation types
 * PO ↔ Delivery ↔ Invoice matching and discrepancy tracking
 */

export interface InvoiceAttachment {
  id: string
  fileName: string
  fileUrl: string
  fileType: string // 'application/pdf', 'image/jpeg', etc.
  fileSize: number
  uploadedAt: string
  uploadedBy: string
}

export interface ReconciliationLineItem {
  productId: string
  productName: string
  unit?: string // e.g., "PCS", "KG"
  // PO data
  poQuantity: number
  poUnitPrice: number
  poLineTotal: number
  // Delivery data
  deliveredQuantity: number
  // Invoice data
  invoiceQuantity?: number
  invoiceUnitPrice?: number
  invoiceLineTotal?: number
  // Discrepancies
  quantityDiscrepancy: number // delivered - PO
  priceDiscrepancy?: number // invoice - PO
  amountDiscrepancy?: number // invoice total - PO total
  hasDiscrepancy?: boolean
  notes?: string
}

export interface DeliveryReconciliation {
  id?: string
  orgId: string
  purchaseOrderId: string
  supplierId: string
  supplierName: string
  
  // Document references
  poNumber?: string
  invoiceNumber?: string
  deliveryNote?: string
  
  // Attachments
  invoiceAttachments: InvoiceAttachment[]
  deliveryNoteAttachments?: InvoiceAttachment[]
  
  // Financial totals
  poTotal: number
  invoiceTotal?: number
  deliveredTotal: number
  
  // Line items with discrepancies
  lineItems: ReconciliationLineItem[]
  
  // Match status
  status: 'pending_review' | 'approved' | 'disputed' | 'resolved'
  matchStatus: 'perfect_match' | 'minor_variance' | 'significant_variance' | 'major_discrepancy'
  
  // Discrepancy summary
  hasQuantityDiscrepancy: boolean
  hasPriceDiscrepancy: boolean
  hasAmountDiscrepancy: boolean
  totalDiscrepancyAmount: number
  discrepancyPercentage: number
  
  // Flags and notes
  flags: DiscrepancyFlag[]
  reviewNotes?: string
  resolutionNotes?: string
  
  // Timestamps
  createdAt: string
  createdBy?: string
  deliveredAt: string
  invoiceReceivedAt?: string
  reviewedAt?: string
  reviewedBy?: string
  resolvedAt?: string
  resolvedBy?: string
  
  // Approval workflow
  requiresApproval: boolean
  approvalThreshold?: number // amount threshold for auto-approval
  approvalNotes?: string
  disputeReason?: string
  notes?: string
  adjustedAmount?: number
  creditNoteNumber?: string
  debitNoteNumber?: string
}

export interface DiscrepancyFlag {
  type: 'quantity_shortage' | 'quantity_overage' | 'price_increase' | 'price_decrease' | 'missing_items' | 'extra_items' | 'amount_mismatch'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affectedProducts: string[]
  amount?: number
}

export interface ReconciliationSettings {
  orgId: string
  // Auto-approval thresholds
  autoApproveUnderAmount: number // e.g., auto-approve if discrepancy < ₹500
  autoApproveUnderPercent: number // e.g., auto-approve if discrepancy < 2%
  // Alert thresholds
  minorVariancePercent: number // e.g., 2% - yellow flag
  significantVariancePercent: number // e.g., 5% - orange flag
  majorDiscrepancyPercent: number // e.g., 10% - red flag
  // Workflow
  requireInvoiceForApproval: boolean
  requireManagerApprovalAbove: number // amount requiring manager approval
}

export interface ReconciliationAction {
  reconciliationId: string
  action: 'approve' | 'dispute' | 'resolve'
  userId: string
  notes?: string
  resolution?: {
    adjustedAmount?: number
    creditNote?: string
    debitNote?: string
  }
}

export interface ReconciliationSummary {
  total: number
  pendingReview: number
  approved: number
  disputed: number
  resolved: number
  totalDiscrepancyAmount: number
  averageDiscrepancyPercent: number
  perfectMatches: number
  minorVariances: number
  significantVariances: number
  majorDiscrepancies: number
}
