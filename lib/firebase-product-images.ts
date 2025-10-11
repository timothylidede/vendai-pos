/**
 * Firebase Product Images Integration
 * Fetches generated product images from Firestore and enriches distributor products
 */

import { collection, query, where, getDocs, limit as firestoreLimit, orderBy, startAfter } from 'firebase/firestore'
import { db } from './firebase'

export interface FirebaseProductImage {
  productId: string
  productName: string
  distributorId: string
  imageUrl: string
  storageUrl?: string
  category?: string
  brand?: string
  createdAt: string
  prompt?: string
  referenceUrls?: string[]
  embedding?: number[]
}

/**
 * Fetch product images for a specific distributor
 */
export async function getDistributorProductImages(
  distributorId: string,
  options: {
    limit?: number
    page?: number
  } = {}
): Promise<FirebaseProductImage[]> {
  try {
    const { limit: limitCount = 100, page = 1 } = options
    
    // Check if db is available
    if (!db) {
      console.warn('Firebase db not initialized, cannot fetch images')
      return []
    }
    
    // Temporarily return empty until index is created
    // TODO: Uncomment after creating Firebase index
    console.log('⚠️ Firebase query disabled - using local data. Create index at:')
    console.log('https://console.firebase.google.com/project/vendai-fa58c/firestore/indexes')
    return []
    
    // Query the distributor_images collection (requires index)
    // const imagesRef = collection(db, 'distributor_images')
    // let q = query(
    //   imagesRef,
    //   where('distributorId', '==', distributorId),
    //   orderBy('createdAt', 'desc'),
    //   firestoreLimit(limitCount)
    // )
    
    // const snapshot = await getDocs(q)
    
    // const images: FirebaseProductImage[] = []
    // snapshot.forEach((doc) => {
    //   const data = doc.data()
    //   images.push({
    //     productId: data.productId || doc.id,
    //     productName: data.productName || '',
    //     distributorId: data.distributorId,
    //     imageUrl: data.imageUrl || '',
    //     storageUrl: data.storageUrl,
    //     category: data.category,
    //     brand: data.brand,
    //     createdAt: data.createdAt,
    //     prompt: data.prompt,
    //     referenceUrls: data.referenceUrls || [],
    //     embedding: data.embedding,
    //   })
    // })
    
    // return images
  } catch (error) {
    console.error('Error fetching distributor product images:', error)
    return []
  }
}

/**
 * Get a map of product ID to image URL for quick lookup
 */
export async function getProductImageMap(
  distributorId: string
): Promise<Map<string, string>> {
  const images = await getDistributorProductImages(distributorId, { limit: 1000 })
  const imageMap = new Map<string, string>()
  
  images.forEach((img) => {
    if (img.productId && img.imageUrl) {
      imageMap.set(img.productId, img.imageUrl)
    }
    
    // Also try to match by normalized product name
    if (img.productName && img.imageUrl) {
      const normalizedName = img.productName.toLowerCase().trim()
      imageMap.set(normalizedName, img.imageUrl)
    }
  })
  
  return imageMap
}

/**
 * Normalize a product identifier for matching
 * Removes special characters, extra spaces, and converts to lowercase
 */
export function normalizeProductId(id: string): string {
  return id
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
}

/**
 * Match a product with its generated image
 * Tries multiple matching strategies:
 * 1. Exact product ID match
 * 2. Normalized product name match
 * 3. Fuzzy name match (similar product names)
 */
export function matchProductImage(
  productName: string,
  productId: string,
  imageMap: Map<string, string>
): string | undefined {
  // Try exact product ID
  if (imageMap.has(productId)) {
    return imageMap.get(productId)
  }
  
  // Try normalized product name
  const normalized = normalizeProductId(productName)
  if (imageMap.has(normalized)) {
    return imageMap.get(normalized)
  }
  
  // Try direct name match
  const lowerName = productName.toLowerCase().trim()
  if (imageMap.has(lowerName)) {
    return imageMap.get(lowerName)
  }
  
  // Fuzzy match: find images with similar names
  for (const [key, url] of imageMap.entries()) {
    if (key.includes(lowerName) || lowerName.includes(key)) {
      return url
    }
  }
  
  return undefined
}
