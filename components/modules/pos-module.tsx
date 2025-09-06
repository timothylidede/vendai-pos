"use client"

import { useState } from "react"
import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

const products = [
  { id: "1", name: "Coca Cola 500mL", price: 60, stock: 24 },
  { id: "2", name: "Bread White", price: 45, stock: 12 },
  { id: "3", name: "Sugar 2kg", price: 180, stock: 8 },
  { id: "4", name: "Milk 1L", price: 85, stock: 15 },
]

export function POSModule() {
  const [cart, setCart] = useState<CartItem[]>([])

  const addToCart = (product: (typeof products)[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id))
    } else {
      setCart((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)))
    }
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Cart */}
      <div className="glass rounded-lg p-6 flex flex-col">
        <div className="flex items-center space-x-2 mb-4">
          <ShoppingCart className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-slate-200">Cart</h3>
        </div>

        <div className="flex-1 space-y-3 mb-6">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 py-8">Cart is empty</div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-700/50">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">{item.name}</div>
                  <div className="text-xs text-green-400 font-mono">KSh {item.price} each</div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-1 rounded bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
                  >
                    <Minus className="w-3 h-3 text-slate-300" />
                  </button>
                  <span className="text-sm font-mono text-slate-200 w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1 rounded bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
                  >
                    <Plus className="w-3 h-3 text-slate-300" />
                  </button>
                  <button
                    onClick={() => updateQuantity(item.id, 0)}
                    className="p-1 rounded bg-red-500/20 hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-slate-700/50 pt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold text-slate-200">Total</span>
              <span className="text-xl font-bold text-green-400 font-mono">KSh {total.toLocaleString()}</span>
            </div>
            <button className="w-full py-3 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30 hover:bg-green-500/30 transition-colors font-semibold">
              Process Payment
            </button>
          </div>
        )}
      </div>
      
      {/* Products */}
      <div className="glass rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">Products</h3>
        <div className="grid grid-cols-2 gap-4">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="glass-light rounded-lg p-4 text-left hover:bg-slate-600/30 transition-colors border border-slate-600/30"
            >
              <div className="text-sm font-medium text-slate-200 mb-1">{product.name}</div>
              <div className="text-green-400 font-mono font-semibold mb-1">KSh {product.price}</div>
              <div className="text-xs text-slate-400">Stock: {product.stock}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
