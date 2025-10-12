'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Download,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

// ============================================================================
// Types
// ============================================================================

interface CreditFacility {
  id: string
  retailerId: string
  retailerName?: string
  approvedAmount: number
  outstandingBalance: number
  availableCredit: number
  creditUtilization: number
  status: 'active' | 'suspended' | 'closed' | 'defaulted'
  lastDisbursementAt: Timestamp | null
  lastRepaymentAt: Timestamp | null
  metrics: {
    totalDisbursements: number
    successfulRepayments: number
    lateRepayments: number
    averageRepaymentLagDays: number
    currentStreak: number
  }
}

interface CreditScore {
  id: string
  retailerId: string
  retailerName?: string
  score: number
  tier: 'starter' | 'growth' | 'scale' | 'elite'
  breakdown: {
    sales: number
    payments: number
    consistency: number
    tenure: number
    growth: number
    utilization: number
  }
  alerts: string[]
  watchlist: boolean
  upgradeCandidate: boolean
  calculatedAt: Timestamp
}

interface DashboardMetrics {
  totalFacilities: number
  activeFacilities: number
  totalCreditDisbursed: number
  totalOutstanding: number
  averageUtilization: number
  watchlistCount: number
  upgradeCandidates: number
  defaultRate: number
}

// ============================================================================
// Admin Credit Dashboard Component
// ============================================================================

export default function AdminCreditDashboard() {
  const { user, organization } = useAuth()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  
  // Data
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalFacilities: 0,
    activeFacilities: 0,
    totalCreditDisbursed: 0,
    totalOutstanding: 0,
    averageUtilization: 0,
    watchlistCount: 0,
    upgradeCandidates: 0,
    defaultRate: 0,
  })
  const [facilities, setFacilities] = useState<CreditFacility[]>([])
  const [scores, setScores] = useState<CreditScore[]>([])
  const [watchlist, setWatchlist] = useState<CreditScore[]>([])
  const [upgradeCandidates, setUpgradeCandidates] = useState<CreditScore[]>([])

  // ============================================================================
  // Auth Check
  // ============================================================================

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    // Check if user has admin or credit_manager role
    const userRole = (user as any).role
    if (userRole !== 'admin' && userRole !== 'credit_manager') {
      router.push('/modules')
      return
    }

    loadDashboardData()
  }, [user, organization])

  // ============================================================================
  // Data Loading
  // ============================================================================

  async function loadDashboardData() {
    if (!organization?.id) return

    setLoading(true)
    try {
      await Promise.all([
        loadCreditFacilities(),
        loadCreditScores(),
      ])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadCreditFacilities() {
    if (!organization?.id || !db) return

    const facilitiesRef = collection(db, 'organizations', organization.id, 'credit_facilities')
    const q = query(facilitiesRef, orderBy('creditUtilization', 'desc'))
    const snapshot = await getDocs(q)

    const facilitiesData: CreditFacility[] = []
    snapshot.forEach((doc) => {
      facilitiesData.push({ id: doc.id, ...doc.data() } as CreditFacility)
    })

    setFacilities(facilitiesData)

    // Calculate metrics
    const totalFacilities = facilitiesData.length
    const activeFacilities = facilitiesData.filter((f) => f.status === 'active').length
    const totalCreditDisbursed = facilitiesData.reduce((sum, f) => sum + (f.metrics?.totalDisbursements || 0) * f.approvedAmount, 0)
    const totalOutstanding = facilitiesData.reduce((sum, f) => sum + f.outstandingBalance, 0)
    const averageUtilization = facilitiesData.length > 0
      ? facilitiesData.reduce((sum, f) => sum + f.creditUtilization, 0) / facilitiesData.length
      : 0
    const defaulted = facilitiesData.filter((f) => f.status === 'defaulted').length
    const defaultRate = totalFacilities > 0 ? (defaulted / totalFacilities) * 100 : 0

    setMetrics((prev) => ({
      ...prev,
      totalFacilities,
      activeFacilities,
      totalCreditDisbursed,
      totalOutstanding,
      averageUtilization,
      defaultRate,
    }))
  }

  async function loadCreditScores() {
    if (!organization?.id || !db) return

    const scoresRef = collection(db, 'organizations', organization.id, 'credit_scores')
    const q = query(scoresRef, orderBy('calculatedAt', 'desc'))
    const snapshot = await getDocs(q)

    const scoresData: CreditScore[] = []
    const uniqueRetailers = new Set<string>()

    snapshot.forEach((doc) => {
      const scoreData = { id: doc.id, ...doc.data() } as CreditScore
      
      // Only keep the latest score per retailer
      if (!uniqueRetailers.has(scoreData.retailerId)) {
        scoresData.push(scoreData)
        uniqueRetailers.add(scoreData.retailerId)
      }
    })

    setScores(scoresData)

    // Extract watchlist and upgrade candidates
    const watchlistItems = scoresData.filter((s) => s.watchlist)
    const upgradeCandidatesItems = scoresData.filter((s) => s.upgradeCandidate)

    setWatchlist(watchlistItems)
    setUpgradeCandidates(upgradeCandidatesItems)

    setMetrics((prev) => ({
      ...prev,
      watchlistCount: watchlistItems.length,
      upgradeCandidates: upgradeCandidatesItems.length,
    }))
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadDashboardData()
    setRefreshing(false)
  }

  // ============================================================================
  // Filtering
  // ============================================================================

  const filteredFacilities = facilities.filter((facility) => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      facility.retailerName?.toLowerCase().includes(search) ||
      facility.retailerId.toLowerCase().includes(search)
    )
  })

  const filteredScores = scores.filter((score) => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      score.retailerName?.toLowerCase().includes(search) ||
      score.retailerId.toLowerCase().includes(search)
    )
  })

  // ============================================================================
  // Render Helpers
  // ============================================================================

  function getTierBadgeColor(tier: string) {
    switch (tier) {
      case 'elite':
        return 'bg-purple-500 text-white'
      case 'scale':
        return 'bg-blue-500 text-white'
      case 'growth':
        return 'bg-green-500 text-white'
      case 'starter':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-gray-300 text-gray-800'
    }
  }

  function getStatusBadgeColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'defaulted':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  function formatDate(timestamp: Timestamp | null) {
    if (!timestamp) return 'Never'
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // ============================================================================
  // Loading State
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading credit dashboard...</p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credit Dashboard</h1>
          <p className="text-muted-foreground">Monitor credit facilities, scores, and performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Facilities</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalFacilities}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.activeFacilities} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.averageUtilization.toFixed(1)}% avg utilization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Watchlist</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{metrics.watchlistCount}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.defaultRate.toFixed(1)}% default rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upgrade Candidates</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.upgradeCandidates}</div>
            <p className="text-xs text-muted-foreground">Eligible for limit increase</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by retailer name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="facilities">Facilities</TabsTrigger>
          <TabsTrigger value="scores">Credit Scores</TabsTrigger>
          <TabsTrigger value="watchlist">
            Watchlist
            {metrics.watchlistCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {metrics.watchlistCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upgrades">
            Upgrade Candidates
            {metrics.upgradeCandidates > 0 && (
              <Badge variant="default" className="ml-2">
                {metrics.upgradeCandidates}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Summary</CardTitle>
              <CardDescription>High-level overview of credit performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Total Credit Disbursed</p>
                  <p className="text-2xl font-bold">{formatCurrency(metrics.totalCreditDisbursed)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Outstanding</p>
                  <p className="text-2xl font-bold">{formatCurrency(metrics.totalOutstanding)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Utilization</p>
                  <p className="text-2xl font-bold">{metrics.averageUtilization.toFixed(1)}%</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Recent Activity</h4>
                <p className="text-sm text-muted-foreground">
                  {facilities.length} credit facilities across {scores.length} retailers
                </p>
                <p className="text-sm text-muted-foreground">
                  {metrics.upgradeCandidates} retailers eligible for limit increases
                </p>
                <p className="text-sm text-muted-foreground">
                  {metrics.watchlistCount} retailers on watchlist requiring attention
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Facilities Tab */}
        <TabsContent value="facilities">
          <Card>
            <CardHeader>
              <CardTitle>Credit Facilities</CardTitle>
              <CardDescription>All active and inactive credit facilities</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Retailer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Utilization</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFacilities.map((facility) => (
                    <TableRow key={facility.id}>
                      <TableCell className="font-medium">
                        {facility.retailerName || facility.retailerId}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(facility.status)}>
                          {facility.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(facility.approvedAmount)}</TableCell>
                      <TableCell>{formatCurrency(facility.outstandingBalance)}</TableCell>
                      <TableCell>{formatCurrency(facility.availableCredit)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                facility.creditUtilization > 85
                                  ? 'bg-red-500'
                                  : facility.creditUtilization > 70
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(facility.creditUtilization, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm">{facility.creditUtilization.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(facility.lastRepaymentAt || facility.lastDisbursementAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredFacilities.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No facilities found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credit Scores Tab */}
        <TabsContent value="scores">
          <Card>
            <CardHeader>
              <CardTitle>Credit Scores</CardTitle>
              <CardDescription>Latest credit scores for all retailers</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Retailer</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Payments</TableHead>
                    <TableHead>Consistency</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScores.map((score) => (
                    <TableRow key={score.id}>
                      <TableCell className="font-medium">
                        {score.retailerName || score.retailerId}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold">{score.score.toFixed(0)}</span>
                          <span className="text-sm text-muted-foreground">/ 100</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTierBadgeColor(score.tier)}>
                          {score.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>{score.breakdown.sales.toFixed(0)}/30</TableCell>
                      <TableCell>{score.breakdown.payments.toFixed(0)}/30</TableCell>
                      <TableCell>{score.breakdown.consistency.toFixed(0)}/15</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {score.watchlist && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Watch
                            </Badge>
                          )}
                          {score.upgradeCandidate && (
                            <Badge variant="default" className="text-xs">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Upgrade
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredScores.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No scores found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Watchlist Tab */}
        <TabsContent value="watchlist">
          <Card>
            <CardHeader>
              <CardTitle>Watchlist</CardTitle>
              <CardDescription>Retailers requiring attention or intervention</CardDescription>
            </CardHeader>
            <CardContent>
              {watchlist.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-lg font-semibold">All Clear!</p>
                  <p className="text-sm text-muted-foreground">No retailers on watchlist</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {watchlist.map((score) => (
                    <Card key={score.id} className="border-l-4 border-l-yellow-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            {score.retailerName || score.retailerId}
                          </CardTitle>
                          <Badge className={getTierBadgeColor(score.tier)}>
                            {score.tier}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Credit Score:</span>
                            <span className="text-lg font-bold">{score.score.toFixed(0)}</span>
                          </div>
                          {score.alerts.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-yellow-700">Alerts:</p>
                              {score.alerts.map((alert, idx) => (
                                <p key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                                  {alert}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upgrade Candidates Tab */}
        <TabsContent value="upgrades">
          <Card>
            <CardHeader>
              <CardTitle>Upgrade Candidates</CardTitle>
              <CardDescription>Retailers eligible for credit limit increases</CardDescription>
            </CardHeader>
            <CardContent>
              {upgradeCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-semibold">No Candidates Yet</p>
                  <p className="text-sm text-muted-foreground">Check back later for eligible retailers</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upgradeCandidates.map((score) => (
                    <Card key={score.id} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            {score.retailerName || score.retailerId}
                          </CardTitle>
                          <Badge className={getTierBadgeColor(score.tier)}>
                            {score.tier}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Credit Score:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold text-green-600">{score.score.toFixed(0)}</span>
                              <TrendingUp className="h-5 w-5 text-green-500" />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Sales</p>
                              <p className="text-sm font-semibold">{score.breakdown.sales.toFixed(0)}/30</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Payments</p>
                              <p className="text-sm font-semibold">{score.breakdown.payments.toFixed(0)}/30</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Growth</p>
                              <p className="text-sm font-semibold">{score.breakdown.growth.toFixed(0)}/10</p>
                            </div>
                          </div>

                          <Button className="w-full" variant="default">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Approve Limit Increase
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
