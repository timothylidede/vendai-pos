import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { POS_PRODUCTS_COL } from '@/lib/pos-operations'
import { getOrgSettings } from '@/lib/org-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }
  const { orgId, count } = body || {}
  if (!orgId) return NextResponse.json({ ok: false, error: 'orgId required' }, { status: 400 })

  const settings = await getOrgSettings(orgId)
  const themeHex = settings?.theme_bg_hex || '#F6F4F2'
  const n = Math.max(1, Math.min(3, Number(count) || 3)) // cap at 3

  // Pick recent products; avoid composite index requirements
  let chosen: any[] = []
  try {
    const base = orgId
      ? query(collection(db, POS_PRODUCTS_COL), where('orgId', '==', orgId), limit(500))
      : query(collection(db, POS_PRODUCTS_COL), limit(500))
    const snap = await getDocs(base)
    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    rows.sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    chosen = rows.slice(0, n)
  } catch {
    chosen = []
  }

  const items = chosen.map((p: any) => {
    const name = p.name || 'Product'
    const brand = p.brand || ''
  const prompt = `Photorealistic product photo. Single centered product on a brown mahogany wooden shelf (visible grain). Background: matte slate (${themeHex}). Warm studio light from top-left, 50mm lens ~10° angle. No props. Keep proportions and label legible. Consistent framing: shelf across bottom third. High detail, natural highlights. 2048x2560.`
    return {
      productId: p.id,
      productName: name,
      brand,
      plan: {
        googleSearch: { query: `${brand ? brand + ' ' : ''}${name} product image`, minResolution: '800x800', topN: 5 },
        replicate: { model: 'flux-dev-img2img', strength: 0.6, seed: `hash(${p.id})`, output: '2048x2560', prompt },
        postprocess: { aspect: '4:5', format: 'webp/jpeg', shadow: true },
        storage: { target: 'cdn://products/' }
      },
      prompt
    }
  })

  return NextResponse.json({ ok: true, count: items.length, items })
}
