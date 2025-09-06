"use client"

import { Package, AlertTriangle, TrendingUp, Plus, LayoutGrid, List } from "lucide-react"

const inventory = [
  { 
    id: "1", 
    name: "Acoustic Bloc Screens", 
    sku: "E-COM11",
    variants: 2,
    stock: 24, 
    minStock: 10, 
    price: 295.00, 
    status: "good" 
  },
  { 
    id: "2", 
    name: "Cabinet with Doors", 
    sku: "FURN_7800",
    variants: 2,
    stock: 3, 
    minStock: 10, 
    price: 140.00, 
    status: "low" 
  },
  { 
    id: "3", 
    name: "Conference Chair", 
    sku: "FURN_1118",
    variants: 1,
    stock: 0, 
    minStock: 5, 
    price: 33.00, 
    status: "out" 
  },
  { 
    id: "4", 
    name: "Corner Desk Left Sit", 
    sku: "FURN_0001",
    variants: 1,
    stock: 15, 
    minStock: 8, 
    price: 85.00, 
    status: "good" 
  }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "good":
      return "text-green-400 bg-green-500/20 border-green-500/30"
    case "low":
      return "text-orange-400 bg-orange-500/20 border-orange-500/30"
    case "out":
      return "text-red-400 bg-red-500/20 border-red-500/30"
    default:
      return "text-slate-400 bg-slate-500/20 border-slate-500/30"
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "good":
      return <TrendingUp className="w-4 h-4" />
    case "low":
      return <AlertTriangle className="w-4 h-4" />
    case "out":
      return <AlertTriangle className="w-4 h-4" />
    default:
      return <Package className="w-4 h-4" />
  }
}

export function InventoryModule() {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-lg p-4 border border-green-500/30 bg-green-500/20">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-5 h-5 text-green-400" />
            <span className="text-2xl font-bold text-green-400">
              {inventory.filter((item) => item.status === "good").length}
            </span>
          </div>
          <div className="text-sm text-slate-200">Items in Stock</div>
        </div>

        <div className="glass rounded-lg p-4 border border-orange-500/30 bg-orange-500/20">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <span className="text-2xl font-bold text-orange-400">
              {inventory.filter((item) => item.status === "low").length}
            </span>
          </div>
          <div className="text-sm text-slate-200">Low Stock Items</div>
        </div>

        <div className="glass rounded-lg p-4 border border-red-500/30 bg-red-500/20">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-2xl font-bold text-red-400">
              {inventory.filter((item) => item.status === "out").length}
            </span>
          </div>
          <div className="text-sm text-slate-200">Out of Stock</div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="glass rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-200">Products</h3>
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30 hover:bg-green-500/30 transition-colors">
              <Plus className="w-4 h-4" />
              <span>New</span>
            </button>
            <div className="flex rounded overflow-hidden border border-slate-600/30">
              <button className="px-3 py-2 bg-slate-700/50 text-slate-300">
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button className="px-3 py-2 bg-slate-700/20 text-slate-300 border-l border-slate-600/30">
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {inventory.map((item) => (
            <div 
              key={item.id} 
              className="border border-slate-700/40 rounded-lg bg-slate-800/20 p-4 hover:border-slate-600/60 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-slate-700/30 rounded flex items-center justify-center">
                  <Package className="w-10 h-10 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-slate-200 font-medium truncate">{item.name}</h4>
                  <div className="text-xs text-slate-400 mt-1">[{item.sku}]</div>
                  <div className="text-xs text-slate-400 mt-1">{item.variants} Variants</div>
                  <div className="text-sm text-green-400 font-mono mt-2">KSh {item.price.toFixed(2)}</div>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${getStatusColor(item.status)}`}>
                  {getStatusIcon(item.status)}
                  <span className="capitalize">{item.status}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-slate-200">{item.stock}</div>
                  <div className="text-xs text-slate-400">On hand</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
