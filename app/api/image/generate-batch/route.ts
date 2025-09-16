import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
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

  // Pick recent products (or any 3 if createdAt missing)
  const qy = query(collection(db, POS_PRODUCTS_COL), orderBy('updatedAt', 'desc'), limit(n))
  const snap = await getDocs(qy).catch(() => null)

  const docs = snap ? snap.docs : []
  const chosen = docs.map(d => ({ id: d.id, ...(d.data() as any) }))

  const items = chosen.map((p: any) => {
    const name = p.name || 'Product'
    const brand = p.brand || ''
    const prompt = `Photorealistic product photo of the item shown in the reference image(s). Output a single centered product placed on a brown mahogany wooden shelf with visible wood grain. Lighting: warm, studio-quality, 'precious' accent lighting from top-left creating soft highlights and gentle shadows. Background color: ${themeHex}. Camera: 50mm, slight 10° angle, product fully visible, no additional props. Keep product proportions and text readable. Ensure consistent composition across all SKUs: product centered, same distance from camera, shelf visible across bottom third of frame. High detail, high resolution, natural specular highlights on glossy surfaces. If no license to reproduce brand logos, render neutral label placeholders instead. Output format: 2048x2560 JPEG.`
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
