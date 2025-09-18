/**
 * Quick import products to Firebase for testing
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const { processedProducts } = require('../data/products-data');

// Firebase config from your .env.local
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

async function quickImportToFirebase() {
  try {
    // Read environment variables
    require('dotenv').config({ path: '../.env.local' });
    
    console.log('🚀 Starting quick import to Firebase...');
    console.log(`📦 Importing ${processedProducts.length} products...`);
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Import first 10 products as test
    const testProducts = processedProducts.slice(0, 10);
    
    for (let i = 0; i < testProducts.length; i++) {
      const product = testProducts[i];
      
      const productData = {
        name: product.name,
        brand: product.brand || 'Generic',
        category: product.category,
        supplier: product.supplier,
        pieceBarcode: product.pieceBarcode,
        cartonBarcode: product.cartonBarcode,
        retailUOM: product.retailUOM || 'PCS',
        baseUOM: product.baseUOM || 'CTN',
        unitsPerBase: product.unitsPerBase || 12,
        unitPrice: product.unitPrice || 0,
        cartonPrice: product.cartonPrice || product.unitPrice * 12,
        orgId: 'default',
        organizationName: 'default', // Add both for compatibility
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'pos_products'), productData);
      console.log(`✅ Added product ${i + 1}: ${product.name} (${docRef.id})`);
    }
    
    console.log(`🎉 Successfully imported ${testProducts.length} test products!`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

quickImportToFirebase();