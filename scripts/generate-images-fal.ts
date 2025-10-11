/**
 * Generate Distributor Image Library with FAL.ai
 * 
 * This is the NEW implementation using FAL.ai FLUX schnell (90% cost reduction)
 * Replaces the old Replicate implementation
 * 
 * Total cost: ~$21 for 7,000 images (vs $210 with Replicate)
 * 
 * Usage: npx tsx scripts/generate-images-fal.ts [options]
 * 
 * Options:
 *   --distributor <name>   Only process specific distributor (sam-west | mahitaji)
 *   --limit <number>       Limit number of products to process (for testing)
 *   --dry-run             Parse products but don't generate images
 *   --skip-embeddings     Skip OpenAI embedding generation
 * 
 * Example:
 *   npx tsx scripts/generate-images-fal.ts --limit 10 --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import OpenAI from 'openai';
import * as fal from '@fal-ai/serverless-client';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  distributor: args.includes('--distributor') ? args[args.indexOf('--distributor') + 1] : null,
  limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null,
  dryRun: args.includes('--dry-run'),
  skipEmbeddings: args.includes('--skip-embeddings')
};

console.log('🚀 FAL.ai Distributor Image Generator');
console.log('Options:', options, '\n');

// Initialize Firebase Admin
try {
  const serviceAccount = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'serviceAccountKey.json'), 'utf-8')
  );
  
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'vendai-fa58c.appspot.com'
  });
} catch (error: any) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  process.exit(1);
}

const db = getFirestore();
const storage = getStorage();

// Configure FAL.ai
fal.config({ credentials: process.env.FAL_API_KEY });

// Configure OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Smart Google Image Search with e-commerce priority
async function googleRefImages(query: string, topN = 8): Promise<string[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX || process.env.NEXT_PUBLIC_CX;
  
  if (!apiKey || !cx) return [];
  
  try {
    // Try e-commerce sites first
    const ecommerceSites = ['jumia.co.ke', 'kilimall.co.ke', 'amazon.com', 'ebay.com'];
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
    
    const res = await fetch(url);
    let items: any[] = [];
    
    if (res.ok) {
      const json = await res.json();
      items = Array.isArray(json.items) ? json.items : [];
    }
    
    // Fallback to general if no e-commerce results
    if (items.length === 0) {
      const generalUrl = new URL('https://www.googleapis.com/customsearch/v1');
      generalUrl.searchParams.set('key', apiKey);
      generalUrl.searchParams.set('cx', cx);
      generalUrl.searchParams.set('searchType', 'image');
      generalUrl.searchParams.set('q', query);
      generalUrl.searchParams.set('num', String(Math.min(topN, 10)));
      generalUrl.searchParams.set('safe', 'active');
      generalUrl.searchParams.set('imgSize', 'large');
      
      const generalRes = await fetch(generalUrl);
      if (generalRes.ok) {
        const generalJson = await generalRes.json();
        items = Array.isArray(generalJson.items) ? generalJson.items : [];
      }
    }
    
    // Score and filter
    type Scored = { link: string; score: number }
    const scored: Scored[] = items.map((i: any) => {
      let score = 70;
      const urlLower = (i.link || '').toLowerCase();
      if (urlLower.includes('tiktok')) score -= 30;
      if (urlLower.includes('x-raw-image')) score -= 30;
      return { link: i.link as string, score };
    }).filter((x: Scored) => Boolean(x.link) && x.score > 40);
    
    return scored.sort((a, b) => b.score - a.score).map(x => x.link);
  } catch (error) {
    return [];
  }
}

// Fetch image as data URL
async function fetchImageAsDataUrl(url: string, retries = 3): Promise<string | null> {
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
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        return null;
      }
      
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) return null;
      
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength < 5000) return null; // Skip tiny images
      
      const base64 = Buffer.from(buffer).toString('base64');
      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  return null;
}

interface ParsedProduct {
  distributorId: string;
  distributorName: string;
  lineNumber: number;
  rawText: string;
  productName: string;
  brandName: string;
  category: string;
  packSize: string;
  packUnit: string;
  price?: number;
}

// Categorization helper
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

// Parser functions
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
    
    const category = categorizeProduct(productName);
    
    products.push({
      distributorId: 'sam-west',
      distributorName: 'Sam West Supermarket',
      lineNumber: parseInt(lineNum),
      rawText: line,
      productName,
      brandName,
      category,
      packSize,
      packUnit: unit.trim(),
      price: parseFloat(price.replace(/KES|,/g, '').trim())
    });
  }
  
  console.log(`✅ Parsed ${products.length} products from Sam West`);
  return products;
}

function parseMahitaji(filePath: string): ParsedProduct[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const products: ParsedProduct[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.length < 20) continue;
    if (/^(MAHITAJI|Price List|Code|Item|Unit|AsOnDate)/i.test(line)) continue;
    
    const match = line.match(/^([A-Z0-9]+)\s+(.+?)\s+(CTN|PC|BALE|BAG|PKT|BUNDL|JAR|OUTR|DOZ)\s+([\d,]+\.?\d*)$/);
    if (!match) continue;
    
    const [, code, description, unit, price] = match;
    const productName = description.trim();
    
    const brandMatch = productName.match(/^([A-Z][A-Z\s]+?)(?:\s+\d|$)/);
    const brandName = brandMatch ? brandMatch[1].trim() : productName.split(' ')[0];
    
    const sizeMatch = productName.match(/(\d+(?:X\d+)?(?:KG|L|ML|GM|G|X)?)/i);
    const packSize = sizeMatch ? sizeMatch[1] : 'N/A';
    
    const category = categorizeProduct(productName);
    
    products.push({
      distributorId: 'mahitaji',
      distributorName: 'Mahitaji Enterprises',
      lineNumber: i,
      rawText: line,
      productName,
      brandName,
      category,
      packSize,
      packUnit: unit,
      price: parseFloat(price.replace(/,/g, ''))
    });
  }
  
  console.log(`✅ Parsed ${products.length} products from Mahitaji`);
  return products;
}

// Main logic
async function main() {
  console.log('📦 Parsing distributor pricelists...\n');
  
  const dataDir = path.join(process.cwd(), 'data');
  let allProducts: ParsedProduct[] = [];
  
  if (!options.distributor || options.distributor === 'sam-west') {
    const samWestPath = path.join(dataDir, 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt');
    if (fs.existsSync(samWestPath)) {
      allProducts.push(...parseSamWest(samWestPath));
    } else {
      console.warn(`⚠️ Sam West pricelist not found at ${samWestPath}`);
    }
  }
  
  if (!options.distributor || options.distributor === 'mahitaji') {
    const mahitajiPath = path.join(dataDir, 'mahitaji pricelist_extracted_text.txt');
    if (fs.existsSync(mahitajiPath)) {
      allProducts.push(...parseMahitaji(mahitajiPath));
    } else {
      console.warn(`⚠️ Mahitaji pricelist not found at ${mahitajiPath}`);
    }
  }
  
  if (options.limit) {
    allProducts = allProducts.slice(0, options.limit);
    console.log(`\n⚠️ Limited to ${options.limit} products for testing\n`);
  }
  
  console.log(`\n📊 Total products to process: ${allProducts.length}\n`);
  
  // Cost estimate
  const falCost = (allProducts.length * 0.003).toFixed(2);
  const replicateCost = (allProducts.length * 0.03).toFixed(2);
  const savings = (parseFloat(replicateCost) - parseFloat(falCost)).toFixed(2);
  
  console.log('💰 Cost Estimate:');
  console.log(`   FAL.ai FLUX schnell: $${falCost}`);
  console.log(`   vs Replicate FLUX:   $${replicateCost}`);
  console.log(`   Savings:             $${savings} (90%)\n`);
  
  if (options.dryRun) {
    console.log('🏁 Dry run complete - no images generated\n');
    const outputPath = path.join(dataDir, 'parsed-distributor-products.json');
    fs.writeFileSync(outputPath, JSON.stringify(allProducts, null, 2));
    console.log(`✅ Parsed products saved to: ${outputPath}`);
    return;
  }
  
  console.log('🎨 Starting image generation...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < allProducts.length; i++) {
    const product = allProducts[i];
    const progress = `[${i + 1}/${allProducts.length}]`;
    
    console.log(`${progress} ${product.productName}`);
    
    try {
      // Generate prompt
      const title = `${product.brandName} ${product.productName}`.trim();
      const prompt = `Professional studio product photography, single centered product on floating glass shelf, 
        uniform slate gray background (#1f2937), tight crop with product filling 75% of frame, 
        sharp focus with gentle depth of field, cool teal-accent lighting, high detail, 
        rich color saturation, subtle film grain, no text or props, modern e-commerce style.
        Product: ${title}. Category: ${product.category}. Maintain consistent slate gray backdrop.`;
      
      // Get reference images (SMART search)
      console.log(`   🔍 Finding reference images...`);
      const refUrls = await googleRefImages(`${title} product image`, 4);
      let referenceDataUrl: string | undefined;
      
      if (refUrls.length > 0) {
        for (const url of refUrls) {
          const dataUrl = await fetchImageAsDataUrl(url, 2);
          if (dataUrl) {
            referenceDataUrl = dataUrl;
            console.log(`   ✅ Loaded reference image`);
            break;
          }
        }
      }
      
      // Build FAL.ai input
      const input: any = {
        prompt,
        image_size: 'square_hd',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'jpeg'
      };
      
      if (referenceDataUrl) {
        input.image_url = referenceDataUrl;
        input.strength = 0.6;
        console.log(`   🖼️ Using reference image`);
      }
      
      // Call FAL.ai
      const result: any = await fal.subscribe('fal-ai/flux/schnell', { input });
      
      if (!result.images?.[0]?.url) {
        throw new Error('No image URL in response');
      }
      
      const imageUrl = result.images[0].url;
      
      // Download and upload to Firebase Storage
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      
      const sanitizedName = product.productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 50);
      const hash = Math.random().toString(36).substring(2, 8);
      const fileName = `${sanitizedName}-${hash}.jpg`;
      const storagePath = `distributor-images/${product.distributorId}/${product.category.toLowerCase().replace(/\s+/g, '-')}/${fileName}`;
      
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);
      await file.save(Buffer.from(buffer), {
        contentType: 'image/jpeg',
        metadata: { cacheControl: 'public, max-age=31536000' }
      });
      await file.makePublic();
      
      const storageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      
      // Generate embedding
      let embedding: number[] = [];
      if (!options.skipEmbeddings && process.env.OPENAI_API_KEY) {
        const embeddingText = `${product.brandName} ${product.productName} ${product.category}`;
        const embResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: embeddingText
        });
        embedding = embResponse.data[0].embedding;
      }
      
      // Store metadata
      await db.collection('distributor_images').add({
        distributorId: product.distributorId,
        distributorName: product.distributorName,
        productName: product.productName,
        brandName: product.brandName,
        category: product.category,
        packSize: product.packSize,
        packUnit: product.packUnit,
        imageUrl: storageUrl,
        storagePath,
        nameEmbedding: embedding,
        semanticTags: [
          product.brandName.toLowerCase(),
          product.category.toLowerCase(),
          product.packSize.toLowerCase()
        ],
        generatedAt: new Date().toISOString(),
        generationModel: 'fal-ai/flux/schnell',
        revisedPrompt: prompt,
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
      
      console.log(`   ✅ Success`);
      successCount++;
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      failCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Batch Processing Complete!');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Success rate: ${((successCount / allProducts.length) * 100).toFixed(1)}%`);
  console.log(`💰 Total cost: $${(successCount * 0.003).toFixed(2)}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
