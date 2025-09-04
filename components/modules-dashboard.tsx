'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from './ui/card'
import { 
  ShoppingCart, Package, HeartHandshake,
  ArrowRightCircle, Bell,
  Settings, UserCircle
} from 'lucide-react'
import { motion } from 'framer-motion'

const modules = [
  {
    title: 'Point of Sale',
    description: 'Process sales and payments',
    icon: ShoppingCart,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30'
  },
  {
    title: 'Inventory',
    description: 'Track stock and orders',
    icon: Package,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30'
  },
  {
    title: 'Suppliers',
    description: 'Manage procurement',
    icon: HeartHandshake,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30'
  }
]

export function ModulesDashboard() {
  const [showChatbot, setShowChatbot] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  
  const toggleBot = useCallback(() => {
    setIsSpinning(true);
    setShowChatbot(prev => !prev);
    setTimeout(() => setIsSpinning(false), 2000);
  }, []);

  return (
    <div className="flex-1 p-6 relative min-h-screen overflow-hidden">
      {/* Header */}
      <div className="flex justify-end mb-12">
        <div className="flex items-center space-x-4">
          <button className="text-slate-400 hover:text-slate-300 transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <button className="text-slate-400 hover:text-slate-300 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <button className="text-slate-400 hover:text-slate-300 transition-colors">
            <UserCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="flex flex-col items-center mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl w-full place-items-center">
          {modules.map((module, index) => {
            const Icon = module.icon
            const router = useRouter()
            return (
              <motion.div
                key={index}
                className="w-full min-w-[280px] max-w-sm h-[200px]"
                whileHover={{ 
                  y: -8,
                  transition: { duration: 0.2 }
                }}
                onClick={() => {
                  if (module.title === 'Point of Sale') {
                    router.push('/modules/pos')
                  }
                }}
              >
                <Card 
                  className={`glass rounded-lg border-2 ${module.borderColor} group cursor-pointer
                    backdrop-blur-md h-full font-mono
                    transition-all duration-300
                    hover:border-[3px]
                    ${module.color === 'text-green-400' ? 'hover:border-green-400 hover:bg-green-500/10' : 
                      module.color === 'text-blue-400' ? 'hover:border-blue-400 hover:bg-blue-500/10' : 
                      'hover:border-purple-400 hover:bg-purple-500/10'}`}
                >
                  <div className="flex flex-col items-center justify-center h-full space-y-5 font-mono">
                    <Icon className={`w-12 h-12 ${module.color}`} />
                    <h3 className={`text-lg ${module.color} font-mono`}>{module.title}</h3>
                    <ArrowRightCircle className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors absolute bottom-4 right-4" />
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

  {/* Local bot removed: VendaiPanel provides the assistant button centrally */}
    </div>
  )
}
