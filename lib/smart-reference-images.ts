/**
 * Smart Reference Image Finder
 * Multi-strategy approach to find the best product reference images
 * 
 * Strategies (in order of priority):
 * 1. Brand official websites (highest quality, authentic)
 * 2. E-commerce sites (Amazon, eBay, etc.)
 * 3. Manufacturer/distributor catalogs
 * 4. Google Shopping results
 * 5. Regular Google Image Search (fallback)
 */

interface ReferenceImage {
  url: string;
  source: 'brand-website' | 'ecommerce' | 'catalog' | 'shopping' | 'general';
  score: number; // Higher is better
  width?: number;
  height?: number;
}

interface SearchConfig {
  apiKey: string;
  cx: string;
}

/**
 * Strategy 1: Search brand official website
 * Most authentic product images, highest quality
 */
async function searchBrandWebsite(
  brand: string,
  productName: string,
  config: SearchConfig
): Promise<ReferenceImage[]> {
  if (!brand) return [];
  
  console.log(`   🏢 Strategy 1: Searching ${brand} official website...`);
  
  // Common brand website patterns
  const brandDomain = brand.toLowerCase().replace(/\s+/g, '');
  const siteQueries = [
    `site:${brandDomain}.com OR site:${brandDomain}.co.ke`,
    `site:${brandDomain}.com`,
    `inurl:${brandDomain}`,
  ];
  
  for (const siteQuery of siteQueries) {
    try {
      const query = `${siteQuery} ${productName} product`;
      const results = await googleImageSearch(query, config, 5);
      
      if (results.length > 0) {
        console.log(`   ✅ Found ${results.length} images from brand website`);
        return results.map(r => ({
          ...r,
          source: 'brand-website',
          score: 100 // Highest priority
        }));
      }
    } catch (error) {
      // Try next pattern
    }
  }
  
  console.log(`   ⏭️ No brand website images found`);
  return [];
}

/**
 * Strategy 2: Search major e-commerce platforms
 * High quality, professional product photos
 */
async function searchEcommerce(
  brand: string,
  productName: string,
  config: SearchConfig
): Promise<ReferenceImage[]> {
  console.log(`   🛒 Strategy 2: Searching e-commerce platforms...`);
  
  // Prioritize sites with good product images
  const ecommerceSites = [
    'amazon.com',
    'jumia.co.ke', // Kenya
    'kilimall.co.ke', // Kenya
    'masoko.com', // Kenya
    'jiji.co.ke', // Kenya
    'ebay.com',
    'walmart.com',
    'target.com'
  ];
  
  const siteQuery = ecommerceSites.map(s => `site:${s}`).join(' OR ');
  const query = `(${siteQuery}) ${brand} ${productName}`;
  
  try {
    const results = await googleImageSearch(query, config, 8);
    
    if (results.length > 0) {
      console.log(`   ✅ Found ${results.length} e-commerce images`);
      return results.map(r => ({
        ...r,
        source: 'ecommerce',
        score: 90
      }));
    }
  } catch (error: any) {
    console.log(`   ⚠️ E-commerce search failed: ${error.message}`);
  }
  
  return [];
}

/**
 * Strategy 3: Google Shopping results
 * Structured product data, high quality images
 */
async function searchGoogleShopping(
  brand: string,
  productName: string,
  config: SearchConfig
): Promise<ReferenceImage[]> {
  console.log(`   🛍️ Strategy 3: Searching Google Shopping...`);
  
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', config.apiKey);
    url.searchParams.set('cx', config.cx);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('q', `${brand} ${productName}`);
    url.searchParams.set('num', '8');
    url.searchParams.set('safe', 'active');
    url.searchParams.set('imgSize', 'large');
    url.searchParams.set('imgType', 'photo');
    url.searchParams.set('rights', 'cc_publicdomain|cc_attribute|cc_sharealike'); // Prefer licensed images
    
    const res = await fetch(url);
    if (!res.ok) return [];
    
    const json = await res.json();
    const items = json.items || [];
    
    const images = items.map((item: any) => ({
      url: item.link,
      source: 'shopping' as const,
      score: 85,
      width: Number(item.image?.width || 0),
      height: Number(item.image?.height || 0)
    }));
    
    if (images.length > 0) {
      console.log(`   ✅ Found ${images.length} shopping images`);
    }
    
    return images;
  } catch (error: any) {
    console.log(`   ⚠️ Shopping search failed: ${error.message}`);
    return [];
  }
}

/**
 * Strategy 4: Smart general search with quality filters
 * Fallback with optimized search terms
 */
async function searchGeneralOptimized(
  brand: string,
  productName: string,
  category: string,
  config: SearchConfig
): Promise<ReferenceImage[]> {
  console.log(`   🔍 Strategy 4: Optimized general search...`);
  
  // Build smart query with context
  const searchTerms = [];
  
  if (brand) searchTerms.push(brand);
  
  // Extract key product identifiers (sizes, types, etc.)
  const productWords = productName.split(/\s+/).filter(w => 
    w.length > 2 && !['THE', 'AND', 'FOR', 'WITH'].includes(w.toUpperCase())
  );
  searchTerms.push(...productWords.slice(0, 3)); // Top 3 most relevant words
  
  if (category) searchTerms.push(category);
  
  // Add context keywords for better results
  searchTerms.push('product', 'packaging');
  
  const query = searchTerms.join(' ');
  
  try {
    const results = await googleImageSearch(query, config, 10);
    
    if (results.length > 0) {
      console.log(`   ✅ Found ${results.length} general images`);
      return results.map(r => ({
        ...r,
        source: 'general',
        score: 70
      }));
    }
  } catch (error: any) {
    console.log(`   ⚠️ General search failed: ${error.message}`);
  }
  
  return [];
}

/**
 * Base Google Image Search function
 */
async function googleImageSearch(
  query: string,
  config: SearchConfig,
  numResults: number = 8
): Promise<Array<{ url: string; width: number; height: number }>> {
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', config.apiKey);
  url.searchParams.set('cx', config.cx);
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('q', query);
  url.searchParams.set('num', String(Math.min(numResults, 10)));
  url.searchParams.set('safe', 'active');
  url.searchParams.set('imgSize', 'large');
  url.searchParams.set('imgType', 'photo');
  
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
  const json = await res.json();
  const items = json.items || [];
  
  return items.map((item: any) => ({
    url: item.link,
    width: Number(item.image?.width || 0),
    height: Number(item.image?.height || 0)
  }));
}

/**
 * Score and rank reference images
 */
function scoreImages(images: ReferenceImage[]): ReferenceImage[] {
  return images.map(img => {
    let score = img.score;
    
    // Boost score for high resolution (prefer >1000px)
    if (img.width && img.height) {
      const area = img.width * img.height;
      if (area >= 1000000) score += 15; // 1000x1000+
      else if (area >= 640000) score += 10; // 800x800+
      else if (area >= 250000) score += 5; // 500x500+
      
      // Prefer square-ish images (better for product photos)
      const ratio = Math.max(img.width, img.height) / Math.min(img.width, img.height);
      if (ratio <= 1.2) score += 10; // Nearly square
      else if (ratio <= 1.5) score += 5; // Slightly rectangular
    }
    
    // Boost score for certain domains (known good sources)
    const urlLower = img.url.toLowerCase();
    if (urlLower.includes('amazonaws.com') || urlLower.includes('cloudinary.com')) {
      score += 5; // CDN images usually high quality
    }
    
    // Penalize certain bad patterns
    if (urlLower.includes('thumbnail') || urlLower.includes('thumb')) score -= 10;
    if (urlLower.includes('icon') || urlLower.includes('logo')) score -= 15;
    if (urlLower.includes('tiktok.com')) score -= 20; // Often blocked or low quality
    if (urlLower.includes('x-raw-image')) score -= 30; // Internal/proxy URLs
    
    return { ...img, score };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Fetch image as data URL with validation
 */
async function fetchImageAsDataUrl(
  url: string,
  retries = 3
): Promise<{ dataUrl: string; originalUrl: string; sizeKB: number } | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.google.com/',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'cross-site'
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
      const sizeKB = buffer.byteLength / 1024;
      
      // Validate image size (skip tiny images, likely icons)
      if (sizeKB < 5) {
        console.log(`   ⚠️ Image too small (${sizeKB.toFixed(1)}KB): ${url.substring(0, 60)}...`);
        return null;
      }
      
      const base64 = Buffer.from(buffer).toString('base64');
      
      return {
        dataUrl: `data:${contentType};base64,${base64}`,
        originalUrl: url,
        sizeKB: Math.round(sizeKB)
      };
    } catch (error: any) {
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  return null;
}

/**
 * Main smart reference finder
 * Tries multiple strategies and returns best results
 */
export async function findSmartReferenceImages(params: {
  brand: string;
  productName: string;
  category?: string;
  maxImages?: number;
}): Promise<Array<{ dataUrl: string; source: string; originalUrl: string }>> {
  console.log(`   🧠 Smart Reference Search: "${params.brand} ${params.productName}"`);
  
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX || process.env.NEXT_PUBLIC_CX;
  
  if (!apiKey || !cx) {
    console.log('   ⚠️ Missing Google CSE credentials');
    return [];
  }
  
  const config = { apiKey, cx };
  const maxImages = params.maxImages || 4;
  const allImages: ReferenceImage[] = [];
  
  // Try strategies in order of quality
  const strategies = [
    () => searchBrandWebsite(params.brand, params.productName, config),
    () => searchEcommerce(params.brand, params.productName, config),
    () => searchGoogleShopping(params.brand, params.productName, config),
    () => searchGeneralOptimized(params.brand, params.productName, params.category || '', config)
  ];
  
  for (const strategy of strategies) {
    try {
      const images = await strategy();
      allImages.push(...images);
      
      // If we have enough high-quality images from brand/ecommerce, stop early
      const highQualityCount = allImages.filter(img => 
        img.source === 'brand-website' || img.source === 'ecommerce'
      ).length;
      
      if (highQualityCount >= maxImages) {
        console.log(`   ✅ Found ${highQualityCount} high-quality images, stopping search`);
        break;
      }
    } catch (error: any) {
      console.log(`   ⚠️ Strategy failed: ${error.message}`);
    }
  }
  
  if (allImages.length === 0) {
    console.log('   ❌ No reference images found from any strategy');
    return [];
  }
  
  // Score and rank all images
  const rankedImages = scoreImages(allImages);
  console.log(`   📊 Found ${rankedImages.length} total images, ranking by quality...`);
  
  // Show top scored images
  rankedImages.slice(0, 5).forEach((img, i) => {
    console.log(`   ${i + 1}. Score: ${img.score}, Source: ${img.source}, URL: ${img.url.substring(0, 60)}...`);
  });
  
  // Try to fetch the best images
  const fetchedImages: Array<{ dataUrl: string; source: string; originalUrl: string }> = [];
  
  for (const img of rankedImages) {
    if (fetchedImages.length >= maxImages) break;
    
    console.log(`   📥 Fetching image ${fetchedImages.length + 1}/${maxImages} (score: ${img.score}, source: ${img.source})...`);
    const data = await fetchImageAsDataUrl(img.url, 3);
    
    if (data) {
      fetchedImages.push({
        dataUrl: data.dataUrl,
        source: img.source,
        originalUrl: data.originalUrl
      });
      console.log(`   ✅ Loaded ${img.source} image (${data.sizeKB}KB)`);
    }
  }
  
  console.log(`   🎯 Successfully loaded ${fetchedImages.length}/${maxImages} reference images`);
  
  // If we still don't have enough, try fallback
  if (fetchedImages.length === 0) {
    console.log('   🔄 Trying fallback: brand-only search...');
    const fallbackImages = await searchGeneralOptimized(
      params.brand,
      '',
      params.category || '',
      config
    );
    
    const rankedFallback = scoreImages(fallbackImages);
    for (const img of rankedFallback.slice(0, maxImages)) {
      const data = await fetchImageAsDataUrl(img.url, 3);
      if (data) {
        fetchedImages.push({
          dataUrl: data.dataUrl,
          source: 'fallback',
          originalUrl: data.originalUrl
        });
        if (fetchedImages.length >= maxImages) break;
      }
    }
  }
  
  return fetchedImages;
}

/**
 * Simpler version for backward compatibility
 */
export async function getSmartReferenceImages(
  brand: string,
  productName: string,
  category?: string
): Promise<string[]> {
  const results = await findSmartReferenceImages({
    brand,
    productName,
    category,
    maxImages: 4
  });
  
  return results.map(r => r.dataUrl);
}
