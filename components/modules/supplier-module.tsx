"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DollarSign, FileText, Package, Wallet, AlertCircle, Plus, Search, Filter, ChevronDown, Clock, MoreVertical, ArrowLeft, X } from "lucide-react"
import { motion } from "framer-motion"
import { Card } from "../ui/card"
import { LazyImage } from "@/lib/performance-utils"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs"
import { LoadingSpinner } from "../loading-spinner"

import { db } from "@/lib/firebase"
import { collection, query, orderBy, limit, startAfter, getDocs, addDoc, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"

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
}

interface InvoiceData {
  id: string
  supplierId: string
  supplierName: string
  invoiceDate: string
  dueDate: string
  status: string
  items: any[]
  subTotal: number
  tax: number
  total: number
  paymentTerms: string
  paymentStatus: string
  payments: any[]
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

interface OrderData {
  id: string
  retailerId: string
  retailerName: string
  distributorId: string
  distributorName: string
  orderDate: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  items: Array<{
    productId: string
    productName: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subTotal: number
  tax: number
  total: number
  paymentMethod: string
  paymentStatus: 'pending' | 'paid' | 'partial'
  deliveryDate?: string
  deliveryAddress: string
  notes?: string
}

// Pagination and state
const PRODUCTS_PER_PAGE = 20

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
  const [isEntering, setIsEntering] = useState(true)
  const [isExiting, setIsExiting] = useState(false)
  
  // Firebase state
  const [suppliers, setSuppliers] = useState<DistributorData[]>([])
  const [products, setProducts] = useState<ProductData[]>([])
  const [invoices, setInvoices] = useState<InvoiceData[]>([])
  const [retailers, setRetailers] = useState<RetailerData[]>([])
  const [orders, setOrders] = useState<OrderData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [loadingRetailers, setLoadingRetailers] = useState(false)
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerData | null>(null)
  const [showRetailerDetails, setShowRetailerDetails] = useState(false)
  
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

  // Load suppliers from Firebase
  const loadSuppliers = async () => {
    try {
      setLoading(true)
      const distributorsRef = collection(db, 'distributors')
      const snapshot = await getDocs(distributorsRef)
      
      const suppliersData: DistributorData[] = []
      snapshot.forEach((doc) => {
        const data = doc.data() as DistributorData
        suppliersData.push({ ...data, id: doc.id })
      })
      
      setSuppliers(suppliersData)
    } catch (error) {
      console.error('Error loading suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

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
  const loadInvoices = async () => {
    try {
      setLoadingInvoices(true)
      
      // Query invoices from Firebase
      const invoicesQuery = query(
        collection(db, 'invoices'), 
        orderBy('createdAt', 'desc'),
        limit(50)
      )
      
      const snapshot = await getDocs(invoicesQuery)
      const invoiceList: InvoiceData[] = []
      
      snapshot.forEach((doc) => {
        const data = doc.data()
        invoiceList.push({
          id: doc.id,
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          invoiceDate: data.invoiceDate,
          dueDate: data.dueDate,
          status: data.status,
          items: data.items || [],
          subTotal: data.subTotal,
          tax: data.taxAmount,
          total: data.total,
          paymentTerms: data.paymentTerms,
          paymentStatus: data.paymentStatus,
          payments: data.payments || [],
          notes: data.notes || ''
        })
      })
      
      setInvoices(invoiceList)
    } catch (error) {
      console.error('Error loading invoices:', error)
      // Fallback to sample data if Firebase fails
      const sampleInvoices: InvoiceData[] = [
        {
          id: "INV001",
          supplierId: "mahitaji_enterprises",
          supplierName: "Mahitaji Enterprises Ltd",
          invoiceDate: "2025-09-19",
          dueDate: "2025-10-19",
          status: "posted",
          items: [],
          subTotal: 45000,
          tax: 7200,
          total: 52200,
          paymentTerms: "Net 30",
          paymentStatus: "unpaid",
          payments: [],
          notes: "Monthly product supply"
        }
      ]
      setInvoices(sampleInvoices)
    } finally {
      setLoadingInvoices(false)
    }
  }

  // Create new invoice
  const createInvoice = async () => {
    try {
      if (!invoiceForm.supplierId || !invoiceForm.clientName || invoiceForm.items.length === 0) {
        alert('Please fill in all required fields and add at least one item')
        return
      }

      // Calculate totals
      const subTotal = invoiceForm.items.reduce((sum, item) => sum + item.total, 0)
      const taxRate = 0.16 // 16% VAT
      const taxAmount = subTotal * taxRate
      const total = subTotal + taxAmount

      // Generate invoice number
      const supplier = suppliers.find(s => s.id === invoiceForm.supplierId)
      const prefix = supplier?.name === 'Mahitaji Enterprises Ltd' ? 'MH-INV' : 'SW-INV'
      const invoiceNumber = `${prefix}-${Date.now().toString().slice(-6)}`

      // Calculate due date based on payment terms
      const invoiceDateObj = new Date(invoiceForm.invoiceDate)
      let dueDate = new Date(invoiceDateObj)
      
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
      loadInvoices()
      
      alert('Invoice created successfully!')
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert('Failed to create invoice. Please try again.')
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

  // Load retailers
  const loadRetailers = async () => {
    try {
      setLoadingRetailers(true)
      
      // Query retailers from Firebase
      const retailersQuery = query(
        collection(db, 'retailers'), 
        orderBy('createdAt', 'desc'),
        limit(50)
      )
      
      const snapshot = await getDocs(retailersQuery)
      const retailerList: RetailerData[] = []
      
      snapshot.forEach((doc) => {
        const data = doc.data()
        retailerList.push({
          id: doc.id,
          name: data.name || data.organizationName,
          organizationName: data.organizationName,
          contactNumber: data.contactNumber,
          location: data.location,
          coordinates: data.coordinates,
          distributorId: data.distributorId || 'mahitaji_enterprises',
          distributorName: data.distributorName || 'Mahitaji Enterprises Ltd',
          status: data.status || 'active',
          joinDate: data.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0] || data.joinDate || '2025-09-19',
          lastOrderDate: data.lastOrderDate,
          totalOrders: data.totalOrders || 0,
          totalGMV: data.totalGMV || 0,
          creditLimit: data.creditLimit || 100000,
          currentCredit: data.currentCredit || 0,
          paymentTerms: data.paymentTerms || 'net30',
          businessType: data.businessType || 'retail',
          averageOrderValue: data.averageOrderValue || 0,
          orderFrequency: data.orderFrequency || 'weekly',
          topProducts: data.topProducts || [],
          lastActivity: data.lastActivity || 'Online now'
        })
      })
      
      setRetailers(retailerList)
    } catch (error) {
      console.error('Error loading retailers:', error)
      // Fallback to sample data if Firebase fails
      const sampleRetailers: RetailerData[] = [
        {
          id: "RET001",
          name: "Mama Pendo Shop",
          organizationName: "Mama Pendo Shop",
          contactNumber: "+254 712 345 678",
          location: "Nairobi",
          distributorId: "mahitaji_enterprises",
          distributorName: "Mahitaji Enterprises Ltd",
          status: "active",
          joinDate: "2025-08-15",
          lastOrderDate: "2025-09-18",
          totalOrders: 24,
          totalGMV: 340000,
          creditLimit: 150000,
          currentCredit: 45000,
          paymentTerms: "net30",
          businessType: "retail",
          averageOrderValue: 14167,
          orderFrequency: "weekly",
          topProducts: ["Rice", "Sugar", "Cooking Oil"],
          lastActivity: "2 hours ago"
        },
        {
          id: "RET002",
          name: "Kinyozi Modern Store",
          organizationName: "Kinyozi Modern Store",
          contactNumber: "+254 798 765 432",
          location: "Mombasa",
          distributorId: "sam_west_supermarket",
          distributorName: "Sam West Supermarket",
          status: "active",
          joinDate: "2025-07-22",
          lastOrderDate: "2025-09-17",
          totalOrders: 18,
          totalGMV: 280000,
          creditLimit: 120000,
          currentCredit: 32000,
          paymentTerms: "net15",
          businessType: "retail",
          averageOrderValue: 15556,
          orderFrequency: "bi-weekly",
          topProducts: ["Beverages", "Snacks", "Personal Care"],
          lastActivity: "1 day ago"
        },
        {
          id: "RET003",
          name: "Nyeri Fresh Mart",
          organizationName: "Nyeri Fresh Mart",
          contactNumber: "+254 734 567 890",
          location: "Nyeri",
          distributorId: "mahitaji_enterprises",
          distributorName: "Mahitaji Enterprises Ltd",
          status: "pending",
          joinDate: "2025-09-10",
          totalOrders: 3,
          totalGMV: 45000,
          creditLimit: 80000,
          currentCredit: 15000,
          paymentTerms: "net30",
          businessType: "retail",
          averageOrderValue: 15000,
          orderFrequency: "monthly",
          topProducts: ["Dairy Products", "Cereals"],
          lastActivity: "5 days ago"
        }
      ]
      setRetailers(sampleRetailers)
    } finally {
      setLoadingRetailers(false)
    }
  }

  // Load GMV and Settlement data
  const loadGMVData = async () => {
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
      const orders: any[] = []
      
      ordersSnapshot.forEach((doc) => {
        const data = doc.data()
        orders.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt)
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

      let settlementHistory: any[] = []
      try {
        const settlementsSnapshot = await getDocs(settlementsQuery)
        settlementsSnapshot.forEach((doc) => {
          const data = doc.data()
          settlementHistory.push({
            id: doc.id,
            ...data
          })
        })
      } catch (error) {
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
        .reduce((sum, settlement) => sum + (settlement.settlement || 0), 0)

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
        settlementHistory
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
  }

  // Filter products based on search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle entrance animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsEntering(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Load data on mount
  useEffect(() => {
    loadSuppliers()
    loadInvoices()
  }, [])

  // Load invoices when switching to invoices tab
  useEffect(() => {
    if (activeView === 'invoices') {
      loadInvoices()
    } else if (activeView === 'retailers') {
      loadRetailers()
      loadGMVData()
    }
  }, [activeView])

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
  
  const totalPayable = invoices
    .filter(inv => inv.paymentStatus !== 'paid')
    .reduce((sum, inv) => sum + inv.total, 0)
  
  const overdueAmount = invoices
    .filter(inv => inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.total, 0)

  return (
    <motion.div 
      className="flex flex-col h-[calc(100vh-2.5rem)] bg-slate-900 overflow-hidden"
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
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Input 
                placeholder={`Search ${activeView}...`}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                  {suppliers.map((supplier, index) => (
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
                  {/* Glassmorphic Card */}
                  <div className="relative h-80 rounded-3xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-white/[0.02] backdrop-blur-xl border border-white/[0.15] shadow-2xl group-hover:shadow-purple-500/20 transition-all duration-500 p-6 overflow-hidden">
                    
                    {/* Floating background orbs for depth */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-400/15 transition-colors duration-700"></div>
                    <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-indigo-500/8 rounded-full blur-xl group-hover:bg-indigo-400/12 transition-colors duration-700"></div>
                    
                    {/* Header Section */}
                    <div className="relative z-10 flex items-start justify-between mb-6">
                      <div className="flex items-center space-x-4">
                        {/* Bigger Logo - No Border */}
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 backdrop-blur-sm flex items-center justify-center group-hover:scale-105 transition-all duration-300 shadow-lg">
                          <img 
                            src={supplier.name === "Mahitaji Enterprises Ltd" ? "/images/mahitaji-logo.png" : "/images/sam-west-logo.png"}
                            alt={`${supplier.name} Logo`} 
                            className="w-14 h-14 object-contain filter drop-shadow-lg"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.parentElement!.innerHTML = `<div class="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">${supplier.name.charAt(0)}</div>`;
                            }}
                          />
                        </div>
                        
                        {/* Company Info */}
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
                      
                      {/* Gold Verification Icon */}
                      <div className="group/verify relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400/20 to-amber-500/20 backdrop-blur-sm flex items-center justify-center group-hover/verify:rotate-12 group-hover:animate-spin transition-all duration-500 shadow-lg">
                          <svg className="w-6 h-6 text-yellow-400 filter drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18l-1.45-1.32C5.4 13.36 2 9.28 2 5.5 2 3.42 3.42 2 5.5 2c1.74 0 3.41.81 4.5 2.09C11.09 2.81 12.76 2 14.5 2 16.58 2 18 3.42 18 5.5c0 3.78-3.4 7.86-6.55 11.18L10 18z" />
                          </svg>
                        </div>
                        
                        {/* Verified Tooltip */}
                        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-500/95 to-amber-500/95 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-xs font-medium opacity-0 group-hover/verify:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                          Verified Supplier
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-yellow-500/95"></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Key Metrics Grid */}
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
                    
                    {/* Bottom Section */}
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
                    
                    {/* Subtle hover glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-indigo-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  </div>
                </div>
              ))}
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
                            { (product as any).imageUrl ? (
                              <div className="w-full h-24 mb-3 rounded-xl overflow-hidden border border-white/10 bg-black/20">
                                {/* Using a simple img for external URLs to avoid Next/Image domain config */}
                                <img
                                  src={(product as any).imageUrl}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              </div>
                            ) : (
                              <div className="w-full h-24 mb-3 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-[10px] text-slate-400">
                                No image yet
                              </div>
                            )}
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
          <div className="overflow-x-auto">
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
        ) : activeView === 'retailers' ? (
          <div className="h-full overflow-y-auto">
            {loadingRetailers ? (
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <div className="p-6">
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
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Invoice Creation Dialog */}
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