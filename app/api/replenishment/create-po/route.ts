/**
 * POST /api/replenishment/create-po
 * Batch approve suggestions and create purchase order
 */

import { NextRequest, NextResponse } from 'next/server'
import { batchApproveAndCreatePO } from '@/lib/replenishment-engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { suggestionIds, userId, orgId } = body

    if (!suggestionIds || !Array.isArray(suggestionIds) || suggestionIds.length === 0) {
      return NextResponse.json(
        { error: 'suggestionIds array is required' },
        { status: 400 }
      )
    }

    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'userId and orgId are required' },
        { status: 400 }
      )
    }

    console.log(`📦 Creating PO from ${suggestionIds.length} suggestions for org: ${orgId}`)

    const result = await batchApproveAndCreatePO(suggestionIds, userId, orgId)

    return NextResponse.json({
      success: true,
      poId: result.poId,
      suggestionsCount: result.suggestions.length,
      totalCost: result.suggestions.reduce((sum, s) => sum + s.totalCost, 0),
      message: `Purchase order ${result.poId} created successfully`
    })
  } catch (error: any) {
    console.error('Error creating PO from suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order', details: error.message },
      { status: 500 }
    )
  }
}
