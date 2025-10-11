import { db } from '@/lib/firebase'
import { adminDb, adminStorage } from '@/lib/firebase-admin'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import Replicate from 'replicate'

// Smart Google CSE with e-commerce priority for better reference images
async function googleRefImages(query: string, topN = 8): Promise<string[]> {
  console.log('🔍 Searching for reference images:', query)
  
  // Support multiple env var names
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_CSE_API_KEY
  const cx = process.env.GOOGLE_CSE_CX || process.env.GOOGLE_CSE_ID || process.env.NEXT_PUBLIC_GOOGLE_CSE_CX || process.env.NEXT_PUBLIC_CX
  
  if (!apiKey || !cx) {
    console.log('⚠️ Missing Google CSE API key or CX, skipping reference images')
    return []
  }
  
  try {
    // Try e-commerce sites first for professional product photos
    const ecommerceSites = ['jumia.co.ke', 'kilimall.co.ke', 'amazon.com', 'ebay.com', 'walmart.com']
    const siteQuery = ecommerceSites.map(s => `site:${s}`).join(' OR ')
    const ecommerceQuery = `(${siteQuery}) ${query}`
    
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('cx', cx)
    url.searchParams.set('searchType', 'image')
    url.searchParams.set('q', ecommerceQuery)
    url.searchParams.set('num', String(Math.min(topN, 10)))
    url.searchParams.set('safe', 'active')
    url.searchParams.set('imgSize', 'large')
    url.searchParams.set('imgType', 'photo')
    
    const res = await fetch(url)
    let items: any[] = []
    
    if (res.ok) {
      const json = await res.json()
      items = Array.isArray(json.items) ? json.items : []
      if (items.length > 0) {
        console.log(`📸 Found ${items.length} e-commerce reference images`)
      }
    }
    
    // Fallback to general search if e-commerce fails
    if (items.length === 0) {
      console.log('⚠️ No e-commerce results, trying general search...')
      const generalUrl = new URL('https://www.googleapis.com/customsearch/v1')
      generalUrl.searchParams.set('key', apiKey)
      generalUrl.searchParams.set('cx', cx)
      generalUrl.searchParams.set('searchType', 'image')
      generalUrl.searchParams.set('q', query)
      generalUrl.searchParams.set('num', String(Math.min(topN, 10)))
      generalUrl.searchParams.set('safe', 'active')
      generalUrl.searchParams.set('imgSize', 'large')
      
      const generalRes = await fetch(generalUrl)
      if (!generalRes.ok) {
        console.error('❌ Google CSE error:', generalRes.status)
        return []
      }
      
      const generalJson = await generalRes.json()
      items = Array.isArray(generalJson.items) ? generalJson.items : []
      console.log(`📸 Found ${items.length} general reference images`)
    }
    
    // Score and filter images
    type Scored = { link: string; w: number; h: number; score: number }
    const scored: Scored[] = items.map((i: any) => {
      const w = Number(i.image?.width || 0)
      const h = Number(i.image?.height || 0)
      let score = 70
      
      // Boost high resolution
      if (w * h >= 1000000) score += 15
      else if (w * h >= 640000) score += 10
      
      // Penalize bad patterns
      const urlLower = (i.link || '').toLowerCase()
      if (urlLower.includes('tiktok')) score -= 30
      if (urlLower.includes('x-raw-image')) score -= 30
      if (urlLower.includes('thumbnail')) score -= 10
      
      return { link: i.link as string, w, h, score }
    }).filter((x: Scored) => Boolean(x.link) && x.score > 40)
    
    const sorted = scored.sort((a, b) => b.score - a.score)
    const imageUrls = sorted.map((x: Scored) => x.link)
    
    console.log('🖼️ Selected reference images:', imageUrls.slice(0, 3))
    return imageUrls
  } catch (error) {
    console.error('❌ Google CSE search failed:', error)
    return []
  }
}

async function fetchImageAsDataUrl(url: string, retries = 3): Promise<{ dataUrl: string; contentType: string; originalUrl: string } | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📥 Fetching reference image (attempt ${attempt}/${retries}):`, url)
      
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.google.com/',
        },
        signal: AbortSignal.timeout(15000)
      })
      
      if (!res.ok) {
        console.warn(`⚠️ Failed to download reference image (attempt ${attempt}/${retries}):`, url, res.status)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
        return null
      }
      
      const contentType = res.headers.get('content-type') || 'image/jpeg'
      if (!contentType.startsWith('image/')) {
        console.warn('⚠️ Skipping non-image reference response', { url, contentType })
        return null
      }
      
      const arrayBuffer = await res.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const dataUrl = `data:${contentType};base64,${base64}`
      
      console.log(`✅ Successfully fetched reference image: ${url.substring(0, 80)}...`)
      return { dataUrl, contentType, originalUrl: url }
    } catch (error: any) {
      console.error(`❌ Reference image fetch error (attempt ${attempt}/${retries}):`, url, error.message)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }
  
  console.error(`❌ Failed to fetch reference image after ${retries} attempts:`, url)
  return null
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
  console.log('🎨 Starting Replicate image generation:', {
    productId: params.productId,
    orgId: params.orgId,
    useGoogleRefs: params.useGoogleRefs,
    hasPromptStyle: !!params.promptStyle
  })

  const replicateToken = process.env.REPLICATE_API_TOKEN
  if (!replicateToken) {
    console.error('❌ Missing REPLICATE_API_TOKEN in environment')
    return { ok: false, error: 'Missing REPLICATE_API_TOKEN' }
  }
  console.log('✅ Replicate API token found')

  const replicate = new Replicate({ auth: replicateToken })

  // Ensure we have product basics
  let name = params.name
  let brand = params.brand
  let category = params.category
  let supplier = params.supplier
  if (!name && db) {
    console.log('📦 Fetching product details from database...')
    try {
      const snap = await getDoc(doc(db, 'pos_products', params.productId))
      const p = snap.exists() ? (snap.data() as any) : {}
      name = p.name
      brand = brand ?? p.brand
      category = category ?? p.category
      supplier = supplier ?? p.supplier
      console.log('📦 Product details (client SDK):', { name, brand, category, supplier })
    } catch (fetchError: any) {
      if (fetchError?.code === 'unavailable') {
        console.warn('⚠️ Firestore client offline, falling back to admin SDK')
        const adminSnap = await adminDb.collection('pos_products').doc(params.productId).get()
        if (adminSnap.exists) {
          const p = adminSnap.data() as any
          name = p?.name
          brand = brand ?? p?.brand
          category = category ?? p?.category
          supplier = supplier ?? p?.supplier
          console.log('📦 Product details (admin fallback):', { name, brand, category, supplier })
        } else {
          console.error('❌ Product not found via admin fallback')
        }
      } else {
        console.error('❌ Failed to fetch product details:', fetchError)
        throw fetchError
      }
    }
  }
  if (!name) {
    console.error('❌ Product has no name')
    return { ok: false, error: 'Product has no name' }
  }

  // Standardized prompt: uniform, rich, slightly grainy, glass shelf, slate background
  const basePrompt = params.promptStyle || `Studio product photo, single centered product captured with a tight crop (product fills ~75% of frame) on a floating glass shelf, uniform slate background (#1f2937) matching the Vendai dashboard, crisp focus across the product with gentle depth falloff, cool teal-accent studio lighting, high detail, rich color, subtle grain, no text, props, hands, or accessories, background color must remain constant, consistent shadow and lighting, modern, e-commerce ready.`
  const title = `${brand ? brand + ' ' : ''}${name}`.trim()
  // Simple prompt demanding a strict slate background to match the app aesthetic
  const enhancedPrompt = `${basePrompt}. Product: ${title}${category ? '. Category: ' + category : ''}. Maintain an unbroken slate backdrop (#1f2937) with subtle glass reflection; no alternative backgrounds.`

  console.log('🎭 Using prompt style:', params.promptStyle ? 'Custom' : 'Default')
  console.log('📝 Enhanced prompt:', enhancedPrompt)

  try {
    let imageBytes: Buffer | null = null
    let revisedPrompt: string | undefined

    // Try to find reference images via Google CSE and feed them to Replicate
    let referenceImageInputs: string[] = []
    let referenceImageSources: string[] = []
    if (params.useGoogleRefs) {
      console.log('🔍 Attempting to find reference images...')
      const refs = await googleRefImages(`${title} ${category ? category + ' ' : ''}product image`, 8)
      if (refs.length) {
        console.log(`✅ Reference URLs found: ${refs.length} URLs, fetching data...`)
        const fetchedRefs: { source: string; dataUrl?: string }[] = []
        
        // Try to fetch at least 3 reference images, fetch up to 8 URLs with retries
        for (const url of refs) {
          const data = await fetchImageAsDataUrl(url, 3)
          if (data?.dataUrl) {
            fetchedRefs.push({ source: data.originalUrl, dataUrl: data.dataUrl })
            console.log(`✅ Successfully loaded reference image ${fetchedRefs.length}`)
            
            // Stop once we have 4 good references
            if (fetchedRefs.length >= 4) {
              break
            }
          }
        }
        
        if (fetchedRefs.length === 0) {
          console.error('❌ CRITICAL: Failed to load ANY reference images! This will result in poor quality.')
          console.log('🔄 Retrying with different search query...')
          
          // Retry with simpler query
          const simpleRefs = await googleRefImages(`${brand || title} product`, 8)
          for (const url of simpleRefs) {
            const data = await fetchImageAsDataUrl(url, 3)
            if (data?.dataUrl) {
              fetchedRefs.push({ source: data.originalUrl, dataUrl: data.dataUrl })
              console.log(`✅ Successfully loaded reference image ${fetchedRefs.length} (retry)`)
              if (fetchedRefs.length >= 4) break
            }
          }
        }
        
        referenceImageInputs = fetchedRefs.map(item => item.dataUrl ?? item.source)
        referenceImageSources = fetchedRefs.map(item => item.source)
        console.log(`🖼️ Using ${referenceImageSources.length} reference images for guidance`)
        if (referenceImageSources.length) {
          console.log('🖼️ Reference sources:', referenceImageSources)
        }
      } else {
        console.log('⚠️ No reference images found via Google CSE')
      }
    } else {
      console.log('⏭️ Skipping reference image search (useGoogleRefs=false)')
    }

    if (!referenceImageInputs.length) {
      console.warn('⚠️ WARNING: Proceeding without reference images - quality may be poor!')
    }

    const replicateModel = process.env.REPLICATE_MODEL_ID || 'google/nano-banana'
    const replicateInput: Record<string, unknown> = {
      prompt: enhancedPrompt,
      output_quality: 'high'
    }

    if (referenceImageInputs.length) {
      replicateInput.image_input = referenceImageInputs
    }

    const performPrediction = async (input: Record<string, unknown>, attemptLabel: string) => {
      const maybeRefs = input['image_input']
      const hasRefs = Array.isArray(maybeRefs) && maybeRefs.length > 0
      console.log('🎨 Calling Replicate model...', { model: replicateModel, hasRefs, attempt: attemptLabel })

      type ReplicatePredictionStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
      interface ReplicatePrediction {
        id: string
        status: ReplicatePredictionStatus
        output?: unknown
        error?: string | null
      }

      const prediction = await replicate.predictions.create({
        model: replicateModel,
        input,
        stream: false
      }) as ReplicatePrediction

      console.log('⏳ Replicate prediction queued', { id: prediction.id, status: prediction.status, attempt: attemptLabel })

      const terminalStatuses: ReplicatePredictionStatus[] = ['succeeded', 'failed', 'canceled']
      let currentPrediction: ReplicatePrediction = prediction
      const startedAt = Date.now()
      const MAX_WAIT_MS = 120_000
      const POLL_INTERVAL_MS = 2_000

      while (!terminalStatuses.includes(currentPrediction.status)) {
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          throw new Error('Replicate prediction timed out')
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
        currentPrediction = await replicate.predictions.get(currentPrediction.id) as ReplicatePrediction
        console.log('⏳ Replicate status update', { status: currentPrediction.status, attempt: attemptLabel })
      }

      if (currentPrediction.status !== 'succeeded') {
        const replicateError = currentPrediction.error || `Replicate prediction ${currentPrediction.status}`
        const err = new Error(replicateError)
        ;(err as { status?: ReplicatePredictionStatus }).status = currentPrediction.status
        throw err
      }

      return currentPrediction
    }

    let currentPrediction: Awaited<ReturnType<typeof performPrediction>>
    try {
      currentPrediction = await performPrediction(replicateInput, 'initial')
    } catch (primaryError) {
      const message = primaryError instanceof Error ? primaryError.message : String(primaryError)
      const status = (primaryError as { status?: string }).status
      const isInvalidInput = /invalid/i.test(message) || status === 'failed'
      if (referenceImageInputs.length && isInvalidInput) {
        console.warn('⚠️ Replicate rejected reference images, retrying without them...', { message })
  const retryInput: Record<string, unknown> = { ...replicateInput }
  delete retryInput['image_input']
        currentPrediction = await performPrediction(retryInput, 'fallback-no-refs')
      } else {
        console.error('❌ Replicate prediction did not succeed', { error: primaryError })
        return { ok: false, error: message }
      }
    }

    const extractHttpUrls = (value: unknown): string[] => {
      if (!value) return []

      const collectFromToString = (candidate: unknown) => {
        try {
          if (candidate && typeof (candidate as any).toString === 'function') {
            const text = (candidate as any).toString()
            if (typeof text === 'string' && text.trim()) {
              return extractHttpUrls(text)
            }
          }
        } catch (err) {
          console.warn('⚠️ Failed to read string from Replicate output candidate', err)
        }
        return []
      }

      if (typeof value === 'string') {
        const direct = value.trim()
        if (direct.startsWith('http')) {
          return [direct]
        }
        const matches = Array.from(direct.matchAll(/https?:\/\/[^\s"']+/g)).map(match => match[0])
        return matches
      }

      if (Array.isArray(value)) {
        return value.flatMap(item => extractHttpUrls(item))
      }

      if (typeof value === 'object') {
        if (value && typeof (value as any).url === 'function') {
          try {
            const urlResult = (value as any).url()
            if (typeof urlResult === 'string') {
              return extractHttpUrls(urlResult)
            }
            if (urlResult instanceof URL) {
              return [urlResult.toString()]
            }
          } catch (err) {
            console.warn('⚠️ Failed to resolve Replicate file output URL', err)
          }
        }

        if (value && typeof (value as any).toString === 'function' && !(value instanceof ReadableStream)) {
          const stringUrls = collectFromToString(value)
          if (stringUrls.length) return stringUrls
        }

        return Object.values(value as Record<string, unknown>).flatMap(item => extractHttpUrls(item))
      }

      return []
    }

  const rawOutput = currentPrediction.output
    console.log('✅ Replicate prediction completed')
    const candidateUrls = extractHttpUrls(rawOutput)
    const preferredUrls = candidateUrls.filter(url => url.includes('replicate') || url.includes('replicate.delivery'))
    const outputUrls = (preferredUrls.length ? preferredUrls : candidateUrls).filter(url => url.startsWith('http'))

    if (!outputUrls.length) {
      console.error('❌ No image URLs returned from Replicate', { rawOutput })
      return { ok: false, error: 'Replicate did not return an image URL' }
    }

    const downloadUrl = outputUrls[0]
    console.log('🌐 Downloading generated image from Replicate...', { downloadUrl })
    const generatedImageRes = await fetch(downloadUrl)
    if (!generatedImageRes.ok) {
      console.error('❌ Failed to download generated image from Replicate', generatedImageRes.status)
      return { ok: false, error: 'Failed to download generated image' }
    }

    const generatedArrayBuffer = await generatedImageRes.arrayBuffer()
    imageBytes = Buffer.from(generatedArrayBuffer)

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
    if (db) {
      console.log('💾 Updating product document with image URL...')
      const updatedAt = new Date().toISOString()
      await setDoc(doc(db, 'pos_products', params.productId), {
        image: url,
        image_url: url,
        imageUrl: url,
        updatedAt
      }, { merge: true })
      console.log('✅ Product document updated')
    }

    console.log('🎉 Image generation completed successfully!')
    return { ok: true, url, revisedPrompt }
  } catch (error: any) {
    console.error('❌ Replicate Image Generation Error:', error)
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
    } else if (error?.status === 402 || error?.code === 'insufficient_quota') {
      errorMsg = 'Replicate credits exhausted. Review billing before retrying.'
      console.error('💳 Replicate quota exceeded')
    } else if (error?.status === 429) {
      errorMsg = 'Replicate rate limit hit. Please wait before trying again.'
      console.error('⏱️ Replicate rate limit reached')
    } else if (error?.name === 'AbortError') {
      errorMsg = 'Replicate request was aborted. Try again in a bit.'
      console.error('🛑 Replicate request aborted')
    }
    
    console.error('💥 Final error result:', { ok: false, error: errorMsg })
    return { 
      ok: false, 
      error: errorMsg
    }
  }
}
