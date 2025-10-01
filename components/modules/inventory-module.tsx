"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Package, AlertCircle, Upload, FileText, PlusCircle, Download, Check, ArrowLeft, Wand2, Pencil, ShoppingCart, MapPin, X } from "lucide-react"
import { motion } from "framer-motion"
import { AIProcessingModal } from "../ai-processing-modal"
import { LoadingSpinner } from "../loading-spinner"
import { db } from "@/lib/firebase"
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  limit,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  getDoc,
  type QueryConstraint,
  type QuerySnapshot
} from "firebase/firestore"
import { POS_PRODUCTS_COL, INVENTORY_COL } from "@/lib/pos-operations"
import { useAuth } from "@/contexts/auth-context"
import type { ProcessedProduct } from "@/data/products-data"

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
}
// Products are sourced from Firestore only. No static fallback inventory.

interface ProcessingStats {
  totalProducts: number
  productsAdded: number
  productsUpdated: number
  duplicatesFound: number
  estimatedTimeRemaining: number
  suppliersAnalyzed: number
  locationMatches: number
}

type PricelistInfo = {
  fileName: string;
  downloadUrl: string;
  storagePath?: string;
  uploadedAt?: string;
  uploadedBy?: string | null;
  size?: number;
  contentType?: string;
  stats?: {
    totalProducts?: number;
    productsAdded?: number;
    productsUpdated?: number;
    duplicatesFound?: number;
  };
};

type SupplierOffer = {
  id: string;
  productId: string;
  distributorId: string;
  distributorName: string;
  unitPrice: number;
  unit?: string;
  inStock?: boolean;
  leadTime?: string;
  location?: string;
  distanceKm?: number | null;
  coordinates?: { lat: number; lng: number } | null;
};

type PricelistViewerState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  type: 'pdf' | 'csv' | 'other'
  url?: string
  rows?: string[][]
  message?: string
  fileName?: string
  mimeType?: string
};

const INVENTORY_CACHE_PREFIX = 'inventory-cache-v1'
const INVENTORY_CACHE_TTL_MS = 60_000

const getCacheKey = (orgId: string) => `${INVENTORY_CACHE_PREFIX}:${orgId}`

const DEFAULT_IMAGE_PROMPT = `Studio product photo, single centered product captured with a tight crop (product fills ~75% of frame) on a floating glass shelf, uniform slate background (#1f2937) matching the Vendai dashboard, crisp focus across the product with gentle depth falloff, cool teal-accent studio lighting, high detail, rich color, subtle grain, no text, props, hands, or accessories, background color must remain constant, consistent shadow and lighting, modern, e-commerce ready.`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toIsoString = (value: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  if (isRecord(value) && typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString()
    } catch {
      return undefined
    }
  }
  return undefined
}

type FirestoreRecord = Record<string, unknown>

interface InventoryProduct {
  id: string
  name?: string
  brand?: string
  category?: string
  supplier?: string
  orgId?: string
  pieceBarcode?: string
  cartonBarcode?: string
  retailUOM?: string
  baseUOM?: string
  unitsPerBase?: number
  wholesaleQuantity?: number
  minStock?: number
  piecePrice?: number | string
  wholesalePrice?: number | string
  updatedAt?: string
  image?: string
  image_url?: string
  imageUrl?: string
  status?: string
  stock?: number
  stockPieces?: number
  [key: string]: unknown
}

interface InventoryStockRecord {
  productId?: string
  qtyBase?: number
  qtyLoose?: number
  unitsPerBase?: number
}

interface InventoryCachePayload {
  products: InventoryProduct[]
  pricelistInfo: PricelistInfo | null
  showMissingStockAlert: boolean
  timestamp: number
}

interface BulkEnqueueResponse {
  ok?: boolean
  queued?: number
  totalRequested?: number
  error?: string
}

interface SupplierProductRecord extends FirestoreRecord {
  name?: string
  productName?: string
  brand?: string
  category?: string
  distributorName?: string
  sku?: string
  barcode?: string
  pieceBarcode?: string
  unitPrice?: number
  price?: number
  piecePrice?: number
  unit?: string
  unitLabel?: string
  retailUom?: string
  inStock?: boolean
  leadTime?: string
  location?: string
  coordinates?: { lat?: number; lng?: number }
}

interface ProcessEnhancedResponse {
  success?: boolean
  preview?: ProcessedProduct[]
  stats?: Partial<Pick<ProcessingStats, 'totalProducts' | 'productsAdded' | 'productsUpdated' | 'duplicatesFound' | 'estimatedTimeRemaining' | 'suppliersAnalyzed' | 'locationMatches'>> & {
    total?: number
  }
  error?: string
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const toStringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

const calculateDistanceKm = (
  from?: { lat: number; lng: number } | null,
  to?: { lat: number; lng: number } | null
): number | null => {
  if (!from || !to || typeof from.lat !== 'number' || typeof from.lng !== 'number' || typeof to.lat !== 'number' || typeof to.lng !== 'number') {
    return null
  }
  const R = 6371 // Earth radius km
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(to.lat - from.lat)
  const dLon = toRad(to.lng - from.lng)
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)

  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  if (!Number.isFinite(distance)) return null
  return Math.round(distance * 10) / 10 // one decimal place
}

const formatDistance = (km?: number | null): string => {
  if (km === null || km === undefined || Number.isNaN(km)) return 'Distance unavailable'
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

const formatUploadedAt = (iso?: string): string => {
  if (!iso) return 'Unknown upload time'
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return 'Unknown upload time'
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch {
    return 'Unknown upload time'
  }
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes || Number.isNaN(bytes)) return 'Unknown size'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

const determineFileKind = (fileName?: string, contentType?: string): 'pdf' | 'csv' | 'other' => {
  const normalizedType = (contentType || '').toLowerCase()
  if (normalizedType.includes('pdf')) return 'pdf'
  if (normalizedType.includes('csv')) return 'csv'

  const extension = (fileName?.split('.').pop() || '').toLowerCase()
  if (extension === 'pdf') return 'pdf'
  if (extension === 'csv') return 'csv'
  return 'other'
}

const parseCsvPreview = (input: string, limit = 50): string[][] => {
  const sanitized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = sanitized.split('\n').slice(0, limit)
  const rows: string[][] = []

  for (const line of lines) {
    if (!line.trim()) {
      continue
    }
    const cells: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim().replace(/^"|"$/g, ''))
        current = ''
      } else {
        current += char
      }
    }
    cells.push(current.trim().replace(/^"|"$/g, ''))
    if (cells.some(cell => cell.length > 0)) {
      rows.push(cells)
    }
  }

  return rows
}

const toPricelistInfo = (data: unknown): PricelistInfo | null => {
  if (!isRecord(data)) return null

  const stats = isRecord(data.stats) ? data.stats : undefined

  return {
    fileName: typeof data.fileName === 'string' && data.fileName.length > 0 ? data.fileName : 'pricelist.csv',
    downloadUrl: typeof data.downloadUrl === 'string' ? data.downloadUrl : '',
    storagePath: typeof data.storagePath === 'string' ? data.storagePath : undefined,
    uploadedAt: toIsoString(data.uploadedAt) || (typeof data.uploadedAt === 'string' ? data.uploadedAt : undefined),
    uploadedBy: typeof data.uploadedBy === 'string' ? data.uploadedBy : null,
    size: typeof data.size === 'number' ? data.size : undefined,
    contentType: typeof data.contentType === 'string' ? data.contentType : undefined,
    stats: stats as PricelistInfo['stats']
  }
}

export function InventoryModule() {
  const [activeTab, setActiveTab] = useState<'products' | 'new'>('products')
  const [orgId, setOrgId] = useState<string>('')
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([])
  const [currentStep, setCurrentStep] = useState<string>('')
  const [processingError, setProcessingError] = useState<string>('')
  const [processedProducts, setProcessedProducts] = useState<ProcessedProduct[]>([])
  const [isExiting, setIsExiting] = useState(false)
  const [bulkGenerating, setBulkGenerating] = useState<boolean>(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [bulkQueueInfo, setBulkQueueInfo] = useState<{ queued: number; total: number } | null>(null)
  const [pricelistInfo, setPricelistInfo] = useState<PricelistInfo | null>(null)
  const [showMissingStockAlert, setShowMissingStockAlert] = useState<boolean>(false)
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({
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
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null)
  const [modalMode, setModalMode] = useState<'preview' | 'edit' | 'suppliers'>('preview')
  const [supplierOffers, setSupplierOffers] = useState<SupplierOffer[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [supplierError, setSupplierError] = useState<string | null>(null)
  const supplierCacheRef = useRef<Record<string, SupplierOffer[]>>({})
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [isPricelistViewerOpen, setIsPricelistViewerOpen] = useState(false)
  const [pricelistViewer, setPricelistViewer] = useState<PricelistViewerState>({ status: 'idle', type: 'other' })
  const csvPreviewRows = pricelistViewer.rows ?? []
  const [isImageZoomed, setIsImageZoomed] = useState(false)
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false)
  const [regenerationQueued, setRegenerationQueued] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  const normalizedSupplierLabel = useMemo(() => {
    if (!editingProduct) return 'No supplier assigned'
    const supplierRaw = typeof editingProduct.supplier === 'string' ? editingProduct.supplier.trim() : ''
    const brandRaw = typeof editingProduct.brand === 'string' ? editingProduct.brand.trim() : ''
    if (!supplierRaw) return 'No supplier assigned'
    if (brandRaw && supplierRaw.toLowerCase() === brandRaw.toLowerCase()) {
      return 'No supplier assigned'
    }
    return supplierRaw
  }, [editingProduct])

  const renderMetaTile = (label: string, value: string | number | null | undefined, helper?: string) => {
    const display = typeof value === 'number'
      ? Number.isFinite(value) ? `${value}` : 'Not provided'
      : value && String(value).trim().length
        ? String(value).trim()
        : 'Not provided'

    const isEmpty = display === 'Not provided' || display === 'No supplier assigned'

    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <span className="text-xs text-slate-300/80">{label}</span>
        <p className={`mt-1 text-sm font-semibold ${isEmpty ? 'text-slate-400' : 'text-white'}`}>
          {display}
        </p>
        {helper ? (
          <p className="mt-1 text-[11px] text-slate-400/80">{helper}</p>
        ) : null}
      </div>
    )
  }

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    setRegenerateError(null)
    setIsRegeneratingImage(false)
    setRegenerationQueued(false)
  }, [editingProduct?.id])

  const ensureUserLocation = useCallback(() => {
    if (userLocation || typeof window === 'undefined') return
    if (!('geolocation' in navigator)) return
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        },
        () => {
          // ignore denial
        },
        { enableHighAccuracy: false, timeout: 5000 }
      )
    } catch {
      // ignore
    }
  }, [userLocation])

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        maximumFractionDigits: 2
      }),
    []
  )

  const fetchSupplierOffers = useCallback(
    async (product: InventoryProduct | null) => {
      if (!product) {
        setSupplierOffers([])
        return
      }
      const cacheKey = product.id || product.pieceBarcode || product.name
      if (cacheKey && supplierCacheRef.current[cacheKey]) {
        setSupplierOffers(supplierCacheRef.current[cacheKey])
        return
      }

      setLoadingSuppliers(true)
      setSupplierError(null)
      ensureUserLocation()
      try {
        const primaryConstraints: QueryConstraint[] = []
        if (product.pieceBarcode) {
          primaryConstraints.push(where('sku', '==', product.pieceBarcode))
          primaryConstraints.push(where('barcode', '==', product.pieceBarcode))
        }

  let snapshot: QuerySnapshot<FirestoreRecord> | null = null
        for (const constraint of primaryConstraints) {
          try {
            snapshot = await getDocs(query(collectionGroup(db, 'products'), constraint, limit(10)))
            if (snapshot && !snapshot.empty) break
          } catch (error) {
            console.warn('Supplier lookup failed for barcode constraint', error)
          }
        }

        const productName = typeof product.name === 'string' ? product.name.trim() : ''
        if ((!snapshot || snapshot.empty) && productName) {
          try {
            snapshot = await getDocs(query(collectionGroup(db, 'products'), where('name', '==', productName), limit(12)))
          } catch (error) {
            console.warn('Supplier lookup failed for name constraint', error)
          }
        }

        const productBrand = typeof product.brand === 'string' ? product.brand.trim() : ''
        if ((!snapshot || snapshot.empty) && productBrand) {
          try {
            snapshot = await getDocs(query(collectionGroup(db, 'products'), where('brand', '==', productBrand), limit(15)))
          } catch (error) {
            console.warn('Supplier lookup failed for brand constraint', error)
          }
        }

        const productCategory = typeof product.category === 'string' ? product.category.trim() : ''
        if ((!snapshot || snapshot.empty) && productCategory) {
          try {
            snapshot = await getDocs(query(collectionGroup(db, 'products'), where('category', '==', productCategory), limit(15)))
          } catch (error) {
            console.warn('Supplier lookup failed for category constraint', error)
          }
        }

        if (!snapshot || snapshot.empty) {
          setSupplierOffers([])
          if (cacheKey) supplierCacheRef.current[cacheKey] = []
          return
        }

        const rows = snapshot.docs.map((docSnap) => ({
          docSnap,
          distributorRef: docSnap.ref.parent?.parent ?? null
        })).filter(entry => entry.distributorRef)

        const distributorIds = Array.from(new Set(rows.map(entry => entry.distributorRef!.id)))
        const distributorMap = new Map<string, FirestoreRecord>()

        const distributorDocs = await Promise.all(
          distributorIds.map(async (id) => {
            try {
              return await getDoc(doc(db, 'distributors', id))
            } catch (error) {
              console.warn('Failed to load distributor doc', id, error)
              return null
            }
          })
        )
        distributorDocs.forEach((snap) => {
          if (snap?.exists()) {
            distributorMap.set(snap.id, snap.data() as FirestoreRecord)
          }
        })

        const normalizedNameTokens = typeof product.name === 'string'
          ? product.name.toLowerCase().split(/\s+/).filter(Boolean)
          : []
        const normalizedBrand = typeof product.brand === 'string' ? product.brand.toLowerCase() : ''
        const normalizedCategory = typeof product.category === 'string' ? product.category.toLowerCase() : ''

        type WeightedOffer = SupplierOffer & { matchScore: number }

        const offers: WeightedOffer[] = rows.map(({ docSnap, distributorRef }) => {
          const data = docSnap.data() as SupplierProductRecord
          const distributorId = distributorRef!.id
          const distributorData: FirestoreRecord = distributorMap.get(distributorId) ?? {}
          const distributorCoordinates = isRecord(distributorData?.coordinates) ? distributorData.coordinates : undefined
          const distributorLocationCoordinates = isRecord(distributorData?.locationCoordinates) ? distributorData.locationCoordinates : undefined
          const coordSource = (data?.coordinates as { lat?: number; lng?: number } | undefined)
            ?? (distributorCoordinates as { lat?: number; lng?: number } | undefined)
            ?? (distributorLocationCoordinates as { lat?: number; lng?: number } | undefined)
          const coords = coordSource && typeof coordSource?.lat === 'number' && typeof coordSource?.lng === 'number'
            ? { lat: coordSource.lat, lng: coordSource.lng }
            : null
          const viewerLocation = userLocation
          const distanceKm = calculateDistanceKm(viewerLocation, coords)
          const unitPrice = Number(data?.unitPrice ?? data?.price ?? data?.piecePrice ?? product.piecePrice ?? 0)

          const distributorName = typeof distributorData?.name === 'string'
            ? distributorData.name
            : typeof data?.distributorName === 'string'
              ? data.distributorName
              : distributorId

          const distributorLeadTime = typeof distributorData?.leadTime === 'string'
            ? distributorData.leadTime
            : undefined

          const distributorContact = isRecord(distributorData?.contact) ? distributorData.contact : undefined
          const distributorAddress = typeof distributorContact?.address === 'string' ? distributorContact.address : undefined
          const distributorLocation = typeof distributorData?.location === 'string' ? distributorData.location : undefined
          const productLocation = typeof data?.location === 'string' ? data.location : undefined
          const resolvedLocation = distributorAddress ?? distributorLocation ?? productLocation ?? 'Not specified'

          const candidateName = typeof data?.name === 'string'
            ? data.name.toLowerCase()
            : typeof data?.productName === 'string'
              ? data.productName.toLowerCase()
              : ''
          const candidateBrand = typeof data?.brand === 'string' ? data.brand.toLowerCase() : ''
          const candidateCategory = typeof data?.category === 'string' ? data.category.toLowerCase() : ''

          let matchScore = 0
          if (product.pieceBarcode && (data?.pieceBarcode === product.pieceBarcode || data?.barcode === product.pieceBarcode)) {
            matchScore += 3
          }
          if (normalizedBrand && candidateBrand && normalizedBrand === candidateBrand) {
            matchScore += 2
          }
          if (normalizedCategory && candidateCategory && normalizedCategory === candidateCategory) {
            matchScore += 1
          }
          if (candidateName && normalizedNameTokens.some(token => candidateName.includes(token))) {
            matchScore += 1
          }

          const offer: WeightedOffer = {
            id: docSnap.id,
            productId: product.id,
            distributorId,
            distributorName,
            unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
            unit: typeof data?.unit === 'string'
              ? data.unit
              : typeof data?.unitLabel === 'string'
                ? data.unitLabel
                : typeof data?.retailUom === 'string'
                  ? data.retailUom
                  : undefined,
            inStock: typeof data?.inStock === 'boolean' ? data.inStock : true,
            leadTime: typeof data?.leadTime === 'string'
              ? data.leadTime
              : distributorLeadTime ?? '1-3 days',
            location: resolvedLocation,
            distanceKm,
            coordinates: coords,
            matchScore
          }

          return offer
        })

        // Deduplicate by distributor, keep the best match then distance/price
        const deduped: SupplierOffer[] = []
        const seen = new Set<string>()
        const sorted = offers.sort((a, b) => {
          if (a.matchScore !== b.matchScore) {
            return b.matchScore - a.matchScore
          }
          if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) {
            return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
          }
          return (a.unitPrice ?? 0) - (b.unitPrice ?? 0)
        })
        for (const offer of sorted) {
          if (!seen.has(offer.distributorId)) {
            const { matchScore, ...rest } = offer
            deduped.push(rest)
            seen.add(offer.distributorId)
          }
        }

        setSupplierOffers(deduped)
        if (cacheKey) supplierCacheRef.current[cacheKey] = deduped
      } catch (error) {
        console.error('Failed to fetch supplier offers:', error)
        setSupplierError('Unable to fetch supplier prices right now.')
      } finally {
        setLoadingSuppliers(false)
      }
    },
    [ensureUserLocation, userLocation]
  )

  const router = useRouter()
  const { userData } = useAuth()

  // Derive orgId from authenticated user, if available
  useEffect(() => {
    if (userData?.organizationName) {
      setOrgId(userData.organizationName)
    }
  }, [userData?.organizationName])

  useEffect(() => {
    if (userData?.coordinates) {
      setUserLocation(userData.coordinates)
    }
  }, [userData?.coordinates])

  const hydrateFromCache = useCallback((org: string) => {
    if (typeof window === 'undefined' || !org) return false
    try {
      const cached = window.sessionStorage.getItem(getCacheKey(org))
      if (!cached) return false
      const parsed = JSON.parse(cached) as Partial<InventoryCachePayload>
      if (!parsed || !Array.isArray(parsed.products)) return false

      setProducts(parsed.products as InventoryProduct[])
      setPricelistInfo(parsed.pricelistInfo ?? null)
      setShowMissingStockAlert(Boolean(parsed.showMissingStockAlert))
      setLoadingProducts(false)

      const timestamp = typeof parsed.timestamp === 'number' ? parsed.timestamp : 0
      return timestamp > 0 && Date.now() - timestamp < INVENTORY_CACHE_TTL_MS
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

      const [productsSnap, inventorySnap, pricelistSnap] = await Promise.all([
        getDocs(productQuery),
        getDocs(inventoryQuery),
        getDoc(doc(db, 'org_pricelists', org)).catch(() => null)
      ])

      const prods: InventoryProduct[] = productsSnap.docs
        .map((snap) => {
          const raw = snap.data() as FirestoreRecord
          const updatedAt = toIsoString(raw?.updatedAt) ?? (typeof raw?.updatedAt === 'string' ? raw.updatedAt : undefined)
          const image = toStringValue(raw?.image)
          const imageUrl = toStringValue(raw?.imageUrl)
          const image_url = toStringValue(raw?.image_url)

          return {
            id: snap.id,
            ...raw,
            updatedAt,
            image: image ?? imageUrl ?? image_url,
            imageUrl: imageUrl ?? image ?? image_url,
            image_url: image_url ?? image ?? imageUrl
          } as InventoryProduct
        })
        .sort((a, b) => {
          const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
          const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
          return bDate - aDate
        })

      const stockMap: Record<string, { qtyBase: number; qtyLoose: number; unitsPerBase: number }> = {}
      inventorySnap.docs.forEach((snap) => {
        const data = snap.data() as InventoryStockRecord
        if (!data?.productId) return
        stockMap[data.productId] = {
          qtyBase: toNumber(data.qtyBase) ?? 0,
          qtyLoose: toNumber(data.qtyLoose) ?? 0,
          unitsPerBase: (() => {
            const value = toNumber(data.unitsPerBase)
            return value && value > 0 ? value : 1
          })()
        }
      })

      // Compute stock + status
      const augmented: InventoryProduct[] = prods.map((product) => {
        const inventory = stockMap[product.id]
        const resolvedUnitsPerBaseRaw = inventory?.unitsPerBase
          ?? toNumber(product.unitsPerBase)
          ?? toNumber(product.wholesaleQuantity)
          ?? 1
        const unitsPerBase = resolvedUnitsPerBaseRaw > 0 ? resolvedUnitsPerBaseRaw : 1
        const stockPieces = inventory
          ? inventory.qtyBase * unitsPerBase + inventory.qtyLoose
          : 0
        const minStock = toNumber(product.minStock) ?? unitsPerBase
        const status = inventory
          ? stockPieces === 0
            ? 'out'
            : stockPieces < minStock
              ? 'low'
              : 'good'
          : 'unknown'

        return {
          ...product,
          stock: stockPieces,
          status,
          unitsPerBase,
          stockPieces
        }
      })

      const parsedPricelist: PricelistInfo | null =
        pricelistSnap && 'exists' in pricelistSnap && pricelistSnap.exists()
          ? toPricelistInfo(pricelistSnap.data())
          : null

      setProducts(augmented)
      setPricelistInfo(parsedPricelist)
      const anyInventory = inventorySnap.size > 0
      const anyProducts = prods.length > 0
      const hasPricelistFlag = Boolean(parsedPricelist || anyProducts || anyInventory)
      setShowMissingStockAlert(anyProducts && !anyInventory)

      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(
            getCacheKey(org),
            JSON.stringify({
              products: augmented,
              hasPricelist: hasPricelistFlag,
              pricelistInfo: parsedPricelist,
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
    const idsMissing = products.filter(p => !p.image && p.id).map(p => p.id)
    if (idsMissing.length === 0) {
      return
    }

    setBulkQueueInfo(null)
    setBulkGenerating(true)
    setBulkProgress({ done: 0, total: idsMissing.length })

    try {
      const payload = {
        orgId,
        productIds: idsMissing,
        promptStyle: DEFAULT_IMAGE_PROMPT,
        variant: 'inventory-bulk'
      }

      const response = await fetch('/api/image/enqueue-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      let result: BulkEnqueueResponse = {}
      try {
        result = (await response.json()) as BulkEnqueueResponse
      } catch {
        result = {}
      }

      if (!isMountedRef.current) {
        return
      }

      if (!response.ok || !result?.ok) {
        console.error('Failed to queue image generation jobs:', result?.error)
        setBulkProgress({ done: 0, total: idsMissing.length })
        setBulkQueueInfo({ queued: 0, total: idsMissing.length })
        return
      }

      setBulkProgress({ done: Number(result.queued) || 0, total: Number(result.totalRequested) || idsMissing.length })
      setBulkQueueInfo({ queued: Number(result.queued) || 0, total: Number(result.totalRequested) || idsMissing.length })
      // Background refresh after short delay to pick up finished images later
      window.setTimeout(() => {
        if (isMountedRef.current) {
          loadOrgProducts(orgId, { background: true }).catch(() => undefined)
        }
      }, 4000)
    } finally {
      if (isMountedRef.current) {
        setBulkGenerating(false)
      }
    }
  }

  const handleRegenerateImage = async () => {
    if (!editingProduct?.id) return
    const targetOrg = editingProduct.orgId || orgId
    if (!targetOrg) {
      setRegenerateError('Select an organization before regenerating an image.')
      return
    }
    if (isRegeneratingImage) return

    setIsRegeneratingImage(true)
    setRegenerationQueued(false)
    setRegenerateError(null)

    try {
      const payload = {
        orgId: targetOrg,
        productIds: [editingProduct.id],
        promptStyle: DEFAULT_IMAGE_PROMPT,
        variant: 'inventory-single-regenerate'
      }

      const response = await fetch('/api/image/enqueue-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      let result: BulkEnqueueResponse = {}
      try {
        result = (await response.json()) as BulkEnqueueResponse
      } catch {
        result = {}
      }

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Image regeneration failed to queue')
      }

      setRegenerationQueued(true)

      window.setTimeout(() => {
        if (isMountedRef.current) {
          setRegenerationQueued(false)
        }
      }, 8000)

      window.setTimeout(() => {
        if (isMountedRef.current) {
          loadOrgProducts(targetOrg, { background: true }).catch(() => undefined)
        }
      }, 5000)
    } catch (error) {
      setRegenerationQueued(false)
      setRegenerateError(error instanceof Error ? error.message : 'Unable to queue image regeneration right now.')
    } finally {
      setIsRegeneratingImage(false)
    }
  }

  const handleBackClick = () => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      router.push('/modules')
    }, 200)
  }

  const closePricelistViewer = useCallback(() => {
    setIsPricelistViewerOpen(false)
    setPricelistViewer({ status: 'idle', type: 'other' })
  }, [])

  const handleViewPricelist = useCallback(async () => {
    if (!pricelistInfo?.downloadUrl) {
      return
    }

    const fileKind = determineFileKind(pricelistInfo.fileName, pricelistInfo.contentType)
    setIsPricelistViewerOpen(true)
    setPricelistViewer({
      status: 'loading',
      type: fileKind,
      fileName: pricelistInfo.fileName,
      mimeType: pricelistInfo.contentType,
      url: pricelistInfo.downloadUrl
    })

    try {
      if (fileKind === 'pdf') {
        setPricelistViewer({
          status: 'ready',
          type: 'pdf',
          url: pricelistInfo.downloadUrl,
          fileName: pricelistInfo.fileName,
          mimeType: pricelistInfo.contentType
        })
        return
      }

      if (fileKind === 'csv') {
        const response = await fetch(pricelistInfo.downloadUrl, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Unable to fetch pricelist (${response.status})`)
        }
        const text = await response.text()
        const rows = parseCsvPreview(text, 50)
        setPricelistViewer({
          status: 'ready',
          type: 'csv',
          url: pricelistInfo.downloadUrl,
          rows,
          fileName: pricelistInfo.fileName,
          mimeType: pricelistInfo.contentType
        })
        return
      }

      setPricelistViewer({
        status: 'ready',
        type: fileKind,
        url: pricelistInfo.downloadUrl,
        fileName: pricelistInfo.fileName,
        mimeType: pricelistInfo.contentType
      })
    } catch (error) {
      console.error('Pricelist preview error:', error)
      setPricelistViewer({
        status: 'error',
        type: fileKind,
        url: pricelistInfo.downloadUrl,
        fileName: pricelistInfo.fileName,
        mimeType: pricelistInfo.contentType,
        message: error instanceof Error ? error.message : 'Unable to load pricelist preview'
      })
    }
  }, [pricelistInfo])

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
    if (!orgId) {
      setProcessingError('Select an organization before uploading a pricelist.')
      event.target.value = ''
      return
    }

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
      if (userData?.uid) {
        formData.append('uploadedBy', userData.uid)
      } else if (userData?.email) {
        formData.append('uploadedBy', userData.email)
      }
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      
      if (ext === 'csv') {
        // Call processing API
        const response = await fetch('/api/inventory/process-enhanced', { method: 'POST', body: formData })
        let result: ProcessEnhancedResponse = {}
        try {
          result = (await response.json()) as ProcessEnhancedResponse
        } catch {
          result = {}
        }
        
        if (!response.ok || !result?.success) {
          setProcessingError(result?.error || 'Enhanced processing failed')
          updateStepStatus('ai_extraction', 'error')
          return
        }
        if (Array.isArray(result?.preview)) {
          setProcessedProducts(result.preview)
        }
        if (result?.stats) {
          setProcessingStats(prev => ({
            ...prev,
            totalProducts: Number(result.stats?.totalProducts ?? result.stats?.total ?? prev.totalProducts) || prev.totalProducts,
            productsAdded: Number(result.stats?.productsAdded ?? prev.productsAdded) || prev.productsAdded,
            productsUpdated: Number(result.stats?.productsUpdated ?? prev.productsUpdated) || prev.productsUpdated,
            duplicatesFound: Number(result.stats?.duplicatesFound ?? prev.duplicatesFound) || prev.duplicatesFound,
            estimatedTimeRemaining: 0,
            suppliersAnalyzed: prev.suppliersAnalyzed,
            locationMatches: prev.locationMatches
          }))
        }
        // Note: pricelist property handling removed - not part of ProcessEnhancedResponse interface
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
    if (uploadInputRef.current) {
      uploadInputRef.current.click()
    }
  }

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setModalMode('preview')
    setEditingProduct(null)
    setSupplierOffers([])
    setSupplierError(null)
  }, [])

  useEffect(() => {
    if (modalMode === 'suppliers' && editingProduct) {
      fetchSupplierOffers(editingProduct)
    }
  }, [modalMode, editingProduct, fetchSupplierOffers])

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

      <input
        ref={uploadInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.pdf,.txt"
        className="hidden"
        onChange={handleFileUpload}
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
                    ? `Queuing ${bulkProgress.total} jobs...`
                    : bulkQueueInfo
                      ? `Queued ${bulkQueueInfo.queued}/${bulkQueueInfo.total}`
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
                Stock counts aren&rsquo;t set for this org yet. Not mandatory, but add them for accurate POS and alerts.
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
                  className="group relative transform-gpu overflow-hidden rounded-3xl border border-slate-400/15 bg-gradient-to-br from-slate-900/55 via-slate-900/30 to-sky-950/35 backdrop-blur-2xl transition-all duration-500 shadow-[0_10px_32px_-20px_rgba(56,189,248,0.32)] hover:shadow-[0_22px_56px_-30px_rgba(59,130,246,0.42)] hover:-translate-y-2 hover:scale-[1.02] hover:rotate-[0.35deg] cursor-pointer"
                  onClick={() => {
                    setEditingProduct(item)
                    setModalMode('preview')
                    setSupplierOffers([])
                    setSupplierError(null)
                    setIsImageZoomed(false)
                    setIsModalOpen(true)
                  }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-indigo-600/14" />
                    <div className="absolute inset-0 blur-2xl bg-cyan-500/08" />
                  </div>
                  <div className="aspect-square w-full bg-gradient-to-br from-slate-800/65 via-slate-900/55 to-slate-950/60 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-500/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-[0.6deg]" />
                    ) : (
                      <Package className="w-16 h-16 text-slate-400 transition-all duration-700 group-hover:scale-125 group-hover:text-cyan-200/90 group-hover:-translate-y-1" />
                    )}
                    <div className="absolute inset-x-6 bottom-6 h-[1px] rounded-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
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
                    <div className="absolute inset-0 border border-white/5 opacity-0 group-hover:opacity-35 transition-opacity duration-500 rounded-3xl" />
                    <div className="absolute -top-16 -left-16 h-40 w-40 rounded-full bg-cyan-500/16 blur-3xl opacity-0 group-hover:opacity-65 transition-opacity duration-700" />
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
              {!pricelistInfo ? (
                <div
                  className="group relative overflow-hidden rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-slate-950/88 via-slate-950/74 to-emerald-950/38 backdrop-blur-2xl transition-all duration-500 shadow-[0_24px_60px_-32px_rgba(16,185,129,0.4)] hover:border-emerald-300/30 hover:shadow-[0_32px_72px_-28px_rgba(16,185,129,0.45)] cursor-pointer"
                  onClick={() => {
                    if (!isProcessingModalOpen) {
                      uploadInputRef.current?.click()
                    }
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/16 via-emerald-500/08 to-emerald-400/08 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-10 text-center space-y-4">
                    <div className="w-24 h-24 mx-auto rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-emerald-500/12 via-emerald-500/06 to-emerald-400/10 border border-emerald-300/25 flex items-center justify-center group-hover:scale-105 transition-all duration-500 shadow-[0_10px_30px_-20px_rgba(16,185,129,0.35)]">
                      {processedProducts.length > 0 ? (
                        <Check className="w-12 h-12 text-emerald-200 transition-all duration-500" />
                      ) : (
                        <Upload className="w-12 h-12 text-slate-300 group-hover:text-emerald-200 transition-all duration-500" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <h4 className={`text-lg font-semibold tracking-wide transition-colors duration-300 ${processedProducts.length > 0 ? 'text-emerald-200/90' : 'text-slate-100 group-hover:text-white'}`}>
                        {processedProducts.length > 0 ? 'Pricelist processed' : 'Upload pricelist'}
                      </h4>
                      <p className={`text-sm leading-relaxed transition-colors duration-300 ${processedProducts.length > 0 ? 'text-emerald-200/70' : 'text-slate-400 group-hover:text-slate-200/90'}`}>
                        {processedProducts.length > 0 
                          ? `${processedProducts.length} products parsed. Click to upload again.`
                          : 'CSV or Excel preferred. We extract items automatically.'}
                      </p>
                    </div>
                    <div className="text-xs text-slate-400 group-hover:text-slate-200/80 transition-colors duration-300">
                      {orgId ? `Organization: ${orgId}` : 'Set your organization ID below before uploading.'}
                    </div>
                  </div>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/08 to-emerald-400/12" />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-200/30 to-transparent" />
                  </div>
                </div>
              ) : (
                <div
                  className="group relative overflow-hidden rounded-3xl border border-cyan-400/14 bg-gradient-to-br from-slate-950/88 via-slate-950/76 to-cyan-950/32 backdrop-blur-2xl transition-all duration-500 shadow-[0_14px_36px_-26px_rgba(6,182,212,0.28)] hover:border-cyan-300/28 hover:shadow-[0_18px_44px_-24px_rgba(6,182,212,0.32)] cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (pricelistInfo.downloadUrl) {
                      void handleViewPricelist()
                    }
                  }}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && pricelistInfo.downloadUrl) {
                      event.preventDefault()
                      void handleViewPricelist()
                    }
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/12 via-cyan-500/06 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-10 text-center space-y-4">
                    <div className="w-24 h-24 mx-auto rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-cyan-500/10 via-cyan-500/06 to-blue-500/08 border border-cyan-300/24 flex items-center justify-center group-hover:scale-105 transition-all duration-500 shadow-[0_8px_24px_-18px_rgba(6,182,212,0.28)]">
                      <FileText className="w-12 h-12 text-cyan-200/90 transition-all duration-500" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-semibold tracking-wide text-cyan-100/90 group-hover:text-white transition-colors duration-300">
                        Current pricelist
                      </h4>
                      <p className="text-sm text-slate-300/90">
                        {pricelistInfo.fileName}
                      </p>
                      <p className="text-xs text-slate-400/80">
                        Uploaded {formatUploadedAt(pricelistInfo.uploadedAt)}
                      </p>
                      <p className="text-xs text-slate-400/70 italic">Click to preview without leaving the app.</p>
                    </div>
                    {pricelistInfo.stats && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-200/90">
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                          <span className="block text-[11px] text-slate-300/80">Added</span>
                          <span className="text-emerald-200 font-semibold">{pricelistInfo.stats.productsAdded ?? '—'}</span>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                          <span className="block text-[11px] text-slate-300/80">Updated</span>
                          <span className="text-cyan-200 font-semibold">{pricelistInfo.stats.productsUpdated ?? '—'}</span>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                          <span className="block text-[11px] text-slate-300/80">Duplicates</span>
                          <span className="text-amber-200 font-semibold">{pricelistInfo.stats.duplicatesFound ?? '—'}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <a
                        href={pricelistInfo.downloadUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-slate-100 hover:border-white/25 hover:bg-white/20 transition-all duration-300"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          uploadInputRef.current?.click()
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/24 bg-cyan-500/12 px-4 py-2 text-cyan-100/90 hover:border-cyan-300/40 hover:bg-cyan-500/18 transition-all duration-300"
                      >
                        <Upload className="w-4 h-4" />
                        Reupload
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div
                className="group relative overflow-hidden rounded-3xl border border-blue-400/16 bg-gradient-to-br from-slate-950/88 via-slate-950/76 to-blue-950/38 backdrop-blur-2xl transition-all duration-500 shadow-[0_14px_36px_-26px_rgba(59,130,246,0.28)] hover:border-blue-300/30 hover:shadow-[0_18px_44px_-24px_rgba(59,130,246,0.32)] cursor-pointer"
                onClick={() => { setEditingProduct(null); setModalMode('edit'); setIsModalOpen(true) }}
              >
                <div className="relative p-10">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/12 via-blue-500/06 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/06 to-indigo-500/08 border border-blue-300/24 flex items-center justify-center group-hover:scale-105 transition-all duration-500 shadow-[0_8px_24px_-18px_rgba(59,130,246,0.28)]">
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

            </div>

            <div className="flex justify-center">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-xl">
                <label htmlFor="org-id-input" className="text-sm font-medium text-slate-200">Organization ID</label>
                <input
                  id="org-id-input"
                  className="w-48 rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-400/35 focus:outline-none transition-all"
                  placeholder="org-id"
                  value={orgId}
                  onChange={e => setOrgId(e.target.value)}
                />
              </div>
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
                        {(product as any).image_url ? (
                          <img src={(product as any).image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" />
                        ) : (
                          <Package className="w-16 h-16 text-slate-400 group-hover:scale-125 group-hover:text-green-300 group-hover:rotate-12 transition-all duration-500 relative z-10" />
                        )}
                      </div>
                      <div className="p-4 relative">
                        <h4 className="text-slate-200 font-medium text-sm truncate group-hover:text-white transition-colors duration-300">{product.name}</h4>
                        <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                          <span className="text-xs text-slate-400 group-hover:text-slate-300">{product.brand || 'N/A'}</span>
                          <span className="text-xs px-2 py-1 rounded-full border text-green-400 bg-green-500/20 border-green-500/30">${product.unitPrice}</span>
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
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-white/12 bg-gradient-to-br from-white/24 to-white/10 backdrop-blur-[32px] shadow-[0_18px_60px_-20px_rgba(15,23,42,0.65)] text-slate-50 p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">
                  {modalMode === 'preview' && editingProduct
                    ? editingProduct.name
                    : modalMode === 'edit'
                      ? (editingProduct?.id ? 'Edit product' : 'Add product')
                      : 'Supplier availability'}
                </h3>
                <p className="text-sm text-slate-200/70">
                  {modalMode === 'preview'
                    ? 'Review the product, update details, or compare supplier prices.'
                    : modalMode === 'suppliers'
                      ? 'Compare wholesale offers and choose the best fit for this item.'
                      : 'Update product information and inventory details.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-slate-50 hover:border-white/30 hover:bg-white/20 transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalMode === 'preview' && editingProduct && (
              <div className="space-y-6">
                <div
                  className={`relative grid gap-6 transition-all duration-300 ${
                    isImageZoomed ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[minmax(0,360px)_1fr]'
                  }`}
                >
                  <div
                    className={`relative rounded-2xl border border-white/12 bg-gradient-to-br from-slate-900/70 via-slate-900/50 to-slate-900/30 overflow-hidden shadow-[0_20px_60px_-30px_rgba(15,23,42,0.65)] transition-all duration-300 ${
                      isImageZoomed ? 'max-w-3xl mx-auto md:max-h-[70vh]' : 'md:max-h-[420px]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setIsImageZoomed(prev => !prev)}
                      className="absolute top-4 left-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-white/30 hover:bg-black/55 transition-all duration-200 backdrop-blur-sm"
                    >
                      {isImageZoomed ? 'Exit focus' : 'Image focus'}
                    </button>
                    {isImageZoomed && (
                      <button
                        type="button"
                        onClick={handleRegenerateImage}
                        disabled={isRegeneratingImage}
                        className="absolute top-4 right-4 z-10 inline-flex items-center gap-2 rounded-full border border-purple-300/40 bg-black/45 px-3 py-1.5 text-xs font-medium text-purple-100 hover:border-purple-200/60 hover:bg-black/60 transition-all duration-200 backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isRegeneratingImage ? (
                          <>
                            <span className="h-4 w-4 rounded-full border border-purple-200/70 border-t-transparent animate-spin" />
                            <span>Generating…</span>
                          </>
                        ) : regenerationQueued ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Queued</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-3.5 w-3.5" />
                            <span>Regenerate image</span>
                          </>
                        )}
                      </button>
                    )}
                    {editingProduct.image ? (
                      <img
                        src={editingProduct.image}
                        alt={editingProduct.name}
                        className={`w-full h-full object-contain transition-all duration-500 ${
                          isImageZoomed ? 'p-6 md:p-10' : 'p-6'
                        }`}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center py-24">
                        <Package className="w-20 h-20 text-slate-500" />
                      </div>
                    )}
                    <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setModalMode('edit')}
                        className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/40 text-slate-50 hover:border-white/30 hover:bg-black/65 transition-all duration-200 p-2 backdrop-blur-sm"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalMode('suppliers')}
                        className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/40 text-slate-50 hover:border-white/30 hover:bg-black/65 transition-all duration-200 p-2 backdrop-blur-sm"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className={`space-y-4 text-slate-200 transition-opacity duration-300 ${isImageZoomed ? 'md:opacity-0 md:pointer-events-none md:h-0' : 'opacity-100'}`}>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{editingProduct.brand || 'No brand set'}</p>
                      <h4 className="text-2xl font-semibold text-white">{editingProduct.name}</h4>
                      <p className="text-sm text-slate-400">Category: {editingProduct.category || 'Uncategorized'}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <span className="text-xs text-slate-300/80">Piece price</span>
                        <p className="text-lg font-semibold text-emerald-200">
                          {currencyFormatter.format(Number(editingProduct.piecePrice) || 0)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <span className="text-xs text-slate-300/80">Carton price</span>
                        <p className="text-lg font-semibold text-cyan-200">
                          {editingProduct.wholesalePrice
                            ? currencyFormatter.format(Number(editingProduct.wholesalePrice) || 0)
                            : '—'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <span className="text-xs text-slate-300/80">Units per base</span>
                        <p className="text-lg font-semibold text-white">{editingProduct.unitsPerBase || 1}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <span className="text-xs text-slate-300/80">Stock on hand</span>
                        <p className="text-lg font-semibold text-white">
                          {typeof editingProduct.stock === 'number' ? editingProduct.stock : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {renderMetaTile('Piece barcode', editingProduct.pieceBarcode)}
                      {renderMetaTile('Carton barcode', editingProduct.cartonBarcode)}
                      {renderMetaTile('Supplier', normalizedSupplierLabel)}
                    </div>
                    {(!editingProduct.pieceBarcode || !editingProduct.cartonBarcode) && (
                      <div className="flex items-start gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/12 px-3 py-3 text-xs text-cyan-100/90">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>
                          Piece barcodes power single-unit scans. Carton barcodes keep case packs in sync. Leave them blank if you do not use them yet— you can add codes later without breaking checkout.
                        </span>
                      </div>
                    )}
                    {regenerationQueued && !regenerateError && (
                      <div className="flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3 py-3 text-xs text-emerald-100">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>Image regeneration queued. We will refresh this item automatically once the new photo lands.</span>
                      </div>
                    )}
                    {regenerateError && (
                      <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-3 text-xs text-rose-100">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>{regenerateError}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {modalMode === 'suppliers' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setModalMode('preview')}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-100 hover:border-white/25 hover:bg-white/20 transition-all duration-200"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <h4 className="text-lg font-semibold text-white">Supplier availability</h4>
                </div>
                {loadingSuppliers ? (
                  <div className="flex justify-center py-10">
                    <LoadingSpinner size="md" />
                  </div>
                ) : supplierError ? (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">
                    {supplierError}
                  </div>
                ) : supplierOffers.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-slate-300">
                    No supplier matches yet. Try updating the supplier field or barcode for this product.
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto pr-1 space-y-3">
                    {supplierOffers.map((offer) => (
                      <div
                        key={`${offer.distributorId}-${offer.id}`}
                        className="rounded-2xl border border-white/12 bg-white/6 px-4 py-4 flex flex-wrap items-center justify-between gap-4 transition-all duration-300 hover:border-cyan-200/30 hover:bg-cyan-500/10"
                      >
                        <div>
                          <p className="text-base font-semibold text-white">{offer.distributorName}</p>
                          <p className="text-xs text-slate-300 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {offer.location || 'Location unavailable'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-200">
                          <div className="text-emerald-200 font-semibold">
                            {offer.unitPrice ? currencyFormatter.format(offer.unitPrice) : '—'}
                            <span className="ml-1 text-xs text-slate-300">/{offer.unit || 'unit'}</span>
                          </div>
                          <div className="text-slate-300">{offer.leadTime || 'Lead time unavailable'}</div>
                          <div className="text-slate-400">{formatDistance(offer.distanceKm)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {modalMode === 'edit' && (
              <ProductForm
                orgId={orgId}
                initial={editingProduct}
                onCancel={() => {
                  if (editingProduct?.id) {
                    setModalMode('preview')
                  } else {
                    handleCloseModal()
                  }
                }}
                onSaved={(updated) => {
                  setEditingProduct(updated)
                  setModalMode('preview')
                  ;(async () => { await loadOrgProducts(orgId) })()
                }}
                onDeleted={() => {
                  handleCloseModal()
                  ;(async () => { await loadOrgProducts(orgId) })()
                }}
              />
            )}
          </div>
        </div>
      )}

      {isPricelistViewerOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            onClick={closePricelistViewer}
          />
          <div className="relative w-full max-w-5xl rounded-2xl border border-white/12 bg-gradient-to-br from-slate-900/85 via-slate-900/75 to-slate-900/65 backdrop-blur-3xl shadow-[0_24px_90px_-32px_rgba(15,23,42,0.75)] text-slate-50 p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold">{pricelistViewer.fileName || pricelistInfo?.fileName || 'Pricelist'}</h3>
                <p className="text-xs text-slate-300/80">
                  {(() => {
                    const kind = determineFileKind(pricelistInfo?.fileName, pricelistInfo?.contentType)
                    const kindLabel = kind === 'pdf' ? 'PDF document' : kind === 'csv' ? 'CSV file' : 'File'
                    const sizeLabel = pricelistInfo?.size ? formatFileSize(pricelistInfo.size) : undefined
                    return sizeLabel ? `${kindLabel} • ${sizeLabel}` : kindLabel
                  })()}
                </p>
                {pricelistInfo?.uploadedAt && (
                  <p className="text-xs text-slate-400/70">Uploaded {formatUploadedAt(pricelistInfo.uploadedAt)}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {pricelistViewer.url && (
                  <a
                    href={pricelistViewer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-slate-100 hover:border-white/25 hover:bg-white/20 transition-all duration-200"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                )}
                <button
                  type="button"
                  onClick={closePricelistViewer}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-slate-50 hover:border-white/30 hover:bg-white/20 transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {pricelistViewer.status === 'loading' && (
              <div className="flex justify-center py-16">
                <LoadingSpinner size="md" />
              </div>
            )}

            {pricelistViewer.status === 'error' && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-200">
                {pricelistViewer.message || 'We could not load a preview of this file.'}
                {pricelistViewer.url && (
                  <span className="ml-1">You can still download the file using the button above.</span>
                )}
              </div>
            )}

            {pricelistViewer.status === 'ready' && pricelistViewer.type === 'pdf' && pricelistViewer.url && (
              <div className="h-[70vh]">
                <iframe
                  src={`${pricelistViewer.url}#toolbar=0&navpanes=0&scrollbar=0`}
                  title="Pricelist PDF viewer"
                  className="w-full h-full rounded-xl border border-white/12 bg-white"
                />
              </div>
            )}

            {pricelistViewer.status === 'ready' && pricelistViewer.type === 'csv' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-300/80">Showing the first {csvPreviewRows.length > 0 ? Math.max(csvPreviewRows.length - 1, 0) : 0} rows</p>
                <div className="max-h-[65vh] overflow-auto rounded-xl border border-white/10 bg-slate-900/60">
                  {csvPreviewRows.length > 0 ? (
                    (() => {
                      const [headerRow, ...bodyRows] = csvPreviewRows
                      return (
                        <table className="min-w-full divide-y divide-white/10 text-left text-xs">
                          <thead className="bg-white/5 text-slate-200">
                            <tr>
                              {headerRow.map((headerCell, index) => (
                                <th key={`header-${index}`} className="px-4 py-3 font-semibold">
                                  {headerCell || '—'}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-slate-200/90">
                            {bodyRows.map((row, rowIndex) => (
                              <tr key={`row-${rowIndex}`} className="hover:bg-white/5">
                                {row.map((cell, cellIndex) => (
                                  <td key={`cell-${rowIndex}-${cellIndex}`} className="px-4 py-2 align-top whitespace-pre-wrap">
                                    {cell || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    })()
                  ) : (
                    <div className="p-6 text-sm text-slate-300">
                      This CSV looks empty. Try downloading the file to confirm its contents.
                    </div>
                  )}
                </div>
              </div>
            )}

            {pricelistViewer.status === 'ready' && pricelistViewer.type === 'other' && (
              <div className="rounded-xl border border-white/12 bg-white/5 px-4 py-6 text-sm text-slate-200">
                Inline preview is not available for this file type. Use the download button above to open it in a new tab.
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

type ProductFormProps = {
  orgId: string
  initial: InventoryProduct | null
  onCancel: () => void
  onSaved: (product: InventoryProduct) => void
  onDeleted: (productId?: string) => void
}

function ProductForm({ orgId, initial, onCancel, onSaved, onDeleted }: ProductFormProps) {
  const [name, setName] = useState<string>(initial?.name || '')
  const [brand, setBrand] = useState<string>(initial?.brand || '')
  const [category, setCategory] = useState<string>(initial?.category || '')
  const [pieceBarcode, setPieceBarcode] = useState<string>(initial?.pieceBarcode || '')
  const [cartonBarcode, setCartonBarcode] = useState<string>(initial?.cartonBarcode || '')
  const [piecePrice, setPiecePrice] = useState<number>(typeof initial?.piecePrice === 'number' ? initial.piecePrice : 0)
  const [cartonPrice, setCartonPrice] = useState<number>(typeof initial?.wholesalePrice === 'number' ? initial.wholesalePrice : (typeof initial?.cartonPrice === 'number' ? initial.cartonPrice : 0))
  const [baseUom, setBaseUom] = useState<string>((initial?.baseUOM as string) || 'CTN')
  const [retailUom, setRetailUom] = useState<string>((initial?.retailUOM as string) || 'PCS')
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
      const payload: FirestoreRecord = {
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
      let id = typeof initial?.id === 'string' ? initial.id : undefined
      if (id) {
        await setDoc(doc(db, POS_PRODUCTS_COL, id), payload, { merge: true })
      } else {
        const newRef = await addDoc(collection(db, POS_PRODUCTS_COL), { ...payload, createdAt: now })
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

      if (!id) {
        throw new Error('Failed to determine product identifier')
      }

      const updatedProduct: InventoryProduct = {
        ...(initial ?? {}),
        ...(payload as InventoryProduct),
        id,
        image: initial?.image,
        imageUrl: initial?.imageUrl,
        image_url: initial?.image_url
      }

      onSaved(updatedProduct)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Save failed')
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
      onDeleted(initial.id)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Delete failed')
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
