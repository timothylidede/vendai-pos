'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Truck, Package, MapPin, Clock, Users, 
  ArrowLeft, Plus, Filter, Search,
  Navigation, Route, CheckCircle, AlertTriangle
} from 'lucide-react'
import Link from 'next/link'

export default function LogisticsPage() {
  const [activeTab, setActiveTab] = useState<'deliveries' | 'routes' | 'drivers'>('deliveries')

  const deliveries = [
    {
      id: 'DEL-001',
      customer: 'Maina Supermarket',
      location: 'Kiambu',
      items: 15,
      value: 25000,
      status: 'in-transit',
      driver: 'Peter Kamau',
      estimatedTime: '2 hours'
    },
    {
      id: 'DEL-002', 
      customer: 'City Mall',
      location: 'Nairobi CBD',
      items: 8,
      value: 45000,
      status: 'delivered',
      driver: 'Mary Wanjiku',
      estimatedTime: 'Completed'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-400 bg-green-400/10 border-green-400/20'
      case 'in-transit': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
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
                <Truck className="w-8 h-8 mr-3 text-orange-400" />
                Logistics Management
              </h1>
              <p className="text-slate-400">Manage deliveries, routes, and drivers</p>
            </div>
          </div>
          <Button className="bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4 mr-2" />
            Schedule Delivery
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="p-6">
        <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg w-fit">
          {[
            { key: 'deliveries', label: 'Active Deliveries', icon: Truck },
            { key: 'routes', label: 'Route Planning', icon: Route },
            { key: 'drivers', label: 'Driver Management', icon: Users }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                activeTab === key
                  ? 'bg-orange-600 text-white shadow-lg'
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
        {activeTab === 'deliveries' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Active Deliveries', value: '12', icon: Truck, color: 'text-orange-400' },
                { label: 'Completed Today', value: '8', icon: CheckCircle, color: 'text-green-400' },
                { label: 'Pending Orders', value: '5', icon: Clock, color: 'text-yellow-400' },
                { label: 'Issues/Delays', value: '2', icon: AlertTriangle, color: 'text-red-400' }
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
                  placeholder="Search deliveries..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-orange-400/50"
                />
              </div>
              <Button variant="outline" className="border-slate-700 text-slate-300">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>

            {/* Deliveries List */}
            <div className="space-y-4">
              {deliveries.map((delivery) => (
                <Card key={delivery.id} className="p-6 bg-slate-800/60 border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                        <Truck className="w-6 h-6 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{delivery.customer}</h3>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="flex items-center text-slate-400 text-sm">
                            <MapPin className="w-3 h-3 mr-1" />
                            {delivery.location}
                          </span>
                          <span className="text-slate-400 text-sm">{delivery.items} items</span>
                          <span className="text-slate-400 text-sm">KSh {delivery.value.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-slate-300 text-sm font-medium">{delivery.driver}</p>
                        <p className="text-slate-400 text-xs">{delivery.estimatedTime}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(delivery.status)}`}>
                        {delivery.status.replace('-', ' ').toUpperCase()}
                      </span>
                      <Button size="sm" variant="outline" className="border-slate-700 text-slate-300">
                        <Navigation className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="text-center py-20">
            <Route className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Route Planning</h3>
            <p className="text-slate-400 mb-6">Optimize delivery routes and manage logistics efficiently</p>
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="w-4 h-4 mr-2" />
              Plan New Route
            </Button>
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Driver Management</h3>
            <p className="text-slate-400 mb-6">Manage your delivery team and track performance</p>
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Driver
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}