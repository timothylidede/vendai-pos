/**
 * Export first 100 Sam West products with generated images
 * Run after batch 1 completes to generate product data files
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
config({ path: path.join(__dirname, '..', '.env.local') });

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
} catch (error: any) {
  console.error('❌ Firebase init error:', error.message);
  process.exit(1);
}

const db = getFirestore();

interface ParsedProduct {
  productName: string;
  brandName: string;
  packSize: string;
  category: string;
  unit: string;
  price: number;
}

// Parse Sam West pricelist
function parseSamWest(filePath: string): ParsedProduct[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const products: ParsedProduct[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 20) continue;

    // Format: "110KG ABABIL PK 386 PARBOILED RICEKES 1,295.00Bag"
    // Extract description and price
    const match = line.match(/^(\d+)(.+?)(KES\s*[\d,]+\.?\d*)(.*?)$/i);
    if (!match) continue;

    const [, number, description, priceText, unit] = match;
    
    // Extract price
    const priceMatch = priceText.match(/[\d,]+\.?\d*/);
    if (!priceMatch) continue;
    const price = parseFloat(priceMatch[0].replace(/,/g, ''));

    // Clean description
    const cleanDesc = description.trim();
    
    // Extract unit (Bag, PCS, KG, etc.)
    const unitMatch = unit.trim() || 'PCS';
    
    // Parse product parts
    const parts = cleanDesc.split(/\s+/);
    if (parts.length < 2) continue;

    const packSize = parts[0]; // 10KG, 1L, etc.
    const restParts = parts.slice(1);
    
    // First part is often the brand
    const brandName = restParts[0] || '';
    const productName = cleanDesc;

    const category = inferCategory(cleanDesc);

    products.push({
      productName,
      brandName,
      packSize,
      category,
      unit: unitMatch,
      price
    });
  }

  return products;
}

function inferCategory(productText: string): string {
  const text = productText.toLowerCase();
  
  if (text.includes('rice')) return 'Rice';
  if (text.includes('flour') || text.includes('atta') || text.includes('maize')) return 'Flour & Grains';
  if (text.includes('sugar')) return 'Baking & Sweeteners';
  if (text.includes('oil') || text.includes('fat')) return 'Cooking Oils & Fats';
  if (text.includes('soap') || text.includes('detergent') || text.includes('cleaner')) return 'Cleaning Products';
  if (text.includes('milk') || text.includes('yoghurt') || text.includes('cheese')) return 'Dairy Products';
  if (text.includes('juice') || text.includes('drink') || text.includes('water')) return 'Beverages';
  if (text.includes('diaper') || text.includes('pad') || text.includes('wipes')) return 'Personal Care';
  
  return 'General';
}

async function main() {
  console.log('🚀 Exporting Sam West Products with Images\n');

  // 1. Parse pricelist for first 100 products
  const dataDir = path.join(process.cwd(), 'data');
  const samWestPath = path.join(dataDir, 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt');
  
  if (!fs.existsSync(samWestPath)) {
    console.error('❌ Sam West pricelist not found');
    process.exit(1);
  }

  const allProducts = parseSamWest(samWestPath);
  const first100 = allProducts.slice(0, 100);
  console.log(`📦 Loaded ${first100.length} products from pricelist`);

  // 2. Fetch generated images from Firestore
  console.log('🔍 Fetching generated images from Firestore...');
  const imagesSnapshot = await db.collection('distributor_images')
    .where('distributorId', '==', 'sam-west')
    .limit(100)
    .get();

  const imageMap = new Map<string, any>();
  imagesSnapshot.forEach((doc) => {
    const data = doc.data();
    const normalizedName = data.productName?.toLowerCase().trim();
    if (normalizedName) {
      imageMap.set(normalizedName, {
        url: data.imageUrl,
        storageUrl: data.storageUrl,
        category: data.category,
        brand: data.brand,
        createdAt: data.createdAt
      });
    }
  });

  console.log(`✅ Found ${imageMap.size} generated images\n`);

  // 3. Merge products with images
  const productsWithImages = first100.map((product, index) => {
    const normalizedName = product.productName.toLowerCase().trim();
    const imageData = imageMap.get(normalizedName);

    return {
      id: `sw-${index + 1}`,
      code: `${index + 1}`,
      name: product.productName,
      brand: product.brandName,
      unitPrice: product.price,
      unit: product.unit,
      packSize: product.packSize,
      category: product.category,
      inStock: true,
      leadTime: '1-2 days',
      imageUrl: imageData?.url || undefined,
      storageUrl: imageData?.storageUrl || undefined,
      createdAt: imageData?.createdAt || new Date().toISOString()
    };
  });

  // 4. Generate TypeScript file
  const tsContent = `// Sam West Products - First 100 with Generated Images
// Auto-generated on ${new Date().toISOString()}
// Source: Batch 1 image generation + pricelist parsing

export interface SamWestProduct {
  id: string;
  code: string;
  name: string;
  brand: string;
  unitPrice: number;
  unit: string;
  packSize: string;
  category: string;
  inStock: boolean;
  leadTime: string;
  imageUrl?: string;
  storageUrl?: string;
  createdAt: string;
}

export const samWestProducts: SamWestProduct[] = ${JSON.stringify(productsWithImages, null, 2)};

// Category breakdown
export const samWestCategories = [
  'Rice',
  'Flour & Grains',
  'Baking & Sweeteners',
  'Cooking Oils & Fats',
  'Cleaning Products',
  'Dairy Products',
  'Beverages',
  'Personal Care',
  'General'
];

// Get products by category
export function getProductsByCategory(category: string): SamWestProduct[] {
  return samWestProducts.filter(p => p.category === category);
}

// Get product by ID
export function getProductById(id: string): SamWestProduct | undefined {
  return samWestProducts.find(p => p.id === id);
}

// Search products
export function searchProducts(query: string): SamWestProduct[] {
  const lowerQuery = query.toLowerCase();
  return samWestProducts.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.brand.toLowerCase().includes(lowerQuery) ||
    p.category.toLowerCase().includes(lowerQuery)
  );
}

// Filter by price range
export function filterByPrice(min: number, max: number): SamWestProduct[] {
  return samWestProducts.filter(p => p.unitPrice >= min && p.unitPrice <= max);
}

// Statistics
export const stats = {
  total: samWestProducts.length,
  withImages: samWestProducts.filter(p => p.imageUrl).length,
  categories: samWestCategories.length,
  avgPrice: samWestProducts.reduce((sum, p) => sum + p.unitPrice, 0) / samWestProducts.length,
  minPrice: Math.min(...samWestProducts.map(p => p.unitPrice)),
  maxPrice: Math.max(...samWestProducts.map(p => p.unitPrice))
};
`;

  const outputPath = path.join(dataDir, 'sam-west-products.ts');
  fs.writeFileSync(outputPath, tsContent, 'utf-8');
  console.log(`✅ Generated: ${outputPath}`);

  // 5. Generate image URLs only file
  const imageUrls = productsWithImages
    .filter(p => p.imageUrl)
    .map(p => ({
      id: p.id,
      name: p.name,
      url: p.imageUrl,
      storageUrl: p.storageUrl
    }));

  const imagesContent = `// Sam West Product Image URLs
// Auto-generated on ${new Date().toISOString()}

export const samWestProductImages = ${JSON.stringify(imageUrls, null, 2)};

export function getImageUrl(productId: string): string | undefined {
  return samWestProductImages.find(img => img.id === productId)?.url;
}
`;

  const imagesPath = path.join(dataDir, 'sam-west-product-images.ts');
  fs.writeFileSync(imagesPath, imagesContent, 'utf-8');
  console.log(`✅ Generated: ${imagesPath}`);

  // 6. Print summary
  console.log('\n📊 Summary:');
  console.log(`   Total products: ${productsWithImages.length}`);
  console.log(`   With images: ${productsWithImages.filter(p => p.imageUrl).length}`);
  console.log(`   Without images: ${productsWithImages.filter(p => !p.imageUrl).length}`);
  console.log(`   Categories: ${new Set(productsWithImages.map(p => p.category)).size}`);
  console.log(`   Price range: KES ${Math.min(...productsWithImages.map(p => p.unitPrice))} - KES ${Math.max(...productsWithImages.map(p => p.unitPrice))}`);

  console.log('\n✅ Export complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Check data/sam-west-products.ts for product data');
  console.log('   2. Check data/sam-west-product-images.ts for image URLs');
  console.log('   3. Update distributor-data.ts to use these files');
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
