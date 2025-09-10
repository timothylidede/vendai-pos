'use client'

import { useState } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { ScanBarcode, ShoppingCart, Trash2, Plus, ChevronDown, X, Search } from 'lucide-react'
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
  <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Header */}
  <div className="bg-slate-950">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-4">
              <motion.button 
                type="button"
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(16,185,129,0.18)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className={`font-medium px-4 py-2 rounded-lg transition-colors ${activeTab === 'register' ? 'text-white bg-green-600' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setActiveTab('register')}
              >
                Register
              </motion.button>
              <motion.button 
                type="button"
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(16,185,129,0.18)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className={`font-medium px-4 py-2 rounded-lg transition-colors ${activeTab === 'orders' ? 'text-white bg-green-600' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                onClick={() => setActiveTab('orders')}
              >
                Orders
              </motion.button>
            </div>
            <div className="flex items-center space-x-2 ml-8">
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
            <div className="flex items-center space-x-1 ml-4">
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
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Input 
                placeholder="Search products..." 
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pr-8 w-64"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400">
                <Search className="w-4 h-4" />
              </div>
            </div>
            <ScanBarcode className="w-5 h-5 text-white cursor-pointer hover:text-slate-300" />
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              ☰
            </Button>
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
        <div className="flex flex-1 overflow-hidden">
          {/* Left Side - Cart */}
          <div className="w-1/3 border-r border-slate-800 bg-slate-900/50 backdrop-blur">
            <div className="h-full flex flex-col">
              {/* Cart Items */}
              <div className="flex-1 p-6 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <div className="text-center">
                      <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                      <p>Start adding products</p>
                    </div>
                  </div>
                ) : (
                  cart.map((item, i) => (
                    <div key={i} className="flex justify-between items-center mb-4 p-3 bg-slate-800/50 rounded-lg">
                      <div>
                        <div className="font-medium text-white">{item.name}</div>
                        <div className="text-sm text-slate-400">${item.price}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setCart(prev => prev.map((p, idx) => 
                            idx === i ? { ...p, quantity: p.quantity - 1 } : p
                          ).filter(p => p.quantity > 0))
                        }}>-</Button>
                        <span className="text-white">{item.quantity}</span>
                        <Button variant="outline" size="sm" onClick={() => {
                          setCart(prev => prev.map((p, idx) => 
                            idx === i ? { ...p, quantity: p.quantity + 1 } : p
                          ))
                        }}>+</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Total */}
              {cart.length > 0 && (
                <div className="p-6 border-t border-slate-800 mt-auto">
                  <div className="flex justify-between mb-4 text-white">
                    <span>Subtotal</span>
                    <span>${cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-6 text-white">
                    <span>Tax (10%)</span>
                    <span>${(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 0.1).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold mb-6 text-white">
                    <span>Total</span>
                    <span>${(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 1.1).toFixed(2)}</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(16,185,129,0.18)' }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="w-full bg-green-600 text-white font-semibold text-lg py-3 rounded-lg mt-4"
                  >
                    Complete Order
                  </motion.button>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Product Grid */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <div className="p-6">
                <div className="grid grid-cols-5 gap-3">
                  {/* Sample Products */}
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.04, backgroundColor: 'rgba(16,185,129,0.10)' }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className="p-3 cursor-pointer bg-slate-900 border-slate-700 hover:bg-slate-800 transition-colors"
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
                      <div className="aspect-square bg-slate-800 rounded-lg mb-2"></div>
                      <div className="text-sm font-medium text-white">Product {i + 1}</div>
                      <div className="text-sm text-green-400">$99.99</div>
                    </motion.div>
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
            <div className="bg-slate-900 px-6 py-4">
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