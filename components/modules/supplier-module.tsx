"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { DollarSign, FileText, Package, Wallet, AlertCircle, Plus, Search, Filter, ChevronDown, Clock, MoreVertical, ArrowLeft, X, ClipboardList, Truck, RefreshCw, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog"
import { LoadingSpinner } from "../loading-spinner"

import { db } from "@/lib/firebase"
import { collection, query, orderBy, where, limit, startAfter, getDocs, addDoc, serverTimestamp, Timestamp } from "firebase/firestore"
import type { QueryConstraint } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { POS_PRODUCTS_COL, INVENTORY_COL } from "@/lib/pos-operations"
import { generateInvoiceNumber } from "@/lib/b2b-invoice-utils"

// Types for Firebase data
interface DistributorData {
  id: string
  name: string
  contact: {
    phone: string
    email: string
    address: string
  }
  paymentTerms: string
  creditLimit: number
  currentCredit: number
  status: 'active' | 'inactive'
  businessType: string
  description: string
  totalProducts: number
  totalRetailers: number
  totalOrders: number
  totalGMV: number
  lastActivity: string
  logoUrl?: string
  orgId?: string | null
  userId?: string | null
}

interface ProductData {
  id: string
  name: string
  sku: string
  unitPrice: number
  unit: string
  category: string
  minOrderQuantity: number
  leadTime: string
  inStock: boolean
  supplier: string
  barcode?: string
  brand: string
  distributorId: string
  distributorName: string
  createdAt: string
  updatedAt: string
  imageUrl?: string
}

interface InvoiceItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
  unit?: string
}

interface InvoicePayment {
  id: string
  amount: number
  date?: string
  method?: string
  reference?: string
  status?: string
}

interface InvoiceData {
  id: string
  supplierId: string
  supplierName: string
  invoiceDate: string
  dueDate: string
  status: string
  items: InvoiceItem[]
  subTotal: number
  tax: number
  total: number
  paymentTerms: string
  paymentStatus: string
  payments: InvoicePayment[]
  notes: string
}

interface RetailerData {
  id: string
  name: string
  organizationName: string
  contactNumber: string
  location: string
  coordinates?: { lat: number; lng: number }
  distributorId: string
  distributorName: string
  status: 'active' | 'inactive' | 'pending'
  joinDate: string
  lastOrderDate?: string
  totalOrders: number
  totalGMV: number
  creditLimit: number
  currentCredit: number
  paymentTerms: string
  businessType: string
  averageOrderValue: number
  orderFrequency: string
  topProducts: string[]
  lastActivity: string
}

interface GmvOrder {
  id: string
  createdAt: Date
  total: number
  status: string
}

interface SettlementRecord {
  id: string
  month: string
  gmv: number
  settlement: number
  status: string
  dueDate?: string
  paidDate?: string
  paidAmount?: number
}

// Pagination and state
const PRODUCTS_PER_PAGE = 20

interface LowStockProduct {
  productId: string
  productName: string
  supplierId?: string
  supplierName?: string
  brand?: string
  stockPieces: number
  reorderLevel: number
  unitsPerBase: number
  unitPrice: number
  retailUom?: string
}

interface PurchaseOrderDraftItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  unit?: string
}

const SupplierLogo = ({ supplier }: { supplier: DistributorData }) => {
  const [logoFailed, setLogoFailed] = useState(false)
  const fallbackLogo = supplier.name === 'Mahitaji Enterprises Ltd'
    ? '/images/mahitaji-logo.png'
    : '/images/sam-west-logo.png'
  const logoSrc = supplier.logoUrl ?? fallbackLogo
  const showLogo = Boolean(logoSrc) && !logoFailed

  return (
    <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 backdrop-blur-sm flex items-center justify-center group-hover:scale-105 transition-all duration-300 shadow-lg overflow-hidden">
      <span className={`absolute inset-0 flex items-center justify-center text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent transition-opacity duration-300 ${showLogo ? 'opacity-0' : 'opacity-100'}`}>
        {supplier.name.charAt(0)}
      </span>
      {showLogo && (
        <Image
          src={logoSrc}
          alt={`${supplier.name} logo`}
          width={80}
          height={80}
          unoptimized
          className="relative z-10 object-contain p-2"
          onError={() => setLogoFailed(true)}
        />
      )}
    </div>
  )
}

const ProductThumbnail = ({ product }: { product: ProductData }) => {
  const [imageFailed, setImageFailed] = useState(false)
  const imageSrc = product.imageUrl
  const showImage = Boolean(imageSrc) && !imageFailed

  return (
    <div className="relative w-full h-24 mb-3 rounded-xl overflow-hidden border border-white/10 bg-black/20">
      {showImage && imageSrc && (
        <Image
          src={imageSrc}
          alt={product.name}
          width={300}
          height={96}
          unoptimized
          className="object-cover w-full h-full"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className={`absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 transition-opacity duration-300 ${showImage ? 'opacity-0' : 'opacity-100'}`}>
        No image yet
      </div>
    </div>
  )
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const normalizePaymentTerms = (
  value?: string | null,
): 'cod' | 'net7' | 'net14' | 'net30' | 'net60' => {
  if (!value) return 'net30'
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '')
  switch (normalized) {
    case 'cod':
    case 'cashondelivery':
      return 'cod'
    case 'net7':
    case '7days':
      return 'net7'
    case 'net14':
    case '14days':
      return 'net14'
    case 'net60':
    case '60days':
      return 'net60'
    default:
      return 'net30'
  }
}

const formatCurrency = (value: number): string =>
  `KSh ${Number.isFinite(value) ? value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`

const toDateSafe = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toDate?: () => Date }
    if (typeof candidate.toDate === 'function') {
      try {
        return candidate.toDate()
      } catch (error) {
        console.warn('Failed to convert Firestore timestamp', error)
      }
    }
  }
  const asDate = new Date(value as string | number)
  return Number.isNaN(asDate.getTime()) ? null : asDate
}

const parseInvoiceItems = (value: unknown): InvoiceItem[] => {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const record = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
    const quantity = toNumber(record.quantity) ?? 0
    const unitPrice = toNumber(record.unitPrice) ?? 0
    const total = toNumber(record.total) ?? quantity * unitPrice
    return {
      productId: typeof record.productId === 'string' ? record.productId : '',
      productName: typeof record.productName === 'string' ? record.productName : '',
      quantity,
      unitPrice,
      total,
      unit: typeof record.unit === 'string' ? record.unit : undefined,
    }
  })
}

const parseInvoicePayments = (value: unknown): InvoicePayment[] => {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    const record = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
    return {
      id: typeof record.id === 'string' ? record.id : `payment-${index}`,
      amount: toNumber(record.amount) ?? 0,
      date: typeof record.date === 'string' ? record.date : undefined,
      method: typeof record.method === 'string' ? record.method : undefined,
      reference: typeof record.reference === 'string' ? record.reference : undefined,
      status: typeof record.status === 'string' ? record.status : undefined,
    }
  })
}

// ...existing code...

const getStatusColor = (status: string) => {
  switch (status) {
    case "paid":
      return "text-green-400 bg-green-500/20 border-green-500/30"
    case "pending":
      return "text-orange-400 bg-orange-500/20 border-orange-500/30"
    case "overdue":
      return "text-red-400 bg-red-500/20 border-red-500/30"
    default:
      return "text-slate-400 bg-slate-500/20 border-slate-500/30"
  }
}

export function SupplierModule() {
  const [activeView, setActiveView] = useState<'suppliers' | 'invoices' | 'retailers'>('suppliers')
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null)
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
  const [showSupplierDetails, setShowSupplierDetails] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<DistributorData | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  
  // Firebase state
  const [suppliers, setSuppliers] = useState<DistributorData[]>([])
  const [products, setProducts] = useState<ProductData[]>([])
  const [invoices, setInvoices] = useState<InvoiceData[]>([])
  const [retailers, setRetailers] = useState<RetailerData[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [loadingRetailers, setLoadingRetailers] = useState(false)
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerData | null>(null)
  const [showRetailerDetails, setShowRetailerDetails] = useState(false)
  const [supplierError, setSupplierError] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [retailerError, setRetailerError] = useState<string | null>(null)
  const [todoError, setTodoError] = useState<string | null>(null)
  const [todoLoading, setTodoLoading] = useState(false)
  const [todoMetrics, setTodoMetrics] = useState({
    pendingPurchaseOrders: 0,
    overdueDeliveries: 0,
    unpaidInvoices: 0,
    overdueInvoices: 0,
  })
  const [lowStockLoading, setLowStockLoading] = useState(false)
  const [lowStockError, setLowStockError] = useState<string | null>(null)
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([])
  const [showPurchaseOrderDialog, setShowPurchaseOrderDialog] = useState(false)
  const [poItems, setPoItems] = useState<PurchaseOrderDraftItem[]>([])
  const [creatingPurchaseOrder, setCreatingPurchaseOrder] = useState(false)
  const [createPoError, setCreatePoError] = useState<string | null>(null)
  
  // GMV and Settlement state
  const [gmvData, setGmvData] = useState({
    currentMonth: {
      gmv: 0,
      settlement: 0,
      orders: 0,
      date: new Date().toISOString().slice(0, 7) // YYYY-MM
    },
    previousMonth: {
      gmv: 0,
      settlement: 0,
      orders: 0,
      date: ''
    },
    totalUnpaid: 0,
    nextPaymentDue: '',
    settlementHistory: [] as Array<{
      id: string
      month: string
      gmv: number
      settlement: number
      status: 'pending' | 'paid' | 'overdue'
      dueDate: string
      paidDate?: string
      paidAmount?: number
    }>
  })
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Invoice creation state
  const [invoiceForm, setInvoiceForm] = useState({
    supplierId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    paymentTerms: 'net30',
    items: [] as Array<{
      productId: string
      productName: string
      quantity: number
      unitPrice: number
      total: number
    }>,
    notes: ''
  })
  
  const router = useRouter()
  const { toast } = useToast()
  const { user, userData } = useAuth()
  const orgId = userData?.organizationName ?? null
  const orgDisplayName = userData?.organizationDisplayName ?? userData?.organizationName ?? ''
  const isRetailerPersona = userData?.role === 'retailer'

  // Load suppliers from Firebase
  const loadSuppliers = useCallback(async () => {
    if (!orgId) {
      setSuppliers([])
      setSupplierError('Your organization is not linked to any suppliers yet.')
      return
    }

    try {
      setSupplierError(null)

      const distributorsRef = collection(db, 'distributors')
      const baseQuery = query(distributorsRef, where('orgId', '==', orgId))
      let snapshot = await getDocs(baseQuery)

      if (snapshot.empty && orgDisplayName) {
        const fallbackQuery = query(distributorsRef, where('organizationName', '==', orgDisplayName))
        snapshot = await getDocs(fallbackQuery)
      }

      const suppliersData: DistributorData[] = snapshot.docs.map((docSnap) => {
        const raw = docSnap.data() as Record<string, unknown>
        const contactRaw = (raw.contact ?? {}) as Record<string, unknown>

        return {
          id: docSnap.id,
          name: typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name : docSnap.id,
          contact: {
            phone: typeof contactRaw.phone === 'string' ? contactRaw.phone : '',
            email: typeof contactRaw.email === 'string' ? contactRaw.email : '',
            address: typeof contactRaw.address === 'string' ? contactRaw.address : '',
          },
          paymentTerms: typeof raw.paymentTerms === 'string' ? raw.paymentTerms : 'net30',
          creditLimit: toNumber(raw.creditLimit) ?? 0,
          currentCredit: toNumber(raw.currentCredit) ?? 0,
          status: (typeof raw.status === 'string' ? raw.status : 'inactive') as DistributorData['status'],
          businessType: typeof raw.businessType === 'string' ? raw.businessType : '',
          description: typeof raw.description === 'string' ? raw.description : '',
          totalProducts: toNumber(raw.totalProducts) ?? 0,
          totalRetailers: toNumber(raw.totalRetailers) ?? 0,
          totalOrders: toNumber(raw.totalOrders) ?? 0,
          totalGMV: toNumber(raw.totalGMV) ?? 0,
          lastActivity: typeof raw.lastActivity === 'string' ? raw.lastActivity : '',
          logoUrl: typeof raw.logoUrl === 'string' ? raw.logoUrl : undefined,
          orgId: typeof raw.orgId === 'string' ? raw.orgId : orgId,
          userId: typeof raw.userId === 'string' ? raw.userId : undefined,
        }
      })

      suppliersData.sort((a, b) => a.name.localeCompare(b.name))
      setSuppliers(suppliersData)

      if (!suppliersData.length) {
        setSupplierError('No suppliers found for your organization yet.')
      }
    } catch (error) {
      console.error('Error loading suppliers:', error)
      setSupplierError('Unable to load suppliers from Firestore')
      setSuppliers([])
      toast({
        title: 'Failed to load suppliers',
        description: 'We could not fetch supplier data. Please retry in a moment.',
        variant: 'destructive',
      })
    } finally {
    }
  }, [orgId, orgDisplayName, toast])

  const loadLowStockProducts = useCallback(async () => {
    if (!orgId) {
      setLowStockProducts([])
      return
    }

    try {
      setLowStockLoading(true)
      setLowStockError(null)

      const inventorySnapshot = await getDocs(
        query(
          collection(db, INVENTORY_COL),
          where('orgId', '==', orgId),
          limit(400)
        )
      )

      if (inventorySnapshot.empty) {
        setLowStockProducts([])
        return
      }

      const productsSnapshot = await getDocs(
        query(
          collection(db, POS_PRODUCTS_COL),
          where('orgId', '==', orgId),
          limit(500)
        )
      )

      const productMap = new Map<string, Record<string, unknown>>()
      productsSnapshot.forEach((docSnap) => {
        productMap.set(docSnap.id, docSnap.data() as Record<string, unknown>)
      })

      const candidates: LowStockProduct[] = []
      inventorySnapshot.forEach((docSnap) => {
        const raw = docSnap.data() as Record<string, unknown>
        const productId = typeof raw.productId === 'string' && raw.productId.length > 0
          ? raw.productId
          : docSnap.id.includes('_')
            ? docSnap.id.split('_')[1] ?? docSnap.id
            : docSnap.id

        const productRecord = productMap.get(productId) as Record<string, unknown> | undefined
        const unitsPerBase = Math.max(1, toNumber(raw.unitsPerBase) ?? toNumber(productRecord?.['unitsPerBase']) ?? 1)
        const qtyBase = toNumber(raw.qtyBase) ?? 0
        const qtyLoose = toNumber(raw.qtyLoose) ?? 0
        const stockPieces = qtyBase * unitsPerBase + qtyLoose

        const reorderCandidate = toNumber(raw.reorderLevel)
          ?? toNumber(productRecord?.['reorderLevel'])
          ?? unitsPerBase
        const reorderLevel = reorderCandidate && reorderCandidate > 0 ? reorderCandidate : unitsPerBase

        if (stockPieces > reorderLevel) {
          return
        }

        const unitPrice = toNumber(productRecord?.['piecePrice'])
          ?? toNumber(productRecord?.['unitPrice'])
          ?? toNumber(productRecord?.['price'])
          ?? 0

        const supplierId = typeof productRecord?.['supplierId'] === 'string'
          ? (productRecord?.['supplierId'] as string)
          : undefined
        const supplierName = typeof productRecord?.['supplier'] === 'string'
          ? (productRecord?.['supplier'] as string)
          : undefined

        candidates.push({
          productId,
          productName: typeof productRecord?.['name'] === 'string'
            ? (productRecord?.['name'] as string)
            : productId,
          supplierId,
          supplierName,
          brand: typeof productRecord?.['brand'] === 'string'
            ? (productRecord?.['brand'] as string)
            : undefined,
          stockPieces,
          reorderLevel,
          unitsPerBase,
          unitPrice,
          retailUom: typeof productRecord?.['retailUom'] === 'string'
            ? (productRecord?.['retailUom'] as string)
            : typeof productRecord?.['unit'] === 'string'
              ? (productRecord?.['unit'] as string)
              : undefined,
        })
      })

      candidates.sort((a, b) => a.stockPieces - b.stockPieces)
      setLowStockProducts(candidates)
    } catch (error) {
      console.error('Error loading low stock inventory:', error)
      setLowStockError('Unable to load low stock alerts right now')
    } finally {
      setLowStockLoading(false)
    }
  }, [orgId])

  // Load products with pagination
  const loadProducts = async (distributorId: string, page: number) => {
    try {
      setLoadingProducts(true)
      const productsRef = collection(db, 'distributors', distributorId, 'products')
      
      // Get total count for pagination
      const allProductsSnapshot = await getDocs(productsRef)
      const totalProducts = allProductsSnapshot.size
      const calculatedTotalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE)
      setTotalPages(calculatedTotalPages)
      
      // Get paginated products
      let q = query(
        productsRef,
        orderBy('name'),
        limit(PRODUCTS_PER_PAGE)
      )
      
      // If not first page, add startAfter for pagination
      if (page > 1) {
        const previousPageQuery = query(
          productsRef,
          orderBy('name'),
          limit((page - 1) * PRODUCTS_PER_PAGE)
        )
        const previousSnapshot = await getDocs(previousPageQuery)
        const lastDoc = previousSnapshot.docs[previousSnapshot.docs.length - 1]
        if (lastDoc) {
          q = query(
            productsRef,
            orderBy('name'),
            startAfter(lastDoc),
            limit(PRODUCTS_PER_PAGE)
          )
        }
      }
      
      const snapshot = await getDocs(q)
      const productsData: ProductData[] = []
      
      snapshot.forEach((doc) => {
        const data = doc.data() as ProductData
        productsData.push({ ...data, id: doc.id })
      })
      
      setProducts(productsData)
      setCurrentPage(page)
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  // Load invoices
  const loadInvoices = useCallback(async () => {
    if (!orgId) {
      setInvoices([])
      return
    }

    try {
      setLoadingInvoices(true)
      setInvoiceError(null)

      const invoicesRef = collection(db, 'invoices')

      const runQuery = async (constraints: QueryConstraint[]) => {
        try {
          return await getDocs(query(invoicesRef, ...constraints, orderBy('createdAt', 'desc'), limit(50)))
        } catch (error) {
          if (error instanceof Error && error.message.includes('requires an index')) {
            return getDocs(query(invoicesRef, ...constraints, limit(50)))
          }
          throw error
        }
      }

      let snapshot = await runQuery([where('supplierOrgId', '==', orgId)])
      if (snapshot.empty) {
        snapshot = await runQuery([where('supplierId', '==', orgId)])
      }

      const invoiceList: InvoiceData[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        return {
          id: docSnap.id,
          supplierId: typeof data.supplierId === 'string' ? data.supplierId : '',
          supplierName: typeof data.supplierName === 'string' ? data.supplierName : '',
          invoiceDate: typeof data.invoiceDate === 'string' ? data.invoiceDate : '',
          dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
          status: typeof data.status === 'string' ? data.status : 'draft',
          items: parseInvoiceItems(data.items),
          subTotal: toNumber(data.subTotal) ?? 0,
          tax: toNumber((data.taxAmount ?? data.tax)) ?? 0,
          total: toNumber(data.total) ?? 0,
          paymentTerms: typeof data.paymentTerms === 'string' ? data.paymentTerms : 'net30',
          paymentStatus: typeof data.paymentStatus === 'string' ? data.paymentStatus : 'pending',
          payments: parseInvoicePayments(data.payments),
          notes: typeof data.notes === 'string' ? data.notes : '',
        }
      })

      setInvoices(invoiceList)
    } catch (error) {
      console.error('Error loading invoices:', error)
      setInvoiceError('Unable to load invoices from Firestore')
      setInvoices([])
      toast({
        title: 'Failed to load invoices',
        description: 'We could not fetch invoices. Please check your connection and retry.',
        variant: 'destructive',
      })
    } finally {
      setLoadingInvoices(false)
    }
  }, [orgId, toast])

  // Create new invoice
  const createInvoice = async () => {
    try {
      if (!invoiceForm.supplierId || !invoiceForm.clientName || invoiceForm.items.length === 0) {
        toast({
          title: 'Missing invoice details',
          description: 'Fill in the client, select a supplier, and add at least one item.',
          variant: 'destructive',
        })
        return
      }

      // Calculate totals
      const subTotal = invoiceForm.items.reduce((sum, item) => sum + item.total, 0)
      const taxRate = 0.16 // 16% VAT
      const taxAmount = subTotal * taxRate
      const total = subTotal + taxAmount

      // Generate invoice number
  const supplier = suppliers.find(s => s.id === invoiceForm.supplierId)
  const invoiceNumber = generateInvoiceNumber(invoiceForm.supplierId || supplier?.id || orgId || 'vendai')

      // Calculate due date based on payment terms
  const invoiceDateObj = new Date(invoiceForm.invoiceDate)
  const dueDate = new Date(invoiceDateObj)
      
      switch (invoiceForm.paymentTerms) {
        case 'cod':
          // Due immediately
          break
        case 'net7':
          dueDate.setDate(dueDate.getDate() + 7)
          break
        case 'net14':
          dueDate.setDate(dueDate.getDate() + 14)
          break
        case 'net30':
        default:
          dueDate.setDate(dueDate.getDate() + 30)
          break
      }

      const newInvoice = {
        supplierId: invoiceForm.supplierId,
  supplierName: supplier?.name || '',
  supplierOrgId: supplier?.orgId ?? orgId ?? '',
        clientName: invoiceForm.clientName,
        clientEmail: invoiceForm.clientEmail,
        clientPhone: invoiceForm.clientPhone,
        clientAddress: invoiceForm.clientAddress,
        invoiceNumber: invoiceNumber,
        invoiceDate: invoiceForm.invoiceDate,
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'draft',
        items: invoiceForm.items,
        subTotal: subTotal,
        taxRate: taxRate,
        taxAmount: taxAmount,
        total: total,
        paymentTerms: invoiceForm.paymentTerms,
        paymentStatus: 'unpaid',
        payments: [],
        notes: invoiceForm.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }

      // Add invoice to Firebase
      const docRef = await addDoc(collection(db, 'invoices'), newInvoice)
      console.log('Invoice created with ID:', docRef.id)

      // Reset form
      setInvoiceForm({
        supplierId: '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        clientAddress: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        paymentTerms: 'net30',
        items: [],
        notes: ''
      })

      // Close dialog and refresh invoices
      setShowInvoiceDialog(false)
      await Promise.all([loadInvoices(), loadTodoMetrics()])

      toast({
        title: 'Invoice created',
        description: `Invoice ${invoiceNumber} saved to Firestore.`,
      })
    } catch (error) {
      console.error('Error creating invoice:', error)
      toast({
        title: 'Failed to create invoice',
        description: 'Please try again or check your connection.',
        variant: 'destructive',
      })
    }
  }

  // Handle page changes
  const handlePageChange = (page: number) => {
    if (selectedSupplier && page !== currentPage) {
      loadProducts(selectedSupplier.id, page)
    }
  }

  // Handle supplier selection
  const handleSupplierClick = (supplier: DistributorData) => {
    setSelectedSupplier(supplier)
    setShowSupplierDetails(true)
    setCurrentPage(1)
    loadProducts(supplier.id, 1)
  }

  // Handle back to suppliers
  const handleBackToSuppliers = () => {
    setShowSupplierDetails(false)
    setSelectedSupplier(null)
    setProducts([])
    setCurrentPage(1)
  }

  // Calculate low stock products for selected supplier
  const lowStockForSelectedSupplier = useMemo(() => {
    if (!selectedSupplier) return [] as LowStockProduct[]
    const normalizedId = selectedSupplier.id
    const normalizedName = selectedSupplier.name?.toLowerCase().trim() ?? ''
    return lowStockProducts.filter((product) => {
      if (product.supplierId && normalizedId && product.supplierId === normalizedId) {
        return true
      }
      if (product.supplierName && normalizedName) {
        return product.supplierName.toLowerCase().trim() === normalizedName
      }
      return false
    })
  }, [lowStockProducts, selectedSupplier])

  // Calculate PO totals
  const poTotals = useMemo(() => {
    const subtotal = poItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const tax = subtotal * 0.16
    const total = subtotal + tax
    return { subtotal, tax, total }
  }, [poItems])

  const openPurchaseOrderDialog = useCallback(() => {
    if (!lowStockForSelectedSupplier.length) return
    const defaults = lowStockForSelectedSupplier.slice(0, 10).map((product) => {
      const fallbackQuantity = Math.max(1, Math.round(product.reorderLevel || product.unitsPerBase || 1))
      const safePrice = product.unitPrice > 0 ? product.unitPrice : 1
      return {
        productId: product.productId,
        productName: product.productName,
        quantity: fallbackQuantity,
        unitPrice: safePrice,
        unit: product.retailUom ?? 'units',
      }
    })
    setPoItems(defaults)
    setCreatePoError(null)
    setShowPurchaseOrderDialog(true)
  }, [lowStockForSelectedSupplier])

  // Load retailers
  const loadRetailers = useCallback(async () => {
    if (!orgId) {
      setRetailers([])
      return
    }

    try {
      setLoadingRetailers(true)
      setRetailerError(null)

      const retailersRef = collection(db, 'retailers')

      const runRetailerQuery = async (includeOrder = true) => {
        try {
          const constraints: QueryConstraint[] = [where('distributorId', '==', orgId)]
          if (includeOrder) {
            constraints.push(orderBy('createdAt', 'desc'))
          }
          constraints.push(limit(50))
          return await getDocs(query(retailersRef, ...constraints))
        } catch (error) {
          if (includeOrder && error instanceof Error && error.message.includes('requires an index')) {
            return runRetailerQuery(false)
          }
          throw error
        }
      }

      const snapshot = await runRetailerQuery()
      const retailerList: RetailerData[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        const coordinates = data.coordinates as { lat?: number; lng?: number } | undefined

        const joinDateTimestamp = (data.createdAt as Timestamp | undefined)?.toDate?.() ?? toDateSafe(data.createdAt)
        const joinDate = joinDateTimestamp
          ? joinDateTimestamp.toISOString().split('T')[0]
          : (typeof data.joinDate === 'string' ? data.joinDate : '')

        return {
          id: docSnap.id,
          name: typeof data.name === 'string' ? data.name : (typeof data.organizationName === 'string' ? data.organizationName : docSnap.id),
          organizationName: typeof data.organizationName === 'string' ? data.organizationName : '',
          contactNumber: typeof data.contactNumber === 'string' ? data.contactNumber : '',
          location: typeof data.location === 'string' ? data.location : '',
          coordinates: coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number'
            ? { lat: coordinates.lat, lng: coordinates.lng }
            : undefined,
          distributorId: typeof data.distributorId === 'string' ? data.distributorId : orgId,
          distributorName: typeof data.distributorName === 'string' ? data.distributorName : orgDisplayName,
          status: typeof data.status === 'string' && ['active', 'inactive', 'pending'].includes(data.status) ? data.status as 'active' | 'inactive' | 'pending' : 'active',
          joinDate: joinDate || '',
          lastOrderDate: typeof data.lastOrderDate === 'string' ? data.lastOrderDate : undefined,
          totalOrders: toNumber(data.totalOrders) ?? 0,
          totalGMV: toNumber(data.totalGMV) ?? 0,
          creditLimit: toNumber(data.creditLimit) ?? 0,
          currentCredit: toNumber(data.currentCredit) ?? 0,
          paymentTerms: typeof data.paymentTerms === 'string' ? data.paymentTerms : 'net30',
          businessType: typeof data.businessType === 'string' ? data.businessType : '',
          averageOrderValue: toNumber(data.averageOrderValue) ?? 0,
          orderFrequency: typeof data.orderFrequency === 'string' ? data.orderFrequency : '',
          topProducts: Array.isArray(data.topProducts) ? data.topProducts as string[] : [],
          lastActivity: typeof data.lastActivity === 'string' ? data.lastActivity : '',
        }
      })

      setRetailers(retailerList)
      if (!retailerList.length) {
        setRetailerError('No retailers linked to your organization yet.')
      }
    } catch (error) {
      console.error('Error loading retailers:', error)
      setRetailerError('Unable to load retailers from Firestore')
      setRetailers([])
      toast({
        title: 'Failed to load retailers',
        description: 'We could not fetch retailer records. Please retry shortly.',
        variant: 'destructive',
      })
    } finally {
      setLoadingRetailers(false)
    }
  }, [orgId, orgDisplayName, toast])

  const loadTodoMetrics = useCallback(async () => {
    if (!orgId) {
      setTodoMetrics({
        pendingPurchaseOrders: 0,
        overdueDeliveries: 0,
        unpaidInvoices: 0,
        overdueInvoices: 0,
      })
      return
    }

    try {
      setTodoLoading(true)
      setTodoError(null)

      const [purchaseOrdersSnapshot, invoicesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'purchase_orders'), where('supplierId', '==', orgId), limit(200))),
        getDocs(query(collection(db, 'invoices'), where('supplierOrgId', '==', orgId), limit(200))),
      ])

      const now = new Date()

      let pendingPurchaseOrders = 0
      let overdueDeliveries = 0

      purchaseOrdersSnapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        const status = typeof data.status === 'string' ? data.status : 'draft'
        if (status === 'submitted') {
          pendingPurchaseOrders += 1
        }

        const expected = toDateSafe(data.expectedDeliveryDate)
        const fulfilled = status === 'fulfilled' || status === 'cancelled'
        if (expected && !fulfilled && expected < now) {
          overdueDeliveries += 1
        }
      })

      let unpaidInvoices = 0
      let overdueInvoices = 0

      invoicesSnapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        const paymentStatus = typeof data.paymentStatus === 'string' ? data.paymentStatus : 'pending'
        const invoiceStatus = typeof data.status === 'string' ? data.status : 'draft'
        if (paymentStatus === 'pending' || paymentStatus === 'partial') {
          unpaidInvoices += 1
        }
        if (invoiceStatus === 'overdue') {
          overdueInvoices += 1
        }
      })

      setTodoMetrics({
        pendingPurchaseOrders,
        overdueDeliveries,
        unpaidInvoices,
        overdueInvoices,
      })
    } catch (error) {
      console.error('Error loading distributor to-dos:', error)
      setTodoError('Unable to load distributor to-dos right now')
      toast({
        title: 'Failed to load to-do metrics',
        description: 'Please refresh in a moment.',
        variant: 'destructive',
      })
    } finally {
      setTodoLoading(false)
    }
  }, [orgId, toast])

  const updatePoItem = useCallback((productId: string, field: 'quantity' | 'unitPrice', rawValue: number) => {
    setPoItems((items) =>
      items.map((item) => {
        if (item.productId !== productId) return item
        if (field === 'quantity') {
          const safeValue = Number.isFinite(rawValue) ? Math.max(1, Math.round(rawValue)) : item.quantity
          return { ...item, quantity: safeValue }
        }
        const safePrice = Number.isFinite(rawValue) ? Math.max(0, rawValue) : item.unitPrice
        return { ...item, unitPrice: safePrice }
      }),
    )
  }, [])

  const removePoItem = useCallback((productId: string) => {
    setPoItems((items) => items.filter((item) => item.productId !== productId))
  }, [])

  const handleCreatePurchaseOrder = useCallback(async () => {
    if (!selectedSupplier) {
      setCreatePoError('Select a supplier before creating a purchase order.')
      return
    }
    if (!orgId) {
      setCreatePoError('Your organization is missing an identifier.')
      return
    }
    if (!user) {
      setCreatePoError('You must be signed in to submit a purchase order.')
      return
    }
    if (!poItems.length) {
      setCreatePoError('Add at least one item to the purchase order.')
      return
    }
    if (poTotals.total <= 0) {
      setCreatePoError('Update quantities or pricing to generate a valid total.')
      return
    }

    try {
      setCreatingPurchaseOrder(true)
      setCreatePoError(null)

      const paymentTerms = normalizePaymentTerms(selectedSupplier.paymentTerms)
      const expectedDeliveryDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
      const deliveryAddress = userData?.location || selectedSupplier.contact.address || 'Update delivery address'

      const payload = {
        retailerOrgId: orgId,
        supplierOrgId: selectedSupplier.orgId ?? selectedSupplier.id,
        retailerId: orgId,
        retailerName: orgDisplayName || orgId,
        retailerUserId: user.uid,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        supplierUserId: selectedSupplier.userId ?? undefined,
        createdByUserId: user.uid,
        createdByName: userData?.displayName ?? user.email ?? '',
        status: 'submitted' as const,
        paymentTerms,
        expectedDeliveryDate,
        deliveryAddress,
        notes: `Auto-generated from low stock alert for ${selectedSupplier.name} on ${new Date().toLocaleDateString()}`,
        items: poItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit,
        })),
        amount: {
          subtotal: Number(poTotals.subtotal.toFixed(2)),
          tax: Number(poTotals.tax.toFixed(2)),
          total: Number(poTotals.total.toFixed(2)),
          currency: 'KES',
        },
      }

      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(typeof errorPayload.error === 'string' ? errorPayload.error : 'Failed to create purchase order')
      }

      setShowPurchaseOrderDialog(false)
      setPoItems([])
      toast({
        title: 'Purchase order submitted',
        description: `Submitted ${poItems.length} low stock items to ${selectedSupplier.name}.`,
      })

      await Promise.all([loadTodoMetrics(), loadLowStockProducts()])
    } catch (error) {
      console.error('Failed to create purchase order', error)
      setCreatePoError(error instanceof Error ? error.message : 'Failed to create purchase order. Please try again.')
    } finally {
      setCreatingPurchaseOrder(false)
    }
  }, [selectedSupplier, orgId, user, poItems, poTotals, orgDisplayName, userData?.displayName, userData?.location, toast, loadTodoMetrics, loadLowStockProducts])

  // Load GMV and Settlement data
  const loadGMVData = useCallback(async () => {
    try {
      // Get current and previous month dates
      const currentDate = new Date()
      const currentMonth = currentDate.toISOString().slice(0, 7) // YYYY-MM
      const previousDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      const previousMonth = previousDate.toISOString().slice(0, 7)

      // Query orders from Firebase for GMV calculation
      const ordersQuery = query(
        collection(db, 'orders'),
        orderBy('createdAt', 'desc'),
        limit(100)
      )

      const ordersSnapshot = await getDocs(ordersQuery)
      const orders: GmvOrder[] = []

      ordersSnapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        const createdAt = toDateSafe(data.createdAt) ?? new Date()
        orders.push({
          id: docSnap.id,
          createdAt,
          total: toNumber(data.total) ?? 0,
          status: typeof data.status === 'string' ? data.status : 'pending',
        })
      })

      // Calculate current month GMV
      const currentMonthOrders = orders.filter(order => {
        const orderMonth = new Date(order.createdAt).toISOString().slice(0, 7)
        return orderMonth === currentMonth && order.status !== 'cancelled'
      })

      const currentMonthGMV = currentMonthOrders.reduce((sum, order) => sum + (order.total || 0), 0)
      const currentMonthSettlement = currentMonthGMV * 0.05 // 5% settlement

      // Calculate previous month GMV
      const previousMonthOrders = orders.filter(order => {
        const orderMonth = new Date(order.createdAt).toISOString().slice(0, 7)
        return orderMonth === previousMonth && order.status !== 'cancelled'
      })

      const previousMonthGMV = previousMonthOrders.reduce((sum, order) => sum + (order.total || 0), 0)
      const previousMonthSettlement = previousMonthGMV * 0.05

      // Query settlement history from Firebase
      const settlementsQuery = query(
        collection(db, 'settlements'),
        orderBy('month', 'desc'),
        limit(12)
      )

      let settlementHistory: SettlementRecord[] = []
      try {
        const settlementsSnapshot = await getDocs(settlementsQuery)
        settlementsSnapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>
          settlementHistory.push({
            id: docSnap.id,
            month: typeof data.month === 'string' ? data.month : '',
            gmv: toNumber(data.gmv) ?? 0,
            settlement: toNumber(data.settlement) ?? 0,
            status: typeof data.status === 'string' ? data.status : 'pending',
            dueDate: typeof data.dueDate === 'string' ? data.dueDate : undefined,
            paidDate: typeof data.paidDate === 'string' ? data.paidDate : undefined,
            paidAmount: (toNumber(data.paidAmount) ?? undefined),
          })
        })
      } catch (error) {
        console.warn('Falling back to sample settlement history', error)
        // Create sample settlement history if Firebase collection doesn't exist
        settlementHistory = [
          {
            id: 'SET001',
            month: previousMonth,
            gmv: previousMonthGMV || 1800000,
            settlement: previousMonthSettlement || 90000,
            status: 'pending',
            dueDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 15).toISOString().split('T')[0]
          },
          {
            id: 'SET002',
            month: new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1).toISOString().slice(0, 7),
            gmv: 1650000,
            settlement: 82500,
            status: 'paid',
            dueDate: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 15).toISOString().split('T')[0],
            paidDate: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 12).toISOString().split('T')[0],
            paidAmount: 82500
          }
        ]
      }

      // Calculate total unpaid settlements
      const totalUnpaid = settlementHistory
  .filter(settlement => settlement.status === 'pending' || settlement.status === 'overdue')
  .reduce((sum, settlement) => sum + settlement.settlement, 0)

      // Calculate next payment due date
      const nextPaymentDue = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 15).toISOString().split('T')[0]

      setGmvData({
        currentMonth: {
          gmv: currentMonthGMV || 0,
          settlement: currentMonthSettlement || 0,
          orders: currentMonthOrders.length,
          date: currentMonth
        },
        previousMonth: {
          gmv: previousMonthGMV || 0,
          settlement: previousMonthSettlement || 0,
          orders: previousMonthOrders.length,
          date: previousMonth
        },
        totalUnpaid,
        nextPaymentDue,
        settlementHistory: settlementHistory.map(record => ({
          ...record,
          status: ['pending', 'paid', 'overdue'].includes(record.status) ? record.status as 'pending' | 'paid' | 'overdue' : 'pending',
          dueDate: record.dueDate ?? ''
        }))
      })

    } catch (error) {
      console.error('Error loading GMV data:', error)
      // Set fallback sample data
      const currentDate = new Date()
      const currentMonth = currentDate.toISOString().slice(0, 7)
      const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString().slice(0, 7)

      setGmvData({
        currentMonth: {
          gmv: 2150000,
          settlement: 107500,
          orders: 145,
          date: currentMonth
        },
        previousMonth: {
          gmv: 1800000,
          settlement: 90000,
          orders: 120,
          date: previousMonth
        },
        totalUnpaid: 90000,
        nextPaymentDue: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 15).toISOString().split('T')[0],
        settlementHistory: [
          {
            id: 'SET001',
            month: previousMonth,
            gmv: 1800000,
            settlement: 90000,
            status: 'pending',
            dueDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 15).toISOString().split('T')[0]
          },
          {
            id: 'SET002',
            month: new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1).toISOString().slice(0, 7),
            gmv: 1650000,
            settlement: 82500,
            status: 'paid',
            dueDate: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 15).toISOString().split('T')[0],
            paidDate: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 12).toISOString().split('T')[0],
            paidAmount: 82500
          }
        ]
      })
    }
  }, [])

  // Filter products based on search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    if (isRetailerPersona && activeView === 'retailers') {
      setActiveView('suppliers')
      return
    }

    if (activeView === 'suppliers') {
      loadSuppliers()
      loadTodoMetrics()
      loadLowStockProducts()
    } else if (activeView === 'invoices') {
      loadInvoices()
    } else if (!isRetailerPersona && activeView === 'retailers') {
      loadRetailers()
      loadGMVData()
    }
  }, [activeView, isRetailerPersona, loadSuppliers, loadTodoMetrics, loadLowStockProducts, loadInvoices, loadRetailers, loadGMVData])

  const handleBackClick = () => {
    if (showSupplierDetails) {
      handleBackToSuppliers()
      return
    }
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      router.push('/modules')
    }, 200)
  }
  
  return (
    <motion.div 
      className="module-background flex flex-col h-[calc(100vh-2.5rem)] overflow-hidden"
      initial={{ x: 0, y: -300, rotate: 0, opacity: 0 }}
      animate={isExiting 
        ? { x: 0, y: -300, rotate: 0, opacity: 0 }
        : { x: 0, y: 0, rotate: 0, opacity: 1 }
      }
      transition={{ duration: 0.15, ease: [0.4, 0.0, 0.2, 1] }}
    >
  {/* Glassmorphic Header */}
  <div className="bg-slate-900/40 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            {/* Back Button */}
            <button 
              onClick={handleBackClick}
              className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <ArrowLeft className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
            </button>
            
            <div className="flex items-center space-x-2 p-1 backdrop-blur-md bg-gradient-to-r from-white/[0.08] to-white/[0.04] border border-white/[0.08] rounded-xl shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)]">
              <button
                type="button"
                className={`px-4 py-2 font-semibold text-base rounded-lg transition-all duration-300 relative
                  ${activeView === 'suppliers' 
                    ? 'text-purple-400 backdrop-blur-md bg-gradient-to-r from-purple-500/[0.15] to-purple-500/[0.08] border border-purple-500/30 shadow-[0_4px_16px_-8px_rgba(147,51,234,0.3)]' 
                    : 'text-slate-200 hover:text-purple-400 hover:bg-white/[0.05] backdrop-blur-sm'}`}
                onClick={() => setActiveView('suppliers')}
              >
                <span className="relative">
                  Suppliers
                  {activeView === 'suppliers' && (
                    <span className="absolute left-0 right-0 bottom-0 h-1 bg-gradient-to-r from-purple-400 via-purple-200 to-purple-400 rounded-full blur-sm animate-pulse"></span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className={`px-4 py-2 font-semibold text-base rounded-lg transition-all duration-300 relative
                  ${activeView === 'invoices' 
                    ? 'text-purple-400 backdrop-blur-md bg-gradient-to-r from-purple-500/[0.15] to-purple-500/[0.08] border border-purple-500/30 shadow-[0_4px_16px_-8px_rgba(147,51,234,0.3)]' 
                    : 'text-slate-200 hover:text-purple-400 hover:bg-white/[0.05] backdrop-blur-sm'}`}
                onClick={() => setActiveView('invoices')}
              >
                <span className="relative">
                  Invoices
                  {activeView === 'invoices' && (
                    <span className="absolute left-0 right-0 bottom-0 h-1 bg-gradient-to-r from-purple-400 via-purple-200 to-purple-400 rounded-full blur-sm animate-pulse"></span>
                  )}
                </span>
              </button>
              {!isRetailerPersona && (
                <button
                  type="button"
                  className={`px-4 py-2 font-semibold text-base rounded-lg transition-all duration-300 relative
                    ${activeView === 'retailers' 
                      ? 'text-purple-400 backdrop-blur-md bg-gradient-to-r from-purple-500/[0.15] to-purple-500/[0.08] border border-purple-500/30 shadow-[0_4px_16px_-8px_rgba(147,51,234,0.3)]' 
                      : 'text-slate-200 hover:text-purple-400 hover:bg-white/[0.05] backdrop-blur-sm'}`}
                  onClick={() => setActiveView('retailers')}
                >
                  <span className="relative">
                    Retailers
                    {activeView === 'retailers' && (
                      <span className="absolute left-0 right-0 bottom-0 h-1 bg-gradient-to-r from-purple-400 via-purple-200 to-purple-400 rounded-full blur-sm animate-pulse"></span>
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Input 
                placeholder={`Search ${activeView}...`}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="bg-gradient-to-r from-white/[0.08] to-white/[0.04] backdrop-blur-md border border-white/[0.08] hover:border-white/[0.15] text-white placeholder-slate-400 pr-8 w-64 transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] focus:shadow-[0_8px_24px_-8px_rgba(147,51,234,0.2)] focus:border-purple-400/30"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <div className="w-8 h-8 rounded-lg backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                  <Search className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            </div>
            <button className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <Filter className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
            </button>
            {activeView === 'invoices' && (
              <button 
                onClick={() => setShowInvoiceDialog(true)}
                className="group relative px-4 py-2 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-purple-400/30 flex items-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(147,51,234,0.2)] hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                <Plus className="relative w-4 h-4 mr-2 text-purple-400 group-hover:text-purple-300 transition-colors duration-300" />
                <span className="relative text-slate-200 group-hover:text-white transition-colors duration-300">
                  New Invoice
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'suppliers' ? (
          !showSupplierDetails ? (
            // Suppliers List View
            <div className="h-full overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <LoadingSpinner size="md" />
                </div>
              ) : (
                <div className="space-y-6 p-6">
                  <div className="rounded-3xl border border-white/[0.08] bg-slate-900/40 backdrop-blur-xl p-6 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.75)]">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-white">Distributor to-dos</h2>
                        <p className="text-sm text-slate-400">Pending approvals, deliveries, and payments</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadTodoMetrics}
                        disabled={todoLoading}
                        className="border-white/20 text-slate-200 hover:text-white"
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${todoLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                    {todoError ? (
                      <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {todoError}
                      </div>
                    ) : todoLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <LoadingSpinner size="sm" />
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="flex items-center justify-between rounded-2xl border border-purple-500/25 bg-purple-500/15 p-5">
                          <div>
                            <p className="text-sm text-purple-100/70">Pending PO approvals</p>
                            <p className="text-2xl font-semibold text-white">{todoMetrics.pendingPurchaseOrders}</p>
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/30">
                            <ClipboardList className="h-5 w-5 text-purple-100" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-orange-500/25 bg-orange-500/15 p-5">
                          <div>
                            <p className="text-sm text-orange-100/80">Overdue deliveries</p>
                            <p className="text-2xl font-semibold text-white">{todoMetrics.overdueDeliveries}</p>
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/30">
                            <Truck className="h-5 w-5 text-orange-100" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-rose-500/25 bg-rose-500/15 p-5">
                          <div>
                            <p className="text-sm text-rose-100/80">Unpaid invoices</p>
                            <p className="text-2xl font-semibold text-white">{todoMetrics.unpaidInvoices}</p>
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/30">
                            <AlertCircle className="h-5 w-5 text-rose-100" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border border-indigo-500/25 bg-indigo-500/15 p-5">
                          <div>
                            <p className="text-sm text-indigo-100/80">Overdue invoices</p>
                            <p className="text-2xl font-semibold text-white">{todoMetrics.overdueInvoices}</p>
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/30">
                            <FileText className="h-5 w-5 text-indigo-100" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {supplierError && (
                    <div
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        supplierError.toLowerCase().includes('unable')
                          ? 'border-red-500/40 bg-red-500/10 text-red-200'
                          : 'border-slate-500/40 bg-slate-800/40 text-slate-200'
                      }`}
                    >
                      {supplierError}
                    </div>
                  )}

                  {suppliers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.04] py-16 text-center text-slate-300">
                      <ClipboardList className="mb-4 h-10 w-10 text-purple-300" />
                      <p className="text-lg font-semibold text-white">No suppliers yet</p>
                      <p className="mt-1 max-w-md text-sm text-slate-400">
                        Connect your first distributor or import supplier data to populate this workspace.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {suppliers.map((supplier) => (
                        <div 
                          key={supplier.id}
                          onClick={() => handleSupplierClick(supplier)}
                          role="button"
                          tabIndex={0}
                          aria-label={`View details for ${supplier.name}`}
                          className="group relative cursor-pointer transform transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-3xl"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleSupplierClick(supplier)
                            }
                          }}
                        >
                          <div className="relative h-80 rounded-3xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] backdrop-blur-xl border border-white/[0.15] shadow-2xl group-hover:shadow-purple-500/20 transition-all duration-500 p-6 overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-400/15 transition-colors duration-700"></div>
                            <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-indigo-500/8 rounded-full blur-xl group-hover:bg-indigo-400/12 transition-colors duration-700"></div>

                            <div className="relative z-10 flex items-start justify-between mb-6">
                              <div className="flex items-center space-x-4">
                                <SupplierLogo supplier={supplier} />

                                <div className="flex-1">
                                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-purple-200 transition-colors duration-300 leading-tight">
                                    {supplier.name}
                                  </h3>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                                    <span className="text-emerald-400 text-sm font-medium">Verified Partner</span>
                                  </div>
                                </div>
                              </div>

                              <div className="group/verify relative flex-shrink-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400/20 to-amber-500/20 backdrop-blur-sm flex items-center justify-center group-hover/verify:rotate-12 group-hover:animate-spin transition-all duration-500 shadow-lg">
                                  <svg className="w-6 h-6 text-yellow-400 filter drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18l-1.45-1.32C5.4 13.36 2 9.28 2 5.5 2 3.42 3.42 2 5.5 2c1.74 0 3.41.81 4.5 2.09C11.09 2.81 12.76 2 14.5 2 16.58 2 18 3.42 18 5.5c0 3.78-3.4 7.86-6.55 11.18L10 18z" />
                                  </svg>
                                </div>
                                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-500/95 to-amber-500/95 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-xs font-medium opacity-0 group-hover/verify:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                                  Verified Supplier
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-yellow-500/95"></div>
                                </div>
                              </div>
                            </div>

                            <div className="relative z-10 grid grid-cols-2 gap-4 mb-6">
                              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-slate-300 text-xs font-medium">Products</span>
                                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                </div>
                                <div className="text-white text-xl font-bold">{supplier.totalProducts || 0}</div>
                                <div className="text-purple-400 text-xs">items available</div>
                              </div>

                              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-slate-300 text-xs font-medium">Retailers</span>
                                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                </div>
                                <div className="text-white text-xl font-bold">{supplier.totalRetailers || 0}</div>
                                <div className="text-green-400 text-xs">connected</div>
                              </div>
                            </div>

                            <div className="relative z-10 flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                                  <Package className="w-4 h-4 text-purple-400" />
                                </div>
                                <div>
                                  <div className="text-slate-300 text-xs">Total GMV</div>
                                  <div className="text-white font-semibold">KES {(supplier.totalGMV || 0).toLocaleString()}</div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2 text-slate-400 group-hover:text-purple-300 transition-colors duration-300">
                                <span className="text-sm font-medium">View Products</span>
                                <ArrowLeft className="w-4 h-4 rotate-180" />
                              </div>
                            </div>

                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-indigo-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Supplier Products Details View
            <div className="h-full flex flex-col">
              {/* Products Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Product Catalogue</h2>
                    <p className="text-slate-400">
                      Showing {Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length)} of {selectedSupplier?.totalProducts || 0} products
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    {/* Pagination Controls */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1 || loadingProducts}
                        className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        <ChevronDown className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300 rotate-90" />
                      </button>
                      
                      <div className="flex items-center space-x-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                        <span className="text-white text-sm font-medium">
                          Page {currentPage} of {totalPages}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || loadingProducts}
                        className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        <ChevronDown className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300 -rotate-90" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Products Grid */}
              <div className="px-6 pt-4">
                {lowStockError && (
                  <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {lowStockError}
                  </div>
                )}
                {lowStockLoading && (
                  <div className="mb-4 flex items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-6 text-amber-100">
                    <LoadingSpinner size="sm" />
                    <span className="ml-3 text-sm">Checking low stock alerts…</span>
                  </div>
                )}
                {!lowStockLoading && lowStockForSelectedSupplier.length > 0 && (
                  <div className="mb-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Low stock alerts</h3>
                        <p className="text-sm text-amber-100/80">
                          {selectedSupplier?.name ? `Reorder the flagged items from ${selectedSupplier.name}` : 'Reorder the flagged items'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-amber-100 hover:text-white"
                          onClick={() => loadLowStockProducts()}
                          disabled={lowStockLoading}
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${lowStockLoading ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                        <Button
                          onClick={openPurchaseOrderDialog}
                          className="bg-amber-500 text-slate-900 hover:bg-amber-400"
                          disabled={!lowStockForSelectedSupplier.length}
                        >
                          Create purchase order
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {lowStockForSelectedSupplier.slice(0, 4).map((product) => (
                        <div
                          key={product.productId}
                          className="flex items-center justify-between rounded-2xl border border-amber-500/25 bg-amber-500/15 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">{product.productName}</p>
                            <p className="text-xs text-amber-100/80">
                              {formatCurrency(product.unitPrice)} • In stock {product.stockPieces} • Reorder level {product.reorderLevel}
                            </p>
                          </div>
                          <span className="rounded-full bg-amber-500/30 px-3 py-1 text-xs font-medium text-amber-100">
                            {Math.max(product.reorderLevel - product.stockPieces, product.unitsPerBase || 0, 1)} recommended
                          </span>
                        </div>
                      ))}
                    </div>

                    {lowStockForSelectedSupplier.length > 4 && (
                      <p className="mt-3 text-xs text-amber-100/70">
                        +{lowStockForSelectedSupplier.length - 4} more items are below their reorder thresholds.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {loadingProducts ? (
                  <div className="flex items-center justify-center h-64">
                    <LoadingSpinner size="md" />
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="group relative cursor-pointer transform transition-all duration-300 hover:scale-[1.02] rounded-2xl"
                      >
                        {/* Product Card */}
                        <div className="relative h-48 rounded-2xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] backdrop-blur-xl border border-white/[0.15] shadow-lg group-hover:shadow-purple-500/20 transition-all duration-300 p-4 overflow-hidden">
                          
                          {/* Background orb */}
                          <div className="absolute -top-8 -right-8 w-20 h-20 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-400/15 transition-colors duration-500"></div>
                          
                          {/* Product Image (if available) */}
                          <div className="relative z-10">
                            <ProductThumbnail product={product} />
                          </div>

                          {/* Product Info */}
                          <div className="relative z-10 h-full flex flex-col">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="text-white font-semibold text-sm mb-1 line-clamp-2 group-hover:text-purple-200 transition-colors duration-300">
                                  {product.name}
                                </h4>
                                <p className="text-slate-400 text-xs">{product.brand}</p>
                              </div>
                              <div className={`w-2 h-2 rounded-full ${product.inStock ? 'bg-green-400' : 'bg-red-400'}`}></div>
                            </div>

                            {/* Category */}
                            <div className="mb-3">
                              <span className="inline-block px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-lg border border-purple-500/30">
                                {product.category}
                              </span>
                            </div>

                            {/* Price and Unit */}
                            <div className="mt-auto">
                              <div className="flex items-end justify-between">
                                <div>
                                  <div className="text-white text-lg font-bold">
                                    KES {product.unitPrice.toLocaleString()}
                                  </div>
                                  <div className="text-slate-400 text-xs">per {product.unit}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-slate-300 text-xs">MOQ</div>
                                  <div className="text-white text-sm font-semibold">{product.minOrderQuantity}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="text-white text-lg mb-2">No products found</div>
                      <div className="text-slate-400">Try adjusting your search terms</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        ) : activeView === 'invoices' ? (
          <div className="h-full overflow-y-auto">
            {loadingInvoices ? (
              <div className="flex h-full items-center justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <div className="p-6">
                {invoiceError && (
                  <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {invoiceError}
                  </div>
                )}

                {invoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.04] py-16 text-center text-slate-300">
                    <FileText className="mb-4 h-10 w-10 text-purple-300" />
                    <p className="text-lg font-semibold text-white">No invoices yet</p>
                    <p className="mt-1 max-w-md text-sm text-slate-400">
                      Generate invoices from purchase orders or upload existing bills to see them listed here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-white/[0.05] bg-white/[0.03]">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700/50">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Invoice #</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Supplier</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Due Date</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Amount</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Payment</th>
                          <th className="w-[40px]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice) => (
                          <tr 
                            key={invoice.id} 
                            className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedInvoice(invoice)}
                          >
                            <td className="py-3 px-4">
                              <div className="text-sm font-medium text-slate-200">{invoice.id}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm text-slate-200">{invoice.supplierName}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm text-slate-300">{invoice.invoiceDate}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm text-slate-300">{invoice.dueDate}</div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="text-sm font-mono text-purple-400">
                                {invoice.total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                              </div>
                              {invoice.paymentStatus === 'partial' && (
                                <div className="text-xs text-slate-400">
                                  Paid: {invoice.payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${getStatusColor(invoice.status)}`}>
                                <span className="capitalize">{invoice.status}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${getStatusColor(invoice.paymentStatus)}`}>
                                <span className="capitalize">{invoice.paymentStatus}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Button variant="ghost" size="icon">
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeView === 'retailers' ? (
          <div className="h-full overflow-y-auto">
            {loadingRetailers ? (
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <div className="p-6">
                {retailerError && (
                  <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {retailerError}
                  </div>
                )}

                {/* GMV & Settlement Tracking */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-white">GMV & Settlement Tracking</h2>
                    <div className="text-sm text-slate-400">
                      Settlement Rate: <span className="text-purple-400 font-medium">5% of GMV</span>
                    </div>
                  </div>
                  
                  {/* Current Month Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent p-4 rounded-xl border border-blue-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-blue-400 text-sm font-medium">Current Month GMV</p>
                          <p className="text-2xl font-bold text-white">
                            KSh {gmvData.currentMonth.gmv.toLocaleString('en-KE')}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {gmvData.currentMonth.orders} orders this month
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                          <DollarSign className="w-6 h-6 text-blue-400" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent p-4 rounded-xl border border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-purple-400 text-sm font-medium">Settlement Due</p>
                          <p className="text-2xl font-bold text-white">
                            KSh {gmvData.currentMonth.settlement.toLocaleString('en-KE')}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Due: {gmvData.nextPaymentDue}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-purple-400" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-transparent p-4 rounded-xl border border-orange-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-orange-400 text-sm font-medium">Previous Month</p>
                          <p className="text-2xl font-bold text-white">
                            KSh {gmvData.previousMonth.gmv.toLocaleString('en-KE')}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {gmvData.previousMonth.orders} orders
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                          <Clock className="w-6 h-6 text-orange-400" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-red-500/20 via-red-500/10 to-transparent p-4 rounded-xl border border-red-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-red-400 text-sm font-medium">Unpaid Settlements</p>
                          <p className="text-2xl font-bold text-white">
                            KSh {gmvData.totalUnpaid.toLocaleString('en-KE')}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {gmvData.settlementHistory.filter(s => s.status === 'pending' || s.status === 'overdue').length} pending
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                          <AlertCircle className="w-6 h-6 text-red-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Settlement History */}
                  <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Settlement History</h3>
                    <div className="space-y-3">
                      {gmvData.settlementHistory.slice(0, 6).map((settlement) => (
                        <div key={settlement.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div>
                              <p className="font-medium text-white">{settlement.month}</p>
                              <p className="text-sm text-slate-400">
                                GMV: KSh {settlement.gmv.toLocaleString('en-KE')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="font-medium text-white">
                                KSh {settlement.settlement.toLocaleString('en-KE')}
                              </p>
                              <p className="text-xs text-slate-400">
                                Due: {settlement.dueDate}
                              </p>
                            </div>
                            <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                              settlement.status === 'paid' 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : settlement.status === 'pending'
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                settlement.status === 'paid' ? 'bg-green-400' : 
                                settlement.status === 'pending' ? 'bg-orange-400' : 'bg-red-400'
                              }`} />
                              <span className="capitalize">{settlement.status}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {gmvData.settlementHistory.length > 6 && (
                      <div className="text-center mt-4">
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                          View All History
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Retailers Header */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Retailer Network</h2>
                  <p className="text-slate-400">Manage your retailer connections and track their activity</p>
                </div>

                {retailers.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.04] py-16 text-center text-slate-300">
                    <Package className="mx-auto mb-4 h-10 w-10 text-purple-300" />
                    <p className="text-lg font-semibold text-white">No retailers connected</p>
                    <p className="mt-1 max-w-xl mx-auto text-sm text-slate-400">
                      Invite retailers or approve pending applications to see engagement insights here.
                    </p>
                  </div>
                ) : (
                  <>
                {/* Retailers Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent p-4 rounded-xl border border-green-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-400 text-sm font-medium">Active Retailers</p>
                        <p className="text-2xl font-bold text-white">
                          {retailers.filter(r => r.status === 'active').length}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                        <Package className="w-6 h-6 text-green-400" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent p-4 rounded-xl border border-blue-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-400 text-sm font-medium">Total Orders</p>
                        <p className="text-2xl font-bold text-white">
                          {retailers.reduce((sum, r) => sum + r.totalOrders, 0)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-blue-400" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent p-4 rounded-xl border border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-400 text-sm font-medium">Total GMV</p>
                        <p className="text-2xl font-bold text-white">
                          KSh {retailers.reduce((sum, r) => sum + r.totalGMV, 0).toLocaleString('en-KE')}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-purple-400" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-transparent p-4 rounded-xl border border-orange-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-400 text-sm font-medium">Pending</p>
                        <p className="text-2xl font-bold text-white">
                          {retailers.filter(r => r.status === 'pending').length}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-orange-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Retailers List */}
                <div className="space-y-4">
                  {retailers.map((retailer) => (
                    <div 
                      key={retailer.id}
                      className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:bg-slate-800/70 transition-all duration-200 cursor-pointer"
                      onClick={() => {
                        setSelectedRetailer(retailer)
                        setShowRetailerDetails(true)
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">{retailer.organizationName}</h3>
                            <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                              retailer.status === 'active' 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : retailer.status === 'pending'
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                retailer.status === 'active' ? 'bg-green-400' : 
                                retailer.status === 'pending' ? 'bg-orange-400' : 'bg-red-400'
                              }`} />
                              <span className="capitalize">{retailer.status}</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-slate-400">Contact</p>
                              <p className="text-white font-medium">{retailer.contactNumber}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Location</p>
                              <p className="text-white font-medium">{retailer.location}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Total Orders</p>
                              <p className="text-white font-medium">{retailer.totalOrders}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Total GMV</p>
                              <p className="text-white font-medium">KSh {retailer.totalGMV.toLocaleString('en-KE')}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center space-x-4 text-sm">
                              <span className="text-slate-400">
                                Joined: <span className="text-white">{retailer.joinDate}</span>
                              </span>
                              {retailer.lastOrderDate && (
                                <span className="text-slate-400">
                                  Last Order: <span className="text-white">{retailer.lastOrderDate}</span>
                                </span>
                              )}
                              <span className="text-slate-400">
                                Avg Order: <span className="text-white">KSh {retailer.averageOrderValue.toLocaleString('en-KE')}</span>
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">
                              {retailer.lastActivity}
                            </div>
                          </div>

                          {retailer.topProducts.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-slate-400 mb-1">Top Products:</p>
                              <div className="flex flex-wrap gap-1">
                                {retailer.topProducts.slice(0, 3).map((product, index) => (
                                  <span key={index} className="px-2 py-1 bg-slate-700/50 text-xs text-slate-300 rounded">
                                    {product}
                                  </span>
                                ))}
                                {retailer.topProducts.length > 3 && (
                                  <span className="px-2 py-1 bg-slate-700/50 text-xs text-slate-400 rounded">
                                    +{retailer.topProducts.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="ml-4">
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Invoice Creation Dialog */}
      <Dialog
        open={showPurchaseOrderDialog}
        onOpenChange={(open) => {
          setShowPurchaseOrderDialog(open)
          if (!open) {
            setCreatePoError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Create purchase order</DialogTitle>
            <DialogDescription>
              Send a replenishment request to {selectedSupplier?.name ?? 'the supplier'} based on the low stock items below.
            </DialogDescription>
          </DialogHeader>

          {createPoError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {createPoError}
            </div>
          )}

          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-2">
            {poItems.length === 0 ? (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 px-4 py-6 text-center">
                <p className="text-sm text-slate-300">All low stock items are already at healthy levels. Refresh alerts to re-check.</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    loadLowStockProducts()
                    setShowPurchaseOrderDialog(false)
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh alerts
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {poItems.map((item) => (
                  <div key={item.productId} className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.productName}</p>
                        <p className="text-xs text-slate-300">{formatCurrency(item.unitPrice)} per {item.unit ?? 'unit'}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-slate-300 hover:text-white"
                        onClick={() => removePoItem(item.productId)}
                        disabled={creatingPurchaseOrder}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex flex-col text-xs font-medium text-slate-300">
                        Quantity
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantity}
                          onChange={(event) => updatePoItem(item.productId, 'quantity', Number(event.target.value))}
                          className="mt-1 bg-slate-900/80"
                          disabled={creatingPurchaseOrder}
                        />
                      </label>
                      <label className="flex flex-col text-xs font-medium text-slate-300">
                        Unit price
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={item.unitPrice}
                          onChange={(event) => updatePoItem(item.productId, 'unitPrice', Number(event.target.value))}
                          className="mt-1 bg-slate-900/80"
                          disabled={creatingPurchaseOrder}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-200">
              <div>
                <p className="font-semibold">Subtotal</p>
                <p>{formatCurrency(poTotals.subtotal)}</p>
              </div>
              <div>
                <p className="font-semibold">VAT (16%)</p>
                <p>{formatCurrency(poTotals.tax)}</p>
              </div>
              <div>
                <p className="font-semibold">Total</p>
                <p className="text-lg text-white">{formatCurrency(poTotals.total)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Payment terms: {normalizePaymentTerms(selectedSupplier?.paymentTerms ?? 'net30').toUpperCase()} • Delivery to {userData?.location || 'your default warehouse'}.
            </p>
          </div>

          <DialogFooter className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => {
                setShowPurchaseOrderDialog(false)
                setCreatePoError(null)
              }}
              disabled={creatingPurchaseOrder}
            >
              Cancel
            </Button>
            <Button
              className="w-full bg-amber-500 text-slate-900 hover:bg-amber-400 sm:w-auto"
              onClick={handleCreatePurchaseOrder}
              disabled={creatingPurchaseOrder || poItems.length === 0}
            >
              {creatingPurchaseOrder ? 'Submitting…' : 'Submit purchase order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
            <DialogDescription>
              Create a new supplier invoice or bill. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Client Information */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="clientName" className="text-right text-slate-400">
                Client Name *
              </label>
              <Input
                id="clientName"
                className="col-span-3"
                value={invoiceForm.clientName}
                onChange={(e) => setInvoiceForm({...invoiceForm, clientName: e.target.value})}
                placeholder="Enter client name"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="clientEmail" className="text-right text-slate-400">
                Client Email
              </label>
              <Input
                id="clientEmail"
                type="email"
                className="col-span-3"
                value={invoiceForm.clientEmail}
                onChange={(e) => setInvoiceForm({...invoiceForm, clientEmail: e.target.value})}
                placeholder="client@example.com"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="clientPhone" className="text-right text-slate-400">
                Client Phone
              </label>
              <Input
                id="clientPhone"
                className="col-span-3"
                value={invoiceForm.clientPhone}
                onChange={(e) => setInvoiceForm({...invoiceForm, clientPhone: e.target.value})}
                placeholder="+254712345678"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="supplier" className="text-right text-slate-400">
                Supplier *
              </label>
              <div className="col-span-3">
                <select
                  id="supplier"
                  className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  value={invoiceForm.supplierId}
                  onChange={(e) => setInvoiceForm({...invoiceForm, supplierId: e.target.value})}
                >
                  <option value="">Select a supplier...</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="date" className="text-right text-slate-400">
                Invoice Date
              </label>
              <Input
                id="date"
                type="date"
                className="col-span-3"
                value={invoiceForm.invoiceDate}
                onChange={(e) => setInvoiceForm({...invoiceForm, invoiceDate: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="terms" className="text-right text-slate-400">
                Payment Terms
              </label>
              <select
                id="terms"
                className="col-span-3 flex h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                value={invoiceForm.paymentTerms}
                onChange={(e) => setInvoiceForm({...invoiceForm, paymentTerms: e.target.value})}
              >
                <option value="cod">Cash on Delivery</option>
                <option value="net7">Net 7</option>
                <option value="net14">Net 14</option>
                <option value="net30">Net 30</option>
              </select>
            </div>

            {/* Products Section */}
            <div className="col-span-4 mt-4">
              <h4 className="font-medium mb-2">Products *</h4>
              <div className="border border-slate-700 rounded-md p-4 space-y-4">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-slate-400">
                  <div className="col-span-5">Product Name</div>
                  <div className="col-span-2">Quantity</div>
                  <div className="col-span-2">Unit Price</div>
                  <div className="col-span-2">Total</div>
                  <div className="col-span-1">Action</div>
                </div>
                
                {invoiceForm.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-5">
                      <Input
                        value={item.productName}
                        onChange={(e) => {
                          const newItems = [...invoiceForm.items]
                          newItems[index].productName = e.target.value
                          setInvoiceForm({...invoiceForm, items: newItems})
                        }}
                        placeholder="Product name"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...invoiceForm.items]
                          newItems[index].quantity = parseInt(e.target.value) || 0
                          newItems[index].total = newItems[index].quantity * newItems[index].unitPrice
                          setInvoiceForm({...invoiceForm, items: newItems})
                        }}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const newItems = [...invoiceForm.items]
                          newItems[index].unitPrice = parseFloat(e.target.value) || 0
                          newItems[index].total = newItems[index].quantity * newItems[index].unitPrice
                          setInvoiceForm({...invoiceForm, items: newItems})
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="font-mono text-sm">
                        KSh {item.total.toFixed(2)}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newItems = invoiceForm.items.filter((_, i) => i !== index)
                          setInvoiceForm({...invoiceForm, items: newItems})
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    const newItems = [...invoiceForm.items, {
                      productId: '',
                      productName: '',
                      quantity: 1,
                      unitPrice: 0,
                      total: 0
                    }]
                    setInvoiceForm({...invoiceForm, items: newItems})
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Product
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-4 items-start gap-4">
              <label htmlFor="notes" className="text-right text-slate-400 pt-2">
                Notes
              </label>
              <div className="col-span-3">
                <textarea
                  id="notes"
                  className="flex min-h-[60px] w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({...invoiceForm, notes: e.target.value})}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            {/* Totals */}
            <div className="col-span-4 border-t border-slate-700 pt-4">
              <div className="flex justify-between items-center text-sm">
                <span>Subtotal</span>
                <span className="font-mono">
                  KSh {invoiceForm.items.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span>VAT (16%)</span>
                <span className="font-mono">
                  KSh {(invoiceForm.items.reduce((sum, item) => sum + item.total, 0) * 0.16).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center font-medium mt-2 pt-2 border-t border-slate-700">
                <span>Total</span>
                <span className="font-mono text-green-400">
                  KSh {(invoiceForm.items.reduce((sum, item) => sum + item.total, 0) * 1.16).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>Cancel</Button>
            <Button onClick={createInvoice}>Create Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{selectedInvoice.supplierName}</h3>
                  <p className="text-sm text-slate-400">Invoice #{selectedInvoice.id}</p>
                </div>
                <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${getStatusColor(selectedInvoice.status)}`}>
                  <span className="capitalize">{selectedInvoice.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Invoice Date</p>
                  <p className="font-medium">{selectedInvoice.invoiceDate}</p>
                </div>
                <div>
                  <p className="text-slate-400">Due Date</p>
                  <p className="font-medium">{selectedInvoice.dueDate}</p>
                </div>
                <div>
                  <p className="text-slate-400">Payment Terms</p>
                  <p className="font-medium">{selectedInvoice.paymentTerms}</p>
                </div>
                <div>
                  <p className="text-slate-400">Payment Status</p>
                  <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border mt-1 ${getStatusColor(selectedInvoice.paymentStatus)}`}>
                    <span className="capitalize">{selectedInvoice.paymentStatus}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Items</h4>
                <div className="border border-slate-700 rounded-md divide-y divide-slate-700">
                  {selectedInvoice.items.map((item, index) => (
                    <div key={index} className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-slate-400">
                            {item.quantity} x KSh {item.unitPrice.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <p className="font-mono">
                          KSh {item.total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="font-mono">
                    KSh {selectedInvoice.subTotal.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">VAT (16%)</span>
                  <span className="font-mono">
                    KSh {selectedInvoice.tax.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t border-slate-700">
                  <span>Total</span>
                  <span className="font-mono text-green-400">
                    KSh {selectedInvoice.total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {selectedInvoice.payments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Payments</h4>
                  <div className="border border-slate-700 rounded-md divide-y divide-slate-700">
                    {selectedInvoice.payments.map((payment) => (
                      <div key={payment.id} className="p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium capitalize">{payment.method}</p>
                            <p className="text-sm text-slate-400">{payment.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono">
                              KSh {payment.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-slate-400">Ref: {payment.reference}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedInvoice.notes && (
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-slate-400">{selectedInvoice.notes}</p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedInvoice(null)}>Close</Button>
                {selectedInvoice.paymentStatus !== 'paid' && (
                  <Button>Record Payment</Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Retailer Details Dialog */}
      <Dialog open={showRetailerDetails} onOpenChange={() => setShowRetailerDetails(false)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Retailer Details</DialogTitle>
          </DialogHeader>
          
          {selectedRetailer && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold">{selectedRetailer.organizationName}</h3>
                  <p className="text-sm text-slate-400">{selectedRetailer.contactNumber}</p>
                  <p className="text-sm text-slate-400">{selectedRetailer.location}</p>
                </div>
                <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                  selectedRetailer.status === 'active' 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : selectedRetailer.status === 'pending'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    selectedRetailer.status === 'active' ? 'bg-green-400' : 
                    selectedRetailer.status === 'pending' ? 'bg-orange-400' : 'bg-red-400'
                  }`} />
                  <span className="capitalize">{selectedRetailer.status}</span>
                </div>
              </div>

              {/* Business Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-sm text-slate-400">Total Orders</p>
                  <p className="text-2xl font-bold text-white">{selectedRetailer.totalOrders}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-sm text-slate-400">Total GMV</p>
                  <p className="text-2xl font-bold text-white">KSh {selectedRetailer.totalGMV.toLocaleString('en-KE')}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-sm text-slate-400">Avg Order Value</p>
                  <p className="text-2xl font-bold text-white">KSh {selectedRetailer.averageOrderValue.toLocaleString('en-KE')}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg">
                  <p className="text-sm text-slate-400">Order Frequency</p>
                  <p className="text-2xl font-bold text-white capitalize">{selectedRetailer.orderFrequency}</p>
                </div>
              </div>

              {/* Account Information */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium">Account Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Join Date</span>
                      <span>{selectedRetailer.joinDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Business Type</span>
                      <span className="capitalize">{selectedRetailer.businessType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Payment Terms</span>
                      <span className="uppercase">{selectedRetailer.paymentTerms}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Last Activity</span>
                      <span>{selectedRetailer.lastActivity}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Credit Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Credit Limit</span>
                      <span>KSh {selectedRetailer.creditLimit.toLocaleString('en-KE')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current Credit</span>
                      <span className={selectedRetailer.currentCredit > 0 ? 'text-orange-400' : 'text-green-400'}>
                        KSh {selectedRetailer.currentCredit.toLocaleString('en-KE')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Available Credit</span>
                      <span className="text-green-400">
                        KSh {(selectedRetailer.creditLimit - selectedRetailer.currentCredit).toLocaleString('en-KE')}
                      </span>
                    </div>
                    {selectedRetailer.lastOrderDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Last Order</span>
                        <span>{selectedRetailer.lastOrderDate}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Products */}
              {selectedRetailer.topProducts.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Top Products</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedRetailer.topProducts.map((product, index) => (
                      <span key={index} className="px-3 py-1 bg-slate-700/50 text-sm text-slate-300 rounded-full">
                        {product}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="flex justify-between">
                <div className="flex space-x-2">
                  {selectedRetailer.status === 'pending' && (
                    <>
                      <Button variant="outline" size="sm">Approve</Button>
                      <Button variant="outline" size="sm">Reject</Button>
                    </>
                  )}
                  {selectedRetailer.status === 'active' && (
                    <Button variant="outline" size="sm">View Orders</Button>
                  )}
                </div>
                <Button variant="outline" onClick={() => setShowRetailerDetails(false)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}