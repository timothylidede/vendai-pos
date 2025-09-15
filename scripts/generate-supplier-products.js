#!/usr/bin/env node

/**
 * Supplier Product Data Generator (Node.js Version)
 * Extracts product data from Mahitaji and Sam West pricelists using OpenAI API
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SupplierDataGenerator {
  constructor(apiKey = null) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    });
    this.projectRoot = path.join(__dirname, '..');
    this.dataDir = path.join(this.projectRoot, 'data');
  }

  async extractPdfText(pdfPath) {
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdf(dataBuffer);
      return data.text;
    } catch (error) {
      console.error(`Error reading PDF ${pdfPath}:`, error.message);
      return '';
    }
  }

  cleanText(text) {
    // Remove extra whitespace and normalize
    text = text.replace(/\s+/g, ' ');
    // Remove special characters that might interfere
    text = text.replace(/[^\w\s\.\,\-\(\)\@\#\%\$\&\+\=\:\;]/g, '');
    return text.trim();
  }

  async generateProductsWithLLM(supplierName, pricelistText) {
    const systemPrompt = `You are a data extraction expert specializing in converting supplier pricelists into structured product data for a POS system.

Your task is to analyze the provided pricelist text and extract product information into a standardized JSON format.

For each product, extract:
- id: unique identifier (use format: supplier_initials_001, supplier_initials_002, etc.)
- name: clean product name
- sku: product SKU/code if available, or generate one using format: SUP-CAT-001
- category: product category (e.g., "Beverages", "Snacks", "Personal Care", "Household", etc.)
- unitPrice: price as a number (extract from various price formats)
- inStock: always true (assume all listed products are available)
- minOrderQuantity: reasonable minimum order (default to 1 if not specified)
- leadTime: reasonable lead time (default to "1-2 days" if not specified)

Guidelines:
- Clean up product names (remove excess spacing, formatting artifacts)
- Standardize categories into common retail categories
- Extract prices carefully, handling different formats (KSh, Ksh, numbers only, etc.)
- Generate reasonable SKUs if not provided
- Be conservative with price extraction - if unclear, mark as 0.00
- Limit to maximum 50 most relevant/clear products to avoid overwhelming the system

Return ONLY a valid JSON array of product objects, no additional text or explanations.`;

    const userPrompt = `
Supplier: ${supplierName}
Extract product data from this pricelist:

${pricelistText.substring(0, 15000)}  // Limit text to stay within token limits

Return structured product data as JSON array.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.1
      });

      const content = response.choices[0].message.content.trim();
      
      // Try to find JSON in the response
      const jsonMatch = content.match(/\[.*\]/s);
      if (jsonMatch) {
        const products = JSON.parse(jsonMatch[0]);
        return products;
      } else {
        console.error(`Could not extract JSON from response for ${supplierName}`);
        return [];
      }
    } catch (error) {
      console.error(`Error calling OpenAI API for ${supplierName}:`, error.message);
      return [];
    }
  }

  async processPricelists() {
    const suppliersData = {};

    // Process Mahitaji pricelist
    const mahitajiPdf = path.join(this.dataDir, 'mahitaji pricelist.pdf');
    try {
      await fs.access(mahitajiPdf);
      console.log('Processing Mahitaji pricelist...');
      const text = await this.extractPdfText(mahitajiPdf);
      const cleanText = this.cleanText(text);
      const products = await this.generateProductsWithLLM('Mahitaji Enterprises Ltd', cleanText);
      suppliersData.mahitaji = products;
      console.log(`Extracted ${products.length} products from Mahitaji pricelist`);
    } catch (error) {
      console.log('Mahitaji pricelist not found');
    }

    // Process Sam West pricelist
    const samwestPdf = path.join(this.dataDir, 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2).pdf');
    try {
      await fs.access(samwestPdf);
      console.log('Processing Sam West pricelist...');
      const text = await this.extractPdfText(samwestPdf);
      const cleanText = this.cleanText(text);
      const products = await this.generateProductsWithLLM('Sam West Distributors', cleanText);
      suppliersData.samwest = products;
      console.log(`Extracted ${products.length} products from Sam West pricelist`);
    } catch (error) {
      console.log('Sam West pricelist not found');
    }

    return suppliersData;
  }

  async saveProductsJson(suppliersData) {
    const outputDir = path.join(this.projectRoot, 'data', 'generated');
    
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Save individual supplier files
    for (const [supplier, products] of Object.entries(suppliersData)) {
      const outputFile = path.join(outputDir, `${supplier}_products.json`);
      await fs.writeFile(outputFile, JSON.stringify(products, null, 2), 'utf-8');
      console.log(`Saved ${products.length} products to ${outputFile}`);
    }

    // Save combined file
    const combinedFile = path.join(outputDir, 'all_suppliers_products.json');
    await fs.writeFile(combinedFile, JSON.stringify(suppliersData, null, 2), 'utf-8');
    console.log(`Saved combined data to ${combinedFile}`);
  }

  async updateSupplierModule(suppliersData) {
    const supplierModulePath = path.join(this.projectRoot, 'components', 'modules', 'supplier-module.tsx');
    
    try {
      const content = await fs.readFile(supplierModulePath, 'utf-8');
      
      // Generate TypeScript supplier objects
      const tsSuppliers = this.generateTypescriptSuppliers(suppliersData);
      
      // Find and replace the suppliers data
      const pattern = /const suppliers: Supplier\[\] = \[.*?\]/s;
      
      if (pattern.test(content)) {
        const newContent = content.replace(
          pattern,
          `const suppliers: Supplier[] = [\n${tsSuppliers}\n  ]`
        );
        
        // Create backup
        const backupPath = supplierModulePath + '.backup';
        await fs.writeFile(backupPath, content, 'utf-8');
        
        // Write updated file
        await fs.writeFile(supplierModulePath, newContent, 'utf-8');
        
        console.log('Updated supplier module with new product data');
        console.log(`Backup saved to ${backupPath}`);
      } else {
        console.log('Could not find suppliers array in module file');
      }
    } catch (error) {
      console.error('Error updating supplier module:', error.message);
    }
  }

  generateTypescriptSuppliers(suppliersData) {
    const suppliersTs = [];

    // Mahitaji supplier
    if (suppliersData.mahitaji) {
      const productsJson = JSON.stringify(suppliersData.mahitaji, null, 6);
      const mahitajiSupplier = `    {
      id: "mahitaji_enterprises",
      name: "Mahitaji Enterprises Ltd",
      contact: {
        email: "info@mahitaji.co.ke",
        phone: "+254 700 123 456",
        address: "Nairobi, Kenya"
      },
      paymentTerms: "Net 30",
      creditLimit: 2000000,
      currentCredit: 850000,
      accountBalance: -150000,
      products: ${productsJson.replace(/    /g, '      ')}
    }`;
      suppliersTs.push(mahitajiSupplier);
    }

    // Sam West supplier
    if (suppliersData.samwest) {
      const productsJson = JSON.stringify(suppliersData.samwest, null, 6);
      const samwestSupplier = `    {
      id: "sam_west_distributors",
      name: "Sam West Distributors", 
      contact: {
        email: "orders@samwest.co.ke",
        phone: "+254 722 345 678",
        address: "Mombasa, Kenya"
      },
      paymentTerms: "Net 15",
      creditLimit: 1500000,
      currentCredit: 650000,
      accountBalance: 25000,
      products: ${productsJson.replace(/    /g, '      ')}
    }`;
      suppliersTs.push(samwestSupplier);
    }

    return suppliersTs.join(',\n');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apiKeyIndex = args.indexOf('--api-key');
  const outputOnlyIndex = args.indexOf('--output-only');
  
  const apiKey = apiKeyIndex !== -1 ? args[apiKeyIndex + 1] : null;
  const outputOnly = outputOnlyIndex !== -1;
  
  // Check for API key
  const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
  if (!finalApiKey) {
    console.error('Error: OpenAI API key required. Set OPENAI_API_KEY environment variable or use --api-key');
    process.exit(1);
  }
  
  // Initialize generator
  const generator = new SupplierDataGenerator(finalApiKey);
  
  console.log('Starting supplier data generation...');
  console.log('='.repeat(50));
  
  // Process pricelists
  const suppliersData = await generator.processPricelists();
  
  if (Object.keys(suppliersData).length === 0) {
    console.log('No data extracted from pricelists');
    return;
  }
  
  // Save JSON files
  await generator.saveProductsJson(suppliersData);
  
  // Update module unless output-only is specified
  if (!outputOnly) {
    console.log('\nUpdating supplier module...');
    await generator.updateSupplierModule(suppliersData);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Generation complete!');
  
  // Print summary
  const totalProducts = Object.values(suppliersData).reduce((sum, products) => sum + products.length, 0);
  console.log(`Total products processed: ${totalProducts}`);
  for (const [supplier, products] of Object.entries(suppliersData)) {
    console.log(`  ${supplier}: ${products.length} products`);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}

export default SupplierDataGenerator;