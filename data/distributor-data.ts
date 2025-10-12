// Distributor data utilities for loading metadata and products

import samWestMetadata from './distributors/sam-west.json'
import mahitajiMetadata from './distributors/mahitaji.json'
import { sam_west_products } from './distributors/sam-west-products'
import { mahitaji_products } from './distributors/mahitaji-products'
import { getProductImageMap, matchProductImage } from '@/lib/firebase-product-images'

export interface DistributorContact {
  email: string
  phone: string
  address: string
}

export interface DistributorBusinessInfo {
  paymentTerms: string
  creditLimit: number
  taxRate: number
  minimumOrderValue: number
}

export interface DistributorLocation {
  city: string
  country: string
  address: string
  coordinates: {
    lat: number
    lng: number
  }
}

export interface DistributorStats {
  totalRetailers: number
  totalOrders: number
  totalProducts: number
  averageOrderValue: number
  onTimeDeliveryRate: number
}

export interface DistributorMetadata {
  id: string
  name: string
  displayName: string
  description: string
  logoUrl: string
  contact: DistributorContact
  businessInfo: DistributorBusinessInfo
  location: DistributorLocation
  stats: DistributorStats
  status: 'active' | 'inactive'
  connected: boolean
  categories: string[]
  pricelistSource: string
  lastUpdated: string
}

export interface DistributorProduct {
  id: number | string
  code: string
  name: string
  description?: string
  price?: number
  unitPrice?: number  // Keeping for backward compatibility
  wholesalePrice?: number
  unit: string
  category?: string
  brand?: string
  minOrderQuantity?: number
  leadTime?: string
  inStock: boolean
  image?: string
  imageUrl?: string  // Keeping for backward compatibility
  distributorName?: string
}

// All distributors metadata
export const distributors: Record<string, DistributorMetadata> = {
  'sam-west': samWestMetadata as DistributorMetadata,
  'mahitaji': mahitajiMetadata as DistributorMetadata,
}

// Get distributor by ID
export function getDistributor(id: string): DistributorMetadata | null {
  return distributors[id] || null
}

// Get all distributors
export function getAllDistributors(): DistributorMetadata[] {
  return Object.values(distributors)
}

// Convert extracted products to distributor product format
function convertToDistributorProduct(product: any): DistributorProduct {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    unitPrice: product.price,
    price: product.price,
    wholesalePrice: product.wholesalePrice,
    unit: product.unit,
    category: product.category,
    brand: product.brand,
    inStock: product.inStock,
    imageUrl: product.image,
    image: product.image,
    distributorName: product.distributorName,
    leadTime: product.distributorName === 'Sam West' ? '1-2 days' : '1-3 days'
  }
}

// All products for distributors (from extracted pricelists)
export const distributorProducts: Record<string, DistributorProduct[]> = {
  'sam-west': sam_west_products.map(convertToDistributorProduct),
  'mahitaji': mahitaji_products.map(convertToDistributorProduct)
}

// Get products for a distributor with pagination (synchronous, uses mock data)
export function getDistributorProducts(
  distributorId: string,
  page: number = 1,
  pageSize: number = 40
): { products: DistributorProduct[]; total: number; hasMore: boolean } {
  const allProducts = distributorProducts[distributorId] || []
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const products = allProducts.slice(startIndex, endIndex)
  
  return {
    products,
    total: allProducts.length,
    hasMore: endIndex < allProducts.length
  }
}

// Get products enriched with Firebase-generated images (async)
export async function getDistributorProductsWithImages(
  distributorId: string,
  page: number = 1,
  pageSize: number = 40
): Promise<{ products: DistributorProduct[]; total: number; hasMore: boolean }> {
  // Get base products
  const allProducts = distributorProducts[distributorId] || []
  
  try {
    // Fetch product images from Firebase
    const imageMap = await getProductImageMap(distributorId)
    
    // Enrich products with images
    const enrichedProducts = allProducts.map(product => {
      const imageUrl = matchProductImage(String(product.name), String(product.id), imageMap)
      return imageUrl ? { ...product, imageUrl, image: imageUrl } : product
    })
    
    // Apply pagination
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const products = enrichedProducts.slice(startIndex, endIndex)
    
    return {
      products,
      total: enrichedProducts.length,
      hasMore: endIndex < enrichedProducts.length
    }
  } catch (error) {
    console.error('Error enriching products with images:', error)
    // Fallback to original products without images
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const products = allProducts.slice(startIndex, endIndex)
    
    return {
      products,
      total: allProducts.length,
      hasMore: endIndex < allProducts.length
    }
  }
}
