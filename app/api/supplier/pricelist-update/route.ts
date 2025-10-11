/**
 * POST /api/supplier/pricelist-update
 * Accept bulk price changes from suppliers
 * Compare against current supplier_skus cost
 * Flag products where cost increase > threshold
 * Create alerts in price_change_alerts collection
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import type { PriceChangeRequest, PriceChangeAlert, PriceChangeSettings } from '@/types/price-changes'

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = getFirestore()

interface PriceUpdateResponse {
  success: boolean
  alertsCreated: number
  autoApproved: number
  skipped: number
  errors: Array<{ productId: string; error: string }>
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PriceChangeRequest & { orgId: string }
    const { orgId, supplierId, supplierName, changes } = body

    if (!orgId || !supplierId || !changes || changes.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, supplierId, changes' },
        { status: 400 }
      )
    }

    // Get org price change settings
    const settingsDoc = await db
      .collection('price_change_settings')
      .doc(orgId)
      .get()

    const settings: PriceChangeSettings = settingsDoc.exists
      ? (settingsDoc.data() as PriceChangeSettings)
      : {
          orgId,
          alertThresholdPercent: 10, // Default: alert if cost increases > 10%
          autoApproveUnderPercent: 5, // Auto-approve increases < 5%
        }

    const alertsCreated: string[] = []
    const autoApproved: string[] = []
    const skipped: string[] = []
    const errors: Array<{ productId: string; error: string }> = []

    // Process each price change
    for (const change of changes) {
      try {
        const { productId, skuId, oldCost, newCost } = change

        // Validate change
        if (newCost === oldCost) {
          skipped.push(productId)
          continue
        }

        // Get current SKU data
        const skuDoc = await db
          .collection('supplier_skus')
          .doc(skuId)
          .get()

        if (!skuDoc.exists) {
          errors.push({ productId, error: 'SKU not found' })
          continue
        }

        const skuData = skuDoc.data()!
        const currentCost = skuData.costPrice || oldCost

        // Calculate percentage change
        const percentageIncrease = ((newCost - currentCost) / currentCost) * 100

        // Get product details for retail price and margin
        const productDoc = await db
          .collection('pos_products')
          .doc(productId)
          .get()

        if (!productDoc.exists) {
          errors.push({ productId, error: 'Product not found' })
          continue
        }

        const productData = productDoc.data()!
        const currentRetailPrice = productData.retailPrice || 0
        const currentMargin = currentRetailPrice > 0
          ? ((currentRetailPrice - currentCost) / currentRetailPrice) * 100
          : 0
        const newMargin = currentRetailPrice > 0
          ? ((currentRetailPrice - newCost) / currentRetailPrice) * 100
          : 0

        // Auto-approve if under threshold
        if (
          settings.autoApproveUnderPercent &&
          percentageIncrease <= settings.autoApproveUnderPercent &&
          percentageIncrease >= 0
        ) {
          // Update cost directly
          await db.collection('supplier_skus').doc(skuId).update({
            costPrice: newCost,
            lastPriceUpdate: new Date().toISOString(),
            lastPriceChangePercent: percentageIncrease,
          })

          autoApproved.push(productId)
          continue
        }

        // Create alert if above threshold or price decrease
        if (
          Math.abs(percentageIncrease) >= settings.alertThresholdPercent ||
          percentageIncrease < 0
        ) {
          const alert: Omit<PriceChangeAlert, 'id'> = {
            orgId,
            supplierId,
            supplierName,
            productId,
            productName: productData.name || 'Unknown Product',
            skuId,
            oldCost: currentCost,
            newCost,
            percentageIncrease,
            currentRetailPrice,
            currentMargin,
            newMargin,
            status: 'pending',
            createdAt: new Date().toISOString(),
          }

          const alertRef = await db.collection('price_change_alerts').add(alert)
          alertsCreated.push(alertRef.id)
        } else {
          // Below threshold, update directly
          await db.collection('supplier_skus').doc(skuId).update({
            costPrice: newCost,
            lastPriceUpdate: new Date().toISOString(),
            lastPriceChangePercent: percentageIncrease,
          })

          autoApproved.push(productId)
        }
      } catch (error) {
        console.error(`Error processing price change for ${change.productId}:`, error)
        errors.push({
          productId: change.productId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const response: PriceUpdateResponse = {
      success: true,
      alertsCreated: alertsCreated.length,
      autoApproved: autoApproved.length,
      skipped: skipped.length,
      errors,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error processing price list update:', error)
    return NextResponse.json(
      { error: 'Failed to process price list update', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/supplier/pricelist-update
 * Get org price change settings
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId parameter' }, { status: 400 })
    }

    const settingsDoc = await db
      .collection('price_change_settings')
      .doc(orgId)
      .get()

    if (!settingsDoc.exists) {
      // Return default settings
      const defaultSettings: PriceChangeSettings = {
        orgId,
        alertThresholdPercent: 10,
        autoApproveUnderPercent: 5,
        requireApprovalAbovePercent: 15,
      }
      return NextResponse.json({ settings: defaultSettings })
    }

    return NextResponse.json({ settings: settingsDoc.data() })
  } catch (error) {
    console.error('Error fetching price change settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/supplier/pricelist-update
 * Update org price change settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as PriceChangeSettings

    if (!body.orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })
    }

    await db
      .collection('price_change_settings')
      .doc(body.orgId)
      .set(body, { merge: true })

    return NextResponse.json({ success: true, settings: body })
  } catch (error) {
    console.error('Error updating price change settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
