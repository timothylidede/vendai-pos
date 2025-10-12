/**
 * Regenerate Sam West images with FAL.ai, auto-update sam-west-products.ts, and remember progress.
 *
 * Usage:
 *   npx tsx scripts/fal-regenerate-samwest.ts --limit 10        # process next 10 from last checkpoint
 *   npx tsx scripts/fal-regenerate-samwest.ts --start 100 --limit 20
 *   npx tsx scripts/fal-regenerate-samwest.ts --reset           # restart from 0
 */

import * as fs from 'fs';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import * as fal from '@fal-ai/serverless-client';

// Env
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });

// FAL config
if (!process.env.FAL_API_KEY) {
  console.error('❌ Missing FAL_API_KEY');
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_API_KEY });

// Firebase Admin init (env var or serviceAccountKey.json)
try {
  let adminInit: any = {};
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    adminInit = { credential: cert(serviceAccount) };
  } else {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    adminInit = { credential: cert(serviceAccount) };
  }
  const bucketFromEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
  const storageBucket = bucketFromEnv || 'vendai-fa58c.appspot.com';
  initializeApp({ ...adminInit, storageBucket });
  console.log('✅ Firebase initialized');
} catch (err: any) {
  console.error('❌ Firebase init failed:', err?.message || err);
  process.exit(1);
}
const storage = getStorage();

// CLI args
const argv = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = argv.indexOf(`--${name}`);
  return idx >= 0 ? argv[idx + 1] : undefined;
};
const hasFlag = (name: string) => argv.includes(`--${name}`);

const limit = parseInt(getArg('limit') || '10', 10);
const startOverride = getArg('start');
const reset = hasFlag('reset');

// Progress file
const progressFile = path.join(process.cwd(), 'data', 'sam-west-fal-progress.json');
function loadProgress(): number {
  if (reset) return 0;
  if (startOverride) return Math.max(0, parseInt(startOverride, 10) || 0);
  try {
    const txt = fs.readFileSync(progressFile, 'utf-8');
    const json = JSON.parse(txt);
    return json?.nextIndex ?? 0;
  } catch {
    return 0;
  }
}
function saveProgress(nextIndex: number) {
  const payload = { nextIndex, updatedAt: new Date().toISOString() };
  fs.writeFileSync(progressFile, JSON.stringify(payload, null, 2));
}

// Types and data
interface Product {
  id: number;
  code: string;
  name: string;
  description?: string;
  price?: number;
  wholesalePrice?: number;
  category?: string;
  brand?: string;
  inStock?: boolean;
  unit?: string;
  image?: string;
  distributorName?: string;
}

function readSamWestProducts(): Product[] {
  const filePath = path.join(process.cwd(), 'data', 'distributors', 'sam-west-products.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/export const sam_west_products[^=]*=\s*(\[[\s\S]*?\n\];)/);
  if (!match) throw new Error('Could not parse sam-west-products.ts');
  const jsonStr = match[1].replace(/;$/, '');
  return JSON.parse(jsonStr);
}

function writeSamWestProducts(updated: Product[]) {
  const filePath = path.join(process.cwd(), 'data', 'distributors', 'sam-west-products.ts');
  let file = fs.readFileSync(filePath, 'utf8');
  const before = file;
  // Replace the array body with updated JSON
  const body = JSON.stringify(updated, null, 2) + ';';
  file = file.replace(/export const sam_west_products[^=]*=\s*\[[\s\S]*?\n\];/, match => {
    const prefix = match.substring(0, match.indexOf('['));
    return `${prefix}${body}`;
  });
  if (file !== before) fs.writeFileSync(filePath, file, 'utf8');
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50);
}

// Prompt and reference utilities (adapted from generate-images-fal.ts)
function buildPrompt(p: Product): string {
  const base = `Professional studio product photography, single centered product on floating glass shelf, uniform slate gray background (#1f2937), tight crop with product filling 75% of frame, sharp focus with gentle depth of field, cool teal-accent lighting, high detail, rich color saturation, subtle film grain, no text or props, modern e-commerce style.`;
  const details = [
    p.brand && `Brand: ${p.brand}`,
    p.name && `Product name: ${p.name}`,
    p.description && `Description: ${p.description}`,
    p.category && `Category: ${p.category}`,
    p.unit && `Unit: ${p.unit}`,
  ].filter(Boolean).join('. ');
  return details ? `${base} Product details: ${details}. Maintain consistent slate gray backdrop.` : `${base} Maintain consistent slate gray backdrop.`;
}

async function googleRefImages(query: string, topN = 6): Promise<string[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX || process.env.NEXT_PUBLIC_CX;
  if (!apiKey || !cx) return [];
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('q', query);
    url.searchParams.set('num', String(Math.min(topN, 10)));
    url.searchParams.set('safe', 'active');
    url.searchParams.set('imgSize', 'large');
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const items = Array.isArray(json.items) ? json.items : [];
    return items.map((i: any) => i.link).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchImageAsDataUrl(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'image/*',
          'Referer': 'https://www.google.com/'
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error('bad status');
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) throw new Error('not image');
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength < 5000) throw new Error('too small');
      const b64 = Buffer.from(buffer).toString('base64');
      return `data:${contentType};base64,${b64}`;
    } catch {
      if (attempt === retries) return null;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}

async function generateFalImage(product: Product): Promise<string> {
  const prompt = buildPrompt(product);
  const query = [product.brand, product.name, product.unit, product.category].filter(Boolean).join(' ');
  const refs = await googleRefImages(`${query} product image`, 6);
  let refDataUrl: string | undefined;
  for (const u of refs) {
    const dataUrl = await fetchImageAsDataUrl(u, 2);
    if (dataUrl) { refDataUrl = dataUrl; break; }
  }

  const input: any = {
    prompt,
    image_size: 'square_hd',
    num_inference_steps: 4,
    num_images: 1,
    enable_safety_checker: true,
    output_format: 'jpeg'
  };
  if (refDataUrl) { input.image_url = refDataUrl; input.strength = 0.6; }

  const result: any = await fal.subscribe('fal-ai/flux/schnell', { input });
  if (!result?.images?.[0]?.url) throw new Error('No image URL in FAL response');
  return result.images[0].url as string;
}

async function uploadToFirebase(externalUrl: string, product: Product): Promise<string> {
  const res = await fetch(externalUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const category = (product.category || 'general').toLowerCase().replace(/\s+/g, '-');
  const nameSlug = slugify(product.name);
  const hash = Math.random().toString(36).slice(2, 8);
  const fileName = `${nameSlug}-${hash}.jpg`;
  const storagePath = `distributor-images/sam-west/${category}/${fileName}`;
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  await file.save(buffer, { contentType: 'image/jpeg', metadata: { cacheControl: 'public, max-age=31536000' } });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

function updateProductsArray(products: Product[], index: number, newUrl: string): Product[] {
  const updated = products.slice();
  const p = { ...updated[index] };
  p.image = newUrl;
  updated[index] = p;
  return updated;
}

async function main() {
  const products = readSamWestProducts();
  const start = loadProgress();
  const end = Math.min(products.length, start + limit);
  console.log(`🔁 Regenerating Sam West images with FAL.ai | Range: [${start} .. ${end - 1}] (limit=${limit})`);

  let working = products;
  for (let i = start; i < end; i++) {
    const p = products[i];
    console.log(`\n[${i + 1}/${products.length}] ${p.name}`);
    try {
      const falUrl = await generateFalImage(p);
      const storageUrl = await uploadToFirebase(falUrl, p);
      working = updateProductsArray(working, i, storageUrl);
      writeSamWestProducts(working);
      saveProgress(i + 1);
      console.log(`   ✅ Updated product image -> ${storageUrl.substring(0, 80)}...`);
      await new Promise(r => setTimeout(r, 400));
    } catch (err: any) {
      console.error(`   ❌ Failed: ${err?.message || err}`);
      // still advance to avoid blocking; comment out if you prefer halt
      saveProgress(i + 1);
    }
  }

  console.log(`\n✅ Done. Next start index saved: ${loadProgress()}`);
}

main().catch(err => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
