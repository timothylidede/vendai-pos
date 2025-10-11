/**
 * Receipt Printing API
 * POST /api/pos/print-receipt
 * 
 * Accept order ID and return formatted receipt data
 * - ESC/POS commands for thermal printers
 * - HTML for browser print fallback
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { formatReceipt } from '@/lib/receipt-formatter'
import type { ReceiptData, PrinterConfig } from '@/lib/receipt-types'
import type { POSOrderDoc } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, printerId, format } = body

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    // Fetch order from Firestore
    const orderRef = doc(db, 'pos_orders', orderId)
    const orderSnap = await getDoc(orderRef)

    if (!orderSnap.exists()) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const order = orderSnap.data() as POSOrderDoc

    // Fetch org settings for printer config and org details
    const orgRef = doc(db, 'organizations', order.orgId)
    const orgSnap = await getDoc(orgRef)

    if (!orgSnap.exists()) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const orgData = orgSnap.data()
    const orgSettings = orgData.settings || {}
    const printerSettings = orgSettings.printers || {}

    // Get printer config
    let printerConfig: PrinterConfig
    if (printerId && printerSettings[printerId]) {
      printerConfig = printerSettings[printerId]
    } else if (printerSettings.default) {
      printerConfig = printerSettings.default
    } else {
      // Fallback to browser printing
      printerConfig = {
        type: 'browser',
        paperWidth: 80,
        characterWidth: 42,
      }
    }

    // Fetch cashier name if available
    let cashierName: string | undefined
    if (order.cashierId) {
      const cashierRef = doc(db, 'users', order.cashierId)
      const cashierSnap = await getDoc(cashierRef)
      if (cashierSnap.exists()) {
        const cashierData = cashierSnap.data()
        cashierName = cashierData.displayName || cashierData.name
      }
    }

    // Build receipt data
    const receiptData: ReceiptData = {
      receiptNumber: order.receiptNumber || order.id || 'N/A',
      orderId: order.id || orderId,
      orgName: orgData.name || 'VendAI POS',
      orgAddress: orgData.address,
      orgPhone: orgData.phone,
      orgTax: orgData.taxId,
      issuedAt: order.createdAt,
      cashierName,
      laneId: order.laneId,
      items: order.lines.map(line => ({
        name: line.name,
        quantity: line.quantityPieces,
        unitPrice: line.unitPrice,
        total: line.lineTotal,
      })),
      subtotal: order.total,
      tax: 0, // TODO: Calculate tax if applicable
      discount: 0, // TODO: Calculate discount if applicable
      total: order.total,
      payments: order.payments.map(payment => ({
        method: payment.method,
        amount: payment.amount,
      })),
      changeDue: order.payments.reduce((sum, p) => sum + (p.changeGiven || 0), 0),
      footer: orgSettings.receiptFooter || printerConfig.footer,
    }

    // Format receipt
    const formatted = formatReceipt(receiptData, printerConfig)

    // Return requested format
    if (format === 'escpos' && formatted.escpos) {
      // Return binary ESC/POS data
      return new NextResponse(formatted.escpos, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="receipt-${orderId}.bin"`,
        },
      })
    } else if (format === 'text') {
      // Return plain text
      return new NextResponse(formatted.plainText, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    } else {
      // Return JSON with all formats
      return NextResponse.json({
        success: true,
        receipt: {
          html: formatted.html,
          plainText: formatted.plainText,
          hasESCPOS: !!formatted.escpos,
        },
        printerConfig,
      })
    }
  } catch (error) {
    console.error('Error generating receipt:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate receipt',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/pos/print-receipt?orderId=xxx
 * Convenience method for browser-based receipt viewing
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orderId = searchParams.get('orderId')
    const format = searchParams.get('format') || 'html'

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Call POST handler with body
    const mockRequest = new Request(request.url, {
      method: 'POST',
      body: JSON.stringify({ orderId, format }),
      headers: { 'Content-Type': 'application/json' },
    })

    return POST(mockRequest as NextRequest)
  } catch (error) {
    console.error('Error in GET receipt:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve receipt' },
      { status: 500 }
    )
  }
}
