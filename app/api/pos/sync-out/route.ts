/**
 * API Route: POST /api/pos/sync-out
 * Send inventory/price updates to external POS systems via webhooks
 * Part of Phase 1.1 Two-way Sync with External POS
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendWebhook } from '@/lib/pos-sync-operations'
import type { SendWebhookRequest } from '@/types/pos-sync'
import { auth } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const user = auth?.currentUser
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body = await request.json() as SendWebhookRequest

    // 3. Validation
    if (!body.orgId || !body.eventType || !body.payload) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, eventType, payload' },
        { status: 400 }
      )
    }

    // Validate event type
    const validEventTypes = [
      'stock.updated',
      'price.updated',
      'product.created',
      'product.updated',
      'product.deleted',
    ]

    if (!validEventTypes.includes(body.eventType)) {
      return NextResponse.json(
        { error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate payload has required fields
    if (!body.payload.eventType || !body.payload.orgId || !body.payload.productId) {
      return NextResponse.json(
        { error: 'Payload must have eventType, orgId, and productId' },
        { status: 400 }
      )
    }

    // 4. Send webhook(s)
    const result = await sendWebhook(body)

    // 5. Return response
    return NextResponse.json(result, { status: result.success ? 200 : 207 }) // 207 = Multi-Status

  } catch (error: any) {
    console.error('Error in /api/pos/sync-out:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to send webhook',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
