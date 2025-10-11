/**
 * Three-Way Match Reconciliation Engine
 * Compares PO (ordered) vs Delivery (received) vs Invoice (billed)
 * Automatically detects and flags discrepancies
 * Part of Phase 1.2 Supplier Integration Depth
 */

import { adminDb } from '@/lib/firebase-admin'
import type { 
  DeliveryReconciliation, 
  ReconciliationLineItem, 
  DiscrepancyFlag,
  ReconciliationSettings,
  InvoiceAttachment
} from '@/types/reconciliation'
import type { PurchaseOrder, PurchaseOrderLine } from '@/types/purchase-orders'

/**
 * Default reconciliation settings per organization
 */
const DEFAULT_SETTINGS: Omit<ReconciliationSettings, 'orgId'> = {
  autoApproveUnderAmount: 100, // Auto-approve if total discrepancy < ₹100
  autoApproveUnderPercent: 2, // Auto-approve if discrepancy < 2%
  minorVariancePercent: 2, // 0-2% = minor
  significantVariancePercent: 5, // 2-5% = significant
  majorDiscrepancyPercent: 10, // >10% = major
  requireInvoiceForApproval: true,
  requireManagerApprovalAbove: 5000,
}

/**
 * Get reconciliation settings for an organization
 */
async function getReconciliationSettings(orgId: string): Promise<ReconciliationSettings> {
  const settingsDoc = await adminDb.collection('reconciliation_settings').doc(orgId).get()
  
  if (settingsDoc.exists) {
    return settingsDoc.data() as ReconciliationSettings
  }
  
  // Return defaults if not configured
  return {
    orgId,
    ...DEFAULT_SETTINGS,
  }
}

/**
 * Compare line items across PO, Delivery, and Invoice
 * Returns reconciled line items with discrepancy calculations
 */
function reconcileLineItems(
  poLines: PurchaseOrderLine[],
  receivedLines: Array<{ productId: string; quantityReceived: number }>,
  invoiceLines: Array<{ productId: string; quantity: number; unitPrice: number; lineTotal: number }>
): ReconciliationLineItem[] {
  const reconciled: ReconciliationLineItem[] = []
  
  // Create maps for quick lookup
  const receivedMap = new Map(receivedLines.map(line => [line.productId, line.quantityReceived]))
  const invoiceMap = new Map(invoiceLines.map(line => [line.productId, line]))
  
  // Process each PO line
  for (const poLine of poLines) {
    const deliveredQuantity = receivedMap.get(poLine.productId) || 0
    const invoiceLine = invoiceMap.get(poLine.productId)
    
    const invoiceQuantity = invoiceLine?.quantity || 0
    const invoiceUnitPrice = invoiceLine?.unitPrice || 0
    const invoiceLineTotal = invoiceLine?.lineTotal || 0
    
    // Calculate discrepancies
    const quantityDiscrepancy = deliveredQuantity - poLine.quantityOrdered
    const priceDiscrepancy = invoiceUnitPrice - poLine.unitPrice
    const expectedInvoiceTotal = deliveredQuantity * poLine.unitPrice
    const amountDiscrepancy = invoiceLineTotal - expectedInvoiceTotal
    
    reconciled.push({
      productId: poLine.productId,
      productName: poLine.productName,
      unit: poLine.unit,
      
      // PO data
      poQuantity: poLine.quantityOrdered,
      poUnitPrice: poLine.unitPrice,
      poLineTotal: poLine.lineTotal,
      
      // Delivery data
      deliveredQuantity,
      
      // Invoice data
      invoiceQuantity,
      invoiceUnitPrice,
      invoiceLineTotal,
      
      // Discrepancies
      quantityDiscrepancy,
      priceDiscrepancy,
      amountDiscrepancy,
      
      hasDiscrepancy: quantityDiscrepancy !== 0 || priceDiscrepancy !== 0 || amountDiscrepancy !== 0,
      notes: generateLineNotes(quantityDiscrepancy, priceDiscrepancy, amountDiscrepancy),
    })
  }
  
  // Check for extra items in invoice not in PO
  for (const [productId, invoiceLine] of invoiceMap) {
    if (!poLines.find(po => po.productId === productId)) {
      reconciled.push({
        productId,
        productName: `Unknown Product (${productId})`,
        
        poQuantity: 0,
        poUnitPrice: 0,
        poLineTotal: 0,
        
        deliveredQuantity: receivedMap.get(productId) || 0,
        
        invoiceQuantity: invoiceLine.quantity,
        invoiceUnitPrice: invoiceLine.unitPrice,
        invoiceLineTotal: invoiceLine.lineTotal,
        
        quantityDiscrepancy: invoiceLine.quantity,
        priceDiscrepancy: invoiceLine.unitPrice,
        amountDiscrepancy: invoiceLine.lineTotal,
        
        hasDiscrepancy: true,
        notes: 'Extra item not in original PO',
      })
    }
  }
  
  return reconciled
}

/**
 * Generate human-readable notes for line item discrepancies
 */
function generateLineNotes(quantityDisc: number, priceDisc: number, amountDisc: number): string {
  const notes: string[] = []
  
  if (quantityDisc > 0) notes.push(`+${quantityDisc} qty over`)
  if (quantityDisc < 0) notes.push(`${quantityDisc} qty short`)
  if (priceDisc > 0) notes.push(`₹${priceDisc.toFixed(2)} price increase`)
  if (priceDisc < 0) notes.push(`₹${Math.abs(priceDisc).toFixed(2)} price decrease`)
  if (amountDisc !== 0 && notes.length === 0) notes.push(`₹${amountDisc.toFixed(2)} amount variance`)
  
  return notes.join(', ') || 'Perfect match'
}

/**
 * Generate discrepancy flags based on line item analysis
 */
function generateDiscrepancyFlags(
  lineItems: ReconciliationLineItem[],
  settings: ReconciliationSettings
): DiscrepancyFlag[] {
  const flags: DiscrepancyFlag[] = []
  
  for (const line of lineItems) {
    if (!line.hasDiscrepancy) continue
    
    // Quantity shortage
    if (line.quantityDiscrepancy < 0) {
      const shortagePercent = Math.abs(line.quantityDiscrepancy / line.poQuantity) * 100
      flags.push({
        type: 'quantity_shortage',
        severity: shortagePercent > 20 ? 'high' : shortagePercent > 10 ? 'medium' : 'low',
        description: `${line.productName}: ${Math.abs(line.quantityDiscrepancy)} units short (${shortagePercent.toFixed(1)}%)`,
        affectedProducts: [line.productId],
        amount: Math.abs(line.quantityDiscrepancy * line.poUnitPrice),
      })
    }
    
    // Quantity overage
    if (line.quantityDiscrepancy > 0) {
      const overagePercent = (line.quantityDiscrepancy / line.poQuantity) * 100
      flags.push({
        type: 'quantity_overage',
        severity: overagePercent > 20 ? 'medium' : 'low',
        description: `${line.productName}: ${line.quantityDiscrepancy} extra units received (${overagePercent.toFixed(1)}%)`,
        affectedProducts: [line.productId],
        amount: line.quantityDiscrepancy * line.poUnitPrice,
      })
    }
    
    // Price increase
    if (line.priceDiscrepancy && line.priceDiscrepancy > 0) {
      const priceIncreasePercent = (line.priceDiscrepancy / line.poUnitPrice) * 100
      flags.push({
        type: 'price_increase',
        severity: priceIncreasePercent > 10 ? 'high' : priceIncreasePercent > 5 ? 'medium' : 'low',
        description: `${line.productName}: Price increased from ₹${line.poUnitPrice} to ₹${line.invoiceUnitPrice || 0} (+${priceIncreasePercent.toFixed(1)}%)`,
        affectedProducts: [line.productId],
        amount: line.priceDiscrepancy * line.deliveredQuantity,
      })
    }
    
    // Price decrease
    if (line.priceDiscrepancy && line.priceDiscrepancy < 0) {
      const priceDecreasePercent = Math.abs(line.priceDiscrepancy / line.poUnitPrice) * 100
      flags.push({
        type: 'price_decrease',
        severity: 'low',
        description: `${line.productName}: Price decreased from ₹${line.poUnitPrice} to ₹${line.invoiceUnitPrice || 0} (-${priceDecreasePercent.toFixed(1)}%)`,
        affectedProducts: [line.productId],
        amount: Math.abs(line.priceDiscrepancy * line.deliveredQuantity),
      })
    }
    
    // Amount mismatch (when price and quantity don't explain the difference)
    if (line.amountDiscrepancy && Math.abs(line.amountDiscrepancy) > 0.01) {
      const amountPercent = Math.abs(line.amountDiscrepancy / line.poLineTotal) * 100
      if (amountPercent > 1) {
        flags.push({
          type: 'amount_mismatch',
          severity: amountPercent > 10 ? 'high' : amountPercent > 5 ? 'medium' : 'low',
          description: `${line.productName}: Invoice amount ₹${line.invoiceLineTotal || 0} vs expected ₹${(line.deliveredQuantity * line.poUnitPrice).toFixed(2)}`,
          affectedProducts: [line.productId],
          amount: Math.abs(line.amountDiscrepancy),
        })
      }
    }
    
    // Extra items not in PO
    if (line.poQuantity === 0 && line.invoiceQuantity && line.invoiceQuantity > 0) {
      flags.push({
        type: 'extra_items',
        severity: 'medium',
        description: `${line.productName}: Item not in original PO`,
        affectedProducts: [line.productId],
        amount: line.invoiceLineTotal || 0,
      })
    }
    
    // Missing items (in PO but not delivered or invoiced)
    if (line.deliveredQuantity === 0 && line.poQuantity > 0) {
      flags.push({
        type: 'missing_items',
        severity: 'high',
        description: `${line.productName}: Not delivered (expected ${line.poQuantity} units)`,
        affectedProducts: [line.productId],
        amount: line.poLineTotal,
      })
    }
  }
  
  return flags
}

/**
 * Determine match status based on discrepancy percentage
 */
function determineMatchStatus(
  discrepancyPercent: number,
  settings: ReconciliationSettings
): DeliveryReconciliation['matchStatus'] {
  if (discrepancyPercent === 0) return 'perfect_match'
  if (discrepancyPercent <= settings.minorVariancePercent) return 'minor_variance'
  if (discrepancyPercent <= settings.significantVariancePercent) return 'significant_variance'
  return 'major_discrepancy'
}

/**
 * Determine status based on match status and auto-approval rules
 */
function determineStatus(
  matchStatus: DeliveryReconciliation['matchStatus'],
  totalDiscrepancyAmount: number,
  discrepancyPercent: number,
  settings: ReconciliationSettings
): DeliveryReconciliation['status'] {
  // Auto-approve if under thresholds
  if (
    totalDiscrepancyAmount <= settings.autoApproveUnderAmount &&
    discrepancyPercent <= settings.autoApproveUnderPercent
  ) {
    return 'approved'
  }
  
  // Otherwise requires review
  return 'pending_review'
}

/**
 * Main reconciliation function
 * Creates a complete reconciliation document from PO, delivery, and invoice data
 */
export async function createReconciliation(params: {
  poId: string
  orgId: string
  supplierId: string
  receivedLines: Array<{ productId: string; quantityReceived: number }>
  invoiceAttachments: InvoiceAttachment[]
  invoiceLines: Array<{ productId: string; quantity: number; unitPrice: number; lineTotal: number }>
  invoiceTotal: number
  invoiceNumber?: string
  receivedBy: string
  notes?: string
}): Promise<DeliveryReconciliation> {
  
  // 1. Fetch the purchase order
  const poDoc = await adminDb.collection('purchase_orders').doc(params.poId).get()
  if (!poDoc.exists) {
    throw new Error(`Purchase order ${params.poId} not found`)
  }
  const po = poDoc.data() as PurchaseOrder
  
  // 2. Get reconciliation settings
  const settings = await getReconciliationSettings(params.orgId)
  
  // 3. Reconcile line items
  const lineItems = reconcileLineItems(po.lines, params.receivedLines, params.invoiceLines)
  
  // 4. Calculate totals
  const poTotal = po.totalAmount
  const deliveredTotal = params.receivedLines.reduce((sum, line) => {
    const poLine = po.lines.find(pl => pl.productId === line.productId)
    return sum + (poLine ? line.quantityReceived * poLine.unitPrice : 0)
  }, 0)
  const invoiceTotal = params.invoiceTotal
  
  const totalDiscrepancyAmount = Math.abs(invoiceTotal - deliveredTotal)
  const discrepancyPercentage = deliveredTotal > 0 ? (totalDiscrepancyAmount / deliveredTotal) * 100 : 0
  
  // 5. Generate discrepancy flags
  const flags = generateDiscrepancyFlags(lineItems, settings)
  
  // 6. Determine match status and overall status
  const matchStatus = determineMatchStatus(discrepancyPercentage, settings)
  const status = determineStatus(matchStatus, totalDiscrepancyAmount, discrepancyPercentage, settings)
  
  // 7. Calculate boolean flags
  const hasQuantityDiscrepancy = lineItems.some(line => line.quantityDiscrepancy !== 0)
  const hasPriceDiscrepancy = lineItems.some(line => line.priceDiscrepancy && line.priceDiscrepancy !== 0)
  const hasAmountDiscrepancy = lineItems.some(line => line.amountDiscrepancy && line.amountDiscrepancy !== 0)
  const requiresApproval = status === 'pending_review' || totalDiscrepancyAmount > settings.requireManagerApprovalAbove
  
  // 8. Create reconciliation document
  const reconciliation: DeliveryReconciliation = {
    id: '', // Will be set by Firestore
    orgId: params.orgId,
    purchaseOrderId: params.poId,
    supplierId: params.supplierId,
    supplierName: po.supplierName,
    poNumber: po.id,
    invoiceNumber: params.invoiceNumber,
    
    invoiceAttachments: params.invoiceAttachments,
    deliveryNoteAttachments: [],
    
    lineItems,
    
    status,
    matchStatus,
    flags,
    
    poTotal,
    invoiceTotal,
    deliveredTotal,
    totalDiscrepancyAmount,
    discrepancyPercentage,
    
    hasQuantityDiscrepancy,
    hasPriceDiscrepancy,
    hasAmountDiscrepancy,
    requiresApproval,
    
    createdAt: new Date().toISOString(),
    createdBy: params.receivedBy,
    deliveredAt: new Date().toISOString(),
    invoiceReceivedAt: new Date().toISOString(),
    
    notes: params.notes,
  }
  
  // 9. Save to Firestore
  const reconciliationRef = await adminDb.collection('delivery_reconciliations').add(reconciliation)
  reconciliation.id = reconciliationRef.id
  
  // Update with the ID
  await reconciliationRef.update({ id: reconciliation.id })
  
  return reconciliation
}

/**
 * Approve a reconciliation
 */
export async function approveReconciliation(
  reconciliationId: string,
  approvedBy: string,
  notes?: string
): Promise<void> {
  const reconciliationRef = adminDb.collection('delivery_reconciliations').doc(reconciliationId)
  
  await reconciliationRef.update({
    status: 'approved',
    reviewedAt: new Date().toISOString(),
    reviewedBy: approvedBy,
    approvalNotes: notes,
  })
}

/**
 * Dispute a reconciliation
 */
export async function disputeReconciliation(
  reconciliationId: string,
  disputedBy: string,
  reason: string
): Promise<void> {
  const reconciliationRef = adminDb.collection('delivery_reconciliations').doc(reconciliationId)
  
  await reconciliationRef.update({
    status: 'disputed',
    reviewedAt: new Date().toISOString(),
    reviewedBy: disputedBy,
    disputeReason: reason,
  })
}

/**
 * Resolve a reconciliation with adjustments
 */
export async function resolveReconciliation(
  reconciliationId: string,
  resolvedBy: string,
  adjustedAmount?: number,
  creditNoteNumber?: string,
  debitNoteNumber?: string,
  resolutionNotes?: string
): Promise<void> {
  const reconciliationRef = adminDb.collection('delivery_reconciliations').doc(reconciliationId)
  
  await reconciliationRef.update({
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy,
    adjustedAmount,
    creditNoteNumber,
    debitNoteNumber,
    resolutionNotes,
  })
}
