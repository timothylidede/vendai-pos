import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration - use environment variables with fallbacks for production
const getFirebaseConfig = () => {
  // In Electron/production, environment variables might be passed differently
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
  
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDAH3xcghGGn1pQez0fczy6rBP9qqBWfx0',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'auth.vendai.digital',
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
  console.log('- Using fallback config:', !process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
}

// Initialize Firebase (prevent duplicate initialization)
let app: any = null;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

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
  googleProvider = new GoogleAuthProvider();
  
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  console.error('Config used:', {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? '***' + firebaseConfig.apiKey.slice(-4) : 'missing'
  });
  throw new Error('Failed to initialize Firebase. Please check your environment configuration.');
}

export { auth, db, googleProvider };
export default app;