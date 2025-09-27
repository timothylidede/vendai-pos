import { db } from '@/lib/firebase'
import { adminDb, adminStorage } from '@/lib/firebase-admin'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import OpenAI from 'openai'

// Optional: lightweight Google CSE fetch for reference images
async function googleRefImages(query: string, topN = 3): Promise<string[]> {
  console.log('🔍 Searching for reference images:', query)
  
  // Support multiple env var names
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_CSE_API_KEY
  const cx = process.env.GOOGLE_CSE_CX || process.env.GOOGLE_CSE_ID || process.env.NEXT_PUBLIC_GOOGLE_CSE_CX || process.env.NEXT_PUBLIC_CX
  
  console.log('🔧 Google CSE Configuration:', {
    hasApiKey: !!apiKey,
    hasCx: !!cx,
    apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'none',
    cx: cx || 'none'
  })
  
  if (!apiKey || !cx) {
    console.log('⚠️ Missing Google CSE API key or CX, skipping reference images')
    return []
  }
  
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('cx', cx)
    url.searchParams.set('searchType', 'image')
    url.searchParams.set('q', query)
    url.searchParams.set('num', String(Math.min(topN, 5)))
    
    console.log('🌐 Making Google CSE request:', url.toString().replace(apiKey, '[API_KEY]'))
    
    const res = await fetch(url)
    if (!res.ok) {
      console.error('❌ Google CSE API error:', res.status, res.statusText)
      const errorText = await res.text()
      console.error('Error response:', errorText)
      return []
    }
    
    const json = await res.json()
    const items = Array.isArray(json.items) ? json.items : []
    
    console.log('📸 Found', items.length, 'reference images from Google CSE')
    
    // Prefer >=800x800, sort by area desc
    type Scored = { link: string; w: number; h: number }
    const scored: Scored[] = items.map((i: any) => ({
      link: i.link as string,
      w: Number(i.image?.width || 0),
      h: Number(i.image?.height || 0)
    })).filter((x: Scored) => Boolean(x.link))
    const filtered: Scored[] = scored.filter((x: Scored) => x.w >= 800 && x.h >= 800)
    const chosen: Scored[] = (filtered.length ? filtered : scored).sort((a: Scored, b: Scored) => (b.w * b.h) - (a.w * a.h))
    
    const imageUrls = chosen.map((x: Scored) => x.link)
    console.log('🖼️ Selected reference images:', imageUrls)
    
    return imageUrls
  } catch (error) {
    console.error('❌ Google CSE search failed:', error)
    return []
  }
}

export async function generateProductImageWithOpenAI(params: {
  orgId: string
  productId: string
  name?: string
  brand?: string
  category?: string
  supplier?: string
  promptStyle?: string
  useGoogleRefs?: boolean
}): Promise<{ ok: boolean; url?: string; error?: string; revisedPrompt?: string }>{
  console.log('🎨 Starting AI image generation:', {
    productId: params.productId,
    orgId: params.orgId,
    useGoogleRefs: params.useGoogleRefs,
    hasPromptStyle: !!params.promptStyle
  })

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_API_KEY) {
    console.error('❌ Missing OPENAI_API_KEY in environment')
    return { ok: false, error: 'Missing OPENAI_API_KEY' }
  }
  console.log('✅ OpenAI API key found')
  
  const client = new OpenAI({ apiKey: OPENAI_API_KEY })

  // Ensure we have product basics
  let name = params.name
  let brand = params.brand
  let category = params.category
  let supplier = params.supplier
  if (!name) {
    console.log('📦 Fetching product details from database...')
    const snap = await getDoc(doc(db, 'pos_products', params.productId))
    const p = snap.exists() ? (snap.data() as any) : {}
    name = p.name
    brand = brand ?? p.brand
    category = category ?? p.category
    supplier = supplier ?? p.supplier
    console.log('📦 Product details:', { name, brand, category, supplier })
  }
  if (!name) {
    console.error('❌ Product has no name')
    return { ok: false, error: 'Product has no name' }
  }

  // Standardized prompt: slate background on wooden shelf
  const basePrompt = params.promptStyle || `Photorealistic product photo; single centered product on a brown mahogany wooden shelf (visible grain); matte slate background (#2b2f33); warm studio lighting from top-left; 50mm lens slight 10° angle; high detail; natural highlights; no extra props`
  const title = `${brand ? brand + ' ' : ''}${name}`.trim()
  const fullPrompt = `${basePrompt}. Subject: ${title}. ${category ? 'Category: ' + category + '. ' : ''}${supplier ? 'Supplier: ' + supplier + '. ' : ''}`

  // Simple prompt for DALL-E 3 - no need for complex references for now
  const enhancedPrompt = `${basePrompt}. Product: ${title}${category ? '. Category: ' + category : ''}. Consistent composition; shelf across bottom third.`

  console.log('🎭 Using prompt style:', params.promptStyle ? 'Custom' : 'Default')
  console.log('📝 Enhanced prompt:', enhancedPrompt)

  try {
    let imageBytes: Buffer | null = null
    let revisedPrompt: string | undefined

    // Try to find a reference image via Google CSE and do img2img if possible
    let refUrl: string | undefined
    if (params.useGoogleRefs) {
      console.log('🔍 Attempting to find reference images...')
      const refs = await googleRefImages(`${title} ${category ? category + ' ' : ''}product image`, 5)
      refUrl = refs[0]
      if (refUrl) {
        console.log('✅ Using reference image:', refUrl)
      } else {
        console.log('⚠️ No reference images found')
      }
    } else {
      console.log('⏭️ Skipping reference image search (useGoogleRefs=false)')
    }

    if (refUrl) {
      console.log('🖼️ Attempting image-to-image generation with reference...')
      try {
        // OpenAI image edit endpoint with image[] and prompt
        // Fetch the reference and send it as input for guidance
        console.log('📥 Fetching reference image:', refUrl)
        const refRes = await fetch(refUrl)
        if (refRes.ok) {
          console.log('✅ Reference image fetched successfully')
          const refArrayBuf = await refRes.arrayBuffer()
          // File may not exist in older runtimes; if so, this throws and we fall back
          const refFile = new File([refArrayBuf], 'ref.png', { type: 'image/png' })
          
          console.log('🎨 Calling OpenAI image edit API...')
          const resp = await client.images.edit({
            model: 'gpt-image-1',
            image: refFile as any,
            prompt: enhancedPrompt,
            size: '1024x1024',
            n: 1
          } as any)
          console.log('✅ OpenAI image edit API responded')
          const first = resp.data?.[0]
          if (first?.b64_json) {
            console.log('📦 Received base64 image data')
            imageBytes = Buffer.from(first.b64_json, 'base64')
            revisedPrompt = (first as any).revised_prompt
          } else if ((first as any)?.url) {
            console.log('🌐 Received image URL, downloading...')
            const imgRes = await fetch((first as any).url)
            if (imgRes.ok) {
              const arr = await imgRes.arrayBuffer()
              imageBytes = Buffer.from(arr)
              console.log('✅ Image downloaded successfully')
            }
            revisedPrompt = (first as any).revised_prompt
          }
        } else {
          console.log('❌ Failed to fetch reference image:', refRes.status)
        }
      } catch (error) {
        console.log('⚠️ Image-to-image generation failed, will try text-to-image:', error)
        // ignore and fall back
      }
    }

    // Fallback: pure text-to-image
    if (!imageBytes) {
      console.log('🎨 Using text-to-image generation (DALL-E)...')
      const resp = await client.images.generate({
        model: 'gpt-image-1',
        prompt: enhancedPrompt,
        size: '1024x1024',
        n: 1
      })
      console.log('✅ OpenAI image generation API responded')
      const first = resp.data?.[0]
      if (first?.b64_json) {
        console.log('📦 Received base64 image data')
        imageBytes = Buffer.from(first.b64_json, 'base64')
        revisedPrompt = (first as any).revised_prompt
      } else if ((first as any)?.url) {
        console.log('🌐 Received image URL, downloading...')
        const imgRes = await fetch((first as any).url)
        if (!imgRes.ok) {
          console.error('❌ Failed to download generated image:', imgRes.status)
          return { ok: false, error: 'No image data returned' }
        }
        const arr = await imgRes.arrayBuffer()
        imageBytes = Buffer.from(arr)
        console.log('✅ Generated image downloaded successfully')
        revisedPrompt = (first as any).revised_prompt
      } else {
        console.error('❌ No image data in OpenAI response')
        return { ok: false, error: 'No image data returned' }
      }
    }

    if (revisedPrompt) {
      console.log('📝 OpenAI revised prompt:', revisedPrompt)
    }

    // Upload to Firebase Storage using Admin SDK
    console.log('☁️ Uploading image to Firebase Storage...')
    const timestamp = Date.now()
    const path = `product-images/${params.productId}-${timestamp}.png`
    console.log('📁 Storage path:', path)
    
    const bucket = adminStorage.bucket()
    const file = bucket.file(path)
    
    console.log('📤 Saving image to bucket:', bucket.name)
    await file.save(imageBytes, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          orgId: params.orgId,
          productId: params.productId,
          generatedAt: new Date().toISOString()
        }
      }
    })
    
    console.log('✅ Image saved to storage')
    
    // Make file publicly readable
    console.log('🔓 Making file publicly readable...')
    await file.makePublic()
    console.log('✅ File made public')
    
  const url = `https://storage.googleapis.com/${bucket.name}/${encodeURI(path)}`
    console.log('🔗 Public URL:', url)

    // Update product doc
    console.log('💾 Updating product document with image URL...')
    await setDoc(doc(db, 'pos_products', params.productId), { image: url, updatedAt: new Date().toISOString() }, { merge: true })
    console.log('✅ Product document updated')

    console.log('🎉 Image generation completed successfully!')
    return { ok: true, url, revisedPrompt }
  } catch (error: any) {
    console.error('❌ OpenAI Image Generation Error:', error)
    console.error('Error stack:', error?.stack)
    
    let errorMsg = error?.message || 'Image generation failed'
    
    // Handle common Firebase errors
    if (error?.code === 'storage/unauthorized') {
      errorMsg = 'Storage permission denied. Please ensure you are logged in.'
      console.error('🔒 Firebase Storage unauthorized - check service account key')
    } else if (error?.code === 'auth/unauthenticated') {
      errorMsg = 'Authentication required for image upload.'
      console.error('🔑 Firebase authentication failed')
    } else if (error?.message?.includes('Could not load the default credentials')) {
      errorMsg = 'Firebase credentials not configured properly.'
      console.error('🔧 Firebase Admin SDK credentials issue - need FIREBASE_SERVICE_ACCOUNT_KEY or Application Default Credentials')
    } else if (error?.message?.includes('OpenAI')) {
      console.error('🤖 OpenAI API error details:', {
        status: error?.status,
        type: error?.type,
        code: error?.code
      })
    }
    
    console.error('💥 Final error result:', { ok: false, error: errorMsg })
    return { 
      ok: false, 
      error: errorMsg
    }
  }
}
