"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Compass,
  MapPin,
  Package,
  RefreshCcw,
  ShoppingCart,
  Sparkles,
  Star as StarIcon,
  TrendingUp,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { doc, setDoc, deleteDoc, getDoc, collection, query, where, getDocs, getCountFromServer } from "firebase/firestore"

import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { listPOSProducts } from "@/lib/pos-operations"
import type { POSProduct } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { LoadingSpinner } from "../loading-spinner"
import { ScrollArea } from "../ui/scroll-area"
import { Badge } from "../ui/badge"
import { getAllDistributors, getDistributorProducts, type DistributorMetadata, type DistributorProduct } from "@/data/distributor-data"

interface SupplierSummary {
  id: string
  name: string
  description?: string
  logoUrl?: string
  paymentTerms?: string
  totalRetailers: number
  totalOrders: number
  totalGMV: number
  lastActivity?: string
  connected: boolean
  reputationScore: number
  location?: string
  tags: string[]
}

interface SupplierProduct {
  id: string
  name: string
  unitPrice: number
  unit?: string
  category?: string
  brand?: string
  minOrderQuantity?: number
  leadTime?: string
  inStock?: boolean
  imageUrl?: string
}

interface SuggestedSupplierRecommendation {
  supplier: SupplierSummary
  score: number
  reasons: string[]
}

const parseNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const parseString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim()
  }
  return undefined
}

const toStringArray = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry : undefined))
      .filter((entry): entry is string => Boolean(entry))
  }
  return []
}

const deriveInventoryTags = (products: POSProduct[]): string[] => {
  const counts: Record<string, number> = {}

  for (const product of products) {
    const add = (value?: string) => {
      if (value) {
        const key = value.trim()
        if (!key) return
        counts[key] = (counts[key] ?? 0) + 1
      }
    }

    add(product.category)
    add(product.brand)

    if (product.name) {
      const tokens = product.name.split(/\s|\//).filter(Boolean)
      for (const token of tokens) {
        if (token.length >= 4) {
          counts[token] = (counts[token] ?? 0) + 0.25
        }
      }
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 8)
}

const inferConnected = (
  raw: Record<string, unknown>,
  retailerOrgId?: string,
  retailerUserId?: string,
): boolean => {
  if (!retailerOrgId && !retailerUserId) return false
  const candidateFields = [
    "retailerIds",
    "retailerOrgIds",
    "connectedRetailerIds",
    "connectedRetailers",
    "retailerOrganizations",
    "linkedRetailers",
  ]

  for (const field of candidateFields) {
    const value = raw[field]
    if (Array.isArray(value)) {
      if (
        value.some((entry) =>
          typeof entry === "string"
            ? entry === retailerOrgId || entry === retailerUserId
            : typeof entry === "object" && entry !== null
            ? "id" in entry &&
              typeof (entry as { id?: unknown }).id === "string" &&
              ((entry as { id?: string }).id === retailerOrgId ||
                (entry as { id?: string }).id === retailerUserId)
            : false,
        )
      ) {
        return true
      }
    } else if (value && typeof value === "object") {
      const keys = Object.keys(value as Record<string, unknown>)
      if (retailerOrgId && keys.includes(retailerOrgId)) return true
      if (retailerUserId && keys.includes(retailerUserId)) return true
    }
  }

  return false
}

const computeReputation = (summary: SupplierSummary): number => {
  const ordersComponent = Math.min(3, Math.log10(summary.totalOrders + 1) * 1.4)
  const retailerComponent = Math.min(3, Math.log10(summary.totalRetailers + 1) * 1.6)
  const gmvComponent = Math.min(2, Math.log10(summary.totalGMV / 1000 + 1))
  const base = 1.4
  return Number((base + ordersComponent + retailerComponent + gmvComponent).toFixed(1))
}

const formatCurrency = (value: number): string => {
  if (!Number.isFinite(value)) return "KES 0"
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: value >= 100000 ? 0 : 2,
  }).format(value)
}

const SupplierAvatar = ({ name, logoUrl }: { name: string; logoUrl?: string }) => {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  if (logoUrl) {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-purple-500/30 bg-white p-3 shadow-[0_12px_32px_-20px_rgba(168,85,247,0.6)]">
        <img src={logoUrl} alt={name} className="h-full w-full object-contain" />
      </div>
    )
  }

  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/35 via-indigo-500/15 to-slate-900/70 text-2xl font-semibold text-purple-50 shadow-[0_12px_32px_-20px_rgba(168,85,247,0.6)]">
      {initials || "S"}
    </div>
  )
}

const EmptyState = ({ onRefresh }: { onRefresh: () => void }) => (
  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-purple-400/25 bg-slate-950/50 p-10 text-center">
    <Badge className="mb-3 border border-purple-400/40 bg-purple-500/15 text-purple-100">
      No connected suppliers yet
    </Badge>
    <p className="text-base font-semibold text-white">Connect your first distributor</p>
    <p className="mt-2 max-w-md text-sm text-slate-300/80">
      Once a supplier approves your request, their reputation and catalogue will appear here.
    </p>
    <Button
      variant="outline"
      className="mt-5 border-purple-400/30 bg-purple-500/5 text-sm text-purple-100 hover:border-purple-300/60 hover:bg-purple-500/10"
      onClick={onRefresh}
    >
      <RefreshCcw className="mr-2 h-4 w-4" /> Refresh suppliers
    </Button>
  </div>
)

export function SupplierModule() {
  const router = useRouter()
  const { toast } = useToast()
  const { loading, userData } = useAuth()

  const [activeTab, setActiveTab] = useState<'supplier' | 'credit'>('supplier')
  const [searchTerm, setSearchTerm] = useState("")
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([])
  const [inventoryTags, setInventoryTags] = useState<string[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [suppliersError, setSuppliersError] = useState<string | null>(null)

  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null)
  const [products, setProducts] = useState<DistributorProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [hasMoreProducts, setHasMoreProducts] = useState(false)
  const PAGE_SIZE = 40
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const inventoryTagSet = useMemo(
    () => new Set(inventoryTags.map((tag) => tag.toLowerCase())),
    [inventoryTags],
  )

  useEffect(() => {
    if (!loading && userData && userData.role !== "retailer") {
      toast({
        title: "Suppliers portal is retailer-only",
        description: "Use the Retailers module to manage your downstream network.",
      })
      router.replace("/modules/retailers")
    }
  }, [loading, router, toast, userData])

  const loadSuppliers = useCallback(async () => {
    if (!userData || userData.role !== "retailer") return
    if (!db) {
      setSuppliersError("Database connection unavailable")
      return
    }

    setLoadingSuppliers(true)
    setSuppliersError(null)

    try {
      // Load distributors from data folder
      const distributorsData = getAllDistributors()
      
      // Check connection status and get retailer counts from Firebase
      const mappedSuppliers: SupplierSummary[] = await Promise.all(
        distributorsData.map(async (dist) => {
          // Check if this retailer is connected to this distributor
          const connectionRef = doc(db!, "distributorConnections", `${userData.organizationName}_${dist.id}`)
          const connectionSnap = await getDoc(connectionRef)
          const isConnected = connectionSnap.exists()

          // Get total number of retailers connected to this distributor
          const connectionsQuery = query(
            collection(db!, "distributorConnections"),
            where("distributorId", "==", dist.id)
          )
          const countSnapshot = await getCountFromServer(connectionsQuery)
          const totalRetailers = countSnapshot.data().count

          return {
            id: dist.id,
            name: dist.displayName,
            description: dist.description,
            logoUrl: dist.logoUrl,
            paymentTerms: dist.businessInfo.paymentTerms,
            totalRetailers: totalRetailers,
            totalOrders: dist.stats.totalOrders,
            totalGMV: dist.stats.totalProducts,
            lastActivity: dist.lastUpdated,
            connected: isConnected,
            reputationScore: 0,
            location: dist.location.address,
            tags: dist.categories
          }
        })
      )
      
      // Compute reputation scores
      const suppliersWithReputation = mappedSuppliers.map(supplier => ({ 
        ...supplier, 
        reputationScore: computeReputation(supplier) 
      }))
      
      setSuppliers(suppliersWithReputation)
    } catch (error) {
      console.error("Failed to load suppliers", error)
      setSuppliersError("Unable to load suppliers right now. Try refreshing in a moment.")
    } finally {
      setLoadingSuppliers(false)
    }
  }, [userData])

  const loadInventoryProfile = useCallback(async () => {
    if (!userData || userData.role !== "retailer") return

    try {
      const products = await listPOSProducts(userData.organizationName, undefined, 200)
      const tags = deriveInventoryTags(products)
      setInventoryTags(tags)
    } catch (error) {
      console.warn("Failed to load retailer inventory tags", error)
    }
  }, [userData])

  const loadSupplierProducts = useCallback(async (supplierId: string, page: number = 1) => {
    setProductsLoading(true)
    setProductsError(null)

    try {
      // Load products from distributor data with pagination
      const { products: loadedProducts, total, hasMore } = getDistributorProducts(supplierId, page, PAGE_SIZE)
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setProducts(loadedProducts)
      setTotalProducts(total)
      setHasMoreProducts(hasMore)
      setCurrentPage(page)
      
      if (!loadedProducts.length && page === 1) {
        setProductsError("This supplier hasn't published a product catalogue yet.")
      }
    } catch (error) {
      console.error("Failed to load supplier products", error)
      setProducts([])
      setProductsError("Unable to load catalogue. Please try again shortly.")
    } finally {
      setProductsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!loading && userData?.role === "retailer") {
      loadSuppliers()
      loadInventoryProfile()
    }
  }, [loading, loadInventoryProfile, loadSuppliers, userData?.role])

  useEffect(() => {
    if (selectedSupplier && selectedSupplier.connected) {
      loadSupplierProducts(selectedSupplier.id)
    } else {
      setProducts([])
      setProductsError(null)
      setProductsLoading(false)
    }
  }, [loadSupplierProducts, selectedSupplier])

  const handleSupplierSelect = useCallback((supplier: SupplierSummary) => {
    setSelectedSupplier(supplier)
  }, [])

  const handleBackToList = useCallback(() => {
    setSelectedSupplier(null)
  }, [])

  const handleConnectSupplier = useCallback(async (supplier: SupplierSummary) => {
    if (!userData || !db) return

    try {
      const connectionRef = doc(db, "distributorConnections", `${userData.organizationName}_${supplier.id}`)
      
      if (supplier.connected) {
        // Disconnect
        await deleteDoc(connectionRef)
        toast({
          title: "Disconnected",
          description: `You are no longer connected to ${supplier.name}`,
        })
      } else {
        // Connect
        await setDoc(connectionRef, {
          retailerId: userData.organizationName,
          retailerName: userData.organizationName,
          distributorId: supplier.id,
          distributorName: supplier.name,
          connectedAt: new Date().toISOString(),
          status: "active"
        })
        toast({
          title: "Connected!",
          description: `You can now access ${supplier.name}'s product catalogue`,
        })
      }

      // Reload suppliers to reflect the change
      await loadSuppliers()
      
      // If viewing this supplier's details, refresh the selected supplier state
      if (selectedSupplier?.id === supplier.id) {
        const updatedSupplier = suppliers.find(s => s.id === supplier.id)
        if (updatedSupplier) {
          setSelectedSupplier(updatedSupplier)
        }
      }
    } catch (error) {
      console.error("Failed to update connection", error)
      toast({
        title: "Connection failed",
        description: "Unable to update connection. Please try again.",
        variant: "destructive",
      })
    }
  }, [userData, db, toast, loadSuppliers, selectedSupplier, suppliers])

  const visibleSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers
    const term = searchTerm.trim().toLowerCase()
    return suppliers.filter((supplier) => {
      return (
        supplier.name.toLowerCase().includes(term) ||
        (supplier.description?.toLowerCase().includes(term) ?? false) ||
        supplier.tags.some((tag) => tag.toLowerCase().includes(term))
      )
    })
  }, [searchTerm, suppliers])

  const connectedCount = useMemo(
    () => suppliers.filter((supplier) => supplier.connected).length,
    [suppliers],
  )

  const suggestedSuppliers = useMemo<SuggestedSupplierRecommendation[]>(() => {
    if (!suppliers.length) return []

    const retailerLocation = userData?.location?.toLowerCase().trim()

    return suppliers
      .filter((supplier) => !supplier.connected)
      .map((supplier) => {
        const reasons: string[] = []
        let score = supplier.reputationScore

        const overlap = supplier.tags.filter((tag) => inventoryTagSet.has(tag.toLowerCase()))
        if (overlap.length) {
          score += overlap.length * 1.2
          reasons.push(
            `Carrier for your ${overlap.slice(0, 2).join(", ")}${overlap.length > 2 ? " and more" : ""}`,
          )
        }

        if (retailerLocation && supplier.location) {
          const supplierLocation = supplier.location.toLowerCase()
          if (
            supplierLocation.includes(retailerLocation) ||
            retailerLocation.includes(supplierLocation)
          ) {
            score += 1.5
            reasons.push("Close to your operating area")
          }
        }

        if (!reasons.length) {
          reasons.push("High performing distributor ready for onboarding")
        }

        return {
          supplier,
          score,
          reasons,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }, [inventoryTagSet, suppliers, userData?.location])

  const hasInventoryProfile = inventoryTags.length > 0

  const handleRequestAccess = useCallback(
    (supplier: SupplierSummary) => {
      toast({
        title: `Request sent to ${supplier.name}`,
        description: "We'll notify you once the supplier approves the connection.",
      })
    },
    [toast],
  )

  const headerSubtitle =
    connectedCount > 0
      ? `You are connected to ${connectedCount} supplier${connectedCount === 1 ? "" : "s"}.`
      : "Connect with distributors to unlock credit limits and negotiated pricing."

  if (!userData || userData.role !== "retailer") {
    return (
      <div className="module-background flex min-h-[calc(100vh-2.5rem)] w-full items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <motion.div
      className="module-background flex h-[calc(100vh-2.5rem)] flex-col overflow-hidden"
      initial={{ x: 0, y: -300, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{ duration: 0.18, ease: [0.4, 0.0, 0.2, 1] }}
    >
      {/* Header */}
      <div className="bg-slate-900/40 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            {/* Back Button */}
            <button 
              onClick={() => router.push("/modules")}
              className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <ArrowLeft className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
            </button>
            
            {/* Tabs */}
            <div className="flex items-center space-x-2 p-1 backdrop-blur-md bg-gradient-to-r from-white/[0.08] to-white/[0.04] border border-white/[0.08] rounded-xl shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)]">
              <button
                type="button"
                className={`px-4 py-2 font-semibold text-base rounded-lg transition-all duration-300 relative
                  ${activeTab === 'supplier' 
                    ? 'text-purple-400 backdrop-blur-md bg-gradient-to-r from-purple-500/[0.15] to-purple-500/[0.08] border border-purple-500/30 shadow-[0_4px_16px_-8px_rgba(168,85,247,0.3)]' 
                    : 'text-slate-200 hover:text-purple-400 hover:bg-white/[0.05] backdrop-blur-sm'}`}
                onClick={() => setActiveTab('supplier')}
              >
                <span className="relative">
                  Supplier
                  {activeTab === 'supplier' && (
                    <span className="absolute left-0 right-0 bottom-0 h-1 bg-gradient-to-r from-purple-400 via-purple-200 to-purple-400 rounded-full blur-sm animate-pulse"></span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className={`px-4 py-2 font-semibold text-base rounded-lg transition-all duration-300 relative
                  ${activeTab === 'credit' 
                    ? 'text-purple-400 backdrop-blur-md bg-gradient-to-r from-purple-500/[0.15] to-purple-500/[0.08] border border-purple-500/30 shadow-[0_4px_16px_-8px_rgba(168,85,247,0.3)]' 
                    : 'text-slate-200 hover:text-purple-400 hover:bg-white/[0.05] backdrop-blur-sm'}`}
                onClick={() => setActiveTab('credit')}
              >
                <span className="relative">
                  Credit
                  {activeTab === 'credit' && (
                    <span className="absolute left-0 right-0 bottom-0 h-1 bg-gradient-to-r from-purple-400 via-purple-200 to-purple-400 rounded-full blur-sm animate-pulse"></span>
                  )}
                </span>
              </button>
            </div>
          </div>
          {activeTab === 'supplier' && (
            <div className="flex items-center gap-2">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search suppliers"
                className="w-64 border border-purple-500/15 bg-slate-950/70 text-sm text-white placeholder:text-slate-400"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'supplier' && (
          <>
            {selectedSupplier ? (
              <ScrollArea className="h-full">
            <div className="space-y-6 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-purple-500/20 bg-slate-950/70 p-6 shadow-[0_24px_60px_-36px_rgba(129,140,248,0.45)]">
                <div className="flex items-start gap-4">
                  <SupplierAvatar name={selectedSupplier.name} logoUrl={selectedSupplier.logoUrl} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold text-white">{selectedSupplier.name}</h2>
                      {selectedSupplier.connected ? (
                        <Badge variant="secondary" className="border border-purple-400/40 bg-purple-500/15 text-purple-100">
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="border border-slate-400/30 bg-slate-500/10 text-slate-100">
                          Prospect
                        </Badge>
                      )}
                    </div>
                    {selectedSupplier.location && (
                      <p className="mt-1 text-sm text-slate-300/80">{selectedSupplier.location}</p>
                    )}
                    {selectedSupplier.description && (
                      <p className="mt-3 max-w-2xl text-sm text-slate-200/80">
                        {selectedSupplier.description}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300/80">
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4 text-purple-300" />
                        {selectedSupplier.paymentTerms}
                      </div>
                      <div className="flex items-center gap-2">
                        <StarIcon className="h-4 w-4 text-purple-300" />
                        Reputation {selectedSupplier.reputationScore.toFixed(1)} / 10
                      </div>
                      {selectedSupplier.lastActivity && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-sky-300" />
                          Active {formatDistanceToNow(new Date(selectedSupplier.lastActivity), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                    {selectedSupplier.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedSupplier.tags.map((tag) => (
                          <Badge key={tag} className="border border-purple-400/30 bg-purple-400/10 text-purple-100">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <Button
                    variant="ghost"
                    className="justify-start text-sm text-slate-300 hover:text-white"
                    onClick={handleBackToList}
                  >
                    &larr; Back to suppliers
                  </Button>
                  {selectedSupplier.connected ? (
                    <Button
                      variant="outline"
                      className="border-rose-400/40 bg-rose-500/10 text-rose-100 hover:border-rose-300/60 hover:bg-rose-500/20"
                      onClick={() => handleConnectSupplier(selectedSupplier)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      className="border border-purple-400/40 bg-purple-500/10 text-purple-100 hover:border-purple-300/60 hover:bg-purple-500/20"
                      onClick={() => handleConnectSupplier(selectedSupplier)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-purple-500/15 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300/80">
                    <span>Retailers connected</span>
                    <Users className="h-4 w-4 text-purple-300" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {selectedSupplier.totalRetailers.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl border border-purple-500/15 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300/80">
                    <span>Orders fulfilled</span>
                    <ShoppingCart className="h-4 w-4 text-purple-300" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {selectedSupplier.totalOrders.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl border border-purple-500/15 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300/80">
                    <span>Products</span>
                    <Package className="h-4 w-4 text-purple-300" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {selectedSupplier.totalGMV.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl border border-purple-500/15 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300/80">
                    <span>Payment terms</span>
                    <Building2 className="h-4 w-4 text-purple-300" />
                  </div>
                  <p className="mt-2 text-xl font-semibold text-white">{selectedSupplier.paymentTerms}</p>
                </div>
              </div>              <div className="rounded-3xl border border-purple-500/20 bg-slate-950/70 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Product Catalogue</h3>
                    {selectedSupplier.connected && totalProducts > 0 && (
                      <p className="text-sm text-slate-400">
                        Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalProducts)} of {totalProducts} products
                      </p>
                    )}
                  </div>
                  {productsLoading && <LoadingSpinner size="sm" />}
                </div>
                
                {!selectedSupplier.connected ? (
                  <div className="rounded-xl border border-purple-400/40 bg-purple-500/15 px-4 py-8 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20">
                      <Package className="h-6 w-6 text-purple-300" />
                    </div>
                    <p className="text-sm font-medium text-purple-100">Connect to view products</p>
                    <p className="mt-1 text-xs text-purple-200/80">
                      Click the Connect button above to access this distributor's catalogue
                    </p>
                  </div>
                ) : (
                  <>
                    {productsError && (
                      <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
                        {productsError}
                      </div>
                    )}
                    {!productsLoading && !productsError && products.length === 0 && (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-300/80">
                        Catalogue not available yet. Check back later or contact the supplier for their price list.
                      </div>
                    )}
                    {/* Product Grid - Inventory Style */}
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="group relative rounded-xl border border-purple-500/10 bg-slate-900/60 p-3 transition hover:border-purple-400/30 hover:bg-slate-900/80"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{product.name}</p>
                            {product.code && (
                              <p className="text-xs text-slate-400">Code: {product.code}</p>
                            )}
                          </div>
                          <Package className="h-4 w-4 text-purple-300 flex-shrink-0" />
                        </div>
                        
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-semibold text-purple-300">
                            {formatCurrency(product.unitPrice)}
                          </span>
                          {product.unit && (
                            <span className="text-xs text-slate-400">/ {product.unit}</span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          {product.category && (
                            <span className="rounded-md border border-purple-400/20 bg-purple-500/10 px-1.5 py-0.5 text-purple-200">
                              {product.category}
                            </span>
                          )}
                          {product.inStock !== undefined && (
                            <span className={cn(
                              "rounded-md px-1.5 py-0.5",
                              product.inStock
                                ? "border border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                : "border border-rose-400/20 bg-rose-500/10 text-rose-200"
                            )}>
                              {product.inStock ? "In Stock" : "Out"}
                            </span>
                          )}
                        </div>
                        
                        {product.leadTime && (
                          <p className="text-xs text-slate-400">Lead: {product.leadTime}</p>
                        )}
                      </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalProducts > PAGE_SIZE && (
                    <div className="mt-6 flex items-center justify-between border-t border-purple-500/10 pt-4">
                      <div className="text-sm text-slate-400">
                        Page {currentPage} of {Math.ceil(totalProducts / PAGE_SIZE)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => selectedSupplier && loadSupplierProducts(selectedSupplier.id, currentPage - 1)}
                          disabled={currentPage === 1 || productsLoading}
                          className="border-purple-500/20 bg-slate-900/60 text-slate-200 hover:border-purple-400/40 hover:bg-slate-900/80"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => selectedSupplier && loadSupplierProducts(selectedSupplier.id, currentPage + 1)}
                          disabled={!hasMoreProducts || productsLoading}
                          className="border-purple-500/20 bg-slate-900/60 text-slate-200 hover:border-purple-400/40 hover:bg-slate-900/80"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-6 p-6">
              {suppliersError && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                  {suppliersError}
                </div>
              )}

              {loadingSuppliers ? (
                <div className="flex h-64 items-center justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {visibleSuppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      onClick={() => handleSupplierSelect(supplier)}
                      className="group w-full cursor-pointer rounded-3xl border border-purple-500/15 bg-gradient-to-br from-slate-950/85 via-slate-950/60 to-purple-950/45 p-5 text-left shadow-[0_8px_24px_-12px_rgba(99,102,241,0.2)] transition hover:-translate-y-1 hover:border-purple-400/40 hover:shadow-[0_12px_32px_-16px_rgba(129,140,248,0.3)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <SupplierAvatar name={supplier.name} logoUrl={supplier.logoUrl} />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-semibold text-white">{supplier.name}</h3>
                              <div className="group/badge relative">
                                <BadgeCheck className="h-5 w-5 text-purple-400 transition-transform duration-500 group-hover/badge:rotate-[360deg]" />
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-200 opacity-0 transition-opacity group-hover/badge:opacity-100">
                                  Verified
                                </span>
                              </div>
                            </div>
                            {supplier.location && (
                              <p className="text-xs text-slate-300/80">{supplier.location}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="default"
                          variant={supplier.connected ? "outline" : "default"}
                          className={cn(
                            "h-9 px-6 text-sm font-medium",
                            supplier.connected 
                              ? "border-slate-400/40 bg-slate-500/10 text-slate-200 hover:border-slate-300/60 hover:bg-slate-500/20"
                              : "border-0 bg-white text-slate-900 hover:bg-white/90"
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleConnectSupplier(supplier)
                          }}
                        >
                          {supplier.connected ? "Connected" : "Connect"}
                        </Button>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-300/80">
                        <div className="rounded-xl border border-purple-500/15 bg-slate-950/70 p-3">
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-purple-300" />
                            Retailers
                          </div>
                          <p className="mt-2 text-base font-semibold text-white">
                            {supplier.totalRetailers.toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-xl border border-purple-500/15 bg-slate-950/70 p-3">
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-3.5 w-3.5 text-purple-300" />
                            Orders
                          </div>
                          <p className="mt-2 text-base font-semibold text-white">
                            {supplier.totalOrders.toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-xl border border-purple-500/15 bg-slate-950/70 p-3">
                          <div className="flex items-center gap-2">
                            <Package className="h-3.5 w-3.5 text-purple-300" />
                            Products
                          </div>
                          <p className="mt-2 text-base font-semibold text-white">
                            {supplier.totalGMV.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-purple-200/90">
                          <StarIcon className="h-3.5 w-3.5" />
                          Reputation {supplier.reputationScore.toFixed(1)} / 10
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
        </>
      )}

        {activeTab === 'credit' && (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-purple-500/10 p-4">
                  <TrendingUp className="h-8 w-8 text-purple-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white">Credit Management</h3>
              <p className="mt-2 text-sm text-slate-300/80">
                View and manage your credit limits, payment terms, and outstanding balances with connected suppliers.
              </p>
              <Badge className="mt-4 border border-purple-400/40 bg-purple-500/15 text-purple-100">
                Coming Soon
              </Badge>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}