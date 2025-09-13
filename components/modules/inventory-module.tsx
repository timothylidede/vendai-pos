"use client"

import { useState } from "react"
import { Package, AlertTriangle, TrendingUp, Plus, LayoutGrid, List, Upload, FileText, PlusCircle, Download, Check } from "lucide-react"
import { AIProcessingModal } from "../ai-processing-modal"

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
}

const inventory = [
  { 
    id: "1", 
    name: "Acoustic Bloc Screens", 
    sku: "E-COM11",
    variants: 2,
    stock: 24, 
    minStock: 10, 
    price: 295.00, 
    status: "good" 
  },
  { 
    id: "2", 
    name: "Cabinet with Doors", 
    sku: "FURN_7800",
    variants: 2,
    stock: 3, 
    minStock: 10, 
    price: 140.00, 
    status: "low" 
  },
  { 
    id: "3", 
    name: "Conference Chair", 
    sku: "FURN_1118",
    variants: 1,
    stock: 0, 
    minStock: 5, 
    price: 33.00, 
    status: "out" 
  },
  { 
    id: "4", 
    name: "Corner Desk Left Sit", 
    sku: "FURN_0001",
    variants: 1,
    stock: 15, 
    minStock: 8, 
    price: 85.00, 
    status: "good" 
  }
]

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
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([])
  const [currentStep, setCurrentStep] = useState<string>('')
  const [processingError, setProcessingError] = useState<string>('')
  const [processedProducts, setProcessedProducts] = useState<any[]>([])

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

    try {
      // Step 1: File validation
      updateStepStatus('file_validation', 'processing', 0)
      
      await new Promise(resolve => setTimeout(resolve, 500)) // Visual delay
      updateStepStatus('file_validation', 'completed', 100)

      // Step 2: Text extraction
      updateStepStatus('text_extraction', 'processing', 0)
      
      const formData = new FormData()
      formData.append('file', file)

      await new Promise(resolve => setTimeout(resolve, 800))
      updateStepStatus('text_extraction', 'completed', 100)

      // Step 3: AI processing
      updateStepStatus('ai_extraction', 'processing', 0)

      const response = await fetch('/api/aplord', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (!response.ok || !result.success) {
        // Handle specific error types
        let errorMessage = result.error || 'Processing failed unexpectedly'
        
        if (result.step) {
          switch (result.step) {
            case 'initialization':
              errorMessage = 'AI services are not properly configured. Please contact support.'
              break
            case 'file_validation':
              errorMessage = result.error || 'Invalid file format. Please upload CSV, PDF, or Excel files only.'
              break
            case 'content_validation':
              errorMessage = 'The file does not appear to contain inventory or product data.'
              break
            case 'ai_extraction':
              errorMessage = 'AI processing failed. The document may be too complex or corrupted.'
              break
            case 'data_parsing':
              errorMessage = 'Could not extract valid product data from the document.'
              break
            default:
              errorMessage = result.error || 'An unexpected error occurred during processing.'
          }
        }
        
        setProcessingError(errorMessage)
        updateStepStatus('ai_extraction', 'error')
        return
      }

      updateStepStatus('ai_extraction', 'completed', 100)

      // Step 4: Data validation
      updateStepStatus('data_validation', 'processing', 0)
      await new Promise(resolve => setTimeout(resolve, 600))
      updateStepStatus('data_validation', 'completed', 100)

      // Step 5: Image generation
      updateStepStatus('image_generation', 'processing', 0)
      await new Promise(resolve => setTimeout(resolve, 1200))
      updateStepStatus('image_generation', 'completed', 100)

      // Step 6: Finalization
      updateStepStatus('finalization', 'processing', 0)
      await new Promise(resolve => setTimeout(resolve, 400))
      updateStepStatus('finalization', 'completed', 100)

      // Success
      setProcessedProducts(result.products || [])
      
      // Auto-close modal after success
      setTimeout(() => {
        setIsProcessingModalOpen(false)
      }, 2000)

    } catch (error) {
      console.error('Upload error:', error)
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
    <div className="space-y-8">
      {/* AI Processing Modal */}
      <AIProcessingModal
        isOpen={isProcessingModalOpen}
        onClose={() => setIsProcessingModalOpen(false)}
        steps={processingSteps}
        currentStep={currentStep}
        error={processingError}
        onRetry={handleRetryProcessing}
      />

      {/* Tab Navigation */}
      <div className="flex items-center justify-between">
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
                : 'text-slate-200 hover:text-blue-400 hover:bg-white/[0.05] backdrop-blur-sm'}`}
            onClick={() => setActiveTab('new')}
          >
            <span className="relative">
              New
              {activeTab === 'new' && (
                <span className="absolute left-0 right-0 bottom-0 h-1 bg-gradient-to-r from-blue-400 via-blue-200 to-blue-400 rounded-full blur-sm animate-pulse"></span>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'products' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {inventory.map(item => (
            <div
              key={item.id}
              className="group relative rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-transparent border border-white/[0.08] hover:border-white/[0.15] transition-all duration-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_48px_-12px_rgba(59,130,246,0.15)] cursor-pointer hover:scale-105 hover:-translate-y-2"
            >
              {/* Glassmorphic background overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] via-transparent to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="aspect-square w-full bg-gradient-to-br from-slate-800/60 to-slate-700/40 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] via-transparent to-blue-600/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <Package className="w-16 h-16 text-slate-400 group-hover:scale-125 group-hover:text-blue-300 group-hover:rotate-12 transition-all duration-500 relative z-10" />
              </div>
              
              <div className="p-4 relative">
                <h4 className="text-slate-200 font-medium text-sm truncate group-hover:text-white transition-colors duration-300">{item.name}</h4>
                <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                  <span className="text-xs text-slate-400 group-hover:text-slate-300">{item.sku}</span>
                  <span className={`text-xs px-2 py-1 rounded-full border ${
                    item.status === 'good' ? 'text-blue-400 bg-blue-500/20 border-blue-500/30' :
                    item.status === 'low' ? 'text-orange-400 bg-orange-500/20 border-orange-500/30' :
                    'text-red-400 bg-red-500/20 border-red-500/30'
                  }`}>
                    {item.stock}
                  </span>
                </div>
              </div>
              
              {/* Top highlight line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* New Product Options */
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Upload Document Option */}
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
                  
                  <h4 className={`text-slate-100 font-semibold text-xl mb-3 group-hover:text-white transition-colors duration-300 ${
                    processedProducts.length > 0 ? 'text-green-400' : ''
                  }`}>
                    {processedProducts.length > 0 ? 'Processing Complete!' : 'AI Document Processing'}
                  </h4>
                  <p className={`text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors duration-300 ${
                    processedProducts.length > 0 ? 'text-green-300' : ''
                  }`}>
                    {processedProducts.length > 0 
                      ? `Successfully processed ${processedProducts.length} products with AI-generated images and structured data` 
                      : 'Upload inventory files (CSV, Excel, PDF) for intelligent AI processing with automatic product extraction and image generation'
                    }
                  </p>
                </div>
              </div>
              
              {/* Glassmorphic overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.02] to-emerald-500/[0.05]" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </div>
            </div>

            {/* Add Manually Option */}
            <div className="group relative rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-transparent border border-white/[0.08] hover:border-white/[0.15] transition-all duration-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_48px_-12px_rgba(59,130,246,0.15)] cursor-pointer">
              <div className="relative p-10">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] via-transparent to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative text-center">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-2xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] flex items-center justify-center group-hover:scale-105 transition-all duration-500 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)]">
                    <PlusCircle className="w-12 h-12 text-slate-300 group-hover:text-blue-300 transition-all duration-500" />
                  </div>
                  
                  <h4 className="text-slate-100 font-semibold text-xl mb-3 group-hover:text-white transition-colors duration-300">
                    Add Manually
                  </h4>
                  <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors duration-300">
                    Create products individually with complete details and specifications
                  </p>
                </div>
              </div>
              
              {/* Glassmorphic overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.02] to-blue-500/[0.05]" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
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

          {/* Show processed products if any */}
          {processedProducts.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-semibold text-white mb-6 bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                Recently Processed Products ({processedProducts.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {processedProducts.slice(0, 10).map((product, index) => (
                  <div
                    key={index}
                    className="group relative rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-transparent border border-white/[0.08] hover:border-white/[0.15] transition-all duration-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_48px_-12px_rgba(59,130,246,0.15)] cursor-pointer hover:scale-105 hover:-translate-y-2"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.03] via-transparent to-emerald-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <div className="aspect-square w-full bg-gradient-to-br from-slate-800/60 to-slate-700/40 flex items-center justify-center relative overflow-hidden">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500"
                        />
                      ) : (
                        <Package className="w-16 h-16 text-slate-400 group-hover:scale-125 group-hover:text-green-300 group-hover:rotate-12 transition-all duration-500 relative z-10" />
                      )}
                    </div>
                    
                    <div className="p-4 relative">
                      <h4 className="text-slate-200 font-medium text-sm truncate group-hover:text-white transition-colors duration-300">
                        {product.name}
                      </h4>
                      <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                        <span className="text-xs text-slate-400 group-hover:text-slate-300">
                          {product.brand || product.code || 'N/A'}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border text-green-400 bg-green-500/20 border-green-500/30">
                          ${product.price_distributor}
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
        </div>
      )}
    </div>
  )
}
