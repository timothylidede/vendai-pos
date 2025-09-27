'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from './ui/card'
import { 
  ShoppingCart, Package, HeartHandshake, Truck, Users,
  ArrowRightCircle,
  Settings, UserCircle, ChevronDown, 
  User, Mail, MapPin, LogOut, X
} from 'lucide-react'
import { motion } from 'framer-motion'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { NotificationSystem } from '@/components/notification-system'
import { OrganizationSettings } from '@/components/organization-settings'
import { ProfileManagement } from '@/components/profile-management'
import { hasInventory } from '@/lib/pos-operations'
import { getOrgSettings } from '@/lib/org-operations'

const retailerModules = [
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

const distributorModules = [
  {
    title: 'Logistics',
    description: 'Manage deliveries and routes',
    icon: Truck,
    color: 'text-orange-400',
    hoverColor: 'hover:text-orange-300',
    bgGradient: 'from-orange-500/[0.03] via-transparent to-orange-500/[0.02]',
    borderColor: 'border-orange-500/30',
    hoverBorderColor: 'hover:border-orange-400/50',
    shadowColor: 'hover:shadow-[0_20px_48px_-12px_rgba(249,115,22,0.15)]'
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
    title: 'Retailers',
    description: 'Manage retail partners',
    icon: Users,
    color: 'text-cyan-400',
    hoverColor: 'hover:text-cyan-300',
    bgGradient: 'from-cyan-500/[0.03] via-transparent to-cyan-500/[0.02]',
    borderColor: 'border-cyan-500/30',
    hoverBorderColor: 'hover:border-cyan-400/50',
    shadowColor: 'hover:shadow-[0_20px_48px_-12px_rgba(6,182,212,0.15)]'
  }
]

const moduleRouteMap: Record<string, string> = {
  'Point of Sale': '/modules/pos',
  'Inventory': '/modules/inventory',
  'Suppliers': '/modules/suppliers',
  'Logistics': '/modules/logistics',
  'Retailers': '/modules/retailers'
}

const moduleBundlePrefetchers: Record<string, () => Promise<unknown>> = {
  'Point of Sale': () => import('@/components/modules/pos-page'),
  'Inventory': () => import('@/components/modules/inventory-module'),
  'Suppliers': () => import('@/components/modules/supplier-module'),
  'Logistics': () => Promise.resolve(),
  'Retailers': () => Promise.resolve()
}

export function ModulesDashboard() {
  const { user, userData, loading } = useAuth();
  const [showChatbot, setShowChatbot] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [clickedModule, setClickedModule] = useState<string | null>(null);
  const [isEntering, setIsEntering] = useState(true);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [showOrgSettings, setShowOrgSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const router = useRouter();
  const [needsInventory, setNeedsInventory] = useState(false)
  const orgId = useMemo(() => userData?.organizationName || 'default', [userData?.organizationName])
  const prefetchedRoutesRef = useRef<Set<string>>(new Set())
  const prefetchedBundlesRef = useRef<Set<string>>(new Set())

  const currentModules = useMemo(() => {
    if (!userData?.role) return []
    return userData.role === 'retailer' ? retailerModules : distributorModules
  }, [userData?.role])

  const prefetchModuleResources = useCallback((moduleTitle: string) => {
    const route = moduleRouteMap[moduleTitle]
    if (route && !prefetchedRoutesRef.current.has(route)) {
      try {
        router.prefetch(route)
      } catch (error: unknown) {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('Module route prefetch failed', { route, error })
        }
      }
      prefetchedRoutesRef.current.add(route)
    }

    const bundlePrefetch = moduleBundlePrefetchers[moduleTitle]
    if (bundlePrefetch && !prefetchedBundlesRef.current.has(moduleTitle)) {
      bundlePrefetch().catch((error: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('Module bundle prefetch failed', { moduleTitle, error })
        }
      })
      prefetchedBundlesRef.current.add(moduleTitle)
    }
  }, [router])

  // Handle routing based on auth state
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/');
      } else if (!userData) {
        router.push('/onboarding/choose');
      } else if (!userData.onboardingCompleted) {
        router.push('/onboarding/choose');
      } else {
        const isNewUser = localStorage.getItem('vendai-first-login') !== 'false';
        setIsFirstTime(isNewUser);
        if (isNewUser) {
          // Mark first-login consumed without showing any tooltips/banners
          localStorage.setItem('vendai-first-login', 'false');
        }
      }
    }
  }, [user, userData, loading, router]);

  // Check if inventory exists or org_settings marks not-ready; if not, force highlight Inventory and disable others
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!user || !userData) return
      // Prefer org_settings inventory_status when available
      let needs = true
      try {
        const settings = await getOrgSettings(orgId)
        if (settings?.inventory_status === 'ready') {
          needs = false
        } else if (settings?.inventory_status === 'in-progress' || settings?.inventory_status === 'not-started') {
          needs = true
        } else {
          // Fall back to actual inventory presence
          needs = !(await hasInventory(orgId))
        }
      } catch (e) {
        // On failure, fallback to inventory presence
        needs = !(await hasInventory(orgId))
      }
      if (active) setNeedsInventory(needs)
      if (needs) setShowTooltip('Inventory')
    })()
    return () => { active = false }
  }, [user, userData, orgId])
  
  const toggleBot = useCallback(() => {
    setIsSpinning(true);
    setShowChatbot(prev => !prev);
    setTimeout(() => setIsSpinning(false), 2000);
  }, []);

  const handleLogout = useCallback(async () => {
    setShowLogoutModal(false);
    setShowProfileDropdown(false);
    try {
  await signOut(auth);
  localStorage.removeItem('vendai-user-role');
  localStorage.removeItem('vendai-first-login');
  router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [router]);

  const toggleProfileDropdown = useCallback(() => {
    setShowProfileDropdown(prev => !prev);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showProfileDropdown && !target.closest('.profile-dropdown-container')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown]);

  // Handle entrance animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsEntering(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleModuleClick = useCallback((moduleTitle: string) => {
    if (isExiting) return; // Prevent multiple clicks during animation
    // Gate all modules except Inventory until inventory exists
    if (needsInventory && moduleTitle !== 'Inventory') return;
    prefetchModuleResources(moduleTitle)
    setClickedModule(moduleTitle);
    setIsExiting(true);
    setTimeout(() => {
      const target = moduleRouteMap[moduleTitle]
      if (target) {
        router.push(target);
      }
    }, 200); // Wait for exit animation to complete
  }, [isExiting, router, needsInventory, prefetchModuleResources]);

  const handleModuleHover = useCallback((moduleTitle: string) => {
    prefetchModuleResources(moduleTitle)
  }, [prefetchModuleResources])

  useEffect(() => {
    currentModules.forEach(module => prefetchModuleResources(module.title))
  }, [currentModules, prefetchModuleResources])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Create exit variants for each module based on position
  const getExitVariant = (index: number, isClicked: boolean) => {
    if (!isExiting) return {};
    
    if (isClicked) {
      // Clicked module scales up and fades
      return {
        scale: 1.05,
        opacity: 0,
        transition: { duration: 0.12, ease: [0.4, 0.0, 0.2, 1] as any }
      };
    }
    
    // Other modules exit in different directions based on position
    const exitVariants = [
      // Module 0 (POS - left position) - exit up
      { x: 0, y: -300, rotate: 0, opacity: 0 },
      // Module 1 (Inventory - center position) - exit up  
      { x: 0, y: -300, rotate: 0, opacity: 0 },
      // Module 2 (Suppliers - right position) - exit up
      { x: 0, y: -300, rotate: 0, opacity: 0 }
    ];
    
    return {
      ...exitVariants[index],
      transition: { duration: 0.15, ease: [0.4, 0.0, 0.2, 1] as any, delay: 0.02 }
    };
  };

  return (
    <motion.div 
      className="flex flex-col h-[calc(100vh-2.5rem)] p-6 relative overflow-hidden"
      initial={{
        opacity: 0,
        y: isEntering ? -300 : 0
      }}
      animate={{
        opacity: 1,
        y: 0
      }}
      transition={{
        duration: 0.15,
        ease: [0.4, 0.0, 0.2, 1] as any
      }}
    >
      {/* Exit Overlay */}
      {isExiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-10"
          transition={{ duration: 0.3 }}
        />
      )}
      
      {/* Header */}
      <div className="flex justify-between items-center mb-12">
        <div className="flex-1" /> {/* Spacer */}
        
        <div className="flex items-center space-x-4">
          <NotificationSystem />
          
          <button 
            onClick={() => setShowOrgSettings(true)}
            className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
            <Settings className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
          </button>

          <div className="relative profile-dropdown-container">
            <button 
              onClick={toggleProfileDropdown}
              className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-pink-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <UserCircle className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
            </button>

            {/* Glassmorphic Profile Dropdown */}
            {showProfileDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="absolute right-0 top-12 w-80 z-50"
              >
                {/* Glassmorphic dropdown container */}
                <div className="relative rounded-2xl backdrop-blur-xl bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.04] border border-white/[0.12] shadow-[0_20px_48px_-12px_rgba(0,0,0,0.4)]">
                  {/* Background gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-pink-500/[0.02] rounded-2xl"></div>
                  
                  <div className="relative p-6">
                    {/* Profile Header */}
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/30 flex items-center justify-center overflow-hidden">
                        {(user?.photoURL || userData?.photoURL) ? (
                          <img src={(user?.photoURL || userData?.photoURL) as string} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-7 h-7 text-purple-300" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-lg">
                          {userData?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'}
                        </h3>
                        <p className="text-slate-300 text-sm capitalize">{userData?.role || 'Loading...'}</p>
                        {(userData?.organizationDisplayName || userData?.organizationName) && (
                          <p className="text-slate-400 text-xs">{userData.organizationName}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-green-400 text-xs font-medium">Online</span>
                        </div>
                      </div>
                    </div>

                    {/* Profile Menu Items */}
                    <div className="space-y-2">
                      <button 
                        onClick={() => {
                          setShowProfile(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full flex items-center space-x-3 p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200 group"
                      >
                        <Mail className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
                        <div className="text-left">
                          <div className="text-white text-sm font-medium">Account</div>
                          <div className="text-slate-400 text-xs">{user?.email || 'Loading...'}</div>
                        </div>
                      </button>

                      <button 
                        onClick={() => {
                          setShowProfile(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full flex items-center space-x-3 p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200 group"
                      >
                        <User className="w-4 h-4 text-green-400 group-hover:text-green-300" />
                        <div className="text-left">
                          <div className="text-white text-sm font-medium">Role</div>
                          <div className="text-slate-400 text-xs capitalize">
                            {userData?.role === 'retailer' ? 'Retail Business' : 'Distribution Business'}
                          </div>
                        </div>
                      </button>

                      <button 
                        onClick={() => {
                          setShowOrgSettings(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full flex items-center space-x-3 p-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200 group"
                      >
                        <MapPin className="w-4 h-4 text-orange-400 group-hover:text-orange-300" />
                        <div className="text-left">
                          <div className="text-white text-sm font-medium">Organization</div>
                          <div className="text-slate-400 text-xs">
                            {userData?.organizationDisplayName || userData?.organizationName || 'Not set'}
                            {userData?.isOrganizationCreator && ' (Creator)'}
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent"></div>

                    {/* Logout Button */}
                    <button 
                      onClick={() => {
                        setShowLogoutModal(true);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center space-x-3 p-3 rounded-xl bg-red-500/[0.08] hover:bg-red-500/[0.15] border border-red-500/[0.20] hover:border-red-400/[0.30] transition-all duration-200 group"
                    >
                      <LogOut className="w-4 h-4 text-red-400 group-hover:text-red-300" />
                      <div className="text-left">
                        <div className="text-red-300 group-hover:text-red-200 text-sm font-medium">Sign Out</div>
                        <div className="text-red-400/70 group-hover:text-red-300/70 text-xs">End your session</div>
                      </div>
                    </button>
                  </div>

                  {/* Dropdown arrow */}
                  <div className="absolute -top-2 right-4 w-4 h-4 bg-gradient-to-br from-white/[0.12] to-white/[0.08] border-l border-t border-white/[0.12] rotate-45"></div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* First-time user welcome banner */}
      {/* First-time user welcome banner removed per request */}

      {/* Modules Grid */}
      <div className="flex flex-col items-center mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 max-w-6xl w-full place-items-center">
          {currentModules.map((module, index) => {
            const Icon = module.icon
            const isClicked = clickedModule === module.title;
            // Only show gating tooltip on the Inventory module. For other modules, show tooltip only when not gated.
            const hasTooltip = module.title === 'Inventory'
              ? (showTooltip === module.title || needsInventory)
              : (!needsInventory && showTooltip === module.title);
            const gated = needsInventory && module.title !== 'Inventory';
            
            return (
              <motion.div
                key={index}
                className="w-full min-w-[320px] max-w-sm h-[240px] relative"
                initial={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }}
                animate={getExitVariant(index, isClicked)}
                whileHover={!isExiting ? { 
                  y: -12,
                  scale: 1.02,
                  transition: { duration: 0.3, ease: "easeOut" }
                } : {}}
                onClick={() => handleModuleClick(module.title)}
                onMouseEnter={() => handleModuleHover(module.title)}
                onFocus={() => handleModuleHover(module.title)}
                style={{ pointerEvents: isExiting ? 'none' : (gated ? 'none' : 'auto') }}
              >
                {/* First-time user tooltip */}
                {hasTooltip && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                    className="absolute -top-16 left-1/2 transform -translate-x-1/2 z-50"
                  >
                    <div className="relative bg-gradient-to-r from-blue-600 to-green-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium whitespace-nowrap">
                      {needsInventory 
                        ? (userData?.role === 'retailer' 
                            ? 'Add inventory first to unlock all modules' 
                            : 'Add inventory first to continue') 
                        : (userData?.role === 'retailer' 
                            ? '👆 Start here! Process your first sale' 
                            : '👆 Start here! Manage your catalog')}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-green-600"></div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTooltip(null);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-white text-xs transition-colors"
                    >
                      ×
                    </button>
                  </motion.div>
                )}
                <div 
                  className={`group relative rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/[0.08] via-white/[0.05] to-transparent border ${gated ? 'border-white/[0.04] opacity-60' : 'border-white/[0.08]'} ${module.hoverBorderColor} transition-all duration-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)] ${module.shadowColor} cursor-pointer h-full ${
                    isClicked ? 'ring-2 ring-offset-2 ring-offset-slate-900 ' + (
                      module.color === 'text-green-400' ? 'ring-green-400/50' :
                      module.color === 'text-blue-400' ? 'ring-blue-400/50' : 
                      'ring-purple-400/50'
                    ) + ' shadow-2xl ' + (
                      module.color === 'text-green-400' ? 'shadow-green-400/25' :
                      module.color === 'text-blue-400' ? 'shadow-blue-400/25' :
                      'shadow-purple-400/25'
                    ) : ''
                  }`}
                >
                  {/* Glassmorphic background overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${module.bgGradient} ${gated ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-500`} />
                  
                  <div className="relative flex flex-col items-center justify-center h-full space-y-6 p-8">
                    {/* Icon Container */}
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)]">
                        <Icon className={`w-10 h-10 ${module.color} ${module.hoverColor} transition-all duration-500 ${gated ? 'opacity-60' : ''}`} 
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
                      <h3 className={`text-xl font-bold ${module.color} ${module.hoverColor} transition-colors duration-300 tracking-tight ${gated ? 'opacity-60' : ''}`}>
                        {module.title}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Top highlight line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  {needsInventory && module.title === 'Inventory' && (
                    <div className="absolute -right-6 -top-4 rotate-12 animate-bounce">
                      <ArrowRightCircle className="w-10 h-10 text-green-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.5)]" />
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="relative w-full max-w-md"
          >
            {/* Glassmorphic modal container */}
            <div className="relative rounded-2xl backdrop-blur-xl bg-gradient-to-br from-white/[0.12] via-white/[0.08] to-white/[0.04] border border-white/[0.12] shadow-[0_20px_48px_-12px_rgba(0,0,0,0.4)]">
              {/* Background gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.03] via-transparent to-orange-500/[0.02] rounded-2xl"></div>
              
              <div className="relative p-6">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center">
                      <LogOut className="w-5 h-5 text-red-300" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg">Sign Out</h3>
                      <p className="text-slate-300 text-sm">Confirm logout</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-200"
                  >
                    <X className="w-4 h-4 text-slate-400 hover:text-white" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="mb-6">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Are you sure you want to sign out? You'll need to log in again to access your dashboard and modules.
                  </p>
                </div>

                {/* Modal Actions */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] hover:border-white/[0.15] text-white text-sm font-medium transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 px-4 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 hover:border-red-400/40 text-red-300 hover:text-red-200 text-sm font-medium transition-all duration-200"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Organization Settings Modal */}
      <OrganizationSettings 
        isOpen={showOrgSettings}
        onClose={() => setShowOrgSettings(false)}
      />

      {/* Profile Management Modal */}
      <ProfileManagement 
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </motion.div>
  )
}
