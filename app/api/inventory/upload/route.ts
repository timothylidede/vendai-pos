import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, doc, getDocs, query, setDoc, where, limit, getDoc } from 'firebase/firestore'
import { POS_PRODUCTS_COL, INVENTORY_COL } from '@/lib/pos-operations'
import { runProcessingChain } from '@/lib/ai/prompt-chain'
import { generateProductImageWithOpenAI } from '@/lib/images/openai-image'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Delegate CSV and other file types to the shared processing chain

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const orgId = (form.get('orgId') as string) || ''
    if (!file) return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 })
    const buf = Buffer.from(await file.arrayBuffer())
    const text = buf.toString('utf8')

    const chain = await runProcessingChain({ orgId, fileName: file.name, fileText: text, fileBytes: new Uint8Array(buf) })
    if (!chain.ok) {
      return NextResponse.json({ ok: false, error: chain.error, trace: chain.trace }, { status: 400 })
    }

    const stats = chain.ctx.upsertStats || { created: 0, updated: 0, invCreated: 0 }

    // Optional auto image generation for newly created items (fire and forget)
    if (process.env.OPENAI_API_KEY && (chain.ctx.upsertProductIds?.length || 0) > 0) {
      const createdIds = (chain.ctx.upsertProductIds || [])
        .filter((x: any) => x.created)
        .map((x: any) => x.id as string)
      const subset = createdIds.slice(0, Math.min(createdIds.length, Number(process.env.IMAGE_AUTOGEN_LIMIT || '10')))
      void Promise.allSettled(subset.map((productId: string) => generateProductImageWithOpenAI({ orgId, productId, useGoogleRefs: true })))
    }

    return NextResponse.json({ ok: true, ...stats, total: chain.ctx.normalized?.length || 0 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Upload failed' }, { status: 400 })
  }
}
