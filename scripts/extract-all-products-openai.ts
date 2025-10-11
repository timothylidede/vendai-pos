/**
 * OpenAI-Powered PDF Product Extraction
 * Extracts ALL products from distributor PDFs with descriptions
 * Cost-efficient batch processing with GPT-4o-mini
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  wholesalePrice: number;
  category: string;
  brand: string;
  inStock: boolean;
  unit: string;
  code: string;
  image?: string;
  distributorName: string;
}

// Extract products from text using OpenAI (batch processing for efficiency)
async function extractProductsFromText(
  text: string,
  distributorName: string,
  batchSize: number = 50
): Promise<Product[]> {
  console.log(`\n🤖 Using OpenAI to extract products (batches of ${batchSize})...`);
  
  const prompt = `You are a data extraction expert. Extract product information from this distributor pricelist.

DISTRIBUTOR: ${distributorName}

PRICELIST TEXT:
${text}

Extract ALL products and format as JSON array with these fields:
- code: product code/number
- name: full product name
- description: detailed description (include size, quantity, flavor, etc.)
- brand: brand name
- unit: unit type (CTN, PCS, BAG, KG, L, etc.)
- price: price as number (remove currency symbols and commas)
- category: one of (beverages, food, personal-care, cleaning, dairy, grains, oils, general)

Example format:
[
  {
    "code": "1",
    "name": "10KG ABABIL PK 386 PARBOILED RICE",
    "description": "Ababil brand parboiled rice in 10kg bags, PK 386 variety",
    "brand": "ABABIL",
    "unit": "BAG",
    "price": 1295,
    "category": "grains"
  }
]

Return ONLY the JSON array, no markdown, no explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-efficient model
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction expert. Extract product data accurately and return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 16000 // Enough for large product lists
    });

    const content = response.content[0].text.trim();
    
    // Remove markdown code blocks if present
    let jsonText = content;
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
    }

    const products = JSON.parse(jsonText);
    console.log(`✅ Extracted ${products.length} products using OpenAI`);
    
    return products;
  } catch (error) {
    console.error('❌ OpenAI extraction failed:', error);
    return [];
  }
}

// Fetch image URLs from Firebase
async function fetchImageUrls(distributorId: string): Promise<Map<string, string>> {
  console.log(`\n🔍 Fetching generated images from Firebase for ${distributorId}...`);
  
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

    console.log(`✅ Found ${imageMap.size} generated images`);
    return imageMap;
  } catch (error) {
    console.error('❌ Firebase fetch error:', error);
    return new Map();
  }
}

// Match product to image URL
function matchImageUrl(productName: string, imageMap: Map<string, string>): string | undefined {
  const normalized = productName.toLowerCase().trim();
  
  // Try exact match
  if (imageMap.has(normalized)) {
    return imageMap.get(normalized);
  }
  
  // Try fuzzy match
  for (const [key, url] of imageMap.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return url;
    }
  }
  
  return undefined;
}

// Generate TypeScript file for distributor
function generateDistributorFile(
  distributorName: string,
  products: Product[],
  outputPath: string
) {
  const categories = [...new Set(products.map(p => p.category))].sort();
  
  const fileContent = `// ${distributorName} Products
// Auto-generated on ${new Date().toISOString()}
// Source: PDF extraction via OpenAI + Firebase image URLs

import type { Product } from "@/lib/types"

export const ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products: Product[] = ${JSON.stringify(products, null, 2)};

// Category list
export const categories = ${JSON.stringify(categories, null, 2)};

// Helper functions
export function getProductById(id: number): Product | undefined {
  return ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.find(p => p.id === id);
}

export function getProductsByCategory(category: string): Product[] {
  return ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.filter(p => p.category === category);
}

export function searchProducts(query: string): Product[] {
  const lowerQuery = query.toLowerCase();
  return ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    p.description.toLowerCase().includes(lowerQuery) ||
    p.brand.toLowerCase().includes(lowerQuery) ||
    p.code.includes(lowerQuery)
  );
}

export function filterByPrice(min: number, max: number): Product[] {
  return ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.filter(p => 
    p.price >= min && p.price <= max
  );
}

export function filterProducts(filters: {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  brand?: string;
}): Product[] {
  let filtered = ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products;
  
  if (filters.category) {
    filtered = filtered.filter(p => p.category === filters.category);
  }
  
  if (filters.minPrice !== undefined) {
    filtered = filtered.filter(p => p.price >= filters.minPrice!);
  }
  
  if (filters.maxPrice !== undefined) {
    filtered = filtered.filter(p => p.price <= filters.maxPrice!);
  }
  
  if (filters.inStock !== undefined) {
    filtered = filtered.filter(p => p.inStock === filters.inStock);
  }
  
  if (filters.brand) {
    filtered = filtered.filter(p => p.brand.toLowerCase() === filters.brand!.toLowerCase());
  }
  
  return filtered;
}

// Statistics
export const stats = {
  total: ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.length,
  withImages: ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.filter(p => p.image).length,
  categories: categories.length,
  brands: [...new Set(${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.map(p => p.brand))].length,
  avgPrice: ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.reduce((sum, p) => sum + p.price, 0) / ${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.length,
  minPrice: Math.min(...${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.map(p => p.price)),
  maxPrice: Math.max(...${distributorName.toLowerCase().replace(/\s+/g, '_')}_products.map(p => p.price))
};
`;

  fs.writeFileSync(outputPath, fileContent, 'utf-8');
  console.log(`✅ Generated: ${outputPath}`);
}

// Process distributor
async function processDistributor(
  distributorName: string,
  distributorId: string,
  pdfTextPath: string
) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Processing: ${distributorName}`);
  console.log('='.repeat(60));

  // 1. Read extracted text from PDF
  if (!fs.existsSync(pdfTextPath)) {
    console.error(`❌ PDF text file not found: ${pdfTextPath}`);
    return;
  }

  const pdfText = fs.readFileSync(pdfTextPath, 'utf-8');
  console.log(`✅ Loaded PDF text (${pdfText.length} characters)`);

  // 2. Extract products using OpenAI
  const extractedProducts = await extractProductsFromText(pdfText, distributorName);
  
  if (extractedProducts.length === 0) {
    console.error(`❌ No products extracted for ${distributorName}`);
    return;
  }

  // 3. Fetch image URLs from Firebase
  const imageMap = await fetchImageUrls(distributorId);

  // 4. Format products like products.ts
  const formattedProducts: Product[] = extractedProducts.map((p, index) => {
    const imageUrl = matchImageUrl(p.name, imageMap);
    const wholesalePrice = Math.floor(p.price * 0.99); // 1% discount for wholesale

    return {
      id: index + 1,
      name: p.name,
      description: p.description,
      price: p.price,
      wholesalePrice: wholesalePrice,
      category: p.category,
      brand: p.brand,
      inStock: true,
      unit: p.unit,
      code: p.code,
      image: imageUrl,
      distributorName: distributorName
    };
  });

  // 5. Generate TypeScript file
  const outputDir = path.join(process.cwd(), 'data', 'distributors');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(
    outputDir,
    `${distributorName.toLowerCase().replace(/\s+/g, '-')}-products.ts`
  );

  generateDistributorFile(distributorName, formattedProducts, outputPath);

  // 6. Print summary
  console.log(`\n📊 ${distributorName} Summary:`);
  console.log(`   Total products: ${formattedProducts.length}`);
  console.log(`   With images: ${formattedProducts.filter(p => p.image).length}`);
  console.log(`   Categories: ${new Set(formattedProducts.map(p => p.category)).size}`);
  console.log(`   Price range: KES ${Math.min(...formattedProducts.map(p => p.price))} - KES ${Math.max(...formattedProducts.map(p => p.price))}`);
  console.log(`   Image coverage: ${((formattedProducts.filter(p => p.image).length / formattedProducts.length) * 100).toFixed(1)}%`);
}

// Main function
async function main() {
  console.log('🚀 OpenAI PDF Product Extraction\n');
  console.log('This will extract ALL products from distributor PDFs');
  console.log('Using GPT-4o-mini for cost efficiency\n');

  const dataDir = path.join(process.cwd(), 'data');

  // Process Sam West
  await processDistributor(
    'Sam West',
    'sam-west',
    path.join(dataDir, 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt')
  );

  // Process Mahitaji
  await processDistributor(
    'Mahitaji',
    'mahitaji',
    path.join(dataDir, 'mahitaji pricelist_extracted_text.txt')
  );

  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL DISTRIBUTORS PROCESSED!');
  console.log('='.repeat(60));
  console.log('\n📝 Generated files:');
  console.log('   - data/distributors/sam-west-products.ts');
  console.log('   - data/distributors/mahitaji-products.ts');
  console.log('\n📝 Next steps:');
  console.log('   1. Update distributor-data.ts to import these files');
  console.log('   2. Use the helper functions for filtering/searching');
  console.log('   3. Deploy and test in supplier module');
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
