/**
 * Comprehensive Product Import Component
 * Allows importing from CSV and PDF-extracted data
 */

'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'
import { Badge } from './ui/badge'
import { Upload, FileText, Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { quickImportProducts, getImportStats, ImportProgress } from '@/lib/product-import'

interface ImportStats {
  totalProducts: number
  suppliers: string[]
  categories: string[]
  supplierCounts: Record<string, number>
  categoryCounts: Record<string, number>
}

export function ProductImportComponent() {
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [importComplete, setImportComplete] = useState(false)
  const { userData } = useAuth()
  const { toast } = useToast()

  // Get import statistics
  const stats: ImportStats = getImportStats()

  const handleQuickImport = async () => {
    if (!userData?.organizationName) {
      toast({
        title: 'Error',
        description: 'Organization not found. Please ensure you are logged in.',
        variant: 'destructive'
      })
      return
    }

    setImporting(true)
    setImportComplete(false)
    setImportProgress(null)

    try {
      await quickImportProducts(userData.organizationName, (progress) => {
        setImportProgress(progress)
      })
      
      setImportComplete(true)
      toast({
        title: 'Import Successful!',
        description: `Successfully imported ${stats.totalProducts} products from price lists.`
      })
    } catch (error) {
      console.error('Import failed:', error)
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      })
    } finally {
      setImporting(false)
      setImportProgress(null)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Product Import Center</h2>
          <p className="text-slate-400">Import products from Sam West Supermarket and Mahitaji Distributors</p>
        </div>
        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
          {stats.totalProducts} Products Ready
        </Badge>
      </div>

      {/* Import Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalProducts}</div>
            <p className="text-xs text-slate-400">From CSV files</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.suppliers.length}</div>
            <p className="text-xs text-slate-400">Price lists processed</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.categories.length}</div>
            <p className="text-xs text-slate-400">Product categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Breakdown */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Supplier Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(stats.supplierCounts).map(([supplier, count]) => (
              <div key={supplier} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-white">{supplier}</span>
                </div>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                  {count} products
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Import Actions */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Import Products</CardTitle>
          <p className="text-slate-400">Import all processed products to your POS system</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {importProgress?.currentStep || 'Importing products...'}
                </span>
              </div>
              <Progress 
                value={importProgress?.percentage || 0} 
                className="w-full" 
              />
              {importProgress && (
                <div className="text-sm text-slate-400">
                  {importProgress.completed} / {importProgress.total} products processed
                </div>
              )}
            </div>
          )}

          {importComplete && (
            <div className="flex items-center space-x-2 text-green-400 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle className="w-5 h-5" />
              <span>Import completed successfully!</span>
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              onClick={handleQuickImport}
              disabled={importing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Import All Products
                </>
              )}
            </Button>

            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <Upload className="w-4 h-4 mr-2" />
              Custom Import
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PDF Extraction Status */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">PDF Extraction Status</CardTitle>
          <p className="text-slate-400">Advanced extraction from PDF price lists</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-white">Sam West Supermarket (153 pages)</span>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                Text Extracted
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-white">Mahitaji Distributors (46 pages)</span>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                Text Extracted
              </Badge>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-blue-400 font-medium">PDF Extraction Available</p>
                <p className="text-slate-400 text-sm mt-1">
                  Set up OpenAI API key to extract hundreds more products from the PDF files automatically.
                  Current import uses CSV data (170 products). PDF extraction can yield 1000+ products.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}