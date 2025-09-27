import { db } from '@/lib/firebase'
import { collection, addDoc, setDoc, doc, writeBatch } from 'firebase/firestore'
import { processedProducts } from '@/data/products-data'
import type { ProcessedProduct } from '@/data/products-data'

export interface ImportProgress {
  currentStep: string
  completed: number
  total: number
  percentage: number
}

export interface ProductRecord {
  id: string
  name: string
  brand?: string
  category: string
  supplier: string
  baseUom: string
  retailUom: string
  unitsPerBase: number
  piecePrice: number
  wholesalePrice?: number
  pieceBarcode?: string
  cartonBarcode?: string
  image?: string
}

// Collections
const POS_PRODUCTS_COL = 'pos_products'
const INVENTORY_COL = 'inventory'

// Get import statistics from existing data
export function getImportStats() {
  const products = processedProducts
  const suppliers = [...new Set(products.map((p: ProcessedProduct) => p.supplier || 'Unknown'))]
  const categories = [...new Set(products.map((p: ProcessedProduct) => p.category || 'Uncategorized'))]
  
  const supplierCounts: Record<string, number> = {}
  const categoryCounts: Record<string, number> = {}
  
  products.forEach((p: ProcessedProduct) => {
    const supplier = p.supplier || 'Unknown'
    const category = p.category || 'Uncategorized'
    
    supplierCounts[supplier] = (supplierCounts[supplier] || 0) + 1
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
  })

  return {
    totalProducts: products.length,
    suppliers,
    categories,
    supplierCounts,
    categoryCounts
  }
}

// Quick import all products from the product data
export async function quickImportProducts(orgId: string, onProgress?: (progress: ImportProgress) => void) {
  const products = processedProducts
  const batch = writeBatch(db)
  let processed = 0
  
  // Process in smaller batches to avoid Firestore limits
  const BATCH_SIZE = 100
  const totalBatches = Math.ceil(products.length / BATCH_SIZE)
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const currentBatch = writeBatch(db)
    const start = batchIndex * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, products.length)
    
    for (let i = start; i < end; i++) {
      const product = products[i]
      
      // Create POS product record
      const posProductRef = doc(collection(db, POS_PRODUCTS_COL))
      const posProduct = {
        name: product.name || 'Unnamed Product',
        brand: product.brand || '',
        category: product.category || 'Uncategorized',
        baseUom: product.baseUOM || 'CTN',
        retailUom: product.retailUOM || 'PCS', 
        unitsPerBase: product.unitsPerBase || 1,
        piecePrice: product.unitPrice || 0,
        cartonPrice: product.cartonPrice,
        pieceBarcode: product.pieceBarcode,
        cartonBarcode: product.cartonBarcode,
        image: undefined,
        supplier: product.supplier || 'Unknown',
        orgId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      currentBatch.set(posProductRef, posProduct)
      
      // Create inventory record with some stock
      const inventoryRef = doc(db, INVENTORY_COL, `${orgId}_${posProductRef.id}`)
      const inventoryRecord = {
        productId: posProductRef.id,
        orgId,
        qtyBase: Math.floor(Math.random() * 20) + 5, // Random stock between 5-24
        qtyLoose: Math.floor(Math.random() * (product.unitsPerBase || 1)),
        unitsPerBase: product.unitsPerBase || 1,
        baseUom: product.baseUOM || 'CTN',
        retailUom: product.retailUOM || 'PCS',
        reorderLevel: 3,
        maxStock: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'system'
      }
      currentBatch.set(inventoryRef, inventoryRecord)
      
      processed++
    }
    
    // Commit the batch
    await currentBatch.commit()
    
    // Report progress
    if (onProgress) {
      onProgress({
        currentStep: `Processing batch ${batchIndex + 1}/${totalBatches}`,
        completed: processed,
        total: products.length,
        percentage: Math.round((processed / products.length) * 100)
      })
    }
  }
  
  console.log(`Successfully imported ${processed} products with inventory`)
  // Mark org inventory as ready
  try {
    const orgSettingsRef = doc(db, 'org_settings', orgId)
    await setDoc(orgSettingsRef, {
      inventory_status: 'ready',
      updatedAt: new Date().toISOString(),
    }, { merge: true })
  } catch (e) {
    console.warn('Failed to update org_settings after import:', e)
  }
  return processed
}

// Import a single product
export async function importSingleProduct(orgId: string, product: ProductRecord) {
  const batch = writeBatch(db)
  
  // Create POS product record
  const posProductRef = doc(collection(db, POS_PRODUCTS_COL))
  const posProduct = {
    name: product.name,
    brand: product.brand || '',
    category: product.category,
    baseUom: product.baseUom,
    retailUom: product.retailUom,
    unitsPerBase: product.unitsPerBase,
    piecePrice: product.piecePrice,
    cartonPrice: product.wholesalePrice,
    pieceBarcode: product.pieceBarcode,
    cartonBarcode: product.cartonBarcode,
    image: product.image,
    supplier: product.supplier,
    orgId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  batch.set(posProductRef, posProduct)
  
  // Create inventory record
  const inventoryRef = doc(db, INVENTORY_COL, `${orgId}_${posProductRef.id}`)
  const inventoryRecord = {
    productId: posProductRef.id,
    orgId,
    qtyBase: 10,
    qtyLoose: 0,
    unitsPerBase: product.unitsPerBase,
    baseUom: product.baseUom,
    retailUom: product.retailUom,
    reorderLevel: 3,
    maxStock: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  }
  batch.set(inventoryRef, inventoryRecord)
  
  await batch.commit()
  return posProductRef.id
}

// Clear all products for an organization
export async function clearProducts(orgId: string) {
  // This would require a cloud function or server-side implementation
  // due to Firestore security rules and batch limitations
  console.warn('clearProducts should be implemented server-side')
}
