"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Package, AlertTriangle, TrendingUp, Upload, FileText, PlusCircle, Download, Check, ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import { AIProcessingModal } from "../ai-processing-modal"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, limit, orderBy, doc, setDoc, addDoc, deleteDoc, getDoc } from "firebase/firestore"
import { POS_PRODUCTS_COL, INVENTORY_COL } from "@/lib/pos-operations"

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
}
// Products are sourced from Firestore only. No static fallback inventory.

const getStatusColor = (status: string) => {
  switch (status) {
    case "good":
      return "text-blue-400 bg-blue-500/20 border-blue-500/30"
    case "low":
      return "text-orange-400 bg-orange-500/20 border-orange-500/30"
    case "out":
      return "text-red-400 bg-red-500/20 border-red-500/30"
    default:
      return "text-slate-400 bg-slate-500/20 border-slate-500/30"
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "good":
      return <TrendingUp className="w-4 h-4" />
    case "low":
      return <AlertTriangle className="w-4 h-4" />
    case "out":
      return <AlertTriangle className="w-4 h-4" />
    default:
      return <Package className="w-4 h-4" />
  }
}

export function InventoryModule() {
  const [activeTab, setActiveTab] = useState<'products' | 'new'>('products')
  const [orgId, setOrgId] = useState<string>('DEMO_ORG')
  const [products, setProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([])
  const [currentStep, setCurrentStep] = useState<string>('')
  const [processingError, setProcessingError] = useState<string>('')
  const [processedProducts, setProcessedProducts] = useState<any[]>([])
  const [isEntering, setIsEntering] = useState(true)
  const [isExiting, setIsExiting] = useState(false)
  const [invMap, setInvMap] = useState<Record<string, { qtyBase: number; qtyLoose: number; unitsPerBase: number }>>({})
  const [hasPricelist, setHasPricelist] = useState<boolean>(false)
  const [showMissingStockAlert, setShowMissingStockAlert] = useState<boolean>(false)
  const [processingStats, setProcessingStats] = useState({
    totalProducts: 0,
    productsAdded: 0,
    productsUpdated: 0,
    duplicatesFound: 0,
    estimatedTimeRemaining: 0,
    suppliersAnalyzed: 0,
    locationMatches: 0
  })
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>()
  const newTabHighlighted = !loadingProducts && products.length === 0

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any | null>(null)

  const router = useRouter()

  // Handle entrance animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsEntering(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Fetch products and inventory for org
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingProducts(true)
        // Load products (most recent first)
        const qy = query(collection(db, POS_PRODUCTS_COL), orderBy('updatedAt', 'desc'))
        const snap = await getDocs(qy)
        const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        // Load inventory for this org
        const invQ = query(collection(db, INVENTORY_COL), where('orgId', '==', orgId), limit(1000))
        const invSnap = await getDocs(invQ)
        const map: Record<string, { qtyBase: number; qtyLoose: number; unitsPerBase: number }> = {}
        invSnap.docs.forEach(d => {
          const v: any = d.data()
          if (v?.productId) map[v.productId] = { qtyBase: v.qtyBase || 0, qtyLoose: v.qtyLoose || 0, unitsPerBase: v.unitsPerBase || 1 }
        })

        // Compute stock + status
        const augmented = prods.map((p: any) => {
          const inv = map[p.id]
          const unitsPerBase = inv?.unitsPerBase || p.unitsPerBase || p.wholesaleQuantity || 1
          const stockPieces: number = inv ? inv.qtyBase * unitsPerBase + inv.qtyLoose : 0
          const status = inv
            ? (stockPieces === 0 ? 'out' : (stockPieces < (p.minStock || unitsPerBase) ? 'low' : 'good'))
            : 'unknown'
          return {
            ...p,
            stock: stockPieces,
            status,
            unitsPerBase
          }
        })

        setProducts(augmented)
        setInvMap(map)
        const anyInventory = invSnap.size > 0
        const anyProducts = prods.length > 0
        setHasPricelist(anyProducts || anyInventory)
        setShowMissingStockAlert(anyProducts && !anyInventory)
      } catch (e) {
        // noop
      } finally {
        setLoadingProducts(false)
      }
    }
    load()
  }, [orgId])

  const handleBackClick = () => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      router.push('/modules')
    }, 200)
  }

  const initializeProcessingSteps = (): ProcessingStep[] => [
    {
      id: 'file_validation',
      title: 'File Validation',
      description: 'Validating file format, size, and content structure',
      status: 'pending'
    },
    {
      id: 'text_extraction',
      title: 'Document Analysis',
      description: 'Extracting text content and analyzing document structure',
      status: 'pending'
    },
    {
      id: 'ai_extraction',
      title: 'AI Data Processing',
      description: 'Using advanced AI to extract and structure product information',
      status: 'pending'
    },
    {
      id: 'data_validation',
      title: 'Data Validation',
      description: 'Validating extracted data and cleaning product information',
      status: 'pending'
    },
    {
      id: 'image_generation',
      title: 'Product Image Generation',
      description: 'Generating high-quality product images using AI',
      status: 'pending'
    },
    {
      id: 'finalization',
      title: 'Processing Complete',
      description: 'Finalizing product data and preparing for import',
      status: 'pending'
    }
  ]

  const updateStepStatus = (stepId: string, status: ProcessingStep['status'], progress?: number) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, progress } : step
    ))
    setCurrentStep(stepId)
  }

  const handleImportTemplate = () => {
    setIsDownloading(true)
    
    // Create comprehensive CSV template content
    const csvContent = `Product Name,SKU,Category,Brand,Variant,Size,Pack Size,Unit,Distributor Price,Unit Price,Supplier,Description,Tags
Acoustic Bloc Screens,E-COM11,Furniture,OfficePro,Standard,120x180cm,1,PC,295.00,295.00,Supplier A,Sound absorbing office screens for noise reduction,furniture;office;screen;acoustic
Cabinet with Doors,FURN_7800,Furniture,StoragePlus,Wooden,80x40x120cm,1,PC,140.00,140.00,Supplier B,Storage cabinet with lockable doors,furniture;storage;cabinet;wooden
Conference Chair,FURN_1118,Furniture,ComfortSeat,Executive,Standard,1,PC,33.00,33.00,Supplier C,Ergonomic office chair for meetings,furniture;chair;office;ergonomic
Corner Desk Left Sit,FURN_0001,Furniture,DeskMaster,L-Shape,160x120cm,1,PC,85.00,85.00,Supplier D,L-shaped desk for office spaces,furniture;desk;office;corner`

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'inventory_import_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    // Show completion state
    setTimeout(() => {
      setIsDownloading(false)
      setDownloadComplete(true)
      setTimeout(() => {
        setDownloadComplete(false)
      }, 3000)
    }, 1500)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Initialize processing
    const steps = initializeProcessingSteps()
    setProcessingSteps(steps)
    setProcessingError('')
    setIsProcessingModalOpen(true)

    // Initialize stats
    setProcessingStats({
      totalProducts: 0,
      productsAdded: 0,
      productsUpdated: 0,
      duplicatesFound: 0,
      estimatedTimeRemaining: 0,
      suppliersAnalyzed: 0,
      locationMatches: 0
    })

    // Get user location if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        () => {
          // Fallback to default location (Nairobi)
          setUserLocation({ lat: -1.2921, lng: 36.8219 })
        }
      )
    }

    try {
      // Step 1: File validation
      updateStepStatus('file_validation', 'processing', 0)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      updateStepStatus('file_validation', 'completed', 100)

      // Step 2: Text extraction
      updateStepStatus('text_extraction', 'processing', 0)
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('orgId', orgId)

      await new Promise(resolve => setTimeout(resolve, 800))
      updateStepStatus('text_extraction', 'completed', 100)

      // Step 3: Enhanced AI processing with analytics
      updateStepStatus('ai_extraction', 'processing', 0)
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      
      if (ext === 'csv') {
        // Use enhanced processing API
        const response = await fetch('/api/inventory/process-enhanced', { method: 'POST', body: formData })
        const result = await response.json().catch(() => ({} as any))
        
        if (!response.ok || !result?.success) {
          setProcessingError(result?.error || 'Enhanced processing failed')
          updateStepStatus('ai_extraction', 'error')
          return
        }

        // Update statistics from enhanced processing
        if (result.stats) {
          setProcessingStats(prevStats => ({
            ...prevStats,
            totalProducts: result.stats.totalProducts,
            productsAdded: result.stats.productsAdded,
            productsUpdated: result.stats.productsUpdated,
            duplicatesFound: result.stats.duplicatesFound,
            suppliersAnalyzed: result.stats.suppliersAnalyzed,
            locationMatches: result.stats.locationMatches,
            estimatedTimeRemaining: Math.max(0, (result.stats.totalProducts - result.stats.productsAdded - result.stats.productsUpdated) * 0.1)
          }))
        }

        updateStepStatus('ai_extraction', 'completed', 100)
      } else {
        setProcessingError('Currently, only CSV uploads are supported with full analytics. PDF/Excel support coming soon.')
        updateStepStatus('ai_extraction', 'error')
        return
      }

      // Step 4: Data validation with progress updates
      updateStepStatus('data_validation', 'processing', 0)
      const currentStats = processingStats
      
      // Simulate validation progress
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 100))
        updateStepStatus('data_validation', 'processing', i)
        
        // Update step with product count
        setProcessingSteps(prev => prev.map(step => 
          step.id === 'data_validation' ? { 
            ...step, 
            productsProcessed: Math.round(currentStats.productsAdded * i / 100),
            totalProducts: currentStats.totalProducts
          } : step
        ))
      }
      updateStepStatus('data_validation', 'completed', 100)

      // Step 5: Image generation (show progress)
      updateStepStatus('image_generation', 'processing', 0)
      for (let i = 0; i <= 100; i += 25) {
        await new Promise(resolve => setTimeout(resolve, 300))
        updateStepStatus('image_generation', 'processing', i)
      }
      updateStepStatus('image_generation', 'completed', 100)

      // Step 6: Finalization
      updateStepStatus('finalization', 'processing', 0)
      await new Promise(resolve => setTimeout(resolve, 400))
      updateStepStatus('finalization', 'completed', 100)

      // Success: reload products from Firestore for Products tab
      try {
        setLoadingProducts(true)
        const qy = query(collection(db, POS_PRODUCTS_COL), orderBy('updatedAt', 'desc'))
        const snap = await getDocs(qy)
        const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        const invQ = query(collection(db, INVENTORY_COL), where('orgId', '==', orgId), limit(1000))
        const invSnap = await getDocs(invQ)
        const map: Record<string, { qtyBase: number; qtyLoose: number; unitsPerBase: number }> = {}
        invSnap.docs.forEach(d => { const v: any = d.data(); if (v?.productId) map[v.productId] = { qtyBase: v.qtyBase || 0, qtyLoose: v.qtyLoose || 0, unitsPerBase: v.unitsPerBase || 1 } })
        const augmented = prods.map((p: any) => {
          const inv = map[p.id]; const unitsPerBase = inv?.unitsPerBase || p.unitsPerBase || p.wholesaleQuantity || 1; const stockPieces: number = inv ? inv.qtyBase * unitsPerBase + inv.qtyLoose : 0; const status = inv ? (stockPieces === 0 ? 'out' : (stockPieces < (p.minStock || unitsPerBase) ? 'low' : 'good')) : 'unknown'; return { ...p, stock: stockPieces, status, unitsPerBase }
        })
        setProducts(augmented)
        setInvMap(map)
        setHasPricelist(augmented.length > 0)
        setShowMissingStockAlert(augmented.length > 0 && invSnap.size === 0)
      } finally {
        setLoadingProducts(false)
      }
      
      setProcessedProducts([])
      setTimeout(() => setIsProcessingModalOpen(false), 1200)

    } catch (error) {
      console.error('Enhanced upload error:', error)
      setProcessingError('Network error occurred. Please check your connection and try again.')
      updateStepStatus(currentStep || 'ai_extraction', 'error')
    } finally {
      event.target.value = '' // Reset file input
    }
  }

  const handleRetryProcessing = () => {
    setIsProcessingModalOpen(false)
    // Trigger file input click
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      fileInput.click()
    }
  }

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
      {/* AI Processing Modal */}
      <AIProcessingModal
        isOpen={isProcessingModalOpen}
        onClose={() => setIsProcessingModalOpen(false)}
        steps={processingSteps}
        currentStep={currentStep}
        error={processingError}
        onRetry={handleRetryProcessing}
        stats={processingStats}
        userLocation={userLocation}
      />

  {/* Header */}
  <div className="bg-slate-900/40 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            {/* Back Button */}
            <button 
              onClick={handleBackClick}
              className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] via-transparent to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <ArrowLeft className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
            </button>
            
            <div className="flex items-center space-x-2 p-1 backdrop-blur-md bg-gradient-to-r from-white/[0.08] to-white/[0.04] border border-white/[0.08] rounded-xl shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)]">
              <button
                type="button"
                className={`px-4 py-2 font-semibold text-base rounded-lg transition-all duration-300 relative
                  ${activeTab === 'products' 
                    ? 'text-blue-400 backdrop-blur-md bg-gradient-to-r from-blue-500/[0.15] to-blue-500/[0.08] border border-blue-500/30 shadow-[0_4px_16px_-8px_rgba(59,130,246,0.3)]' 
                    : 'text-slate-200 hover:text-blue-400 hover:bg-white/[0.05] backdrop-blur-sm'}`}
                onClick={() => setActiveTab('products')}
              >
                <span className="relative">
                  Products
                  {activeTab === 'products' && (
                    <span className="absolute left-0 right-0 bottom-0 h-1 bg-gradient-to-r from-blue-400 via-blue-200 to-blue-400 rounded-full blur-sm animate-pulse"></span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className={`px-4 py-2 font-semibold text-base rounded-lg transition-all duration-300 relative
                  ${activeTab === 'new' 
                    ? 'text-blue-400 backdrop-blur-md bg-gradient-to-r from-blue-500/[0.15] to-blue-500/[0.08] border border-blue-500/30 shadow-[0_4px_16px_-8px_rgba(59,130,246,0.3)]' 
                    : `text-slate-200 hover:text-blue-400 hover:bg-white/[0.05] backdrop-blur-sm ${newTabHighlighted ? 'ring-2 ring-blue-400/40' : ''}`}`}
                onClick={() => setActiveTab('new')}
              >
                <span className="relative">
                  New
                  {activeTab === 'new' && (
                    <span className="absolute left-0 right-0 bottom-0 h-1 bg-gradient-to-r from-blue-400 via-blue-200 to-blue-400 rounded-full blur-sm animate-pulse"></span>
                  )}
                  {newTabHighlighted && activeTab !== 'new' && (
                    <span className="ml-2 inline-block text-[10px] text-blue-300 align-middle">Start here →</span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'products' && (
          <div className="p-4">
            {showMissingStockAlert && (
              <div className="mb-4 rounded-xl border border-yellow-400/30 bg-yellow-500/10 text-yellow-200 px-4 py-3 backdrop-blur-md">
                Stock counts aren't set for this org yet. Not mandatory, but add them for accurate POS and alerts.
              </div>
            )}
            {!loadingProducts && products.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
                <Package className="w-12 h-12 text-slate-400 mb-3" />
                <h4 className="text-white font-semibold">No products yet</h4>
                <p className="text-slate-400 text-sm mt-1">Add products from the New tab to get started.</p>
                <button onClick={() => setActiveTab('new')} className="mt-4 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-200 border border-blue-500/30 hover:bg-blue-500/30">Go to New</button>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {loadingProducts && (
                <div className="col-span-full text-slate-400">Loading products…</div>
              )}
              {products.map(item => (
                <div
                  key={item.id}
                  className="group relative rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-transparent border border-white/[0.08] hover:border-white/[0.15] transition-all duration-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_48px_-12px_rgba(59,130,246,0.15)] cursor-pointer hover:scale-105 hover:-translate-y-2"
                  onClick={() => { setEditingProduct(item); setIsModalOpen(true) }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] via-transparent to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="aspect-square w-full bg-gradient-to-br from-slate-800/60 to-slate-700/40 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] via-transparent to-blue-600/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <Package className="w-16 h-16 text-slate-400 group-hover:scale-125 group-hover:text-blue-300 group-hover:rotate-12 transition-all duration-500 relative z-10" />
                  </div>
                  <div className="p-4 relative">
                    <h4 className="text-slate-200 font-medium text-sm truncate group-hover:text-white transition-colors duration-300">{item.name}</h4>
                    <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                      <span className="text-xs text-slate-400 group-hover:text-slate-300">{item.pieceBarcode || item.brand || ''}</span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${
                        (item.status || 'good') === 'good' ? 'text-blue-400 bg-blue-500/20 border-blue-500/30' :
                        (item.status || 'good') === 'low' ? 'text-orange-400 bg-orange-500/20 border-orange-500/30' :
                        (item.status || 'good') === 'out' ? 'text-red-400 bg-red-500/20 border-red-500/30' : 'text-slate-400 bg-slate-500/20 border-slate-500/30'
                      }`}>
                        {item.stock ?? '—'}
                      </span>
                    </div>
                  </div>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 animate-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'new' && (
          <div className="space-y-8 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="group relative rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-transparent border border-white/[0.08] hover:border-white/[0.15] transition-all duration-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_48px_-12px_rgba(59,130,246,0.15)] cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isProcessingModalOpen}
                />
                <div className="relative p-10">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-2xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] flex items-center justify-center group-hover:scale-105 transition-all duration-500 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)]">
                      {processedProducts.length > 0 ? (
                        <Check className="w-12 h-12 text-green-400 transition-all duration-500" />
                      ) : (
                        <Upload className="w-12 h-12 text-slate-300 group-hover:text-emerald-300 transition-all duration-500" />
                      )}
                    </div>
                    <h4 className={`text-slate-100 font-semibold text-xl mb-3 group-hover:text-white transition-colors duration-300 ${processedProducts.length > 0 ? 'text-green-400' : ''}`}>
                      {processedProducts.length > 0 ? 'Processing Complete!' : 'AI Document Processing'}
                    </h4>
                    <p className={`text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors duration-300 ${processedProducts.length > 0 ? 'text-green-300' : ''}`}>
                      {processedProducts.length > 0 
                        ? `Successfully processed ${processedProducts.length} products with AI-generated images and structured data` 
                        : 'Upload inventory files (CSV, Excel, PDF) for intelligent AI processing with automatic product extraction and image generation'}
                    </p>
                  </div>
                </div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.02] to-emerald-500/[0.05]" />
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
              </div>

              <div
                className="group relative rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-transparent border border-white/[0.08] hover:border-white/[0.15] transition-all duration-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_48px_-12px_rgba(59,130,246,0.15)] cursor-pointer"
                onClick={() => { setEditingProduct(null); setIsModalOpen(true) }}
              >
                <div className="relative p-10">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] via-transparent to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-2xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] flex items-center justify-center group-hover:scale-105 transition-all duration-500 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)]">
                      <PlusCircle className="w-12 h-12 text-slate-300 group-hover:text-blue-300 transition-all duration-500" />
                    </div>
                    <h4 className="text-slate-100 font-semibold text-xl mb-3 group-hover:text-white transition-colors duration-300">Add Manually</h4>
                    <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors duration-300">Create products individually with complete details and specifications</p>
                  </div>
                </div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.02] to-blue-500/[0.05]" />
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
              </div>

              {hasPricelist && (
                <div className="group relative rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-transparent border border-white/[0.08] hover:border-white/[0.15] transition-all duration-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_48px_-12px_rgba(59,130,246,0.15)]">
                  <div className="relative p-10">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] via-transparent to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative text-center">
                      <div className="w-24 h-24 mx-auto mb-6 rounded-2xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] flex items-center justify-center group-hover:scale-105 transition-all duration-500 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)]">
                        <Upload className="w-12 h-12 text-slate-300 group-hover:text-blue-300 transition-all duration-500" />
                      </div>
                      <h4 className="text-slate-100 font-semibold text-xl mb-3 group-hover:text-white transition-colors duration-300">Re-upload price list</h4>
                      <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors duration-300">Re-upload a CSV to update products; include orgId to create inventory stubs for unlocking modules.</p>
                      <form className="space-y-3 mt-4" onSubmit={(e) => e.preventDefault()}>
                        <div className="flex items-center space-x-2">
                          <input className="flex-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-slate-200" placeholder="Organization ID" value={orgId} onChange={e => setOrgId(e.target.value)} />
                        </div>
                        <div>
                          <input id="csv-reupload" type="file" className="hidden" accept=".csv" onChange={async (ev) => {
                            const f = ev.target.files?.[0]; if (!f) return;
                            const fd = new FormData(); fd.append('file', f); fd.append('orgId', orgId);
                            const res = await fetch('/api/inventory/upload', { method: 'POST', body: fd });
                            ev.currentTarget.value = ''
                            if (res.ok) {
                              setLoadingProducts(true)
                              try {
                                const qy = query(collection(db, POS_PRODUCTS_COL), orderBy('updatedAt', 'desc'))
                                const snap = await getDocs(qy)
                                const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                                const invQ = query(collection(db, INVENTORY_COL), where('orgId', '==', orgId), limit(1000))
                                const invSnap = await getDocs(invQ)
                                const map: Record<string, { qtyBase: number; qtyLoose: number; unitsPerBase: number }> = {}
                                invSnap.docs.forEach(d => { const v: any = d.data(); if (v?.productId) map[v.productId] = { qtyBase: v.qtyBase || 0, qtyLoose: v.qtyLoose || 0, unitsPerBase: v.unitsPerBase || 1 } })
                                const augmented = prods.map((p: any) => {
                                  const inv = map[p.id]; const unitsPerBase = inv?.unitsPerBase || p.unitsPerBase || p.wholesaleQuantity || 1; const stockPieces: number = inv ? inv.qtyBase * unitsPerBase + inv.qtyLoose : 0; const status = inv ? (stockPieces === 0 ? 'out' : (stockPieces < (p.minStock || unitsPerBase) ? 'low' : 'good')) : 'unknown'; return { ...p, stock: stockPieces, status, unitsPerBase }
                                })
                                setProducts(augmented)
                                setInvMap(map)
                                setHasPricelist(augmented.length > 0)
                                setShowMissingStockAlert(augmented.length > 0 && invSnap.size === 0)
                              } finally { setLoadingProducts(false) }
                            }
                          }} />
                          <label htmlFor="csv-reupload" className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-all duration-300 cursor-pointer"><Upload className="w-4 h-4" /><span>Upload CSV</span></label>
                        </div>
                      </form>
                    </div>
                  </div>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.02] to-blue-500/[0.05]" />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="flex flex-wrap gap-4 justify-center">
                <button 
                  onClick={handleImportTemplate}
                  disabled={isDownloading}
                  className="group relative overflow-hidden rounded-xl backdrop-blur-md bg-gradient-to-r from-white/[0.08] to-white/[0.04] border border-white/[0.08] hover:border-blue-400/30 px-6 py-3 transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(59,130,246,0.2)] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.05] to-purple-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center gap-3">
                    {downloadComplete ? (
                      <Check className="w-5 h-5 text-green-400 transition-colors duration-300" />
                    ) : isDownloading ? (
                      <Download className="w-5 h-5 text-blue-300 animate-bounce transition-colors duration-300" />
                    ) : (
                      <FileText className="w-5 h-5 text-slate-300 group-hover:text-blue-300 transition-colors duration-300" />
                    )}
                    <span className={`font-medium transition-colors duration-300 ${
                      downloadComplete ? 'text-green-400' :
                      isDownloading ? 'text-blue-300' :
                      'text-slate-200 group-hover:text-white'
                    }`}>
                      {downloadComplete ? 'Template Downloaded!' :
                       isDownloading ? 'Downloading...' :
                       'Import Template'}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {processedProducts.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-white mb-6 bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">Recently Processed Products ({processedProducts.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {processedProducts.slice(0, 10).map((product, index) => (
                    <div
                      key={index}
                      className="group relative rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-transparent border border-white/[0.08] hover:border-white/[0.15] transition-all duration-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_48px_-12px_rgba(59,130,246,0.15)] cursor-pointer hover:scale-105 hover:-translate-y-2"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.03] via-transparent to-emerald-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="aspect-square w-full bg-gradient-to-br from-slate-800/60 to-slate-700/40 flex items-center justify-center relative overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" />
                        ) : (
                          <Package className="w-16 h-16 text-slate-400 group-hover:scale-125 group-hover:text-green-300 group-hover:rotate-12 transition-all duration-500 relative z-10" />
                        )}
                      </div>
                      <div className="p-4 relative">
                        <h4 className="text-slate-200 font-medium text-sm truncate group-hover:text-white transition-colors duration-300">{product.name}</h4>
                        <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                          <span className="text-xs text-slate-400 group-hover:text-slate-300">{product.brand || product.code || 'N/A'}</span>
                          <span className="text-xs px-2 py-1 rounded-full border text-green-400 bg-green-500/20 border-green-500/30">${product.price_distributor}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Glassmorphic Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-2xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)] text-slate-50 p-6">
            <h3 className="text-xl font-semibold mb-4">{editingProduct?.id ? 'Edit product' : 'Add product'}</h3>
            <ProductForm
              orgId={orgId}
              initial={editingProduct}
              onCancel={() => setIsModalOpen(false)}
              onSaved={() => { setIsModalOpen(false); setEditingProduct(null); /* reload */ (async () => {
                setLoadingProducts(true)
                try {
                  const qy = query(collection(db, POS_PRODUCTS_COL), orderBy('updatedAt', 'desc'))
                  const snap = await getDocs(qy)
                  const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                  const invQ = query(collection(db, INVENTORY_COL), where('orgId', '==', orgId), limit(1000))
                  const invSnap = await getDocs(invQ)
                  const map: Record<string, { qtyBase: number; qtyLoose: number; unitsPerBase: number }> = {}
                  invSnap.docs.forEach(d => { const v: any = d.data(); if (v?.productId) map[v.productId] = { qtyBase: v.qtyBase || 0, qtyLoose: v.qtyLoose || 0, unitsPerBase: v.unitsPerBase || 1 } })
                  const augmented = prods.map((p: any) => {
                    const inv = map[p.id]; const unitsPerBase = inv?.unitsPerBase || p.unitsPerBase || p.wholesaleQuantity || 1; const stockPieces: number = inv ? inv.qtyBase * unitsPerBase + inv.qtyLoose : 0; const status = inv ? (stockPieces === 0 ? 'out' : (stockPieces < (p.minStock || unitsPerBase) ? 'low' : 'good')) : 'unknown'; return { ...p, stock: stockPieces, status, unitsPerBase }
                  })
                  setProducts(augmented)
                  setInvMap(map)
                } finally { setLoadingProducts(false) }
              })() }}
              onDeleted={() => { setIsModalOpen(false); setEditingProduct(null); /* trigger reload via saved */ (async () => {
                setLoadingProducts(true)
                try {
                  const qy = query(collection(db, POS_PRODUCTS_COL), orderBy('updatedAt', 'desc'))
                  const snap = await getDocs(qy)
                  const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                  const invQ = query(collection(db, INVENTORY_COL), where('orgId', '==', orgId), limit(1000))
                  const invSnap = await getDocs(invQ)
                  const map: Record<string, { qtyBase: number; qtyLoose: number; unitsPerBase: number }> = {}
                  invSnap.docs.forEach(d => { const v: any = d.data(); if (v?.productId) map[v.productId] = { qtyBase: v.qtyBase || 0, qtyLoose: v.qtyLoose || 0, unitsPerBase: v.unitsPerBase || 1 } })
                  const augmented = prods.map((p: any) => {
                    const inv = map[p.id]; const unitsPerBase = inv?.unitsPerBase || p.unitsPerBase || p.wholesaleQuantity || 1; const stockPieces: number = inv ? inv.qtyBase * unitsPerBase + inv.qtyLoose : 0; const status = inv ? (stockPieces === 0 ? 'out' : (stockPieces < (p.minStock || unitsPerBase) ? 'low' : 'good')) : 'unknown'; return { ...p, stock: stockPieces, status, unitsPerBase }
                  })
                  setProducts(augmented)
                  setInvMap(map)
                } finally { setLoadingProducts(false) }
              })() }}
            />
          </div>
        </div>
      )}
    </motion.div>
  )
}

type ProductFormProps = {
  orgId: string
  initial: any | null
  onCancel: () => void
  onSaved: () => void
  onDeleted: () => void
}

function ProductForm({ orgId, initial, onCancel, onSaved, onDeleted }: ProductFormProps) {
  const [name, setName] = useState<string>(initial?.name || '')
  const [brand, setBrand] = useState<string>(initial?.brand || '')
  const [category, setCategory] = useState<string>(initial?.category || '')
  const [pieceBarcode, setPieceBarcode] = useState<string>(initial?.pieceBarcode || '')
  const [cartonBarcode, setCartonBarcode] = useState<string>(initial?.cartonBarcode || '')
  const [piecePrice, setPiecePrice] = useState<number>(typeof initial?.piecePrice === 'number' ? initial.piecePrice : 0)
  const [cartonPrice, setCartonPrice] = useState<number>(typeof initial?.wholesalePrice === 'number' ? initial.wholesalePrice : (typeof initial?.cartonPrice === 'number' ? initial.cartonPrice : 0))
  const [baseUom, setBaseUom] = useState<string>(initial?.baseUom || 'CTN')
  const [retailUom, setRetailUom] = useState<string>(initial?.retailUom || 'PCS')
  const [unitsPerBase, setUnitsPerBase] = useState<number>(initial?.unitsPerBase || initial?.wholesaleQuantity || 1)
  const [setInitialStock, setSetInitialStock] = useState<boolean>(false)
  const [qtyBase, setQtyBase] = useState<number>(0)
  const [qtyLoose, setQtyLoose] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')

  const canSave = name.trim().length > 0

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      const now = new Date().toISOString()
      const data: any = {
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        pieceBarcode: pieceBarcode.trim() || undefined,
        cartonBarcode: cartonBarcode.trim() || undefined,
        baseUom,
        retailUom,
        unitsPerBase: Number(unitsPerBase) || 1,
        piecePrice: Number(piecePrice) || 0,
        wholesalePrice: Number(cartonPrice) || undefined,
        updatedAt: now
      }
      let id = initial?.id as string | undefined
      if (id) {
        await setDoc(doc(db, POS_PRODUCTS_COL, id), data, { merge: true })
      } else {
        const newRef = await addDoc(collection(db, POS_PRODUCTS_COL), { ...data, createdAt: now })
        id = newRef.id
      }

      // Ensure an inventory stub exists to unlock modules
      const invId = `${orgId}_${id}`
      const invRef = doc(db, INVENTORY_COL, invId)
      if (setInitialStock) {
        await setDoc(invRef, {
          orgId,
          productId: id,
          qtyBase: Number(qtyBase) || 0,
          qtyLoose: Number(qtyLoose) || 0,
          unitsPerBase: Number(unitsPerBase) || 1,
          updatedAt: now,
          updatedBy: 'user'
        }, { merge: true })
      } else {
        const exists = await getDoc(invRef)
        if (!exists.exists()) {
          await setDoc(invRef, {
            orgId,
            productId: id,
            qtyBase: 0,
            qtyLoose: 0,
            unitsPerBase: Number(unitsPerBase) || 1,
            updatedAt: now,
            updatedBy: 'user'
          })
        }
      }

      onSaved()
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initial?.id) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, POS_PRODUCTS_COL, initial.id))
      // Remove only this org's inventory record
      const invId = `${orgId}_${initial.id}`
      await deleteDoc(doc(db, INVENTORY_COL, invId)).catch(() => {})
      onDeleted()
    } catch (e: any) {
      setError(e?.message || 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 text-red-200 px-3 py-2">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-200 mb-1">Name</label>
          <input className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-200 mb-1">Brand</label>
          <input className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={brand} onChange={e => setBrand(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-200 mb-1">Category</label>
          <input className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={category} onChange={e => setCategory(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-200 mb-1">Piece barcode</label>
          <input className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={pieceBarcode} onChange={e => setPieceBarcode(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-200 mb-1">Carton barcode</label>
          <input className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={cartonBarcode} onChange={e => setCartonBarcode(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-200 mb-1">Piece price</label>
          <input type="number" step="0.01" className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={piecePrice} onChange={e => setPiecePrice(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm text-slate-200 mb-1">Carton price (optional)</label>
          <input type="number" step="0.01" className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={cartonPrice} onChange={e => setCartonPrice(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm text-slate-200 mb-1">Base UoM</label>
          <input className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={baseUom} onChange={e => setBaseUom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-200 mb-1">Retail UoM</label>
          <input className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={retailUom} onChange={e => setRetailUom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-slate-200 mb-1">Units per base</label>
          <input type="number" className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={unitsPerBase} onChange={e => setUnitsPerBase(Number(e.target.value))} />
        </div>
      </div>

      <div className="mt-2">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={setInitialStock} onChange={e => setSetInitialStock(e.target.checked)} />
          <span className="text-sm text-slate-200">Set initial stock now (optional)</span>
        </label>
        {setInitialStock && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <div>
              <label className="block text-sm text-slate-200 mb-1">Qty base</label>
              <input type="number" className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={qtyBase} onChange={e => setQtyBase(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm text-slate-200 mb-1">Qty loose</label>
              <input type="number" className="w-full bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200" value={qtyLoose} onChange={e => setQtyLoose(Number(e.target.value))} />
            </div>
            <div className="text-xs text-slate-300 flex items-end">Leave stock blank to add later. You’ll see a reminder.</div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-slate-300">Stock is optional. We’ll remind you to include it.</div>
        <div className="flex gap-2">
          {initial?.id && (
            <button onClick={handleDelete} disabled={saving} className="px-4 py-2 rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10">{saving ? 'Deleting…' : 'Delete'}</button>
          )}
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10">Cancel</button>
          <button onClick={handleSave} disabled={!canSave || saving} className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-200 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
