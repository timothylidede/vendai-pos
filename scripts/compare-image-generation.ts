/**
 * Generate images for first 10 Sam West products using Replicate
 * Compare with existing FAL.ai generated images
 * Replace links in sam-west-products.ts with new Replicate-generated images
 */

import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Load environment
config({ path: path.join(process.cwd(), '.env.local') });

// Check API keys
if (!process.env.REPLICATE_API_TOKEN) {
  console.error('❌ Missing REPLICATE_API_TOKEN in environment');
  process.exit(1);
}

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

// Initialize Firebase
try {
  const adminConfig: any = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vendai-fa58c',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vendai-fa58c.firebasestorage.app',
  };

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    adminConfig.credential = cert(serviceAccount);
  }

  initializeApp(adminConfig);
  console.log('✅ Firebase initialized');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  process.exit(1);
}

const db = getFirestore();
const storage = getStorage();

// Configuration
const MODEL = process.env.REPLICATE_MODEL_ID || 'google/nano-banana'; // Same model as inventory module
const PRODUCTS_TO_GENERATE = 10;
const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_CSE_API_KEY;
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX || process.env.NEXT_PUBLIC_GOOGLE_CSE_CX;

interface Product {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  unit: string;
  price?: number;
  wholesalePrice?: number;
  distributorName: string;
  image?: string;
}

interface ComparisonResult {
  productName: string;
  oldImage: string;
  newImage: string;
  oldProvider: string;
  newProvider: string;
  generationTime: number;
}

// Google Custom Search for reference images
async function searchReferenceImages(query: string): Promise<string[]> {
  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_CX) {
    console.warn('⚠️  Google CSE not configured, using text-only generation');
    return [];
  }

  try {
    const params = new URLSearchParams({
      key: GOOGLE_CSE_API_KEY,
      cx: GOOGLE_CSE_CX,
      q: query,
      searchType: 'image',
      num: '5',
      safe: 'active',
    });

    const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn('⚠️  Google CSE failed:', res.status);
      return [];
    }

    const json = await res.json();
    const items = json.items || [];
    return items.map((item: any) => item.link).filter(Boolean).slice(0, 3);
  } catch (error) {
    console.warn('⚠️  Google CSE error:', error);
    return [];
  }
}

// Build prompt for product image
function buildPrompt(product: Product): string {
  // Build prompt for product image
  const details = [
    `Product name: ${product.name}`,
    product.brand && `Brand: ${product.brand}`,
    product.description && `Description: ${product.description}`,
    product.category && `Category: ${product.category}`,
    product.unit && `Packaging: ${product.unit}`,
    typeof product.price === 'number' && `Distributor price: KES ${product.price}`
  ].filter(Boolean).join('. ');

  return `Professional product photography on a neutral seamless background. Single centered product, commercial studio lighting, accurate colors, 4K resolution, sharp focus with legible label text, realistic packaging proportions, no props, no hands. ${details}. Maintain consistent background and perspective for catalog presentation.`;
}

function resolveImageUrl(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = resolveImageUrl(entry);
      if (resolved) return resolved;
    }
    return undefined;
  }
  if (typeof value === 'object') {
    const candidateKeys = [
      'url',
      'image',
      'image_url',
      'output',
      'uri',
      'href',
      'signed_url',
      'asset_url',
      'result',
      'value'
    ];

    for (const key of candidateKeys) {
      if (key in value) {
        const resolved = resolveImageUrl((value as any)[key]);
        if (resolved) return resolved;
      }
    }

    for (const entry of Object.values(value)) {
      if (entry === value) continue;
      const resolved = resolveImageUrl(entry);
      if (resolved) return resolved;
    }
  }
  return undefined;
}

// Run a Replicate prediction with polling and robust URL extraction
async function runReplicatePrediction(input: Record<string, unknown>): Promise<string> {
  type ReplicatePredictionStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  interface ReplicatePrediction {
    id: string;
    status: ReplicatePredictionStatus;
    output?: unknown;
    error?: string | null;
  }

  console.log('     🎨 Calling Replicate model...', { model: MODEL, hasRefs: !!input['image_input'] });
  const prediction = (await (replicate as any).predictions.create({
    model: MODEL,
    input,
    stream: false
  })) as ReplicatePrediction;

  console.log('     ⏳ Prediction queued', { id: prediction.id, status: prediction.status });

  const terminal: ReplicatePredictionStatus[] = ['succeeded', 'failed', 'canceled'];
  let current: ReplicatePrediction = prediction;
  const started = Date.now();
  const MAX_WAIT_MS = 120_000;
  const POLL_INTERVAL_MS = 2_000;

  while (!terminal.includes(current.status)) {
    if (Date.now() - started > MAX_WAIT_MS) throw new Error('Replicate prediction timed out');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    current = (await (replicate as any).predictions.get(current.id)) as ReplicatePrediction;
    console.log('     ⏳ Status update', { status: current.status });
  }

  if (current.status !== 'succeeded') {
    const msg = current.error || `Prediction ${current.status}`;
    throw new Error(msg);
  }

  const out = (current as any).output;
  let imageUrl: string | undefined;
  if (Array.isArray(out)) {
    imageUrl = out.find((v) => typeof v === 'string' && v.startsWith('http')) as string | undefined;
    if (!imageUrl && out.length) imageUrl = resolveImageUrl(out[out.length - 1]);
  } else if (typeof out === 'string') {
    imageUrl = out;
  } else {
    imageUrl = resolveImageUrl(out);
  }

  if (!imageUrl || typeof imageUrl !== 'string') {
    console.error('     ❌ Unable to extract image URL from prediction output:', out);
    throw new Error('Failed to get image URL from Replicate prediction');
  }
  return imageUrl;
}

// Generate image using Replicate predictions API (mirrors inventory module)
async function generateWithReplicate(product: Product): Promise<{ url: string; time: number }> {
  console.log(`\n  🎨 Generating with Replicate...`);
  const startTime = Date.now();

  // Search for reference images
  const searchTerms = [product.brand, product.name, product.unit, product.category, product.description]
    .filter(Boolean)
    .join(' ');
  const searchQuery = `${searchTerms} product photo`;
  console.log(`     Searching: "${searchQuery}"`);
  const refImages = await searchReferenceImages(searchQuery);
  console.log(`     Found ${refImages.length} reference images`);

  // Build prompt
  const prompt = buildPrompt(product);
  console.log(`     Prompt: ${prompt.substring(0, 80)}...`);

  try {
    const input: Record<string, unknown> = { prompt, output_quality: 'high' };
    if (refImages.length) input['image_input'] = refImages.slice(0, 4);

    console.log(`     Calling Replicate predictions API with model: ${MODEL}...`);
    let imageUrl: string;
    try {
      imageUrl = await runReplicatePrediction(input);
    } catch (e: any) {
      const msg = e?.message || String(e);
      const invalid = /invalid|schema|input/i.test(msg);
      if (input['image_input'] && invalid) {
        console.warn('     ⚠️ Refs rejected, retrying without them...', { msg });
        const retry = { ...input } as Record<string, unknown>;
        delete retry['image_input'];
        imageUrl = await runReplicatePrediction(retry);
      } else {
        throw e;
      }
    }

    const time = Date.now() - startTime;
    console.log(`     ✅ Generated in ${(time / 1000).toFixed(1)}s`);
    console.log(`     URL: ${imageUrl.substring(0, 60)}...`);
    return { url: imageUrl, time };
  } catch (error) {
    console.error(`     ❌ Replicate failed:`, error);
    throw error;
  }
}

// Upload image to Firebase Storage
async function uploadToFirebase(imageUrl: string, product: Product): Promise<string> {
  console.log(`  📤 Uploading to Firebase...`);

  try {
    // Download image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Generate filename
    const category = product.category || 'general';
    const fileName = `${product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-replicate.jpg`;
    const filePath = `distributor-images/sam-west/${category}/${fileName}`;

    // Upload to Firebase Storage
    const bucket = storage.bucket();
    const file = bucket.file(filePath);

    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          productId: product.id.toString(),
          productName: product.name,
          distributorId: 'sam-west',
          generator: 'replicate-flux-schnell',
          generatedAt: new Date().toISOString()
        }
      }
    });

    // Make file publicly accessible
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    console.log(`     ✅ Uploaded to Firebase`);
    console.log(`     URL: ${publicUrl.substring(0, 60)}...`);

    return publicUrl;
  } catch (error) {
    console.error(`     ❌ Upload failed:`, error);
    throw error;
  }
}

// Update Firestore with new image
async function updateFirestore(product: Product, imageUrl: string) {
  console.log(`  💾 Updating Firestore...`);

  try {
    const docRef = db.collection('distributor_images').doc();
    await docRef.set({
      distributorId: 'sam-west',
      productCode: product.code,
      imageUrl: imageUrl,
  generator: 'replicate-nano-banana',
      category: product.category,
      createdAt: new Date(),
      metadata: {
        brand: product.brand,
        productId: product.id,
        description: product.description,
        unit: product.unit,
        category: product.category
      }
    });

    console.log(`     ✅ Firestore updated`);
  } catch (error) {
    console.error(`     ❌ Firestore update failed:`, error);
  }
}

// Read first 10 products from sam-west-products.ts
function getFirst10Products(): Product[] {
  console.log('\n📦 Loading Sam West products...');
  
  const filePath = path.join(process.cwd(), 'data', 'distributors', 'sam-west-products.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract the products array
  const match = content.match(/export const sam_west_products[^=]*=\s*(\[[\s\S]*?\n\];)/);
  if (!match) {
    throw new Error('Could not parse sam-west-products.ts');
  }
  
  // Parse JSON (remove trailing semicolon and parse)
  const jsonStr = match[1].replace(/;$/, '');
  const allProducts = JSON.parse(jsonStr);
  
  console.log(`✅ Found ${allProducts.length} total products`);
  console.log(`🎯 Selecting first ${PRODUCTS_TO_GENERATE} products\n`);

  const typed: Product[] = allProducts.map((p: any) => ({
    id: p.id,
    code: String(p.code ?? ''),
    name: p.name,
    description: p.description ?? p.name,
    category: p.category ?? 'general',
    brand: p.brand ?? 'Generic',
    unit: p.unit ?? '',
    price: typeof p.price === 'number' ? p.price : undefined,
    wholesalePrice: typeof p.wholesalePrice === 'number' ? p.wholesalePrice : undefined,
    distributorName: p.distributorName ?? 'Sam West',
    image: p.image
  }));
  
  return typed.slice(0, PRODUCTS_TO_GENERATE);
}

// Update sam-west-products.ts with new image URLs
function updateProductFile(products: Product[], newImageUrls: Map<number, string>) {
  console.log('\n📝 Updating sam-west-products.ts...');
  
  const filePath = path.join(process.cwd(), 'data', 'distributors', 'sam-west-products.ts');
  let content = fs.readFileSync(filePath, 'utf8');
  
  let updateCount = 0;
  for (const product of products) {
    const newUrl = newImageUrls.get(product.id);
    if (newUrl && product.image) {
      // Replace old image URL with new one
      content = content.replace(product.image, newUrl);
      updateCount++;
    }
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated ${updateCount} image URLs in file`);
}

// Main function
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🔄 IMAGE GENERATION COMPARISON');
  console.log('='.repeat(70));
  console.log('\nComparing FAL.ai vs Replicate FLUX for Sam West products');
  console.log(`Generating ${PRODUCTS_TO_GENERATE} images with Replicate FLUX Schnell\n`);

  // Get first 10 products
  const products = getFirst10Products();
  
  // Show products to be processed
  console.log('Products to process:');
  products.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (${p.brand})`);
    if (p.image) {
      console.log(`     Old: ${p.image.substring(0, 80)}...`);
    }
  });

  const results: ComparisonResult[] = [];
  const newImageUrls = new Map<number, string>();
  let totalCost = 0;

  // Process each product
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${i + 1}/${products.length}] ${product.name}`);
    console.log(`${'='.repeat(70)}`);

    try {
      // Generate with Replicate
      const { url: replicateUrl, time } = await generateWithReplicate(product);
      
      // Upload to Firebase
      const firebaseUrl = await uploadToFirebase(replicateUrl, product);
      
      // Update Firestore
      await updateFirestore(product, firebaseUrl);
      
      // Store result
      results.push({
        productName: product.name,
        oldImage: product.image || 'none',
        newImage: firebaseUrl,
        oldProvider: product.image ? (product.image.includes('fal.media') ? 'FAL.ai' : 'Unknown') : 'none',
        newProvider: 'Replicate FLUX',
        generationTime: time
      });
      
      newImageUrls.set(product.id, firebaseUrl);
      
      // Cost: FLUX schnell is ~$0.003 per image
      totalCost += 0.003;
      
      console.log(`  ✅ Complete!\n`);
      
      // Rate limiting
      if (i < products.length - 1) {
        console.log('  ⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`  ❌ Failed to process ${product.name}:`, error);
    }
  }

  // Update the product file
  updateProductFile(products, newImageUrls);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 GENERATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nTotal products processed: ${results.length}`);
  console.log(`Successful generations: ${results.length}`);
  console.log(`Average generation time: ${(results.reduce((sum, r) => sum + r.generationTime, 0) / results.length / 1000).toFixed(1)}s`);
  console.log(`Total cost: $${totalCost.toFixed(3)}`);
  
  console.log('\n📋 COMPARISON TABLE:');
  console.log('─'.repeat(70));
  results.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.productName}`);
    console.log(`   Old (${r.oldProvider}): ${r.oldImage.substring(0, 60)}...`);
    console.log(`   New (${r.newProvider}): ${r.newImage.substring(0, 60)}...`);
    console.log(`   Time: ${(r.generationTime / 1000).toFixed(1)}s`);
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ COMPLETE!');
  console.log('='.repeat(70));
  console.log('\nThe sam-west-products.ts file has been updated with new Replicate URLs.');
  console.log('Refresh your application to see the new images!\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
