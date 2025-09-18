/**
 * Client-side Product Import Script
 * This creates products data that can be imported via the web interface
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Product categories mapping
const categorySuppliers = {
  'beverages.csv': { supplier: 'Sam West Supermarket', category: 'Beverages' },
  'baby-and-personal-care.csv': { supplier: 'Sam West Supermarket', category: 'Baby & Personal Care' },
  'baby-care.csv': { supplier: 'Mahitaji Distributors', category: 'Baby Care' },
  'biscuits-and-cookies.csv': { supplier: 'Sam West Supermarket', category: 'Biscuits & Cookies' },
  'canned-foods.csv': { supplier: 'Sam West Supermarket', category: 'Canned Foods' },
  'cereals---legumes.csv': { supplier: 'Mahitaji Distributors', category: 'Cereals & Legumes' },
  'cleaning-products.csv': { supplier: 'Sam West Supermarket', category: 'Cleaning Products' },
  'cooking-oils---fats.csv': { supplier: 'Mahitaji Distributors', category: 'Cooking Oils & Fats' },
  'dairy-products.csv': { supplier: 'Sam West Supermarket', category: 'Dairy Products' },
  'eggs.csv': { supplier: 'Mahitaji Distributors', category: 'Eggs' },
  'flour.csv': { supplier: 'Sam West Supermarket', category: 'Flour' },
  'household-items.csv': { supplier: 'Sam West Supermarket', category: 'Household Items' },
  'juices.csv': { supplier: 'Sam West Supermarket', category: 'Juices' },
  'personal-care---hygiene.csv': { supplier: 'Mahitaji Distributors', category: 'Personal Care & Hygiene' },
  'rice.csv': { supplier: 'Sam West Supermarket', category: 'Rice' },
  'snacks.csv': { supplier: 'Sam West Supermarket', category: 'Snacks' },
  'sugar.csv': { supplier: 'Mahitaji Distributors', category: 'Sugar' }
};

// Function to generate a random barcode if missing
function generateBarcode() {
  return Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
}

// Function to generate carton barcode
function generateCartonBarcode() {
  return Math.floor(2000000000000 + Math.random() * 8000000000000).toString();
}

// Function to clean and parse price
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  // Remove currency symbols and parse
  const cleaned = priceStr.toString().replace(/[KSh,\s]/g, '');
  const price = parseFloat(cleaned);
  return isNaN(price) ? 0 : price;
}

// Function to process products from a CSV file
async function processProductsFromCSV(filePath, supplierInfo) {
  return new Promise((resolve, reject) => {
    const products = [];
    const fileName = path.basename(filePath);
    
    console.log(`Processing ${fileName} for ${supplierInfo.supplier}...`);
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        try {
          // Handle different CSV formats - be flexible with column names
          const possibleNames = [
            row.name, row.Name, row['Product Name'], row.product_name, 
            row.item, row.Item, row['Item Name'], row.description, row.Description
          ];
          const possibleBrands = [
            row.brand, row.Brand, row.Manufacturer, row.manufacturer, 
            row.company, row.Company, row.supplier
          ];
          const possiblePrices = [
            row['unit price'], row['Unit Price'], row.Price, row.price,
            row['Retail Price'], row.retail_price, row.cost, row.Cost
          ];
          
          const name = possibleNames.find(n => n && n.trim()) || 'Unknown Product';
          const brand = possibleBrands.find(b => b && b.trim()) || 'Generic';
          const unitPrice = parsePrice(possiblePrices.find(p => p) || 50);
          
          if (name !== 'Unknown Product' && name.trim().length > 0) {
            const productData = {
              name: name.trim(),
              brand: brand.trim(),
              category: supplierInfo.category,
              supplier: supplierInfo.supplier,
              pieceBarcode: row.barcode || row.Barcode || row['Piece Barcode'] || generateBarcode(),
              cartonBarcode: row['carton barcode'] || row['Carton Barcode'] || generateCartonBarcode(),
              retailUOM: row['retail uom'] || row['Retail UOM'] || 'PCS',
              baseUOM: row['base uom'] || row['Base UOM'] || 'CTN',
              unitsPerBase: parseInt(row['units per base'] || row['Units Per Base'] || 12),
              unitPrice: unitPrice,
              cartonPrice: parsePrice(row['carton price'] || row['Carton Price'] || row['Wholesale Price'] || unitPrice * 12),
              orgId: 'default',
              status: 'active'
            };
            
            products.push(productData);
          }
        } catch (error) {
          console.warn(`Error processing row in ${fileName}:`, error.message);
        }
      })
      .on('end', () => {
        console.log(`Processed ${products.length} products from ${fileName}`);
        resolve(products);
      })
      .on('error', reject);
  });
}

// Main function to process all CSVs
async function processAllProducts() {
  try {
    console.log('🚀 Starting product processing...');
    
    const dataDir = path.join(__dirname, '../data');
    const allProducts = [];
    
    // Process each CSV file
    for (const [fileName, supplierInfo] of Object.entries(categorySuppliers)) {
      const filePath = path.join(dataDir, fileName);
      
      if (fs.existsSync(filePath)) {
        try {
          const products = await processProductsFromCSV(filePath, supplierInfo);
          allProducts.push(...products);
        } catch (error) {
          console.error(`❌ Error processing ${fileName}:`, error.message);
        }
      } else {
        console.warn(`⚠️  File not found: ${fileName}`);
      }
    }
    
    // Also process sample-pricelist.csv
    const sampleFile = path.join(dataDir, 'sample-pricelist.csv');
    if (fs.existsSync(sampleFile)) {
      const sampleProducts = await processProductsFromCSV(sampleFile, {
        supplier: 'Sample Supplier',
        category: 'Mixed'
      });
      allProducts.push(...sampleProducts);
    }
    
    console.log(`📦 Total products processed: ${allProducts.length}`);
    
    if (allProducts.length > 0) {
      // Write to JSON file
      const outputFile = path.join(__dirname, '../data/processed-products.json');
      fs.writeFileSync(outputFile, JSON.stringify(allProducts, null, 2));
      
      // Write summary
      const supplierCounts = {};
      const categoryCounts = {};
      
      allProducts.forEach(product => {
        supplierCounts[product.supplier] = (supplierCounts[product.supplier] || 0) + 1;
        categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
      });
      
      console.log('\n📊 Processing Summary:');
      console.log('\n🏪 By Supplier:');
      Object.entries(supplierCounts).forEach(([supplier, count]) => {
        console.log(`  ${supplier}: ${count} products`);
      });
      
      console.log('\n🏷️ By Category:');
      Object.entries(categoryCounts).forEach(([category, count]) => {
        console.log(`  ${category}: ${count} products`);
      });
      
      console.log(`\n✅ Products saved to: ${outputFile}`);
      
      // Create a TypeScript interface file
      const interfaceFile = path.join(__dirname, '../data/products-data.ts');
      const tsContent = `// Auto-generated product data
export interface ProcessedProduct {
  name: string;
  brand: string;
  category: string;
  supplier: string;
  pieceBarcode: string;
  cartonBarcode: string;
  retailUOM: string;
  baseUOM: string;
  unitsPerBase: number;
  unitPrice: number;
  cartonPrice: number;
  orgId: string;
  status: string;
}

export const processedProducts: ProcessedProduct[] = ${JSON.stringify(allProducts, null, 2)};

export const productSuppliers = ${JSON.stringify(Object.keys(supplierCounts), null, 2)};

export const productCategories = ${JSON.stringify(Object.keys(categoryCounts), null, 2)};
`;
      
      fs.writeFileSync(interfaceFile, tsContent);
      console.log(`📝 TypeScript data saved to: ${interfaceFile}`);
      
    } else {
      console.log('⚠️  No products found to process');
    }
    
  } catch (error) {
    console.error('❌ Processing failed:', error);
  }
}

// Run the script
if (require.main === module) {
  processAllProducts();
}

module.exports = {
  processAllProducts,
  processProductsFromCSV,
  categorySuppliers
};