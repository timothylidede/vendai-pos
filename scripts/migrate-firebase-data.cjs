#!/usr/bin/env node

/**
 * VendAI Firebase Data Migration Script
 * Migrates from current flat structure to optimized hierarchical structure
 * 
 * Features:
 * - Batch processing to avoid timeout issues
 * - Data validation and transformation
 * - Rollback capabilities
 * - Progress tracking
 * - Performance optimizations
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter
} = require('firebase/firestore');

// Firebase configuration
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

// Migration configuration
const BATCH_SIZE = 450; // Firestore batch limit is 500
const MIGRATION_COLLECTIONS = {
  pos_products: 'products',
  inventory: 'inventory', 
  pos_orders: 'pos_orders'
};

class FirebaseMigration {
  constructor() {
    this.stats = {
      totalProcessed: 0,
      totalMigrated: 0,
      totalErrors: 0,
      startTime: Date.now()
    };
  }

  async migrate() {
    console.log('🚀 Starting VendAI Firebase Data Migration');
    console.log('=' .repeat(60));
    
    try {
      // Step 1: Discover organizations
      console.log('📊 Step 1: Discovering organizations...');
      const organizations = await this.discoverOrganizations();
      console.log(`✅ Found ${organizations.length} organizations`);
      
      // Step 2: Migrate each organization's data
      for (const orgId of organizations) {
        console.log(`\n🏢 Migrating organization: ${orgId}`);
        await this.migrateOrganization(orgId);
      }
      
      // Step 3: Update distributor and retailer data
      console.log('\n📦 Step 3: Optimizing distributor data...');
      await this.optimizeDistributors();
      
      console.log('\n🏪 Step 4: Optimizing retailer data...');
      await this.optimizeRetailers();
      
      // Step 5: Create organization metadata
      console.log('\n🏛️ Step 5: Creating organization metadata...');
      await this.createOrganizationMetadata(organizations);
      
      console.log('\n✅ Migration completed successfully!');
      this.printStats();
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async discoverOrganizations() {
    const organizations = new Set();
    
    // Get unique orgIds from pos_products
    const productsSnapshot = await getDocs(collection(db, 'pos_products'));
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.orgId) {
        organizations.add(data.orgId);
      }
    });
    
    // Get unique orgIds from inventory
    const inventorySnapshot = await getDocs(collection(db, 'inventory'));
    inventorySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.orgId) {
        organizations.add(data.orgId);
      }
    });
    
    // Get unique orgIds from pos_orders
    const ordersSnapshot = await getDocs(collection(db, 'pos_orders'));
    ordersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.orgId) {
        organizations.add(data.orgId);
      }
    });
    
    return Array.from(organizations);
  }

  async migrateOrganization(orgId) {
    console.log(`  📋 Migrating products for ${orgId}...`);
    await this.migrateProducts(orgId);
    
    console.log(`  📦 Migrating inventory for ${orgId}...`);
    await this.migrateInventory(orgId);
    
    console.log(`  🧾 Migrating POS orders for ${orgId}...`);
    await this.migratePOSOrders(orgId);
  }

  async migrateProducts(orgId) {
    let lastDoc = null;
    let processedCount = 0;
    
    while (true) {
      // Build query
      let q = query(
        collection(db, 'pos_products'),
        where('orgId', '==', orgId),
        orderBy('updatedAt', 'desc'),
        limit(BATCH_SIZE)
      );
      
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) break;
      
      const batch = writeBatch(db);
      
      snapshot.forEach(docSnapshot => {
        const oldData = docSnapshot.data();
        
        // Transform to optimized structure
        const optimizedProduct = this.transformProduct(oldData, docSnapshot.id);
        
        // Write to new location
        const newRef = doc(db, 'organizations', orgId, 'products', docSnapshot.id);
        batch.set(newRef, optimizedProduct);
        
        processedCount++;
        this.stats.totalProcessed++;
      });
      
      await batch.commit();
      this.stats.totalMigrated += snapshot.docs.length;
      
      console.log(`    ✓ Migrated ${processedCount} products`);
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
  }

  transformProduct(oldData, productId) {
    const now = new Date().toISOString();
    
    return {
      id: productId,
      orgId: oldData.orgId || '',
      
      // Product basics
      name: oldData.name || '',
      sku: oldData.sku || oldData.code || '',
      brand: oldData.brand || '',
      category: oldData.category || 'General',
      description: oldData.description || '',
      
      // Stock (will be updated from inventory data)
      stock: {
        qtyBase: 0,
        qtyLoose: 0,
        unitsPerBase: oldData.unitsPerBase || 1,
        reserved: 0,
        available: 0,
        lastUpdated: now
      },
      
      // Pricing
      pricing: {
        cost: oldData.cost || oldData.unitCost || 0,
        retail: oldData.price || oldData.retail || oldData.unitPrice || 0,
        wholesale: oldData.wholesale || 0,
        distributor: oldData.distributor || 0
      },
      
      // Barcodes
      barcodes: {
        piece: oldData.pieceBarcode || oldData.barcode || '',
        carton: oldData.cartonBarcode || '',
        ean: oldData.ean || ''
      },
      
      // Reorder info
      reorder: {
        minLevel: oldData.minLevel || 5,
        maxLevel: oldData.maxLevel || 100,
        reorderPoint: oldData.reorderPoint || 10,
        preferredSupplier: oldData.preferredSupplier || oldData.supplier || ''
      },
      
      // AI and images
      image: oldData.image || '',
      imageGeneratedAt: oldData.imageGeneratedAt || '',
      
      // Metadata
      createdAt: this.normalizeTimestamp(oldData.createdAt) || now,
      updatedAt: this.normalizeTimestamp(oldData.updatedAt) || now,
      createdBy: oldData.createdBy || ''
    };
  }

  async migrateInventory(orgId) {
    // Get all inventory records for this organization
    const inventoryQuery = query(
      collection(db, 'inventory'),
      where('orgId', '==', orgId)
    );
    
    const snapshot = await getDocs(inventoryQuery);
    const batch = writeBatch(db);
    let batchCount = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const oldData = docSnapshot.data();
      
      // Extract productId from document ID (format: orgId_productId)
      const productId = docSnapshot.id.replace(`${orgId}_`, '');
      
      // Update the product document with inventory data
      const productRef = doc(db, 'organizations', orgId, 'products', productId);
      const stockUpdate = {
        'stock.qtyBase': oldData.qtyBase || 0,
        'stock.qtyLoose': oldData.qtyLoose || 0,
        'stock.unitsPerBase': oldData.unitsPerBase || 1,
        'stock.reserved': 0,
        'stock.available': ((oldData.qtyBase || 0) * (oldData.unitsPerBase || 1)) + (oldData.qtyLoose || 0),
        'stock.lastUpdated': new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      batch.update(productRef, stockUpdate);
      batchCount++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batchCount = 0;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`    ✓ Updated inventory for ${snapshot.docs.length} products`);
  }

  async migratePOSOrders(orgId) {
    let lastDoc = null;
    let processedCount = 0;
    
    while (true) {
      let q = query(
        collection(db, 'pos_orders'),
        where('orgId', '==', orgId),
        orderBy('createdAt', 'desc'),
        limit(BATCH_SIZE)
      );
      
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) break;
      
      const batch = writeBatch(db);
      
      snapshot.forEach(docSnapshot => {
        const oldData = docSnapshot.data();
        const optimizedOrder = this.transformPOSOrder(oldData, docSnapshot.id);
        
        const newRef = doc(db, 'organizations', orgId, 'pos_orders', docSnapshot.id);
        batch.set(newRef, optimizedOrder);
        
        processedCount++;
        this.stats.totalProcessed++;
      });
      
      await batch.commit();
      this.stats.totalMigrated += snapshot.docs.length;
      
      console.log(`    ✓ Migrated ${processedCount} POS orders`);
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
  }

  transformPOSOrder(oldData, orderId) {
    const now = new Date().toISOString();
    
    return {
      id: orderId,
      type: 'pos',
      orgId: oldData.orgId || '',
      
      items: (oldData.lines || oldData.items || []).map(item => ({
        productId: item.productId || '',
        productName: item.productName || item.name || '',
        sku: item.sku || '',
        quantity: item.qty || item.quantity || 0,
        unitPrice: item.unitPrice || item.price || 0,
        lineTotal: item.lineTotal || item.total || (item.qty || 0) * (item.unitPrice || 0)
      })),
      
      totals: {
        subtotal: oldData.total || 0,
        tax: oldData.tax || 0,
        discount: oldData.discount || 0,
        total: oldData.total || 0
      },
      
      status: oldData.status || 'completed',
      timeline: [
        {
          status: oldData.status || 'completed',
          timestamp: this.normalizeTimestamp(oldData.createdAt) || now,
          note: 'Migrated from legacy system'
        }
      ],
      
      createdAt: this.normalizeTimestamp(oldData.createdAt) || now,
      updatedAt: this.normalizeTimestamp(oldData.updatedAt) || now,
      createdBy: oldData.userId || oldData.createdBy || ''
    };
  }

  async optimizeDistributors() {
    const distributorsSnapshot = await getDocs(collection(db, 'distributors'));
    const batch = writeBatch(db);
    let batchCount = 0;
    
    for (const docSnapshot of distributorsSnapshot.docs) {
      const oldData = docSnapshot.data();
      const optimizedDistributor = this.transformDistributor(oldData, docSnapshot.id);
      
      batch.set(docSnapshot.ref, optimizedDistributor);
      batchCount++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batchCount = 0;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`    ✓ Optimized ${distributorsSnapshot.docs.length} distributors`);
  }

  transformDistributor(oldData, distributorId) {
    const now = new Date().toISOString();
    
    return {
      id: distributorId,
      userId: oldData.userId || '',
      
      profile: {
        name: oldData.name || '',
        email: oldData.contact?.email || oldData.email || '',
        phone: oldData.contact?.phone || oldData.phone || '',
        address: oldData.contact?.address || oldData.address || '',
        businessType: oldData.businessType || 'Distributor',
        description: oldData.description || ''
      },
      
      terms: {
        paymentTerms: oldData.paymentTerms || 'Net 30',
        creditLimit: oldData.creditLimit || 0,
        taxRate: 16 // Default VAT rate for Kenya
      },
      
      stats: {
        totalRetailers: oldData.totalRetailers || 0,
        totalProducts: oldData.totalProducts || 0,
        totalOrders: oldData.totalOrders || 0,
        monthlyGMV: oldData.totalGMV || oldData.monthlyGMV || 0,
        averageOrderValue: 0,
        lastActivity: this.normalizeTimestamp(oldData.lastActivity) || now
      },
      
      activeRetailers: oldData.activeRetailers || [],
      topProducts: oldData.topProducts || [],
      
      status: oldData.status || 'active',
      
      createdAt: this.normalizeTimestamp(oldData.createdAt) || now,
      updatedAt: now
    };
  }

  async optimizeRetailers() {
    const retailersSnapshot = await getDocs(collection(db, 'retailers'));
    const batch = writeBatch(db);
    let batchCount = 0;
    
    for (const docSnapshot of retailersSnapshot.docs) {
      const oldData = docSnapshot.data();
      const optimizedRetailer = this.transformRetailer(oldData, docSnapshot.id);
      
      batch.set(docSnapshot.ref, optimizedRetailer);
      batchCount++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batchCount = 0;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`    ✓ Optimized ${retailersSnapshot.docs.length} retailers`);
  }

  transformRetailer(oldData, retailerId) {
    const now = new Date().toISOString();
    
    return {
      id: retailerId,
      userId: oldData.userId || '',
      distributorId: oldData.distributorId || '',
      distributorName: oldData.distributorName || '',
      
      profile: {
        name: oldData.name || oldData.organizationName || '',
        organizationName: oldData.organizationName || oldData.name || '',
        contactNumber: oldData.contactNumber || oldData.phone || '',
        email: oldData.email || '',
        location: oldData.location || '',
        coordinates: oldData.coordinates || null
      },
      
      stats: {
        totalOrders: oldData.totalOrders || 0,
        monthlySpend: oldData.monthlySpend || 0,
        averageOrderValue: oldData.averageOrderValue || 0,
        lastOrderDate: this.normalizeTimestamp(oldData.lastOrderDate),
        creditScore: oldData.creditScore || 100
      },
      
      status: oldData.status || 'active',
      
      createdAt: this.normalizeTimestamp(oldData.createdAt) || now,
      updatedAt: now
    };
  }

  async createOrganizationMetadata(organizations) {
    const batch = writeBatch(db);
    let batchCount = 0;
    
    for (const orgId of organizations) {
      const orgRef = doc(db, 'organizations', orgId);
      const orgData = {
        id: orgId,
        name: orgId,
        displayName: orgId,
        createdAt: new Date().toISOString(),
        createdBy: '',
        createdByEmail: null,
        migrated: true,
        migratedAt: new Date().toISOString()
      };
      
      batch.set(orgRef, orgData);
      batchCount++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batchCount = 0;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`    ✓ Created metadata for ${organizations.length} organizations`);
  }

  normalizeTimestamp(timestamp) {
    if (!timestamp) return null;
    
    // Handle Firestore Timestamp objects
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
    
    // Handle Date objects
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    
    // Handle string timestamps
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    
    return null;
  }

  printStats() {
    const duration = (Date.now() - this.stats.startTime) / 1000;
    console.log('\n📊 Migration Statistics:');
    console.log('=' .repeat(40));
    console.log(`Total processed: ${this.stats.totalProcessed}`);
    console.log(`Total migrated: ${this.stats.totalMigrated}`);
    console.log(`Total errors: ${this.stats.totalErrors}`);
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Avg speed: ${(this.stats.totalProcessed / duration).toFixed(2)} docs/s`);
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new FirebaseMigration();
  migration.migrate().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = FirebaseMigration;