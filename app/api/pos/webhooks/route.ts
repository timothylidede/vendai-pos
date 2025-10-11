/**
 * API Route: GET/POST /api/pos/webhooks
 * Manage webhook configurations for external POS sync
 * Part of Phase 1.1 Two-way Sync with External POS
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, auth } from '@/lib/firebase'
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { WEBHOOK_CONFIGS_COL } from '@/lib/pos-sync-operations'
import type { POSSyncWebhookConfig } from '@/types/pos-sync'

// GET - List webhook configs for an org
export async function GET(request: NextRequest) {
  try {
    const user = auth?.currentUser
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId query parameter required' },
        { status: 400 }
      )
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    const q = query(
      collection(db, WEBHOOK_CONFIGS_COL),
      where('orgId', '==', orgId)
    )

    const snap = await getDocs(q)
    const webhooks = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as POSSyncWebhookConfig[]

    return NextResponse.json({ webhooks }, { status: 200 })

  } catch (error: any) {
    console.error('Error in GET /api/pos/webhooks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch webhooks' },
      { status: 500 }
    )
  }
}

// POST - Create new webhook config
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

    // Validation
    if (!body.orgId || !body.name || !body.url) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, name, url' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(body.url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    // Default retry configuration
    const defaultRetryConfig = {
      maxAttempts: 5,
      backoffMultiplier: 2,
      initialDelayMs: 1000,      // 1 second
      maxDelayMs: 3600000,        // 1 hour
    }

    const webhookData: Omit<POSSyncWebhookConfig, 'id'> = {
      orgId: body.orgId,
      name: body.name,
      url: body.url,
      secret: body.secret,
      enabled: body.enabled !== false, // Default to true
      events: body.events || ['stock.updated', 'price.updated'],
      headers: body.headers || {},
      retryConfig: body.retryConfig || defaultRetryConfig,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    }

    const docRef = await addDoc(collection(db, WEBHOOK_CONFIGS_COL), webhookData)

    return NextResponse.json(
      { 
        success: true,
        webhookId: docRef.id,
        message: 'Webhook configuration created'
      },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('Error in POST /api/pos/webhooks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create webhook' },
      { status: 500 }
    )
  }
}
