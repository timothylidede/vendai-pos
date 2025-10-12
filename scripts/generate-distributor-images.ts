/**
 * Generate product images for distributor catalogs using Google Image Search + FAL.ai
 * Uses FAL.ai FLUX image-to-image for 90% cost savings vs Replicate
 * 
 * Requirements:
 * - FAL_API_KEY in environment
 * - GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX for Google Custom Search
 * - Firebase configuration
 */

import * as fal from '@fal-ai/serverless-client'
import * as path from 'path'
import * as fs from 'fs'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment
config({ path: path.join(__dirname, '..', '.env.local') })

// Check required API keys
if (!process.env.FAL_API_KEY) {
  console.error('❌ Missing FAL_API_KEY in environment. Aborting.')
  console.error('Please add FAL_API_KEY to your .env.local file')
  process.exit(1)
}

// Configure FAL.ai client
fal.config({
  credentials: process.env.FAL_API_KEY
})

// Initialize Firebase Admin
try {
  const adminConfig: any = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vendai-fa58c',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vendai-fa58c.firebasestorage.app',
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    adminConfig.credential = cert(serviceAccount)
  }

  initializeApp(adminConfig)
  console.log('✅ Firebase initialized')
} catch (error: any) {
  console.error('❌ Firebase init error:', error.message)
  process.exit(1)
}

const db = getFirestore()
const storage = getStorage()

// Configuration
const BATCH_SIZE = 10 // Process 10 products at a time
const LOG_FILE = path.join(process.cwd(), 'distributor-image-generation.log')

// API Keys
const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX || process.env.NEXT_PUBLIC_CX

interface ImageGenerationResult {
  distributorId: string
  distributorName: string
  productId: string
  productName: string
  imageUrl: string
  status: 'success' | 'failed' | 'skipped'
  error?: string
  referenceImages?: string[]
}

// Ensure output directory exists
function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`✓ Created directory: ${dirPath}`)
  }
}

// Build prompt (same style as inventory) but enriched with product metadata
function buildPrompt(product: DistributorProduct): string {
  const details = [
    `Product name: ${product.name}`,
    product.brand && `Brand: ${product.brand}`,
    product.description && `Description: ${product.description}`,
    product.category && `Category: ${product.category}`,
    product.unit && `Packaging: ${product.unit}`
  ].filter(Boolean).join('. ')

  return [
    `Photorealistic product photo using the supplied reference image. Output a single centered ${product.category || 'consumer'} product placed on a brown mahogany wooden shelf with visible wood grain.`,
    `Lighting: warm, studio-quality, 'precious' accent lighting from top-left creating soft highlights and gentle shadows. Background color: ${THEME_BG_HEX}. Camera: 50mm, slight 10° angle, product fully visible, no additional props.`,
    `Keep product proportions, label artwork, and packaging structure faithful to the real SKU. Make every brand mark and label text sharp and legible. Ensure consistent composition across all SKUs: product centered, same distance from camera, shelf visible across bottom third of frame. High detail, 1024x1024 JPEG output.`,
    `Product details: ${details}.`
  ].join(' ')
}

// Google CSE Image Search
async function searchReferenceImages(query: string, topN: number = 5): Promise<string[]> {
  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_CX) {
    console.warn('⚠️  GOOGLE_CSE_API_KEY/GOOGLE_CSE_CX not set. Skipping image search.')
    return []
  }
  
  try {
    const params = new URLSearchParams({
      key: GOOGLE_CSE_API_KEY,
      cx: GOOGLE_CSE_CX,
      q: query,
      searchType: 'image',
      num: String(Math.min(10, Math.max(1, topN))),
      safe: 'active',
    })
    
    const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`
    const res = await fetch(url)
    
    if (!res.ok) {
      const txt = await res.text()
      console.warn('⚠️  Google CSE request failed:', res.status, txt)
      return []
    }
    
    const json = await res.json()
    const items = json.items || []
    return items.map((item: any) => item.link).filter(Boolean).slice(0, topN)
  } catch (error) {
    console.warn('⚠️  Google CSE error:', error)
    return []
  }
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Log results to file
function logResults(results: ImageGenerationResult[]) {
  const timestamp = new Date().toISOString()
  const logContent = `
===========================================
Distributor Image Generation Log
Generated: ${timestamp}
===========================================

Summary:
- Total Distributors: ${getAllDistributors().length}
- Total Products Processed: ${results.length}
- Successful: ${results.filter(r => r.status === 'success').length}
- Failed: ${results.filter(r => r.status === 'failed').length}
- Skipped: ${results.filter(r => r.status === 'skipped').length}

Detailed Results:
${results.map(r => `
  ${r.status.toUpperCase()}: ${r.distributorName} - ${r.productName}
  Product ID: ${r.productId}
  Image URL: ${r.imageUrl}
  ${r.error ? `Error: ${r.error}` : ''}
`).join('\n')}

===========================================
`
  
  fs.writeFileSync(LOG_FILE, logContent, 'utf-8')
  console.log(`\n✓ Log saved to: ${LOG_FILE}`)
}

// Generate product image using Replicate (same as inventory workflow)
async function generateProductImage(
  distributor: any,
  product: DistributorProduct
): Promise<ImageGenerationResult> {
  const distributorId = distributor.id
  const distributorName = distributor.displayName
  const productIdStr: string = String(product.id)
  
  try {
    console.log(`  → Generating image for: ${product.name}`)
    
    // Step 1: Search for reference images
    const searchQueryParts = [product.brand, product.name, product.unit, product.category]
      .filter(Boolean)
      .map(part => String(part))
    const searchQuery = `${searchQueryParts.join(' ')} product photo`.trim()
    console.log(`    🔍 Searching: "${searchQuery}"`)
    const refImages = await searchReferenceImages(searchQuery, 5)
    console.log(`    Found ${refImages.length} reference images`)
    
    if (refImages.length === 0) {
      console.warn(`    ⚠️  No reference images found, skipping`)
      return {
        distributorId,
        distributorName,
        productId: productIdStr,
        productName: product.name,
        imageUrl: '',
        status: 'skipped',
        error: 'No reference images found'
      }
    }
    
    // Step 2: Generate image with Replicate using first reference
  const prompt = buildPrompt(product)
    console.log(`    🎨 Generating with Replicate (${MODEL})`)
    
    const input: any = {
      prompt: prompt,
      image: refImages[0], // Use first reference image
      strength: STRENGTH,
      num_inference_steps: 25,
      guidance_scale: 7.5,
    }
    
    const output = await replicate.run(MODEL, { input })
    
    // Handle different output formats
    let imageUrl: string
    if (Array.isArray(output) && output.length > 0) {
      imageUrl = output[0]
    } else if (typeof output === 'string') {
      imageUrl = output
    } else if (output && typeof output === 'object' && 'output' in output) {
      const o = (output as any).output
      imageUrl = Array.isArray(o) ? o[0] : o
    } else {
      throw new Error('Unexpected output format from Replicate')
    }
    
    console.log(`    ✓ Generated: ${imageUrl}`)
    
    // Step 3: Download and save image
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`)
    }
    
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    const outputDir = path.join(IMAGE_OUTPUT_DIR, distributorId)
    ensureDirectoryExists(outputDir)
    
    const outputPath = path.join(outputDir, `${product.id}.jpg`)
    fs.writeFileSync(outputPath, imageBuffer)
    
    const publicUrl = `/images/distributors/products/${distributorId}/${product.id}.jpg`
    console.log(`    💾 Saved: ${publicUrl}`)
    
    return {
      distributorId,
      distributorName,
      productId: productIdStr,
      productName: product.name,
      imageUrl: publicUrl,
      status: 'success',
      referenceImages: refImages
    }
  } catch (error) {
    console.error(`    ✗ Failed: ${error}`)
    return {
      distributorId,
      distributorName,
      productId: productIdStr,
      productName: product.name,
      imageUrl: '',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Main execution
async function main() {
  console.log('\n===========================================')
  console.log('Distributor Product Image Generation')
  console.log('===========================================\n')
  
  // Ensure output directory exists
  ensureDirectoryExists(IMAGE_OUTPUT_DIR)
  
  const distributors = getAllDistributors()
  const results: ImageGenerationResult[] = []
  
  console.log(`Found ${distributors.length} distributors\n`)
  
  for (const distributor of distributors) {
    console.log(`\n📦 Processing: ${distributor.displayName}`)
    console.log(`   ID: ${distributor.id}`)
    
    const products = distributorProducts[distributor.id] || []
    const productsToProcess = products.slice(0, PRODUCTS_PER_DISTRIBUTOR)
    
    console.log(`   Products: ${productsToProcess.length} of ${products.length} total\n`)
    
    for (const product of productsToProcess) {
      const result = await generateProductImage(distributor, product)
      results.push(result)
    }
  }
  
  // Generate summary
  console.log('\n===========================================')
  console.log('Generation Complete!')
  console.log('===========================================')
  console.log(`Total Products: ${results.length}`)
  console.log(`✓ Success: ${results.filter(r => r.status === 'success').length}`)
  console.log(`✗ Failed: ${results.filter(r => r.status === 'failed').length}`)
  console.log(`⊘ Skipped: ${results.filter(r => r.status === 'skipped').length}`)
  
  // Save log file
  logResults(results)
  
  console.log('\n📝 Next Steps:')
  console.log('1. Update distributor-data.ts with imageUrl for each product')
  console.log('2. Run actual image generation API (OpenAI DALL-E, etc.)')
  console.log('3. Download and save images to public/images/distributors/products/')
  console.log('4. Update product data with real image URLs\n')
}

// Run the script
main().catch(console.error)
