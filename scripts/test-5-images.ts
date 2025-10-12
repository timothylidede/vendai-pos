/**
 * Test FAL.ai Image Generation with Google References
 * Tests with first 5 products from Sam West to validate quality
 * 
 * Usage: npx tsx scripts/test-5-images.ts
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

console.log('🧪 Testing FAL.ai with 5 Sam West Products\n');

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
  adminApp = getApps().find(app => app.name === 'test-app') || 
    initializeApp(adminConfig, 'test-app');
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
  unit?: string;
  description?: string;
}

function buildProductPrompt(product: Product): string {
  const base = `Studio product photo, single centered product captured with a tight crop (product fills ~75% of frame) on a floating glass shelf, uniform slate background (#1f2937) matching the Vendai dashboard, crisp focus across the product with gentle depth falloff, cool teal-accent studio lighting, high detail, rich color, subtle grain, no text, props, hands, or accessories, background color must remain constant, consistent shadow and lighting, modern, e-commerce ready.`;

  const details = [
    product.brandName && `Brand: ${product.brandName}`,
    product.productName && `Product name: ${product.productName}`,
    product.description && `Description: ${product.description}`,
    product.category && `Category: ${product.category}`,
    product.packSize && `Pack size: ${product.packSize}`,
    product.unit && `Unit: ${product.unit}`,
    product.price && `Distributor price: KES ${product.price}`
  ].filter(Boolean).join('. ');

  return details ? `${base} Product details: ${details}. Maintain an unbroken slate backdrop (#1f2937) with subtle glass reflection; no alternative backgrounds.` : `${base} Maintain an unbroken slate backdrop (#1f2937) with subtle glass reflection; no alternative backgrounds.`;
}

// Google Image Search (same as inventory module)
async function googleRefImages(query: string, topN = 5): Promise<string[]> {
  console.log('   🔍 Searching Google:', query);
  
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX || process.env.NEXT_PUBLIC_CX;

  if (!apiKey || !cx) {
    console.log('   ⚠️ Missing Google CSE credentials');
    return [];
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', query);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', String(Math.min(topN, 10)));
    url.searchParams.set('safe', 'active');
    url.searchParams.set('imgSize', 'large');
    url.searchParams.set('imgType', 'photo');

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.log('   ⚠️ Google API error:', response.status);
      return [];
    }

    const data = await response.json();
    const items = data.items || [];
    
    const imageUrls = items
      .slice(0, topN)
      .map((i: any) => i.link)
      .filter(Boolean);
    
    console.log(`   ✅ Found ${imageUrls.length} reference images`);
    return imageUrls;
  } catch (error: any) {
    console.log('   ⚠️ Search error:', error.message);
    return [];
  }
}

// Fetch image as data URL with retries and better error handling
async function fetchImageAsDataUrl(url: string, retries = 3): Promise<{ dataUrl: string; originalUrl: string } | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`   📥 Fetching reference image (attempt ${attempt}/${retries})...`);
      
      const response = await fetch(url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.google.com/',
        },
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        console.log(`   ⚠️ Download failed (attempt ${attempt}/${retries}): ${response.status} - ${url.substring(0, 80)}...`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return null;
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        console.log(`   ⚠️ Not an image: ${contentType}`);
        return null;
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      
      console.log(`   ✅ Successfully fetched reference image`);
      return {
        dataUrl: `data:${contentType};base64,${base64}`,
        originalUrl: url
      };
    } catch (error: any) {
      console.log(`   ⚠️ Fetch error (attempt ${attempt}/${retries}): ${error.message}`);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  console.log(`   ❌ Failed to fetch after ${retries} attempts: ${url.substring(0, 80)}...`);
  return null;
}

// Categorize products
function categorizeProduct(productName: string): string {
  const lower = productName.toLowerCase();
  if (/rice|basmati|biryani/.test(lower)) return 'Rice';
  if (/flour|atta|baking/.test(lower)) return 'Flour & Grains';
  if (/oil|fat|cooking/.test(lower)) return 'Cooking Oils & Fats';
  if (/milk|yoghurt/.test(lower)) return 'Dairy Products';
  if (/juice|drink|water/.test(lower)) return 'Beverages';
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
      price: parseFloat(price.replace(/KES|,/g, '').trim()),
      unit: packSize,
      description: productName
    });
  }
  
  return products;
}

// Generate image with FAL.ai (following inventory module pattern)
async function generateImage(product: Product): Promise<{ url: string; references: string[] } | null> {
  try {
    // Get reference images with retry logic
    console.log('   🔍 Searching for reference images...');
      const searchTerms = [
        product.brandName,
        product.productName,
        product.packSize,
        product.unit,
        product.category
      ].filter(Boolean).join(' ');
      const referenceUrls = await googleRefImages(`${searchTerms} product image`, 8);
    
    let referenceImageInputs: string[] = [];
    let referenceImageSources: string[] = [];
    
    if (referenceUrls.length) {
      console.log(`   ✅ Found ${referenceUrls.length} reference URLs`);
      console.log('   📥 Downloading reference images with retries...');
      const fetchedRefs: { source: string; dataUrl?: string }[] = [];
      
      // Try to fetch at least 3-4 reference images
      for (const url of referenceUrls) {
        const data = await fetchImageAsDataUrl(url, 3);
        if (data?.dataUrl) {
          fetchedRefs.push({ source: data.originalUrl, dataUrl: data.dataUrl });
          console.log(`   ✅ Loaded reference ${fetchedRefs.length}/${referenceUrls.length}`);
          
          // Stop once we have 4 good references
          if (fetchedRefs.length >= 4) {
            break;
          }
        }
      }
      
      // If no references loaded, retry with simpler query
      if (fetchedRefs.length === 0) {
        console.log('   ⚠️ No references loaded! Retrying with brand name...');
        const simpleRefs = await googleRefImages(`${product.brandName} product`, 8);
        for (const url of simpleRefs) {
          const data = await fetchImageAsDataUrl(url, 3);
          if (data?.dataUrl) {
            fetchedRefs.push({ source: data.originalUrl, dataUrl: data.dataUrl });
            console.log(`   ✅ Loaded reference ${fetchedRefs.length} (retry)`);
            if (fetchedRefs.length >= 4) break;
          }
        }
      }
      
      referenceImageInputs = fetchedRefs.map(item => item.dataUrl ?? item.source);
      referenceImageSources = fetchedRefs.map(item => item.source);
      
      if (referenceImageSources.length === 0) {
        console.log('   ❌ CRITICAL: Failed to load ANY reference images!');
      } else {
        console.log(`   ✅ Successfully loaded ${referenceImageSources.length} reference images`);
      }
    } else {
      console.log('   ⚠️ No reference URLs found from Google');
    }
    
    // Build prompt (same style as inventory module)
    const enhancedPrompt = buildProductPrompt(product);
    
    console.log('   🎨 Generating with FAL.ai...');
    
    // FAL.ai input
    const input: any = {
      prompt: enhancedPrompt,
      image_size: 'square_hd', // 1024x1024
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
      output_format: 'jpeg',
      guidance_scale: 3.5
    };
    
    // Add first reference image if available (like nano-banana image_input)
    if (referenceImageInputs.length > 0) {
      input.image_url = referenceImageInputs[0];
      input.strength = 0.6; // Similar to Replicate's reference strength
      console.log('   🖼️ Using reference image for guidance');
    }
    
    const result: any = await fal.subscribe('fal-ai/flux/schnell', { input });
    
    if (!result.images || result.images.length === 0) {
      throw new Error('No images in response');
    }
    
    console.log('   ✅ Image generated successfully');
    
    return {
      url: result.images[0].url,
      references: referenceImageSources
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
  const fileName = `${sanitizedName}-${hash}.jpg`;
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
  console.log('═'.repeat(70));
  console.log('');
  
  let successCount = 0;
  const results: any[] = [];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n[${i + 1}/5] ${product.productName}`);
    console.log('─'.repeat(70));
    
    try {
      // Generate image with references
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
        generatedAt: new Date().toISOString(),
        generationModel: 'fal-ai/flux/schnell',
        timesReused: 0,
        reusedByRetailers: [],
        verified: false,
        testBatch: true,
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
        references: imageResult.references.length
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
  console.log('🎉 Test Complete!');
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
      console.log(`   🔍 References used: ${r.references}`);
      console.log(`   🆔 Firestore ID: ${r.firestoreId}`);
    } else {
      console.log(`${i + 1}. ❌ ${r.product}`);
      console.log(`   Error: ${r.error}`);
    }
    console.log('');
  });
  
  console.log('═'.repeat(70));
  console.log('📝 Next Steps:');
  console.log('   1. Check Firebase Storage: https://console.firebase.google.com/project/vendai-fa58c/storage');
  console.log('   2. Check Firestore: https://console.firebase.google.com/project/vendai-fa58c/firestore');
  console.log('   3. Review image quality');
  console.log('   4. If satisfied, run full batch: npx tsx scripts/generate-sam-west-batch.ts 1');
  console.log('═'.repeat(70));
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
