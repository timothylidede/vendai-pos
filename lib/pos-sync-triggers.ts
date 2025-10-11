/**
 * POS Sync Triggers - Automatically send webhooks on inventory/price changes
 * Part of Phase 1.1 Two-way Sync with External POS
 */

import { sendWebhook } from './pos-sync-operations'
import type { StockUpdateEvent, PriceUpdateEvent } from '@/types/pos-sync'
import type { InventoryRecord, POSProduct } from './types'

/**
 * Trigger stock update webhook after inventory changes
 * Call this after updating inventory in receiveDelivery or addPosOrder
 */
export async function triggerStockUpdateWebhook(
  orgId: string,
  productId: string,
  inventory: InventoryRecord,
  product?: POSProduct
): Promise<void> {
  try {
    const totalPieces = inventory.qtyBase * inventory.unitsPerBase + inventory.qtyLoose
    const reorderPoint = 10 // TODO: Get from product config
    const lowStock = totalPieces < reorderPoint

    const payload: StockUpdateEvent = {
      eventType: 'stock.updated',
      orgId,
      productId,
      productName: product?.name || productId,
      barcode: product?.pieceBarcode,
      sku: productId,
      qtyBase: inventory.qtyBase,
      qtyLoose: inventory.qtyLoose,
      unitsPerBase: inventory.unitsPerBase,
      totalPieces,
      lowStock,
      timestamp: new Date().toISOString(),
    }

    await sendWebhook({
      orgId,
      eventType: 'stock.updated',
      payload,
    })
  } catch (error) {
    console.error('Failed to trigger stock update webhook:', error)
    // Don't throw - webhook failures shouldn't block inventory updates
  }
}

/**
 * Trigger price update webhook after product price changes
 * Call this after updating pos_products.retailPrice
 */
export async function triggerPriceUpdateWebhook(
  orgId: string,
  productId: string,
  oldPrice: number | undefined,
  newPrice: number,
  product?: POSProduct
): Promise<void> {
  try {
    const payload: PriceUpdateEvent = {
      eventType: 'price.updated',
      orgId,
      productId,
      productName: product?.name || productId,
      barcode: product?.pieceBarcode,
      sku: productId,
      oldPrice,
      newPrice,
      currency: 'KES',
      timestamp: new Date().toISOString(),
    }

    await sendWebhook({
      orgId,
      eventType: 'price.updated',
      payload,
    })
  } catch (error) {
    console.error('Failed to trigger price update webhook:', error)
    // Don't throw - webhook failures shouldn't block price updates
  }
}

/**
 * Batch trigger stock updates for multiple products
 * Useful after bulk inventory imports
 */
export async function triggerBatchStockUpdates(
  orgId: string,
  updates: Array<{
    productId: string
    inventory: InventoryRecord
    product?: POSProduct
  }>
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (const update of updates) {
    try {
      await triggerStockUpdateWebhook(
        orgId,
        update.productId,
        update.inventory,
        update.product
      )
      sent++
    } catch (error) {
      failed++
      console.error(`Failed to send webhook for product ${update.productId}:`, error)
    }
  }

  return { sent, failed }
}
