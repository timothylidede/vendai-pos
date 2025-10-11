/**
 * Count products from distributor pricelists
 * Usage: npx tsx scripts/count-distributor-products.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ProductCount {
  distributor: string;
  file: string;
  lineCount: number;
  estimatedProducts: number;
}

function countProductsFromText(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  // Heuristic: Count lines that look like product entries
  // Typically have format: number, product name, price
  const productLines = lines.filter(line => {
    const trimmed = line.trim();
    // Skip headers, totals, page numbers, etc.
    if (trimmed.length < 10) return false;
    if (/^(page|total|subtotal|grand|category|section)/i.test(trimmed)) return false;
    if (/^-+$/.test(trimmed)) return false;
    
    // Look for price patterns (KES, numbers, etc.)
    return /\d+(\.\d+)?/.test(trimmed) && trimmed.length > 15;
  });
  
  return productLines.length;
}

function main() {
  const dataDir = path.join(process.cwd(), 'data');
  
  const distributors = [
    {
      name: 'Sam West Supermarket',
      textFile: 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2)_extracted_text.txt',
      pdfFile: 'SAM WEST SUPERMARKET PRICELIST_20250726_094811 (2).pdf'
    },
    {
      name: 'Mahitaji',
      textFile: 'mahitaji pricelist_extracted_text.txt',
      pdfFile: 'mahitaji pricelist.pdf'
    }
  ];
  
  const results: ProductCount[] = [];
  let totalProducts = 0;
  
  console.log('📊 Counting products from distributor pricelists...\n');
  
  for (const dist of distributors) {
    const textPath = path.join(dataDir, dist.textFile);
    
    if (!fs.existsSync(textPath)) {
      console.error(`❌ File not found: ${textPath}`);
      continue;
    }
    
    const content = fs.readFileSync(textPath, 'utf-8');
    const totalLines = content.split('\n').length;
    const productCount = countProductsFromText(textPath);
    
    results.push({
      distributor: dist.name,
      file: dist.textFile,
      lineCount: totalLines,
      estimatedProducts: productCount
    });
    
    totalProducts += productCount;
    
    console.log(`📦 ${dist.name}`);
    console.log(`   File: ${dist.textFile}`);
    console.log(`   Total lines: ${totalLines.toLocaleString()}`);
    console.log(`   Estimated products: ${productCount.toLocaleString()}`);
    console.log('');
  }
  
  console.log('═'.repeat(50));
  console.log(`🎯 TOTAL PRODUCTS: ${totalProducts.toLocaleString()}`);
  console.log('═'.repeat(50));
  console.log('');
  
  // Calculate image generation costs
  console.log('💰 Image Generation Cost Analysis:\n');
  
  const models = [
    { name: 'Cloudflare Workers AI (SDXL)', cost: 0.0001 },
    { name: 'Replicate SDXL', cost: 0.003 },
    { name: 'FAL.ai FLUX schnell', cost: 0.003 },
    { name: 'Together.ai FLUX schnell', cost: 0.003 },
    { name: 'Replicate FLUX dev', cost: 0.03 },
    { name: 'OpenAI DALL-E 3 (standard)', cost: 0.04 },
    { name: 'OpenAI DALL-E 3 (HD)', cost: 0.08 }
  ];
  
  console.log(`For ${totalProducts.toLocaleString()} products:\n`);
  
  models.forEach(model => {
    const totalCost = totalProducts * model.cost;
    console.log(`${model.name.padEnd(40)} $${totalCost.toFixed(2).padStart(8)} (${model.cost}/img)`);
  });
  
  console.log('\n');
  
  // Save results
  const outputPath = path.join(dataDir, 'product-count-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    distributors: results,
    totalProducts,
    costAnalysis: models.map(m => ({
      ...m,
      totalCost: totalProducts * m.cost
    }))
  }, null, 2));
  
  console.log(`✅ Analysis saved to: ${outputPath}\n`);
}

main();
