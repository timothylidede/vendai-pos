/**
 * API Route: PATCH/DELETE /api/pos/webhooks/[id]
 * Update or delete individual webhook configurations
 * Part of Phase 1.1 Two-way Sync with External POS
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, auth } from '@/lib/firebase'
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { WEBHOOK_CONFIGS_COL } from '@/lib/pos-sync-operations'

// PATCH - Update webhook config
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = auth?.currentUser
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params
    const body = await request.json()

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    const webhookRef = doc(db, WEBHOOK_CONFIGS_COL, id)
    const webhookSnap = await getDoc(webhookRef)

    if (!webhookSnap.exists()) {
      return NextResponse.json(
        { error: 'Webhook configuration not found' },
        { status: 404 }
      )
    }

    // Validate URL if provided
    if (body.url) {
      try {
        new URL(body.url)
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        )
      }
    }

    // Build update object (only fields that are provided)
    const updateData: any = {
      updatedAt: serverTimestamp(),
    }

    if (body.name !== undefined) updateData.name = body.name
    if (body.url !== undefined) updateData.url = body.url
    if (body.secret !== undefined) updateData.secret = body.secret
    if (body.enabled !== undefined) updateData.enabled = body.enabled
    if (body.events !== undefined) updateData.events = body.events
    if (body.headers !== undefined) updateData.headers = body.headers
    if (body.retryConfig !== undefined) updateData.retryConfig = body.retryConfig

    await updateDoc(webhookRef, updateData)

    return NextResponse.json(
      { 
        success: true,
        message: 'Webhook configuration updated'
      },
      { status: 200 }
    )

  } catch (error: any) {
    console.error('Error in PATCH /api/pos/webhooks/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update webhook' },
      { status: 500 }
    )
  }
}

// DELETE - Remove webhook config
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = auth?.currentUser
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    const webhookRef = doc(db, WEBHOOK_CONFIGS_COL, id)
    const webhookSnap = await getDoc(webhookRef)

    if (!webhookSnap.exists()) {
      return NextResponse.json(
        { error: 'Webhook configuration not found' },
        { status: 404 }
      )
    }

    await deleteDoc(webhookRef)

    return NextResponse.json(
      { 
        success: true,
        message: 'Webhook configuration deleted'
      },
      { status: 200 }
    )

  } catch (error: any) {
    console.error('Error in DELETE /api/pos/webhooks/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete webhook' },
      { status: 500 }
    )
  }
}
