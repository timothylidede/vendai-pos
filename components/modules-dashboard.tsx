'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from './ui/card'
import { 
  ShoppingCart, Package, HeartHandshake, Truck, Users,
  ArrowRightCircle, TrendingUp,
  Settings, UserCircle, ChevronDown, 
  User, Mail, MapPin, LogOut, X, Search, Plus,
  MessageSquare, Filter, Bell, ShoppingBag, Globe
} from 'lucide-react'
import { Checkbox } from './ui/checkbox'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Label } from './ui/label'
import { Input } from './ui/input'
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
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [showOrgSettings, setShowOrgSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isProductsExpanded, setIsProductsExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<'products' | 'brands'>('products');
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();
  const [needsInventory, setNeedsInventory] = useState(false)
  const orgId = useMemo(() => userData?.organizationName || 'default', [userData?.organizationName])
  const prefetchedRoutesRef = useRef<Set<string>>(new Set())
  const prefetchedBundlesRef = useRef<Set<string>>(new Set())
  const initialPrefetchDoneRef = useRef(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

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
      } else if (userData.role === 'distributor') {
        // Redirect distributors to their dashboard
        router.push('/distributor-dashboard');
      } else {
        const isNewUser = localStorage.getItem('vendai-first-login') !== 'false';
        setIsFirstTime(isNewUser);
        if (isNewUser) {
          // Mark first-login consumed without showing any tooltips/banners
          localStorage.setItem('vendai-first-login', 'false');
        }
        
        // Check if this is first time seeing welcome modal
        const hasSeenWelcome = localStorage.getItem('hasSeenRetailerWelcome');
        if (!hasSeenWelcome && userData.role === 'retailer') {
          setShowWelcomeModal(true);
          localStorage.setItem('hasSeenRetailerWelcome', 'true');
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
  
  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isLoading]);
  
  const toggleBot = useCallback(() => {
    setIsSpinning(true);
    setShowChatbot(prev => !prev);
    setTimeout(() => setIsSpinning(false), 2000);
  }, []);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;
    
    // Add user message to chat
    const userMessage = { role: 'user' as const, content: message };
    setChatMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
      // Use Firebase-based chat instead of OpenAI
      const response = await fetch('/api/chat-firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message,
          context: {
            role: userData?.role,
            organizationName: userData?.organizationName
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to get response');
      }
      
      const assistantMessage = { role: 'assistant' as const, content: data.message };
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage = { 
        role: 'assistant' as const, 
        content: `I'm having trouble connecting right now. Please try asking about your products, inventory, or sales.` 
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, userData]);

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

      {/* Welcome Modal */}
      {showWelcomeModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/12 bg-slate-900/95 p-8 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-500">
                <ShoppingCart className="h-10 w-10 text-white" />
              </div>
            </div>
            
            <h2 className="mb-3 text-center text-3xl font-bold text-slate-100">
              Welcome to Vendai! 🎉
            </h2>
            
            <p className="mb-8 text-center text-slate-300">
              Your all-in-one platform to manage sales, inventory, and suppliers. Let's get started!
            </p>
            
            <button
              onClick={() => setShowWelcomeModal(false)}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 py-3 text-white shadow-lg hover:shadow-xl transition-all font-medium"
            >
              Get Started
            </button>
          </motion.div>
        </motion.div>
      )}

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
          <motion.button 
            onClick={() => setShowFilters(false)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className={`group relative flex items-center justify-center transition-colors ${
              !showFilters ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900/95 border border-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg">Chat</span>
          </motion.button>

          <motion.button 
            onClick={() => setShowFilters(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className={`group relative flex items-center justify-center transition-colors ${
              showFilters ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Filter className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900/95 border border-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg">Filters</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <Bell className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900/95 border border-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg">Notifications</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900/95 border border-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg">Cart</span>
          </motion.button>

          <motion.button 
            onClick={toggleProfileDropdown}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <UserCircle className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900/95 border border-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg">Profile</span>
          </motion.button>

          <motion.button 
            onClick={() => setShowOrgSettings(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <Settings className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900/95 border border-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg">Settings</span>
          </motion.button>
        </div>
      </div>

      {/* Chat/Filter Area */}
      <div className={`flex flex-col w-80 relative z-10 transition-all duration-300 ${isProductsExpanded ? 'opacity-0 pointer-events-none -ml-80' : 'opacity-100'}`}>
        {/* Conditionally render chat or filters */}
        {showFilters ? (
          // Filter Panel
          <div className="flex-1 pt-16 pb-4 px-4 overflow-auto scrollbar-hide">
            <div className="space-y-6">
              {/* 1 filter applied */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-slate-400">1 filter applied</span>
                <button className="text-sm text-sky-400 hover:text-sky-300 transition-colors">
                  Clear all
                </button>
              </div>

              {/* Brand minimum */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Brand minimum</h3>
                <RadioGroup defaultValue="all">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="brand-all" className="border-slate-600 text-sky-400" />
                    <Label htmlFor="brand-all" className="text-sm text-slate-300 cursor-pointer">All</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="100-or-less" id="brand-100" className="border-slate-600 text-sky-400" />
                    <Label htmlFor="brand-100" className="text-sm text-slate-300 cursor-pointer">$100 or less</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1000-or-less" id="brand-1000" className="border-slate-600 text-sky-400" />
                    <Label htmlFor="brand-1000" className="text-sm text-slate-300 cursor-pointer">$1000 or less</Label>
                  </div>
                </RadioGroup>
                <button className="text-sm text-sky-400 hover:text-sky-300 transition-colors">
                  Show more
                </button>
              </div>

              {/* Ships from */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Ships from</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search"
                    className="pl-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="us" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="us" className="text-sm text-slate-300 cursor-pointer">United States</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="eu" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="eu" className="text-sm text-slate-300 cursor-pointer">European union</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="uk" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="uk" className="text-sm text-slate-300 cursor-pointer">United Kingdom</Label>
                  </div>
                </div>
                <button className="text-sm text-sky-400 hover:text-sky-300 transition-colors">
                  Show more
                </button>
              </div>

              {/* Made in */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Made in</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search"
                    className="pl-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="made-us" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="made-us" className="text-sm text-slate-300 cursor-pointer">United States</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="made-uk" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="made-uk" className="text-sm text-slate-300 cursor-pointer">United Kingdom</Label>
                  </div>
                </div>
                <button className="text-sm text-sky-400 hover:text-sky-300 transition-colors">
                  Show more
                </button>
              </div>

              {/* Wholesale price */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Wholesale price</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="price-10" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="price-10" className="text-sm text-slate-300 cursor-pointer">$0 - $10</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="price-25" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="price-25" className="text-sm text-slate-300 cursor-pointer">$10 - $25</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="price-50" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="price-50" className="text-sm text-slate-300 cursor-pointer">$25 - $50</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="price-100" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="price-100" className="text-sm text-slate-300 cursor-pointer">$50 - $100</Label>
                  </div>
                </div>
                <button className="text-sm text-sky-400 hover:text-sky-300 transition-colors">
                  Show more
                </button>
              </div>

              {/* Ship window */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Ship window</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="ship-asap" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="ship-asap" className="text-sm text-slate-300 cursor-pointer">Ships ASAP</Label>
                  </div>
                </div>
              </div>

              {/* Pre-order by month */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Pre-order by month</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="nov-2025" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="nov-2025" className="text-sm text-slate-300 cursor-pointer">Nov 2025</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="dec-2025" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="dec-2025" className="text-sm text-slate-300 cursor-pointer">Dec 2025</Label>
                  </div>
                </div>
                <button className="text-sm text-sky-400 hover:text-sky-300 transition-colors">
                  Show more
                </button>
              </div>

              {/* Lead time */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Lead time</h3>
                <RadioGroup defaultValue="any">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="any" id="lead-any" className="border-slate-600 text-sky-400" />
                    <Label htmlFor="lead-any" className="text-sm text-slate-300 cursor-pointer">Any time</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2-days" id="lead-2" className="border-slate-600 text-sky-400" />
                    <Label htmlFor="lead-2" className="text-sm text-slate-300 cursor-pointer">2 days or less</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="7-days" id="lead-7" className="border-slate-600 text-sky-400" />
                    <Label htmlFor="lead-7" className="text-sm text-slate-300 cursor-pointer">7 days or less</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Product types */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Product types</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search"
                    className="pl-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="book" className="border-slate-600 data-[state=checked]:bg-sky-400 data-[state=checked]:border-sky-400" />
                    <Label htmlFor="book" className="text-sm text-slate-300 cursor-pointer">Book</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Chat Panel
          <>
            <div ref={chatContainerRef} className="flex-1 pt-16 pb-20 px-4 overflow-y-auto scrollbar-hide">
              {/* Chat messages */}
              <div className="space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user' 
                        ? 'bg-blue-600/80 text-white' 
                        : 'bg-slate-800/80 text-slate-200 border border-white/10'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800/80 text-slate-200 border border-white/10 rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Chat Input - Fixed at bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="relative rounded-xl border border-white/15 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-blue-950/80 backdrop-blur-xl shadow-lg">
                <div className="px-4 py-3">
                  {/* Textarea on top */}
                  <textarea
                    placeholder="Ask.."
                    rows={1}
                    className="w-full bg-transparent py-2 text-sm text-white placeholder-slate-400 focus:outline-none resize-none overflow-hidden mb-2"
                    style={{ minHeight: '2.5rem' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        // Handle send message
                        const textarea = e.target as HTMLTextAreaElement;
                        if (textarea.value.trim()) {
                          handleSendMessage(textarea.value);
                          textarea.value = '';
                          textarea.style.height = 'auto';
                        }
                      }
                    }}
                  />
                  
                  {/* Icons on bottom */}
                  <div className="flex items-center gap-2 justify-end">
                    <button 
                      onClick={() => {
                        setChatMessages([]);
                        const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                        if (textarea) {
                          textarea.value = '';
                          textarea.style.height = 'auto';
                        }
                      }}
                      className="group relative p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <Plus className="w-5 h-5 text-slate-400" />
                      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900/95 border border-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg">
                        New chat
                      </span>
                    </button>
                    <button className="group relative p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                      <MessageSquare className="w-5 h-5 text-slate-400" />
                      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900/95 border border-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg">
                        Chat history
                      </span>
                    </button>
                    <button 
                      onClick={() => {
                        const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                        if (textarea?.value.trim()) {
                          handleSendMessage(textarea.value);
                          textarea.value = '';
                          textarea.style.height = 'auto';
                        }
                      }}
                      disabled={isLoading}
                      className="group relative p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowRightCircle className="w-5 h-5 text-white" />
                      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900/95 border border-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg">
                        Send
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col relative z-10 transition-all duration-300 ${isProductsExpanded ? 'ml-3' : ''}`}>
        {/* Header */}
        <div className="flex items-center px-6 h-16 gap-4">
          {/* Plus Icon Button */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsProductsExpanded(!isProductsExpanded)}
            className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <Plus className="h-6 w-6" />
          </motion.button>

          {/* Products/Brands Toggle */}
          <div className="flex items-center gap-3 ml-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setViewMode('products')}
              className={`flex items-center justify-center h-10 w-10 rounded-full transition-colors ${
                viewMode === 'products' 
                  ? 'text-white' 
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <ShoppingBag className="h-5 w-5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setViewMode('brands')}
              className={`flex items-center justify-center h-10 w-10 rounded-full transition-colors ${
                viewMode === 'brands' 
                  ? 'text-white' 
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Globe className="h-5 w-5" />
            </motion.button>
          </div>

          <div className="relative profile-dropdown-container">
            <div className="opacity-0 pointer-events-none">
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
          <div className="relative h-full rounded-2xl overflow-y-auto scrollbar-hide">
            {/* Products Grid */}
            <ProductsGrid isExpanded={isProductsExpanded} viewMode={viewMode} />
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
