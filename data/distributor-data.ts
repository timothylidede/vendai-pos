// Distributor data utilities for loading metadata and products

import samWestMetadata from './distributors/sam-west.json'
import mahitajiMetadata from './distributors/mahitaji.json'

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
  id: string
  code?: string
  name: string
  unitPrice: number
  unit: string
  category?: string
  brand?: string
  minOrderQuantity?: number
  leadTime?: string
  inStock: boolean
  imageUrl?: string
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

// Parse Mahitaji pricelist format
function parseMahitajiProduct(line: string, index: number): DistributorProduct | null {
  // Format: CODE ITEM UNIT PRICE
  // Example: KK061ACACIA KIDS APPLE 200MLX24CTN940.00
  
  const match = line.match(/^([A-Z0-9]+)(.+?)(CTN|PC|BALE|PKT|BAG|JAR|BUNDL|CARTON)([0-9,]+\.\d{2})/)
  
  if (!match) return null
  
  const [, code, itemName, unit, priceStr] = match
  const price = parseFloat(priceStr.replace(/,/g, ''))
  
  return {
    id: `mahitaji-${code.toLowerCase()}-${index}`,
    code: code.trim(),
    name: itemName.trim(),
    unitPrice: price,
    unit: unit,
    inStock: true,
    leadTime: '1-3 days'
  }
}

// Parse Sam West pricelist format
function parseSamWestProduct(line: string, index: number): DistributorProduct | null {
  // Format: # Description BUYING PRICE UNIT
  // Example: 110KG ABABIL PK 386 PARBOILED RICEKES 1,295.00Bag
  
  const match = line.match(/^(\d+)(.+?)KES\s+([0-9,]+\.\d{2})(.+)$/)
  
  if (!match) return null
  
  const [, itemCode, itemName, priceStr, unit] = match
  const price = parseFloat(priceStr.replace(/,/g, ''))
  
  return {
    id: `sam-west-${itemCode.trim()}-${index}`,
    code: itemCode.trim(),
    name: itemName.trim(),
    unitPrice: price,
    unit: unit.trim(),
    inStock: true,
    leadTime: '1-2 days'
  }
}

// Mock products for distributors (parsed from their pricelists)
export const distributorProducts: Record<string, DistributorProduct[]> = {
  'sam-west': [
    // From Sam West pricelist
    { id: 'sw-1', code: '1', name: 'RED BULL Energy Drink 250ml', unitPrice: 240, unit: 'PCS', brand: 'RED BULL', inStock: true, leadTime: '1-2 days', category: 'Beverages', imageUrl: '/images/distributors/products/sam-west/sw-1.jpg' },
    { id: 'sw-2', code: '2', name: 'AZAM Energy Drink 300ml', unitPrice: 86, unit: 'PCS', brand: 'AZAM', inStock: true, leadTime: '1-2 days', category: 'Beverages', imageUrl: '/images/distributors/products/sam-west/sw-2.jpg' },
    { id: 'sw-3', code: '3', name: 'PREDATOR Energy Drink 500ml', unitPrice: 140, unit: 'PCS', brand: 'PREDATOR', inStock: true, leadTime: '1-2 days', category: 'Beverages', imageUrl: '/images/distributors/products/sam-west/sw-3.jpg' },
    { id: 'sw-4', code: '4', name: 'Coca-Cola 500ml', unitPrice: 67, unit: 'PCS', brand: 'Coca-Cola', inStock: true, leadTime: '1-2 days', category: 'Beverages', imageUrl: '/images/distributors/products/sam-west/sw-4.jpg' },
    { id: 'sw-5', code: '5', name: 'Fanta Orange 500ml', unitPrice: 67, unit: 'PCS', brand: 'Fanta', inStock: true, leadTime: '1-2 days', category: 'Beverages', imageUrl: '/images/distributors/products/sam-west/sw-5.jpg' },
    { id: 'sw-6', code: '6', name: 'Sprite 500ml', unitPrice: 67, unit: 'PCS', brand: 'Sprite', inStock: true, leadTime: '1-2 days', category: 'Beverages', imageUrl: '/images/distributors/products/sam-west/sw-6.jpg' },
    { id: 'sw-7', code: '7', name: 'DETTOL Antiseptic Liquid 500ml', unitPrice: 485, unit: 'PCS', brand: 'DETTOL', inStock: true, leadTime: '1-2 days', category: 'Personal Care', imageUrl: '/images/distributors/products/sam-west/sw-7.jpg' },
    { id: 'sw-8', code: '8', name: 'SUNLIGHT Bar Soap 800g', unitPrice: 215, unit: 'PCS', brand: 'SUNLIGHT', inStock: true, leadTime: '1-2 days', category: 'Personal Care', imageUrl: '/images/distributors/products/sam-west/sw-8.jpg' },
    { id: 'sw-9', code: '9', name: 'OMO Washing Powder 2kg', unitPrice: 545, unit: 'PCS', brand: 'OMO', inStock: true, leadTime: '1-2 days', category: 'Personal Care', imageUrl: '/images/distributors/products/sam-west/sw-9.jpg' },
    { id: 'sw-10', code: '10', name: 'ARIEL Washing Powder 2kg', unitPrice: 585, unit: 'PCS', brand: 'ARIEL', inStock: true, leadTime: '1-2 days', category: 'Personal Care', imageUrl: '/images/distributors/products/sam-west/sw-10.jpg' },
    { id: 'sw-11', code: '11', name: '10KG ABABIL PK 386 PARBOILED RICE', unitPrice: 1295, unit: 'Bag', brand: 'ABABIL', inStock: true, leadTime: '1-2 days', category: 'Rice' },
    { id: 'sw-12', code: '12', name: '10KG AL-MAHAL BIRYANI RICE', unitPrice: 1030, unit: 'Bag', brand: 'AL-MAHAL', inStock: true, leadTime: '1-2 days', category: 'Rice' },
    { id: 'sw-13', code: '13', name: '10KG CROWN PK 386 BASMATI RICE', unitPrice: 1235, unit: 'Bag', brand: 'CROWN', inStock: true, leadTime: '1-2 days', category: 'Rice' },
    { id: 'sw-14', code: '14', name: '10KG FZAMI 1121 LONG GRAIN RICE', unitPrice: 2150, unit: 'Bag', brand: 'FZAMI', inStock: true, leadTime: '1-2 days', category: 'Rice' },
    { id: 'sw-15', code: '15', name: '10KG INDUS 1121 SELLA BASMATI RICE', unitPrice: 1815, unit: 'Bag', brand: 'INDUS', inStock: true, leadTime: '1-2 days', category: 'Rice' },
    { id: 'sw-16', code: '16', name: '210 ATTA MARK 1KG Wheat Flour', unitPrice: 90, unit: 'PCS', brand: '210', inStock: true, leadTime: '1-2 days', category: 'Flour' },
    { id: 'sw-17', code: '17', name: '210 ATTA MARK 2KG Wheat Flour', unitPrice: 180, unit: 'PCS', brand: '210', inStock: true, leadTime: '1-2 days', category: 'Flour' },
    { id: 'sw-18', code: '18', name: 'AJAB ATTA 2KG Wheat Flour', unitPrice: 175, unit: 'PCS', brand: 'AJAB', inStock: true, leadTime: '1-2 days', category: 'Flour' },
    { id: 'sw-19', code: '19', name: '25KG SUGAR (small bag)', unitPrice: 3600, unit: 'Bag', brand: 'MUMIAS', inStock: true, leadTime: '1-2 days', category: 'Sugar' },
    { id: 'sw-20', code: '20', name: 'PEMBE Maize Flour 2kg', unitPrice: 155, unit: 'PCS', brand: 'PEMBE', inStock: true, leadTime: '1-2 days', category: 'Flour' },
  ],
  'mahitaji': [
    { id: 'mh-1', code: 'KK061', name: 'ACACIA KIDS APPLE 200MLX24', unitPrice: 940, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Beverages' },
    { id: 'mh-2', code: 'KK062', name: 'ACACIA KIDS BLK CURRNT 200MLX24', unitPrice: 940, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Beverages' },
    { id: 'mh-3', code: 'KK063', name: 'ACACIA KIDS BLUE RASPBRY 200MLX24', unitPrice: 940, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Beverages' },
    { id: 'mh-4', code: 'KK065', name: 'ACACIA KIDS S/BRY 200MLX24', unitPrice: 940, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Beverages' },
    { id: 'mh-5', code: 'KK066', name: 'ACACIA TETRA APPLE 250MLX24', unitPrice: 1321, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Beverages' },
    { id: 'mh-6', code: 'KK049', name: 'AFIA RTD 1.5LTRX6 TROPICAL', unitPrice: 915, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Beverages' },
    { id: 'mh-7', code: 'KK010', name: 'AFIA RTD 300MLX12 MULTI-VITAMIN', unitPrice: 541, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Beverages' },
    { id: 'mh-8', code: 'KK006', name: 'AFIA RTD APPLE 500MLX12', unitPrice: 721, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Beverages' },
    { id: 'mh-9', code: '5173', name: 'AFYA HERBAL SALT 200GX12', unitPrice: 1430, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Food' },
    { id: 'mh-10', code: '2120', name: 'AFYA PURE HONEY BOTTLE 500X12', unitPrice: 5046, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Food' },
    { id: 'mh-11', code: '3225', name: 'AFYA PURE SEA SALT 500GX12', unitPrice: 1893, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Food' },
    { id: 'mh-12', code: '1114', name: 'AFYA PURE.HONEY 1KGX6 JAR', unitPrice: 4682, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Food' },
    { id: 'mh-13', code: '3790', name: 'AJAB ATTA 12X2KG OFFER', unitPrice: 1810, unit: 'BALE', inStock: true, leadTime: '1-3 days', category: 'Flour' },
    { id: 'mh-14', code: '3782', name: 'AJAB H/B 12X2KG OFFER', unitPrice: 1860, unit: 'BALE', inStock: true, leadTime: '1-3 days', category: 'Flour' },
    { id: 'mh-15', code: '3792', name: 'AJAB SELFRAISING 12X2KG OFFER', unitPrice: 1810, unit: 'BALE', inStock: true, leadTime: '1-3 days', category: 'Flour' },
    { id: 'mh-16', code: 'UL019', name: 'AMANA LONG GRAIN RICE 1KG X 24', unitPrice: 3335, unit: 'BALE', inStock: true, leadTime: '1-3 days', category: 'Grains' },
    { id: 'mh-17', code: 'UL018', name: 'AMANA LONG GRAIN RICE 2KG X 12', unitPrice: 3300, unit: 'BALE', inStock: true, leadTime: '1-3 days', category: 'Grains' },
    { id: 'mh-18', code: '1105', name: 'AMANA NYAYO BEANS 1KGX24', unitPrice: 5000, unit: 'BALE', inStock: true, leadTime: '1-3 days', category: 'Grains' },
    { id: 'mh-19', code: 'UL022', name: 'AMANA SPAGHETTI 20 X 400GM', unitPrice: 1245, unit: 'CTN', inStock: true, leadTime: '1-3 days', category: 'Food' },
    { id: 'mh-20', code: 'UL027', name: 'AMANA YELLOW BEANS 12 X 1KG(NEW PACK)', unitPrice: 2825, unit: 'BALE', inStock: true, leadTime: '1-3 days', category: 'Grains' },
  ]
}

// Get products for a distributor with pagination
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
