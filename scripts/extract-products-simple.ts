/**
 * Simple Product Extraction from Text Files
 * Directly parses the structured pricelist format
 * Much faster and cheaper than using OpenAI!
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';

// Load environment
config({ path: path.join(process.cwd(), '.env.local') });

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

// Parse a product line from the pricelist
function parseProductLine(line: string, lineNumber: number, format: 'samwest' | 'mahitaji'): Product | null {
  // Skip header and empty lines
  if (!line.trim() || line.includes('BUYING PRICE') || line.includes('Date') || 
      line.includes('Time') || line.includes('Page') || line.includes('Continued') ||
      line.includes('CodeItemUnitP7') || line.includes('MAHITAJI') || line.includes('Price List')) {
    return null;
  }

  let code: string, name: string, price: number, unitClean: string;

  if (format === 'samwest') {
    // Format: #DescriptionBUYING PRICEUNIT
    // Example: 110KG ABABIL PK 386 PARBOILED RICEKES 1,295.00Bag
    const match = line.match(/^(\d+)(.+?)(KES\s*[\d,]+\.\d{2})(.+)$/);
    if (!match) return null;

    const [, codeMatch, description, priceStr, unit] = match;
    code = codeMatch;
    name = description.trim();
    price = parseFloat(priceStr.replace(/KES\s*/, '').replace(/,/g, ''));
    unitClean = unit.trim();
    
  } else {
    // Mahitaji format: CodeItemUnitP7
    // Example: KK061ACACIA KIDS APPLE 200MLX24CTN940.00
    const match = line.match(/^([A-Z0-9]+)(.+?)(CTN|PC|BALE|JAR|PKT|BUNDL)(\d+[\d,]*\.\d{2})$/);
    if (!match) return null;

    const [, codeMatch, description, unit, priceStr] = match;
    code = codeMatch;
    name = description.trim();
    price = parseFloat(priceStr.replace(/,/g, ''));
    unitClean = unit;
  }
  
  // Determine category from name/description
  const category = categorizeProduct(name);
  
  // Extract brand (usually first word or first few words)
  const brand = extractBrand(name);
  
  return {
    id: lineNumber,
    code: code,
    name: name,
    description: generateDescription(name, unitClean, price),
    price: price,
    wholesalePrice: Math.round(price * 0.99 * 100) / 100, // 1% discount
    category: category,
    brand: brand,
    inStock: true,
    unit: unitClean,
    distributorName: '' // Will be set by caller
  };
}

function categorizeProduct(name: string): string {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('rice') || nameLower.includes('maize') || 
      nameLower.includes('flour') || nameLower.includes('atta') || 
      nameLower.includes('wheat')) {
    return 'grains';
  }
  if (nameLower.includes('oil') || nameLower.includes('fat') || 
      nameLower.includes('ghee') || nameLower.includes('cooking')) {
    return 'oils';
  }
  if (nameLower.includes('soap') || nameLower.includes('shampoo') || 
      nameLower.includes('lotion') || nameLower.includes('cream') || 
      nameLower.includes('tissue') || nameLower.includes('diaper')) {
    return 'personal-care';
  }
  if (nameLower.includes('cleaner') || nameLower.includes('detergent') || 
      nameLower.includes('bleach') || nameLower.includes('washing')) {
    return 'cleaning';
  }
  if (nameLower.includes('milk') || nameLower.includes('yoghurt') || 
      nameLower.includes('cheese') || nameLower.includes('butter')) {
    return 'dairy';
  }
  if (nameLower.includes('juice') || nameLower.includes('soda') || 
      nameLower.includes('water') || nameLower.includes('drink') || 
      nameLower.includes('tea') || nameLower.includes('coffee')) {
    return 'beverages';
  }
  if (nameLower.includes('sugar') || nameLower.includes('salt') || 
      nameLower.includes('spice') || nameLower.includes('sauce')) {
    return 'food';
  }
  
  return 'general';
}

function extractBrand(name: string): string {
  // Common brand patterns
  const words = name.split(' ');
  
  // If starts with number+KG/L/ML etc, skip to next word
  if (/^\d+(KG|L|ML|GM|PCS)/i.test(words[0])) {
    return words[1] || 'Generic';
  }
  
  return words[0] || 'Generic';
}

function generateDescription(name: string, unit: string, price: number): string {
  const nameParts = name.split(' ');
  let description = name;
  
  // Add unit information
  if (unit && !name.toLowerCase().includes(unit.toLowerCase())) {
    description += ` (${unit})`;
  }
  
  // Add pricing context
  if (price > 1000) {
    description += ' - Bulk pricing available';
  }
  
  return description;
}

// Fetch image URLs from Firebase
async function fetchImageUrls(distributorId: string): Promise<Map<string, string>> {
  console.log(`🔍 Fetching generated images from Firebase for ${distributorId}...`);
  
  try {
    const snapshot = await db.collection('distributor_images')
      .where('distributorId', '==', distributorId)
      .get();

    const imageMap = new Map<string, string>();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const productName = data.productName?.toLowerCase().trim();
      if (productName && data.imageUrl) {
        imageMap.set(productName, data.imageUrl);
      }
    });

    console.log(`✅ Found ${imageMap.size} images in Firebase`);
    return imageMap;
  } catch (error) {
    console.error('❌ Failed to fetch images:', error);
    return new Map();
  }
}

// Match product to image (exact or fuzzy)
function matchImageUrl(product: Product, imageMap: Map<string, string>): string | undefined {
  const productName = product.name.toLowerCase().trim();
  
  // Try exact match
  if (imageMap.has(productName)) {
    return imageMap.get(productName);
  }
  
  // Try fuzzy match (remove special characters, extra spaces)
  const normalized = productName.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  for (const [imageName, url] of imageMap.entries()) {
    const imageNormalized = imageName.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    if (normalized === imageNormalized) {
      return url;
    }
  }
  
  return undefined;
}

// Generate TypeScript file
function generateDistributorFile(
  distributorName: string,
  distributorId: string,
  products: Product[],
  outputPath: string
) {
  console.log(`\n📝 Generating TypeScript file: ${outputPath}`);
  
  const content = `/**
 * ${distributorName} Products
 * Auto-generated from pricelist
 * Total products: ${products.length}
 */

export interface DistributorProduct {
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

export const ${distributorId.replace(/-/g, '_')}_products: DistributorProduct[] = ${JSON.stringify(products, null, 2)};

// Helper functions
export function filterProducts(filters: {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  inStock?: boolean;
}): DistributorProduct[] {
  return ${distributorId.replace(/-/g, '_')}_products.filter(product => {
    if (filters.category && product.category !== filters.category) return false;
    if (filters.minPrice && product.price < filters.minPrice) return false;
    if (filters.maxPrice && product.price > filters.maxPrice) return false;
    if (filters.brand && product.brand !== filters.brand) return false;
    if (filters.inStock !== undefined && product.inStock !== filters.inStock) return false;
    return true;
  });
}

export function searchProducts(query: string): DistributorProduct[] {
  const lowerQuery = query.toLowerCase();
  return ${distributorId.replace(/-/g, '_')}_products.filter(product =>
    product.name.toLowerCase().includes(lowerQuery) ||
    product.description.toLowerCase().includes(lowerQuery) ||
    product.brand.toLowerCase().includes(lowerQuery) ||
    product.category.toLowerCase().includes(lowerQuery)
  );
}

export function getProductById(id: number): DistributorProduct | undefined {
  return ${distributorId.replace(/-/g, '_')}_products.find(p => p.id === id);
}

export function getProductByCode(code: string): DistributorProduct | undefined {
  return ${distributorId.replace(/-/g, '_')}_products.find(p => p.code === code);
}

export function getCategories(): string[] {
  return [...new Set(${distributorId.replace(/-/g, '_')}_products.map(p => p.category))];
}

export function getBrands(): string[] {
  return [...new Set(${distributorId.replace(/-/g, '_')}_products.map(p => p.brand))].sort();
}

// Stats
export const stats = {
  totalProducts: ${products.length},
  withImages: ${products.filter(p => p.image).length},
  categories: getCategories().length,
  brands: getBrands().length,
  avgPrice: ${(products.reduce((sum, p) => sum + p.price, 0) / products.length).toFixed(2)},
  minPrice: ${Math.min(...products.map(p => p.price))},
  maxPrice: ${Math.max(...products.map(p => p.price))}
};
`;

  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`✅ Generated file with ${products.length} products`);
  console.log(`   - With images: ${products.filter(p => p.image).length}`);
  console.log(`   - Categories: ${[...new Set(products.map(p => p.category))].length}`);
  console.log(`   - Brands: ${[...new Set(products.map(p => p.brand))].length}`);
}

// Process a distributor
async function processDistributor(
  distributorName: string,
  distributorId: string,
  textFilePath: string,
  format: 'samwest' | 'mahitaji'
) {
  console.log('\n' + '='.repeat(60));
  console.log(`📦 Processing: ${distributorName}`);
  console.log('='.repeat(60));

  // Read text file
  const text = fs.readFileSync(textFilePath, 'utf8');
  console.log(`✅ Loaded text file (${text.length} characters)`);

  // Parse products
  const lines = text.split('\n');
  const products: Product[] = [];
  
  console.log(`📊 Parsing ${lines.length} lines...`);
  for (let i = 0; i < lines.length; i++) {
    const product = parseProductLine(lines[i], i + 1, format);
    if (product) {
      product.distributorName = distributorName;
      products.push(product);
    }
  }
  
  console.log(`✅ Parsed ${products.length} products`);

  // Fetch images
  const imageMap = await fetchImageUrls(distributorId);
  
  // Match images
  let matchedImages = 0;
  for (const product of products) {
    const imageUrl = matchImageUrl(product, imageMap);
    if (imageUrl) {
      product.image = imageUrl;
      matchedImages++;
    }
  }
  console.log(`✅ Matched ${matchedImages} images (${((matchedImages / products.length) * 100).toFixed(1)}%)`);

  // Generate file
  const outputDir = path.join(process.cwd(), 'data', 'distributors');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, `${distributorId}-products.ts`);
  generateDistributorFile(distributorName, distributorId, products, outputPath);
  
  return products;
}

// Main function
async function main() {
  console.log('🚀 Simple Product Extraction\n');
  console.log('Parsing structured pricelist text files');
  console.log('No AI needed - just direct parsing!\n');

  const dataDir = path.join(process.cwd(), 'data');

  // Process Sam West
  const samWestProducts = await processDistributor(
    'Sam West',
    'sam-west',
    path.join(dataDir, 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt'),
    'samwest'
  );

  // Process Mahitaji
  const mahitajiProducts = await processDistributor(
    'Mahitaji',
    'mahitaji',
    path.join(dataDir, 'mahitaji pricelist_extracted_text.txt'),
    'mahitaji'
  );

  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL DISTRIBUTORS PROCESSED!');
  console.log('='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   Sam West: ${samWestProducts.length} products`);
  console.log(`   Mahitaji: ${mahitajiProducts.length} products`);
  console.log(`   TOTAL: ${samWestProducts.length + mahitajiProducts.length} products`);
  console.log('\n📝 Generated files:');
  console.log('   - data/distributors/sam-west-products.ts');
  console.log('   - data/distributors/mahitaji-products.ts');
  console.log('\n💰 Cost: $0.00 (No AI used!)');
}

main().catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
