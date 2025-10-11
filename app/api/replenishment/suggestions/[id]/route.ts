/**
 * PATCH /api/replenishment/suggestions/[id]
 * Approve or reject a replenishment suggestion
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  approveReplenishmentSuggestion,
  rejectReplenishmentSuggestion
} from '@/lib/replenishment-engine'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { action, userId } = body

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'action and userId are required' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      await approveReplenishmentSuggestion(id, userId)
      return NextResponse.json({
        success: true,
        message: 'Suggestion approved',
        suggestionId: id
      })
    } else if (action === 'reject') {
      await rejectReplenishmentSuggestion(id)
      return NextResponse.json({
        success: true,
        message: 'Suggestion rejected',
        suggestionId: id
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Error updating suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to update suggestion', details: error.message },
      { status: 500 }
    )
  }
}
