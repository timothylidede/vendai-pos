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
    hoverColor: 'hover:text-green-300',
    bgGradient: 'from-green-500/[0.03] via-transparent to-green-500/[0.02]',
    borderColor: 'border-green-500/30',
    hoverBorderColor: 'hover:border-green-400/50',
    shadowColor: 'hover:shadow-[0_20px_48px_-12px_rgba(34,197,94,0.15)]'
  },
  {
    title: 'Inventory',
    description: 'Track stock and orders',
    icon: Package,
    color: 'text-blue-400',
    hoverColor: 'hover:text-blue-300',
    bgGradient: 'from-blue-500/[0.03] via-transparent to-blue-500/[0.02]',
    borderColor: 'border-blue-500/30',
    hoverBorderColor: 'hover:border-blue-400/50',
    shadowColor: 'hover:shadow-[0_20px_48px_-12px_rgba(59,130,246,0.15)]'
  },
  {
    title: 'Suppliers',
    description: 'Manage procurement',
    icon: HeartHandshake,
    color: 'text-purple-400',
    hoverColor: 'hover:text-purple-300',
    bgGradient: 'from-purple-500/[0.03] via-transparent to-purple-500/[0.02]',
    borderColor: 'border-purple-500/30',
    hoverBorderColor: 'hover:border-purple-400/50',
    shadowColor: 'hover:shadow-[0_20px_48px_-12px_rgba(168,85,247,0.15)]'
  }
]

export function ModulesDashboard() {
  const [showChatbot, setShowChatbot] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const router = useRouter();
  
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
          <button className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] via-transparent to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
            <Bell className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
          </button>
          <button className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
            <Settings className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
          </button>
          <button className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-pink-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
            <UserCircle className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
          </button>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="flex flex-col items-center mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 max-w-6xl w-full place-items-center">
          {modules.map((module, index) => {
            const Icon = module.icon
            return (
              <motion.div
                key={index}
                className="w-full min-w-[320px] max-w-sm h-[240px]"
                whileHover={{ 
                  y: -12,
                  scale: 1.02,
                  transition: { duration: 0.3, ease: "easeOut" }
                }}
                onClick={() => {
                  if (module.title === 'Point of Sale') {
                    router.push('/modules/pos')
                  } else if (module.title === 'Inventory') {
                    router.push('/modules/inventory')
                  } else if (module.title === 'Suppliers') {
                    router.push('/modules/suppliers')
                  }
                }}
              >
                <div 
                  className={`group relative rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-transparent border border-white/[0.08] ${module.hoverBorderColor} transition-all duration-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] ${module.shadowColor} cursor-pointer h-full`}
                >
                  {/* Glassmorphic background overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${module.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  
                  <div className="relative flex flex-col items-center justify-center h-full space-y-6 p-8">
                    {/* Icon Container */}
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)]">
                        <Icon className={`w-10 h-10 ${module.color} ${module.hoverColor} transition-all duration-500`} 
                              style={{
                                filter: `drop-shadow(0 4px 8px ${
                                  module.color === 'text-green-400' ? 'rgba(34, 197, 94, 0.4)' :
                                  module.color === 'text-blue-400' ? 'rgba(59, 130, 246, 0.4)' :
                                  'rgba(168, 85, 247, 0.4)'
                                }) drop-shadow(0 2px 4px ${
                                  module.color === 'text-green-400' ? 'rgba(34, 197, 94, 0.2)' :
                                  module.color === 'text-blue-400' ? 'rgba(59, 130, 246, 0.2)' :
                                  'rgba(168, 85, 247, 0.2)'
                                }) drop-shadow(0 0 12px ${
                                  module.color === 'text-green-400' ? 'rgba(34, 197, 94, 0.3)' :
                                  module.color === 'text-blue-400' ? 'rgba(59, 130, 246, 0.3)' :
                                  'rgba(168, 85, 247, 0.3)'
                                }) drop-shadow(0 0 24px ${
                                  module.color === 'text-green-400' ? 'rgba(34, 197, 94, 0.15)' :
                                  module.color === 'text-blue-400' ? 'rgba(59, 130, 246, 0.15)' :
                                  'rgba(168, 85, 247, 0.15)'
                                })`
                              }} />
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="text-center">
                      <h3 className={`text-xl font-bold ${module.color} ${module.hoverColor} transition-colors duration-300 tracking-tight`}>
                        {module.title}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Top highlight line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
