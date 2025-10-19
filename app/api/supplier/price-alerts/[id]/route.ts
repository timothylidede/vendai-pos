/**
 * PATCH /api/supplier/price-alerts/[id]
 * Review individual price alert (approve/reject/adjust)
 */

import { NextRequest, NextResponse } from 'next/server'
import type { PriceChangeAlert, PriceReviewAction } from '@/types/price-changes'
import { getFirebaseAdminDb } from '@/lib/firebase-admin'

const db = getFirebaseAdminDb()

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const alertId = params.id
    const body = await request.json() as Omit<PriceReviewAction, 'alertId'>
    const { action, adjustedRetailPrice, notes, userId } = body

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, userId' },
        { status: 400 }
      )
    }

    // Get the alert
    const alertRef = db.collection('price_change_alerts').doc(alertId)
    const alertDoc = await alertRef.get()

    if (!alertDoc.exists) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    const alertData = alertDoc.data() as PriceChangeAlert

    // Prepare update
    const updateData: Partial<PriceChangeAlert> = {
      status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'adjusted',
      reviewedAt: new Date().toISOString(),
      reviewedBy: userId,
      notes,
    }

    if (action === 'adjust' && adjustedRetailPrice) {
      updateData.adjustedRetailPrice = adjustedRetailPrice
      updateData.newMargin = ((adjustedRetailPrice - alertData.newCost) / adjustedRetailPrice) * 100
    }

    // Update alert
    await alertRef.update(updateData)

    // Update supplier SKU if approved or adjusted
    if (action === 'approve' || action === 'adjust') {
      await db.collection('supplier_skus').doc(alertData.skuId).update({
        costPrice: alertData.newCost,
        lastPriceUpdate: new Date().toISOString(),
        lastPriceChangePercent: alertData.percentageIncrease,
      })
    }

    // Update product retail price if adjusted
    if (action === 'adjust' && adjustedRetailPrice) {
      await db.collection('pos_products').doc(alertData.productId).update({
        retailPrice: adjustedRetailPrice,
        lastPriceUpdate: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      alert: { id: alertId, ...alertData, ...updateData },
    })
  } catch (error) {
    console.error('Error processing price alert review:', error)
    return NextResponse.json(
      { error: 'Failed to process review' },
      { status: 500 }
    )
  }
}
