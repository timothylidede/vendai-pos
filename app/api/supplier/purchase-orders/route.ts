/**
 * API Route: POST /api/supplier/purchase-orders
 * Create a new purchase order from supplier cart
 * Part of Phase 1.1 Receiving Flow Completion
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPurchaseOrder } from '@/lib/purchase-order-operations'
import type { CreatePurchaseOrderRequest } from '@/types/purchase-orders'
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
    const body = await request.json() as CreatePurchaseOrderRequest

    // 3. Validation
    if (!body.orgId || !body.supplierId || !body.supplierName) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, supplierId, supplierName' },
        { status: 400 }
      )
    }

    if (!body.lines || body.lines.length === 0) {
      return NextResponse.json(
        { error: 'Purchase order must have at least one line item' },
        { status: 400 }
      )
    }

    // Validate line items
    for (const line of body.lines) {
      if (!line.productId || !line.productName || typeof line.quantity !== 'number' || line.quantity <= 0) {
        return NextResponse.json(
          { error: 'Invalid line item: must have productId, productName, and quantity > 0' },
          { status: 400 }
        )
      }
      if (typeof line.unitPrice !== 'number' || line.unitPrice < 0) {
        return NextResponse.json(
          { error: 'Invalid line item: unitPrice must be a non-negative number' },
          { status: 400 }
        )
      }
    }

    // 4. Create purchase order
    const poId = await createPurchaseOrder(body, user.uid)

    // 5. Return success
    return NextResponse.json(
      { 
        success: true,
        poId,
        message: 'Purchase order created successfully'
      },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('Error in /api/supplier/purchase-orders:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create purchase order',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
