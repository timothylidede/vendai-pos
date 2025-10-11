/**
 * API Route: POST /api/supplier/receiving
 * Accept delivery confirmation and atomically update inventory
 * Now with three-way match reconciliation support
 * Part of Phase 1.2 Supplier Integration Depth
 */

import { NextRequest, NextResponse } from 'next/server'
import { receiveDelivery } from '@/lib/purchase-order-operations'
import type { ReceiveDeliveryRequest } from '@/types/purchase-orders'
import { getAuth } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { processInvoiceAttachments, parseInvoiceData } from '@/lib/invoice-upload'
import { createReconciliation } from '@/lib/reconciliation-engine'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check - get current user
    const user = auth?.currentUser
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    // 2. Check content type - handle both JSON and multipart/form-data
    const contentType = request.headers.get('content-type') || ''
    const isFormData = contentType.includes('multipart/form-data')
    
    let body: ReceiveDeliveryRequest
    let invoiceAttachments: any[] = []
    let invoiceData: any = null
    let supplierId = ''
    
    if (isFormData) {
      // Parse multipart/form-data (with invoice attachments)
      const formData = await request.formData()
      
      // Extract base receiving data
      const poId = formData.get('poId') as string
      const orgId = formData.get('orgId') as string
      const receivedLinesJson = formData.get('receivedLines') as string
      supplierId = formData.get('supplierId') as string
      const notes = formData.get('notes') as string | null
      
      if (!poId || !orgId || !receivedLinesJson) {
        return NextResponse.json(
          { error: 'Missing required fields: poId, orgId, receivedLines' },
          { status: 400 }
        )
      }
      
      const receivedLines = JSON.parse(receivedLinesJson)
      
      body = {
        poId,
        orgId,
        receivedLines,
        receivedBy: user.uid,
        notes: notes || undefined,
      }
      
      // Extract invoice files
      const files: File[] = []
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('invoice_') && value instanceof File) {
          files.push(value)
        }
      }
      
      // Process invoice attachments if present
      if (files.length > 0) {
        invoiceAttachments = await processInvoiceAttachments(files, orgId, user.uid)
        invoiceData = parseInvoiceData(formData)
      }
      
    } else {
      // Parse JSON request body (backward compatible)
      body = await request.json() as ReceiveDeliveryRequest
      
      // Extract invoice data if present
      const bodyWithInvoice = body as any
      if (bodyWithInvoice.invoiceLines && bodyWithInvoice.invoiceTotal) {
        invoiceData = {
          invoiceLines: bodyWithInvoice.invoiceLines,
          invoiceTotal: bodyWithInvoice.invoiceTotal,
          invoiceNumber: bodyWithInvoice.invoiceNumber,
        }
      }
      if (bodyWithInvoice.invoiceAttachments) {
        invoiceAttachments = bodyWithInvoice.invoiceAttachments
      }
      supplierId = bodyWithInvoice.supplierId || ''
    }

    // 3. Validation
    if (!body.poId || !body.orgId || !body.receivedLines || body.receivedLines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: poId, orgId, receivedLines' },
        { status: 400 }
      )
    }

    // Validate receivedLines structure
    for (const line of body.receivedLines) {
      if (!line.productId || typeof line.quantityReceived !== 'number' || line.quantityReceived < 0) {
        return NextResponse.json(
          { error: 'Invalid receivedLines: each must have productId and quantityReceived >= 0' },
          { status: 400 }
        )
      }
    }

    // 4. Set receivedBy to current user
    const deliveryRequest: ReceiveDeliveryRequest = {
      ...body,
      receivedBy: user.uid,
    }

    // 5. Execute receiving transaction
    const result = await receiveDelivery(deliveryRequest)

    // 6. Create three-way match reconciliation if invoice data is present
    let reconciliation = null
    if (invoiceData && supplierId) {
      try {
        reconciliation = await createReconciliation({
          poId: body.poId,
          orgId: body.orgId,
          supplierId,
          receivedLines: body.receivedLines,
          invoiceAttachments,
          invoiceLines: invoiceData.invoiceLines,
          invoiceTotal: invoiceData.invoiceTotal,
          invoiceNumber: invoiceData.invoiceNumber,
          receivedBy: user.uid,
          notes: body.notes,
        })
      } catch (reconciliationError: any) {
        console.error('Error creating reconciliation:', reconciliationError)
        // Don't fail the entire request if reconciliation fails
        // The delivery was still received successfully
      }
    }

    // 7. Return success response
    return NextResponse.json({
      ...result,
      reconciliation: reconciliation ? {
        id: reconciliation.id,
        matchStatus: reconciliation.matchStatus,
        status: reconciliation.status,
        discrepancyPercentage: reconciliation.discrepancyPercentage,
        totalDiscrepancyAmount: reconciliation.totalDiscrepancyAmount,
        requiresApproval: reconciliation.requiresApproval,
      } : null,
    }, { status: 200 })

  } catch (error: any) {
    console.error('Error in /api/supplier/receiving:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to receive delivery',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
