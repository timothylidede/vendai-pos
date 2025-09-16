import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, doc, setDoc } from 'firebase/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const POS_MAPPINGS_COL = 'pos_mappings'

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }
  const { orgId, mappings } = body || {}
  if (!orgId || !Array.isArray(mappings)) {
    return NextResponse.json({ ok: false, error: 'orgId and mappings[] are required' }, { status: 400 })
  }

  const writes = mappings.slice(0, 500).map((m: any) => {
    const id = `${orgId}_${m.vendor || 'generic'}_${m.key}` // key could be barcode or vendor SKU
    const ref = doc(collection(db, POS_MAPPINGS_COL), id)
    return setDoc(ref, {
      orgId,
      vendor: m.vendor || 'generic',
      key: String(m.key),
      productId: String(m.productId),
      createdAt: new Date().toISOString(),
    })
  })

  try {
    await Promise.all(writes)
    return NextResponse.json({ ok: true, count: writes.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to save mappings' }, { status: 400 })
  }
}
