import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BulkEnqueuePayload = {
  orgId?: string
  productIds?: string[]
  promptStyle?: string
  variant?: string
}

const DEFAULT_PROMPT = `Studio product photo, single centered product captured with a tight crop (product fills ~75% of frame) on a floating glass shelf, uniform slate background (#1f2937) matching the Vendai dashboard, crisp focus across the product with gentle depth falloff, cool teal-accent studio lighting, high detail, rich color, subtle grain, no text, props, hands, or accessories, background color must remain constant, consistent shadow and lighting, modern, e-commerce ready.`

export async function POST(req: NextRequest) {
  let payload: BulkEnqueuePayload
  try {
    payload = (await req.json()) as BulkEnqueuePayload
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 })
  }

  const orgId = payload.orgId?.trim()
  if (!orgId) {
    return NextResponse.json({ ok: false, error: 'orgId is required' }, { status: 400 })
  }

  const uniqueIds = Array.isArray(payload.productIds)
    ? Array.from(new Set(payload.productIds.filter(id => typeof id === 'string' && id.trim().length > 0)))
    : []

  if (uniqueIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'No productIds provided' }, { status: 400 })
  }

  const limit = Math.min(uniqueIds.length, 50)
  const targetIds = uniqueIds.slice(0, limit)

  try {
    const productsCol = adminDb.collection('pos_products')
    const jobsCol = adminDb.collection('image_jobs')

    const productRefs = targetIds.map(id => productsCol.doc(id))
    const snapshots = await adminDb.getAll(...productRefs)
    const now = new Date().toISOString()
    const promptTemplate = payload.promptStyle?.trim() || DEFAULT_PROMPT
    const variant = payload.variant || 'bulk'

    let queued = 0
    const writes: Promise<unknown>[] = []

    snapshots.forEach((snap, index) => {
      if (!snap.exists) {
        return
      }

      const data = snap.data() as Record<string, unknown>
      const productId = targetIds[index]
      const jobRef = jobsCol.doc()

      writes.push(
        jobRef.set({
          id: jobRef.id,
          orgId,
          productId,
          prompt: promptTemplate,
          variant,
          status: 'queued',
          createdAt: now,
          updatedAt: now,
          attempts: 0,
          productName: (data?.name as string) || null,
          brand: (data?.brand as string) || null,
          category: (data?.category as string) || null,
          source: 'inventory-bulk'
        })
      )
      queued += 1
    })

    if (writes.length === 0) {
      return NextResponse.json({ ok: false, error: 'No matching products found for provided IDs' }, { status: 404 })
    }

    await Promise.all(writes)

    return NextResponse.json({ ok: true, queued, totalRequested: targetIds.length })
  } catch (error: any) {
    console.error('Bulk enqueue error:', error)
    return NextResponse.json({ ok: false, error: error?.message || 'Failed to enqueue jobs' }, { status: 500 })
  }
}
