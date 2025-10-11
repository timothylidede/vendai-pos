/**
 * API Route: POST /api/pos/webhooks/test
 * Send a test webhook payload to verify configuration
 * Part of Phase 1.1 Two-way Sync with External POS
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, auth } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { WEBHOOK_CONFIGS_COL, deliverWebhook } from '@/lib/pos-sync-operations'
import type { POSSyncWebhookConfig, StockUpdateEvent } from '@/types/pos-sync'

export async function POST(request: NextRequest) {
  try {
    const user = auth?.currentUser
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    if (!body.webhookId) {
      return NextResponse.json(
        { error: 'webhookId is required' },
        { status: 400 }
      )
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    // Fetch webhook config
    const webhookRef = doc(db, WEBHOOK_CONFIGS_COL, body.webhookId)
    const webhookSnap = await getDoc(webhookRef)

    if (!webhookSnap.exists()) {
      return NextResponse.json(
        { error: 'Webhook configuration not found' },
        { status: 404 }
      )
    }

    const webhook = {
      id: webhookSnap.id,
      ...webhookSnap.data(),
    } as POSSyncWebhookConfig

    // Create a test payload
    const testPayload: StockUpdateEvent = {
      eventType: 'stock.updated',
      orgId: webhook.orgId,
      productId: 'test-product-123',
      qtyBase: 10,
      qtyLoose: 5,
      totalPieces: 65,
      lowStock: false,
      unitsPerBase: 6,
      barcode: '1234567890123',
      productName: 'Test Product',
      sku: 'TEST-SKU',
      timestamp: new Date().toISOString(),
    }

    // Attempt delivery
    const result = await deliverWebhook(webhook, testPayload)

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: 'Test webhook delivered successfully',
          httpStatus: result.status,
          responseBody: result.responseBody,
        },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Test webhook failed',
          error: result.error,
          httpStatus: result.status,
          responseBody: result.responseBody,
        },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error('Error in POST /api/pos/webhooks/test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to send test webhook' 
      },
      { status: 500 }
    )
  }
}
