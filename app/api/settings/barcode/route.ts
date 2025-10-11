/**
 * Barcode Settings API
 * PATCH /api/settings/barcode
 * 
 * Save organization barcode configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import type { OrgBarcodeSettings } from '@/lib/barcode-utils'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    // Fetch org settings
    const orgRef = doc(db, 'organizations', orgId)
    const orgSnap = await getDoc(orgRef)

    if (!orgSnap.exists()) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const orgData = orgSnap.data()
    const barcodeSettings = orgData.settings?.barcode

    return NextResponse.json({
      success: true,
      settings: barcodeSettings || {
        orgId,
        enableWeightBarcodes: false,
      },
    })
  } catch (error) {
    console.error('Error fetching barcode settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as OrgBarcodeSettings
    const { orgId, enableWeightBarcodes, weightBarcodeConfig } = body

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    // Update org settings
    const orgRef = doc(db, 'organizations', orgId)
    const orgSnap = await getDoc(orgRef)

    if (!orgSnap.exists()) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const settings = {
      'settings.barcode': {
        enableWeightBarcodes,
        weightBarcodeConfig: enableWeightBarcodes ? weightBarcodeConfig : null,
        updatedAt: new Date().toISOString(),
      },
    }

    await updateDoc(orgRef, settings)

    return NextResponse.json({
      success: true,
      message: 'Barcode settings updated successfully',
    })
  } catch (error) {
    console.error('Error updating barcode settings:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update settings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
