import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScanBarcode, ShoppingCart, Trash2, Plus, ChevronDown, X, Search, Package, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import type { POSProduct, POSOrderLine, POSOrderDoc } from '@/lib/types'
// Gradually migrating to optimized operations
import { listPOSProducts, addPosOrder, listRecentOrders, getInventory } from '@/lib/pos-operations-optimized'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { useGlassmorphicToast } from '../ui/glassmorphic-toast'
import { LoadingSpinner } from '../loading-spinner'

type LegacyImageField = 'imageUrl' | 'image_url' | 'imageURL'

const legacyImageFields: LegacyImageField[] = ['imageUrl', 'image_url', 'imageURL']

const resolveProductImage = (product: POSProduct): string | undefined => {
  if (typeof product.image === 'string' && product.image.trim().length > 0) {
    return product.image
  }

  const legacyProduct = product as POSProduct & Partial<Record<LegacyImageField, unknown>>
  for (const field of legacyImageFields) {
    const raw = legacyProduct[field]
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw
    }
  }
  return undefined
}

interface CartLine {
  productId: string
  name: string
  price: number
  quantity: number
  image?: string
}

interface OrderTab {
  id: string
  number: string
  cart: CartLine[]
  total: number
  createdAt: Date
}

type StoredOrderTab = Omit<OrderTab, 'createdAt'> & { createdAt: string }

export function POSPage() {
  const [headerCollapsed, setHeaderCollapsed] = useState(true)
  const [cart, setCart] = useState<CartLine[]>([])
  const [activeTab, setActiveTab] = useState<'register' | 'orders'>('register')
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState('001')
  const [isExiting, setIsExiting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const { showToast: showGlassToast, ToastContainer } = useGlassmorphicToast()
  const { userData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<POSProduct[]>([])
  const [addingToCart, setAddingToCart] = useState<string | null>(null) // Track which product is being added

  const [recentOrders, setRecentOrders] = useState<POSOrderDoc[]>([])
  
  // Enhanced persistent order tabs
  const [orderTabs, setOrderTabs] = useState<Map<string, OrderTab>>(new Map())
  const [activeOrderId, setActiveOrderId] = useState<string>('001')

  // Generate next available order number
  const getNextOrderNumber = () => {
    const existingNumbers = Array.from(orderTabs.keys()).map(id => parseInt(id)).filter(n => !isNaN(n))
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0
    return String(maxNumber + 1).padStart(3, '0')
  }

  // Initialize with first order tab
  useEffect(() => {
    const firstTab: OrderTab = {
      id: '001',
      number: '001',
      cart: [],
      total: 0,
      createdAt: new Date()
    }
    setOrderTabs(new Map([['001', firstTab]]))
    setActiveOrderId('001')
  }, [])

  // Load persistent order tabs from localStorage
  useEffect(() => {
    const savedTabs = localStorage.getItem('pos-order-tabs')
    if (savedTabs) {
      try {
        const tabData = JSON.parse(savedTabs) as StoredOrderTab[]
        const restoredTabs = new Map<string, OrderTab>()
        tabData.forEach((tab) => {
          restoredTabs.set(tab.id, {
            ...tab,
            createdAt: new Date(tab.createdAt)
          })
        })
        if (restoredTabs.size > 0) {
          setOrderTabs(restoredTabs)
          const firstTabId = Array.from(restoredTabs.keys())[0]
          setActiveOrderId(firstTabId)
          setCart(restoredTabs.get(firstTabId)?.cart || [])
        }
      } catch (e) {
        console.warn('Failed to restore order tabs:', e)
      }
    }
  }, [])

  // Save order tabs to localStorage whenever they change
  useEffect(() => {
    if (orderTabs.size > 0) {
      const tabsArray = Array.from(orderTabs.values())
      localStorage.setItem('pos-order-tabs', JSON.stringify(tabsArray))
    }
  }, [orderTabs])

  // Update current tab's cart whenever cart changes (FIXED - removed orderTabs dependency)
  useEffect(() => {
    if (activeOrderId) {
      setOrderTabs(prev => {
        const currentTab = prev.get(activeOrderId)
        if (currentTab) {
          const updatedTab: OrderTab = {
            ...currentTab,
            cart: cart,
            total: cart.reduce((sum, l) => sum + l.price * l.quantity, 0)
          }
          return new Map(prev.set(activeOrderId, updatedTab))
        }
        return prev
      })
    }
  }, [cart, activeOrderId]) // Removed orderTabs from dependencies

  const addNewOrder = () => {
    const nextNumber = getNextOrderNumber()
    const newTab: OrderTab = {
      id: nextNumber,
      number: nextNumber,
      cart: [],
      total: 0,
      createdAt: new Date()
    }
    
    setOrderTabs(prev => new Map(prev.set(nextNumber, newTab)))
    setActiveOrderId(nextNumber)
    setCart([])
    setSelectedOrder(nextNumber)
  }

  const switchToOrder = (orderId: string) => {
    if (orderTabs.has(orderId)) {
      setActiveOrderId(orderId)
      setSelectedOrder(orderId)
      setCart(orderTabs.get(orderId)?.cart || [])
    }
  }

  // Load recent orders for Orders tab
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const orgId = userData?.organizationName || 'default'
        const fetchedOrders = await listRecentOrders(orgId, 30)
        if (active) setRecentOrders(fetchedOrders)
      } catch (e) {
        console.error(e)
      }
    })()
    return () => { active = false }
  }, [userData?.organizationName, toast])

  // Debounce search to avoid firing a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const handleBackClick = () => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      router.push('/modules')
    }, 200)
  }

  // Helpers
  const formatMoney = (ksh: number) => `KSh ${ksh.toFixed(2)}`

  // Add product to cart with duplicate prevention  
  const addProductToCart = useCallback(async (p: POSProduct) => {
    console.log('Adding product to cart:', p.name)
    
    // Prevent multiple rapid clicks
    if (addingToCart === p.id) {
      console.log('Already adding this product, ignoring duplicate click')
      return
    }
    setAddingToCart(p.id)
    
    // inventory check
    const orgId = userData?.organizationName || 'default'
    try {
      const inv = await getInventory(orgId, p.id)
      const totalPieces = inv ? inv.qtyBase * inv.unitsPerBase + inv.qtyLoose : 0
      
      // Skip inventory check if no inventory record exists (allow for testing)
      if (inv && totalPieces <= 0) {
        showGlassToast('Out of stock', `${p.name} is not available in inventory`)
        setAddingToCart(null)
        return
      }
      if (inv && totalPieces <= 3) {
        showGlassToast('Low stock warning', `${p.name}: ${totalPieces} ${p.retailUom} left`)
      }
    } catch (e) {
      console.warn('Inventory check failed, proceeding without stock validation:', e)
    }

    // Update cart atomically
    setCart(prev => {
      console.log('Current cart before update:', prev)
      const idx = prev.findIndex(line => line.productId === p.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        console.log('Updated existing item in cart:', next)
        return next
      }
      const newCart = [
        ...prev,
        { productId: p.id, name: p.name, price: p.piecePrice, quantity: 1, image: p.image },
      ]
      console.log('Added new item to cart:', newCart)
      return newCart
    })
    
    // Show glassmorphic success toast
    showGlassToast('Added to cart', p.name)
    
    // Reset adding state after a short delay
    setTimeout(() => setAddingToCart(null), 500)
  }, [addingToCart, userData?.organizationName, showGlassToast])

  const incrementLine = (productId: string) => {
    setCart(prev => prev.map(l => (l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l)))
  }

  const decrementLine = (productId: string) => {
    setCart(prev => prev
      .map(l => (l.productId === productId ? { ...l, quantity: l.quantity - 1 } : l))
      .filter(l => l.quantity > 0)
    )
  }

  const cartTotal = useMemo(() => cart.reduce((sum, l) => sum + l.price * l.quantity, 0), [cart])

  // Load products from Firestore with better error handling and caching
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    
    ;(async () => {
      // Show loading state immediately
      if (active) setLoading(true)
      
      try {
        const res = await listPOSProducts(userData?.organizationName || 'default', debouncedSearch, 100) // Increased limit for better UX
        console.log('DEBUG: Loaded products:', res.length, 'products')
        if (active && !controller.signal.aborted) {
          setProducts(res)
        }
      } catch (e) {
        if (active && !controller.signal.aborted) {
          console.error('ERROR: Failed to load products:', e)
          toast({ 
            title: 'Failed to load products', 
            description: e instanceof Error ? e.message : String(e),
            variant: 'destructive' 
          })
        }
      } finally {
        if (active && !controller.signal.aborted) {
          setLoading(false)
        }
      }
    })()
    
    return () => {
      active = false
      controller.abort()
    }
  }, [debouncedSearch, userData?.organizationName, toast])

  // Warm product cache on mount for faster initial grid paint
  useEffect(() => {
    (async () => {
      try {
        const orgId = userData?.organizationName || 'default'
        await listPOSProducts(orgId, undefined, 100)
      } catch {}
    })()
    // run once intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredProducts = products

  const tryQuickAddByCode = (input: string) => {
    const raw = input.trim().toLowerCase()
    if (!raw) return false
    // Match by piece or carton barcode, or exact id
    const byBarcode = products.find(p => p.pieceBarcode?.toLowerCase() === raw || p.cartonBarcode?.toLowerCase() === raw)
    if (byBarcode) { addProductToCart(byBarcode); return true }
    const byId = products.find(p => p.id.toLowerCase() === raw)
    if (byId) { addProductToCart(byId); return true }
    return false
  }

  return (
    <motion.div 
      className="flex flex-col h-[calc(100vh-2.5rem)] bg-slate-900 overflow-hidden"
      initial={{ x: 0, y: -300, rotate: 0, opacity: 0 }}
      animate={isExiting 
        ? { x: 0, y: -300, rotate: 0, opacity: 0 }
        : { x: 0, y: 0, rotate: 0, opacity: 1 }
      }
      transition={{ duration: 0.15, ease: [0.4, 0.0, 0.2, 1] }}
    >
      {/* Header */}
  <div className="bg-slate-900/40 backdrop-blur-sm" style={{WebkitAppRegion: 'drag'} as React.CSSProperties}>
        <div className="flex items-center justify-between px-4 py-3" style={{WebkitAppRegion: 'no-drag'} as React.CSSProperties}>
          <div className="flex items-center space-x-4">
            {/* Back Button */}
            <button 
              onClick={handleBackClick}
              className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.03] via-transparent to-green-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <ArrowLeft className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
            </button>
            
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
              {Array.from(orderTabs.keys()).map((orderId) => {
                const tab = orderTabs.get(orderId)!
                const isActive = orderId === activeOrderId
                return (
                  <motion.button
                    key={orderId}
                    whileHover={{ scale: 1.08, backgroundColor: 'rgba(16,185,129,0.18)' }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    type="button"
                    className={`px-3 py-1 text-sm rounded relative ${
                      isActive 
                        ? 'bg-green-600 text-white' 
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    onClick={() => switchToOrder(orderId)}
                  >
                    {tab.number}
                    {tab.cart.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full text-xs flex items-center justify-center text-white">
                        {tab.cart.reduce((sum, item) => sum + item.quantity, 0)}
                      </span>
                    )}
                  </motion.button>
                )
              })}
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
                ref={searchRef}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const ok = tryQuickAddByCode(searchTerm)
                    if (!ok && filteredProducts.length === 1) {
                      addProductToCart(filteredProducts[0])
                    }
                    setSearchTerm('')
                  }
                }}
                placeholder="Search name/brand or scan code…" 
                className="bg-gradient-to-r from-white/[0.08] to-white/[0.04] backdrop-blur-md border border-white/[0.08] hover:border-white/[0.15] text-white placeholder-slate-400 pr-8 w-64 transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] focus:shadow-[0_8px_24px_-8px_rgba(59,130,246,0.2)] focus:border-blue-400/30"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <div className="w-8 h-8 rounded-lg backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                  <Search className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            </div>
            <button 
              onClick={() => searchRef.current?.focus()}
              className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105"
            >
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
              {Array.from(orderTabs.entries()).map(([orderId, tab]) => (
                <motion.button
                  key={orderId}
                  whileHover={{ scale: 1.08, backgroundColor: 'rgba(16,185,129,0.18)' }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  type="button"
                  className={`h-12 relative ${
                    activeOrderId === orderId 
                      ? 'bg-green-600 text-white border-green-600' 
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                  onClick={() => {
                    switchToOrder(orderId);
                    setShowOrderModal(false);
                  }}
                >
                  {tab.number}
                  {tab.cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full text-xs flex items-center justify-center text-white">
                      {tab.cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  )}
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
                onClick={() => {
                  addNewOrder();
                  setShowOrderModal(false);
                }}
              >
                + New Order
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.08, backgroundColor: 'rgba(239,68,68,0.18)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300 }}
                type="button"
                className="h-12 bg-slate-900 text-slate-300 border-slate-700 hover:bg-red-800 hover:text-red-300"
                onClick={() => {
                  if (orderTabs.size > 1 && activeOrderId) {
                    const newTabs = new Map(orderTabs)
                    newTabs.delete(activeOrderId)
                    setOrderTabs(newTabs)
                    const remainingIds = Array.from(newTabs.keys())
                    if (remainingIds.length > 0) {
                      switchToOrder(remainingIds[0])
                    }
                  }
                  setShowOrderModal(false);
                }}
                disabled={orderTabs.size <= 1}
              >
                Delete Order
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
                        const originalIndex = i % cart.length
                        return (
                          <motion.div 
                            key={`${originalIndex}-${Math.floor(i / cart.length)}`}
                            className="h-16 flex items-center px-4 cursor-pointer transition-all duration-300 hover:bg-slate-800/50 wheel-item picker-item"
                            whileHover={{ scale: 1.02, x: 4 }}
                          >
                            <div className="flex justify-between items-center w-full">
                              <div className="flex-1">
                                <div className="font-medium text-white text-sm truncate">{item.name}</div>
                                <div className="text-xs text-slate-400">{formatMoney(item.price)}</div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-xs"
                                  onClick={() => {
                                    const pid = cart[originalIndex].productId
                                    decrementLine(pid)
                                  }}
                                >-</Button>
                                <span className="text-white text-sm w-6 text-center">{item.quantity}</span>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-xs"
                                  onClick={() => {
                                    const pid = cart[originalIndex].productId
                                    incrementLine(pid)
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
                    <span>{formatMoney(cartTotal)}</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(16,185,129,0.18)' }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="w-full bg-gradient-to-r from-green-300 via-green-400 to-slate-800 text-white font-semibold text-lg py-3 rounded-lg"
                    onClick={async () => {
                      const orgId = userData?.organizationName || 'default'
                      const userId = userData?.uid || 'anonymous'
                      const lines: POSOrderLine[] = cart.map(l => ({
                        productId: l.productId,
                        name: l.name,
                        quantityPieces: l.quantity,
                        unitPrice: l.price,
                        lineTotal: l.quantity * l.price,
                      }))
                      
                      // Add order ID to the order
                      const orderNumber = activeOrderId || selectedOrder
                      
                      try {
                        await addPosOrder(orgId, userId, lines)
                        const itemsCount = cart.reduce((n, l) => n + l.quantity, 0)
                        toast({ 
                          title: 'Order completed!', 
                          description: `Order #${orderNumber} • ${itemsCount} item(s) • ${formatMoney(cartTotal)}` 
                        })
                        
                        // Clear current tab and create new one if this was the last tab
                        setCart([])
                        if (orderTabs.size === 1) {
                          // Create a new order tab
                          addNewOrder()
                        } else {
                          // Just clear current tab
                          if (activeOrderId && orderTabs.has(activeOrderId)) {
                            const clearedTab: OrderTab = {
                              ...orderTabs.get(activeOrderId)!,
                              cart: [],
                              total: 0
                            }
                            setOrderTabs(prev => new Map(prev.set(activeOrderId, clearedTab)))
                          }
                        }
                        
                        // Refresh recent orders list
                        const refreshedOrders = await listRecentOrders(orgId, 30)
                        setRecentOrders(refreshedOrders)
                      } catch (e) {
                        console.error('Order failed:', e)
                        toast({ 
                          title: 'Failed to complete order', 
                          description: e instanceof Error ? e.message : String(e),
                          variant: 'destructive'
                        })
                      }
                    }}
                  >
                    Complete Order #{activeOrderId}
                  </motion.button>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Product Grid */}
          <div className="flex-1 overflow-hidden relative">
            {loading && (
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-10">
                <LoadingSpinner size="md" />
              </div>
            )}
            <div className="h-full overflow-y-auto thin-scroll">
              <div className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                  {/* Real Products */}
                  {filteredProducts.map((p) => {
                    const productImage = resolveProductImage(p)

                    return (
                      <motion.div
                        key={p.id}
                        whileHover={{ scale: 1.08, y: -8 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                        className="group relative rounded-3xl overflow-hidden backdrop-blur-2xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-slate-900/45 to-emerald-900/35 transition-all duration-500 shadow-[0_12px_36px_-20px_rgba(15,118,110,0.32)] hover:border-emerald-300/40 hover:shadow-[0_24px_58px_-28px_rgba(5,150,105,0.36)] cursor-pointer"
                        onClick={() => addProductToCart(p)}
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/14" />
                          <div className="absolute inset-0 blur-2xl bg-emerald-500/08" />
                        </div>

                        <div className="relative aspect-square w-full overflow-hidden bg-[#0f172b]">
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-emerald-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                          {productImage ? (
                            <img
                              src={productImage}
                              alt={p.name}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-[0.6deg]"
                              loading="lazy"
                              style={{ backgroundColor: '#0f172b' }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="w-16 h-16 text-slate-400 transition-all duration-700 group-hover:scale-125 group-hover:text-emerald-200/90 group-hover:-translate-y-1" />
                            </div>
                          )}

                          <div className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/14 opacity-0 backdrop-blur-md transition-all duration-300 transform scale-75 group-hover:scale-100 group-hover:opacity-100">
                            <Plus className="h-4 w-4 text-emerald-200" />
                          </div>

                          <div className="absolute inset-x-6 bottom-6 h-px rounded-full bg-gradient-to-r from-transparent via-emerald-300/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        </div>

                        <div className="relative p-4">
                          <h4 className="text-slate-200 font-medium text-sm truncate transition-colors duration-300 group-hover:text-white">{p.name}</h4>
                          <div className="mt-2 flex items-center justify-between text-xs opacity-70 group-hover:opacity-100 transition-all duration-500 transform translate-y-1 group-hover:translate-y-0">
                            <span className="text-emerald-300 font-semibold text-sm">{formatMoney(p.piecePrice)}</span>
                            <span className="px-2 py-1 rounded-full border border-slate-500/40 bg-slate-900/40 text-slate-300 group-hover:text-white backdrop-blur-md">
                              {p.retailUom}
                            </span>
                          </div>
                        </div>

                        <div className="pointer-events-none absolute inset-0">
                          <div className="absolute inset-0 border border-white/5 opacity-0 group-hover:opacity-35 transition-opacity duration-500 rounded-3xl" />
                          <div className="absolute -top-20 -left-16 h-44 w-44 rounded-full bg-emerald-500/18 blur-3xl opacity-0 group-hover:opacity-70 transition-opacity duration-700" />
                        </div>

                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-200/5 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-1000" />
                        </div>
                      </motion.div>
                    )
                  })}
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
            <div className="bg-slate-900/40 backdrop-blur-sm px-6 py-4 border-b border-slate-500/30">
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
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between px-6 py-4 border-b border-slate-500/30 hover:bg-slate-800/50 cursor-pointer">
                  <div className="flex items-center space-x-6">
                    <div className="text-left">
                      <div className="text-slate-300 text-sm">{new Date(order.createdAt).toLocaleDateString()}</div>
                      <div className="text-slate-400 text-xs">{new Date(order.createdAt).toLocaleTimeString()}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-white font-medium">{order.id}</div>
                      <div className="text-slate-400 text-sm">{order.lines?.length ?? 0} items</div>
                    </div>
                  </div>
                  <div className="text-white font-medium">
                    {formatMoney(order.total || 0)}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded text-sm ${order.status === 'paid' ? 'bg-green-600 text-white' : 'bg-slate-600 text-white'}`}>
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
          <div className="w-1/3 border-l border-slate-500/30 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center text-slate-400">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <p className="text-lg">Select an order or scan QR code</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Glassmorphic Toast Container */}
      <ToastContainer />
    </motion.div>
  )
}