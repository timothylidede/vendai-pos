'use client'

import { useState } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { ScanBarcode, ShoppingCart, Trash2, Plus, ChevronDown, X, Search, Package } from 'lucide-react'
import { motion } from 'framer-motion'

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
  const [headerCollapsed, setHeaderCollapsed] = useState(true);
  const [cart, setCart] = useState<Product[]>([])
  const [activeTab, setActiveTab] = useState<'register' | 'orders'>('register')
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState('045')

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

  const availableOrderNumbers = ['040', '041', '042', '043', '044', '045']

  const addNewOrder = () => {
    const nextNumber = String(parseInt(selectedOrder) + 1).padStart(3, '0')
    setSelectedOrder(nextNumber)
    // Here you would typically add logic to create a new order
  }

  return (
  <div className="flex flex-col h-[calc(100vh-2.5rem)] bg-slate-900 overflow-hidden">
      {/* Header */}
  <div className="bg-slate-900/40 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 p-1 backdrop-blur-md bg-gradient-to-r from-white/[0.08] to-white/[0.04] border border-white/[0.08] rounded-xl shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)]">
              <button
                type="button"
                className={`px-4 py-2 font-semibold text-base rounded-lg transition-all duration-300 relative
                  ${activeTab === 'register' 
                    ? 'text-green-400 backdrop-blur-md bg-gradient-to-r from-green-500/[0.15] to-green-500/[0.08] border border-green-500/30 shadow-[0_4px_16px_-8px_rgba(34,197,94,0.3)]' 
                    : 'text-slate-200 hover:text-green-400 hover:bg-white/[0.05] backdrop-blur-sm'}`}
                onClick={() => setActiveTab('register')}
              >
                <span className="relative">
                  Register
                  {activeTab === 'register' && (
                    <span className="absolute left-0 right-0 bottom-0 h-1 bg-gradient-to-r from-green-400 via-green-200 to-green-400 rounded-full blur-sm animate-pulse"></span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className={`px-4 py-2 font-semibold text-base rounded-lg transition-all duration-300 relative
                  ${activeTab === 'orders' 
                    ? 'text-green-400 backdrop-blur-md bg-gradient-to-r from-green-500/[0.15] to-green-500/[0.08] border border-green-500/30 shadow-[0_4px_16px_-8px_rgba(34,197,94,0.3)]' 
                    : 'text-slate-200 hover:text-green-400 hover:bg-white/[0.05] backdrop-blur-sm'}`}
                onClick={() => setActiveTab('orders')}
              >
                <span className="relative">
                  Orders
                  {activeTab === 'orders' && (
                    <span className="absolute left-0 right-0 bottom-0 h-1 bg-gradient-to-r from-green-400 via-green-200 to-green-400 rounded-full blur-sm animate-pulse"></span>
                  )}
                </span>
              </button>
            </div>
            {/* Collapsible header items */}
            <div className={`flex items-center space-x-2 ml-8 ${headerCollapsed ? 'hidden' : ''}`}>
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(251,191,36,0.18)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300 }}
                onClick={addNewOrder}
                className="w-6 h-6 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center p-0"
              >
                <Plus className="w-3 h-3 text-white" />
              </motion.button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-400 hover:text-white"
                onClick={() => setShowOrderModal(true)}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
            <div className={`flex items-center space-x-1 ml-4 ${headerCollapsed ? 'hidden' : ''}`}> 
              {availableOrderNumbers.map((num) => (
                <motion.button
                  key={num}
                  whileHover={{ scale: 1.08, backgroundColor: 'rgba(16,185,129,0.18)' }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  type="button"
                  className={`px-3 py-1 text-sm rounded ${selectedOrder === num ? 'bg-green-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => setSelectedOrder(num)}
                >
                  {num}
                </motion.button>
              ))}
            </div>
            <button
              type="button"
              className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-green-400/30 transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(34,197,94,0.2)] hover:scale-105 flex items-center justify-center"
              aria-label="Toggle order header items"
              onClick={() => setHeaderCollapsed(v => !v)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.03] via-transparent to-emerald-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <ShoppingCart className={`relative w-5 h-5 text-green-400 group-hover:text-green-300 transition-all duration-300 ${headerCollapsed ? '' : 'rotate-90'}`} />
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Input 
                placeholder="Search products..." 
                className="bg-gradient-to-r from-white/[0.08] to-white/[0.04] backdrop-blur-md border border-white/[0.08] hover:border-white/[0.15] text-white placeholder-slate-400 pr-8 w-64 transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] focus:shadow-[0_8px_24px_-8px_rgba(59,130,246,0.2)] focus:border-blue-400/30"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <div className="w-8 h-8 rounded-lg backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                  <Search className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            </div>
            <button className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <ScanBarcode className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
            </button>
            <button className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-pink-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <span className="relative text-slate-300 group-hover:text-white transition-colors duration-300 font-medium">☰</span>
            </button>
          </div>
        </div>
      </div>

      {/* Order Selection Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="bg-slate-900 rounded-lg p-6 max-w-2xl w-full mx-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Choose an order</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowOrderModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="grid grid-cols-6 gap-2 mb-6">
              {availableOrderNumbers.map((num) => (
                <motion.button
                  key={num}
                  whileHover={{ scale: 1.08, backgroundColor: 'rgba(16,185,129,0.18)' }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  type="button"
                  className={`h-12 ${selectedOrder === num ? 'bg-green-600 text-white border-green-600' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'}`}
                  onClick={() => {
                    setSelectedOrder(num);
                    setShowOrderModal(false);
                  }}
                >
                  {num}
                </motion.button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileHover={{ scale: 1.08, backgroundColor: 'rgba(16,185,129,0.18)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300 }}
                type="button"
                className="h-12 bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800"
              >
                046
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.08, backgroundColor: 'rgba(16,185,129,0.18)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300 }}
                type="button"
                className="h-12 bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800"
              >
                047
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {activeTab === 'register' ? (
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Side - Cart (Cyclic Wheel) */}
          <div className="w-1/3 bg-slate-900/30 backdrop-blur-sm">
            <div className="h-full flex flex-col">
              {/* Cart Wheel */}
              <div className="flex-1 relative overflow-hidden cyclic-wheel">
                {cart.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <div className="text-center">
                      <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                      <p>Start adding products</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full relative">
                    {/* Selection indicator */}
                    <div className="absolute top-1/2 left-0 right-0 h-16 -mt-8 bg-green-500/20 border-y-2 border-green-500/40 z-10 pointer-events-none" />
                    
                    {/* Scrollable wheel */}
                    <div className="h-full overflow-y-auto thin-scroll wheel-scroll py-32 picker-wheel">
                      {/* Add spacer items for infinite scroll effect */}
                      {[...Array(3)].map((_, spacerIndex) => (
                        <div key={`spacer-top-${spacerIndex}`} className="h-16" />
                      ))}
                      
                      {/* Duplicate items for circular effect */}
                      {[...cart, ...cart, ...cart].map((item, i) => {
                        const originalIndex = i % cart.length;
                        return (
                          <motion.div 
                            key={`${originalIndex}-${Math.floor(i / cart.length)}`}
                            className="h-16 flex items-center px-4 cursor-pointer transition-all duration-300 hover:bg-slate-800/50 wheel-item picker-item"
                            whileHover={{ scale: 1.02, x: 4 }}
                          >
                            <div className="flex justify-between items-center w-full">
                              <div className="flex-1">
                                <div className="font-medium text-white text-sm truncate">{item.name}</div>
                                <div className="text-xs text-slate-400">KSh {item.price}</div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-xs"
                                  onClick={() => {
                                    setCart(prev => prev
                                      .map((p, idx) => idx === originalIndex ? { ...p, quantity: p.quantity - 1 } : p)
                                      .filter(p => p.quantity > 0)
                                    );
                                  }}
                                >-</Button>
                                <span className="text-white text-sm w-6 text-center">{item.quantity}</span>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-xs"
                                  onClick={() => {
                                    setCart(prev => prev.map((p, idx) => 
                                      idx === originalIndex ? { ...p, quantity: p.quantity + 1 } : p
                                    ))
                                  }}
                                >+</Button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                      
                      {/* Add spacer items for infinite scroll effect */}
                      {[...Array(3)].map((_, spacerIndex) => (
                        <div key={`spacer-bottom-${spacerIndex}`} className="h-16" />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cart Total */}
              {cart.length > 0 && (
                <div className="sticky bottom-0 p-6 bg-slate-900/70 backdrop-blur">
                  <div className="flex justify-between text-lg font-semibold mb-4 text-white">
                    <span>Total</span>
                    <span>KSh {cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(16,185,129,0.18)' }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="w-full bg-gradient-to-r from-green-300 via-green-400 to-slate-800 text-white font-semibold text-lg py-3 rounded-lg"
                  >
                    Complete Order
                  </motion.button>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Product Grid */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto thin-scroll">
              <div className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                  {/* Sample Products */}
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.08, y: -8 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                      className="group relative rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-transparent border border-white/[0.08] hover:border-green-400/40 transition-all duration-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_48px_-12px_rgba(34,197,94,0.2)] cursor-pointer hover:-rotate-1"
                      onClick={() => {
                        const existingItem = cart.find(item => item.name === `Product ${i + 1}`)
                        if (existingItem) {
                          setCart(prev => prev.map(item => 
                            item.name === `Product ${i + 1}` 
                              ? { ...item, quantity: item.quantity + 1 }
                              : item
                          ))
                        } else {
                          setCart(prev => [...prev, { name: `Product ${i + 1}`, price: 99.99, quantity: 1 }])
                        }
                      }}
                    >
                      {/* Glassmorphic background overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.03] via-transparent to-emerald-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      
                      <div className="aspect-square w-full bg-gradient-to-br from-slate-800/60 to-slate-700/40 flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.02] via-transparent to-green-600/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <Package className="w-16 h-16 text-slate-400 group-hover:scale-125 group-hover:text-green-300 group-hover:rotate-12 transition-all duration-500 relative z-10" />
                        
                        {/* Floating add indicator */}
                        <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gradient-to-br from-green-400/20 to-green-500/30 border border-green-400/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                          <Plus className="w-4 h-4 text-green-300" />
                        </div>
                      </div>
                      
                      <div className="p-4 relative">
                        <h4 className="text-slate-200 font-medium text-sm group-hover:text-white transition-colors duration-300">Product {i + 1}</h4>
                        <div className="mt-2 flex items-center justify-between opacity-60 group-hover:opacity-100 transition-all duration-500 transform translate-y-1 group-hover:translate-y-0">
                          <span className="text-green-400 font-semibold text-sm">KSh 99.99</span>
                          <span className="text-xs text-slate-400 group-hover:text-slate-300 px-2 py-1 rounded-full bg-slate-700/50 border border-slate-600/50">
                            In Stock
                          </span>
                        </div>
                      </div>
                      
                      {/* Top highlight line */}
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-200/5 to-transparent transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Orders View */
  <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Orders List */}
          <div className="flex-1 flex flex-col">
            {/* Orders Header */}
            <div className="bg-blue-900/40 backdrop-blur-sm px-6 py-4 border-b border-green-500/30">
              <div className="flex items-center justify-between">
                <div className="relative flex-1 max-w-lg">
                  <Input 
                    placeholder="Search Orders..." 
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pl-10"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-center space-x-4">
                  <Button variant="outline" size="sm" className="text-slate-300 border-slate-600">
                    Active <ChevronDown className="w-4 h-4 ml-1" />
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
            <div className="flex-1 overflow-y-auto thin-scroll">
              {sampleOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between px-6 py-4 border-b border-green-500/30 hover:bg-slate-800/50 cursor-pointer">
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
          <div className="w-1/3 border-l border-green-500/30 bg-blue-900/30 backdrop-blur-sm flex items-center justify-center">
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