import * as fs from 'fs';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Load .env.local
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });

// Init Firebase Admin (env var first, file fallback)
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
  // Attach storage bucket
  const bucketFromEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
  const storageBucket = bucketFromEnv && bucketFromEnv.includes('appspot.com')
    ? bucketFromEnv
    : 'vendai-fa58c.appspot.com';

  initializeApp({ ...adminInit, storageBucket });
  console.log('✅ Firebase Admin initialized');
} catch (err: any) {
  console.error('❌ Failed to initialize Firebase Admin:', err?.message || err);
  process.exit(1);
}

const db = getFirestore();
const storage = getStorage();

interface Product {
  id: number;
  code: string;
  name: string;
  description: string;
  price: number;
  wholesalePrice: number;
  category: string;
  brand: string;
  inStock: boolean;
  unit: string;
  image?: string;
  distributorName: string;
}

// Read first N products from sam-west-products.ts
function getProducts(limit: number): Product[] {
  const filePath = path.join(process.cwd(), 'data', 'distributors', 'sam-west-products.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/export const sam_west_products[^=]*=\s*(\[[\s\S]*?\n\];)/);
  if (!match) throw new Error('Could not parse sam-west-products.ts');
  const jsonStr = match[1].replace(/;$/, '');
  const allProducts = JSON.parse(jsonStr);
  return (allProducts as Product[]).slice(0, limit);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50);
}

async function findLatestFalUrl(product: Product): Promise<string | null> {
  try {
    const bucket = storage.bucket();
    const categoryFolder = (product.category || 'general').toLowerCase().replace(/\s+/g, '-');
    const basePath = `distributor-images/sam-west/${categoryFolder}/`;
    const prefix = basePath + slugify(product.name) + '-';

    // List files by prefix
    const [files] = await bucket.getFiles({ prefix });
    if (!files || files.length === 0) {
      const slug = slugify(product.name);
      // fallback 1: list entire category and filter contains slug
      const [catFiles] = await bucket.getFiles({ prefix: basePath, maxResults: 200 });
      let candidates = (catFiles || []).filter(f => f.name.includes(slug));

      // fallback 2: search across distributor folder if category mismatch
      if (!candidates.length) {
        const [distFiles] = await bucket.getFiles({ prefix: 'distributor-images/sam-west/', maxResults: 1000 });
        candidates = (distFiles || []).filter(f => f.name.includes(slug));
      }

      if (!candidates.length) return null;
      candidates.sort((a: any, b: any) => new Date(b.metadata?.updated || b.metadata?.timeCreated || 0).getTime() - new Date(a.metadata?.updated || a.metadata?.timeCreated || 0).getTime());
      const chosen = candidates[0];
      return `https://storage.googleapis.com/${bucket.name}/${chosen.name}`;
    }

    // Choose most recently updated file
    files.sort((a: any, b: any) => new Date(b.metadata?.updated || b.metadata?.timeCreated || 0).getTime() - new Date(a.metadata?.updated || a.metadata?.timeCreated || 0).getTime());
    const latest = files[0];
    return `https://storage.googleapis.com/${bucket.name}/${latest.name}`;
  } catch (err) {
    console.warn('⚠️ Storage lookup failed for', product.name, err);
    return null;
  }
}

function updateProductFile(products: Product[], imageMap: Map<number, string>) {
  const filePath = path.join(process.cwd(), 'data', 'distributors', 'sam-west-products.ts');
  let content = fs.readFileSync(filePath, 'utf8');
  let updateCount = 0;

  for (const p of products) {
    const newUrl = imageMap.get(p.id);
    if (!newUrl) continue;

    if (p.image && content.includes(p.image)) {
      content = content.replace(p.image, newUrl);
      updateCount++;
    } else {
      // inject image property if missing or previous not found; do a conservative insert
      const safeName = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(\\{\\s*\"id\\":\\s*${p.id}[^}]*?)\\}`, 'm');
      const match = content.match(regex);
      if (match) {
        const block = match[1];
        const hasImage = /"image"\s*:/.test(block);
        if (!hasImage) {
          const withImage = block.replace(/(\"distributorName\"\s*:\s*\"[^\"]*\")/, `$1,\n    \"image\": \"${newUrl}\"`);
          content = content.replace(block, withImage);
          updateCount++;
        }
      }
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated ${updateCount} image URLs in sam-west-products.ts`);
}

async function main() {
  const limitArgIndex = process.argv.indexOf('--limit');
  const limit = limitArgIndex > -1 ? parseInt(process.argv[limitArgIndex + 1]) : 10;
  console.log(`🔄 Updating first ${limit} Sam West products with latest FAL.ai URLs...`);

  const products = getProducts(limit);
  const imageMap = new Map<number, string>();

  for (const p of products) {
    const url = await findLatestFalUrl(p);
    if (url) {
      imageMap.set(p.id, url);
      console.log(`  ✓ ${p.name} -> ${url.substring(0, 70)}...`);
    } else {
      console.log(`  - No FAL.ai image found for ${p.name}`);
    }
  }

  updateProductFile(products, imageMap);
}

main().catch((err) => {
  console.error('❌ Update failed:', err);
  process.exit(1);
});