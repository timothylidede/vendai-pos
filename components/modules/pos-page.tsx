'use client'

import { useState } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'

interface Product {
  name: string
  price: number
  quantity: number
}

export function POSPage() {
  const [cart, setCart] = useState<Product[]>([])
  const [showChatbot, setShowChatbot] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)

  const toggleBot = () => {
    setIsSpinning(true)
    setShowChatbot(prev => !prev)
    setTimeout(() => setIsSpinning(false), 2000)
  }

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Left Side - Product Grid */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-4 gap-4">
          {/* Sample Products */}
          {Array.from({ length: 12 }).map((_, i) => (
            <Card 
              key={i} 
              className="p-4 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={() => setCart(prev => [...prev, { name: `Product ${i + 1}`, price: 99.99, quantity: 1 }])}
            >
              <div className="aspect-square bg-slate-800 rounded-lg mb-2"></div>
              <div className="text-sm font-medium">Product {i + 1}</div>
              <div className="text-sm text-slate-400">$99.99</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Right Side - Cart */}
      <div className="w-1/3 border-l border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="h-full flex flex-col">
          {/* Cart Header */}
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-semibold">Current Order</h2>
          </div>

          {/* Cart Items */}
          <ScrollArea className="flex-1 p-6">
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
          </ScrollArea>

          {/* Cart Total */}
          <div className="p-6 border-t border-slate-800">
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

      {/* Bot Assistant Button and Chatbot */}
      <div className="fixed bottom-6 right-6 z-[9999] flex items-end gap-4">
        {showChatbot && (
          <div className="slide-in-right bg-slate-800/95 backdrop-blur-md p-4 rounded-lg border-2 border-slate-600 shadow-2xl w-80">
            <div className="text-slate-200 font-mono text-sm mb-2">AI Assistant</div>
            <div className="bg-slate-900/50 rounded p-3 text-slate-300 text-sm">
              How can I help you with your order?
            </div>
          </div>
        )}
        
        <button
          onClick={toggleBot}
          style={{ touchAction: 'manipulation' }}
          className={`p-4 rounded-full bg-slate-800 shadow-2xl border-2 border-slate-600 hover:bg-slate-700 transition-all duration-200 transform hover:scale-110 active:scale-95 focus:outline-none
            ${isSpinning ? 'animate-spin-continuous' : ''}`}
        >
          <img 
            src="/images/logo-icon-remove.png"
            alt="AI Assistant"
            className="w-10 h-10 object-contain"
          />
        </button>
      </div>
    </div>
  )
}
