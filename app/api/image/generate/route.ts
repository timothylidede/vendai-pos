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

  const prompt = `Photorealistic product photo of the item shown in the reference image(s). Output a single centered product placed on a brown mahogany wooden shelf with visible wood grain. Lighting: warm, studio-quality, 'precious' accent lighting from top-left creating soft highlights and gentle shadows. Background color: ${themeHex}. Camera: 50mm, slight 10° angle, product fully visible, no additional props. Keep product proportions and text readable. Ensure consistent composition across all SKUs: product centered, same distance from camera, shelf visible across bottom third of frame. High detail, high resolution, natural specular highlights on glossy surfaces. If no license to reproduce brand logos, render neutral label placeholders instead. Output format: 2048x2560 JPEG.`

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
