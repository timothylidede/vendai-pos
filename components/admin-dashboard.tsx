'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, Building2, ShoppingCart, TrendingUp, AlertCircle,
  Download, Upload, RefreshCw, Search, Filter, MoreHorizontal,
  UserPlus, Building, Trash2, Edit, Eye, DollarSign
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import logger from '@/lib/logger'

interface SystemMetrics {
  totalDistributors: number
  totalRetailers: number
  totalOrders: number
  totalGMV: number
  monthlyGrowth: number
  activeUsers: number
  pendingSettlements: number
  systemHealth: 'healthy' | 'warning' | 'critical'
}

interface UserRecord {
  id: string
  email: string
  displayName: string
  role: 'distributor' | 'retailer'
  organizationName: string
  location: string
  createdAt: string
  lastActive: string
  status: 'active' | 'suspended' | 'pending'
  totalOrders?: number
  totalGMV?: number
}

interface AuditLogEntry {
  id: string
  timestamp: string
  userId: string
  userEmail: string
  action: string
  resource: string
  details: string
  ipAddress: string
  userAgent: string
}

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTab, setSelectedTab] = useState('overview')
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null)
  
  const { userData } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    loadAdminData()
  }, [])

  const loadAdminData = async () => {
    setLoading(true)
    try {
      // In a real implementation, these would be API calls
      await Promise.all([
        loadSystemMetrics(),
        loadUsers(),
        loadAuditLogs()
      ])
    } catch (error) {
      logger.error('Failed to load admin data', error)
      toast({
        title: 'Error loading data',
        description: 'Failed to load admin dashboard data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadSystemMetrics = async () => {
    // Mock data - replace with actual API call
    setMetrics({
      totalDistributors: 12,
      totalRetailers: 156,
      totalOrders: 2847,
      totalGMV: 2450000,
      monthlyGrowth: 15.8,
      activeUsers: 89,
      pendingSettlements: 8,
      systemHealth: 'healthy'
    })
  }

  const loadUsers = async () => {
    // Mock data - replace with actual API call
    setUsers([
      {
        id: '1',
        email: 'distributor@example.com',
        displayName: 'Sam West Distributors',
        role: 'distributor',
        organizationName: 'Sam West Distributors',
        location: 'Nairobi, Kenya',
        createdAt: '2024-01-15',
        lastActive: '2 hours ago',
        status: 'active',
        totalOrders: 45,
        totalGMV: 125000
      },
      {
        id: '2',
        email: 'retailer@example.com',
        displayName: 'Mama Mboga Shop',
        role: 'retailer',
        organizationName: 'Mama Mboga Shop',
        location: 'Kiambu, Kenya',
        createdAt: '2024-02-03',
        lastActive: '1 day ago',
        status: 'active',
        totalOrders: 23,
        totalGMV: 45000
      }
    ])
  }

  const loadAuditLogs = async () => {
    // Mock data - replace with actual API call
    setAuditLogs([
      {
        id: '1',
        timestamp: '2024-01-20T10:30:00Z',
        userId: '1',
        userEmail: 'distributor@example.com',
        action: 'CREATE_ORDER',
        resource: 'orders/12345',
        details: 'Created order for KSh 25,000',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    ])
  }

  const handleUserAction = async (action: string, userId: string) => {
    try {
      logger.userAction(`Admin ${action} user`, { userId, adminId: userData?.uid })
      
      // Implement actual user management actions
      switch (action) {
        case 'suspend':
          // Suspend user
          break
        case 'activate':
          // Activate user
          break
        case 'delete':
          // Delete user (soft delete)
          break
        default:
          break
      }
      
      toast({
        title: 'Success',
        description: `User ${action} completed successfully`
      })
      
      await loadUsers() // Refresh user list
    } catch (error) {
      logger.error(`Admin action failed: ${action}`, error)
      toast({
        title: 'Error',
        description: `Failed to ${action} user`,
        variant: 'destructive'
      })
    }
  }

  const exportData = async (type: 'users' | 'orders' | 'settlements') => {
    try {
      const response = await fetch(`/api/export?collections=${type}&format=csv`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      
      logger.userAction('Data export', { type })
      toast({
        title: 'Export successful',
        description: `${type} data exported successfully`
      })
    } catch (error) {
      logger.error('Export failed', error)
      toast({
        title: 'Export failed',
        description: 'Failed to export data',
        variant: 'destructive'
      })
    }
  }

  const filteredUsers = users.filter(user =>
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.organizationName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 mt-2">System overview and user management</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={loadAdminData}
              variant="outline"
              className="border-slate-600 hover:bg-slate-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* System Health Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="glass border-blue-500/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Users</p>
                  <p className="text-2xl font-bold text-white">
                    {metrics.totalDistributors + metrics.totalRetailers}
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </Card>

            <Card className="glass border-green-500/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total GMV</p>
                  <p className="text-2xl font-bold text-white">
                    KSh {metrics.totalGMV.toLocaleString()}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
            </Card>

            <Card className="glass border-purple-500/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Orders</p>
                  <p className="text-2xl font-bold text-white">
                    {metrics.totalOrders.toLocaleString()}
                  </p>
                </div>
                <ShoppingCart className="w-8 h-8 text-purple-400" />
              </div>
            </Card>

            <Card className="glass border-orange-500/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Growth Rate</p>
                  <p className="text-2xl font-bold text-white">
                    +{metrics.monthlyGrowth}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-400" />
              </div>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl bg-slate-800 border border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-slate-700">
              Users
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-slate-700">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-slate-700">
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass border-slate-700 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">System Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Database Health</span>
                    <span className="text-green-400 font-semibold">Healthy</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Active Users</span>
                    <span className="text-blue-400 font-semibold">{metrics?.activeUsers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Pending Settlements</span>
                    <span className="text-orange-400 font-semibold">{metrics?.pendingSettlements}</span>
                  </div>
                </div>
              </Card>

              <Card className="glass border-slate-700 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button
                    onClick={() => exportData('users')}
                    className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Users
                  </Button>
                  <Button
                    onClick={() => exportData('orders')}
                    className="w-full justify-start bg-green-600 hover:bg-green-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Orders
                  </Button>
                  <Button
                    onClick={() => exportData('settlements')}
                    className="w-full justify-start bg-purple-600 hover:bg-purple-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Settlements
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            {/* Search and Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>

            {/* Users Table */}
            <Card className="glass border-slate-700">
              <ScrollArea className="h-96">
                <div className="p-6">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-slate-300 font-semibold py-3">User</th>
                        <th className="text-left text-slate-300 font-semibold py-3">Role</th>
                        <th className="text-left text-slate-300 font-semibold py-3">Status</th>
                        <th className="text-left text-slate-300 font-semibold py-3">Orders</th>
                        <th className="text-left text-slate-300 font-semibold py-3">GMV</th>
                        <th className="text-right text-slate-300 font-semibold py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="border-b border-slate-800">
                          <td className="py-4">
                            <div>
                              <p className="text-white font-medium">{user.displayName}</p>
                              <p className="text-slate-400 text-sm">{user.email}</p>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              user.role === 'distributor' 
                                ? 'bg-purple-500/20 text-purple-300' 
                                : 'bg-blue-500/20 text-blue-300'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              user.status === 'active'
                                ? 'bg-green-500/20 text-green-300'
                                : user.status === 'suspended'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-yellow-500/20 text-yellow-300'
                            }`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="py-4 text-slate-300">{user.totalOrders || 0}</td>
                          <td className="py-4 text-slate-300">
                            KSh {(user.totalGMV || 0).toLocaleString()}
                          </td>
                          <td className="py-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUserAction('suspend', user.id)}>
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                  Suspend
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleUserAction('delete', user.id)}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card className="glass border-slate-700 p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Analytics Dashboard</h3>
              <p className="text-slate-400">Advanced analytics and reporting features coming soon.</p>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <Card className="glass border-slate-700">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Recent Activity</h3>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="border-b border-slate-800 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">{log.action}</span>
                          <span className="text-slate-400 text-sm">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-300 text-sm">{log.details}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          {log.userEmail} • {log.ipAddress}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}