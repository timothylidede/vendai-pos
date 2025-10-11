/**
 * POS Sync Types - Two-way sync with external POS systems
 * Part of Phase 1.1 Two-way Sync with External POS
 */

export type WebhookEventType = 
  | 'stock.updated'
  | 'price.updated'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'

export type WebhookDeliveryStatus = 
  | 'pending'
  | 'delivered'
  | 'failed'
  | 'retrying'

export interface POSSyncWebhookConfig {
  id: string
  orgId: string
  name: string
  url: string
  secret?: string              // For HMAC signature verification
  enabled: boolean
  events: WebhookEventType[]   // Which events to send
  headers?: Record<string, string>  // Custom headers
  retryConfig: {
    maxAttempts: number
    backoffMultiplier: number  // e.g., 2 for exponential backoff
    initialDelayMs: number     // e.g., 1000 for 1 second
    maxDelayMs: number         // e.g., 3600000 for 1 hour
  }
  createdAt: Date | string
  updatedAt: Date | string
}

export interface StockUpdateEvent {
  eventType: 'stock.updated'
  orgId: string
  productId: string
  productName: string
  barcode?: string
  sku?: string
  qtyBase: number
  qtyLoose: number
  unitsPerBase: number
  totalPieces: number
  lowStock: boolean
  timestamp: string
}

export interface PriceUpdateEvent {
  eventType: 'price.updated'
  orgId: string
  productId: string
  productName: string
  barcode?: string
  sku?: string
  oldPrice?: number
  newPrice: number
  currency: string
  timestamp: string
}

export interface ProductEvent {
  eventType: 'product.created' | 'product.updated' | 'product.deleted'
  orgId: string
  productId: string
  product?: {
    name: string
    barcode?: string
    sku?: string
    price?: number
    category?: string
    brand?: string
  }
  timestamp: string
}

export type WebhookPayload = StockUpdateEvent | PriceUpdateEvent | ProductEvent

export interface WebhookDeliveryLog {
  id: string
  orgId: string
  webhookConfigId: string
  webhookUrl: string
  eventType: WebhookEventType
  payload: WebhookPayload
  status: WebhookDeliveryStatus
  attemptCount: number
  lastAttemptAt?: Date | string
  nextRetryAt?: Date | string
  responseStatus?: number
  responseBody?: string
  error?: string
  deliveredAt?: Date | string
  createdAt: Date | string
  updatedAt: Date | string
}

export interface SendWebhookRequest {
  orgId: string
  eventType: WebhookEventType
  payload: WebhookPayload
}

export interface SendWebhookResponse {
  success: boolean
  deliveryLogId: string
  delivered: number  // How many webhooks were sent
  failed: number
  message: string
}
