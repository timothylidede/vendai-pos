"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
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
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { listPOSProducts } from "@/lib/pos-operations"
import type { POSProduct } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { LoadingSpinner } from "../loading-spinner"
import { ScrollArea } from "../ui/scroll-area"
import { Badge } from "../ui/badge"

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

const SupplierAvatar = ({ name }: { name: string }) => {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/35 via-indigo-500/15 to-slate-900/70 text-lg font-semibold text-purple-50 shadow-[0_12px_32px_-20px_rgba(168,85,247,0.6)]">
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

  const [searchTerm, setSearchTerm] = useState("")
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([])
  const [inventoryTags, setInventoryTags] = useState<string[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [suppliersError, setSuppliersError] = useState<string | null>(null)

  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null)
  const [products, setProducts] = useState<SupplierProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState<string | null>(null)
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

  const mapSupplierSnapshot = useCallback(
    (
      snapshot: QueryDocumentSnapshot<DocumentData>,
      retailerOrgId?: string,
      retailerUserId?: string,
    ): SupplierSummary => {
      const raw = snapshot.data() as Record<string, unknown>
      const base: SupplierSummary = {
        id: snapshot.id,
        name: parseString(raw.name) ?? snapshot.id,
        description: parseString(raw.description),
        logoUrl: parseString(raw.logoUrl),
        paymentTerms: parseString(raw.paymentTerms) ?? "Net 30",
        totalRetailers: parseNumber(raw.totalRetailers),
        totalOrders: parseNumber(raw.totalOrders),
        totalGMV: parseNumber(raw.totalGMV),
        lastActivity: parseString(raw.lastActivity),
        connected: inferConnected(raw, retailerOrgId, retailerUserId),
        reputationScore: 0,
        location:
          parseString(raw.headquarters) ??
          parseString(raw.location) ??
          parseString(raw.address),
        tags: toStringArray(raw.topCategories).slice(0, 4),
      }

      return { ...base, reputationScore: computeReputation(base) }
    },
    [],
  )

  const loadSuppliers = useCallback(async () => {
    if (!userData || userData.role !== "retailer") return

    setLoadingSuppliers(true)
    setSuppliersError(null)

    try {
      const suppliersRef = collection(db, "distributors")
      const suppliersQuery = query(suppliersRef, orderBy("name"), limit(100))
      const snapshot = await getDocs(suppliersQuery)

      const mapped = snapshot.docs.map((docSnap) =>
        mapSupplierSnapshot(docSnap, userData.organizationName, userData.uid),
      )

      const prioritized = mapped.sort((a, b) => {
        if (a.connected && !b.connected) return -1
        if (!a.connected && b.connected) return 1
        return b.reputationScore - a.reputationScore
      })

      setSuppliers(prioritized)
      if (!prioritized.length) {
        setSuppliersError("No suppliers found yet. Request access from your preferred distributor.")
      }
    } catch (error) {
      console.error("Failed to load suppliers", error)
      setSuppliersError("Unable to load suppliers right now. Try refreshing in a moment.")
    } finally {
      setLoadingSuppliers(false)
    }
  }, [mapSupplierSnapshot, userData])

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

  const loadSupplierProducts = useCallback(async (supplierId: string) => {
    setProductsLoading(true)
    setProductsError(null)

    try {
      const productsRef = collection(db, "distributors", supplierId, "products")
      const productsQuery = query(productsRef, orderBy("name"), limit(80))
      const snapshot = await getDocs(productsQuery)

      const mapped: SupplierProduct[] = snapshot.docs.map((docSnap) => {
        const raw = docSnap.data() as Record<string, unknown>
        return {
          id: docSnap.id,
          name: parseString(raw.name) ?? docSnap.id,
          unitPrice: parseNumber(raw.unitPrice ?? raw.price ?? raw.piecePrice),
          unit: parseString(raw.unit ?? raw.retailUom),
          category: parseString(raw.category),
          brand: parseString(raw.brand),
          minOrderQuantity: parseNumber(raw.minOrderQuantity ?? raw.moq),
          leadTime: parseString(raw.leadTime),
          inStock: typeof raw.inStock === "boolean" ? raw.inStock : undefined,
          imageUrl: parseString(raw.imageUrl ?? raw.image ?? raw.thumbnailUrl),
        }
      })

      setProducts(mapped)
      if (!mapped.length) {
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
    if (selectedSupplier) {
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
      <div className="border-b border-white/5 bg-slate-950/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/modules")}
              className="group flex h-10 w-10 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10 transition hover:border-purple-400/50 hover:bg-purple-500/20"
            >
              <ArrowLeft className="h-5 w-5 text-purple-100 group-hover:text-white" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white">Suppliers</h1>
              <p className="text-sm text-slate-300/80">{headerSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search suppliers"
              className="w-64 border border-purple-500/15 bg-slate-950/70 text-sm text-white placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {selectedSupplier ? (
          <ScrollArea className="h-full">
            <div className="space-y-6 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-purple-500/20 bg-slate-950/70 p-6 shadow-[0_24px_60px_-36px_rgba(129,140,248,0.45)]">
                <div className="flex items-start gap-4">
                  <SupplierAvatar name={selectedSupplier.name} />
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
                  {!selectedSupplier.connected && (
                    <Button
                      className="border border-purple-400/40 bg-purple-500/10 text-purple-100 hover:border-purple-300/60 hover:bg-purple-500/20"
                      onClick={() => handleRequestAccess(selectedSupplier)}
                    >
                      Request access
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-purple-500/15 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300/80">
                    <span>Retailers served</span>
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
                    <span>Total GMV</span>
                    <TrendingUp className="h-4 w-4 text-sky-300" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatCurrency(selectedSupplier.totalGMV)}
                  </p>
                </div>
                <div className="rounded-2xl border border-purple-500/15 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300/80">
                    <span>Payment terms</span>
                    <Building2 className="h-4 w-4 text-purple-300" />
                  </div>
                  <p className="mt-2 text-xl font-semibold text-white">{selectedSupplier.paymentTerms}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-purple-500/20 bg-slate-950/70 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Product catalogue</h3>
                  {productsLoading && <LoadingSpinner size="sm" />}
                </div>
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
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="group rounded-2xl border border-purple-500/15 bg-gradient-to-br from-slate-950/80 via-slate-950/60 to-purple-950/40 p-4 shadow-[0_18px_40px_-28px_rgba(99,102,241,0.55)] transition hover:-translate-y-0.5 hover:border-purple-400/45 hover:shadow-[0_26px_60px_-28px_rgba(129,140,248,0.6)]"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white line-clamp-2">{product.name}</p>
                          {product.brand && (
                            <p className="text-xs text-slate-300/80">{product.brand}</p>
                          )}
                        </div>
                        <Package className="h-5 w-5 text-purple-300" />
                      </div>
                      <div className="mt-4 text-lg font-semibold text-white">
                        {formatCurrency(product.unitPrice)}
                        {product.unit && <span className="text-sm text-slate-300/80"> / {product.unit}</span>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-300/80">
                        {product.category && (
                          <span className="rounded-full border border-purple-400/30 bg-purple-500/15 px-2 py-1">
                            {product.category}
                          </span>
                        )}
                        {Number.isFinite(product.minOrderQuantity) && product.minOrderQuantity !== 0 && (
                          <span className="rounded-full border border-sky-400/30 bg-sky-500/15 px-2 py-1">
                            MOQ {product.minOrderQuantity}
                          </span>
                        )}
                        {product.leadTime && (
                          <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-1">
                            Lead time {product.leadTime}
                          </span>
                        )}
                        {product.inStock !== undefined && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-1",
                              product.inStock
                                ? "border border-purple-400/30 bg-purple-500/15 text-purple-100"
                                : "border border-rose-400/30 bg-rose-500/15 text-rose-100",
                            )}
                          >
                            {product.inStock ? "In stock" : "Out of stock"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-6 p-6">
              {connectedCount === 0 && !loadingSuppliers && !suppliersError && (
                <EmptyState onRefresh={loadSuppliers} />
              )}

              {suppliersError && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                  {suppliersError}
                </div>
              )}

              {!loadingSuppliers && !suppliersError && suggestedSuppliers.length > 0 && (
                <div className="rounded-3xl border border-purple-500/20 bg-slate-950/70 p-5 shadow-[0_28px_72px_-40px_rgba(129,140,248,0.55)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-purple-100">
                      <Sparkles className="h-4 w-4 text-purple-300" /> Suggested distributors for you
                    </div>
                    <div className="flex items-center gap-3">
                      {hasInventoryProfile && (
                        <Badge className="border border-purple-400/35 bg-purple-500/15 text-[0.7rem] text-purple-100">
                          Based on your inventory
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        className="h-8 border-purple-400/30 bg-purple-500/5 text-xs text-purple-100 hover:border-purple-300/60 hover:bg-purple-500/10"
                        onClick={loadSuppliers}
                      >
                        Refresh list
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {suggestedSuppliers.map(({ supplier, reasons, score }) => (
                      <button
                        key={`suggested-${supplier.id}`}
                        onClick={() => handleSupplierSelect(supplier)}
                        className="group w-full rounded-2xl border border-purple-500/20 bg-slate-950/70 p-4 text-left transition hover:-translate-y-1 hover:border-purple-400/50 hover:shadow-[0_28px_70px_-38px_rgba(167,139,250,0.6)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <SupplierAvatar name={supplier.name} />
                            <div>
                              <h3 className="text-base font-semibold text-white">{supplier.name}</h3>
                              {supplier.location && (
                                <div className="mt-1 flex items-center gap-1 text-xs text-slate-300/75">
                                  <MapPin className="h-3.5 w-3.5 text-purple-300" />
                                  {supplier.location}
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge className="border border-purple-400/35 bg-purple-500/20 text-[0.7rem] text-purple-100">
                            Top pick
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-2 text-xs text-slate-300/80">
                          {reasons.map((reason, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <Compass className="mt-0.5 h-3.5 w-3.5 text-purple-300" />
                              <span className="leading-relaxed">{reason}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs text-purple-200/80">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3.5 w-3.5" /> Composite score {score.toFixed(1)}
                          </span>
                          <span className="font-medium">View profile →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loadingSuppliers ? (
                <div className="flex h-64 items-center justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {visibleSuppliers.map((supplier) => (
                    <button
                      key={supplier.id}
                      onClick={() => handleSupplierSelect(supplier)}
                      className="group w-full rounded-3xl border border-purple-500/15 bg-gradient-to-br from-slate-950/85 via-slate-950/60 to-purple-950/45 p-5 text-left shadow-[0_24px_60px_-36px_rgba(99,102,241,0.55)] transition hover:-translate-y-1 hover:border-purple-400/50 hover:shadow-[0_32px_76px_-34px_rgba(129,140,248,0.65)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <SupplierAvatar name={supplier.name} />
                          <div>
                            <h3 className="text-lg font-semibold text-white">{supplier.name}</h3>
                            {supplier.location && (
                              <p className="text-xs text-slate-300/80">{supplier.location}</p>
                            )}
                          </div>
                        </div>
                        <div>
                          {supplier.connected ? (
                            <Badge className="border border-purple-400/40 bg-purple-500/15 text-purple-100">
                              Connected
                            </Badge>
                          ) : (
                            <Badge className="border border-slate-400/30 bg-slate-500/10 text-slate-100">
                              Prospect
                            </Badge>
                          )}
                        </div>
                      </div>

                      {supplier.description && (
                        <p className="mt-3 line-clamp-2 text-sm text-slate-200/80">
                          {supplier.description}
                        </p>
                      )}

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
                            <TrendingUp className="h-3.5 w-3.5 text-sky-300" />
                            GMV
                          </div>
                          <p className="mt-2 text-base font-semibold text-white">
                            {formatCurrency(supplier.totalGMV)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-purple-200/90">
                          <StarIcon className="h-3.5 w-3.5" />
                          Reputation {supplier.reputationScore.toFixed(1)} / 10
                        </div>
                        <div className="text-xs text-purple-200/80">
                          View catalogue →
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </motion.div>
  )
}