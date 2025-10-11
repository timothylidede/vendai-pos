/**
 * File Upload Utility for Invoice Attachments
 * Handles multipart/form-data uploads to Firebase Storage
 */

import { adminStorage } from '@/lib/firebase-admin'
import type { InvoiceAttachment } from '@/types/reconciliation'

/**
 * Upload a file to Firebase Storage
 * Returns the public download URL
 */
export async function uploadInvoiceFile(
  file: File | Blob,
  orgId: string,
  fileName: string
): Promise<string> {
  const bucket = adminStorage.bucket()
  const timestamp = Date.now()
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = `invoices/${orgId}/${timestamp}-${sanitizedFileName}`
  
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const fileRef = bucket.file(storagePath)
  
  await fileRef.save(fileBuffer, {
    metadata: {
      contentType: file.type,
      metadata: {
        orgId,
        uploadedAt: new Date().toISOString(),
      },
    },
  })
  
  // Make file publicly accessible
  await fileRef.makePublic()
  
  // Return public URL
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`
}

/**
 * Process uploaded files from FormData
 * Returns array of InvoiceAttachment objects
 */
export async function processInvoiceAttachments(
  files: File[],
  orgId: string,
  uploadedBy: string
): Promise<InvoiceAttachment[]> {
  const attachments: InvoiceAttachment[] = []
  
  for (const file of files) {
    try {
      const fileUrl = await uploadInvoiceFile(file, orgId, file.name)
      
      attachments.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        fileName: file.name,
        fileUrl,
        fileType: file.type,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy,
      })
    } catch (error) {
      console.error(`Error uploading file ${file.name}:`, error)
      throw new Error(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  return attachments
}

/**
 * Parse invoice data from FormData
 * Extracts invoice line items and total
 */
export interface ParsedInvoiceData {
  invoiceLines: Array<{
    productId: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  invoiceTotal: number
  invoiceNumber?: string
}

export function parseInvoiceData(formData: FormData): ParsedInvoiceData {
  const invoiceLinesJson = formData.get('invoiceLines') as string
  const invoiceTotal = parseFloat(formData.get('invoiceTotal') as string)
  const invoiceNumber = formData.get('invoiceNumber') as string | undefined
  
  if (!invoiceLinesJson) {
    throw new Error('Missing invoiceLines in form data')
  }
  
  if (isNaN(invoiceTotal)) {
    throw new Error('Invalid or missing invoiceTotal')
  }
  
  try {
    const invoiceLines = JSON.parse(invoiceLinesJson)
    
    if (!Array.isArray(invoiceLines)) {
      throw new Error('invoiceLines must be an array')
    }
    
    // Validate each line
    for (const line of invoiceLines) {
      if (!line.productId || typeof line.quantity !== 'number' || typeof line.unitPrice !== 'number') {
        throw new Error('Invalid invoice line format')
      }
    }
    
    return {
      invoiceLines,
      invoiceTotal,
      invoiceNumber,
    }
  } catch (error) {
    throw new Error(`Failed to parse invoice data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
