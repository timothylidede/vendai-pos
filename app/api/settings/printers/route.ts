/**
 * Printer Configuration API
 * Manage printer settings for receipt printing
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

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

    const orgRef = doc(db, 'organizations', orgId)
    const orgSnap = await getDoc(orgRef)

    if (!orgSnap.exists()) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const orgData = orgSnap.data()
    const printerSettings = orgData.settings?.printers

    return NextResponse.json({
      success: true,
      settings: printerSettings || {
        orgId,
        printers: {},
        autoPrint: false,
      },
    })
  } catch (error) {
    console.error('Error fetching printer settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { orgId, printerId, config, defaultPrinterId, autoPrint } = body

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

    const orgRef = doc(db, 'organizations', orgId)
    const orgSnap = await getDoc(orgRef)

    if (!orgSnap.exists()) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const orgData = orgSnap.data()
    const currentSettings = orgData.settings?.printers || { orgId, printers: {} }

    // Update specific printer config
    if (printerId && config) {
      currentSettings.printers[printerId] = {
        ...config,
        updatedAt: new Date().toISOString(),
      }
    }

    // Update default printer
    if (defaultPrinterId !== undefined) {
      currentSettings.defaultPrinterId = defaultPrinterId
    }

    // Update auto-print setting
    if (autoPrint !== undefined) {
      currentSettings.autoPrint = autoPrint
    }

    currentSettings.updatedAt = new Date().toISOString()

    await updateDoc(orgRef, {
      'settings.printers': currentSettings,
    })

    return NextResponse.json({
      success: true,
      message: 'Printer settings updated successfully',
      settings: currentSettings,
    })
  } catch (error) {
    console.error('Error updating printer settings:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update settings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orgId = searchParams.get('orgId')
    const printerId = searchParams.get('printerId')

    if (!orgId || !printerId) {
      return NextResponse.json(
        { error: 'Organization ID and Printer ID are required' },
        { status: 400 }
      )
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    const orgRef = doc(db, 'organizations', orgId)
    const orgSnap = await getDoc(orgRef)

    if (!orgSnap.exists()) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const orgData = orgSnap.data()
    const currentSettings = orgData.settings?.printers || { orgId, printers: {} }

    // Remove printer
    delete currentSettings.printers[printerId]

    // If deleted printer was default, clear default
    if (currentSettings.defaultPrinterId === printerId) {
      currentSettings.defaultPrinterId = undefined
    }

    currentSettings.updatedAt = new Date().toISOString()

    await updateDoc(orgRef, {
      'settings.printers': currentSettings,
    })

    return NextResponse.json({
      success: true,
      message: 'Printer deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting printer:', error)
    return NextResponse.json(
      { error: 'Failed to delete printer' },
      { status: 500 }
    )
  }
}
