import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { runProcessingChain } from '@/lib/ai/prompt-chain'
import { generateProductImageWithOpenAI } from '@/lib/images/openai-image'
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

    // Optional: auto-generate images for newly created products using OpenAI (non-blocking)
    if (
      process.env.OPENAI_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
      (chain.ctx.upsertProductIds?.length || 0) > 0
    ) {
      const createdIds = (chain.ctx.upsertProductIds || [])
        .filter((x: any) => x.created)
        .map((x: any) => x.id as string)
      const limit = Math.min(createdIds.length, Number(process.env.IMAGE_AUTOGEN_LIMIT || '10'))
      const subset = createdIds.slice(0, limit)
      // Fire and forget
      const uniformPrompt = `Studio product photo, single centered product on a floating glass shelf, uniform slate background (#1f2937) matching the Vendai dashboard, cool teal-accent studio lighting, high detail, rich color, subtle grain, no text, props, hands, or accessories, background color must remain constant, consistent shadow and lighting, modern, e-commerce ready.`;
      void Promise.allSettled(
        subset.map((productId: string) =>
          generateProductImageWithOpenAI({ orgId, productId, useGoogleRefs: true, promptStyle: uniformPrompt })
        )
      )
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