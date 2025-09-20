/**
 * Complete Firebase Backend Setup for VendAI MVP
 * Sets up all collections, sample data, and relationships for production
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  doc, 
  setDoc, 
  addDoc,
  collection, 
  serverTimestamp,
  writeBatch 
} = require('firebase/firestore');

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

// Sample distributors data
const distributors = [
  {
    id: "mahitaji_enterprises",
    name: "Mahitaji Enterprises Ltd",
    contact: {
      phone: "+254 700 123 456",
      email: "admin@mahitaji.vendai.co.ke",
      address: "Industrial Area, Nairobi"
    },
    paymentTerms: "Net 30",
    creditLimit: 3000000,
    currentCredit: 0,
    status: "active",
    businessType: "wholesaler",
    description: "Leading wholesale distribution company specializing in FMCG products",
    totalProducts: 3065,
    totalRetailers: 127,
    totalOrders: 890,
    totalGMV: 18500000,
    lastActivity: "Online now",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    id: "sam_west_supermarket",
    name: "Sam West Supermarket",
    contact: {
      phone: "+254 722 123 456",
      email: "admin@samwest.vendai.co.ke",
      address: "Eastleigh, Nairobi"
    },
    paymentTerms: "Net 14",
    creditLimit: 5000000,
    currentCredit: 0,
    status: "active",
    businessType: "supermarket_chain",
    description: "Large scale supermarket chain specializing in wholesale and retail distribution",
    totalProducts: 3065,
    totalRetailers: 98,
    totalOrders: 645,
    totalGMV: 12800000,
    lastActivity: "2 hours ago",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
];

// Sample retailers data
const retailers = [
  {
    id: "mama_pendo_shop",
    organizationName: "Mama Pendo Shop",
    contactNumber: "+254 712 345 678",
    location: "Nairobi",
    coordinates: { lat: -1.2921, lng: 36.8219 },
    distributorId: "mahitaji_enterprises",
    distributorName: "Mahitaji Enterprises Ltd",
    status: "active",
    role: "retailer",
    joinDate: "2025-08-15",
    lastOrderDate: "2025-09-18",
    totalOrders: 24,
    totalGMV: 340000,
    creditLimit: 150000,
    currentCredit: 45000,
    paymentTerms: "net30",
    businessType: "retail",
    averageOrderValue: 14167,
    orderFrequency: "weekly",
    topProducts: ["Rice", "Sugar", "Cooking Oil"],
    lastActivity: "2 hours ago",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    id: "kinyozi_modern_store",
    organizationName: "Kinyozi Modern Store",
    contactNumber: "+254 798 765 432",
    location: "Mombasa",
    coordinates: { lat: -4.0435, lng: 39.6682 },
    distributorId: "sam_west_supermarket",
    distributorName: "Sam West Supermarket",
    status: "active",
    role: "retailer",
    joinDate: "2025-07-22",
    lastOrderDate: "2025-09-17",
    totalOrders: 18,
    totalGMV: 280000,
    creditLimit: 120000,
    currentCredit: 32000,
    paymentTerms: "net15",
    businessType: "retail",
    averageOrderValue: 15556,
    orderFrequency: "bi-weekly",
    topProducts: ["Beverages", "Snacks", "Personal Care"],
    lastActivity: "1 day ago",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    id: "nyeri_fresh_mart",
    organizationName: "Nyeri Fresh Mart", 
    contactNumber: "+254 734 567 890",
    location: "Nyeri",
    coordinates: { lat: -0.4205, lng: 36.9573 },
    distributorId: "mahitaji_enterprises",
    distributorName: "Mahitaji Enterprises Ltd",
    status: "pending",
    role: "retailer",
    joinDate: "2025-09-10",
    totalOrders: 3,
    totalGMV: 45000,
    creditLimit: 80000,
    currentCredit: 15000,
    paymentTerms: "net30",
    businessType: "retail",
    averageOrderValue: 15000,
    orderFrequency: "monthly",
    topProducts: ["Dairy Products", "Cereals"],
    lastActivity: "5 days ago",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
];

// Sample settlements data
const settlements = [
  {
    id: "SET_MH_202509",
    distributorId: "mahitaji_enterprises",
    month: "2025-09",
    gmv: 2150000,
    settlement: 107500,
    status: "pending",
    dueDate: "2025-10-15",
    calculatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  },
  {
    id: "SET_MH_202508",
    distributorId: "mahitaji_enterprises",
    month: "2025-08",
    gmv: 1800000,
    settlement: 90000,
    status: "paid",
    dueDate: "2025-09-15",
    paidDate: "2025-09-12",
    paidAmount: 90000,
    calculatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  },
  {
    id: "SET_SW_202509",
    distributorId: "sam_west_supermarket",
    month: "2025-09",
    gmv: 1650000,
    settlement: 82500,
    status: "pending",
    dueDate: "2025-10-15",
    calculatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }
];

// Sample orders data
const orders = [
  {
    id: "ORD_001",
    userId: "mama_pendo_shop",
    retailerId: "mama_pendo_shop",
    retailerName: "Mama Pendo Shop",
    distributorId: "mahitaji_enterprises",
    distributorName: "Mahitaji Enterprises Ltd",
    status: "delivered",
    items: [
      {
        productId: "rice_basmati_1kg",
        productName: "Basmati Rice 1Kg",
        quantity: 20,
        unitPrice: 180,
        total: 3600
      },
      {
        productId: "cooking_oil_1l",
        productName: "Cooking Oil 1L",
        quantity: 15,
        unitPrice: 350,
        total: 5250
      }
    ],
    subTotal: 8850,
    tax: 1416,
    total: 10266,
    paymentMethod: "credit",
    paymentStatus: "pending",
    deliveryAddress: "Mama Pendo Shop, Nairobi",
    orderDate: "2025-09-18",
    deliveryDate: "2025-09-19",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    id: "ORD_002",
    userId: "kinyozi_modern_store",
    retailerId: "kinyozi_modern_store",
    retailerName: "Kinyozi Modern Store",
    distributorId: "sam_west_supermarket",
    distributorName: "Sam West Supermarket",
    status: "confirmed",
    items: [
      {
        productId: "coca_cola_300ml",
        productName: "Coca Cola 300ml",
        quantity: 48,
        unitPrice: 45,
        total: 2160
      }
    ],
    subTotal: 2160,
    tax: 345.6,
    total: 2505.6,
    paymentMethod: "cash",
    paymentStatus: "pending",
    deliveryAddress: "Kinyozi Modern Store, Mombasa",
    orderDate: "2025-09-17",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
];

async function setupCompleteBackend() {
  console.log('🚀 Setting up complete VendAI MVP backend...');
  
  try {
    const batch = writeBatch(db);
    let batchCount = 0;
    
    // Helper to manage batch writes
    const addToBatch = async (docRef, data) => {
      batch.set(docRef, data);
      batchCount++;
      
      if (batchCount >= 450) { // Firestore limit is 500
        await batch.commit();
        batchCount = 0;
        console.log('✅ Batch committed...');
      }
    };

    // 1. Setup Distributors
    console.log('📊 Setting up distributors...');
    for (const distributor of distributors) {
      const docRef = doc(db, 'distributors', distributor.id);
      await addToBatch(docRef, distributor);
    }

    // 2. Setup Retailers
    console.log('🏪 Setting up retailers...');
    for (const retailer of retailers) {
      const docRef = doc(db, 'retailers', retailer.id);
      await addToBatch(docRef, retailer);
    }

    // 3. Setup Settlements
    console.log('💰 Setting up settlements...');
    for (const settlement of settlements) {
      const docRef = doc(db, 'settlements', settlement.id);
      await addToBatch(docRef, settlement);
    }

    // 4. Setup Orders
    console.log('📦 Setting up orders...');
    for (const order of orders) {
      const docRef = doc(db, 'orders', order.id);
      await addToBatch(docRef, order);
    }

    // 5. Setup Sample Invoices
    console.log('🧾 Setting up invoices...');
    const sampleInvoice = {
      id: "INV_MH_001",
      supplierId: "mahitaji_enterprises",
      supplierName: "Mahitaji Enterprises Ltd",
      clientId: "mama_pendo_shop",
      clientName: "Mama Pendo Shop",
      clientEmail: "mamapendo@example.com",
      clientPhone: "+254712345678",
      invoiceNumber: "MH-INV-001",
      invoiceDate: "2025-09-19",
      dueDate: "2025-10-19",
      status: "sent",
      items: [
        {
          productId: "rice_basmati_1kg",
          productName: "Basmati Rice 1Kg",
          quantity: 50,
          unitPrice: 180,
          total: 9000
        }
      ],
      subTotal: 9000,
      taxRate: 0.16,
      taxAmount: 1440,
      total: 10440,
      paymentTerms: "Net 30",
      paymentStatus: "unpaid",
      payments: [],
      notes: "Monthly supply order",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const invoiceRef = doc(db, 'invoices', sampleInvoice.id);
    await addToBatch(invoiceRef, sampleInvoice);

    // Commit any remaining batch operations
    if (batchCount > 0) {
      await batch.commit();
      console.log('✅ Final batch committed');
    }

    console.log('🎉 Complete backend setup successful!');
    console.log('\n📋 Summary:');
    console.log(`   - ${distributors.length} distributors created`);
    console.log(`   - ${retailers.length} retailers created`);
    console.log(`   - ${settlements.length} settlements created`);
    console.log(`   - ${orders.length} orders created`);
    console.log(`   - 1 sample invoice created`);
    console.log('\n🚀 VendAI MVP is now ready for production!');

  } catch (error) {
    console.error('❌ Error setting up backend:', error);
    throw error;
  }
}

// Run the setup
setupCompleteBackend()
  .then(() => {
    console.log('✅ Setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });