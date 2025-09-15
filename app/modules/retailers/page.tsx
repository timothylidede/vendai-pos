'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Users, Store, MapPin, Phone, Mail, 
  ArrowLeft, Plus, Filter, Search,
  TrendingUp, Package, DollarSign, Clock
} from 'lucide-react'
import Link from 'next/link'

export default function RetailersPage() {
  const [activeTab, setActiveTab] = useState<'partners' | 'orders' | 'analytics'>('partners')

  const retailers = [
    {
      id: 'RET-001',
      name: 'Maina Supermarket',
      location: 'Kiambu',
      contact: 'John Maina',
      phone: '+254 712 345 678',
      email: 'maina@supermarket.ke',
      orders: 15,
      totalValue: 450000,
      status: 'active',
      lastOrder: '2 days ago'
    },
    {
      id: 'RET-002',
      name: 'City Mall',
      location: 'Nairobi CBD',
      contact: 'Sarah Njeri',
      phone: '+254 722 123 456',
      email: 'sarah@citymall.ke',
      orders: 28,
      totalValue: 750000,
      status: 'active',
      lastOrder: '1 day ago'
    },
    {
      id: 'RET-003',
      name: 'Village Store',
      location: 'Nakuru',
      contact: 'Peter Kimani',
      phone: '+254 733 987 654',
      email: 'peter@villagestore.ke',
      orders: 8,
      totalValue: 120000,
      status: 'inactive',
      lastOrder: '2 weeks ago'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/10 border-green-400/20'
      case 'inactive': return 'text-red-400 bg-red-400/10 border-red-400/20'
      case 'pending': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header */}
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
              <p className="text-slate-400">Manage your retail network and partnerships</p>
            </div>
          </div>
          <Button className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Retailer
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="p-6">
        <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg w-fit">
          {[
            { key: 'partners', label: 'Retail Partners', icon: Store },
            { key: 'orders', label: 'Partner Orders', icon: Package },
            { key: 'analytics', label: 'Performance', icon: TrendingUp }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
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

      {/* Content Area */}
      <div className="px-6 pb-8">
        {activeTab === 'partners' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Partners', value: '15', icon: Store, color: 'text-cyan-400' },
                { label: 'Active Partners', value: '12', icon: Users, color: 'text-green-400' },
                { label: 'Monthly Revenue', value: 'KSh 2.1M', icon: DollarSign, color: 'text-blue-400' },
                { label: 'Avg Order Value', value: 'KSh 85K', icon: TrendingUp, color: 'text-purple-400' }
              ].map((stat) => (
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

            {/* Search and Filters */}
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search retailers..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/50"
                />
              </div>
              <Button variant="outline" className="border-slate-700 text-slate-300">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>

            {/* Retailers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {retailers.map((retailer) => (
                <Card key={retailer.id} className="p-6 bg-slate-800/60 border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                      <Store className="w-6 h-6 text-cyan-400" />
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(retailer.status)}`}>
                      {retailer.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-white text-lg mb-1">{retailer.name}</h3>
                  <p className="text-slate-400 text-sm mb-4">{retailer.contact}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-slate-400 text-sm">
                      <MapPin className="w-3 h-3 mr-2" />
                      {retailer.location}
                    </div>
                    <div className="flex items-center text-slate-400 text-sm">
                      <Phone className="w-3 h-3 mr-2" />
                      {retailer.phone}
                    </div>
                    <div className="flex items-center text-slate-400 text-sm">
                      <Mail className="w-3 h-3 mr-2" />
                      {retailer.email}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
                    <div className="text-center">
                      <p className="text-white font-semibold">{retailer.orders}</p>
                      <p className="text-slate-400 text-xs">Orders</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold">KSh {(retailer.totalValue / 1000).toFixed(0)}K</p>
                      <p className="text-slate-400 text-xs">Total Value</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Last Order:</span>
                      <span className="text-slate-300">{retailer.lastOrder}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Partner Orders</h3>
            <p className="text-slate-400 mb-6">Track and manage orders from your retail partners</p>
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-4 h-4 mr-2" />
              View All Orders
            </Button>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="text-center py-20">
            <TrendingUp className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Performance Analytics</h3>
            <p className="text-slate-400 mb-6">Analyze partner performance and business insights</p>
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <TrendingUp className="w-4 h-4 mr-2" />
              View Analytics
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}