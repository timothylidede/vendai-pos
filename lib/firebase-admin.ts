import { initializeApp, cert, getApps, getApp, type App, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getStorage, type Storage } from 'firebase-admin/storage'

let adminAppInstance: App | null = null
let adminDbInstance: Firestore | null = null
let adminAuthInstance: Auth | null = null
let adminStorageInstance: Storage | null = null

const parseServiceAccountKey = (): ServiceAccount | null => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) return null

  const normalized = raw.startsWith('{') ? raw : raw.replace(/^['"]|['"]$/g, '')

  try {
    const parsed = JSON.parse(normalized) as ServiceAccount
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
    }
    return parsed
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY', error)
    return null
  }
}

const buildServiceAccount = (): ServiceAccount => {
  const parsed = parseServiceAccountKey()
  if (parsed) {
    return parsed
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PRIVATE_KEY/FIREBASE_CLIENT_EMAIL/FIREBASE_PROJECT_ID.')
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  }
}

export const getFirebaseAdminApp = (): App => {
  if (adminAppInstance) {
    return adminAppInstance
  }

  if (getApps().length) {
    adminAppInstance = getApp()
    return adminAppInstance
  }

  const serviceAccount = buildServiceAccount()
  const projectId = serviceAccount.projectId
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined

  adminAppInstance = initializeApp({
    credential: cert(serviceAccount),
    projectId,
    storageBucket,
  })

  return adminAppInstance
}

export const getFirebaseAdminDb = (): Firestore => {
  if (!adminDbInstance) {
    adminDbInstance = getFirestore(getFirebaseAdminApp())
  }
  return adminDbInstance
}

export const getFirebaseAdminAuth = (): Auth => {
  if (!adminAuthInstance) {
    adminAuthInstance = getAuth(getFirebaseAdminApp())
  }
  return adminAuthInstance
}

export const getFirebaseAdminStorage = (): Storage => {
  if (!adminStorageInstance) {
    adminStorageInstance = getStorage(getFirebaseAdminApp())
  }
  return adminStorageInstance
}

export const adminApp = getFirebaseAdminApp()
export const adminDb = getFirebaseAdminDb()
export const adminAuth = getFirebaseAdminAuth()
export const adminStorage = getFirebaseAdminStorage()

export default adminApp