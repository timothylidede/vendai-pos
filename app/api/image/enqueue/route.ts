import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, doc, setDoc } from 'firebase/firestore'

export const runtime = 'nodejs'

type EnqueueBody = {
  orgId: string
  productId: string
  prompt: string
  variant?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EnqueueBody
    if (!body?.orgId || !body?.productId || !body?.prompt) {
      return NextResponse.json({ ok: false, error: 'Missing orgId/productId/prompt' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const jobsCol = collection(db, 'image_jobs')
    const jobRef = doc(jobsCol)
    await setDoc(jobRef, {
      id: jobRef.id,
      orgId: body.orgId,
      productId: body.productId,
      prompt: body.prompt,
      variant: body.variant || 'default',
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      attempts: 0
    })

    return NextResponse.json({ ok: true, id: jobRef.id })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to enqueue' }, { status: 500 })
  }
}
