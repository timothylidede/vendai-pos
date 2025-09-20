import { NextRequest, NextResponse } from 'next/server'
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { 
  withErrorHandling, 
  ApiErrors, 
  checkRateLimit
} from '@/lib/api-error-handling'
import logger from '@/lib/logger'

interface ExportOptions {
  collections: string[]
  format: 'json' | 'csv'
  dateRange?: {
    start: string
    end: string
  }
  filters?: Record<string, any>
  includeDeleted?: boolean
}

// GET - Export data in various formats
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Rate limiting based on IP address
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  checkRateLimit(ip, 10, 60 * 60 * 1000) // 10 requests per hour for exports

  const { searchParams } = new URL(request.url)
  const collections = searchParams.get('collections')?.split(',') || []
  const format = (searchParams.get('format') || 'json') as 'json' | 'csv'
  const distributorId = searchParams.get('distributorId')
  const retailerId = searchParams.get('retailerId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (!collections.length) {
    throw ApiErrors.ValidationError('At least one collection must be specified')
  }

  // Validate collections
  const allowedCollections = ['orders', 'settlements', 'invoices', 'retailers', 'distributors', 'products']
  const invalidCollections = collections.filter(c => !allowedCollections.includes(c))
  if (invalidCollections.length) {
    throw ApiErrors.ValidationError(`Invalid collections: ${invalidCollections.join(', ')}`)
  }

  logger.info('Exporting data', { collections, format, distributorId, retailerId })

  try {
    const exportData: Record<string, any[]> = {}

    for (const collectionName of collections) {
      const data = await exportCollection(
        collectionName, 
        { distributorId, retailerId, startDate, endDate }
      )
      exportData[collectionName] = data
    }

    if (format === 'csv' && collections.length === 1) {
      // Single collection CSV export
      const csvContent = convertToCSV(exportData[collections[0]])
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${collections[0]}_export_${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    } else if (format === 'csv') {
      // Multiple collections - create zip with CSV files (simplified as JSON for now)
      return NextResponse.json({
        success: true,
        message: 'Multiple collection CSV export not yet implemented. Use JSON format.',
        data: exportData
      })
    } else {
      // JSON export
      const fileName = `vendai_export_${new Date().toISOString().split('T')[0]}.json`
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${fileName}"`
        }
      })
    }

  } catch (error) {
    logger.error('Export failed', error)
    throw ApiErrors.FirebaseError('data export', error)
  }
})

// POST - Create backup
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Rate limiting based on IP address
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  checkRateLimit(ip, 5, 60 * 60 * 1000) // 5 backups per hour

  const { collections, distributorId, retailerId, includeDeleted } = await request.json()

  if (!collections || !Array.isArray(collections)) {
    throw ApiErrors.ValidationError('Collections array is required')
  }

  logger.info('Creating backup', { collections, distributorId, retailerId })

  try {
    const backupData: Record<string, any> = {
      createdAt: new Date().toISOString(),
      version: '1.0',
      distributorId,
      retailerId,
      includeDeleted,
      collections: {}
    }

    for (const collectionName of collections) {
      const data = await exportCollection(
        collectionName,
        { distributorId, retailerId, includeDeleted }
      )
      backupData.collections[collectionName] = {
        count: data.length,
        data: data
      }
    }

    // In a real implementation, you would upload this to Firebase Storage
    // For now, we'll return the backup data
    const backupId = `backup_${Date.now()}`
    
    logger.info('Backup created successfully', { 
      backupId, 
      totalRecords: Object.values(backupData.collections).reduce((sum, col: any) => sum + col.count, 0)
    })

    return NextResponse.json({
      success: true,
      backupId,
      data: backupData,
      message: 'Backup created successfully'
    })

  } catch (error) {
    logger.error('Backup creation failed', error)
    throw ApiErrors.FirebaseError('backup creation', error)
  }
})

// Helper function to export collection data
async function exportCollection(
  collectionName: string, 
  filters: {
    distributorId?: string | null
    retailerId?: string | null
    startDate?: string | null
    endDate?: string | null
    includeDeleted?: boolean
  }
): Promise<any[]> {
  let q = query(collection(db, collectionName))

  // Apply filters
  if (filters.distributorId) {
    q = query(q, where('distributorId', '==', filters.distributorId))
  }
  if (filters.retailerId) {
    q = query(q, where('retailerId', '==', filters.retailerId))
  }

  // Date range filtering
  if (filters.startDate && filters.endDate) {
    const startTimestamp = new Date(filters.startDate)
    const endTimestamp = new Date(filters.endDate)
    q = query(
      q, 
      where('createdAt', '>=', startTimestamp),
      where('createdAt', '<=', endTimestamp),
      orderBy('createdAt', 'desc')
    )
  } else {
    // Default ordering
    try {
      q = query(q, orderBy('createdAt', 'desc'))
    } catch {
      // If createdAt field doesn't exist, skip ordering
    }
  }

  const snapshot = await getDocs(q)
  const data: any[] = []

  snapshot.forEach((doc) => {
    const docData = doc.data()
    
    // Convert Firestore Timestamps to ISO strings
    const processedData = processFirestoreData({ id: doc.id, ...docData })
    
    // Filter out deleted items unless explicitly included
    if (!filters.includeDeleted && docData.deleted) {
      return
    }

    data.push(processedData)
  })

  return data
}

// Helper to process Firestore data for export
function processFirestoreData(data: any): any {
  const processed = { ...data }

  for (const key in processed) {
    const value = processed[key]
    
    // Convert Firestore Timestamps to ISO strings
    if (value instanceof Timestamp) {
      processed[key] = value.toDate().toISOString()
    }
    // Handle nested objects
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      processed[key] = processFirestoreData(value)
    }
    // Handle arrays with possible nested objects
    else if (Array.isArray(value)) {
      processed[key] = value.map(item => 
        item && typeof item === 'object' ? processFirestoreData(item) : item
      )
    }
  }

  return processed
}

// Helper to convert JSON to CSV
function convertToCSV(data: any[]): string {
  if (!data.length) return ''

  // Get all unique keys from all objects
  const allKeys = new Set<string>()
  data.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key))
  })

  const headers = Array.from(allKeys)
  const csvRows = [headers.join(',')]

  data.forEach(item => {
    const row = headers.map(header => {
      const value = item[header]
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') return JSON.stringify(value)
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return String(value)
    })
    csvRows.push(row.join(','))
  })

  return csvRows.join('\n')
}

// Helper to generate financial reports
async function generateFinancialReport(
  distributorId: string,
  startDate: string,
  endDate: string
) {
  const [orders, settlements, invoices] = await Promise.all([
    exportCollection('orders', { distributorId, startDate, endDate }),
    exportCollection('settlements', { distributorId, startDate, endDate }),
    exportCollection('invoices', { distributorId, startDate, endDate })
  ])

  const totalGMV = orders.reduce((sum, order) => sum + (order.total || 0), 0)
  const totalSettlements = settlements.reduce((sum, settlement) => sum + (settlement.settlement || 0), 0)
  const totalInvoiced = invoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0)

  return {
    period: { startDate, endDate },
    distributorId,
    summary: {
      totalOrders: orders.length,
      totalGMV,
      totalSettlements,
      totalInvoiced,
      settlementRate: totalGMV > 0 ? (totalSettlements / totalGMV) * 100 : 0
    },
    orders,
    settlements,
    invoices
  }
}