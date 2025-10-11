/**
 * Purchase Order types for supplier receiving flow
 * Part of Phase 1.1 Receiving Flow Completion
 */

export type PurchaseOrderStatus = 
  | 'draft'           // Created but not submitted
  | 'submitted'       // Sent to supplier
  | 'confirmed'       // Supplier acknowledged
  | 'partially_received' // Some items received
  | 'received'        // Fully received
  | 'cancelled'       // Order cancelled

export interface PurchaseOrderLine {
  productId: string
  productName: string
  quantityOrdered: number      // In pieces
  quantityReceived?: number    // In pieces
  unitPrice: number            // Cost per piece
  unit?: string                // e.g., "PCS", "KG"
  lineTotal: number            // quantityOrdered * unitPrice
  notes?: string
}

export interface PurchaseOrder {
  id: string
  orgId: string
  supplierId: string
  supplierName: string
  lines: PurchaseOrderLine[]
  status: PurchaseOrderStatus
  totalAmount: number
  expectedDate?: Date | string
  receivedAt?: Date | string
  createdAt: Date | string
  createdBy: string            // userId who created the PO
  submittedAt?: Date | string
  confirmedAt?: Date | string
  notes?: string
  deliveryAddress?: string
  contactPhone?: string
}

export interface CreatePurchaseOrderRequest {
  orgId: string
  supplierId: string
  supplierName: string
  lines: Array<{
    productId: string
    productName: string
    quantity: number
    unitPrice: number
    unit?: string
  }>
  expectedDate?: string
  notes?: string
  deliveryAddress?: string
  contactPhone?: string
}

export interface ReceiveDeliveryRequest {
  poId: string
  orgId: string
  receivedLines: Array<{
    productId: string
    quantityReceived: number  // In pieces
  }>
  receivedBy: string          // userId
  notes?: string
  partialReceipt?: boolean
}

export interface ReceiveDeliveryResponse {
  success: boolean
  poId: string
  inventoryUpdated: string[]  // productIds that were updated
  status: PurchaseOrderStatus
  message: string
}

export interface LedgerEntryCoGS {
  id: string
  orgId: string
  type: 'COGS'                // Cost of Goods Sold
  poId: string
  supplierId: string
  amount: number
  productIds: string[]
  createdAt: Date | string
  description: string
}
