/**
 * GET /api/supplier/price-alerts
 * List price change alerts with filters
 * 
 * POST /api/supplier/price-alerts
 * Bulk review price alerts (approve/reject)
 */

import { NextRequest, NextResponse } from 'next/server'
import type { PriceChangeAlert, BulkPriceReviewRequest } from '@/types/price-changes'
import { getFirebaseAdminDb } from '@/lib/firebase-admin'

const db = getFirebaseAdminDb()

/**
 * GET - List price change alerts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const status = searchParams.get('status') // pending, approved, rejected, adjusted
    const supplierId = searchParams.get('supplierId')

    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId parameter' }, { status: 400 })
    }

    let query = db.collection('price_change_alerts').where('orgId', '==', orgId)

    if (status) {
      query = query.where('status', '==', status)
    }

    if (supplierId) {
      query = query.where('supplierId', '==', supplierId)
    }

    const snapshot = await query.orderBy('createdAt', 'desc').limit(100).get()

    const alerts: PriceChangeAlert[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as PriceChangeAlert[]

    // Calculate summary stats
    const summary = {
      total: alerts.length,
      pending: alerts.filter(a => a.status === 'pending').length,
      approved: alerts.filter(a => a.status === 'approved').length,
      rejected: alerts.filter(a => a.status === 'rejected').length,
      adjusted: alerts.filter(a => a.status === 'adjusted').length,
      totalCostIncrease: alerts
        .filter(a => a.status === 'pending')
        .reduce((sum, a) => sum + (a.newCost - a.oldCost), 0),
    }

    return NextResponse.json({ success: true, alerts, summary })
  } catch (error) {
    console.error('Error fetching price alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price alerts' },
      { status: 500 }
    )
  }
}

/**
 * POST - Bulk review price alerts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as BulkPriceReviewRequest
    const { alertIds, action, userId, notes } = body

    if (!alertIds || alertIds.length === 0 || !action || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: alertIds, action, userId' },
        { status: 400 }
      )
    }

    const batch = db.batch()
    const processed: string[] = []
    const errors: Array<{ alertId: string; error: string }> = []

    for (const alertId of alertIds) {
      try {
        const alertRef = db.collection('price_change_alerts').doc(alertId)
        const alertDoc = await alertRef.get()

        if (!alertDoc.exists) {
          errors.push({ alertId, error: 'Alert not found' })
          continue
        }

        const alertData = alertDoc.data() as PriceChangeAlert

        // Update alert status
        const updateData: Partial<PriceChangeAlert> = {
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewedAt: new Date().toISOString(),
          reviewedBy: userId,
          notes,
        }

        batch.update(alertRef, updateData)

        // If approved, update the supplier SKU cost
        if (action === 'approve') {
          const skuRef = db.collection('supplier_skus').doc(alertData.skuId)
          batch.update(skuRef, {
            costPrice: alertData.newCost,
            lastPriceUpdate: new Date().toISOString(),
            lastPriceChangePercent: alertData.percentageIncrease,
          })
        }

        processed.push(alertId)
      } catch (error) {
        console.error(`Error processing alert ${alertId}:`, error)
        errors.push({
          alertId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    await batch.commit()

    return NextResponse.json({
      success: true,
      processed: processed.length,
      errors,
    })
  } catch (error) {
    console.error('Error processing bulk price review:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk review' },
      { status: 500 }
    )
  }
}
