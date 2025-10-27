'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from './ui/card'
import { 
  ShoppingCart, Package, HeartHandshake, Truck, Users,
  ArrowRightCircle, TrendingUp,
  Settings, UserCircle, ChevronDown, 
  User, Mail, MapPin, LogOut, X, Search
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
import { LoadingSpinner } from './loading-spinner'
import { UniversalLoading } from './universal-loading'
import { ProductsGrid } from './products-grid'

const retailerModules = [
  {
    title: 'Point of Sale',
    description: 'Process sales and payments',
    icon: ShoppingCart,
    color: 'text-green-400',
    hoverColor: 'hover:text-green-300',
    bgGradient: 'from-emerald-500/[0.14] via-emerald-500/[0.07] to-emerald-500/[0.04]',
    borderColor: 'border-emerald-400/15',
    hoverBorderColor: 'hover:border-emerald-300/25',
  shadowColor: 'hover:shadow-[0_24px_56px_-28px_rgba(16,185,129,0.2)]',
    palette: {
      cardBase: 'bg-gradient-to-br from-slate-950/88 via-slate-950/72 to-emerald-950/32',
      iconBg: 'bg-gradient-to-br from-emerald-500/[0.16] via-emerald-500/[0.08] to-emerald-400/[0.12]',
      ring: 'ring-emerald-400/25',
      title: 'text-emerald-200/85',
      muted: 'text-emerald-200/60'
    }
  },
  {
    title: 'Inventory',
    description: 'Track stock and orders',
    icon: Package,
    color: 'text-blue-400',
    hoverColor: 'hover:text-blue-300',
    bgGradient: 'from-blue-500/[0.14] via-blue-500/[0.07] to-indigo-500/[0.045]',
    borderColor: 'border-blue-400/15',
    hoverBorderColor: 'hover:border-blue-300/25',
  shadowColor: 'hover:shadow-[0_24px_56px_-28px_rgba(59,130,246,0.2)]',
    palette: {
      cardBase: 'bg-gradient-to-br from-slate-950/88 via-slate-950/72 to-blue-950/32',
      iconBg: 'bg-gradient-to-br from-blue-500/[0.16] via-blue-500/[0.08] to-indigo-500/[0.12]',
      ring: 'ring-blue-400/25',
      title: 'text-blue-200/85',
      muted: 'text-blue-200/60'
    }
  },
  {
    title: 'Suppliers',
    description: 'Manage procurement',
    icon: HeartHandshake,
    color: 'text-purple-400',
    hoverColor: 'hover:text-purple-300',
    bgGradient: 'from-purple-500/[0.14] via-purple-500/[0.07] to-pink-500/[0.04]',
    borderColor: 'border-purple-400/15',
    hoverBorderColor: 'hover:border-purple-300/25',
  shadowColor: 'hover:shadow-[0_24px_56px_-28px_rgba(168,85,247,0.2)]',
    palette: {
      cardBase: 'bg-gradient-to-br from-slate-950/88 via-slate-950/72 to-purple-950/32',
      iconBg: 'bg-gradient-to-br from-purple-500/[0.16] via-purple-500/[0.08] to-pink-500/[0.12]',
      ring: 'ring-purple-400/25',
      title: 'text-purple-200/85',
      muted: 'text-purple-200/60'
    }
  }
]

const distributorModules = [
  {
    title: 'Logistics',
    description: 'Manage deliveries and routes',
    icon: Truck,
    color: 'text-orange-400',
    hoverColor: 'hover:text-orange-300',
    bgGradient: 'from-amber-500/[0.14] via-orange-500/[0.07] to-orange-500/[0.04]',
    borderColor: 'border-orange-400/15',
    hoverBorderColor: 'hover:border-orange-300/26',
  shadowColor: 'hover:shadow-[0_24px_56px_-28px_rgba(249,115,22,0.2)]',
    palette: {
      cardBase: 'bg-gradient-to-br from-slate-950/88 via-slate-950/72 to-amber-950/32',
      iconBg: 'bg-gradient-to-br from-amber-500/[0.16] via-orange-500/[0.08] to-orange-500/[0.12]',
      ring: 'ring-orange-400/25',
      title: 'text-amber-200/85',
      muted: 'text-amber-200/60'
    }
  },
  {
    title: 'Inventory',
    description: 'Track stock and orders',
    icon: Package,
    color: 'text-blue-400',
    hoverColor: 'hover:text-blue-300',
    bgGradient: 'from-blue-500/25 via-blue-500/10 to-indigo-500/8',
    borderColor: 'border-blue-400/25',
    hoverBorderColor: 'hover:border-blue-300/40',
  shadowColor: 'hover:shadow-[0_24px_56px_-26px_rgba(59,130,246,0.32)]',
    palette: {
      cardBase: 'bg-gradient-to-br from-slate-950/85 via-blue-950/45 to-slate-950/60',
      iconBg: 'bg-gradient-to-br from-blue-500/18 via-blue-500/12 to-indigo-500/15',
      ring: 'ring-blue-400/40',
      title: 'text-blue-200',
      muted: 'text-blue-200/70'
    }
  },
  {
    title: 'Retailers',
    description: 'Manage retail partners',
    icon: Users,
    color: 'text-cyan-400',
    hoverColor: 'hover:text-cyan-300',
    bgGradient: 'from-cyan-500/[0.14] via-cyan-500/[0.07] to-teal-500/[0.04]',
    borderColor: 'border-cyan-400/15',
    hoverBorderColor: 'hover:border-cyan-300/25',
  shadowColor: 'hover:shadow-[0_24px_56px_-28px_rgba(6,182,212,0.2)]',
    palette: {
      cardBase: 'bg-gradient-to-br from-slate-950/88 via-slate-950/72 to-cyan-950/32',
      iconBg: 'bg-gradient-to-br from-cyan-500/[0.16] via-cyan-500/[0.08] to-teal-500/[0.12]',
      ring: 'ring-cyan-400/25',
      title: 'text-cyan-200/85',
      muted: 'text-cyan-200/60'
    }
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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isProductsExpanded, setIsProductsExpanded] = useState(false);
  const router = useRouter();
  const [needsInventory, setNeedsInventory] = useState(false)
  const orgId = useMemo(() => userData?.organizationName || 'default', [userData?.organizationName])
  const prefetchedRoutesRef = useRef<Set<string>>(new Set())
  const prefetchedBundlesRef = useRef<Set<string>>(new Set())
  const initialPrefetchDoneRef = useRef(false)

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
    setIsSigningOut(true);
    try {
  if (auth) {
    await signOut(auth);
  }
  localStorage.removeItem('vendai-user-role');
  localStorage.removeItem('vendai-first-login');
  router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      setIsSigningOut(false);
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
    if (!initialPrefetchDoneRef.current && currentModules.length > 0) {
      currentModules.forEach(module => prefetchModuleResources(module.title))
      initialPrefetchDoneRef.current = true
    }
  }, [currentModules, prefetchModuleResources])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <LoadingSpinner size="lg" showMessage message="Loading your dashboard..." className="space-y-3" />
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
        transition: { duration: 0.08, ease: [0.4, 0.0, 0.2, 1] as any }
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
      transition: { duration: 0.08, ease: [0.4, 0.0, 0.2, 1] as any }
    };
  };

  return (
    <div className="module-background flex h-screen overflow-hidden" style={{ fontFamily: '"Neue Haas Grotesk Display Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[120px]" />
        <div className="absolute -top-36 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-500/18 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-96 w-96 rounded-full bg-indigo-500/18 blur-[140px]" />
        <div className="absolute top-1/3 -left-32 h-64 w-64 rounded-full bg-cyan-400/14 blur-[120px]" />
      </div>

      {/* Exit Overlay */}
      {isExiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-10"
          transition={{ duration: 0.15 }}
        />
      )}
      
      {/* Left Sidebar - Navigation */}
      <div className={`flex flex-col w-20 relative z-10 transition-all duration-300 ${isProductsExpanded ? 'opacity-0 pointer-events-none -ml-20' : 'opacity-100'}`}>
        {/* Logo */}
        <div className="flex items-center justify-center h-16">
          <a
            href="https://vendai.digital"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center transition-transform duration-700 hover:rotate-[360deg]"
          >
            <img
              src="/images/logo-icon-remove.png"
              alt="Vendai"
              className="h-8 w-auto"
            />
          </a>
        </div>

        {/* Navigation Items */}
        <div className="flex flex-col items-center space-y-6 mt-2">
          <button className="group flex flex-col items-center justify-center space-y-1.5 text-sky-400 transition-colors">
            <svg className="w-10 h-10 p-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-xs font-medium">Chat</span>
          </button>

          <button className="group flex flex-col items-center justify-center space-y-1.5 text-slate-400 hover:text-white transition-colors">
            <svg className="w-10 h-10 p-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-xs font-medium">Filters</span>
          </button>

          <button 
            onClick={() => setShowOrgSettings(true)}
            className="group flex flex-col items-center justify-center space-y-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex flex-col w-80 relative z-10 transition-all duration-300 ${isProductsExpanded ? 'opacity-0 pointer-events-none -ml-80' : 'opacity-100'}`}>
        <div className="flex-1 pt-16 pb-20 px-4 overflow-auto">
          {/* Chat messages will go here */}
        </div>
        
        {/* Chat Input - Fixed at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="relative rounded-xl border border-white/15 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-blue-950/80 backdrop-blur-xl shadow-lg">
            {/* Ask a follow-up text */}
            <div className="px-4 pt-3 pb-2">
              <span className="text-xs text-slate-400">Ask a follow-up...</span>
            </div>
            
            {/* Input and icons */}
            <div className="relative px-4 pb-3">
              <input
                type="text"
                placeholder=""
                className="w-full bg-transparent pr-32 py-2 text-sm text-white placeholder-slate-400 focus:outline-none"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </button>
                <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
                <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col relative z-10 transition-all duration-300 ${isProductsExpanded ? 'ml-3' : ''}`}>
        {/* Header */}
        <div className="flex items-center px-6 h-16 gap-4">
          {/* Toggle Arrow Button - Aligned with products tab */}
          <button
            onClick={() => setIsProductsExpanded(!isProductsExpanded)}
            className="flex-shrink-0 h-10 w-10 rounded-xl bg-slate-800/50 backdrop-blur-sm transition-colors hover:bg-slate-700/50 flex items-center justify-center"
          >
            <svg 
              className={`h-5 w-5 text-slate-300 transition-transform duration-300 ${isProductsExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Search Bar */}
          <div className={`flex-1 min-w-[16rem] transition-[max-width] duration-300 ease-out ${isProductsExpanded ? 'max-w-4xl' : 'max-w-2xl'}`}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search products and brands"
                className="w-full h-10 rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.04] backdrop-blur-xl pl-12 pr-4 text-sm text-white placeholder-slate-400 transition-all duration-200 hover:border-sky-200/30 focus:border-sky-300/50 focus:ring-2 focus:ring-sky-400/20 focus:outline-none shadow-[0_4px_16px_-8px_rgba(0,0,0,0.3)]"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4 ml-6 flex-shrink-0">
            <NotificationSystem />
            
            <button 
              className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <ShoppingCart className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
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
                transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
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

        {/* Products Layout Area */}
        <div className="flex-1 pl-3 pr-3 pb-3 pt-2 overflow-hidden">
          <div className="relative h-full rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-blue-950/80 products-scrollbar overflow-y-auto">
            {/* Products Grid */}
            <ProductsGrid isExpanded={isProductsExpanded} />
          </div>
        </div>
      </div>

      {/* Modules Grid - Hidden */}
      {false && (
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
            const palette = module.palette || {
              cardBase: 'bg-gradient-to-br from-slate-950/85 via-slate-950/65 to-slate-950/55',
              iconBg: 'bg-gradient-to-br from-white/15 via-white/10 to-white/5',
              ring: 'ring-blue-400/30',
              title: module.color,
              muted: 'text-slate-300'
            }
            const activeShadow = module.color === 'text-green-400'
              ? 'shadow-[0_28px_68px_-26px_rgba(16,185,129,0.6)]'
              : module.color === 'text-blue-400'
              ? 'shadow-[0_28px_68px_-26px_rgba(59,130,246,0.55)]'
              : module.color === 'text-purple-400'
              ? 'shadow-[0_28px_68px_-26px_rgba(168,85,247,0.55)]'
              : module.color === 'text-orange-400'
              ? 'shadow-[0_28px_68px_-26px_rgba(249,115,22,0.55)]'
              : module.color === 'text-cyan-400'
              ? 'shadow-[0_28px_68px_-26px_rgba(6,182,212,0.55)]'
              : 'shadow-[0_28px_68px_-26px_rgba(59,130,246,0.5)]'
            
            return (
              <motion.div
                key={index}
                className="w-full min-w-[320px] max-w-sm h-[240px] relative"
                initial={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }}
                animate={getExitVariant(index, isClicked)}
                whileHover={!isExiting ? { 
                  y: -12,
                  scale: 1.02,
                  transition: { duration: 0.2, ease: "easeOut" }
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
                  className={`group relative overflow-hidden rounded-3xl backdrop-blur-2xl ${palette.cardBase} border ${gated ? 'border-white/5 opacity-60' : module.borderColor} ${gated ? '' : module.hoverBorderColor} transition-all duration-500 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.5)] ${module.shadowColor} cursor-pointer h-full ${
                    isClicked && !gated ? `ring-2 ring-offset-2 ring-offset-slate-950 ${palette.ring} ${activeShadow}` : ''
                  }`}
                >
                  {/* Glassmorphic background overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${module.bgGradient} ${gated ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-500`} />
                  
                  <div className="relative flex flex-col items-center justify-center h-full space-y-6 p-8">
                    {/* Icon Container */}
                    <div className="relative">
                      <div className={`w-20 h-20 rounded-2xl backdrop-blur-2xl ${palette.iconBg} border border-white/5 flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.75)]`}>
                        <Icon className={`w-10 h-10 ${module.color} ${module.hoverColor} transition-all duration-500 ${gated ? 'opacity-60' : ''}`} 
                              style={{
                                filter: `drop-shadow(0 4px 8px ${
                                  module.color === 'text-green-400' ? 'rgba(34, 197, 94, 0.28)' :
                                  module.color === 'text-blue-400' ? 'rgba(59, 130, 246, 0.28)' :
                                  'rgba(168, 85, 247, 0.28)'
                                }) drop-shadow(0 2px 4px ${
                                  module.color === 'text-green-400' ? 'rgba(34, 197, 94, 0.14)' :
                                  module.color === 'text-blue-400' ? 'rgba(59, 130, 246, 0.14)' :
                                  'rgba(168, 85, 247, 0.14)'
                                }) drop-shadow(0 0 12px ${
                                  module.color === 'text-green-400' ? 'rgba(34, 197, 94, 0.18)' :
                                  module.color === 'text-blue-400' ? 'rgba(59, 130, 246, 0.18)' :
                                  'rgba(168, 85, 247, 0.18)'
                                }) drop-shadow(0 0 24px ${
                                  module.color === 'text-green-400' ? 'rgba(34, 197, 94, 0.1)' :
                                  module.color === 'text-blue-400' ? 'rgba(59, 130, 246, 0.1)' :
                                  'rgba(168, 85, 247, 0.1)'
                                })`
                              }} />
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="text-center">
                      <h3 className={`text-lg font-semibold tracking-wide transition-colors duration-300 ${palette.title} ${module.hoverColor} ${gated ? 'opacity-60' : ''}`}>
                        {module.title}
                      </h3>
                      <p className={`mt-2 text-sm transition-colors duration-300 ${palette.muted} ${gated ? 'opacity-50' : 'group-hover:text-slate-200/90'}`}>
                        {module.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Top highlight line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  {needsInventory && module.title === 'Inventory' && (
                    <div className="absolute -right-6 -top-4 rotate-12 animate-bounce">
                      <ArrowRightCircle className="w-10 h-10 text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.35)]" />
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
      )}

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
            transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
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

      {isSigningOut && (
        <div className="fixed inset-0 z-[200]">
          <UniversalLoading message="Signing you out..." type="auth" />
        </div>
      )}
    </div>
  )
}
