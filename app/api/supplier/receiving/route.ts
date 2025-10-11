/**
 * API Route: POST /api/supplier/receiving
 * Accept delivery confirmation and atomically update inventory
 * Part of Phase 1.1 Receiving Flow Completion
 */

import { NextRequest, NextResponse } from 'next/server'
import { receiveDelivery } from '@/lib/purchase-order-operations'
import type { ReceiveDeliveryRequest } from '@/types/purchase-orders'
import { getAuth } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check - get current user
    const user = auth?.currentUser
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body = await request.json() as ReceiveDeliveryRequest

    // 3. Validation
    if (!body.poId || !body.orgId || !body.receivedLines || body.receivedLines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: poId, orgId, receivedLines' },
        { status: 400 }
      )
    }

    // Validate receivedLines structure
    for (const line of body.receivedLines) {
      if (!line.productId || typeof line.quantityReceived !== 'number' || line.quantityReceived < 0) {
        return NextResponse.json(
          { error: 'Invalid receivedLines: each must have productId and quantityReceived >= 0' },
          { status: 400 }
        )
      }
    }

    // 4. Set receivedBy to current user
    const deliveryRequest: ReceiveDeliveryRequest = {
      ...body,
      receivedBy: user.uid,
    }

    // 5. Execute receiving transaction
    const result = await receiveDelivery(deliveryRequest)

    // 6. Return success response
    return NextResponse.json(result, { status: 200 })

  } catch (error: any) {
    console.error('Error in /api/supplier/receiving:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to receive delivery',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
