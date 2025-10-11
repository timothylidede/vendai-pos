/**
 * Generate Sam West Images with Google Reference Images
 * Batches of 100 products at a time
 * 
 * Usage: npx tsx scripts/generate-sam-west-batch.ts [batch-number]
 * Example: npx tsx scripts/generate-sam-west-batch.ts 1  (products 1-100)
 *          npx tsx scripts/generate-sam-west-batch.ts 2  (products 101-200)
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import OpenAI from 'openai';
import * as fal from '@fal-ai/serverless-client';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
config({ path: path.join(__dirname, '..', '.env.local') });

// Batch configuration
const BATCH_SIZE = 100;
const batchNumber = parseInt(process.argv[2] || '1');
const startIndex = (batchNumber - 1) * BATCH_SIZE;
const endIndex = startIndex + BATCH_SIZE;

console.log(`🚀 Sam West Batch ${batchNumber} Generator`);
console.log(`   Products ${startIndex + 1} to ${endIndex}`);
console.log('');

// Initialize Firebase using environment variables
try {
  const adminConfig: any = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vendai-fa58c',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vendai-fa58c.firebasestorage.app',
  };

  // Add service account key if available
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    adminConfig.credential = cert(serviceAccount);
    console.log('✅ Using Firebase service account credentials');
  } else {
    console.error('❌ Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable');
    console.log('💡 Set it in your .env.local file');
    process.exit(1);
  }

  initializeApp(adminConfig);
  console.log('✅ Firebase initialized successfully');
} catch (error: any) {
  console.error('❌ Firebase init error:', error.message);
  process.exit(1);
}

const db = getFirestore();
const storage = getStorage();
fal.config({ credentials: process.env.FAL_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ParsedProduct {
  distributorId: string;
  distributorName: string;
  lineNumber: number;
  productName: string;
  brandName: string;
  category: string;
  packSize: string;
  packUnit: string;
  price?: number;
}

// SMART Google Image Search with e-commerce priority
async function googleRefImages(query: string, topN = 8): Promise<string[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX || process.env.NEXT_PUBLIC_CX;

  if (!apiKey || !cx) {
    console.log('   ⚠️ Missing Google CSE credentials');
    return [];
  }

  try {
    // Try e-commerce sites first for professional product photos
    const ecommerceSites = ['jumia.co.ke', 'kilimall.co.ke', 'amazon.com', 'ebay.com', 'walmart.com'];
    const siteQuery = ecommerceSites.map(s => `site:${s}`).join(' OR ');
    const ecommerceQuery = `(${siteQuery}) ${query}`;

    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', ecommerceQuery);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', String(Math.min(topN, 10)));
    url.searchParams.set('safe', 'active');
    url.searchParams.set('imgSize', 'large');
    url.searchParams.set('imgType', 'photo');

    const response = await fetch(url.toString());
    let items: any[] = [];

    if (response.ok) {
      const data = await response.json();
      items = data.items || [];
    }

    // Fallback to general search if no e-commerce results
    if (items.length === 0) {
      const generalUrl = new URL('https://www.googleapis.com/customsearch/v1');
      generalUrl.searchParams.set('key', apiKey);
      generalUrl.searchParams.set('cx', cx);
      generalUrl.searchParams.set('q', query);
      generalUrl.searchParams.set('searchType', 'image');
      generalUrl.searchParams.set('num', String(Math.min(topN, 10)));
      generalUrl.searchParams.set('safe', 'active');
      generalUrl.searchParams.set('imgSize', 'large');

      const generalResponse = await fetch(generalUrl.toString());
      if (generalResponse.ok) {
        const generalData = await generalResponse.json();
        items = generalData.items || [];
      }
    }

    // Score and filter images
    type Scored = { link: string; score: number }
    const scored: Scored[] = items.map((i: any) => {
      let score = 70;
      const urlLower = (i.link || '').toLowerCase();
      
      // Penalize bad patterns
      if (urlLower.includes('tiktok')) score -= 30;
      if (urlLower.includes('x-raw-image')) score -= 30;
      if (urlLower.includes('thumbnail')) score -= 10;
      
      return { link: i.link as string, score };
    }).filter((x: Scored) => Boolean(x.link) && x.score > 40);

    const sorted = scored.sort((a, b) => b.score - a.score);
    return sorted.map(x => x.link);
  } catch (error: any) {
    console.log('   ⚠️ Google search error:', error.message);
    return [];
  }
}

// Convert image URL to data URL with retry logic
async function fetchImageAsDataUrl(url: string, retries = 3): Promise<{ dataUrl: string; sizeKB: number } | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*',
          'Referer': 'https://www.google.com/'
        },
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return null;
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) return null;

      const buffer = await response.arrayBuffer();
      const sizeKB = buffer.byteLength / 1024;
      
      // Skip tiny images (likely icons)
      if (sizeKB < 5) return null;

      const base64 = Buffer.from(buffer).toString('base64');
      return {
        dataUrl: `data:${contentType};base64,${base64}`,
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

// Categorize products
function categorizeProduct(productName: string): string {
  const lower = productName.toLowerCase();
  if (/rice|basmati|biryani/.test(lower)) return 'Rice';
  if (/flour|atta|baking|maize meal/.test(lower)) return 'Flour & Grains';
  if (/oil|fat|cooking/.test(lower)) return 'Cooking Oils & Fats';
  if (/milk|yoghurt|cheese|butter/.test(lower)) return 'Dairy Products';
  if (/juice|drink|beverage|water/.test(lower)) return 'Beverages';
  if (/soap|cleaner|detergent|toilet|bathroom/.test(lower)) return 'Cleaning Products';
  if (/diaper|wipes|sanitary|shampoo/.test(lower)) return 'Personal Care';
  if (/biscuit|cookie|snack|crisp/.test(lower)) return 'Snacks & Biscuits';
  if (/sugar|salt|honey|yeast/.test(lower)) return 'Baking & Sweeteners';
  if (/bean|lentil|cereal|spaghetti/.test(lower)) return 'Cereals & Legumes';
  return 'General';
}

// Parse Sam West pricelist
function parseSamWest(filePath: string): ParsedProduct[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const products: ParsedProduct[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length < 20) continue;
    if (/^(Date|Time|Continue|Page|#Description)/i.test(line)) continue;
    
    const match = line.match(/^(\d+)(.+?)(KES\s*[\d,]+\.?\d*)\s*(.+)$/);
    if (!match) continue;
    
    const [, lineNum, description, price, unit] = match;
    const productName = description.trim();
    
    const brandMatch = productName.match(/^([A-Z][A-Z\s]+?)(?:\s+\d|$)/);
    const brandName = brandMatch ? brandMatch[1].trim() : productName.split(' ')[0];
    
    const sizeMatch = productName.match(/(\d+(?:\.\d+)?(?:KG|L|ML|GM|G|PCS|PC|X\d+))/i);
    const packSize = sizeMatch ? sizeMatch[1] : 'N/A';
    
    products.push({
      distributorId: 'sam-west',
      distributorName: 'Sam West Supermarket',
      lineNumber: parseInt(lineNum),
      productName,
      brandName,
      category: categorizeProduct(productName),
      packSize,
      packUnit: unit.trim(),
      price: parseFloat(price.replace(/KES|,/g, '').trim())
    });
  }
  
  return products;
}

// Generate image with FAL.ai and Google references
async function generateImage(product: ParsedProduct): Promise<{ url: string; references: string[] } | null> {
  try {
    // Build search query
    const searchQuery = `${product.brandName} ${product.productName} product packaging ${product.category}`.trim();
    console.log(`   🔍 Searching: "${searchQuery}"`);
    
    // Get reference images from Google (SMART search)
    const referenceUrls = await googleRefImages(searchQuery, 8);
    console.log(`   📸 Found ${referenceUrls.length} reference URLs`);
    
    // Convert to data URLs for FAL.ai with retry logic
    const referenceDataUrls: string[] = [];
    const referenceSourceUrls: string[] = [];
    
    for (const url of referenceUrls) {
      const result = await fetchImageAsDataUrl(url, 3);
      if (result) {
        referenceDataUrls.push(result.dataUrl);
        referenceSourceUrls.push(url);
        console.log(`   ✅ Loaded reference ${referenceDataUrls.length} (${result.sizeKB}KB)`);
        
        // Stop after 4 good references
        if (referenceDataUrls.length >= 4) break;
      }
    }
    
    if (referenceDataUrls.length === 0) {
      console.log(`   ⚠️ No references loaded, trying brand-only search...`);
      const brandRefs = await googleRefImages(`${product.brandName} product`, 8);
      for (const url of brandRefs) {
        const result = await fetchImageAsDataUrl(url, 3);
        if (result) {
          referenceDataUrls.push(result.dataUrl);
          referenceSourceUrls.push(url);
          console.log(`   ✅ Loaded reference ${referenceDataUrls.length} (retry, ${result.sizeKB}KB)`);
          if (referenceDataUrls.length >= 4) break;
        }
      }
    }
    
    console.log(`   🎯 Using ${referenceDataUrls.length} reference images`);
    
    // Build prompt
    const title = `${product.brandName} ${product.productName}`.trim();
    const prompt = `Professional studio product photography, single centered product on floating glass shelf, 
      uniform slate gray background (#1f2937), tight crop with product filling 75% of frame, 
      sharp focus with gentle depth of field, cool teal-accent lighting, high detail, 
      rich color saturation, subtle film grain, no text or props, modern e-commerce style, 
      clean and minimalist aesthetic. Product: ${title}. Category: ${product.category}. 
      Maintain consistent slate gray backdrop with subtle glass reflection.`;
    
    console.log(`   🎨 Generating with FAL.ai...`);
    
    // Generate with FAL.ai
    const input: any = {
      prompt,
      image_size: 'square_hd',
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
      output_format: 'jpeg',
      guidance_scale: 3.5
    };
    
    // Add reference images if available
    if (referenceDataUrls.length > 0) {
      input.image_url = referenceDataUrls[0]; // Primary reference
      input.strength = 0.6; // How much to follow reference (0-1)
    }
    
    const result: any = await fal.subscribe('fal-ai/flux/schnell', { input });
    
    if (!result.images || result.images.length === 0) {
      throw new Error('No images in response');
    }
    
    return {
      url: result.images[0].url,
      references: referenceSourceUrls // Return actual loaded URLs
    };
  } catch (error: any) {
    console.error(`   ❌ Generation error: ${error.message}`);
    return null;
  }
}

// Upload to Firebase Storage
async function uploadToStorage(
  imageUrl: string,
  product: ParsedProduct
): Promise<string> {
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  
  const sanitizedName = product.productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 50);
  const hash = Math.random().toString(36).substring(2, 8);
  const fileName = `${sanitizedName}-${hash}.jpg`;
  const storagePath = `distributor-images/sam-west/${product.category.toLowerCase().replace(/\s+/g, '-')}/${fileName}`;
  
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  await file.save(Buffer.from(buffer), {
    contentType: 'image/jpeg',
    metadata: { cacheControl: 'public, max-age=31536000' }
  });
  await file.makePublic();
  
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

// Generate embedding
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return response.data[0].embedding;
  } catch (error: any) {
    console.error('   ⚠️ Embedding error:', error.message);
    return [];
  }
}

// Main
async function main() {
  const dataDir = path.join(process.cwd(), 'data');
  const samWestPath = path.join(dataDir, 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt');
  
  if (!fs.existsSync(samWestPath)) {
    console.error('❌ Sam West pricelist not found');
    process.exit(1);
  }
  
  console.log('📦 Parsing Sam West pricelist...\n');
  const allProducts = parseSamWest(samWestPath);
  console.log(`✅ Parsed ${allProducts.length} total products\n`);
  
  const batchProducts = allProducts.slice(startIndex, endIndex);
  console.log(`🎯 Processing batch ${batchNumber}: ${batchProducts.length} products\n`);
  
  if (batchProducts.length === 0) {
    console.log('⚠️ No products in this batch range');
    return;
  }
  
  const cost = (batchProducts.length * 0.003).toFixed(2);
  console.log(`💰 Estimated cost: $${cost}\n`);
  console.log('═'.repeat(60));
  console.log('');
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < batchProducts.length; i++) {
    const product = batchProducts[i];
    const globalIndex = startIndex + i + 1;
    const progress = `[${globalIndex}/${allProducts.length}]`;
    
    console.log(`${progress} ${product.productName}`);
    
    try {
      // Generate image
      const imageResult = await generateImage(product);
      if (!imageResult) {
        failCount++;
        continue;
      }
      
      // Upload to storage
      console.log(`   📤 Uploading to Firebase...`);
      const storageUrl = await uploadToStorage(imageResult.url, product);
      
      // Generate embedding
      console.log(`   🧠 Generating embedding...`);
      const embeddingText = `${product.brandName} ${product.productName} ${product.category}`;
      const embedding = await generateEmbedding(embeddingText);
      
      // Store in Firestore
      console.log(`   💾 Saving metadata...`);
      await db.collection('distributor_images').add({
        distributorId: product.distributorId,
        distributorName: product.distributorName,
        productName: product.productName,
        brandName: product.brandName,
        category: product.category,
        packSize: product.packSize,
        packUnit: product.packUnit,
        price: product.price,
        imageUrl: storageUrl,
        storagePath: storageUrl.split('/').slice(-4).join('/'),
        referenceImages: imageResult.references,
        nameEmbedding: embedding,
        semanticTags: [
          product.brandName.toLowerCase(),
          product.category.toLowerCase(),
          product.packSize.toLowerCase()
        ],
        generatedAt: new Date().toISOString(),
        generationModel: 'fal-ai/flux/schnell',
        batchNumber,
        timesReused: 0,
        reusedByRetailers: [],
        verified: false,
        searchIndex: {
          brand_lower: product.brandName.toLowerCase(),
          product_lower: product.productName.toLowerCase(),
          category_lower: product.category.toLowerCase(),
          packSize_normalized: product.packSize.toLowerCase()
        }
      });
      
      console.log(`   ✅ Success\n`);
      successCount++;
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}\n`);
      failCount++;
    }
  }
  
  console.log('═'.repeat(60));
  console.log(`🎉 Batch ${batchNumber} Complete!`);
  console.log('═'.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Success rate: ${((successCount / batchProducts.length) * 100).toFixed(1)}%`);
  console.log(`💰 Actual cost: $${(successCount * 0.003).toFixed(2)}`);
  console.log('═'.repeat(60));
  console.log('');
  
  if (endIndex < allProducts.length) {
    console.log(`📝 Next batch: npx tsx scripts/generate-sam-west-batch.ts ${batchNumber + 1}`);
  } else {
    console.log(`🎊 All batches complete!`);
  }
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
