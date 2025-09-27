import { NextRequest, NextResponse } from 'next/server'
import { runProcessingChain } from '@/lib/ai/prompt-chain'
import { generateProductImageWithOpenAI } from '@/lib/images/openai-image'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const orgId = (form.get('orgId') as string) || ''
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
      void Promise.allSettled(
        subset.map((productId: string) =>
          generateProductImageWithOpenAI({ orgId, productId, useGoogleRefs: true })
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
      }
    })
  } catch (e: any) {
    console.error('Enhanced processing error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Processing failed' }, { status: 500 })
  }
}