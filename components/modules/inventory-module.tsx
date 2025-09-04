"use client"

import { Package, AlertTriangle, TrendingUp, Plus } from "lucide-react"

const inventory = [
  { id: "1", name: "Coca Cola 500mL", stock: 24, minStock: 10, price: 60, status: "good" },
  { id: "2", name: "Bread White", stock: 3, minStock: 10, price: 45, status: "low" },
  { id: "3", name: "Sugar 2kg", stock: 0, minStock: 5, price: 180, status: "out" },
  { id: "4", name: "Milk 1L", stock: 15, minStock: 8, price: 85, status: "good" },
  { id: "5", name: "Rice 2kg", stock: 12, minStock: 6, price: 220, status: "good" },
  { id: "6", name: "Cooking Oil 1L", stock: 2, minStock: 8, price: 150, status: "low" },
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

      {/* Inventory Table */}
      <div className="glass rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-200">Inventory Items</h3>
          <button className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30 hover:bg-green-500/30 transition-colors">
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Item</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Stock</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Min Stock</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Price</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="text-sm font-medium text-slate-200">{item.name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm font-mono text-slate-200">{item.stock}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm font-mono text-slate-400">{item.minStock}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm font-mono text-green-400">KSh {item.price}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div
                      className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${getStatusColor(item.status)}`}
                    >
                      {getStatusIcon(item.status)}
                      <span className="capitalize">{item.status}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      <button className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-xs border border-blue-500/30 hover:bg-blue-500/30 transition-colors">
                        Edit
                      </button>
                      {(item.status === "low" || item.status === "out") && (
                        <button className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/30 hover:bg-green-500/30 transition-colors">
                          Restock
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
