/**
 * Auto-replenishment engine for inventory management
 * Analyzes stock levels and generates replenishment suggestions
 */

import { getFirestore } from 'firebase/firestore'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  orderBy,
  limit,
  getDoc,
} from 'firebase/firestore'
import type { InventoryRecord, POSProduct } from './types'
import type {
  ReplenishmentSuggestion,
  SupplierSKU,
  ReplenishmentSettings,
  ReplenishmentJob,
} from '@/types/replenishment'

/**
 * Calculate total stock in pieces
 */
function calculateTotalStock(inventory: InventoryRecord): number {
  return (inventory.qtyBase || 0) * (inventory.unitsPerBase || 1) + (inventory.qtyLoose || 0)
}

/**
 * Determine priority based on stock level vs reorder point
 */
function calculatePriority(
  currentStock: number,
  reorderPoint: number
): 'low' | 'medium' | 'high' | 'critical' {
  const stockPercentage = (currentStock / reorderPoint) * 100

  if (stockPercentage <= 0) return 'critical' // out of stock
  if (stockPercentage <= 25) return 'critical'
  if (stockPercentage <= 50) return 'high'
  if (stockPercentage <= 75) return 'medium'
  return 'low'
}

/**
 * Find the best supplier for a product based on lead time and availability
 */
async function findBestSupplier(
  productId: string,
  orgId: string
): Promise<SupplierSKU | null> {
  const db = getFirestore()
  
  try {
    const supplierSkusQuery = query(
      collection(db, 'supplier_skus'),
      where('productId', '==', productId),
      where('availability', 'in', ['in_stock', 'low_stock']),
      orderBy('leadTimeDays', 'asc'),
      limit(1)
    )

    const snapshot = await getDocs(supplierSkusQuery)

    if (snapshot.empty) {
      // Fallback: get any supplier for this product
      const fallbackQuery = query(
        collection(db, 'supplier_skus'),
        where('productId', '==', productId),
        limit(1)
      )
      const fallbackSnapshot = await getDocs(fallbackQuery)
      if (fallbackSnapshot.empty) return null

      const doc = fallbackSnapshot.docs[0]
      return { id: doc.id, ...doc.data() } as SupplierSKU
    }

    const doc = snapshot.docs[0]
    return { id: doc.id, ...doc.data() } as SupplierSKU
  } catch (error) {
    console.error('Error finding best supplier:', error)
    return null
  }
}

/**
 * Calculate suggested order quantity
 */
function calculateSuggestedQty(
  currentStock: number,
  reorderPoint: number,
  reorderQty: number | undefined,
  minOrderQty: number,
  safetyMultiplier: number = 1.5
): number {
  // If reorderQty is explicitly set, use it
  if (reorderQty && reorderQty > 0) {
    return Math.max(reorderQty, minOrderQty)
  }

  // Otherwise, calculate to reach reorder point + safety stock
  const targetStock = reorderPoint * safetyMultiplier
  const deficit = targetStock - currentStock
  const suggestedQty = Math.max(deficit, minOrderQty)

  return Math.ceil(suggestedQty)
}

/**
 * Check inventory and generate replenishment suggestions
 */
export async function generateReplenishmentSuggestions(
  orgId: string,
  settings?: Partial<ReplenishmentSettings>
): Promise<ReplenishmentSuggestion[]> {
  const db = getFirestore()
  
  const jobStart = Date.now()
  const suggestions: ReplenishmentSuggestion[] = []
  const errors: string[] = []

  try {
    // Create job record
    const jobRef = await addDoc(collection(db, 'replenishment_jobs'), {
      orgId,
      runAt: Timestamp.now().toDate().toISOString(),
      status: 'running',
      suggestionsCreated: 0,
      productsChecked: 0,
    } as ReplenishmentJob)

    // Fetch all inventory records for org
    const inventoryQuery = query(
      collection(db, 'pos_inventory'),
      where('orgId', '==', orgId)
    )
    const inventorySnapshot = await getDocs(inventoryQuery)
    const inventory = inventorySnapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as any as InventoryRecord)
    )

    // Fetch all products for org
    const productsQuery = query(
      collection(db, 'pos_products'),
      where('orgId', '==', orgId)
    )
    const productsSnapshot = await getDocs(productsQuery)
    const products = productsSnapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as POSProduct)
    )

    let productsChecked = 0
    let suggestionsCreated = 0

    // Check each product
    for (const product of products) {
      productsChecked++

      try {
        // Find inventory record
        const invRecord = inventory.find((inv) => inv.productId === product.id)
        if (!invRecord) continue

        // Calculate current stock
        const currentStock = calculateTotalStock(invRecord)

        // Check if below reorder point
        const reorderPoint = product.reorderPoint || 10 // default reorder point
        if (currentStock >= reorderPoint) continue

        // Find best supplier
        const supplier = await findBestSupplier(product.id!, orgId)
        if (!supplier) {
          errors.push(`No supplier found for product: ${product.name}`)
          continue
        }

        // Calculate suggested quantity
        const suggestedQty = calculateSuggestedQty(
          currentStock,
          reorderPoint,
          product.reorderQty,
          supplier.minOrderQty || 1,
          settings?.safetyStockMultiplier || 1.5
        )

        // Calculate priority
        const priority = calculatePriority(currentStock, reorderPoint)

        // Create suggestion
        const suggestion: ReplenishmentSuggestion = {
          orgId,
          productId: product.id!,
          productName: product.name,
          currentStock,
          reorderPoint,
          suggestedQty,
          preferredSupplierId: supplier.supplierId,
          preferredSupplierName: supplier.supplierName,
          supplierLeadTime: supplier.leadTimeDays,
          unitCost: supplier.cost,
          totalCost: supplier.cost * suggestedQty,
          status: 'pending',
          createdAt: Timestamp.now().toDate().toISOString(),
          reason: currentStock === 0 
            ? 'Out of stock' 
            : `Stock below reorder point (${currentStock}/${reorderPoint})`,
          priority,
        }

        // Save suggestion to Firestore
        await addDoc(collection(db, 'replenishment_suggestions'), suggestion)
        suggestions.push(suggestion)
        suggestionsCreated++
      } catch (error) {
        const errMsg = `Error processing product ${product.name}: ${error}`
        console.error(errMsg)
        errors.push(errMsg)
      }
    }

    // Update job record
    await updateDoc(doc(db, 'replenishment_jobs', jobRef.id), {
      status: 'completed',
      suggestionsCreated,
      productsChecked,
      errors: errors.length > 0 ? errors : undefined,
      completedAt: Timestamp.now().toDate().toISOString(),
      durationMs: Date.now() - jobStart,
    })

    console.log(
      `Replenishment check complete: ${suggestionsCreated} suggestions from ${productsChecked} products`
    )

    return suggestions
  } catch (error) {
    console.error('Fatal error in replenishment generation:', error)
    throw error
  }
}

/**
 * Approve a replenishment suggestion
 */
export async function approveReplenishmentSuggestion(
  suggestionId: string,
  userId: string
): Promise<void> {
  const db = getFirestore()
  
  const suggestionRef = doc(db, 'replenishment_suggestions', suggestionId)

  await updateDoc(suggestionRef, {
    status: 'approved',
    approvedAt: Timestamp.now().toDate().toISOString(),
    approvedBy: userId,
  })
}

/**
 * Reject a replenishment suggestion
 */
export async function rejectReplenishmentSuggestion(
  suggestionId: string
): Promise<void> {
  const db = getFirestore()
  
  const suggestionRef = doc(db, 'replenishment_suggestions', suggestionId)

  await updateDoc(suggestionRef, {
    status: 'rejected',
  })
}

/**
 * Mark suggestion as ordered (link to PO)
 */
export async function markSuggestionOrdered(
  suggestionId: string,
  purchaseOrderId: string
): Promise<void> {
  const db = getFirestore()
  
  const suggestionRef = doc(db, 'replenishment_suggestions', suggestionId)

  await updateDoc(suggestionRef, {
    status: 'ordered',
    orderedAt: Timestamp.now().toDate().toISOString(),
    purchaseOrderId,
  })
}

/**
 * Get pending suggestions for organization
 */
export async function getPendingReplenishmentSuggestions(
  orgId: string
): Promise<ReplenishmentSuggestion[]> {
  const db = getFirestore()
  
  const suggestionsQuery = query(
    collection(db, 'replenishment_suggestions'),
    where('orgId', '==', orgId),
    where('status', '==', 'pending'),
    orderBy('priority', 'desc'),
    orderBy('createdAt', 'desc')
  )

  const snapshot = await getDocs(suggestionsQuery)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ReplenishmentSuggestion))
}

/**
 * Batch approve multiple suggestions and create purchase orders
 */
export async function batchApproveAndCreatePO(
  suggestionIds: string[],
  userId: string,
  orgId: string
): Promise<{ poId: string; suggestions: ReplenishmentSuggestion[] }> {
  const db = getFirestore()
  
  // Fetch all suggestions
  const suggestions: ReplenishmentSuggestion[] = []

  for (const id of suggestionIds) {
    const suggestionRef = doc(db, 'replenishment_suggestions', id)
    const suggestionSnap = await getDoc(suggestionRef)
    if (suggestionSnap.exists()) {
      suggestions.push({ id, ...suggestionSnap.data() } as ReplenishmentSuggestion)
    }
  }

  if (suggestions.length === 0) {
    throw new Error('No valid suggestions found')
  }

  // Group by supplier
  const supplierGroups = new Map<string, ReplenishmentSuggestion[]>()
  suggestions.forEach((s) => {
    const existing = supplierGroups.get(s.preferredSupplierId) || []
    existing.push(s)
    supplierGroups.set(s.preferredSupplierId, existing)
  })

  // For now, create one PO (future: create multiple POs per supplier)
  const firstSupplier = Array.from(supplierGroups.keys())[0]
  const items = supplierGroups.get(firstSupplier)!

  // Create purchase order
  const poData = {
    orgId,
    supplierId: firstSupplier,
    supplierName: items[0].preferredSupplierName,
    status: 'draft',
    createdAt: Timestamp.now().toDate().toISOString(),
    createdBy: userId,
    lines: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.suggestedQty,
      unitCost: item.unitCost,
      lineTotal: item.totalCost,
    })),
    total: items.reduce((sum, item) => sum + item.totalCost, 0),
    notes: 'Auto-generated from replenishment suggestions',
  }

  const poRef = await addDoc(collection(db, 'purchase_orders'), poData)

  // Mark all suggestions as ordered
  for (const suggestion of suggestions) {
    await markSuggestionOrdered(suggestion.id!, poRef.id)
  }

  return { poId: poRef.id, suggestions }
}
