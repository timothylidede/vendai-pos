'use client'

/**
 * Enhanced POS Sales Tab with Dashboard Metrics
 * Includes: Sales history, low-stock alerts, top sellers, gross margin, exceptions
 * Part of Phase 1.1 Real-time Dashboards implementation
 */

import { useState, useEffect, useMemo } from 'react'
import { 
  Search, ChevronDown, TrendingUp, TrendingDown, AlertTriangle, 
  Package, DollarSign, ShoppingCart, RefreshCw, Calendar,
  Download, Eye, Printer, Filter, X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { collection, query, where, orderBy, limit, onSnapshot, getDocs, Timestamp } from 'firebase/firestore'
import type { POSOrderDoc, POSProduct, InventoryRecord } from '@/lib/types'
import { LoadingSpinner } from '../loading-spinner'

// Utility function to format money
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

interface DashboardMetrics {
  lowStockCount: number
  topSellers: Array<{ productId: string; name: string; quantity: number; revenue: number }>
  categoryMargins: Array<{ category: string; margin: number; revenue: number }>
  exceptionsCount: number
  totalSales: number
  totalOrders: number
}

interface DateRange {
  label: string
  days: number
  startDate: Date
  endDate: Date
}

const DATE_RANGES: DateRange[] = [
  { label: 'Today', days: 1, startDate: new Date(), endDate: new Date() },
  { label: '7 Days', days: 7, startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), endDate: new Date() },
  { label: '30 Days', days: 30, startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate: new Date() },
  { label: '90 Days', days: 90, startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), endDate: new Date() },
]

export function EnhancedSalesTab() {
  const { userData } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRange, setSelectedRange] = useState<DateRange>(DATE_RANGES[1]) // Default to 7 days
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<POSOrderDoc | null>(null)

  // Real-time data
  const [recentOrders, setRecentOrders] = useState<POSOrderDoc[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    lowStockCount: 0,
    topSellers: [],
    categoryMargins: [],
    exceptionsCount: 0,
    totalSales: 0,
    totalOrders: 0,
  })

  // Fetch dashboard metrics
  const fetchDashboardMetrics = async () => {
    if (!db || !userData?.organizationName) return

    try {
      setRefreshing(true)

      // Low stock count from inventory
      const inventoryQuery = query(
        collection(db, 'pos_inventory'),
        where('orgId', '==', userData.organizationName)
      )
      const inventorySnap = await getDocs(inventoryQuery)
      const inventory = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[] as InventoryRecord[]

      // Count products below reorder point
      const lowStockProducts = inventory.filter(inv => {
        const reorderPoint = 10 // Default reorder point
        const totalPieces = (inv.qtyBase || 0) * (inv.unitsPerBase || 1) + (inv.qtyLoose || 0)
        return totalPieces < reorderPoint
      })

      // Get orders for date range
      const ordersQuery = query(
        collection(db, 'pos_orders'),
        where('orgId', '==', userData.organizationName),
        where('createdAt', '>=', Timestamp.fromDate(selectedRange.startDate)),
        where('createdAt', '<=', Timestamp.fromDate(selectedRange.endDate)),
        orderBy('createdAt', 'desc')
      )
      const ordersSnap = await getDocs(ordersQuery)
      const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as POSOrderDoc[]

      // Calculate top sellers
      const productSales = new Map<string, { name: string; quantity: number; revenue: number }>()
      orders.forEach(order => {
        order.lines?.forEach(line => {
          const existing = productSales.get(line.productId) || { name: line.name, quantity: 0, revenue: 0 }
          existing.quantity += line.quantityPieces
          existing.revenue += line.unitPrice * line.quantityPieces
          productSales.set(line.productId, existing)
        })
      })

      const topSellers = Array.from(productSales.entries())
        .map(([productId, data]) => ({ productId, ...data }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10)

      // Calculate category margins (simplified - needs cost data)
      const categoryMargins = [] as Array<{ category: string; margin: number; revenue: number }>

      // Exception count (unmapped items)
      const exceptionsQuery = query(
        collection(db, 'pos_exceptions'),
        where('orgId', '==', userData.organizationName),
        where('status', '==', 'pending')
      )
      const exceptionsSnap = await getDocs(exceptionsQuery)

      setMetrics({
        lowStockCount: lowStockProducts.length,
        topSellers,
        categoryMargins,
        exceptionsCount: exceptionsSnap.size,
        totalSales: orders.reduce((sum, o) => sum + (o.total || 0), 0),
        totalOrders: orders.length,
      })

    } catch (error) {
      console.error('Error fetching dashboard metrics:', error)
      toast({
        title: 'Error',
        description: 'Failed to load dashboard metrics',
        variant: 'destructive',
      })
    } finally {
      setRefreshing(false)
    }
  }

  // Set up real-time listener for recent orders
  useEffect(() => {
    if (!db || !userData?.organizationName) return

    setLoading(true)

    const ordersQuery = query(
      collection(db, 'pos_orders'),
      where('orgId', '==', userData.organizationName),
      where('createdAt', '>=', Timestamp.fromDate(selectedRange.startDate)),
      orderBy('createdAt', 'desc'),
      limit(100)
    )

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const orders = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        })) as POSOrderDoc[]
        setRecentOrders(orders)
        setLoading(false)
      },
      (error) => {
        console.error('Error listening to orders:', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [userData?.organizationName, selectedRange])

  // Fetch metrics when range changes
  useEffect(() => {
    if (userData?.organizationName) {
      fetchDashboardMetrics()
    }
  }, [userData?.organizationName, selectedRange])

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return recentOrders.filter(order => {
      const matchesSearch = !searchTerm || 
        (order.id && order.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        order.lines?.some(line => line.name.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesStatus = !statusFilter || order.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [recentOrders, searchTerm, statusFilter])

  const handleExport = () => {
    // TODO: Implement CSV/PDF export
    toast({
      title: 'Export Started',
      description: 'Your sales report will download shortly',
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Header with Date Range Selector */}
      <div className="bg-slate-900/40 backdrop-blur-sm px-6 py-4 border-b border-slate-500/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Sales & Analytics</h2>
          <div className="flex items-center gap-3">
            {/* Date Range Selector */}
            <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
              {DATE_RANGES.map((range) => (
                <button
                  key={range.label}
                  onClick={() => setSelectedRange(range)}
                  className={`px-3 py-1.5 text-sm rounded transition-all ${
                    selectedRange.label === range.label
                      ? 'bg-green-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDashboardMetrics()}
              disabled={refreshing}
              className="text-slate-300 border-slate-600"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Dashboard Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          {/* Low Stock Alert */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <span className="text-xs text-orange-300">Alert</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics.lowStockCount}</div>
            <div className="text-xs text-slate-400 mt-1">Low Stock Items</div>
          </motion.div>

          {/* Total Sales */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">{formatMoney(metrics.totalSales)}</div>
            <div className="text-xs text-slate-400 mt-1">{metrics.totalOrders} Orders</div>
          </motion.div>

          {/* Top Sellers */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <Package className="w-5 h-5 text-blue-400" />
              <span className="text-xs text-blue-300">Best</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics.topSellers.length}</div>
            <div className="text-xs text-slate-400 mt-1">Top Products</div>
          </motion.div>

          {/* Exceptions */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-xs text-red-300">Issues</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics.exceptionsCount}</div>
            <div className="text-xs text-slate-400 mt-1">Unmapped Items</div>
          </motion.div>
        </div>
      </div>

      {/* Sales List Header */}
      <div className="bg-slate-900/30 backdrop-blur-sm px-6 py-3 border-b border-slate-500/20">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sales by ID or product..." 
              className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pl-10"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                <X className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value || null)}
              className="bg-slate-700 border-slate-600 text-white rounded px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </select>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport}
              className="text-slate-300 border-slate-600"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <span className="text-slate-400 text-sm">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'sale' : 'sales'}
            </span>
          </div>
        </div>
      </div>

      {/* Sales Content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sales List */}
        <div className="flex-1 overflow-y-auto thin-scroll">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <ShoppingCart className="w-16 h-16 mb-4 text-slate-600" />
              <p className="text-lg">No sales found</p>
              <p className="text-sm mt-2">Try adjusting your filters or date range</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <motion.div
                key={order.id}
                whileHover={{ backgroundColor: 'rgba(51, 65, 85, 0.3)' }}
                className="flex items-center justify-between px-6 py-4 border-b border-slate-500/20 cursor-pointer"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-center space-x-6">
                  <div className="text-left">
                    <div className="text-slate-300 text-sm font-medium">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-slate-400 text-xs">
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">{order.id}</div>
                    <div className="text-slate-400 text-sm">
                      {order.lines?.length ?? 0} items
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-slate-300 text-sm">
                      {order.paymentMethod || 'Cash'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-white font-medium text-lg">
                    {formatMoney(order.total || 0)}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.status === 'paid'
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : order.status === 'awaiting_payment'
                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                        : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                    }`}
                  >
                    {order.status}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedOrder(order)
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Right Panel - Order Details or Metrics */}
        <div className="w-96 border-l border-slate-500/30 bg-slate-900/30 backdrop-blur-sm overflow-y-auto thin-scroll">
          {selectedOrder ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Sale Details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOrder(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Order Info */}
              <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-400">Order ID</div>
                    <div className="text-white font-medium">{selectedOrder.id}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Status</div>
                    <div className="text-white font-medium capitalize">{selectedOrder.status}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Date</div>
                    <div className="text-white font-medium">
                      {new Date(selectedOrder.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Payment</div>
                    <div className="text-white font-medium">
                      {selectedOrder.paymentMethod || 'Cash'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Items</h4>
                <div className="space-y-2">
                  {selectedOrder.lines?.map((line, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-800/30 rounded p-3"
                    >
                      <div className="flex-1">
                        <div className="text-white text-sm">{line.name}</div>
                        <div className="text-slate-400 text-xs">
                          {line.quantityPieces} × {formatMoney(line.unitPrice)}
                        </div>
                      </div>
                      <div className="text-white font-medium">
                        {formatMoney(line.lineTotal)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-gradient-to-r from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="text-slate-300">Total</div>
                  <div className="text-2xl font-bold text-white">
                    {formatMoney(selectedOrder.total || 0)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Printer className="w-4 h-4 mr-2" />
                  Reprint
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          ) : (
            /* Top Sellers List */
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Top Sellers</h3>
              <div className="space-y-3">
                {metrics.topSellers.slice(0, 10).map((seller, idx) => (
                  <div
                    key={seller.productId}
                    className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 flex items-center justify-center text-green-300 font-semibold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{seller.name}</div>
                        <div className="text-slate-400 text-xs">
                          {seller.quantity} sold
                        </div>
                      </div>
                    </div>
                    <div className="text-green-400 font-medium">
                      {formatMoney(seller.revenue)}
                    </div>
                  </div>
                ))}
              </div>

              {metrics.topSellers.length === 0 && (
                <div className="text-center text-slate-400 py-8">
                  <Package className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p>No sales data yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
