import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

console.log('🔧 Firebase Admin Configuration:')
console.log('- Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
console.log('- Storage Bucket:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
console.log('- Has Service Account Key:', !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY)

// Initialize Firebase Admin SDK
const adminConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vendai-fa58c',
  // Use the correct storage bucket from environment or default to .firebasestorage.app
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vendai-fa58c.firebasestorage.app',
}

// Add service account key if available
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    ;(adminConfig as any).credential = cert(serviceAccount)
    console.log('✅ Using Firebase service account credentials')
  } catch (e) {
    console.warn('⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e)
  }
} else {
  console.log('ℹ️ No Firebase service account key found')
  console.log('💡 For image upload to work, you need to:')
  console.log('   1. Go to Firebase Console > Project Settings > Service Accounts')
  console.log('   2. Generate new private key')
  console.log('   3. Add the JSON as FIREBASE_SERVICE_ACCOUNT_KEY in .env.local')
  console.log('   4. Or use Application Default Credentials with `gcloud auth application-default login`')
  
  // In development without service account, we'll catch the error in the image generation
  // and provide a helpful message to the user
}

// Initialize app if not already initialized
let adminApp
try {
  adminApp = getApps().find(app => app.name === 'admin-app') || 
    initializeApp(adminConfig, 'admin-app')
  console.log('✅ Firebase Admin app initialized')
} catch (error: any) {
  console.error('❌ Failed to initialize Firebase Admin app:', error.message)
  throw error
}

export const adminDb = getFirestore(adminApp)
export const adminStorage = getStorage(adminApp)
export default adminApp