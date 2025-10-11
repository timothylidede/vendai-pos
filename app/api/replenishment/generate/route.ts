/**
 * POST /api/replenishment/generate
 * Manually trigger replenishment check for an organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateReplenishmentSuggestions } from '@/lib/replenishment-engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orgId, settings } = body

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId is required' },
        { status: 400 }
      )
    }

    console.log(`🔄 Generating replenishment suggestions for org: ${orgId}`)

    const suggestions = await generateReplenishmentSuggestions(orgId, settings)

    return NextResponse.json({
      success: true,
      suggestions,
      count: suggestions.length,
      message: `Generated ${suggestions.length} replenishment suggestions`
    })
  } catch (error: any) {
    console.error('Error generating replenishment suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions', details: error.message },
      { status: 500 }
    )
  }
}
