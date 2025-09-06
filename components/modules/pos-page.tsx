'use client'

import { useState } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { BarChart3, ShoppingCart, Trash2 } from 'lucide-react'

interface Product {
  name: string
  price: number
  quantity: number
}

interface Order {
  id: string
  number: string
  date: string
  time: string
  amount: string
  status: 'Ongoing' | 'Payment'
}

export function POSPage() {
  const [cart, setCart] = useState<Product[]>([])
  const [activeTab, setActiveTab] = useState<'register' | 'orders'>('register')

  const sampleOrders: Order[] = [
    { id: '004', number: '2504-001-00004', date: '09/04/2025', time: '11:55', amount: '0.00 KSh', status: 'Ongoing' },
    { id: '006', number: '2504-001-00006', date: '09/04/2025', time: '11:56', amount: '81.20 KSh', status: 'Payment' },
    { id: '008', number: '2510-001-00008', date: '09/04/2025', time: '11:57', amount: '0.00 KSh', status: 'Ongoing' },
    { id: '009', number: '2525-001-00009', date: '09/04/2025', time: '11:22', amount: '0.00 KSh', status: 'Ongoing' },
    { id: '010', number: '2534-001-00010', date: 'Today', time: '01:14', amount: '0.00 KSh', status: 'Ongoing' },
    { id: '011', number: '2534-001-00011', date: 'Today', time: '01:14', amount: '0.00 KSh', status: 'Ongoing' },
    { id: '012', number: '2534-001-00012', date: 'Today', time: '01:14', amount: '0.00 KSh', status: 'Ongoing' },
    { id: '013', number: '2534-001-00013', date: 'Today', time: '01:14', amount: '0.00 KSh', status: 'Ongoing' },
    { id: '014', number: '2534-001-00014', date: 'Today', time: '01:14', amount: '0.00 KSh', status: 'Ongoing' },
    { id: '015', number: '2534-001-00015', date: 'Today', time: '01:14', amount: '0.00 KSh', status: 'Ongoing' },
  ]

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                className={`font-medium ${activeTab === 'register' ? 'text-white' : 'text-slate-400'}`}
                onClick={() => setActiveTab('register')}
              >
                Register
              </Button>
              <Button 
                variant="ghost" 
                className={`font-medium ${activeTab === 'orders' ? 'text-white' : 'text-slate-400'}`}
                onClick={() => setActiveTab('orders')}
              >
                Orders
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">⚪</span>
              </div>
              <Button variant="ghost" size="sm" className="text-slate-400">
                ▼
              </Button>
            </div>
            <div className="flex items-center space-x-1">
              {['004', '006', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020'].map((num) => (
                <Button key={num} variant="ghost" size="sm" className="text-slate-400 px-3 py-1 text-sm">
                  {num}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Input 
                placeholder="Search..." 
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pr-8"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400">
                🔍
              </div>
            </div>
            <BarChart3 className="w-5 h-5 text-white cursor-pointer" />
            <Button variant="ghost" size="sm" className="text-slate-400">
              ☰
            </Button>
          </div>
        </div>
      </div>

      {activeTab === 'register' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Side - Cart */}
          <div className="w-1/3 border-r border-slate-800 bg-slate-900/50 backdrop-blur">
            <div className="h-full flex flex-col">
              {/* Cart Items */}
              <div className="flex-1 p-6 overflow-y-auto">
                {cart.map((item, i) => (
                  <div key={i} className="flex justify-between items-center mb-4 p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-slate-400">${item.price}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setCart(prev => prev.map((p, idx) => 
                          idx === i ? { ...p, quantity: p.quantity - 1 } : p
                        ).filter(p => p.quantity > 0))
                      }}>-</Button>
                      <span>{item.quantity}</span>
                      <Button variant="outline" size="sm" onClick={() => {
                        setCart(prev => prev.map((p, idx) => 
                          idx === i ? { ...p, quantity: p.quantity + 1 } : p
                        ))
                      }}>+</Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart Total */}
              <div className="p-6 border-t border-slate-800 mt-auto">
                <div className="flex justify-between mb-4">
                  <span>Subtotal</span>
                  <span>${cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-6">
                  <span>Tax (10%)</span>
                  <span>${(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 0.1).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold mb-6">
                  <span>Total</span>
                  <span>${(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 1.1).toFixed(2)}</span>
                </div>
                <Button className="w-full" size="lg">
                  Complete Order
                </Button>
              </div>
            </div>
          </div>

          {/* Right Side - Product Grid */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <div className="p-6">
                <div className="grid grid-cols-5 gap-3">
                  {/* Sample Products */}
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Card 
                      key={i} 
                      className="p-3 cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => setCart(prev => [...prev, { name: `Product ${i + 1}`, price: 99.99, quantity: 1 }])}
                    >
                      <div className="aspect-square bg-slate-800 rounded-lg mb-2"></div>
                      <div className="text-sm font-medium">Product {i + 1}</div>
                      <div className="text-sm text-slate-400">$99.99</div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Orders View */
        <div className="flex flex-1 overflow-hidden">
          {/* Orders List */}
          <div className="flex-1 flex flex-col">
            {/* Orders Header */}
            <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="relative flex-1 max-w-lg">
                  <Input 
                    placeholder="Search Orders..." 
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pl-10"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                    🔍
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Button variant="outline" size="sm" className="text-slate-300">
                    Active ▼
                  </Button>
                  <span className="text-slate-400">1-30 / 34</span>
                  <div className="flex items-center space-x-1">
                    <Button variant="ghost" size="sm" className="text-slate-400">◀</Button>
                    <Button variant="ghost" size="sm" className="text-slate-400">▶</Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Orders Content */}
            <div className="flex-1 overflow-y-auto">
              {sampleOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between px-6 py-4 border-b border-slate-700 hover:bg-slate-800/50 cursor-pointer">
                  <div className="flex items-center space-x-6">
                    <div className="text-left">
                      <div className="text-slate-300 text-sm">{order.date}</div>
                      <div className="text-slate-400 text-xs">{order.time}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-white font-medium">{order.id}</div>
                      <div className="text-slate-400 text-sm">{order.number}</div>
                    </div>
                  </div>
                  <div className="text-white font-medium">
                    {order.amount}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded text-sm ${
                      order.status === 'Payment' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-blue-600 text-white'
                    }`}>
                      {order.status}
                    </span>
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Order Selection */}
          <div className="w-1/3 border-l border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-center">
            <div className="text-center text-slate-400">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <p className="text-lg">Select an order or scan QR code</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}