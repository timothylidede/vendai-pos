'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import {
  Users,
  Store,
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
  Plus,
  Filter,
  Search,
  TrendingUp,
  Package,
  DollarSign,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'

type RetailerTab = 'partners' | 'orders' | 'analytics'
type RetailerStatus = 'active' | 'inactive' | 'pending'

interface PurchaseOrderAggregate {
  totalOrders: number
  totalGross: number
  monthlyOrders: number
  monthlyGross: number
  lastOrderAt: Date | null
}

interface RetailerRecord {
  id: string
  orgId?: string
  name: string
  contactName?: string
  email?: string
  phone?: string
  location?: string
  status: RetailerStatus
  totalOrders: number
  totalGMV: number
  monthlyOrders: number
  monthlyGMV: number
  lastOrderAt: Date | null
  creditLimit: number
  creditUsed: number
  creditExposure: number
}

interface PurchaseOrderSummary {
  id: string
  status: string | null
  total: number
  createdAt: string | null
  expectedDeliveryDate: string | null
  paymentTerms?: string | null
}

interface InvoiceSummary {
  id: string
  number?: string | null
  status: string | null
  paymentStatus?: string | null
  total: number
  issueDate: string | null
  dueDate: string | null
}

const RETAILER_QUERY_LIMIT = 150
const PURCHASE_ORDER_QUERY_LIMIT = 500
const MILLIS_IN_30_DAYS = 30 * 24 * 60 * 60 * 1000

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const parseString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length) return value.trim()
  return undefined
}

const toDateSafe = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in (value as Record<string, unknown>) &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    try {
      return (value as { toDate: () => Date }).toDate()
    } catch (error) {
      console.warn('Failed to parse timestamp', error)
    }
  }
  return null
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: value >= 100000 ? 0 : 2,
  }).format(value)
}

const formatRelativeDate = (value: Date | null): string => {
  if (!value) return 'No orders yet'
  const now = Date.now()
  const diff = now - value.getTime()
  if (diff < 0) return 'Scheduled'
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 60) return `${minutes || '<1'} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

const statusColor = (status: RetailerStatus): string => {
  switch (status) {
    case 'active':
      return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'inactive':
      return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'pending':
    default:
      return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
  }
}

const buildAggregates = (orders: Array<Record<string, unknown>>): Map<string, PurchaseOrderAggregate> => {
  const aggregates = new Map<string, PurchaseOrderAggregate>()
  const now = Date.now()

  orders.forEach((order) => {
    const retailerId = parseString(order.retailerId) ?? parseString(order.retailerOrgId)
    if (!retailerId) return

    const amount = (() => {
      const data = order.amount as Record<string, unknown> | undefined
      if (data && typeof data === 'object') {
        const candidate = parseNumber(data.total ?? data.gross ?? data.net ?? 0)
        if (candidate) return candidate
      }
      return parseNumber(order.total ?? order.orderTotal ?? order.amount ?? 0)
    })()

    const createdAt = toDateSafe(order.createdAt ?? order.created_at ?? order.placedAt)

    const entry = aggregates.get(retailerId) ?? {
      totalOrders: 0,
      totalGross: 0,
      monthlyOrders: 0,
      monthlyGross: 0,
      lastOrderAt: null,
    }

    entry.totalOrders += 1
    entry.totalGross += amount
    if (createdAt) {
      if (!entry.lastOrderAt || entry.lastOrderAt.getTime() < createdAt.getTime()) {
        entry.lastOrderAt = createdAt
      }
      if (now - createdAt.getTime() <= MILLIS_IN_30_DAYS) {
        entry.monthlyOrders += 1
        entry.monthlyGross += amount
      }
    }

    aggregates.set(retailerId, entry)
  })

  return aggregates
}

const pickRetailerStatus = (data: Record<string, unknown>): RetailerStatus => {
  const raw = parseString(data.status ?? data.accountStatus ?? data.lifecycleStatus)
  if (!raw) return 'active'
  const normalised = raw.toLowerCase()
  if (normalised.includes('inactive')) return 'inactive'
  if (normalised.includes('pending') || normalised.includes('invite')) return 'pending'
  return 'active'
}

const computeCreditExposure = (limitValue: number, usedValue: number): number => {
  if (limitValue <= 0) return usedValue
  return Math.max(0, usedValue)
}

function RetailerDetailsSheet({
  retailer,
  open,
  onOpenChange,
}: {
  retailer: RetailerRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderSummary[]>([])
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])

  useEffect(() => {
    if (!open || !retailer) return

    const controller = new AbortController()

    const loadDetails = async () => {
      setLoading(true)
      setPurchaseOrders([])
      setInvoices([])
      try {
        const [poResponse, invoiceResponse] = await Promise.all([
          fetch(`/api/purchase-orders?retailerId=${encodeURIComponent(retailer.id)}&limit=25`, {
            signal: controller.signal,
          }),
          fetch(`/api/invoices?retailerId=${encodeURIComponent(retailer.id)}&limit=25`, {
            signal: controller.signal,
          }),
        ])

        if (!poResponse.ok) {
          throw new Error('Failed to load purchase orders')
        }
        if (!invoiceResponse.ok) {
          throw new Error('Failed to load invoices')
        }

        const poJson = await poResponse.json()
        const invoiceJson = await invoiceResponse.json()

        const purchaseOrderData: PurchaseOrderSummary[] = (
          Array.isArray(poJson.purchaseOrders) ? poJson.purchaseOrders : []
        ).map((entry: Record<string, unknown>) => {
          const amount = entry.amount as { total?: number } | undefined
          return {
            id: parseString(entry.id) ?? 'unknown',
            status: parseString(entry.status) ?? null,
            total: parseNumber(amount?.total ?? entry.total ?? 0),
            createdAt: parseString(entry.createdAt) ?? null,
            expectedDeliveryDate: parseString(entry.expectedDeliveryDate) ?? null,
            paymentTerms: parseString(entry.paymentTerms) ?? null,
          }
        })

        const invoiceData: InvoiceSummary[] = (
          Array.isArray(invoiceJson.invoices) ? invoiceJson.invoices : []
        ).map((entry: Record<string, unknown>) => {
          const amount = entry.amount as { total?: number } | undefined
          return {
            id: parseString(entry.id) ?? 'unknown',
            number: parseString(entry.number) ?? null,
            status: parseString(entry.status) ?? null,
            paymentStatus: parseString(entry.paymentStatus) ?? null,
            total: parseNumber(amount?.total ?? entry.total ?? 0),
            issueDate: parseString(entry.issueDate) ?? null,
            dueDate: parseString(entry.dueDate) ?? null,
          }
        })

        setPurchaseOrders(purchaseOrderData)
        setInvoices(invoiceData)
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError' || controller.signal.aborted) {
          return
        }
        console.error('Failed to load retailer drill-downs', error)
        toast({
          title: 'Unable to load drill-downs',
          description: 'Refresh or try again later.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    loadDetails()

    return () => controller.abort()
  }, [open, retailer, toast])

  const exposurePercent = useMemo(() => {
    if (!retailer || retailer.creditLimit <= 0) return 0
    return Math.min(100, (retailer.creditUsed / retailer.creditLimit) * 100)
  }, [retailer])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[520px]">
        <SheetHeader>
          <SheetTitle>{retailer?.name ?? 'Retailer details'}</SheetTitle>
          <SheetDescription>
            Credit utilisation, purchase orders, and invoice history for this retailer.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
          {retailer && (
            <div className="space-y-6 py-4">
              <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Credit exposure</h3>
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
                  <div>
                    <p className="text-slate-400 text-xs">Credit limit</p>
                    <p className="font-semibold">{formatCurrency(retailer.creditLimit)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Outstanding</p>
                    <p className="font-semibold">{formatCurrency(retailer.creditExposure)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Utilised</p>
                    <p className="font-semibold">{formatCurrency(retailer.creditUsed)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Last order</p>
                    <p className="font-semibold">{formatRelativeDate(retailer.lastOrderAt)}</p>
                  </div>
                </div>
                <Progress value={exposurePercent} className="h-2" />
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">Recent purchase orders</h3>
                  <span className="text-xs text-slate-400">
                    {purchaseOrders.length} loaded
                  </span>
                </div>
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-900/40">
                      <TableRow>
                        <TableHead className="text-slate-300">PO ID</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                        <TableHead className="text-slate-300 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrders.length === 0 && !loading && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-sm text-slate-400 py-8">
                            No purchase orders yet.
                          </TableCell>
                        </TableRow>
                      )}
                      {purchaseOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium text-slate-200">{order.id}</TableCell>
                          <TableCell className="text-slate-300 capitalize">{order.status ?? 'unknown'}</TableCell>
                          <TableCell className="text-right text-slate-200">{formatCurrency(order.total)}</TableCell>
                        </TableRow>
                      ))}
                      {loading && (
                        <TableRow>
                          <TableCell colSpan={3} className="py-8 text-center text-sm text-slate-400">
                            Loading orders…
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <Separator className="bg-slate-800" />

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">Recent invoices</h3>
                  <span className="text-xs text-slate-400">{invoices.length} loaded</span>
                </div>
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-900/40">
                      <TableRow>
                        <TableHead className="text-slate-300">Invoice</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                        <TableHead className="text-slate-300 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.length === 0 && !loading && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-sm text-slate-400 py-8">
                            No invoices issued yet.
                          </TableCell>
                        </TableRow>
                      )}
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium text-slate-200">
                            {invoice.number ?? invoice.id}
                          </TableCell>
                          <TableCell className="text-slate-300 capitalize">
                            {invoice.paymentStatus ?? invoice.status ?? 'unknown'}
                          </TableCell>
                          <TableCell className="text-right text-slate-200">
                            {formatCurrency(invoice.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {loading && (
                        <TableRow>
                          <TableCell colSpan={3} className="py-8 text-center text-sm text-slate-400">
                            Loading invoices…
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

export default function RetailersPage() {
  const [activeTab, setActiveTab] = useState<RetailerTab>('partners')
  const [retailers, setRetailers] = useState<RetailerRecord[]>([])
  const [retailersLoading, setRetailersLoading] = useState<boolean>(true)
  const [retailersError, setRetailersError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | RetailerStatus>('all')
  const [sortKey, setSortKey] = useState<'recent' | 'gmv' | 'orders' | 'credit'>('recent')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerRecord | null>(null)
  const { toast } = useToast()

  const loadRetailers = useCallback(async () => {
    setRetailersLoading(true)
    setRetailersError(null)
    try {
      const retailersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'retailer'),
        limit(RETAILER_QUERY_LIMIT),
      )

      const purchaseOrdersQuery = query(
        collection(db, 'purchase_orders'),
        orderBy('createdAt', 'desc'),
        limit(PURCHASE_ORDER_QUERY_LIMIT),
      )

      const [retailersSnapshot, purchaseOrdersSnapshot] = await Promise.all([
        getDocs(retailersQuery),
        getDocs(purchaseOrdersQuery),
      ])

      const aggregateMap = buildAggregates(
        purchaseOrdersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })),
      )

      const mappedRetailers: RetailerRecord[] = retailersSnapshot.docs.map((doc) => {
        const data = doc.data() as Record<string, unknown>
        const retailerId = doc.id
        const orgId = parseString(data.organizationId ?? data.orgId ?? data.retailerOrgId)
        const contact = (data.contact as Record<string, unknown> | undefined) ?? undefined
        const aggregateKey = orgId ?? retailerId
        const aggregates = aggregateMap.get(aggregateKey) ?? aggregateMap.get(retailerId) ?? {
          totalOrders: 0,
          totalGross: 0,
          monthlyOrders: 0,
          monthlyGross: 0,
          lastOrderAt: null,
        }

        const credit = data.credit as { limit?: number; used?: number; outstanding?: number } | undefined
        const creditProfile = data.credit_profile as { limit?: number; utilised?: number; outstanding?: number } | undefined
        
        const creditLimit = parseNumber(
          data.creditLimit ?? credit?.limit ?? creditProfile?.limit ?? 0,
        )
        const creditUsed = parseNumber(
          data.creditUsed ?? credit?.used ?? creditProfile?.utilised ?? 0,
        )
        const outstanding = parseNumber(
          data.creditOutstanding ?? credit?.outstanding ?? creditProfile?.outstanding ?? creditUsed,
        )

        return {
          id: retailerId,
          orgId: orgId ?? undefined,
          name:
            parseString(data.displayName) ??
            parseString(data.businessName) ??
            parseString(data.organizationName) ??
            'Unnamed Retailer',
          contactName:
            parseString(data.contactName) ??
            parseString(contact?.name) ??
            parseString(data.ownerName) ??
            undefined,
          email: parseString(data.email) ?? parseString(contact?.email) ?? undefined,
          phone: parseString(data.phoneNumber) ?? parseString(contact?.phone) ?? undefined,
          location:
            parseString(data.location) ??
            parseString(data.address) ??
            parseString(contact?.address) ??
            undefined,
          status: pickRetailerStatus(data),
          totalOrders: aggregates.totalOrders,
          totalGMV: aggregates.totalGross,
          monthlyOrders: aggregates.monthlyOrders,
          monthlyGMV: aggregates.monthlyGross,
          lastOrderAt: aggregates.lastOrderAt,
          creditLimit,
          creditUsed,
          creditExposure: computeCreditExposure(creditLimit, outstanding || creditUsed),
        }
      })

      setRetailers(mappedRetailers)
    } catch (error) {
      console.error('Failed to load retailer data', error)
      setRetailers([])
      setRetailersError('We could not load retailers from Firestore right now.')
      toast({
        title: 'Retailers unavailable',
        description: 'Refresh the page or retry in a few moments.',
        variant: 'destructive',
      })
    } finally {
      setRetailersLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadRetailers()
  }, [loadRetailers])

  const handleSelectRetailer = useCallback((record: RetailerRecord) => {
    setSelectedRetailer(record)
    setDetailOpen(true)
  }, [])

  const filteredRetailers = useMemo(() => {
    let list = retailers
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      list = list.filter((retailer) => {
        const haystack = [
          retailer.name,
          retailer.contactName,
          retailer.email,
          retailer.phone,
          retailer.location,
          retailer.id,
          retailer.orgId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(term)
      })
    }

    if (statusFilter !== 'all') {
      list = list.filter((retailer) => retailer.status === statusFilter)
    }

    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'gmv':
          return b.totalGMV - a.totalGMV
        case 'orders':
          return b.totalOrders - a.totalOrders
        case 'credit':
          return b.creditExposure - a.creditExposure
        case 'recent':
        default: {
          const aTime = a.lastOrderAt?.getTime() ?? 0
          const bTime = b.lastOrderAt?.getTime() ?? 0
          return bTime - aTime
        }
      }
    })
  }, [retailers, searchTerm, statusFilter, sortKey])

  const stats = useMemo(() => {
    const totalPartners = retailers.length
    const activePartners = retailers.filter((retailer) => retailer.status === 'active').length
    const totalOrders = retailers.reduce((sum, retailer) => sum + retailer.totalOrders, 0)
    const totalGmv = retailers.reduce((sum, retailer) => sum + retailer.totalGMV, 0)
    const monthlyGmv = retailers.reduce((sum, retailer) => sum + retailer.monthlyGMV, 0)
    const avgOrderValue = totalOrders > 0 ? totalGmv / totalOrders : 0
    return {
      totalPartners,
      activePartners,
      monthlyRevenue: monthlyGmv,
      averageOrderValue: avgOrderValue,
    }
  }, [retailers])

  const cards = useMemo(
    () => [
      {
        label: 'Total Partners',
        value: stats.totalPartners.toString(),
        icon: Store,
        color: 'text-cyan-400',
      },
      {
        label: 'Active Partners',
        value: stats.activePartners.toString(),
        icon: Users,
        color: 'text-green-400',
      },
      {
        label: 'Monthly GMV',
        value: formatCurrency(stats.monthlyRevenue),
        icon: DollarSign,
        color: 'text-blue-400',
      },
      {
        label: 'Avg Order Value',
        value: formatCurrency(stats.averageOrderValue),
        icon: TrendingUp,
        color: 'text-purple-400',
      },
    ],
    [stats],
  )

  return (
    <div className="module-background flex min-h-[calc(100vh-2.5rem)] flex-col overflow-hidden">
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/modules">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Modules
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center">
                <Users className="w-8 h-8 mr-3 text-cyan-400" />
                Retail Partners
              </h1>
              <p className="text-slate-400">Manage your retail network and credit exposure</p>
            </div>
          </div>
          <Button className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Retailer
          </Button>
        </div>
      </div>

      <div className="p-6">
        <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg w-fit">
          {[
            { key: 'partners', label: 'Retail Partners', icon: Store },
            { key: 'orders', label: 'Partner Orders', icon: Package },
            { key: 'analytics', label: 'Performance', icon: TrendingUp },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as RetailerTab)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                activeTab === key
                  ? 'bg-cyan-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-8">
        {activeTab === 'partners' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              {cards.map((stat) => (
                <Card key={stat.label} className="p-6 bg-slate-800/60 border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                    </div>
                    <stat.icon className={`w-8 h-8 ${stat.color}`} />
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 items-center gap-4">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by retailer, location, or contact"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>
                <Button
                  onClick={loadRetailers}
                  variant="secondary"
                  className="bg-slate-800/60 border border-slate-700/60 text-slate-200 hover:text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | RetailerStatus)}>
                  <SelectTrigger className="w-[150px] bg-slate-800/60 border-slate-700/50 text-slate-200">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortKey} onValueChange={(value) => setSortKey(value as typeof sortKey)}>
                  <SelectTrigger className="w-[150px] bg-slate-800/60 border-slate-700/50 text-slate-200">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="recent">Recent activity</SelectItem>
                    <SelectItem value="gmv">GMV (desc)</SelectItem>
                    <SelectItem value="orders">Orders (desc)</SelectItem>
                    <SelectItem value="credit">Credit exposure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {retailersError && (
              <Card className="border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5" />
                <span>{retailersError}</span>
              </Card>
            )}

            {retailersLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Card
                    key={`retailer-skeleton-${index}`}
                    className="h-64 animate-pulse border border-slate-800 bg-slate-900/40"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredRetailers.map((retailer) => {
                  const creditPercentage = retailer.creditLimit > 0
                    ? Math.min(100, (retailer.creditUsed / retailer.creditLimit) * 100)
                    : 0
                  return (
                    <Card
                      key={retailer.id}
                      className="group flex h-full flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-cyan-500/40 hover:bg-slate-900/70"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10">
                            <Store className="h-6 w-6 text-cyan-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">{retailer.name}</h3>
                            <p className="text-sm text-slate-400">{retailer.contactName ?? 'No contact saved'}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium border rounded-full ${statusColor(retailer.status)}`}>
                          {retailer.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
                        <div className="flex items-center">
                          <MapPin className="mr-2 h-3 w-3" />
                          {retailer.location ?? '—'}
                        </div>
                        <div className="flex items-center">
                          <Phone className="mr-2 h-3 w-3" />
                          {retailer.phone ?? '—'}
                        </div>
                        <div className="flex items-center col-span-2">
                          <Mail className="mr-2 h-3 w-3" />
                          {retailer.email ?? '—'}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-center">
                        <div>
                          <p className="text-xs text-slate-400">Orders</p>
                          <p className="text-lg font-semibold text-white">{retailer.totalOrders}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Total GMV</p>
                          <p className="text-lg font-semibold text-white">{formatCurrency(retailer.totalGMV)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">30d GMV</p>
                          <p className="text-lg font-semibold text-white">{formatCurrency(retailer.monthlyGMV)}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-slate-400">
                          <span>Credit utilisation</span>
                          <span className="text-slate-200">
                            {formatCurrency(retailer.creditUsed)} / {formatCurrency(retailer.creditLimit)}
                          </span>
                        </div>
                        <Progress value={creditPercentage} className="h-2" />
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Outstanding</span>
                          <span className="text-slate-300">{formatCurrency(retailer.creditExposure)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Last order</span>
                          <span className="text-slate-300">{formatRelativeDate(retailer.lastOrderAt)}</span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        className="mt-auto border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                        onClick={() => handleSelectRetailer(retailer)}
                      >
                        View credit & orders
                      </Button>
                    </Card>
                  )
                })}

                {!retailersLoading && filteredRetailers.length === 0 && (
                  <Card className="col-span-full border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
                    No retailers match your filters yet.
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="text-center py-20 text-slate-400">
            Partner order dashboards will surface here after PO pagination work completes.
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="text-center py-20 text-slate-400">
            Performance analytics coming soon.
          </div>
        )}
      </div>

      <RetailerDetailsSheet
        retailer={selectedRetailer}
        open={detailOpen && Boolean(selectedRetailer)}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setSelectedRetailer(null)
          }
        }}
      />
    </div>
  )
}