/**
 * Auto-replenishment types for inventory management
 */

export interface ReplenishmentSuggestion {
  id?: string
  orgId: string
  productId: string
  productName: string
  currentStock: number // total pieces
  reorderPoint: number
  suggestedQty: number
  preferredSupplierId: string
  preferredSupplierName: string
  supplierLeadTime: number // days
  unitCost: number
  totalCost: number
  status: 'pending' | 'approved' | 'rejected' | 'ordered'
  createdAt: string
  approvedAt?: string
  approvedBy?: string
  orderedAt?: string
  purchaseOrderId?: string
  reason: string // e.g., "Below reorder point", "Predicted stockout"
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface SupplierSKU {
  id?: string
  supplierId: string
  supplierName: string
  productId: string // maps to pos_products
  supplierSKU: string
  cost: number
  leadTimeDays: number
  minOrderQty: number
  moq?: number // minimum order quantity
  availability: 'in_stock' | 'low_stock' | 'out_of_stock'
  lastUpdated: string
}

export interface ReplenishmentSettings {
  orgId: string
  autoApprove: boolean
  autoApproveThreshold: number // auto-approve if cost < threshold
  checkFrequency: 'hourly' | 'daily' | 'weekly'
  notifyEmails: string[]
  notifyInApp: boolean
  priorityThresholds: {
    critical: number // stock level % for critical priority
    high: number
    medium: number
  }
  defaultLeadTimeDays: number
  safetyStockMultiplier: number // e.g., 1.5 = 50% safety stock
}

export interface ReplenishmentJob {
  id?: string
  orgId: string
  runAt: string
  status: 'running' | 'completed' | 'failed'
  suggestionsCreated: number
  productsChecked: number
  errors?: string[]
  completedAt?: string
  durationMs?: number
}
