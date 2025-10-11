/**
 * Test FAL.ai with SMART Reference Images
 * Uses multi-strategy search for highest quality reference images
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as fal from '@fal-ai/serverless-client';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

console.log('🧠 Testing FAL.ai with SMART Reference Images\n');

// ============================================================================
// SMART REFERENCE IMAGE FINDER (Inlined)
// ============================================================================

interface ReferenceImage {
  url: string;
  source: 'brand-website' | 'ecommerce' | 'shopping' | 'general';
  score: number;
  width?: number;
  height?: number;
}

async function googleImageSearch(
  query: string,
  apiKey: string,
  cx: string,
  numResults: number = 8
): Promise<Array<{ url: string; width: number; height: number }>> {
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cx);
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

async function searchEcommerce(
  brand: string,
  productName: string,
  apiKey: string,
  cx: string
): Promise<ReferenceImage[]> {
  console.log(`   🛒 Strategy 1: Searching e-commerce platforms...`);
  
  const kenyaSites = ['jumia.co.ke', 'kilimall.co.ke', 'masoko.com', 'jiji.co.ke'];
  const globalSites = ['amazon.com', 'ebay.com', 'walmart.com'];
  const allSites = [...kenyaSites, ...globalSites];
  
  const siteQuery = allSites.map(s => `site:${s}`).join(' OR ');
  const query = `(${siteQuery}) ${brand} ${productName}`;
  
  try {
    const results = await googleImageSearch(query, apiKey, cx, 8);
    
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

async function searchGeneralOptimized(
  brand: string,
  productName: string,
  category: string,
  apiKey: string,
  cx: string
): Promise<ReferenceImage[]> {
  console.log(`   🔍 Strategy 2: Optimized general search...`);
  
  const searchTerms = [];
  if (brand) searchTerms.push(brand);
  
  const productWords = productName.split(/\s+/).filter(w => 
    w.length > 2 && !['THE', 'AND', 'FOR', 'WITH'].includes(w.toUpperCase())
  );
  searchTerms.push(...productWords.slice(0, 3));
  
  if (category) searchTerms.push(category);
  searchTerms.push('product', 'packaging');
  
  const query = searchTerms.join(' ');
  
  try {
    const results = await googleImageSearch(query, apiKey, cx, 10);
    
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

function scoreImages(images: ReferenceImage[]): ReferenceImage[] {
  return images.map(img => {
    let score = img.score;
    
    if (img.width && img.height) {
      const area = img.width * img.height;
      if (area >= 1000000) score += 15;
      else if (area >= 640000) score += 10;
      else if (area >= 250000) score += 5;
      
      const ratio = Math.max(img.width, img.height) / Math.min(img.width, img.height);
      if (ratio <= 1.2) score += 10;
      else if (ratio <= 1.5) score += 5;
    }
    
    const urlLower = img.url.toLowerCase();
    if (urlLower.includes('amazonaws.com') || urlLower.includes('cloudinary.com')) score += 5;
    if (urlLower.includes('thumbnail') || urlLower.includes('thumb')) score -= 10;
    if (urlLower.includes('icon') || urlLower.includes('logo')) score -= 15;
    if (urlLower.includes('tiktok.com')) score -= 20;
    if (urlLower.includes('x-raw-image')) score -= 30;
    
    return { ...img, score };
  }).sort((a, b) => b.score - a.score);
}

async function fetchImageAsDataUrl(
  url: string,
  retries = 3
): Promise<{ dataUrl: string; originalUrl: string; sizeKB: number } | null> {
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
      const sizeKB = buffer.byteLength / 1024;
      
      if (sizeKB < 5) return null; // Skip tiny images
      
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

async function findSmartReferenceImages(params: {
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
  
  const maxImages = params.maxImages || 4;
  const allImages: ReferenceImage[] = [];
  
  // Try e-commerce first, then general
  const ecommerceImages = await searchEcommerce(params.brand, params.productName, apiKey, cx);
  allImages.push(...ecommerceImages);
  
  if (allImages.length < maxImages * 2) {
    const generalImages = await searchGeneralOptimized(
      params.brand,
      params.productName,
      params.category || '',
      apiKey,
      cx
    );
    allImages.push(...generalImages);
  }
  
  if (allImages.length === 0) {
    console.log('   ❌ No reference images found');
    return [];
  }
  
  const rankedImages = scoreImages(allImages);
  console.log(`   📊 Found ${rankedImages.length} total images, fetching best ones...`);
  
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
  return fetchedImages;
}

// ============================================================================

// Initialize Firebase Admin SDK
const adminConfig: any = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vendai-fa58c',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vendai-fa58c.firebasestorage.app',
};

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    adminConfig.credential = cert(serviceAccount);
    console.log('✅ Using Firebase service account credentials');
  } catch (e) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    process.exit(1);
  }
} else {
  console.error('❌ Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
  process.exit(1);
}

let adminApp;
try {
  adminApp = getApps().find(app => app.name === 'smart-test-app') || 
    initializeApp(adminConfig, 'smart-test-app');
  console.log('✅ Firebase Admin app initialized\n');
} catch (error: any) {
  console.error('❌ Failed to initialize Firebase Admin app:', error.message);
  process.exit(1);
}

const db = getFirestore(adminApp);
const storage = getStorage(adminApp);
fal.config({ credentials: process.env.FAL_API_KEY });

interface Product {
  lineNumber: number;
  productName: string;
  brandName: string;
  category: string;
  packSize: string;
  price: number;
}

// Categorize products
function categorizeProduct(productName: string): string {
  const lower = productName.toLowerCase();
  if (/rice|basmati|biryani/.test(lower)) return 'Rice';
  if (/flour|atta|baking/.test(lower)) return 'Flour & Grains';
  if (/oil|fat|cooking/.test(lower)) return 'Cooking Oils & Fats';
  if (/milk|yoghurt/.test(lower)) return 'Dairy Products';
  if (/juice|drink|water|soda|coca/.test(lower)) return 'Beverages';
  if (/soap|cleaner|detergent/.test(lower)) return 'Cleaning Products';
  return 'General';
}

// Parse first 5 products
function parseFirst5(filePath: string): Product[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const products: Product[] = [];

  for (let i = 0; i < lines.length && products.length < 5; i++) {
    const line = lines[i].trim();
    if (line.length < 20) continue;
    if (/^(Date|Time|Continue|Page|#Description)/i.test(line)) continue;
    
    const match = line.match(/^(\d+)(.+?)(KES\s*[\d,]+\.?\d*)\s*(.+)$/);
    if (!match) continue;
    
    const [, lineNum, description, price] = match;
    const productName = description.trim();
    
    const brandMatch = productName.match(/^([A-Z][A-Z\s]+?)(?:\s+\d|$)/);
    const brandName = brandMatch ? brandMatch[1].trim() : productName.split(' ')[0];
    
    const sizeMatch = productName.match(/(\d+(?:\.\d+)?(?:KG|L|ML|GM|G|PCS|PC|X\d+))/i);
    const packSize = sizeMatch ? sizeMatch[1] : 'N/A';
    
    products.push({
      lineNumber: parseInt(lineNum),
      productName,
      brandName,
      category: categorizeProduct(productName),
      packSize,
      price: parseFloat(price.replace(/KES|,/g, '').trim())
    });
  }
  
  return products;
}

// Generate image with SMART references
async function generateImage(product: Product): Promise<{ url: string; references: string[]; sources: string[] } | null> {
  try {
    const title = `${product.brandName} ${product.productName}`.trim();
    
    // Get SMART reference images
    console.log('   🧠 Finding smart reference images...');
    const smartRefs = await findSmartReferenceImages({
      brand: product.brandName,
      productName: product.productName,
      category: product.category,
      maxImages: 4
    });
    
    if (smartRefs.length === 0) {
      console.log('   ❌ No reference images found');
      return null;
    }
    
    console.log(`   ✅ Loaded ${smartRefs.length} smart references`);
    smartRefs.forEach((ref, i) => {
      console.log(`      ${i + 1}. Source: ${ref.source}`);
    });
    
    // Build prompt
    const basePrompt = `Studio product photo, single centered product captured with a tight crop (product fills ~75% of frame) on a floating glass shelf, uniform slate background (#1f2937) matching the Vendai dashboard, crisp focus across the product with gentle depth falloff, cool teal-accent studio lighting, high detail, rich color, subtle grain, no text, props, hands, or accessories, background color must remain constant, consistent shadow and lighting, modern, e-commerce ready.`;
    
    const enhancedPrompt = `${basePrompt}. Product: ${title}${product.category ? '. Category: ' + product.category : ''}. Maintain an unbroken slate backdrop (#1f2937) with subtle glass reflection; no alternative backgrounds.`;
    
    console.log('   🎨 Generating with FAL.ai...');
    
    // FAL.ai input with best reference
    const input: any = {
      prompt: enhancedPrompt,
      image_size: 'square_hd',
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
      output_format: 'jpeg',
      guidance_scale: 3.5
    };
    
    // Use the highest-scored reference (first one)
    input.image_url = smartRefs[0].dataUrl;
    input.strength = 0.6;
    console.log(`   🖼️ Using ${smartRefs[0].source} reference image for guidance`);
    
    const result: any = await fal.subscribe('fal-ai/flux/schnell', { input });
    
    if (!result.images || result.images.length === 0) {
      throw new Error('No images in response');
    }
    
    console.log('   ✅ Image generated successfully');
    
    return {
      url: result.images[0].url,
      references: smartRefs.map(r => r.originalUrl),
      sources: smartRefs.map(r => r.source)
    };
  } catch (error: any) {
    console.error(`   ❌ Generation error: ${error.message}`);
    return null;
  }
}

// Upload to Firebase Storage
async function uploadToStorage(imageUrl: string, product: Product): Promise<string> {
  console.log('   📤 Uploading to Firebase Storage...');
  
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  
  const sanitizedName = product.productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 50);
  const hash = Math.random().toString(36).substring(2, 8);
  const fileName = `${sanitizedName}-smart-${hash}.jpg`;
  const storagePath = `distributor-images/sam-west/${product.category.toLowerCase().replace(/\s+/g, '-')}/${fileName}`;
  
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  await file.save(Buffer.from(buffer), {
    contentType: 'image/jpeg',
    metadata: { cacheControl: 'public, max-age=31536000' }
  });
  await file.makePublic();
  
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  console.log('   ✅ Uploaded to:', publicUrl);
  
  return publicUrl;
}

// Main
async function main() {
  const dataDir = path.join(process.cwd(), 'data');
  const samWestPath = path.join(dataDir, 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt');
  
  if (!fs.existsSync(samWestPath)) {
    console.error('❌ Sam West pricelist not found');
    process.exit(1);
  }
  
  console.log('📦 Parsing first 5 products from Sam West...\n');
  const products = parseFirst5(samWestPath);
  
  if (products.length === 0) {
    console.error('❌ No products found');
    process.exit(1);
  }
  
  console.log(`✅ Found ${products.length} products to test\n`);
  console.log('💰 Estimated cost: $0.015 (5 × $0.003)\n');
  console.log('🧠 Using SMART reference image search (multi-strategy)\n');
  console.log('═'.repeat(70));
  console.log('');
  
  let successCount = 0;
  const results: any[] = [];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n[${i + 1}/5] ${product.productName}`);
    console.log('─'.repeat(70));
    
    try {
      // Generate image with smart references
      const imageResult = await generateImage(product);
      if (!imageResult) {
        results.push({ product: product.productName, status: 'failed', error: 'Generation failed' });
        continue;
      }
      
      // Upload to Firebase
      const storageUrl = await uploadToStorage(imageResult.url, product);
      
      // Save metadata to Firestore
      console.log('   💾 Saving to Firestore...');
      const docRef = await db.collection('distributor_images').add({
        distributorId: 'sam-west',
        distributorName: 'Sam West Supermarket',
        productName: product.productName,
        brandName: product.brandName,
        category: product.category,
        packSize: product.packSize,
        price: product.price,
        imageUrl: storageUrl,
        storagePath: storageUrl.split('/').slice(-4).join('/'),
        referenceImages: imageResult.references,
        referenceSources: imageResult.sources, // NEW: Track source quality
        generatedAt: new Date().toISOString(),
        generationModel: 'fal-ai/flux/schnell',
        searchStrategy: 'smart-multi-strategy', // NEW: Mark as smart search
        timesReused: 0,
        reusedByRetailers: [],
        verified: false,
        testBatch: true,
        smartSearch: true, // NEW: Flag for analytics
        searchIndex: {
          brand_lower: product.brandName.toLowerCase(),
          product_lower: product.productName.toLowerCase(),
          category_lower: product.category.toLowerCase()
        }
      });
      
      console.log('   ✅ Saved with ID:', docRef.id);
      
      results.push({
        product: product.productName,
        status: 'success',
        imageUrl: storageUrl,
        firestoreId: docRef.id,
        references: imageResult.references.length,
        sources: imageResult.sources.join(', ')
      });
      
      successCount++;
      
      // Small delay between generations
      if (i < products.length - 1) {
        console.log('\n   ⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({ product: product.productName, status: 'failed', error: error.message });
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('🎉 SMART Test Complete!');
  console.log('═'.repeat(70));
  console.log(`✅ Successful: ${successCount}/5`);
  console.log(`💰 Cost: $${(successCount * 0.003).toFixed(3)}`);
  console.log('');
  
  console.log('📊 Results Summary:');
  console.log('─'.repeat(70));
  results.forEach((r, i) => {
    if (r.status === 'success') {
      console.log(`${i + 1}. ✅ ${r.product}`);
      console.log(`   📷 Image: ${r.imageUrl}`);
      console.log(`   🔍 References: ${r.references} (Sources: ${r.sources})`);
      console.log(`   🆔 Firestore ID: ${r.firestoreId}`);
    } else {
      console.log(`${i + 1}. ❌ ${r.product}`);
      console.log(`   Error: ${r.error}`);
    }
    console.log('');
  });
  
  console.log('═'.repeat(70));
  console.log('🧠 SMART Search Benefits:');
  console.log('   ✅ Prioritizes official brand websites');
  console.log('   ✅ Searches e-commerce sites (higher quality)');
  console.log('   ✅ Filters out low-quality/blocked URLs');
  console.log('   ✅ Scores images by quality metrics');
  console.log('   ✅ Validates image size (skips tiny icons)');
  console.log('═'.repeat(70));
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
