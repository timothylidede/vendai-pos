/**
 * Cashier Performance Dashboard
 * Track sales per lane and cashier metrics
 */

'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Clock, DollarSign, Users, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CashierPerformance } from '@/types/pos'

const panelShell =
  'rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/70 via-slate-900/45 to-slate-800/40 backdrop-blur-2xl shadow-[0_30px_80px_-35px_rgba(15,23,42,0.9)] text-slate-100'

interface CashierPerformanceDashboardProps {
  orgId: string
}

export default function CashierPerformanceDashboard({ orgId }: CashierPerformanceDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today')
  const [performances, setPerformances] = useState<CashierPerformance[]>([])

  useEffect(() => {
    loadPerformanceData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, timeRange])

  async function loadPerformanceData() {
    setLoading(true)
    try {
      const now = new Date()
      let startDate = new Date()

      switch (timeRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate.setDate(now.getDate() - 30)
          break
      }

      if (!db) {
        console.error('Firebase not initialized')
        return
      }

      const ordersRef = collection(db, 'pos_orders')
      const q = query(
        ordersRef,
        where('orgId', '==', orgId),
        where('createdAt', '>=', startDate.toISOString()),
        where('status', '==', 'paid')
      )

      const snapshot = await getDocs(q)
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Group by cashier
      const cashierMap = new Map<string, {
        orders: any[]
        totalSales: number
        transactionCount: number
        lanes: Set<string>
      }>()

      orders.forEach((order: any) => {
        const cashierId = order.cashierId || order.userId
        if (!cashierMap.has(cashierId)) {
          cashierMap.set(cashierId, {
            orders: [],
            totalSales: 0,
            transactionCount: 0,
            lanes: new Set()
          })
        }

        const cashierData = cashierMap.get(cashierId)!
        cashierData.orders.push(order)
        cashierData.totalSales += order.total || 0
        cashierData.transactionCount += 1
        if (order.laneId) {
          cashierData.lanes.add(order.laneId)
        }
      })

      // Calculate performance metrics
      const performanceData: CashierPerformance[] = []

      cashierMap.forEach((data, cashierId) => {
        const sortedOrders = data.orders.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

        const firstOrder = sortedOrders[0]
        const lastOrder = sortedOrders[sortedOrders.length - 1]

        // Calculate average transaction time
        let totalDuration = 0
        for (let i = 1; i < sortedOrders.length; i++) {
          const prevTime = new Date(sortedOrders[i - 1].createdAt).getTime()
          const currTime = new Date(sortedOrders[i].createdAt).getTime()
          totalDuration += (currTime - prevTime)
        }
        const avgTransactionTime = sortedOrders.length > 1 
          ? totalDuration / (sortedOrders.length - 1) / 1000 // in seconds
          : 0

        performanceData.push({
          cashierId,
          cashierName: firstOrder.cashierName || `Cashier ${cashierId.slice(0, 6)}`,
          laneId: data.lanes.size === 1 ? Array.from(data.lanes)[0] : undefined,
          totalSales: data.totalSales,
          transactionCount: data.transactionCount,
          averageTransactionTime: Math.round(avgTransactionTime),
          averageOrderValue: data.totalSales / data.transactionCount,
          startTime: firstOrder.createdAt,
          endTime: lastOrder.createdAt,
        })
      })

      // Sort by total sales descending
      performanceData.sort((a, b) => b.totalSales - a.totalSales)

      setPerformances(performanceData)
    } catch (error) {
      console.error('Error loading performance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalSales = performances.reduce((sum, p) => sum + p.totalSales, 0)
  const totalTransactions = performances.reduce((sum, p) => sum + p.transactionCount, 0)
  const avgOrderValue = totalTransactions > 0 ? totalSales / totalTransactions : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cn(panelShell, 'relative overflow-hidden px-8 py-10')}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-indigo-400/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-50">Cashier Performance</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Track sales metrics, transaction times, and lane performance across your team.
            </p>
          </div>
          <div className={cn(panelShell, 'flex items-center gap-3 px-4 py-3')}>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Period</span>
            <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
              <SelectTrigger className="w-32 border-white/10 bg-slate-950/80 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-950/90 text-slate-100">
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(panelShell, 'p-6')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Total Sales</p>
              <p className="mt-2 text-3xl font-semibold text-slate-50">
                ₹{totalSales.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <DollarSign className="h-6 w-6 text-emerald-300" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={cn(panelShell, 'p-6')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Transactions</p>
              <p className="mt-2 text-3xl font-semibold text-slate-50">{totalTransactions}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <Activity className="h-6 w-6 text-sky-300" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(panelShell, 'p-6')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Avg Order Value</p>
              <p className="mt-2 text-3xl font-semibold text-slate-50">
                ₹{avgOrderValue.toFixed(0)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <TrendingUp className="h-6 w-6 text-violet-300" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={cn(panelShell, 'p-6')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Active Cashiers</p>
              <p className="mt-2 text-3xl font-semibold text-slate-50">{performances.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <Users className="h-6 w-6 text-cyan-300" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Performance List */}
      <div className="space-y-3">
        {loading ? (
          <div className={cn(panelShell, 'flex items-center justify-center px-8 py-12 text-sm text-slate-300')}>
            Loading performance data…
          </div>
        ) : performances.length === 0 ? (
          <div className={cn(panelShell, 'flex items-center justify-center px-8 py-12 text-sm text-slate-300')}>
            No sales data for selected period.
          </div>
        ) : (
          performances.map((perf, index) => (
            <motion.div
              key={perf.cashierId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className={cn(panelShell, 'p-6')}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-50">{perf.cashierName}</h3>
                    {perf.laneId && (
                      <Badge
                        variant="outline"
                        className="rounded-full border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                      >
                        Lane {perf.laneId}
                      </Badge>
                    )}
                    {index === 0 && (
                      <Badge
                        variant="outline"
                        className="rounded-full border-amber-400/40 bg-amber-400/10 text-amber-100"
                      >
                        Top Performer
                      </Badge>
                    )}
                  </div>
                  {perf.startTime && perf.endTime && (
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(perf.startTime).toLocaleTimeString()} - {new Date(perf.endTime).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-emerald-200">
                    ₹{perf.totalSales.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">{perf.transactionCount} transactions</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-300" />
                  <span className="text-slate-400">Avg Order:</span>
                  <span className="font-medium text-slate-200">
                    ₹{perf.averageOrderValue.toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-sky-300" />
                  <span className="text-slate-400">Avg Time:</span>
                  <span className="font-medium text-slate-200">
                    {perf.averageTransactionTime}s
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
