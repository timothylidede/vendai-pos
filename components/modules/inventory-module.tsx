"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Package, AlertTriangle, TrendingUp, Upload, FileText, PlusCircle, Download, Check, ArrowLeft, Wand2 } from "lucide-react"
import { motion } from "framer-motion"
import { AIProcessingModal } from "../ai-processing-modal"
import { LoadingSpinner } from "../loading-spinner"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, limit, doc, setDoc, addDoc, deleteDoc, getDoc } from "firebase/firestore"
import { POS_PRODUCTS_COL, INVENTORY_COL } from "@/lib/pos-operations"
import { useAuth } from "@/contexts/auth-context"

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

const INVENTORY_CACHE_PREFIX = 'inventory-cache-v1'
const INVENTORY_CACHE_TTL_MS = 60_000

const getCacheKey = (orgId: string) => `${INVENTORY_CACHE_PREFIX}:${orgId}`

const DEFAULT_IMAGE_PROMPT = `Photorealistic product photo; single centered product on a floating glass shelf; uniform slate background (#1f2937) matching the Vendai dashboard; cool teal-accent studio lighting; high detail; no text, props, hands, or accessories; background color must remain constant.`

export function InventoryModule() {
  const [activeTab, setActiveTab] = useState<'products' | 'new'>('products')
  const [orgId, setOrgId] = useState<string>('')
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
  const [bulkGenerating, setBulkGenerating] = useState<boolean>(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
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
  const { userData } = useAuth()

  // Handle entrance animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsEntering(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Derive orgId from authenticated user, if available
  useEffect(() => {
    if (userData?.organizationName) {
      setOrgId(userData.organizationName)
    }
  }, [userData?.organizationName])

  const hydrateFromCache = useCallback((org: string) => {
    if (typeof window === 'undefined' || !org) return false
    try {
      const cached = window.sessionStorage.getItem(getCacheKey(org))
      if (!cached) return false
      const parsed = JSON.parse(cached)
      if (!parsed?.products) return false

      setProducts(parsed.products)
      setInvMap(parsed.invMap || {})
      setHasPricelist(!!parsed.hasPricelist)
      setShowMissingStockAlert(!!parsed.showMissingStockAlert)
      setLoadingProducts(false)

      return parsed.timestamp && Date.now() - parsed.timestamp < INVENTORY_CACHE_TTL_MS
    } catch (error) {
      console.warn('Failed to hydrate inventory cache', error)
      return false
    }
  }, [])

  // Helper: load products and inventory without composite index
  const loadOrgProducts = async (org: string, options: { background?: boolean } = {}) => {
    const { background = false } = options
    if (!org) {
      setProducts([])
      setHasPricelist(false)
      setShowMissingStockAlert(false)
      if (!background) setLoadingProducts(false)
      return
    }
    try {
      if (!background) setLoadingProducts(true)
      // Products for specific org only (no orderBy to avoid composite index)
      const productQuery = query(
        collection(db, POS_PRODUCTS_COL),
        where('orgId', '==', org),
        limit(1000)
      )
      const inventoryQuery = query(collection(db, INVENTORY_COL), where('orgId', '==', org), limit(1000))

      const [productsSnap, inventorySnap] = await Promise.all([
        getDocs(productQuery),
        getDocs(inventoryQuery)
      ])

      // Client-side sort by updatedAt desc when present
      const prods = productsSnap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())

      const map: Record<string, { qtyBase: number; qtyLoose: number; unitsPerBase: number }> = {}
      inventorySnap.docs.forEach(d => {
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
        const normalizedImage = p.image_url ?? p.imageUrl ?? p.image
        const productData = normalizedImage
          ? { ...p, image: normalizedImage, image_url: normalizedImage, imageUrl: normalizedImage }
          : p
        return {
          ...productData,
          stock: stockPieces,
          status,
          unitsPerBase
        }
      })

      setProducts(augmented)
      setInvMap(map)
      const anyInventory = inventorySnap.size > 0
      const anyProducts = prods.length > 0
      setHasPricelist(anyProducts || anyInventory)
      setShowMissingStockAlert(anyProducts && !anyInventory)

      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(
            getCacheKey(org),
            JSON.stringify({
              products: augmented,
              invMap: map,
              hasPricelist: anyProducts || anyInventory,
              showMissingStockAlert: anyProducts && !anyInventory,
              timestamp: Date.now()
            })
          )
        } catch (error) {
          console.warn('Failed to cache inventory data', error)
        }
      }
    } catch (e) {
      // noop
    } finally {
      if (!background) setLoadingProducts(false)
    }
  }

  // Fetch products and inventory for org
  useEffect(() => {
    if (!orgId) return
    const isFresh = hydrateFromCache(orgId)
    if (isFresh) {
      const t = window.setTimeout(() => {
        loadOrgProducts(orgId, { background: true })
      }, 150)
      return () => window.clearTimeout(t)
    }
    loadOrgProducts(orgId)
  }, [orgId, hydrateFromCache])

  const handleBulkGenerate = async () => {
    if (!orgId || bulkGenerating) return
    const idsMissing = products.filter(p => !p.image).map(p => p.id)
    if (idsMissing.length === 0) return
  const BULK_LIMIT = 5
  const CONCURRENCY = 1
    const target = idsMissing.slice(0, BULK_LIMIT)
    setBulkGenerating(true)
    setBulkProgress({ done: 0, total: target.length })
    try {
      for (let i = 0; i < target.length; i += CONCURRENCY) {
        const batch = target.slice(i, i + CONCURRENCY)
        await Promise.all(batch.map(async (productId) => {
          try {
            const res = await fetch('/api/image/openai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                orgId, 
                productId, 
                useGoogleRefs: true,
                promptStyle: DEFAULT_IMAGE_PROMPT
              })
            })
            const json = await res.json().catch(() => ({} as any))
            const url = (json as any)?.url as string | undefined
            if (url) {
              setProducts(prev => prev.map(p => p.id === productId ? { ...p, image: url, image_url: url, imageUrl: url } : p))
            }
          } catch {
            // ignore
          } finally {
            setBulkProgress(prev => ({ done: Math.min(prev.done + 1, prev.total), total: prev.total }))
          }
        }))
      }
      // Final refresh to catch any lagging writes
      await loadOrgProducts(orgId)
    } finally {
      setBulkGenerating(false)
    }
  }

  const handleBackClick = () => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      router.push('/modules')
    }, 200)
  }

  // Compact, minimal steps for a faster UX
  const initializeProcessingSteps = (): ProcessingStep[] => [
    { id: 'file_validation', title: 'Validate', description: '', status: 'pending' },
    { id: 'ai_extraction', title: 'Extract', description: '', status: 'pending' },
    { id: 'importing', title: 'Import', description: '', status: 'pending' },
    { id: 'finalization', title: 'Done', description: '', status: 'pending' }
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

      // Step 2: AI extraction/processing
      updateStepStatus('ai_extraction', 'processing', 0)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('orgId', orgId)
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      
      if (ext === 'csv') {
        // Call processing API
        const response = await fetch('/api/inventory/process-enhanced', { method: 'POST', body: formData })
        const result = await response.json().catch(() => ({} as any))
        
        if (!response.ok || !result?.success) {
          setProcessingError(result?.error || 'Enhanced processing failed')
          updateStepStatus('ai_extraction', 'error')
          return
        }
        updateStepStatus('ai_extraction', 'completed', 100)
      } else {
        setProcessingError('Currently, only CSV uploads are supported. PDF/Excel support coming soon.')
        updateStepStatus('ai_extraction', 'error')
        return
      }
      // Step 3: Importing
      updateStepStatus('importing', 'processing', 0)
      await new Promise(resolve => setTimeout(resolve, 400))
      updateStepStatus('importing', 'completed', 100)

      // Step 4: Finalization
      updateStepStatus('finalization', 'processing', 0)
      await new Promise(resolve => setTimeout(resolve, 200))
      updateStepStatus('finalization', 'completed', 100)

      // Success: reload products from Firestore for Products tab
      await loadOrgProducts(orgId)
      
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
          {activeTab === 'products' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkGenerate}
                disabled={bulkGenerating || products.filter(p => !p.image).length === 0}
                className="group relative w-auto h-10 px-3 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] disabled:opacity-50"
                title="Generate images for products missing images"
              >
                <Wand2 className="w-5 h-5 text-slate-200 group-hover:text-white mr-2" />
                <span className="text-slate-200 group-hover:text-white text-sm font-medium">
                  {bulkGenerating
                    ? `Generating ${bulkProgress.done}/${bulkProgress.total}`
                    : `Generate images (${products.filter(p => !p.image).length})`}
                </span>
              </button>
            </div>
          )}
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
            {loadingProducts ? (
              <div className="min-h-[55vh] flex items-center justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/60 via-slate-900/35 to-indigo-900/30 backdrop-blur-xl shadow-[0_12px_40px_-18px_rgba(37,99,235,0.45)] space-y-4">
                <div className="relative flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-800/70 via-slate-900/40 to-blue-900/30 border border-white/5 shadow-[0_10px_30px_-15px_rgba(59,130,246,0.35)]">
                  <Package className="relative z-10 w-10 h-10 text-slate-400/80" />
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/15 via-transparent to-transparent" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-200 text-lg font-semibold tracking-wide">No products yet</h4>
                  <p className="text-slate-400/90 text-sm max-w-sm mx-auto">
                    Add your first items from the New tab to see your catalog come to life.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('new')}
                  className="mt-2 px-5 py-2.5 rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-500/25 via-blue-500/20 to-indigo-500/25 text-blue-100 text-sm font-medium tracking-wide shadow-[0_6px_24px_-14px_rgba(59,130,246,0.6)] hover:border-blue-400/40 hover:from-blue-500/30 hover:via-blue-500/20 hover:to-indigo-500/30 transition-all"
                >
                  Add your first product
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {products.map(item => (
                <div
                  key={item.id}
                  className="group relative transform-gpu overflow-hidden rounded-3xl border border-slate-400/15 bg-gradient-to-br from-slate-900/55 via-slate-900/30 to-sky-950/35 backdrop-blur-2xl transition-all duration-500 shadow-[0_12px_40px_-22px_rgba(56,189,248,0.45)] hover:shadow-[0_28px_70px_-32px_rgba(59,130,246,0.55)] hover:-translate-y-2 hover:scale-[1.02] hover:rotate-[0.35deg] cursor-pointer"
                  onClick={() => { setEditingProduct(item); setIsModalOpen(true) }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/12 via-transparent to-indigo-600/18" />
                    <div className="absolute inset-0 blur-2xl bg-cyan-500/10" />
                  </div>
                  <div className="aspect-square w-full bg-gradient-to-br from-slate-800/65 via-slate-900/55 to-slate-950/60 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-[0.6deg]" />
                    ) : (
                      <Package className="w-16 h-16 text-slate-400 transition-all duration-700 group-hover:scale-125 group-hover:text-cyan-200/90 group-hover:-translate-y-1" />
                    )}
                    <div className="absolute inset-x-6 bottom-6 h-[1px] rounded-full bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  </div>
                  <div className="p-4 relative">
                    <h4 className="text-slate-200 font-medium text-sm truncate transition-colors duration-300 group-hover:text-white">{item.name}</h4>
                    <div className="mt-2 flex items-center justify-between text-xs opacity-80 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                      <span className="text-slate-400 group-hover:text-slate-200/90">{item.pieceBarcode || item.brand || ''}</span>
                      <span className={`px-2 py-1 rounded-full border backdrop-blur-md ${
                        (item.status || 'good') === 'good' ? 'text-cyan-300 border-cyan-400/40 bg-cyan-500/20' :
                        (item.status || 'good') === 'low' ? 'text-amber-300 border-amber-400/40 bg-amber-500/15' :
                        (item.status || 'good') === 'out' ? 'text-rose-300 border-rose-400/40 bg-rose-500/15' : 'text-slate-300 border-slate-500/40 bg-slate-600/20'
                      }`}>
                        {item.stock ?? '—'}
                      </span>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 border border-white/5 opacity-0 group-hover:opacity-40 transition-opacity duration-500 rounded-3xl" />
                    <div className="absolute -top-16 -left-16 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl opacity-0 group-hover:opacity-80 transition-opacity duration-700" />
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'new' && (
          <div className="space-y-8 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="group relative overflow-hidden rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-slate-950/88 via-slate-950/74 to-emerald-950/38 backdrop-blur-2xl transition-all duration-500 shadow-[0_24px_60px_-32px_rgba(16,185,129,0.4)] hover:border-emerald-300/30 hover:shadow-[0_32px_72px_-28px_rgba(16,185,129,0.45)] cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isProcessingModalOpen}
                />
                <div className="relative p-10">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/16 via-emerald-500/08 to-emerald-400/08 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-emerald-500/12 via-emerald-500/06 to-emerald-400/10 border border-emerald-300/25 flex items-center justify-center group-hover:scale-105 transition-all duration-500 shadow-[0_10px_30px_-20px_rgba(16,185,129,0.35)]">
                      {processedProducts.length > 0 ? (
                        <Check className="w-12 h-12 text-emerald-200 transition-all duration-500" />
                      ) : (
                        <Upload className="w-12 h-12 text-slate-300 group-hover:text-emerald-200 transition-all duration-500" />
                      )}
                    </div>
                    <h4 className={`text-lg font-semibold tracking-wide transition-colors duration-300 ${processedProducts.length > 0 ? 'text-emerald-200/90' : 'text-slate-100 group-hover:text-white'}`}>
                      {processedProducts.length > 0 ? 'Done' : 'Upload pricelist'}
                    </h4>
                    <p className={`text-sm leading-relaxed transition-colors duration-300 ${processedProducts.length > 0 ? 'text-emerald-200/70' : 'text-slate-400 group-hover:text-slate-200/90'}`}>
                      {processedProducts.length > 0 
                        ? `${processedProducts.length} products processed`
                        : 'CSV, Excel, or PDF. We parse items and add them.'}
                    </p>
                  </div>
                </div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/08 to-emerald-400/12" />
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-200/30 to-transparent" />
                </div>
              </div>

              <div
                className="group relative overflow-hidden rounded-3xl border border-blue-400/18 bg-gradient-to-br from-slate-950/88 via-slate-950/74 to-blue-950/44 backdrop-blur-2xl transition-all duration-500 shadow-[0_24px_60px_-32px_rgba(59,130,246,0.4)] hover:border-blue-300/35 hover:shadow-[0_32px_72px_-28px_rgba(59,130,246,0.45)] cursor-pointer"
                onClick={() => { setEditingProduct(null); setIsModalOpen(true) }}
              >
                <div className="relative p-10">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-blue-500/08 to-indigo-500/12 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-blue-500/12 via-blue-500/06 to-indigo-500/10 border border-blue-300/24 flex items-center justify-center group-hover:scale-105 transition-all duration-500 shadow-[0_10px_30px_-20px_rgba(59,130,246,0.35)]">
                      <PlusCircle className="w-12 h-12 text-blue-200/90 transition-all duration-500" />
                    </div>
                    <h4 className="text-lg font-semibold tracking-wide text-blue-100/90 group-hover:text-white transition-colors duration-300">Add manually</h4>
                    <p className="text-sm leading-relaxed text-slate-400 group-hover:text-slate-200/90 transition-colors duration-300">Create products individually with complete details and specifications.</p>
                  </div>
                </div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/09 to-indigo-500/12" />
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-200/28 to-transparent" />
                </div>
              </div>

              {hasPricelist && (
                <div className="group relative overflow-hidden rounded-3xl border border-cyan-400/16 bg-gradient-to-br from-slate-950/88 via-slate-950/74 to-cyan-950/40 backdrop-blur-2xl transition-all duration-500 shadow-[0_24px_60px_-32px_rgba(6,182,212,0.4)] hover:border-cyan-300/32 hover:shadow-[0_32px_72px_-28px_rgba(6,182,212,0.45)]">
                  <div className="relative p-10">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 via-cyan-500/08 to-blue-500/12 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative text-center">
                      <div className="w-24 h-24 mx-auto mb-6 rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-cyan-500/12 via-cyan-500/06 to-blue-500/10 border border-cyan-300/24 flex items-center justify-center group-hover:scale-105 transition-all duration-500 shadow-[0_10px_30px_-20px_rgba(6,182,212,0.35)]">
                        <Upload className="w-12 h-12 text-cyan-200/90 transition-all duration-500" />
                      </div>
                      <h4 className="text-lg font-semibold tracking-wide text-cyan-100/90 group-hover:text-white transition-colors duration-300">Re-upload pricelist</h4>
                      <p className="text-sm leading-relaxed text-slate-400 group-hover:text-slate-200/90 transition-colors duration-300">CSV/XLSX/PDF supported. Organization ID optional.</p>
                      <form className="space-y-3 mt-4" onSubmit={(e) => e.preventDefault()}>
                        <div className="flex items-center space-x-2">
                          <input className="flex-1 rounded-xl border border-white/8 bg-slate-950/70 px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-cyan-400/35 focus:outline-none transition-all" placeholder="Organization ID" value={orgId} onChange={e => setOrgId(e.target.value)} />
                        </div>
                        <div>
                          <input id="csv-reupload" type="file" className="hidden" accept=".csv,.xlsx,.xls,.pdf" onChange={async (ev) => {
                            const f = ev.target.files?.[0]; if (!f) return;
                            const fd = new FormData(); fd.append('file', f); fd.append('orgId', orgId);
                            const res = await fetch('/api/inventory/process-enhanced', { method: 'POST', body: fd });
                            ev.currentTarget.value = ''
                            if (res.ok) {
                              await loadOrgProducts(orgId)
                            }
                          }} />
                          <label htmlFor="csv-reupload" className="inline-flex items-center space-x-2 rounded-xl border border-cyan-400/24 bg-cyan-500/12 px-4 py-2 text-cyan-100/90 hover:border-cyan-300/40 hover:bg-cyan-500/18 transition-all duration-300 cursor-pointer">
                            <Upload className="w-4 h-4" />
                            <span>Upload CSV</span>
                          </label>
                        </div>
                      </form>
                    </div>
                  </div>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/09 to-cyan-500/14" />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-200/26 to-transparent" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="flex flex-wrap gap-4 justify-center">
                <button 
                  onClick={handleImportTemplate}
                  disabled={isDownloading}
                  className="group relative overflow-hidden rounded-2xl border border-blue-400/16 bg-gradient-to-r from-slate-950/82 via-slate-950/62 to-blue-950/40 px-6 py-3 backdrop-blur-xl transition-all duration-300 shadow-[0_18px_40px_-22px_rgba(59,130,246,0.45)] hover:border-blue-300/30 hover:shadow-[0_24px_56px_-24px_rgba(59,130,246,0.42)] hover:scale-[1.015] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/14 via-blue-500/08 to-purple-500/12 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center gap-3">
                    {downloadComplete ? (
                      <Check className="w-5 h-5 text-emerald-200/90 transition-colors duration-300" />
                    ) : isDownloading ? (
                      <Download className="w-5 h-5 text-blue-200/90 animate-bounce transition-colors duration-300" />
                    ) : (
                      <FileText className="w-5 h-5 text-slate-300 group-hover:text-blue-200 transition-colors duration-300" />
                    )}
                    <span className={`font-medium transition-colors duration-300 ${
                      downloadComplete ? 'text-emerald-200' :
                      isDownloading ? 'text-blue-200' :
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
              onSaved={() => { setIsModalOpen(false); setEditingProduct(null); (async () => { await loadOrgProducts(orgId) })() }}
              onDeleted={() => { setIsModalOpen(false); setEditingProduct(null); (async () => { await loadOrgProducts(orgId) })() }}
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
        orgId,
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
