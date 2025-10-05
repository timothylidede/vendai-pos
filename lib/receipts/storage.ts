import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import type { ReceiptArtifacts } from './types'

export interface SaveReceiptDocumentsParams {
  orgId: string
  orderId: string
  html?: string
  pdfBytes?: Uint8Array
  metadata?: Record<string, string>
}

export const saveReceiptDocuments = async (
  params: SaveReceiptDocumentsParams,
): Promise<Pick<ReceiptArtifacts, 'documentUrls' | 'storagePaths'>> => {
  if (!params.html && !params.pdfBytes) {
    return {}
  }

  if (!storage) {
    throw new Error('Firebase Storage has not been initialized. Ensure firebase.ts exports storage.')
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const basePath = `receipts/${params.orgId}/${params.orderId}`
  const documentUrls: ReceiptArtifacts['documentUrls'] = {}
  const storagePaths: { html?: string; pdf?: string } = {}

  if (params.html) {
    const htmlPath = `${basePath}/receipt-${timestamp}.html`
    const htmlRef = ref(storage, htmlPath)
    const htmlBytes = new TextEncoder().encode(params.html)
    await uploadBytes(htmlRef, htmlBytes, {
      contentType: 'text/html',
      customMetadata: params.metadata,
    })
    documentUrls.html = await getDownloadURL(htmlRef)
    storagePaths.html = htmlPath
  }

  if (params.pdfBytes) {
    const pdfPath = `${basePath}/receipt-${timestamp}.pdf`
    const pdfRef = ref(storage, pdfPath)
    await uploadBytes(pdfRef, params.pdfBytes, {
      contentType: 'application/pdf',
      customMetadata: params.metadata,
    })
    documentUrls.pdf = await getDownloadURL(pdfRef)
    storagePaths.pdf = pdfPath
  }

  return {
    documentUrls,
    storagePaths,
  }
}