/**
 * API Route: GET /api/supplier/reconciliations
 * List and filter delivery reconciliations
 * Part of Phase 1.2 Three-Way Match Reconciliation
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { auth } from '@/lib/firebase'
import type { DeliveryReconciliation, ReconciliationSummary } from '@/types/reconciliation'

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const user = auth?.currentUser
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const status = searchParams.get('status')
    const matchStatus = searchParams.get('matchStatus')
    const supplierId = searchParams.get('supplierId')
    
    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing required parameter: orgId' },
        { status: 400 }
      )
    }

    // 3. Build query
    let query = adminDb
      .collection('delivery_reconciliations')
      .where('orgId', '==', orgId)
    
    if (status) {
      query = query.where('status', '==', status)
    }
    
    if (matchStatus) {
      query = query.where('matchStatus', '==', matchStatus)
    }
    
    if (supplierId) {
      query = query.where('supplierId', '==', supplierId)
    }
    
    // Order by creation date, newest first
    query = query.orderBy('createdAt', 'desc')

    // 4. Execute query
    const snapshot = await query.get()
    const reconciliations: DeliveryReconciliation[] = []
    
    snapshot.forEach(doc => {
      reconciliations.push(doc.data() as DeliveryReconciliation)
    })

    // 5. Calculate summary statistics
    const summary: ReconciliationSummary = {
      total: reconciliations.length,
      pendingReview: reconciliations.filter(r => r.status === 'pending_review').length,
      approved: reconciliations.filter(r => r.status === 'approved').length,
      disputed: reconciliations.filter(r => r.status === 'disputed').length,
      resolved: reconciliations.filter(r => r.status === 'resolved').length,
      totalDiscrepancyAmount: reconciliations.reduce((sum, r) => sum + r.totalDiscrepancyAmount, 0),
      averageDiscrepancyPercent: reconciliations.length > 0
        ? reconciliations.reduce((sum, r) => sum + r.discrepancyPercentage, 0) / reconciliations.length
        : 0,
      perfectMatches: reconciliations.filter(r => r.matchStatus === 'perfect_match').length,
      minorVariances: reconciliations.filter(r => r.matchStatus === 'minor_variance').length,
      significantVariances: reconciliations.filter(r => r.matchStatus === 'significant_variance').length,
      majorDiscrepancies: reconciliations.filter(r => r.matchStatus === 'major_discrepancy').length,
    }

    // 6. Return results
    return NextResponse.json({
      reconciliations,
      summary,
    }, { status: 200 })

  } catch (error: any) {
    console.error('Error in /api/supplier/reconciliations:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch reconciliations',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
