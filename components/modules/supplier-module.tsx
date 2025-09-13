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
            <div className="flex items-center justify-center min-h-[400px]">
              <div 
                onClick={() => setShowSupplierDetails(true)}
                className="group relative w-96 h-72 cursor-pointer transform transition-all duration-500 hover:scale-105 hover:-translate-y-2"
              >
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.15] via-purple-400/[0.08] to-purple-600/[0.12] rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 opacity-75 group-hover:opacity-100 animate-pulse"></div>
                
                {/* Main Card */}
                <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8 shadow-2xl group-hover:shadow-purple-500/25 transition-all duration-500">
                  {/* Logo */}
                  <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400/20 to-purple-600/20 border border-purple-400/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <img 
                        src="/images/mahitaji-logo.png" 
                        alt="Mahitaji Logo" 
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = '<div class="text-2xl font-bold text-purple-400">M</div>';
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Company Info */}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-200 transition-colors duration-300">
                      {suppliers[0].name}
                    </h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {suppliers[0].contact.address}
                    </p>
                  </div>
                  
                  {/* Status & Stats */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-green-400 text-sm font-medium">Active</span>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 text-xs">Products</div>
                      <div className="text-purple-400 font-bold text-lg">{suppliers[0].products.length}</div>
                    </div>
                  </div>
                  
                  {/* Hover Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] to-purple-600/[0.05] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Animated Border */}
                  <div className="absolute inset-0 rounded-2xl border border-transparent bg-gradient-to-r from-purple-400/20 via-purple-500/10 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'xor', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor'}}></div>
                </div>
              </div>
            </div>
          ) : (
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
                          src="/images/mahitaji-logo.png" 
                          alt="Mahitaji Logo" 
                          className="w-10 h-10 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = '<div class="text-lg font-bold text-purple-400">M</div>';
                          }}
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{suppliers[0].name}</h3>
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
                            <span>{suppliers[0].contact.email}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-500">📞</span>
                            <span>{suppliers[0].contact.phone}</span>
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
                            <span className="text-white font-medium">{suppliers[0].paymentTerms}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Credit Limit</span>
                            <span className="text-white font-mono">
                              KSh {suppliers[0].creditLimit.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Current Credit</span>
                            <span className="text-orange-400 font-mono">
                              KSh {suppliers[0].currentCredit.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Account Balance</span>
                            <span className={`font-mono ${suppliers[0].accountBalance < 0 ? 'text-red-400' : 'text-purple-400'}`}>
                              KSh {Math.abs(suppliers[0].accountBalance).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                              {suppliers[0].accountBalance < 0 ? ' (Owed)' : ''}
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
                    {suppliers[0].products.length} products available
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
                  {suppliers[0].products.map((product) => (
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
