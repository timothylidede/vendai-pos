import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Firebase configuration - use environment variables with fallbacks for production
const getFirebaseConfig = () => {
  // In Electron/production, environment variables might be passed differently
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDAH3xcghGGn1pQez0fczy6rBP9qqBWfx0',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'vendai-fa58c.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vendai-fa58c',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vendai-fa58c.firebasestorage.app',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1002924595563',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1002924595563:web:69923ed21eb2d2a075142e',
  };
};

const firebaseConfig = getFirebaseConfig();

// Debug logging (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Firebase Configuration Status:');
  console.log('- Environment:', process.env.NODE_ENV);
  console.log('- Project ID:', firebaseConfig.projectId);
  console.log('- Auth Domain:', firebaseConfig.authDomain);
  console.log('- API Key (last 4):', firebaseConfig.apiKey?.slice(-4) || 'missing');
  console.log('- Using fallback config:', !process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
}

// Initialize Firebase (prevent duplicate initialization)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;
let googleProvider: GoogleAuthProvider | null = null;

try {
  // Check if Firebase is already initialized
  if (getApps().length === 0) {
    console.log('🔥 Initializing Firebase with project:', firebaseConfig.projectId);
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp(); // Use existing app
    console.log('♻️ Using existing Firebase app');
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  storageInstance = getStorage(app);
  googleProvider = new GoogleAuthProvider();
  
  // Add scopes for OAuth
  googleProvider.addScope('email');
  googleProvider.addScope('profile');
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  // Force account picker so users can switch accounts without clearing cache
  
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  console.error('Config used:', {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? '***' + firebaseConfig.apiKey.slice(-4) : 'missing'
  });
  throw new Error('Failed to initialize Firebase. Please check your environment configuration.');
}

export { auth, db, googleProvider, storageInstance as storage };
export default app;