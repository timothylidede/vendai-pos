"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DollarSign, FileText, Package, Wallet, AlertCircle, Plus, Search, Filter, ChevronDown, Clock, MoreVertical, ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import { Card } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs"
import type { Supplier, Invoice, Product, Payment } from "@/types/supplier"

// Sample data
const suppliers: Supplier[] = [
  {
    id: "SUP001",
    name: "Mahitaji Enterprises Ltd",
    contact: {
      phone: "+254 712 345 678",
      email: "orders@mahitaji.co.ke",
      address: "Prabhaki Industrial Park, Baba Dogo Road"
    },
    paymentTerms: "Net 7",
    creditLimit: 500000,
    currentCredit: 45000,
    status: "active",
    products: [
      {
        id: "PRD001",
        name: "Premium Rice 5kg",
        sku: "MAH-RIC-001",
        unitPrice: 850,
        category: "Grains",
        minOrderQuantity: 10,
        leadTime: "1-2 days",
        inStock: true
      },
      {
        id: "PRD002", 
        name: "Cooking Oil 2L",
        sku: "MAH-OIL-002",
        unitPrice: 420,
        category: "Oils & Fats",
        minOrderQuantity: 12,
        leadTime: "1-2 days",
        inStock: true
      },
      {
        id: "PRD003",
        name: "Sugar 2kg",
        sku: "MAH-SUG-003", 
        unitPrice: 240,
        category: "Sweeteners",
        minOrderQuantity: 20,
        leadTime: "Same day",
        inStock: true
      },
      {
        id: "PRD004",
        name: "Wheat Flour 2kg",
        sku: "MAH-FLO-004",
        unitPrice: 180,
        category: "Flour",
        minOrderQuantity: 15,
        leadTime: "1-2 days", 
        inStock: true
      },
      {
        id: "PRD005",
        name: "Tea Leaves 500g",
        sku: "MAH-TEA-005",
        unitPrice: 320,
        category: "Beverages",
        minOrderQuantity: 8,
        leadTime: "2-3 days",
        inStock: false
      },
      {
        id: "PRD006",
        name: "Milk Powder 1kg",
        sku: "MAH-MIL-006", 
        unitPrice: 680,
        category: "Dairy",
        minOrderQuantity: 6,
        leadTime: "1-2 days",
        inStock: true
      }
    ],
    accountBalance: -45000
  },
  {
    id: "SUP002",
    name: "Sam West Distributors",
    contact: {
      phone: "+254 733 456 789",
      email: "sales@samwest.co.ke",
      address: "Industrial Area, Nairobi"
    },
    paymentTerms: "Net 14",
    creditLimit: 750000,
    currentCredit: 32000,
    status: "active",
    products: [
      {
        id: "PRD007",
        name: "Maize Flour 2kg",
        sku: "SW-MAI-007",
        unitPrice: 165,
        category: "Flour",
        minOrderQuantity: 20,
        leadTime: "1-2 days",
        inStock: true
      },
      {
        id: "PRD008", 
        name: "White Sugar 1kg",
        sku: "SW-SUG-008",
        unitPrice: 125,
        category: "Sweeteners",
        minOrderQuantity: 25,
        leadTime: "Same day",
        inStock: true
      },
      {
        id: "PRD009",
        name: "Cooking Fat 1kg",
        sku: "SW-FAT-009", 
        unitPrice: 285,
        category: "Oils & Fats",
        minOrderQuantity: 15,
        leadTime: "1-2 days",
        inStock: true
      },
      {
        id: "PRD010",
        name: "Black Tea 250g",
        sku: "SW-TEA-010",
        unitPrice: 195,
        category: "Beverages",
        minOrderQuantity: 12,
        leadTime: "2-3 days", 
        inStock: true
      },
      {
        id: "PRD011",
        name: "Salt 500g",
        sku: "SW-SAL-011",
        unitPrice: 45,
        category: "Seasonings",
        minOrderQuantity: 30,
        leadTime: "Same day",
        inStock: true
      }
    ],
    accountBalance: -32000
  }
]

const invoices: Invoice[] = [
  {
    id: "INV001",
    supplierId: "SUP001",
    supplierName: "Mahitaji Enterprises Ltd",
    invoiceDate: "2025-09-06",
    dueDate: "2025-09-13",
    status: "posted",
    items: [
      {
        productId: "PRD001",
        productName: "Soda Carton (500ml x 24)",
        quantity: 10,
        unitPrice: 960,
        tax: 153.60,
        total: 11136
      }
    ],
    subTotal: 9600,
    tax: 1536,
    total: 11136,
    paymentTerms: "Net 7",
    paymentStatus: "unpaid",
    payments: [],
    notes: "Regular weekly supply"
  },
  {
    id: "INV002",
    supplierId: "SUP001",
    supplierName: "Mahitaji Enterprises Ltd",
    invoiceDate: "2025-09-05",
    dueDate: "2025-09-12",
    status: "posted",
    items: [
      {
        productId: "PRD001",
        productName: "Soda Carton (500ml x 24)",
        quantity: 15,
        unitPrice: 960,
        tax: 230.40,
        total: 16704
      }
    ],
    subTotal: 14400,
    tax: 2304,
    total: 16704,
    paymentTerms: "Net 7",
    paymentStatus: "partial",
    payments: [
      {
        id: "PAY001",
        invoiceId: "INV002",
        amount: 10000,
        date: "2025-09-06",
        method: "mpesa",
        reference: "PDQ123456",
        status: "completed"
      }
    ],
    notes: "Bulk order for weekend"
  },
  {
    id: "INV003",
    supplierId: "SUP001",
    supplierName: "Mahitaji Enterprises Ltd",
    invoiceDate: "2025-08-28",
    dueDate: "2025-09-04",
    status: "overdue",
    items: [
      {
        productId: "PRD001",
        productName: "Soda Carton (500ml x 24)",
        quantity: 8,
        unitPrice: 960,
        tax: 122.88,
        total: 8908.80
      }
    ],
    subTotal: 7680,
    tax: 1228.80,
    total: 8908.80,
    paymentTerms: "Net 7",
    paymentStatus: "unpaid",
    payments: [],
    notes: "Emergency stock replenishment"
  }
]

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
  const [activeView, setActiveView] = useState<'suppliers' | 'invoices'>('suppliers')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
  const [showSupplierDetails, setShowSupplierDetails] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [isEntering, setIsEntering] = useState(true)
  const [isExiting, setIsExiting] = useState(false)
  const router = useRouter()

  // Handle entrance animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsEntering(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const handleBackClick = () => {
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              {suppliers.map((supplier, index) => (
                <div 
                  key={supplier.id}
                  onClick={() => {
                    setSelectedSupplier(supplier)
                    setShowSupplierDetails(true)
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${supplier.name}`}
                  className="group relative cursor-pointer transform transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-3xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedSupplier(supplier)
                      setShowSupplierDetails(true)
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
                        <div className="text-white text-xl font-bold">{supplier.products.length}</div>
                        <div className="text-purple-400 text-xs">items available</div>
                      </div>
                      
                      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-300 text-xs font-medium">Credit Usage</span>
                          <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                        </div>
                        <div className="text-white text-sm font-bold">
                          {Math.round((supplier.currentCredit / supplier.creditLimit) * 100)}%
                        </div>
                        <div className="w-full bg-slate-700/50 rounded-full h-1.5 mt-1">
                          <div 
                            className="h-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
                            style={{ width: `${(supplier.currentCredit / supplier.creditLimit) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Payment Terms & Contact */}
                    <div className="relative z-10 space-y-3 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Payment Terms</span>
                        <span className="text-white text-sm font-medium px-2 py-1 bg-white/10 rounded-lg backdrop-blur-sm">
                          {supplier.paymentTerms}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-slate-300 text-sm">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{supplier.contact.address.split(',')[0]}</span>
                      </div>
                    </div>
                    
                    {/* Account Status */}
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${supplier.accountBalance < 0 ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`}></div>
                        <span className={`text-sm font-medium ${supplier.accountBalance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {supplier.accountBalance < 0 ? 'Outstanding Balance' : 'Good Standing'}
                        </span>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-slate-400 text-xs">Balance</div>
                        <div className={`font-bold text-sm ${supplier.accountBalance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          KSh {Math.abs(supplier.accountBalance).toLocaleString('en-KE', { minimumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>
                    
                    {/* Subtle hover glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-indigo-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : selectedSupplier ? (
            // Supplier Details View
            <div className="flex gap-6 h-full">
              {/* Left Panel - Supplier Details */}
              <div className="w-1/3 space-y-4">
                <div className="flex items-center mb-6">
                  <button 
                    onClick={() => setShowSupplierDetails(false)}
                    className="mr-4 p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                  >
                    <ChevronDown className="w-5 h-5 text-slate-400 rotate-90" />
                  </button>
                  <h2 className="text-xl font-semibold text-white">Supplier Details</h2>
                </div>
                
                <Card className="bg-slate-800/50 border-slate-700">
                  <div className="p-6">
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400/20 to-purple-600/20 border border-purple-400/30 flex items-center justify-center">
                        <img 
                          src={selectedSupplier.name === "Mahitaji Enterprises Ltd" ? "/images/mahitaji-logo.png" : "/images/sam-west-logo.png"}
                          alt={`${selectedSupplier.name} Logo`} 
                          className="w-10 h-10 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `<div class="text-lg font-bold text-purple-400">${selectedSupplier.name.charAt(0)}</div>`;
                          }}
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{selectedSupplier.name}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-green-400 text-sm">Active</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-2">Contact Information</h4>
                        <div className="space-y-2 text-sm text-slate-300">
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-500">📧</span>
                            <span>{selectedSupplier.contact.email}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-500">📞</span>
                            <span>{selectedSupplier.contact.phone}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-500">📍</span>
                            <span>{suppliers[0].contact.address}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-slate-700">
                        <h4 className="text-sm font-medium text-slate-400 mb-3">Account Details</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Payment Terms</span>
                            <span className="text-white font-medium">{selectedSupplier.paymentTerms}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Credit Limit</span>
                            <span className="text-white font-mono">
                              KSh {selectedSupplier.creditLimit.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Current Credit</span>
                            <span className="text-orange-400 font-mono">
                              KSh {selectedSupplier.currentCredit.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Account Balance</span>
                            <span className={`font-mono ${selectedSupplier.accountBalance < 0 ? 'text-red-400' : 'text-purple-400'}`}>
                              KSh {Math.abs(selectedSupplier.accountBalance).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                              {selectedSupplier.accountBalance < 0 ? ' (Owed)' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              
              {/* Right Panel - Product Catalog */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Product Catalog</h2>
                  <div className="text-sm text-slate-400">
                    {selectedSupplier.products.length} products available
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
                  {selectedSupplier.products.map((product) => (
                    <Card key={product.id} className="group relative overflow-hidden bg-slate-800/30 border-slate-700/50 hover:border-purple-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
                      <div className="p-4">
                        {/* Product Image Placeholder */}
                        <div className="w-full h-32 bg-gradient-to-br from-slate-700/30 to-slate-600/20 rounded-lg flex items-center justify-center mb-3 group-hover:from-purple-500/10 group-hover:to-purple-600/5 transition-all duration-300">
                          <Package className="w-12 h-12 text-slate-500 group-hover:text-purple-400 transition-colors duration-300" />
                        </div>
                        
                        {/* Product Info */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-slate-200 group-hover:text-white transition-colors duration-300 line-clamp-2">
                              {product.name}
                            </h4>
                            <div className={`px-2 py-1 rounded text-xs border transition-all duration-300 ${
                              product.inStock 
                                ? 'text-green-400 bg-green-500/10 border-green-500/20 group-hover:bg-green-500/20' 
                                : 'text-red-400 bg-red-500/10 border-red-500/20'
                            }`}>
                              {product.inStock ? 'In Stock' : 'Out of Stock'}
                            </div>
                          </div>
                          
                          <p className="text-xs text-slate-400 font-mono">{product.sku}</p>
                          <p className="text-xs text-slate-400">{product.category}</p>
                          
                          <div className="pt-2 border-t border-slate-700/50">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-lg font-bold text-purple-400 font-mono">
                                KSh {product.unitPrice.toFixed(2)}
                              </span>
                            </div>
                            
                            <div className="text-xs text-slate-400 space-y-1">
                              <div>Min. Order: {product.minOrderQuantity} units</div>
                              <div>Lead Time: {product.leadTime}</div>
                            </div>
                            
                            <div className="flex gap-2 mt-3">
                              <Button 
                                size="sm" 
                                className="flex-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/30 hover:border-purple-400/50 transition-all duration-300"
                                disabled={!product.inStock}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add to Cart
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="px-3 hover:bg-slate-700/50"
                              >
                                <FileText className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Hover Effect Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.02] to-purple-600/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // No supplier selected fallback
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Supplier Selected</h3>
                <p className="text-slate-400">Please select a supplier to view details</p>
              </div>
            </div>
          )
        ) : (
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
        )}
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
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="supplier" className="text-right text-slate-400">
                Supplier
              </label>
              <div className="col-span-3">
                <select
                  id="supplier"
                  className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
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
                defaultValue={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="terms" className="text-right text-slate-400">
                Payment Terms
              </label>
              <select
                id="terms"
                className="col-span-3 flex h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
              >
                <option value="cod">Cash on Delivery</option>
                <option value="net7">Net 7</option>
                <option value="net14">Net 14</option>
                <option value="net30">Net 30</option>
              </select>
            </div>

            {/* Products Section */}
            <div className="col-span-4 mt-4">
              <h4 className="font-medium mb-2">Products</h4>
              <div className="border border-slate-700 rounded-md p-4 space-y-4">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-5">Product</div>
                  <div className="col-span-2">Quantity</div>
                  <div className="col-span-2">Unit Price</div>
                  <div className="col-span-2">Total</div>
                  <div className="col-span-1"></div>
                </div>
                {/* Product rows would be mapped here */}
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Add Product
                </Button>
              </div>
            </div>

            <div className="col-span-4">
              <div className="flex justify-between items-center text-sm">
                <span>Subtotal</span>
                <span className="font-mono">KSh 0.00</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span>VAT (16%)</span>
                <span className="font-mono">KSh 0.00</span>
              </div>
              <div className="flex justify-between items-center font-medium mt-2 pt-2 border-t border-slate-700">
                <span>Total</span>
                <span className="font-mono text-green-400">KSh 0.00</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>Cancel</Button>
            <Button>Create Invoice</Button>
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
    </motion.div>
  )
}
