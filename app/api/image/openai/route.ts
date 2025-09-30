import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { generateProductImageWithOpenAI } from '@/lib/images/openai-image'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { orgId, productId, promptStyle, useGoogleRefs } = await req.json()
    console.log('🎨 Image generation request received:', { 
      orgId, 
      productId, 
      promptStyle: promptStyle || 'default', 
      useGoogleRefs: !!useGoogleRefs 
    })
    
    if (!orgId || !productId) {
      console.error('❌ Missing required parameters:', { orgId: !!orgId, productId: !!productId })
      return NextResponse.json({ ok: false, error: 'Missing orgId or productId' }, { status: 400 })
    }
    
    console.log('📦 Fetching product from database...')
    const snap = await getDoc(doc(db, 'pos_products', productId))
    if (!snap.exists()) {
      console.log('❌ Product not found:', productId)
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 })
    }
    const p = snap.data() as any
    console.log('✅ Product found:', { id: productId, name: p.name, brand: p.brand })

    // Provide default promptStyle if none specified
  const finalPromptStyle = promptStyle || `Photorealistic product photo; single centered product captured close-up on a brown mahogany wooden shelf (visible grain); product fills most of the frame with crisp focus and soft depth falloff; matte slate background (#2b2f33); warm studio lighting from top-left; 50mm lens slight 10° angle; high detail; natural highlights; no extra props`
    
    console.log('🎭 Using prompt style:', promptStyle ? 'Custom provided' : 'Default fallback')

    const res = await generateProductImageWithOpenAI({
      orgId,
      productId,
      name: p.name,
      brand: p.brand,
      category: p.category,
      supplier: p.supplier,
      promptStyle: finalPromptStyle,
      useGoogleRefs: Boolean(useGoogleRefs)
    })
    
    console.log('🏁 Image generation result:', { 
      ok: res.ok, 
      hasUrl: !!res.url, 
      error: res.error,
      hasRevisedPrompt: !!res.revisedPrompt
    })
    
    const code = res.ok ? 200 : 500
    return NextResponse.json(res, { status: code })
  } catch (e: any) {
    console.error('💥 Image API error:', e)
    console.error('Error stack:', e?.stack)
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}
