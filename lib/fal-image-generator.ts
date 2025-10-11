/**
 * FAL.ai Image Generator
 * Migration from Replicate to FAL.ai for 90% cost reduction
 * 
 * Cost comparison:
 * - Replicate FLUX: $0.03/image
 * - FAL.ai FLUX schnell: $0.003/image (10x cheaper!)
 * 
 * Setup: npm install @fal-ai/serverless-client
 */

import * as fal from '@fal-ai/serverless-client';
import { db } from '@/lib/firebase';
import { adminDb } from '@/lib/firebase-admin';
import { doc, getDoc } from 'firebase/firestore';

// Configure FAL.ai client
fal.config({
  credentials: process.env.FAL_API_KEY
});

// Smart Google Image Search with e-commerce priority
async function googleRefImages(query: string, topN = 8): Promise<string[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX || process.env.GOOGLE_CSE_ID || process.env.NEXT_PUBLIC_GOOGLE_CSE_CX || process.env.NEXT_PUBLIC_CX;
  
  if (!apiKey || !cx) {
    console.warn('⚠️ Missing Google CSE credentials, skipping reference images');
    return [];
  }
  
  try {
    // Try e-commerce sites first
    const ecommerceSites = ['jumia.co.ke', 'kilimall.co.ke', 'amazon.com', 'ebay.com', 'walmart.com'];
    const siteQuery = ecommerceSites.map(s => `site:${s}`).join(' OR ');
    const ecommerceQuery = `(${siteQuery}) ${query}`;
    
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('q', ecommerceQuery);
    url.searchParams.set('num', String(Math.min(topN, 10)));
    url.searchParams.set('safe', 'active');
    url.searchParams.set('imgSize', 'large');
    url.searchParams.set('imgType', 'photo');
    
    const res = await fetch(url);
    let items: any[] = [];
    
    if (res.ok) {
      const json = await res.json();
      items = Array.isArray(json.items) ? json.items : [];
    }
    
    // Fallback to general if no e-commerce results
    if (items.length === 0) {
      console.log('⚠️ No e-commerce results, trying general search...');
      const generalUrl = new URL('https://www.googleapis.com/customsearch/v1');
      generalUrl.searchParams.set('key', apiKey);
      generalUrl.searchParams.set('cx', cx);
      generalUrl.searchParams.set('searchType', 'image');
      generalUrl.searchParams.set('q', query);
      generalUrl.searchParams.set('num', String(Math.min(topN, 10)));
      generalUrl.searchParams.set('safe', 'active');
      generalUrl.searchParams.set('imgSize', 'large');
      
      const generalRes = await fetch(generalUrl);
      if (!generalRes.ok) return [];
      
      const generalJson = await generalRes.json();
      items = Array.isArray(generalJson.items) ? generalJson.items : [];
    }
    
    // Score and filter images
    type Scored = { link: string; w: number; h: number; score: number }
    const scored: Scored[] = items.map((i: any) => {
      const w = Number(i.image?.width || 0);
      const h = Number(i.image?.height || 0);
      let score = 70;
      
      // Boost high resolution
      if (w * h >= 1000000) score += 15;
      else if (w * h >= 640000) score += 10;
      
      // Penalize bad patterns
      const urlLower = (i.link || '').toLowerCase();
      if (urlLower.includes('tiktok')) score -= 30;
      if (urlLower.includes('x-raw-image')) score -= 30;
      if (urlLower.includes('thumbnail')) score -= 10;
      
      return { link: i.link as string, w, h, score };
    }).filter((x: Scored) => Boolean(x.link) && x.score > 40);
    
    const sorted = scored.sort((a, b) => b.score - a.score);
    return sorted.map((x: Scored) => x.link);
  } catch (error: any) {
    console.error('❌ Google CSE search failed:', error.message);
    return [];
  }
}

// Fetch image as base64 data URL with retries
async function fetchImageAsDataUrl(url: string, retries = 3): Promise<{ dataUrl: string; originalUrl: string } | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*',
          'Referer': 'https://www.google.com/'
        },
        signal: AbortSignal.timeout(15000)
      });
      
      if (!res.ok) {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return null;
      }
      
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) return null;
      
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      
      return {
        dataUrl: `data:${contentType};base64,${base64}`,
        originalUrl: url
      };
    } catch (error: any) {
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  return null;
}

export interface FALImageGenerationParams {
  orgId: string;
  productId: string;
  name?: string;
  brand?: string;
  category?: string;
  supplier?: string;
  promptStyle?: string;
  imageSize?: 'square_hd' | 'square' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9';
  useGoogleRefs?: boolean; // Enable Google reference images
}

export interface FALImageResult {
  ok: boolean;
  url?: string;
  error?: string;
  revisedPrompt?: string;
  generationTime?: number;
  model?: string;
}

/**
 * Generate product image using FAL.ai FLUX schnell model
 * 90% cheaper than Replicate, same quality, faster generation
 */
export async function generateProductImageWithFAL(
  params: FALImageGenerationParams
): Promise<FALImageResult> {
  const startTime = Date.now();
  
  console.log('🎨 Starting FAL.ai image generation:', {
    productId: params.productId,
    orgId: params.orgId,
    hasPromptStyle: !!params.promptStyle
  });

  if (!process.env.FAL_API_KEY) {
    console.error('❌ Missing FAL_API_KEY in environment');
    return { ok: false, error: 'Missing FAL_API_KEY' };
  }

  // Fetch product details if not provided
  let name = params.name;
  let brand = params.brand;
  let category = params.category;
  let supplier = params.supplier;

  if (!name && db) {
    console.log('📦 Fetching product details from database...');
    try {
      const snap = await getDoc(doc(db, 'pos_products', params.productId));
      const p = snap.exists() ? (snap.data() as any) : {};
      name = p.name;
      brand = brand ?? p.brand;
      category = category ?? p.category;
      supplier = supplier ?? p.supplier;
      console.log('📦 Product details:', { name, brand, category, supplier });
    } catch (fetchError: any) {
      if (fetchError?.code === 'unavailable') {
        console.warn('⚠️ Firestore client offline, falling back to admin SDK');
        const adminSnap = await adminDb.collection('pos_products').doc(params.productId).get();
        if (adminSnap.exists) {
          const p = adminSnap.data() as any;
          name = p?.name;
          brand = brand ?? p?.brand;
          category = category ?? p?.category;
          supplier = supplier ?? p?.supplier;
          console.log('📦 Product details (admin fallback):', { name, brand, category, supplier });
        } else {
          console.error('❌ Product not found via admin fallback');
        }
      } else {
        console.error('❌ Failed to fetch product details:', fetchError);
        throw fetchError;
      }
    }
  }

  if (!name) {
    console.error('❌ Product has no name');
    return { ok: false, error: 'Product has no name' };
  }

  // Standardized prompt for consistent e-commerce product photos
  const basePrompt = params.promptStyle || 
    `Professional studio product photography, single centered product on floating glass shelf, 
     uniform slate gray background (#1f2937), tight crop with product filling 75% of frame, 
     sharp focus with gentle depth of field, cool teal-accent lighting, high detail, 
     rich color saturation, subtle film grain, no text or props, modern e-commerce style, 
     clean and minimalist aesthetic.`;

  const title = `${brand ? brand + ' ' : ''}${name}`.trim();
  const enhancedPrompt = `${basePrompt} Product: ${title}${category ? '. Category: ' + category : ''}. 
    Maintain consistent slate gray backdrop with subtle glass reflection. No alternative backgrounds.`;

  console.log('📝 Enhanced prompt:', enhancedPrompt.substring(0, 150) + '...');

  // Try to get reference images if enabled
  let referenceImageUrl: string | undefined;
  let referenceImageSources: string[] = [];
  
  if (params.useGoogleRefs !== false) { // Default to true
    console.log('🔍 Searching for reference images...');
    const refs = await googleRefImages(`${title} ${category ? category + ' ' : ''}product image`, 8);
    
    if (refs.length) {
      console.log(`✅ Found ${refs.length} reference URLs, downloading...`);
      
      // Try to fetch at least one good reference
      for (const url of refs) {
        const data = await fetchImageAsDataUrl(url, 3);
        if (data?.dataUrl) {
          referenceImageUrl = data.dataUrl;
          referenceImageSources.push(data.originalUrl);
          console.log('✅ Loaded reference image for guidance');
          break; // FAL.ai uses single reference
        }
      }
      
      // Retry with simpler query if no references loaded
      if (!referenceImageUrl && brand) {
        console.log('🔄 Retrying with brand name...');
        const simpleRefs = await googleRefImages(`${brand} product`, 8);
        for (const url of simpleRefs) {
          const data = await fetchImageAsDataUrl(url, 3);
          if (data?.dataUrl) {
            referenceImageUrl = data.dataUrl;
            referenceImageSources.push(data.originalUrl);
            console.log('✅ Loaded reference image (retry)');
            break;
          }
        }
      }
    }
    
    if (!referenceImageUrl) {
      console.warn('⚠️ No reference images loaded - quality may be reduced');
    }
  }

  try {
    // Build FAL.ai input
    const input: any = {
      prompt: enhancedPrompt,
      image_size: params.imageSize || 'square_hd', // 1024x1024 for square_hd
      num_inference_steps: 4, // FLUX schnell optimized for 4 steps
      num_images: 1,
      enable_safety_checker: true,
      output_format: 'jpeg', // Smaller file size than PNG
      guidance_scale: 3.5 // Lower for FLUX schnell (recommended 3-4)
    };
    
    // Add reference image if available
    if (referenceImageUrl) {
      input.image_url = referenceImageUrl;
      input.strength = 0.6; // How much to follow the reference (0-1)
      console.log('🖼️ Using reference image for guidance (strength: 0.6)');
    }
    
    // Call FAL.ai FLUX schnell model
    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log('🔄 Generation in progress...');
        }
      }
    }) as any;

    const generationTime = Date.now() - startTime;
    console.log(`✅ Image generated in ${generationTime}ms`);

    // FAL.ai returns images array
    if (result.data && result.data.images && result.data.images.length > 0) {
      const imageUrl = result.data.images[0].url;
      
      console.log('🖼️ Image URL:', imageUrl);
      console.log('📊 Generation details:', {
        seed: result.data.seed,
        timings: result.data.timings,
        hasNsfw: result.data.has_nsfw_concepts?.[0] || false
      });

      return {
        ok: true,
        url: imageUrl,
        revisedPrompt: enhancedPrompt,
        generationTime,
        model: 'fal-ai/flux/schnell'
      };
    } else {
      console.error('❌ No images in FAL.ai response');
      return { ok: false, error: 'No images generated' };
    }
  } catch (error: any) {
    console.error('❌ FAL.ai generation error:', error);
    return {
      ok: false,
      error: error.message || 'Image generation failed'
    };
  }
}

/**
 * Batch generate images for multiple products
 * Useful for generating distributor catalog images
 */
export async function batchGenerateImages(
  products: FALImageGenerationParams[],
  concurrency: number = 10
): Promise<Map<string, FALImageResult>> {
  console.log(`🚀 Starting batch generation for ${products.length} products (concurrency: ${concurrency})`);
  
  const results = new Map<string, FALImageResult>();
  const batches: FALImageGenerationParams[][] = [];

  // Split into batches
  for (let i = 0; i < products.length; i += concurrency) {
    batches.push(products.slice(i, i + concurrency));
  }

  // Process batches sequentially, products within batch in parallel
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} products)`);

    const batchResults = await Promise.allSettled(
      batch.map(product => generateProductImageWithFAL(product))
    );

    batchResults.forEach((result, index) => {
      const product = batch[index];
      if (result.status === 'fulfilled') {
        results.set(product.productId, result.value);
      } else {
        results.set(product.productId, {
          ok: false,
          error: result.reason?.message || 'Generation failed'
        });
      }
    });

    // Small delay between batches to avoid rate limits
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const successCount = Array.from(results.values()).filter(r => r.ok).length;
  console.log(`✅ Batch complete: ${successCount}/${products.length} successful`);

  return results;
}

/**
 * Cost estimation helper
 */
export function estimateGenerationCost(numImages: number): {
  falCost: number;
  replicateCost: number;
  savings: number;
  savingsPercent: number;
} {
  const falCost = numImages * 0.003;
  const replicateCost = numImages * 0.03;
  const savings = replicateCost - falCost;
  const savingsPercent = (savings / replicateCost) * 100;

  return {
    falCost: parseFloat(falCost.toFixed(2)),
    replicateCost: parseFloat(replicateCost.toFixed(2)),
    savings: parseFloat(savings.toFixed(2)),
    savingsPercent: parseFloat(savingsPercent.toFixed(1))
  };
}

// Example usage:
// const cost = estimateGenerationCost(7000);
// console.log(`FAL.ai: $${cost.falCost} | Replicate: $${cost.replicateCost} | Savings: $${cost.savings} (${cost.savingsPercent}%)`);
