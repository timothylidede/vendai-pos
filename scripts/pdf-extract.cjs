/**
 * Advanced PDF Product Extraction using OpenAI
 * Extracts comprehensive product data from Sam West and Mahitaji PDF price lists
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const OpenAI = require('openai');

// Initialize OpenAI - you'll need to set your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here'
});

// Supplier configurations
const supplierConfigs = {
  'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2).pdf': {
    supplier: 'Sam West Supermarket',
    location: 'Kenya',
    extractionPrompt: `
Extract ALL products from this Sam West Supermarket price list. Be extremely thorough and meticulous.

For each product, extract:
1. Product Name (full name as shown)
2. Brand (if mentioned separately)
3. Category (infer from product type: Beverages, Food, Household, etc.)
4. Size/Weight (e.g., 500ml, 2kg, 250g)
5. Unit Price (in KSh)
6. Wholesale/Carton Price (if available)
7. Units per Carton (if mentioned)

Format as JSON array with this exact structure:
[
  {
    "name": "Product Name with Size",
    "brand": "Brand Name",
    "category": "Category",
    "size": "500ml",
    "unitPrice": 80,
    "cartonPrice": 1920,
    "unitsPerCarton": 24,
    "supplier": "Sam West Supermarket"
  }
]

Extract EVERY SINGLE product listed. Don't skip any items. Be meticulous.
    `
  },
  'mahitaji pricelist.pdf': {
    supplier: 'Mahitaji Distributors',
    location: 'Kenya',
    extractionPrompt: `
Extract ALL products from this Mahitaji Distributors price list. This PDF has many pages - extract from ALL pages diligently.

For each product, extract:
1. Product Name (complete name)
2. Brand (if specified)
3. Category (Food, Personal Care, Household, etc.)
4. Size/Weight/Volume
5. Unit Price (in KSh)
6. Carton/Wholesale Price (if available)
7. Units per Package

Format as JSON array:
[
  {
    "name": "Complete Product Name",
    "brand": "Brand",
    "category": "Category",
    "size": "Size",
    "unitPrice": 0,
    "cartonPrice": 0,
    "unitsPerCarton": 12,
    "supplier": "Mahitaji Distributors"
  }
]

BE EXTREMELY THOROUGH - extract every product from every page. Don't miss anything.
This is critical for a comprehensive product database.
    `
  }
};

// Function to extract text from PDF
async function extractTextFromPDF(filePath) {
  try {
    console.log(`📖 Reading PDF: ${path.basename(filePath)}`);
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    
    console.log(`📄 Extracted ${data.numpages} pages, ${data.text.length} characters`);
    return {
      text: data.text,
      pages: data.numpages,
      metadata: data.metadata
    };
  } catch (error) {
    console.error(`❌ Error reading PDF ${filePath}:`, error.message);
    throw error;
  }
}

// Function to chunk text for OpenAI processing
function chunkText(text, maxChunkSize = 12000) {
  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk += '\n' + line;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Function to extract products using OpenAI
async function extractProductsWithOpenAI(text, config, chunkIndex = 0, totalChunks = 1) {
  try {
    console.log(`🤖 Processing chunk ${chunkIndex + 1}/${totalChunks} for ${config.supplier}...`);
    
    const systemPrompt = `You are an expert data extraction specialist for retail inventory systems. Your task is to extract ALL product information from price list documents with 100% accuracy and completeness.

CRITICAL REQUIREMENTS:
1. Extract EVERY SINGLE product mentioned
2. Don't skip or miss any items
3. Be extremely detailed and thorough
4. Maintain consistent formatting
5. Infer missing information logically
6. Handle various price list formats

Common categories to use: Beverages, Food Items, Household Items, Personal Care, Cleaning Products, Snacks, Dairy Products, etc.`;

    const userPrompt = `${config.extractionPrompt}

TEXT TO PROCESS:
${text}

Remember: Extract EVERY product. Be comprehensive and thorough.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    const extractedText = response.choices[0].message.content.trim();
    
    // Try to parse as JSON
    try {
      // Extract JSON from the response (handle cases where there's extra text)
      const jsonMatch = extractedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const products = JSON.parse(jsonMatch[0]);
        console.log(`✅ Extracted ${products.length} products from chunk ${chunkIndex + 1}`);
        return products;
      } else {
        throw new Error('No valid JSON array found in response');
      }
    } catch (parseError) {
      console.warn(`⚠️ JSON parsing failed for chunk ${chunkIndex + 1}, trying to fix format...`);
      
      // Try a second attempt with format correction
      const fixResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'Convert the following product data to a proper JSON array format.' },
          { role: 'user', content: `Fix this data to proper JSON array format:\n\n${extractedText}` }
        ],
        temperature: 0,
        max_tokens: 4000
      });

      const fixedText = fixResponse.choices[0].message.content.trim();
      const fixedJsonMatch = fixedText.match(/\[[\s\S]*\]/);
      
      if (fixedJsonMatch) {
        const products = JSON.parse(fixedJsonMatch[0]);
        console.log(`✅ Fixed and extracted ${products.length} products from chunk ${chunkIndex + 1}`);
        return products;
      }
      
      throw new Error(`Could not parse products from chunk ${chunkIndex + 1}`);
    }
    
  } catch (error) {
    console.error(`❌ OpenAI extraction failed for chunk ${chunkIndex + 1}:`, error.message);
    return [];
  }
}

// Function to process a single PDF
async function processPDF(pdfPath, config) {
  try {
    console.log(`\n🚀 Processing ${config.supplier} price list...`);
    
    // Extract text from PDF
    const pdfData = await extractTextFromPDF(pdfPath);
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
      console.warn(`⚠️ OpenAI API key not set. Please set OPENAI_API_KEY environment variable.`);
      
      // Save extracted text for manual processing
      const textFile = pdfPath.replace('.pdf', '_extracted_text.txt');
      fs.writeFileSync(textFile, pdfData.text);
      console.log(`📄 Raw text saved to: ${textFile}`);
      console.log(`You can manually process this text or set up OpenAI API key for automatic extraction.`);
      
      return [];
    }
    
    // Chunk the text for processing
    const chunks = chunkText(pdfData.text);
    console.log(`📝 Split into ${chunks.length} chunks for processing`);
    
    let allProducts = [];
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunkProducts = await extractProductsWithOpenAI(chunks[i], config, i, chunks.length);
        allProducts.push(...chunkProducts);
        
        // Add delay to respect API rate limits
        if (i < chunks.length - 1) {
          console.log('⏳ Waiting 2 seconds before next chunk...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (chunkError) {
        console.error(`❌ Failed to process chunk ${i + 1}:`, chunkError.message);
      }
    }
    
    // Clean and validate products
    const cleanedProducts = allProducts.map(product => ({
      name: product.name || 'Unknown Product',
      brand: product.brand || 'Generic',
      category: product.category || 'General',
      size: product.size || '',
      unitPrice: parseFloat(product.unitPrice) || 0,
      cartonPrice: parseFloat(product.cartonPrice) || parseFloat(product.unitPrice) * 12 || 0,
      unitsPerCarton: parseInt(product.unitsPerCarton) || 12,
      supplier: config.supplier,
      pieceBarcode: generateBarcode(),
      cartonBarcode: generateCartonBarcode(),
      retailUOM: 'PCS',
      baseUOM: 'CTN',
      orgId: 'default',
      status: 'active'
    })).filter(product => product.name !== 'Unknown Product');
    
    console.log(`✅ Successfully extracted ${cleanedProducts.length} products from ${config.supplier}`);
    return cleanedProducts;
    
  } catch (error) {
    console.error(`❌ Failed to process PDF for ${config.supplier}:`, error.message);
    return [];
  }
}

// Utility functions
function generateBarcode() {
  return Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
}

function generateCartonBarcode() {
  return Math.floor(2000000000000 + Math.random() * 8000000000000).toString();
}

// Main extraction function
async function extractAllPDFProducts() {
  try {
    console.log('🎯 Starting comprehensive PDF product extraction...');
    console.log('This process will extract ALL products from both price lists meticulously.\n');
    
    const dataDir = path.join(__dirname, '../data');
    const allProducts = [];
    
    for (const [filename, config] of Object.entries(supplierConfigs)) {
      const pdfPath = path.join(dataDir, filename);
      
      if (fs.existsSync(pdfPath)) {
        const products = await processPDF(pdfPath, config);
        allProducts.push(...products);
      } else {
        console.warn(`⚠️ PDF file not found: ${filename}`);
      }
    }
    
    if (allProducts.length > 0) {
      // Save all extracted products
      const outputFile = path.join(__dirname, '../data/pdf-extracted-products.json');
      fs.writeFileSync(outputFile, JSON.stringify(allProducts, null, 2));
      
      // Create TypeScript data file
      const tsFile = path.join(__dirname, '../data/pdf-products-data.ts');
      const tsContent = `// Auto-extracted from PDF price lists using OpenAI
export interface PDFProduct {
  name: string;
  brand: string;
  category: string;
  size: string;
  unitPrice: number;
  cartonPrice: number;
  unitsPerCarton: number;
  supplier: string;
  pieceBarcode: string;
  cartonBarcode: string;
  retailUOM: string;
  baseUOM: string;
  orgId: string;
  status: string;
}

export const pdfExtractedProducts: PDFProduct[] = ${JSON.stringify(allProducts, null, 2)};

export const supplierStats = {
  "Sam West Supermarket": ${allProducts.filter(p => p.supplier === 'Sam West Supermarket').length},
  "Mahitaji Distributors": ${allProducts.filter(p => p.supplier === 'Mahitaji Distributors').length}
};
`;
      
      fs.writeFileSync(tsFile, tsContent);
      
      // Print comprehensive summary
      console.log('\n🎉 EXTRACTION COMPLETE! 🎉');
      console.log('================================');
      console.log(`📦 Total Products Extracted: ${allProducts.length}`);
      
      const supplierBreakdown = {};
      const categoryBreakdown = {};
      
      allProducts.forEach(product => {
        supplierBreakdown[product.supplier] = (supplierBreakdown[product.supplier] || 0) + 1;
        categoryBreakdown[product.category] = (categoryBreakdown[product.category] || 0) + 1;
      });
      
      console.log('\n🏪 By Supplier:');
      Object.entries(supplierBreakdown).forEach(([supplier, count]) => {
        console.log(`  📋 ${supplier}: ${count} products`);
      });
      
      console.log('\n🏷️ By Category:');
      Object.entries(categoryBreakdown).forEach(([category, count]) => {
        console.log(`  📂 ${category}: ${count} products`);
      });
      
      console.log(`\n💾 Files created:`);
      console.log(`  📄 JSON: ${outputFile}`);
      console.log(`  📝 TypeScript: ${tsFile}`);
      
      console.log(`\n🚀 Ready to import to Firebase!`);
      
    } else {
      console.log('⚠️ No products extracted. Check API key and PDF files.');
    }
    
  } catch (error) {
    console.error('❌ Extraction process failed:', error);
  }
}

// Instructions for setting up OpenAI API key
function showSetupInstructions() {
  console.log(`
📋 SETUP INSTRUCTIONS:

1. Get OpenAI API Key:
   - Go to https://platform.openai.com/api-keys
   - Create a new API key
   - Copy the key

2. Set Environment Variable:
   
   Windows (PowerShell):
   $env:OPENAI_API_KEY="your-actual-api-key-here"
   
   Windows (Command Prompt):
   set OPENAI_API_KEY=your-actual-api-key-here
   
   Or create a .env file with:
   OPENAI_API_KEY=your-actual-api-key-here

3. Run the extraction:
   node scripts/pdf-extract.cjs

💡 This will extract ALL products from both PDF price lists comprehensively.
`);
}

// CLI interface
if (require.main === module) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
    showSetupInstructions();
    
    // Still try to extract text for manual processing
    console.log('\n🔄 Extracting text without OpenAI for manual review...\n');
    extractAllPDFProducts();
  } else {
    extractAllPDFProducts();
  }
}

module.exports = {
  extractAllPDFProducts,
  processPDF,
  extractTextFromPDF,
  supplierConfigs
};