"use client"

import { useState } from "react"
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
      return "text-blue-400 bg-blue-500/20 border-blue-500/30"
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
    <div className="space-y-8">
      <h3 className="text-lg font-semibold text-slate-200">Products</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {inventory.map(item => (
          <div
            key={item.id}
            className="group relative rounded-xl overflow-hidden backdrop-blur-md bg-white/5 border border-white/10 hover:border-blue-400/40 transition-all duration-300 shadow-[0_4px_18px_-4px_rgba(0,0,0,0.4)] hover:shadow-[0_6px_28px_-4px_rgba(30,64,175,0.45)] cursor-pointer"
          >
            <div className="aspect-square w-full bg-gradient-to-br from-slate-800/60 to-slate-700/40 flex items-center justify-center">
              <Package className="w-16 h-16 text-slate-500 group-hover:scale-105 group-hover:text-blue-300 transition-transform duration-300" />
            </div>
            <div className="p-3">
              <h4 className="text-slate-200 font-medium text-sm truncate group-hover:text-blue-300 transition-colors">{item.name}</h4>
            </div>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-b from-transparent via-slate-900/10 to-slate-900/30" />
          </div>
        ))}
      </div>
    </div>
  )
}
