import { NextRequest, NextResponse } from 'next/server'
import { getOrgSettings } from '@/lib/org-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// This is a scaffold endpoint. It does not call Google or Replicate yet.
// It returns a plan/object that your client or a worker can execute.

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }
  const { orgId, skuId, productName, brand } = body || {}
  if (!orgId || !skuId || !productName) return NextResponse.json({ ok: false, error: 'orgId, skuId, productName required' }, { status: 400 })

  const settings = await getOrgSettings(orgId)
  const themeHex = settings?.theme_bg_hex || '#F6F4F2'

  const prompt = `Photorealistic product photo. Single centered product on a brown mahogany wooden shelf (visible grain). Background: matte slate (${themeHex}). Warm studio light from top-left, 50mm lens ~10° angle. No props. Keep proportions and label legible. Consistent framing: shelf across bottom third. High detail, natural highlights. 2048x2560.`

  return NextResponse.json({
    ok: true,
    plan: {
      googleSearch: {
        query: `${brand ? brand + ' ' : ''}${productName} product image`,
        minResolution: '800x800',
        topN: 5
      },
      replicate: {
        model: 'flux-dev-img2img',
        strength: 0.6,
        seed: `hash(${skuId})`,
        output: '2048x2560',
        prompt
      },
      postprocess: { aspect: '4:5', format: 'webp/jpeg', shadow: true },
      storage: { target: 'cdn://products/' }
    },
    prompt
  })
}
