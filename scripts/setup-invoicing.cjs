const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp } = require('firebase/firestore');

// Firebase config (you might want to move this to a config file)
const firebaseConfig = {
  apiKey: "AIzaSyBkDHUqSS-t8LXYjz4fwqmDm2aeq0Tl_ZE",
  authDomain: "vendai-pos.firebaseapp.com",
  projectId: "vendai-pos",
  storageBucket: "vendai-pos.firebasestorage.app",
  messagingSenderId: "265434687997",
  appId: "1:265434687997:web:8c5c3a86e4bec4f9ad7d7e",
  measurementId: "G-52EYL65E7J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setupInvoiceSystem() {
  console.log('Setting up invoice system...');
  
  try {
    // Create sample invoice data for Sam West
    const samWestInvoice = {
      supplierId: 'sam_west_supermarket',
      supplierName: 'Sam West Supermarket',
      clientId: 'client_001',
      clientName: 'Mwangi General Store',
      clientEmail: 'mwangi@example.com',
      clientPhone: '+254712345678',
      clientAddress: {
        street: '123 Main Street',
        city: 'Nairobi',
        county: 'Nairobi',
        postalCode: '00100'
      },
      invoiceNumber: 'SW-INV-001',
      invoiceDate: '2025-09-19',
      dueDate: '2025-10-19',
      status: 'draft', // draft, sent, viewed, paid, overdue, cancelled
      items: [
        {
          productId: 'rice_basmati_1kg',
          productName: 'Basmati Rice 1Kg',
          sku: 'RICE-BAS-1KG',
          quantity: 50,
          unitPrice: 180,
          total: 9000,
          category: 'Rice'
        },
        {
          productId: 'cooking_oil_2l',
          productName: 'Cooking Oil 2L',
          sku: 'OIL-COO-2L',
          quantity: 30,
          unitPrice: 320,
          total: 9600,
          category: 'Cooking Oils & Fats'
        },
        {
          productId: 'sugar_white_2kg',
          productName: 'White Sugar 2Kg',
          sku: 'SUG-WHI-2KG',
          quantity: 40,
          unitPrice: 240,
          total: 9600,
          category: 'Sugar'
        }
      ],
      subTotal: 28200,
      taxRate: 0.16, // 16% VAT
      taxAmount: 4512,
      total: 32712,
      paymentTerms: 'Net 30',
      paymentStatus: 'unpaid', // unpaid, partial, paid
      payments: [],
      notes: 'Regular monthly supply order',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Create sample invoice for Mahitaji
    const mahitajiInvoice = {
      supplierId: 'mahitaji_enterprises',
      supplierName: 'Mahitaji Enterprises Ltd',
      clientId: 'client_002',
      clientName: 'Kamau Retail Shop',
      clientEmail: 'kamau@example.com',
      clientPhone: '+254723456789',
      clientAddress: {
        street: '456 Market Road',
        city: 'Nakuru',
        county: 'Nakuru',
        postalCode: '20100'
      },
      invoiceNumber: 'MH-INV-001',
      invoiceDate: '2025-09-18',
      dueDate: '2025-10-02', // Net 14 terms
      status: 'sent',
      items: [
        {
          productId: 'milk_powder_500g',
          productName: 'Milk Powder 500g',
          sku: 'MLK-POW-500G',
          quantity: 25,
          unitPrice: 450,
          total: 11250,
          category: 'Dairy Products'
        },
        {
          productId: 'wheat_flour_2kg',
          productName: 'Wheat Flour 2Kg',
          sku: 'FLR-WHT-2KG',
          quantity: 60,
          unitPrice: 160,
          total: 9600,
          category: 'Flour'
        }
      ],
      subTotal: 20850,
      taxRate: 0.16,
      taxAmount: 3336,
      total: 24186,
      paymentTerms: 'Net 14',
      paymentStatus: 'unpaid',
      payments: [],
      notes: 'Weekly delivery order',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add invoices to Firebase
    console.log('Creating Sam West invoice...');
    const samWestRef = await addDoc(collection(db, 'invoices'), samWestInvoice);
    console.log('Sam West invoice created with ID:', samWestRef.id);

    console.log('Creating Mahitaji invoice...');
    const mahitajiRef = await addDoc(collection(db, 'invoices'), mahitajiInvoice);
    console.log('Mahitaji invoice created with ID:', mahitajiRef.id);

    // Create invoice counter for auto-incrementing invoice numbers
    await setDoc(doc(db, 'counters', 'invoices'), {
      samWest: 1,
      mahitaji: 1,
      lastUpdated: serverTimestamp()
    });

    // Create client records for future invoicing
    const clients = [
      {
        id: 'client_001',
        name: 'Mwangi General Store',
        email: 'mwangi@example.com',
        phone: '+254712345678',
        address: {
          street: '123 Main Street',
          city: 'Nairobi',
          county: 'Nairobi',
          postalCode: '00100'
        },
        paymentTerms: 'Net 30',
        creditLimit: 100000,
        currentBalance: 32712,
        status: 'active',
        createdAt: serverTimestamp()
      },
      {
        id: 'client_002',
        name: 'Kamau Retail Shop',
        email: 'kamau@example.com',
        phone: '+254723456789',
        address: {
          street: '456 Market Road',
          city: 'Nakuru',
          county: 'Nakuru',
          postalCode: '20100'
        },
        paymentTerms: 'Net 14',
        creditLimit: 75000,
        currentBalance: 24186,
        status: 'active',
        createdAt: serverTimestamp()
      }
    ];

    for (const client of clients) {
      await setDoc(doc(db, 'clients', client.id), client);
      console.log('Created client:', client.name);
    }

    console.log('✅ Invoice system setup complete!');
    console.log('📊 Created:');
    console.log('  - 2 sample invoices');
    console.log('  - Invoice counter system');
    console.log('  - 2 client records');
    console.log('');
    console.log('🏗️  Firebase structure:');
    console.log('  - /invoices/{invoiceId}');
    console.log('  - /clients/{clientId}');
    console.log('  - /counters/invoices');

  } catch (error) {
    console.error('Error setting up invoice system:', error);
    process.exit(1);
  }
}

// Run the setup
setupInvoiceSystem()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });