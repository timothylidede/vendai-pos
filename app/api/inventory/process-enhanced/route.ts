import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { runProcessingChain } from '@/lib/ai/prompt-chain'
import { adminDb, adminStorage } from '@/lib/firebase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const orgId = (form.get('orgId') as string) || ''
    const uploadedBy = (form.get('uploadedBy') as string) || ''
    if (!file) return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const text = buf.toString('utf8')

    // Run prompt-chaining pipeline (bytes for xlsx/pdf, text for csv/txt)
    const chain = await runProcessingChain({ orgId, fileName: file.name, fileText: text, fileBytes: new Uint8Array(buf) })
    if (!chain.ok) {
      return NextResponse.json({ success: false, error: chain.error, trace: chain.trace }, { status: 400 })
    }

    const stats = chain.ctx.upsertStats || { created: 0, updated: 0, invCreated: 0 }
    const totalProducts = chain.ctx.normalized?.length || 0
    const preview = (chain.ctx.normalized || []).slice(0, 12)

    let pricelistRecord: any = null
    if (orgId) {
      try {
        const bucket = adminStorage.bucket()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'pricelist.csv'
        const storagePath = `org-pricelists/${orgId}/${Date.now()}-${safeName}`
        const downloadToken = randomUUID()
        await bucket.file(storagePath).save(buf, {
          contentType: file.type || 'text/csv',
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
            uploadedBy,
            originalFileName: file.name
          }
        })
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`
        pricelistRecord = {
          fileName: file.name,
          storagePath,
          downloadUrl,
          contentType: file.type || 'text/csv',
          size: buf.length,
          uploadedAt: new Date().toISOString(),
          uploadedBy: uploadedBy || null,
          stats: {
            totalProducts,
            productsAdded: stats.created,
            productsUpdated: stats.updated,
            duplicatesFound: chain.ctx.dedupInfo?.duplicatesInUpload || 0
          }
        }
        await adminDb.collection('org_pricelists').doc(orgId).set(pricelistRecord, { merge: true })
      } catch (storageError) {
        console.error('Pricelist storage error:', storageError)
      }
    }

    return NextResponse.json({
      success: true,
      trace: chain.trace, // structured per-step trace
      stats: {
        totalProducts,
        productsAdded: stats.created,
        productsUpdated: stats.updated,
        duplicatesFound: chain.ctx.dedupInfo?.duplicatesInUpload || 0,
        suppliersAnalyzed: 0,
        locationMatches: 0
      },
      preview,
      pricelist: pricelistRecord
    })
  } catch (e: any) {
    console.error('Enhanced processing error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Processing failed' }, { status: 500 })
  }
}