'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from './ui/card'
import { 
  ShoppingCart, Package, HeartHandshake,
  ArrowRightCircle, Bell,
  Settings, UserCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Animation variants for the arrow icon to keep motion consistent with card hover
const arrowVariants = {
  initial: { x: 0, opacity: 0.8, transition: { duration: 0 } }, // snap back instantly
  hover: { x: 4, opacity: 1, transition: { type: 'spring' as const, stiffness: 340, damping: 16 } }
}

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
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const router = useRouter();
  const profileRef = useRef<HTMLDivElement>(null);

  // Get org/user context from localStorage
  const org = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('selectedOrg') || 'null') : null;
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('currentUser') || 'null') : null;

  const toggleBot = useCallback(() => {
    setIsSpinning(true);
    setShowChatbot(prev => !prev);
    setTimeout(() => setIsSpinning(false), 2000);
  }, []);

  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    }
    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  function handleLogout() {
    localStorage.removeItem('selectedOrg');
    localStorage.removeItem('currentUser');
    setShowLeaveModal(false);
    router.push('/'); // Redirect to onboarding page
  }

  return (
    <div className="flex-1 p-6 relative min-h-screen overflow-hidden">
      {/* Leave Org Modal */}
      <AnimatePresence>
        {showLeaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="bg-slate-900 rounded-xl shadow-xl p-8 w-full max-w-sm text-center border border-slate-700"
            >
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Logout?</h3>
              <p className="text-slate-400 mb-6">Are you sure you want to logout?</p>
              <div className="flex gap-4 justify-center">
                <button className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-semibold" onClick={handleLogout}>Yes, Logout</button>
                <button className="bg-slate-700 hover:bg-slate-800 text-white px-5 py-2 rounded-lg font-semibold" onClick={() => setShowLeaveModal(false)}>Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="flex justify-end mb-12">
        <div className="flex items-center space-x-3">
          <button className="w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center shadow transition-all border-2 border-red-600 focus:outline-none">
            <Bell className="w-4 h-4 text-white" />
          </button>
          <button className="w-7 h-7 rounded-full bg-yellow-400/80 hover:bg-yellow-400 flex items-center justify-center shadow transition-all border-2 border-yellow-500 focus:outline-none">
            <Settings className="w-4 h-4 text-white" />
          </button>
          <div className="relative">
            <button className={`w-7 h-7 rounded-full bg-green-500/80 hover:bg-green-500 flex items-center justify-center shadow transition-all border-2 border-green-600 focus:outline-none ${showProfileDropdown ? 'ring-2 ring-green-400' : ''}`} onClick={() => setShowProfileDropdown(v => !v)}>
              <UserCircle className="w-4 h-4 text-white" />
            </button>
            <AnimatePresence>
              {showProfileDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-64 bg-slate-900 rounded-xl shadow-xl z-50 border border-slate-700 overflow-hidden"
                >
                  <div className="px-6 py-5 border-b border-slate-800">
                    <div className="font-semibold text-slate-100 text-lg flex items-center gap-2">
                      <UserCircle className="w-6 h-6 text-slate-400" />
                      {user?.displayName || user?.email || 'User'}
                    </div>
                    {org && <div className="text-xs text-slate-400 mt-1">Org: <span className="font-bold">{org.name}</span></div>}
                  </div>
                  <div className="px-6 py-4 flex flex-col gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(220,38,38,0.08)' }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className="w-full text-left px-4 py-3 text-red-500 font-semibold rounded-lg transition-colors"
                      onClick={() => setShowLeaveModal(true)}
                    >
                      Logout
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(30,41,59,0.18)' }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className="w-full text-left px-4 py-3 text-slate-300 font-semibold rounded-lg transition-colors"
                      disabled
                    >
                      Profile (coming soon)
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(30,41,59,0.18)' }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className="w-full text-left px-4 py-3 text-slate-300 font-semibold rounded-lg transition-colors"
                      disabled
                    >
                      Settings (coming soon)
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="flex flex-col items-center mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl w-full place-items-center">
          {modules.map((module, index) => {
            const Icon = module.icon;
            // Set shadow color based on module color
            let shadowColor = 'rgba(66,133,244,0.10)'; // default blue
            if (module.color === 'text-green-400') shadowColor = 'rgba(34,197,94,0.18)'; // green
            if (module.color === 'text-purple-400') shadowColor = 'rgba(168,85,247,0.18)'; // purple

            return (
              <motion.div
                key={index}
                className="w-full min-w-[280px] max-w-sm h-[200px]"
                whileHover={{
                  y: -6,
                  scale: 1.03,
                  boxShadow: `0 4px 24px ${shadowColor}`,
                  rotate: 0.2,
                  transition: { duration: 0.18, type: 'spring', stiffness: 250 }
                }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 250 }}
                onHoverStart={() => setHoveredCard(index)}
                onHoverEnd={() => setHoveredCard(current => (current === index ? null : current))}
                onClick={() => {
                  if (module.title === 'Point of Sale') {
                    router.push('/modules/pos');
                  } else if (module.title === 'Inventory') {
                    router.push('/modules/inventory');
                  } else if (module.title === 'Suppliers') {
                    router.push('/modules/suppliers');
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
                  <motion.div
                    className="flex flex-col items-center justify-center h-full space-y-5 font-mono"
                    whileHover={{ scale: 1.04, rotate: 0.2 }}
                    transition={{ type: 'spring', stiffness: 250 }}
                  >
                    <Icon className={`w-12 h-12 ${module.color}`} />
                    <h3 className={`text-lg ${module.color} font-mono`}>{module.title}</h3>
                  </motion.div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  )
}
