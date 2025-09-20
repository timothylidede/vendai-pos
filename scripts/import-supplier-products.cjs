/**
 * Import products for Sam West and Mahitaji distributors
 * Parses pricelist text files and imports to Firebase
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, collection, batch, writeBatch } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Distributor configurations
const distributors = {
  mahitaji_enterprises: {
    id: 'mahitaji_enterprises',
    name: 'Mahitaji Enterprises Ltd',
    dataFile: path.join(__dirname, '..', 'data', 'mahitaji pricelist_extracted_text.txt')
  },
  samwest_supermarket: {
    id: 'samwest_supermarket', 
    name: 'Sam West Supermarket',
    dataFile: path.join(__dirname, '..', 'data', 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt')
  }
};

// Parse Mahitaji pricelist format
function parseMahitajiData(content) {
  const lines = content.split('\n');
  const products = [];
  let lineNumber = 0;
  
  // Skip header lines
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('CodeItemUnitP7') || lines[i].includes('KK061')) {
      startIndex = i;
      break;
    }
  }
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 10) continue;
    
    // Mahitaji format: CodeItemUnitPrice
    // Example: KK061ACACIA KIDS APPLE 200MLX24CTN940.00
    const mahitajiPattern = /^([A-Z0-9]+)(.+?)(CTN|PC|PKT|BALE|BUNDL|JAR)(.+?)$/;
    const match = line.match(mahitajiPattern);
    
    if (match) {
      const [, code, description, unit, priceStr] = match;
      const price = parseFloat(priceStr.replace(/[^0-9.,]/g, '').replace(',', ''));
      
      if (!isNaN(price) && price > 0) {
        const product = {
          id: `MAH-${String(products.length + 1).padStart(4, '0')}`,
          distributorId: 'mahitaji_enterprises',
          distributorName: 'Mahitaji Enterprises Ltd',
          name: description.trim(),
          sku: code.trim(),
          unitPrice: price,
          unit: unit,
          category: categorizeMahitajiProduct(description),
          minOrderQuantity: 1,
          leadTime: '1-2 days',
          inStock: true,
          supplier: 'mahitaji',
          barcode: null,
          brand: extractBrand(description),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        products.push(product);
        
        if (products.length % 100 === 0) {
          console.log(`📦 Parsed ${products.length} Mahitaji products...`);
        }
      }
    }
  }
  
  return products;
}

// Parse Sam West pricelist format
function parseSamWestData(content) {
  const lines = content.split('\n');
  const products = [];
  
  // Skip header lines
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('#Description') || lines[i].includes('BUYING PRICE')) {
      startIndex = i + 1;
      break;
    }
  }
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 10) continue;
    if (line.includes('Date') || line.includes('Time') || line.includes('Page')) continue;
    if (line.includes('Continue') || line.includes('Printed by')) continue;
    
    // Sam West format: #DescriptionBUYING PRICEUNIT
    // Example: 110KG ABABIL PK 386 PARBOILED RICEKES 1,295.00Bag
    const samWestPattern = /^(\d+)(.+?)KES\s+([\d,]+\.?\d*)(.+?)$/;
    const match = line.match(samWestPattern);
    
    if (match) {
      const [, number, description, priceStr, unit] = match;
      const price = parseFloat(priceStr.replace(/,/g, ''));
      
      if (!isNaN(price) && price > 0) {
        const cleanDescription = description.replace(/^\d+/, '').trim();
        const cleanUnit = unit.trim();
        
        const product = {
          id: `SW-${String(products.length + 1).padStart(4, '0')}`,
          distributorId: 'samwest_supermarket',
          distributorName: 'Sam West Supermarket',
          name: cleanDescription,
          sku: `SW${number.padStart(4, '0')}`,
          unitPrice: price,
          unit: cleanUnit,
          category: categorizeSamWestProduct(cleanDescription),
          minOrderQuantity: 1,
          leadTime: '1-3 days',
          inStock: true,
          supplier: 'samwest',
          barcode: null,
          brand: extractBrand(cleanDescription),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        products.push(product);
        
        if (products.length % 100 === 0) {
          console.log(`📦 Parsed ${products.length} Sam West products...`);
        }
      }
    }
  }
  
  return products;
}

// Categorize Mahitaji products based on description
function categorizeMahitajiProduct(description) {
  const desc = description.toLowerCase();
  
  if (desc.includes('honey') || desc.includes('salt')) return 'Condiments & Seasonings';
  if (desc.includes('juice') || desc.includes('drink') || desc.includes('rtd')) return 'Beverages';
  if (desc.includes('flour') || desc.includes('ugali') || desc.includes('maize') || desc.includes('atta')) return 'Flour & Grains';
  if (desc.includes('rice') || desc.includes('beans') || desc.includes('spaghetti')) return 'Rice & Grains';
  if (desc.includes('oil') || desc.includes('fat')) return 'Cooking Oils';
  if (desc.includes('soap') || desc.includes('detergent')) return 'Household Items';
  if (desc.includes('milk') || desc.includes('yogurt')) return 'Dairy';
  if (desc.includes('biscuit') || desc.includes('cookie') || desc.includes('snack')) return 'Snacks & Biscuits';
  
  return 'General';
}

// Categorize Sam West products based on description
function categorizeSamWestProduct(description) {
  const desc = description.toLowerCase();
  
  if (desc.includes('rice')) return 'Rice & Grains';
  if (desc.includes('flour') || desc.includes('atta') || desc.includes('maize meal')) return 'Flour & Grains';
  if (desc.includes('sugar')) return 'Sugar & Sweeteners';
  if (desc.includes('oil') || desc.includes('fat')) return 'Cooking Oils';
  if (desc.includes('soap') || desc.includes('detergent') || desc.includes('wipes')) return 'Household Items';
  if (desc.includes('yogurt') || desc.includes('milk')) return 'Dairy';
  if (desc.includes('snack') || desc.includes('biscuit')) return 'Snacks & Biscuits';
  
  return 'General';
}

// Extract brand from description
function extractBrand(description) {
  const brands = [
    'ACACIA', 'AFIA', 'AFYA', 'AJAB', 'ALPA', 'AMAIZE', 'AMANA', 'ANEEK',
    'ABABIL', 'AL-MAHAL', 'CROWN', 'FALCON', 'FZAMI', 'HIMALAYA', 'INDUS',
    'JALAL', 'KARIBU', 'KING AFRICA', 'KUKU', 'MONA', 'MR RICE', 'STAR AFRICA',
    'NIP NAP', '4U', 'AVENA', 'COCACOLA', 'ROYCO', 'EXE', 'MENENGAI'
  ];
  
  const desc = description.toUpperCase();
  for (const brand of brands) {
    if (desc.includes(brand)) {
      return brand;
    }
  }
  
  // Extract first word as potential brand
  const firstWord = description.split(' ')[0];
  if (firstWord && firstWord.length > 2) {
    return firstWord.toUpperCase();
  }
  
  return 'Generic';
}

// Import products to Firebase in batches
async function importProductsToFirebase(distributorId, products) {
  console.log(`\n📤 Importing ${products.length} products for ${distributorId}...`);
  
  const batchSize = 500; // Firestore batch limit
  let imported = 0;
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = writeBatch(db);
    const batchProducts = products.slice(i, i + batchSize);
    
    batchProducts.forEach((product) => {
      const productRef = doc(db, 'distributors', distributorId, 'products', product.id);
      batch.set(productRef, product);
    });
    
    try {
      await batch.commit();
      imported += batchProducts.length;
      console.log(`   ✅ Imported batch: ${imported}/${products.length} products`);
    } catch (error) {
      console.error(`   ❌ Error importing batch: ${error}`);
    }
  }
  
  // Update distributor document with product count
  try {
    await setDoc(doc(db, 'distributors', distributorId), {
      totalProducts: products.length,
      lastProductUpdate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log(`   ✅ Updated distributor metadata`);
  } catch (error) {
    console.error(`   ❌ Error updating distributor metadata: ${error}`);
  }
  
  return imported;
}

// Main function
async function importAllProducts() {
  console.log('🚀 Starting product import for all distributors...\n');
  
  let totalImported = 0;
  
  for (const [key, distributor] of Object.entries(distributors)) {
    console.log(`\n📋 Processing ${distributor.name}...`);
    
    try {
      // Check if data file exists
      if (!fs.existsSync(distributor.dataFile)) {
        console.log(`   ❌ Data file not found: ${distributor.dataFile}`);
        continue;
      }
      
      // Read and parse data
      const content = fs.readFileSync(distributor.dataFile, 'utf8');
      console.log(`   📖 Read data file (${content.length} characters)`);
      
      let products = [];
      if (key === 'mahitaji_enterprises') {
        products = parseMahitajiData(content);
      } else if (key === 'samwest_supermarket') {
        products = parseSamWestData(content);
      }
      
      console.log(`   📊 Parsed ${products.length} products`);
      
      if (products.length === 0) {
        console.log(`   ⚠️  No products parsed for ${distributor.name}`);
        continue;
      }
      
      // Show sample products
      console.log(`   📦 Sample products:`);
      products.slice(0, 3).forEach((p, i) => {
        console.log(`      ${i + 1}. ${p.name} - KES ${p.unitPrice} per ${p.unit} (${p.category})`);
      });
      
      // Import to Firebase
      const imported = await importProductsToFirebase(distributor.id, products);
      totalImported += imported;
      
      console.log(`   🎉 Successfully imported ${imported} products for ${distributor.name}`);
      
    } catch (error) {
      console.error(`   ❌ Error processing ${distributor.name}:`, error);
    }
  }
  
  console.log(`\n🎉 Import complete! Total products imported: ${totalImported}`);
  console.log(`\n📋 Summary:`);
  for (const distributor of Object.values(distributors)) {
    console.log(`   ${distributor.name}: Check Firestore collection 'distributors/${distributor.id}/products'`);
  }
}

// Run import
importAllProducts().catch(console.error);
