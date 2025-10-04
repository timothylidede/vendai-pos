import { NextRequest, NextResponse } from 'next/server'
import { getDocs, query, where, limit, orderBy } from 'firebase/firestore'

import {
  createInvoice,
  invoicesCollection,
  fromInvoiceSnapshot,
  type InvoiceCreateInput,
} from '@/lib/b2b-order-store'
import {
  buildInvoiceStatusHistoryEntry,
  calculateInvoiceItemLineTotal,
  generateInvoiceNumber,
  parseDueDate,
  parseIssueDate,
  serializeInvoice,
} from '@/lib/b2b-invoice-utils'
import { sanitizeInput, schemas } from '@/lib/validation'
import type { Invoice, InvoiceStatus } from '@/types/b2b-orders'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const purchaseOrderId = searchParams.get('purchaseOrderId')
    const retailerOrgId = searchParams.get('retailerOrgId')
    const supplierOrgId = searchParams.get('supplierOrgId')
    const status = searchParams.get('status')
    const limitParam = searchParams.get('limit')

    let q = query(invoicesCollection(), orderBy('createdAt', 'desc'))

    if (purchaseOrderId) {
      q = query(q, where('purchaseOrderId', '==', purchaseOrderId))
    }

    if (retailerOrgId) {
      q = query(q, where('retailerOrgId', '==', retailerOrgId))
    }

    if (supplierOrgId) {
      q = query(q, where('supplierOrgId', '==', supplierOrgId))
    }

    if (status) {
      q = query(q, where('status', '==', status))
    }

    if (limitParam) {
      const limitValue = parseInt(limitParam, 10)
      if (!isNaN(limitValue) && limitValue > 0) {
        q = query(q, limit(limitValue))
      }
    }

    const snapshot = await getDocs(q)
    const invoices = snapshot.docs.map((doc) => {
      const invoice = fromInvoiceSnapshot(doc) as Invoice
      return serializeInvoice(doc.id, invoice)
    })

    return NextResponse.json({
      success: true,
      invoices,
      count: invoices.length,
    })
  } catch (error) {
    console.error('Failed to fetch invoices', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch invoices' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = sanitizeInput(body, schemas.invoiceCreate)

    const issueDate = parseIssueDate(parsed.issueDate)
    const dueDate = parseDueDate(parsed.dueDate, issueDate, parsed.paymentTerms)

    // Calculate line totals for items
    const itemsWithLineTotals = parsed.items.map(calculateInvoiceItemLineTotal)

    // Auto-generate invoice number if not provided
    const invoiceNumber =
      parsed.number || generateInvoiceNumber(parsed.supplierId, issueDate.toDate())

    const actorId = parsed.createdByUserId || parsed.supplierUserId || 'system'
    const actorName = parsed.createdByName || parsed.supplierName || 'System'
    const initialStatus: InvoiceStatus = parsed.status ?? 'issued'

    const statusHistory = [
      buildInvoiceStatusHistoryEntry(
        initialStatus,
        actorId,
        actorName,
        initialStatus === 'draft' ? 'Invoice created as draft' : 'Invoice issued',
      ),
    ]

    const payload: InvoiceCreateInput = {
      retailerOrgId: parsed.retailerOrgId,
      supplierOrgId: parsed.supplierOrgId,
      purchaseOrderId: parsed.purchaseOrderId,
      salesOrderId: parsed.salesOrderId,
      retailerId: parsed.retailerId,
      retailerName: parsed.retailerName,
      retailerUserId: parsed.retailerUserId,
      supplierId: parsed.supplierId,
      supplierName: parsed.supplierName,
      supplierUserId: parsed.supplierUserId,
      number: invoiceNumber,
      issueDate,
      dueDate,
      status: initialStatus,
      items: itemsWithLineTotals,
      amount: parsed.amount,
      paymentStatus: 'pending',
      paymentTerms: parsed.paymentTerms,
      paymentIds: [],
      statusHistory,
    }

    const docRef = await createInvoice(payload)

    const responsePayload = serializeInvoice(docRef.id, payload)

    return NextResponse.json(
      {
        success: true,
        invoice: responsePayload,
        invoiceId: docRef.id,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to create invoice', error)

    if (error instanceof Error && 'issues' in error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: (error as { issues?: unknown[] }).issues,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create invoice' },
      { status: 500 },
    )
  }
}
