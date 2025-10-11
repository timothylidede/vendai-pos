/**
 * Price change management types
 */

export interface PriceChangeRequest {
  supplierId: string
  supplierName: string
  changes: PriceChangeItem[]
}

export interface PriceChangeItem {
  productId: string
  skuId: string // supplier_skus document ID
  oldCost: number
  newCost: number
  effectiveDate?: string
}

export interface PriceChangeAlert {
  id?: string
  orgId: string
  supplierId: string
  supplierName: string
  productId: string
  productName: string
  skuId: string
  oldCost: number
  newCost: number
  percentageIncrease: number
  currentRetailPrice?: number
  currentMargin?: number
  newMargin?: number
  status: 'pending' | 'approved' | 'rejected' | 'adjusted'
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
  adjustedRetailPrice?: number
  notes?: string
}

export interface PriceChangeSettings {
  orgId: string
  alertThresholdPercent: number // e.g., 10 = alert if cost increases > 10%
  autoApproveUnderPercent?: number // e.g., 5 = auto-approve increases < 5%
  requireApprovalAbovePercent?: number // e.g., 15 = require manager approval > 15%
}

export interface PriceReviewAction {
  alertId: string
  action: 'approve' | 'reject' | 'adjust'
  adjustedRetailPrice?: number
  notes?: string
  userId: string
}

export interface BulkPriceReviewRequest {
  alertIds: string[]
  action: 'approve' | 'reject'
  userId: string
  notes?: string
}
