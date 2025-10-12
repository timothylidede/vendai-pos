import type {
  POSCheckoutContext,
  POSOrderStatus,
  POSPayment,
  POSPaymentSummary,
  POSReceipt,
} from '@/types/pos'
export interface OrderItem {
  id: number
  name: string
  price: number
  quantity: number
  category: string
  image?: string
}

export interface Order {
  id: string
  userId: string
  items: CartItem[]
  total: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "completed"
  createdAt: string // Change from Date
  updatedAt: string // Change from Date
  shippingAddress?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  paymentMethod?: string
  paymentStatus?: "pending" | "paid" | "failed"
  orderNumber?: string
  date: string
  assignedDistributor?: string
  distributorStatus?: "pending" | "assigned" | "accepted" | "preparing" | "shipped" | "delivered"
  deliveryAddress?: {
    address: string
    location: { lat: number; lng: number }
    notes: string
  }
  deliveryDate?: string
  customerName?: string // Add
  customerPhone?: string // Add
}

export interface Product {
  id: number
  name: string
  description: string
  price: number
  category: string
  brand?: string
  image?: string
  inStock: boolean
  stock?: number
  unit: string
  code?: string
  size?: string
  wholesaleQuantity?: number
  distributorName?: string
  // Units of Measure (optional, for POS/inventory conversions)
  baseUom?: UnitCode // e.g., CTN (carton) stored at supplier/inventory level
  retailUom?: UnitCode // e.g., PCS
  unitsPerBase?: number // how many retail units per base unit
  pieceBarcode?: string
  cartonBarcode?: string
  allowBreak?: boolean // whether breaking base packs is allowed
  retailPrice?: number // explicit per-piece POS price (if different from price)
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image?: string
  category: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  products?: Product[]
  timestamp?: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  products?: Product[] // Added to match Message
}

export interface ChatSession {
  id: string
  userId: string
  title: string
  messages: ChatMessage[]
  isActive: boolean
  createdAt: string
  updatedAt: string
  date: string
}

export interface UserData {
  uid: string
  name: string | null
  displayName?: string | null
  email: string | null
  phone: string | null
  photoURL: string | null
  provider: string
  address?: string
  city?: string
  area?: string
  role?: "admin" | "distributor" | "customer"
  createdAt: string
  updatedAt: string
  isNew?: boolean
}

export interface User {
  uid: string
  email: string
  displayName?: string
  role: "customer" | "admin" | "distributor"
}

export interface Distributor {
  id: string
  name: string
  email: string
  phone: string
  address: string
  area: string
  isActive: boolean
  assignedOrders: string[]
  completedOrders: number
  rating: number
  createdAt: string
  updatedAt: string
}

export interface OrderAssignment {
  id: string
  orderId: string
  distributorId: string
  assignedAt: string
  status: "pending" | "accepted" | "rejected" | "completed"
  notes?: string
}

export interface Analytics {
  totalOrders: number
  totalRevenue: number
  totalUsers: number
  topProducts: Array<{
    id: number
    name: string
    sales: number
  }>
  recentOrders: Order[]
}

export interface DashboardMetrics {
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  pendingOrders: number
  completedOrders: number
  activeDistributors: number
  revenueGrowth: number
  orderGrowth: number
  userGrowth: number
}

export interface ChatHistory {
  id: string
  userId: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

// New: standardized unit codes and POS/Inventory types
export type UnitCode =
  | 'CTN' // Carton
  | 'BOX'
  | 'PKT' // Packet
  | 'BAG'
  | 'BOTTLE'
  | 'JAR'
  | 'PCS' // Piece (retail)
  | 'DOZ' // Dozen
  | string

export interface PackagingSpec {
  baseUom: UnitCode
  retailUom: UnitCode
  unitsPerBase: number
  allowBreak: boolean
}

export interface POSProduct {
  id: string
  name: string
  brand?: string
  category?: string
  image?: string
  baseUom: UnitCode
  retailUom: UnitCode
  unitsPerBase: number
  pieceBarcode?: string
  cartonBarcode?: string
  piecePrice: number
  cartonPrice?: number // optional wholesale price for reference
  reorderPoint?: number // trigger replenishment when stock falls below this
  reorderQty?: number // suggested quantity to reorder
  preferredSupplierId?: string // default supplier for auto-replenishment
  barcodeType?: 'standard' | 'weight-embedded' // For barcode scale support
  pricePerKg?: number // Price per kilogram for weight-based products
}

export interface InventoryRecord {
  productId: string
  orgId: string
  qtyBase: number // stored wholesale count (e.g., cartons)
  qtyLoose: number // leftover loose pieces out of base packs
  unitsPerBase: number // denormalized for fast math
  updatedAt: string
  updatedBy: string
  avgUnitCost?: number // optional costing
}

export interface POSOrderLine {
  productId: string
  name: string
  quantityPieces: number
  unitPrice: number // per piece
  lineTotal: number
}

export interface POSOrderDoc {
  id?: string
  orgId: string
  userId: string
  cashierId?: string
  lines: POSOrderLine[]
  payments: POSPayment[]
  total: number
  balanceDue: number
  createdAt: string
  completedAt?: string | null
  status: POSOrderStatus
  receiptNumber?: string
  checkoutContext?: POSCheckoutContext
  receipt?: POSReceipt
  paymentSummary?: POSPaymentSummary
  updatedAt?: string
  notes?: string
  paymentMethod?: string
  paymentRef?: string
  // Multi-lane support
  deviceId?: string
  laneId?: string
}