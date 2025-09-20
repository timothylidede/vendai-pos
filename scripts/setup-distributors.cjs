/**
 * Setup distributor accounts in Firebase
 * Creates Sam West and Mahitaji distributor accounts with dummy data
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, collection } = require('firebase/firestore');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');

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
const auth = getAuth(app);

const distributors = [
  {
    id: "samwest_supermarket",
    name: "Sam West Supermarket",
    email: "admin@samwest.vendai.temp", // You can change this later
    password: "SamWest2024!",
    contact: {
      phone: "+254 722 123 456",
      email: "admin@samwest.vendai.temp",
      address: "Eastleigh, Nairobi"
    },
    paymentTerms: "Net 14",
    creditLimit: 5000000,
    currentCredit: 0,
    status: "active",
    businessType: "supermarket",
    description: "Large scale supermarket chain specializing in wholesale and retail distribution"
  },
  {
    id: "mahitaji_enterprises",
    name: "Mahitaji Enterprises Ltd",
    email: "admin@mahitaji.vendai.temp", // You can change this later  
    password: "Mahitaji2024!",
    contact: {
      phone: "+254 700 123 456", 
      email: "admin@mahitaji.vendai.temp",
      address: "Prabhaki Industrial Park, Baba Dogo Road"
    },
    paymentTerms: "Net 30",
    creditLimit: 2000000,
    currentCredit: 0,
    status: "active",
    businessType: "distributor",
    description: "Leading food and beverage distributor serving retail outlets across Kenya"
  }
];

async function setupDistributors() {
  try {
    console.log('🚀 Setting up distributor accounts in Firebase...');
    
    for (const distributor of distributors) {
      console.log(`\n📦 Creating account for ${distributor.name}...`);
      
      try {
        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          distributor.email, 
          distributor.password
        );
        
        const user = userCredential.user;
        console.log(`✅ Firebase Auth user created: ${user.uid}`);
        
        // Create user document in Firestore
        const userData = {
          uid: user.uid,
          email: distributor.email,
          displayName: distributor.name,
          role: 'distributor',
          organizationName: distributor.name,
          contactNumber: distributor.contact.phone,
          location: distributor.contact.address,
          coordinates: null,
          isOrganizationCreator: true,
          onboardingCompleted: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          
          // Distributor-specific fields
          businessType: distributor.businessType,
          description: distributor.description,
          paymentTerms: distributor.paymentTerms,
          creditLimit: distributor.creditLimit,
          currentCredit: distributor.currentCredit,
          status: distributor.status,
          
          // Platform analytics
          totalRetailers: 0,
          totalOrders: 0,
          totalGMV: 0,
          lastActivity: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', user.uid), userData);
        console.log(`✅ User document created in Firestore`);
        
        // Create distributor profile in distributors collection
        const distributorData = {
          id: distributor.id,
          userId: user.uid,
          name: distributor.name,
          contact: distributor.contact,
          paymentTerms: distributor.paymentTerms,
          creditLimit: distributor.creditLimit,
          currentCredit: distributor.currentCredit,
          status: distributor.status,
          businessType: distributor.businessType,
          description: distributor.description,
          
          // Business metrics
          totalRetailers: 0,
          totalOrders: 0,
          totalGMV: 0,
          lastActivity: new Date().toISOString(),
          
          // Product catalog
          totalProducts: 0,
          lastProductUpdate: new Date().toISOString(),
          
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'distributors', distributor.id), distributorData);
        console.log(`✅ Distributor profile created`);
        
        // Create empty products collection for this distributor
        const productsRef = collection(db, 'distributors', distributor.id, 'products');
        console.log(`✅ Products collection reference created: ${productsRef.path}`);
        
        console.log(`🎉 Successfully set up ${distributor.name}`);
        console.log(`   Email: ${distributor.email}`);
        console.log(`   Password: ${distributor.password}`);
        console.log(`   UID: ${user.uid}`);
        
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`⚠️  Email already exists for ${distributor.name}, skipping auth creation`);
          
          // Still create/update the distributor profile
          const distributorData = {
            id: distributor.id,
            name: distributor.name,
            contact: distributor.contact,
            paymentTerms: distributor.paymentTerms,
            creditLimit: distributor.creditLimit,
            currentCredit: distributor.currentCredit,
            status: distributor.status,
            businessType: distributor.businessType,
            description: distributor.description,
            totalRetailers: 0,
            totalOrders: 0,
            totalGMV: 0,
            lastActivity: new Date().toISOString(),
            totalProducts: 0,
            lastProductUpdate: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await setDoc(doc(db, 'distributors', distributor.id), distributorData, { merge: true });
          console.log(`✅ Distributor profile updated`);
        } else {
          console.error(`❌ Error setting up ${distributor.name}:`, error);
        }
      }
    }
    
    console.log('\n🎉 Distributor setup complete!');
    console.log('\n📋 Summary:');
    distributors.forEach(d => {
      console.log(`   ${d.name}: ${d.email} (${d.password})`);
    });
    console.log('\n⚠️  Remember to change these dummy passwords after testing!');
    
  } catch (error) {
    console.error('❌ Error setting up distributors:', error);
  }
}

setupDistributors();