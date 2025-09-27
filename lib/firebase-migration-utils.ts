/**
 * Firebase Architecture Migration Guide
 * 
 * This file provides step-by-step instructions for migrating from the legacy
 * flat Firestore structure to the optimized hierarchical structure.
 */

import { doc, getDoc, setDoc, collection, getDocs, writeBatch, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Migration status tracking
export interface MigrationStatus {
  organizationId: string
  status: 'not_started' | 'in_progress' | 'completed' | 'error'
  migratedProducts: number
  migratedOrders: number
  totalProducts: number
  totalOrders: number
  startedAt?: Date
  completedAt?: Date
  error?: string
}

/**
 * Step 1: Check if an organization needs migration
 */
export async function checkMigrationStatus(orgId: string): Promise<MigrationStatus> {
  try {
    const statusDoc = await getDoc(doc(db, 'migration_status', orgId))
    
    if (statusDoc.exists()) {
      return statusDoc.data() as MigrationStatus
    }
    
    // Check if org has any data in legacy structure
    const legacyProductsQuery = query(collection(db, 'pos_products'), where('orgId', '==', orgId))
    const legacyProductsSnap = await getDocs(legacyProductsQuery)
    
    const legacyOrdersQuery = query(collection(db, 'pos_orders'), where('orgId', '==', orgId))
    const legacyOrdersSnap = await getDocs(legacyOrdersQuery)
    
    if (legacyProductsSnap.empty && legacyOrdersSnap.empty) {
      return {
        organizationId: orgId,
        status: 'completed',
        migratedProducts: 0,
        migratedOrders: 0,
        totalProducts: 0,
        totalOrders: 0
      }
    }
    
    return {
      organizationId: orgId,
      status: 'not_started',
      migratedProducts: 0,
      migratedOrders: 0,
      totalProducts: legacyProductsSnap.size,
      totalOrders: legacyOrdersSnap.size
    }
    
  } catch (error) {
    console.error('Error checking migration status:', error)
    return {
      organizationId: orgId,
      status: 'error',
      migratedProducts: 0,
      migratedOrders: 0,
      totalProducts: 0,
      totalOrders: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Step 2: Create organization document with basic info
 */
export async function createOrganizationDocument(orgId: string, orgData: {
  name: string
  type: 'distributor' | 'retailer'
  contactInfo?: any
  settings?: any
}) {
  try {
    const orgRef = doc(db, 'organizations', orgId)
    await setDoc(orgRef, {
      ...orgData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      migrationStatus: 'in_progress'
    })
    
    console.log(`✅ Created organization document for ${orgId}`)
    return true
  } catch (error) {
    console.error('Error creating organization document:', error)
    return false
  }
}

/**
 * Step 3: Migrate products to hierarchical structure
 */
export async function migrateProducts(orgId: string): Promise<{ success: boolean; migratedCount: number }> {
  let migratedCount = 0
  
  try {
    // Get all products for this organization
    const productsQuery = query(collection(db, 'pos_products'), where('orgId', '==', orgId))
    const productsSnapshot = await getDocs(productsQuery)
    
    if (productsSnapshot.empty) {
      console.log(`No products to migrate for org ${orgId}`)
      return { success: true, migratedCount: 0 }
    }
    
    // Process in batches of 500 (Firestore limit)
    const batch = writeBatch(db)
    let batchCount = 0
    
    for (const productDoc of productsSnapshot.docs) {
      const productData = productDoc.data()
      
      // Transform to new hierarchical structure
      const optimizedProduct = {
        name: productData.name,
        brand: productData.brand || '',
        category: productData.category || 'General',
        description: productData.description || '',
        image: productData.image || '',
        
        // Structured barcodes
        barcodes: {
          piece: productData.pieceBarcode || '',
          carton: productData.cartonBarcode || '',
          sku: productData.sku || ''
        },
        
        // Structured pricing
        pricing: {
          retail: productData.piecePrice || productData.price || 0,
          wholesale: productData.cartonPrice || productData.wholesalePrice,
          cost: productData.cost || 0,
          margin: productData.margin || 0
        },
        
        // Structured stock (migrate from inventory if exists)
        stock: {
          qtyBase: 0,  // Will be populated from inventory
          qtyLoose: 0,
          unitsPerBase: productData.unitsPerBase || productData.wholesaleQuantity || 1,
          reorderLevel: productData.reorderLevel || 10,
          available: 0,
          lastUpdated: new Date().toISOString()
        },
        
        // Metadata
        supplier: productData.supplier || '',
        tags: productData.tags || [],
        isActive: productData.isActive !== false,
        createdAt: productData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // Check if inventory exists for this product
      try {
        const inventoryDoc = await getDoc(doc(db, 'inventory', `${orgId}_${productDoc.id}`))
        if (inventoryDoc.exists()) {
          const inventoryData = inventoryDoc.data()
          optimizedProduct.stock = {
            ...optimizedProduct.stock,
            qtyBase: inventoryData.qtyBase || 0,
            qtyLoose: inventoryData.qtyLoose || 0,
            available: ((inventoryData.qtyBase || 0) * optimizedProduct.stock.unitsPerBase) + (inventoryData.qtyLoose || 0)
          }
        }
      } catch (invError) {
        console.warn(`Could not find inventory for product ${productDoc.id}:`, invError)
      }
      
      // Add to new hierarchical structure
      const newProductRef = doc(db, 'organizations', orgId, 'products', productDoc.id)
      batch.set(newProductRef, optimizedProduct)
      
      batchCount++
      migratedCount++
      
      // Commit batch when it reaches 500 operations
      if (batchCount >= 500) {
        await batch.commit()
        console.log(`✅ Migrated batch of ${batchCount} products for org ${orgId}`)
        batchCount = 0
      }
    }
    
    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit()
      console.log(`✅ Migrated final batch of ${batchCount} products for org ${orgId}`)
    }
    
    console.log(`✅ Successfully migrated ${migratedCount} products for org ${orgId}`)
    return { success: true, migratedCount }
    
  } catch (error) {
    console.error('Error migrating products:', error)
    return { success: false, migratedCount }
  }
}

/**
 * Step 4: Migrate orders to hierarchical structure
 */
export async function migrateOrders(orgId: string): Promise<{ success: boolean; migratedCount: number }> {
  let migratedCount = 0
  
  try {
    // Get all orders for this organization
    const ordersQuery = query(collection(db, 'pos_orders'), where('orgId', '==', orgId))
    const ordersSnapshot = await getDocs(ordersQuery)
    
    if (ordersSnapshot.empty) {
      console.log(`No orders to migrate for org ${orgId}`)
      return { success: true, migratedCount: 0 }
    }
    
    // Process in batches
    const batch = writeBatch(db)
    let batchCount = 0
    
    for (const orderDoc of ordersSnapshot.docs) {
      const orderData = orderDoc.data()
      
      // Orders structure remains largely the same, just move location
      const newOrderRef = doc(db, 'organizations', orgId, 'pos_orders', orderDoc.id)
      batch.set(newOrderRef, {
        ...orderData,
        migratedAt: new Date().toISOString()
      })
      
      batchCount++
      migratedCount++
      
      if (batchCount >= 500) {
        await batch.commit()
        console.log(`✅ Migrated batch of ${batchCount} orders for org ${orgId}`)
        batchCount = 0
      }
    }
    
    if (batchCount > 0) {
      await batch.commit()
      console.log(`✅ Migrated final batch of ${batchCount} orders for org ${orgId}`)
    }
    
    console.log(`✅ Successfully migrated ${migratedCount} orders for org ${orgId}`)
    return { success: true, migratedCount }
    
  } catch (error) {
    console.error('Error migrating orders:', error)
    return { success: false, migratedCount }
  }
}

/**
 * Step 5: Complete migration for an organization
 */
export async function completeOrganizationMigration(orgId: string): Promise<boolean> {
  try {
    // Update migration status
    const statusRef = doc(db, 'migration_status', orgId)
    const finalStatus = await checkMigrationStatus(orgId)
    
    await setDoc(statusRef, {
      ...finalStatus,
      status: 'completed',
      completedAt: new Date()
    })
    
    // Update organization document
    const orgRef = doc(db, 'organizations', orgId)
    const orgDoc = await getDoc(orgRef)
    
    if (orgDoc.exists()) {
      await setDoc(orgRef, {
        ...orgDoc.data(),
        migrationStatus: 'completed',
        migratedAt: new Date().toISOString()
      }, { merge: true })
    }
    
    console.log(`✅ Migration completed for organization ${orgId}`)
    return true
    
  } catch (error) {
    console.error('Error completing migration:', error)
    return false
  }
}

/**
 * Full migration workflow for an organization
 */
export async function migrateOrganization(
  orgId: string, 
  orgData: {
    name: string
    type: 'distributor' | 'retailer'
    contactInfo?: any
    settings?: any
  },
  onProgress?: (progress: { step: string; progress: number }) => void
): Promise<boolean> {
  
  try {
    onProgress?.({ step: 'Checking migration status', progress: 0 })
    
    const status = await checkMigrationStatus(orgId)
    if (status.status === 'completed') {
      console.log(`Organization ${orgId} is already migrated`)
      return true
    }
    
    onProgress?.({ step: 'Creating organization document', progress: 10 })
    
    const orgCreated = await createOrganizationDocument(orgId, orgData)
    if (!orgCreated) {
      throw new Error('Failed to create organization document')
    }
    
    onProgress?.({ step: 'Migrating products', progress: 30 })
    
    const productsMigration = await migrateProducts(orgId)
    if (!productsMigration.success) {
      throw new Error('Failed to migrate products')
    }
    
    onProgress?.({ step: 'Migrating orders', progress: 70 })
    
    const ordersMigration = await migrateOrders(orgId)
    if (!ordersMigration.success) {
      throw new Error('Failed to migrate orders')
    }
    
    onProgress?.({ step: 'Completing migration', progress: 90 })
    
    const completed = await completeOrganizationMigration(orgId)
    if (!completed) {
      throw new Error('Failed to complete migration')
    }
    
    onProgress?.({ step: 'Migration completed', progress: 100 })
    
    console.log(`🎉 Successfully migrated organization ${orgId}!`)
    console.log(`   - Products migrated: ${productsMigration.migratedCount}`)
    console.log(`   - Orders migrated: ${ordersMigration.migratedCount}`)
    
    return true
    
  } catch (error) {
    console.error(`Migration failed for organization ${orgId}:`, error)
    
    // Update status to error
    try {
      const statusRef = doc(db, 'migration_status', orgId)
      await setDoc(statusRef, {
        organizationId: orgId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        migratedProducts: 0,
        migratedOrders: 0,
        totalProducts: 0,
        totalOrders: 0
      })
    } catch (statusError) {
      console.error('Failed to update error status:', statusError)
    }
    
    return false
  }
}

/**
 * Utility: Test the optimized structure for an organization
 */
export async function testOptimizedStructure(orgId: string) {
  try {
    console.log(`🧪 Testing optimized structure for org: ${orgId}`)
    
    // Test products query
    const productsSnapshot = await getDocs(collection(db, 'organizations', orgId, 'products'))
    console.log(`   ✅ Products collection: ${productsSnapshot.size} documents`)
    
    // Test orders query  
    const ordersSnapshot = await getDocs(collection(db, 'organizations', orgId, 'pos_orders'))
    console.log(`   ✅ Orders collection: ${ordersSnapshot.size} documents`)
    
    // Test organization document
    const orgDoc = await getDoc(doc(db, 'organizations', orgId))
    console.log(`   ✅ Organization document exists: ${orgDoc.exists()}`)
    
    if (productsSnapshot.size > 0) {
      const sampleProduct = productsSnapshot.docs[0].data()
      console.log(`   ✅ Sample product structure:`, {
        name: sampleProduct.name,
        hasStock: !!sampleProduct.stock,
        hasPricing: !!sampleProduct.pricing,
        hasBarcodes: !!sampleProduct.barcodes
      })
    }
    
    console.log(`🎉 Optimized structure test completed for ${orgId}`)
    return true
    
  } catch (error) {
    console.error(`❌ Optimized structure test failed for ${orgId}:`, error)
    return false
  }
}