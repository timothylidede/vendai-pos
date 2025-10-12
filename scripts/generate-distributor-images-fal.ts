/**
 * Generate product images for distributor catalogs using FAL.ai
 * 90% cost savings vs Replicate with better quality
 * Uses image-to-image with multiple reference images
 */

import * as path from 'path'
import * as fs from 'fs'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { generateProductImageWithFAL, type FALImageGenerationParams } from '../lib/fal-image-generator'

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment
config({ path: path.join(__dirname, '..', '.env.local') })

// Check required API keys
if (!process.env.FAL_API_KEY) {
  console.error('❌ Missing FAL_API_KEY in environment')
  console.error('Please add FAL_API_KEY to your .env.local file')
  process.exit(1)
}

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

interface DistributorProduct {
  id: number
  code: string
  name: string
  description: string
  price: number
  category: string
  brand: string
  unit: string
  distributorName: string
  image?: string
}

interface GenerationResult {
  productId: string
  productName: string
  success: boolean
  imageUrl?: string
  error?: string
}

// Load products from TypeScript file
async function loadProductsFromFile(distributorId: string): Promise<DistributorProduct[]> {
  const filePath = path.join(process.cwd(), 'data', 'distributors', `${distributorId}-products.ts`)
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Products file not found: ${filePath}`)
    return []
  }

  // Dynamic import
  const module = await import(filePath)
  const products = module[`${distributorId.replace(/-/g, '_')}_products`]
  
  return products || []
}

// Save image URL to Firestore
async function saveImageToFirestore(
  distributorId: string,
  product: DistributorProduct,
  imageUrl: string
): Promise<void> {
  const docRef = db.collection('distributor_images').doc()
  
  await docRef.set({
    distributorId,
    productId: String(product.id),
    productCode: product.code,
    productName: product.name,
    brand: product.brand,
    category: product.category,
    imageUrl,
    generatedAt: new Date().toISOString(),
    model: 'fal-ai/flux-pro/v1.1-ultra'
  })
  
  console.log(`  💾 Saved to Firestore`)
}

// Generate image for a single product
async function generateProductImage(
  distributorId: string,
  product: DistributorProduct,
  orgId: string = 'default'
): Promise<GenerationResult> {
  console.log(`\n📸 Generating image for: ${product.name}`)
  console.log(`   Brand: ${product.brand} | Category: ${product.category}`)
  
  try {
    const params: FALImageGenerationParams = {
      orgId,
      productId: String(product.id),
      name: product.name,
      brand: product.brand,
      category: product.category,
      supplier: distributorId,
      useGoogleRefs: true, // Enable reference image search
      imageSize: 'square_hd' // 1024x1024
    }
    
    const result = await generateProductImageWithFAL(params)
    
    if (result.ok && result.url) {
      console.log(`  ✅ Generated successfully`)
      console.log(`  🔗 URL: ${result.url}`)
      
      // Save to Firestore
      await saveImageToFirestore(distributorId, product, result.url)
      
      return {
        productId: String(product.id),
        productName: product.name,
        success: true,
        imageUrl: result.url
      }
    } else {
      console.error(`  ❌ Generation failed: ${result.error}`)
      return {
        productId: String(product.id),
        productName: product.name,
        success: false,
        error: result.error
      }
    }
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`)
    return {
      productId: String(product.id),
      productName: product.name,
      success: false,
      error: error.message
    }
  }
}

// Process a batch of products
async function processBatch(
  distributorId: string,
  products: DistributorProduct[],
  batchSize: number = 5
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = []
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize)
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} products)`)
    
    const batchResults = await Promise.all(
      batch.map(product => generateProductImage(distributorId, product))
    )
    
    results.push(...batchResults)
    
    // Small delay between batches
    if (i + batchSize < products.length) {
      console.log('\n⏳ Waiting 2s before next batch...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  return results
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const distributorId = args[0] || 'sam-west'
  const limit = parseInt(args[1]) || 50 // Default: process 50 products
  const skipExisting = !args.includes('--regenerate') // Skip products with images by default
  
  console.log('\n' + '='.repeat(70))
  console.log('🎨 FAL.ai Distributor Image Generation')
  console.log('='.repeat(70))
  console.log(`\nDistributor: ${distributorId}`)
  console.log(`Products to process: ${limit}`)
  console.log(`Skip existing: ${skipExisting}`)
  console.log('\nFeatures:')
  console.log('✅ Multiple reference images for better accuracy')
  console.log('✅ Category-specific prompts')
  console.log('✅ Image-to-image for realistic products')
  console.log('✅ 90% cost savings vs Replicate')
  console.log('\n💰 Cost estimate:')
  console.log(`   ${limit} images × $0.003 = $${(limit * 0.003).toFixed(2)} USD`)
  console.log('')
  
  // Load products
  console.log('📦 Loading products...')
  const allProducts = await loadProductsFromFile(distributorId)
  
  if (allProducts.length === 0) {
    console.error('❌ No products found')
    process.exit(1)
  }
  
  console.log(`✅ Loaded ${allProducts.length} products`)
  
  // Filter products
  let productsToProcess = allProducts
  
  if (skipExisting) {
    productsToProcess = allProducts.filter(p => !p.image)
    console.log(`📋 ${productsToProcess.length} products without images`)
  }
  
  // Limit
  productsToProcess = productsToProcess.slice(0, limit)
  
  if (productsToProcess.length === 0) {
    console.log('✅ All products already have images!')
    process.exit(0)
  }
  
  console.log(`\n🚀 Processing ${productsToProcess.length} products...\n`)
  
  // Process products
  const results = await processBatch(distributorId, productsToProcess, 5)
  
  // Summary
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  console.log('\n' + '='.repeat(70))
  console.log('📊 Generation Summary')
  console.log('='.repeat(70))
  console.log(`Total processed: ${results.length}`)
  console.log(`✅ Successful: ${successful}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`\n💰 Actual cost: $${(successful * 0.003).toFixed(2)} USD`)
  
  // Save results to log
  const logPath = path.join(process.cwd(), `distributor-images-${distributorId}-${Date.now()}.json`)
  fs.writeFileSync(logPath, JSON.stringify(results, null, 2))
  console.log(`\n📝 Results saved to: ${logPath}`)
  
  console.log('\n📝 Next steps:')
  console.log('1. Run the extract script again to update product files with new image URLs')
  console.log('2. Check Firestore "distributor_images" collection for generated images')
  console.log('3. Test in the supplier module')
  console.log('\n💡 Usage:')
  console.log('  npm run generate:distributor-images [distributor-id] [limit] [--regenerate]')
  console.log('  Examples:')
  console.log('    npm run generate:distributor-images sam-west 100')
  console.log('    npm run generate:distributor-images mahitaji 50 --regenerate')
}

main().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
