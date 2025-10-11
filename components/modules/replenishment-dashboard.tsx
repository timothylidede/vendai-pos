'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle2, Clock, Package, DollarSign, TrendingUp, RefreshCw, ShoppingCart } from 'lucide-react'
import { ReplenishmentSuggestion } from '@/types/replenishment'
import { useAuth } from '@/contexts/auth-context'

interface ReplenishmentSummary {
  total: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  totalCost: number
  criticalCount: number
}

interface DashboardProps {
  orgId: string
}

export default function ReplenishmentDashboard({ orgId }: DashboardProps) {
  const { user } = useAuth()
  const [activeView, setActiveView] = useState<'active' | 'history'>('active')
  const [suggestions, setSuggestions] = useState<ReplenishmentSuggestion[]>([])
  const [historySuggestions, setHistorySuggestions] = useState<ReplenishmentSuggestion[]>([])
  const [summary, setSummary] = useState<ReplenishmentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  const fetchSuggestions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ orgId })
      if (activeView === 'active') {
        // Active view shows pending and approved
        if (statusFilter !== 'all') {
          params.append('status', statusFilter)
        } else {
          params.append('status', 'pending,approved')
        }
      } else {
        // History view shows rejected and ordered
        if (statusFilter !== 'all') {
          params.append('status', statusFilter)
        } else {
          params.append('status', 'rejected,ordered')
        }
      }
      if (priorityFilter !== 'all') params.append('priority', priorityFilter)

      const response = await fetch(`/api/replenishment/suggestions?${params}`)
      const data = await response.json()

      if (data.success) {
        if (activeView === 'active') {
          setSuggestions(data.suggestions)
        } else {
          setHistorySuggestions(data.suggestions)
        }
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateSuggestions = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/replenishment/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId })
      })

      const data = await response.json()
      if (data.success) {
        await fetchSuggestions()
        alert(`✅ Generated ${data.count} replenishment suggestions`)
      }
    } catch (error) {
      console.error('Error generating suggestions:', error)
      alert('Failed to generate suggestions')
    } finally {
      setGenerating(false)
    }
  }

  const approveSuggestion = async (id: string) => {
    try {
      const response = await fetch(`/api/replenishment/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', userId: user?.uid })
      })

      const data = await response.json()
      if (data.success) {
        await fetchSuggestions()
      }
    } catch (error) {
      console.error('Error approving suggestion:', error)
    }
  }

  const rejectSuggestion = async (id: string) => {
    try {
      const response = await fetch(`/api/replenishment/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' })
      })

      const data = await response.json()
      if (data.success) {
        await fetchSuggestions()
      }
    } catch (error) {
      console.error('Error rejecting suggestion:', error)
    }
  }

  const batchCreatePO = async () => {
    if (selectedIds.length === 0) {
      alert('Please select suggestions to approve')
      return
    }

    const confirmed = confirm(`Create purchase order for ${selectedIds.length} selected items?`)
    if (!confirmed) return

    try {
      const response = await fetch('/api/replenishment/create-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionIds: selectedIds,
          userId: user?.uid,
          orgId
        })
      })

      const data = await response.json()
      if (data.success) {
        setSelectedIds([])
        await fetchSuggestions()
        alert(`✅ Purchase order ${data.poId} created with ${data.suggestionsCount} items`)
      }
    } catch (error) {
      console.error('Error creating PO:', error)
      alert('Failed to create purchase order')
    }
  }

  useEffect(() => {
    fetchSuggestions()
  }, [orgId, statusFilter, priorityFilter, activeView])

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    const pendingSuggestions = suggestions.filter(s => s.status === 'pending')
    setSelectedIds(pendingSuggestions.map(s => s.id!).filter(Boolean))
  }

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, any> = {
      critical: { variant: 'destructive', icon: AlertCircle },
      high: { variant: 'default', className: 'bg-orange-500', icon: TrendingUp },
      medium: { variant: 'secondary', icon: Clock },
      low: { variant: 'outline', icon: Package }
    }
    const config = variants[priority] || variants.medium
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {priority.toUpperCase()}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: 'outline', icon: Clock },
      approved: { variant: 'default', className: 'bg-green-600', icon: CheckCircle2 },
      rejected: { variant: 'destructive', icon: AlertCircle },
      ordered: { variant: 'secondary', icon: ShoppingCart }
    }
    const config = variants[status] || variants.pending
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {status.toUpperCase()}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Auto-Replenishment</h2>
          <p className="text-muted-foreground">Intelligent stock replenishment suggestions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateSuggestions} disabled={generating}>
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'Generate Suggestions'}
          </Button>
          {selectedIds.length > 0 && (
            <Button onClick={batchCreatePO} variant="default" className="bg-green-600">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Create PO ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveView('active')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeView === 'active'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Active Suggestions
        </button>
        <button
          onClick={() => setActiveView('history')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeView === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          History
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.byStatus.pending || 0} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Critical Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{summary.criticalCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Require immediate attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">₹{summary.totalCost.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Pending orders value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{summary.byStatus.approved || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Ready for PO creation
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="ordered">Ordered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Priority</label>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {suggestions.filter(s => s.status === 'pending').length > 0 && (
            <div className="flex items-end">
              <Button variant="outline" onClick={selectAll}>
                Select All Pending
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggestions List */}
      <Card>
        <CardHeader>
          <CardTitle>{activeView === 'active' ? 'Active Suggestions' : 'History'}</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${(activeView === 'active' ? suggestions : historySuggestions).length} suggestions found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading suggestions...</div>
          ) : (activeView === 'active' ? suggestions : historySuggestions).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {activeView === 'active' 
                ? 'No active suggestions found. Click "Generate Suggestions" to create new ones.'
                : 'No history found. Rejected and ordered suggestions will appear here.'
              }
            </div>
          ) : (
            <div className="space-y-3">
              {(activeView === 'active' ? suggestions : historySuggestions).map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {suggestion.status === 'pending' && suggestion.id && (
                      <Checkbox
                        checked={selectedIds.includes(suggestion.id)}
                        onCheckedChange={() => toggleSelection(suggestion.id!)}
                        className="mt-1"
                      />
                    )}

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-lg">{suggestion.productName}</h4>
                          <p className="text-sm text-muted-foreground">
                            SKU: {suggestion.productId} | Supplier: {suggestion.preferredSupplierName}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {getPriorityBadge(suggestion.priority)}
                          {getStatusBadge(suggestion.status)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">Current Stock:</span>
                          <span className="font-semibold ml-2">{suggestion.currentStock}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Reorder Point:</span>
                          <span className="font-semibold ml-2">{suggestion.reorderPoint}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Suggested Qty:</span>
                          <span className="font-semibold ml-2 text-blue-600">{suggestion.suggestedQty}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Cost:</span>
                          <span className="font-semibold ml-2">₹{suggestion.totalCost.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Unit Cost: ₹{suggestion.unitCost} | Lead Time: {suggestion.supplierLeadTime} days
                        </span>
                        <span>
                          Created: {new Date(suggestion.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {suggestion.reason && (
                        <div className="mt-2 text-sm bg-muted/50 p-2 rounded">
                          <span className="font-medium">Reason:</span> {suggestion.reason}
                        </div>
                      )}

                      {suggestion.status === 'pending' && suggestion.id && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600"
                            onClick={() => approveSuggestion(suggestion.id!)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectSuggestion(suggestion.id!)}
                          >
                            <AlertCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}

                      {suggestion.status === 'ordered' && suggestion.purchaseOrderId && (
                        <div className="mt-2 text-sm text-blue-600 font-medium">
                          <ShoppingCart className="w-4 h-4 inline mr-1" />
                          PO: {suggestion.purchaseOrderId}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
