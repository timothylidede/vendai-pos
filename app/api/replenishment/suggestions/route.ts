/**
 * GET /api/replenishment/suggestions
 * Fetch replenishment suggestions with filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPendingReplenishmentSuggestions } from '@/lib/replenishment-engine'
import { getFirestore } from 'firebase/firestore'
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore'
import type { ReplenishmentSuggestion } from '@/types/replenishment'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const status = searchParams.get('status') || 'pending'
    const priority = searchParams.get('priority')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId is required' },
        { status: 400 }
      )
    }

    const db = getFirestore()
    let suggestionsQuery = query(
      collection(db, 'replenishment_suggestions'),
      where('orgId', '==', orgId)
    )

    // Add status filter
    if (status && status !== 'all') {
      suggestionsQuery = query(suggestionsQuery, where('status', '==', status))
    }

    // Add priority filter
    if (priority && priority !== 'all') {
      suggestionsQuery = query(suggestionsQuery, where('priority', '==', priority))
    }

    // Add ordering and limit
    suggestionsQuery = query(
      suggestionsQuery,
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit)
    )

    const snapshot = await getDocs(suggestionsQuery)
    const suggestions = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as ReplenishmentSuggestion[]

    // Calculate summary statistics
    const summary = {
      total: suggestions.length,
      byStatus: suggestions.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byPriority: suggestions.reduce((acc, s) => {
        acc[s.priority] = (acc[s.priority] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      totalCost: suggestions.reduce((sum, s) => sum + s.totalCost, 0),
      criticalCount: suggestions.filter(s => s.priority === 'critical').length
    }

    return NextResponse.json({
      success: true,
      suggestions,
      summary
    })
  } catch (error: any) {
    console.error('Error fetching replenishment suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggestions', details: error.message },
      { status: 500 }
    )
  }
}
