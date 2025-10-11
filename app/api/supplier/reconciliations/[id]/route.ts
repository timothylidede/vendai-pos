/**
 * API Route: PATCH /api/supplier/reconciliations/[id]
 * Update reconciliation status (approve, dispute, resolve)
 * Part of Phase 1.2 Three-Way Match Reconciliation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/firebase'
import { approveReconciliation, disputeReconciliation, resolveReconciliation } from '@/lib/reconciliation-engine'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const body = await request.json()
    const { action, notes, adjustedAmount, creditNoteNumber, debitNoteNumber } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      )
    }

    const reconciliationId = params.id

    // 3. Execute action
    switch (action) {
      case 'approve':
        await approveReconciliation(reconciliationId, user.uid, notes)
        break
      
      case 'dispute':
        if (!notes) {
          return NextResponse.json(
            { error: 'Dispute reason (notes) is required' },
            { status: 400 }
          )
        }
        await disputeReconciliation(reconciliationId, user.uid, notes)
        break
      
      case 'resolve':
        await resolveReconciliation(
          reconciliationId,
          user.uid,
          adjustedAmount,
          creditNoteNumber,
          debitNoteNumber,
          notes
        )
        break
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: approve, dispute, or resolve' },
          { status: 400 }
        )
    }

    // 4. Return success
    return NextResponse.json({
      success: true,
      reconciliationId,
      action,
    }, { status: 200 })

  } catch (error: any) {
    console.error(`Error in /api/supplier/reconciliations/${params.id}:`, error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to update reconciliation',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
