/**
 * POS Sync Operations - Webhook delivery with retry logic
 * Part of Phase 1.1 Two-way Sync with External POS
 */

import { db } from '@/lib/firebase'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore'
import type {
  POSSyncWebhookConfig,
  WebhookDeliveryLog,
  WebhookPayload,
  WebhookEventType,
  SendWebhookRequest,
  SendWebhookResponse,
} from '@/types/pos-sync'
import crypto from 'crypto'

export const WEBHOOK_CONFIGS_COL = 'pos_webhook_configs'
export const WEBHOOK_LOGS_COL = 'pos_sync_logs'

/**
 * Get all active webhook configs for an organization
 */
export async function getActiveWebhooks(
  orgId: string,
  eventType?: WebhookEventType
): Promise<POSSyncWebhookConfig[]> {
  if (!db) throw new Error('Firestore not initialized')

  let q = query(
    collection(db, WEBHOOK_CONFIGS_COL),
    where('orgId', '==', orgId),
    where('enabled', '==', true)
  )

  const snap = await getDocs(q)
  let configs = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as POSSyncWebhookConfig[]

  // Filter by event type if specified
  if (eventType) {
    configs = configs.filter(c => c.events.includes(eventType))
  }

  return configs
}

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

/**
 * Calculate next retry delay using exponential backoff
 */
function calculateNextRetryDelay(
  attemptCount: number,
  config: POSSyncWebhookConfig['retryConfig']
): number {
  const delay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptCount - 1),
    config.maxDelayMs
  )
  return delay
}

/**
 * Send webhook to external POS system
 */
export async function deliverWebhook(
  webhookConfig: POSSyncWebhookConfig,
  payload: WebhookPayload
): Promise<{ success: boolean; status?: number; error?: string; responseBody?: string }> {
  try {
    const payloadString = JSON.stringify(payload)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'VendAI-POS-Sync/1.0',
      'X-VendAI-Event': payload.eventType,
      'X-VendAI-Timestamp': new Date().toISOString(),
      ...webhookConfig.headers,
    }

    // Add HMAC signature if secret is configured
    if (webhookConfig.secret) {
      headers['X-VendAI-Signature'] = generateSignature(payloadString, webhookConfig.secret)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseBody = await response.text().catch(() => '')

    if (response.ok) {
      return {
        success: true,
        status: response.status,
        responseBody: responseBody.substring(0, 1000), // Truncate to 1KB
      }
    } else {
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}`,
        responseBody: responseBody.substring(0, 1000),
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

/**
 * Send webhook with retry logic
 */
export async function sendWebhook(request: SendWebhookRequest): Promise<SendWebhookResponse> {
  if (!db) throw new Error('Firestore not initialized')

  // Get active webhooks for this event type
  const webhooks = await getActiveWebhooks(request.orgId, request.eventType)

  if (webhooks.length === 0) {
    return {
      success: true,
      deliveryLogId: '',
      delivered: 0,
      failed: 0,
      message: 'No active webhooks configured for this event',
    }
  }

  let delivered = 0
  let failed = 0
  const logIds: string[] = []

  // Send to each webhook
  for (const webhook of webhooks) {
    // Create delivery log
    const logData: Omit<WebhookDeliveryLog, 'id'> = {
      orgId: request.orgId,
      webhookConfigId: webhook.id,
      webhookUrl: webhook.url,
      eventType: request.eventType,
      payload: request.payload,
      status: 'pending',
      attemptCount: 0,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    }

    const logRef = await addDoc(collection(db, WEBHOOK_LOGS_COL), logData)
    logIds.push(logRef.id)

    // Attempt delivery
    const result = await deliverWebhook(webhook, request.payload)

    // Update log
    if (result.success) {
      await updateDoc(logRef, {
        status: 'delivered',
        attemptCount: 1,
        lastAttemptAt: serverTimestamp(),
        responseStatus: result.status,
        responseBody: result.responseBody,
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      delivered++
    } else {
      // Schedule retry
      const nextRetryDelay = calculateNextRetryDelay(1, webhook.retryConfig)
      const nextRetryAt = new Date(Date.now() + nextRetryDelay)

      await updateDoc(logRef, {
        status: webhook.retryConfig.maxAttempts > 1 ? 'retrying' : 'failed',
        attemptCount: 1,
        lastAttemptAt: serverTimestamp(),
        nextRetryAt: webhook.retryConfig.maxAttempts > 1 ? nextRetryAt : undefined,
        responseStatus: result.status,
        responseBody: result.responseBody,
        error: result.error,
        updatedAt: serverTimestamp(),
      })
      failed++
    }
  }

  return {
    success: failed === 0,
    deliveryLogId: logIds[0] || '',
    delivered,
    failed,
    message: `Sent to ${delivered}/${webhooks.length} webhooks`,
  }
}

/**
 * Retry failed webhook deliveries
 * This should be called by a background job (Cloud Function)
 */
export async function retryFailedWebhooks(): Promise<{
  retried: number
  succeeded: number
  failed: number
}> {
  if (!db) throw new Error('Firestore not initialized')

  const now = new Date()
  let retried = 0
  let succeeded = 0
  let failed = 0

  // Find logs that need retry
  const q = query(
    collection(db, WEBHOOK_LOGS_COL),
    where('status', '==', 'retrying'),
    orderBy('nextRetryAt', 'asc'),
    firestoreLimit(50) // Process 50 at a time
  )

  const snap = await getDocs(q)

  for (const docSnap of snap.docs) {
    const log = { id: docSnap.id, ...docSnap.data() } as WebhookDeliveryLog

    // Check if it's time to retry
    const nextRetryAt = log.nextRetryAt ? new Date(log.nextRetryAt) : new Date(0)
    if (nextRetryAt > now) {
      continue // Not yet time to retry
    }

    // Get webhook config
    const webhookRef = doc(db, WEBHOOK_CONFIGS_COL, log.webhookConfigId)
    const webhookSnap = await getDoc(webhookRef)

    if (!webhookSnap.exists()) {
      // Webhook config was deleted, mark as failed
      await updateDoc(docSnap.ref, {
        status: 'failed',
        error: 'Webhook configuration deleted',
        updatedAt: serverTimestamp(),
      })
      failed++
      continue
    }

    const webhook = { id: webhookSnap.id, ...webhookSnap.data() } as POSSyncWebhookConfig

    if (!webhook.enabled) {
      // Webhook was disabled, mark as failed
      await updateDoc(docSnap.ref, {
        status: 'failed',
        error: 'Webhook disabled',
        updatedAt: serverTimestamp(),
      })
      failed++
      continue
    }

    // Attempt delivery
    retried++
    const result = await deliverWebhook(webhook, log.payload)
    const newAttemptCount = log.attemptCount + 1

    if (result.success) {
      await updateDoc(docSnap.ref, {
        status: 'delivered',
        attemptCount: newAttemptCount,
        lastAttemptAt: serverTimestamp(),
        responseStatus: result.status,
        responseBody: result.responseBody,
        deliveredAt: serverTimestamp(),
        nextRetryAt: null,
        updatedAt: serverTimestamp(),
      })
      succeeded++
    } else {
      // Check if we've exhausted retries
      if (newAttemptCount >= webhook.retryConfig.maxAttempts) {
        await updateDoc(docSnap.ref, {
          status: 'failed',
          attemptCount: newAttemptCount,
          lastAttemptAt: serverTimestamp(),
          responseStatus: result.status,
          responseBody: result.responseBody,
          error: result.error,
          nextRetryAt: null,
          updatedAt: serverTimestamp(),
        })
        failed++
      } else {
        // Schedule next retry
        const nextRetryDelay = calculateNextRetryDelay(newAttemptCount, webhook.retryConfig)
        const nextRetryAt = new Date(Date.now() + nextRetryDelay)

        await updateDoc(docSnap.ref, {
          attemptCount: newAttemptCount,
          lastAttemptAt: serverTimestamp(),
          nextRetryAt,
          responseStatus: result.status,
          responseBody: result.responseBody,
          error: result.error,
          updatedAt: serverTimestamp(),
        })
        // Still retrying, don't count as failed yet
      }
    }
  }

  return { retried, succeeded, failed }
}

/**
 * Get webhook delivery logs for an organization
 */
export async function getWebhookLogs(
  orgId: string,
  limitCount = 50
): Promise<WebhookDeliveryLog[]> {
  if (!db) throw new Error('Firestore not initialized')

  const q = query(
    collection(db, WEBHOOK_LOGS_COL),
    where('orgId', '==', orgId),
    orderBy('createdAt', 'desc'),
    firestoreLimit(limitCount)
  )

  const snap = await getDocs(q)
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as WebhookDeliveryLog[]
}
