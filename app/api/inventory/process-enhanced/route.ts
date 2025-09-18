import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, doc, getDocs, query, setDoc, where, limit, getDoc } from 'firebase/firestore'
import { POS_PRODUCTS_COL, INVENTORY_COL } from '@/lib/pos-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ProcessingResult {
  success: boolean
  stats: {
    totalProducts: number
    productsAdded: number
    productsUpdated: number
    duplicatesFound: number
    suppliersAnalyzed: number
    locationMatches: number
  }
  locationAnalytics?: {
    userLocation: { lat: number; lng: number }
    nearbySuppliers: Array<{
      name: string
      distance: number
      sharedProducts: number
    }>
  }
  error?: string
}

// Simple CSV parser for enhanced processing
function parseEnhancedCsv(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const obj: any = {}
    headers.forEach((header, i) => {
      const value = values[i] || ''
      obj[header] = value
    })
    return obj
  })
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Extract location from user data or IP
async function getUserLocation(orgId: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Try to get location from org settings first
    const orgDoc = await getDoc(doc(db, 'org_settings', orgId))
    if (orgDoc.exists() && orgDoc.data()?.location) {
      return orgDoc.data().location
    }
    
    // Fallback to default location (Nairobi, Kenya for demo)
    return { lat: -1.2921, lng: 36.8219 }
  } catch {
    return null
  }
}

// Analyze supplier proximity and product relationships
async function analyzeSupplierProximity(
  products: any[], 
  userLocation: { lat: number; lng: number }
): Promise<{ suppliersAnalyzed: number; locationMatches: number; nearbySuppliers: any[] }> {
  const suppliers = new Map<string, { 
    products: Set<string>, 
    locations: Array<{ lat: number; lng: number }> 
  }>()
  
  // Extract suppliers and their product relationships
  products.forEach(product => {
    const supplierName = product.supplier || product.brand || 'Unknown'
    if (!suppliers.has(supplierName)) {
      suppliers.set(supplierName, { 
        products: new Set(), 
        locations: [] 
      })
    }
    suppliers.get(supplierName)!.products.add(product.name)
    
    // Add mock location data for suppliers (in real app, this would come from a supplier database)
    if (supplierName !== 'Unknown') {
      const supplier = suppliers.get(supplierName)!
      if (supplier.locations.length === 0) {
        // Mock supplier locations around Nairobi area
        const mockLat = userLocation.lat + (Math.random() - 0.5) * 0.5
        const mockLng = userLocation.lng + (Math.random() - 0.5) * 0.5
        supplier.locations.push({ lat: mockLat, lng: mockLng })
      }
    }
  })
  
  // Calculate nearby suppliers
  const nearbySuppliers = []
  let locationMatches = 0
  
  for (const [name, data] of suppliers.entries()) {
    if (name === 'Unknown' || data.locations.length === 0) continue
    
    const avgLocation = data.locations[0] // Use first location for simplicity
    const distance = calculateDistance(
      userLocation.lat, userLocation.lng,
      avgLocation.lat, avgLocation.lng
    )
    
    if (distance <= 50) { // Within 50km
      locationMatches++
      nearbySuppliers.push({
        name,
        distance: Math.round(distance * 10) / 10,
        sharedProducts: data.products.size
      })
    }
  }
  
  return {
    suppliersAnalyzed: suppliers.size,
    locationMatches,
    nearbySuppliers: nearbySuppliers.sort((a, b) => a.distance - b.distance).slice(0, 5)
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const orgId = (form.get('orgId') as string) || ''
    
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: 'No file uploaded' 
      }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const text = buf.toString('utf8')
    const rows = parseEnhancedCsv(text)
    
    if (!rows.length) {
      return NextResponse.json({ 
        success: false, 
        error: 'No valid rows found' 
      }, { status: 400 })
    }

    // Get user location for analytics
    const userLocation = await getUserLocation(orgId)
    
    // Process products with enhanced analytics
    let created = 0, updated = 0, duplicatesFound = 0, invCreated = 0
    const processedProducts = []

    for (const r of rows.slice(0, 1000)) { // Limit to 1000 products
      let existingId: string | null = null
      
      // Check for existing products by barcode or name
      if (r.piecebarcode || r.barcode) {
        const barcode = r.piecebarcode || r.barcode
        const existingQuery = query(
          collection(db, POS_PRODUCTS_COL), 
          where('pieceBarcode', '==', barcode), 
          limit(1)
        )
        const existingSnap = await getDocs(existingQuery)
        if (!existingSnap.empty) {
          existingId = existingSnap.docs[0].id
          duplicatesFound++
        }
      }
      
      // If not found by barcode, check by name
      if (!existingId && r.name) {
        const nameQuery = query(
          collection(db, POS_PRODUCTS_COL),
          where('name', '==', r.name),
          limit(1)
        )
        const nameSnap = await getDocs(nameQuery)
        if (!nameSnap.empty) {
          existingId = nameSnap.docs[0].id
          duplicatesFound++
        }
      }

      const data = {
        name: r.name || 'Unnamed Product',
        brand: r.brand || '',
        category: r.category || 'Uncategorized',
        supplier: r.supplier || r.brand || '',
        pieceBarcode: r.piecebarcode || r.barcode || '',
        cartonBarcode: r.cartonbarcode || '',
        retailUom: r.retailuom || r.unit || 'PCS',
        baseUom: r.baseuom || 'CTN',
        unitsPerBase: Number(r.unitsperbase) || Number(r.packsize) || 1,
        piecePrice: Number(r.pieceprice) || Number(r.price) || 0,
        wholesalePrice: Number(r.wholesaleprice) || Number(r.cartonprice) || 0,
        image: r.image || '',
        orgId: orgId,
        updatedAt: new Date().toISOString(),
      }

      let productId: string
      if (existingId) {
        await setDoc(doc(db, POS_PRODUCTS_COL, existingId), data, { merge: true })
        updated++
        productId = existingId
      } else {
        const newRef = doc(collection(db, POS_PRODUCTS_COL))
        await setDoc(newRef, { ...data, createdAt: new Date().toISOString() })
        created++
        productId = newRef.id
      }

      // Create inventory stub with location analytics
      if (orgId) {
        const invId = `${orgId}_${productId}`
        const invRef = doc(db, INVENTORY_COL, invId)
        const exists = await getDoc(invRef)
        if (!exists.exists()) {
          await setDoc(invRef, {
            orgId,
            productId,
            qtyBase: 0,
            qtyLoose: 0,
            unitsPerBase: data.unitsPerBase,
            updatedAt: new Date().toISOString(),
            updatedBy: 'enhanced-upload',
            // Hidden analytics data
            _analytics: {
              uploadSource: 'csv',
              uploadTimestamp: new Date().toISOString(),
              supplierInfo: data.supplier ? { name: data.supplier } : null
            }
          })
          invCreated++
        }
      }

      processedProducts.push(data)
    }

    // Perform supplier proximity analysis
    const supplierAnalysis = userLocation ? 
      await analyzeSupplierProximity(processedProducts, userLocation) : 
      { suppliersAnalyzed: 0, locationMatches: 0, nearbySuppliers: [] }

    // Store analytics data for future use (hidden from user)
    if (userLocation && orgId) {
      const analyticsRef = doc(db, 'analytics', `${orgId}_${Date.now()}`)
      await setDoc(analyticsRef, {
        orgId,
        type: 'product_upload',
        timestamp: new Date().toISOString(),
        productCount: processedProducts.length,
        supplierAnalysis,
        userLocation,
        // This data can be used later for supplier recommendations
        _internal: {
          nearbySuppliers: supplierAnalysis.nearbySuppliers,
          productSupplierMapping: processedProducts.reduce((acc, product) => {
            if (product.supplier) {
              if (!acc[product.supplier]) acc[product.supplier] = []
              acc[product.supplier].push(product.name)
            }
            return acc
          }, {} as Record<string, string[]>)
        }
      })
    }

    const result: ProcessingResult = {
      success: true,
      stats: {
        totalProducts: rows.length,
        productsAdded: created,
        productsUpdated: updated,
        duplicatesFound,
        suppliersAnalyzed: supplierAnalysis.suppliersAnalyzed,
        locationMatches: supplierAnalysis.locationMatches
      }
    }

    if (userLocation) {
      result.locationAnalytics = {
        userLocation,
        nearbySuppliers: supplierAnalysis.nearbySuppliers
      }
    }

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Enhanced processing error:', e)
    return NextResponse.json({ 
      success: false, 
      error: e?.message || 'Processing failed' 
    }, { status: 500 })
  }
}