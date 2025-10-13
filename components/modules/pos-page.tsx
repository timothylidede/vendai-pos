'use client'

import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  ScanBarcode,
  ShoppingCart,
  Trash2,
  Plus,
  ChevronDown,
  X,
  Search,
  Package,
  ArrowLeft,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react'
import { motion } from 'framer-motion'
import type { POSProduct, POSOrderLine, POSOrderDoc } from '@/lib/types'
import { cn } from '@/lib/utils'
// Gradually migrating to optimized operations
import { listPOSProducts, listRecentOrders, getInventory } from '@/lib/pos-operations-optimized'
import { useAuth } from '@/contexts/auth-context'
import { useHardware } from '@/contexts/hardware-context'
import { useToast } from '@/hooks/use-toast'
import { useGlassmorphicToast } from '../ui/glassmorphic-toast'
import { LoadingSpinner } from '../loading-spinner'
import { POSCheckoutModal, type CheckoutResult } from './pos-checkout-modal'
import { useProcessPayment } from '@/lib/payments'
import type { ProcessCheckoutSuccess } from '@/lib/payments'
import { ReceiptPreview } from '@/components/receipts/receipt-preview'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { downloadPdf, type ReceiptPreviewBundle } from '@/lib/receipts'
import { useScannerFocus } from '@/lib/scanner-focus'
import { HardwareStatusStrip } from '@/components/hardware-status-strip'
import { EnhancedSalesTab } from './enhanced-sales-tab'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOfflineMode } from '@/hooks/use-offline-mode'
import { OfflineStatus, OfflineIndicatorMini } from '@/components/offline-status'
import { ConflictResolutionDialog, type ConflictOrder } from '@/components/conflict-resolution-dialog'
import { getOfflineQueueManager } from '@/lib/offline-queue'
import { addPosOrder } from '@/lib/pos-operations-optimized'

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

const DEFAULT_LANES = ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4']

export function POSPage() {
  const [headerCollapsed, setHeaderCollapsed] = useState(true)
  const [cart, setCart] = useState<CartLine[]>([])
  const [activeTab, setActiveTab] = useState<'register' | 'sales'>('register')
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
  const [selectedCartIndex, setSelectedCartIndex] = useState(0)
  const [lastInteractedProductId, setLastInteractedProductId] = useState<string | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)
  const { processCheckout } = useProcessPayment()
  const { openCashDrawer, status: hardwareStatus, hardwareAvailable } = useHardware()

  const [recentOrders, setRecentOrders] = useState<POSOrderDoc[]>([])
  const [receiptPreviewBundle, setReceiptPreviewBundle] = useState<ReceiptPreviewBundle | null>(null)
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [hardwareStatusCollapsed, setHardwareStatusCollapsed] = useState(true)
  
  // Enhanced persistent order tabs
  const [orderTabs, setOrderTabs] = useState<Map<string, OrderTab>>(new Map())
  const [activeOrderId, setActiveOrderId] = useState<string>('001')

  const [laneId, setLaneId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Lane 1'
    return localStorage.getItem('pos-active-lane') ?? 'Lane 1'
  })
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('pos-active-device') ?? null
  })
  const [laneOptions, setLaneOptions] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_LANES
    try {
      const stored = localStorage.getItem('pos-lanes')
      if (!stored) return DEFAULT_LANES
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.every((lane) => typeof lane === 'string' && lane.trim().length > 0)) {
        return parsed as string[]
      }
      return DEFAULT_LANES
    } catch (error) {
      console.warn('Failed to parse stored lanes. Falling back to defaults.', error)
      return DEFAULT_LANES
    }
  })
  const [laneManagerOpen, setLaneManagerOpen] = useState(false)
  const [laneDrafts, setLaneDrafts] = useState<string[]>(DEFAULT_LANES)
  const [mobileLaneDeviceOpen, setMobileLaneDeviceOpen] = useState(false)

  // Offline mode
  const {
    isOffline,
    queueStats,
    queueOrder,
    syncQueue,
    isSyncing,
    lastSyncAt,
    autoSyncEnabled,
    toggleAutoSync
  } = useOfflineMode()

  // Conflict resolution
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictOrder[]>([])

  // Load conflicts when queue stats change
  useEffect(() => {
    const loadConflicts = async () => {
      if (queueStats && queueStats.conflicts > 0) {
        try {
          const queueManager = getOfflineQueueManager()
          const conflictTransactions = await queueManager.getQueuedTransactions('conflict')
          const mapped: ConflictOrder[] = conflictTransactions.map(tx => ({
            id: tx.id,
            orderNumber: tx.options?.receiptNumber,
            lines: tx.lines,
            metadata: {
              orgId: tx.orgId,
              cashierName: userData?.displayName || 'Unknown',
              laneId: tx.options?.laneId,
              queuedAt: tx.queuedAt
            },
            error: tx.error || null,
            retryCount: tx.attemptCount
          }))
          setConflicts(mapped)
        } catch (error) {
          console.error('Failed to load conflicts:', error)
        }
      } else {
        setConflicts([])
      }
    }
    loadConflicts()
  }, [queueStats, userData])

  // Handle conflict resolution
  const handleResolveConflict = useCallback(async (id: string, resolution: 'skip' | 'force') => {
    const queueManager = getOfflineQueueManager()
    
    if (resolution === 'skip') {
      await queueManager.resolveConflict(id, 'skip')
      toast({
        title: 'Conflict skipped',
        description: 'The order has been removed from the sync queue.'
      })
    } else if (resolution === 'force') {
      const orgId = userData?.organizationName || 'default'
      await queueManager.resolveConflict(id, 'force', async (orgId, userId, lines, options) => {
        return await addPosOrder(orgId, userId, lines, options)
      })
      toast({
        title: 'Order synced',
        description: 'The order was forced to sync successfully.'
      })
    }
  }, [userData, toast])

  // Show conflict dialog when conflicts are detected
  useEffect(() => {
    if (conflicts.length > 0 && !conflictDialogOpen) {
      setConflictDialogOpen(true)
    }
  }, [conflicts.length, conflictDialogOpen])

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('pos-active-lane', laneId)
  }, [laneId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (selectedDeviceId) {
      localStorage.setItem('pos-active-device', selectedDeviceId)
    } else {
      localStorage.removeItem('pos-active-device')
    }
  }, [selectedDeviceId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!laneOptions.length) return
    localStorage.setItem('pos-lanes', JSON.stringify(laneOptions))
  }, [laneOptions])

  useEffect(() => {
    if (!laneOptions.length) {
      setLaneOptions(DEFAULT_LANES)
      return
    }
    if (!laneOptions.includes(laneId)) {
      setLaneId(laneOptions[0])
    }
  }, [laneOptions, laneId])

  useEffect(() => {
    if (laneManagerOpen) {
      setLaneDrafts(laneOptions)
    }
  }, [laneManagerOpen, laneOptions])

  useEffect(() => {
    const devices = [...(hardwareStatus?.scanners ?? []), ...(hardwareStatus?.cardReaders ?? [])]
    if (devices.length === 0) {
      setSelectedDeviceId((prev) => prev ?? null)
      return
    }
    const firstAvailable = devices.find((device) => device.connected) ?? devices[0]
    setSelectedDeviceId((prev) => {
      if (prev && devices.some((device) => device.id === prev)) {
        return prev
      }
      return firstAvailable?.id ?? prev ?? null
    })
  }, [hardwareStatus])

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

  const deviceOptions = useMemo(() => {
    const devices = [...(hardwareStatus?.scanners ?? []), ...(hardwareStatus?.cardReaders ?? [])]
    return devices.map((device) => ({
      id: device.id,
      label: device.label || device.id,
      connected: device.connected,
      simulated: device.simulated,
      type: device.type,
    }))
  }, [hardwareStatus])

  const activeDevice = useMemo(() => {
    if (!selectedDeviceId) return null
    return deviceOptions.find((device) => device.id === selectedDeviceId) ?? null
  }, [deviceOptions, selectedDeviceId])

  const deviceSelectValue = selectedDeviceId ?? 'no-device'
  const deviceStatusLabel = activeDevice
    ? `${activeDevice.connected ? 'Online' : 'Offline'}${activeDevice.simulated ? ' • Simulated' : ''}`
    : hardwareAvailable
      ? 'No device selected'
      : 'Simulated device mode'


  const switchToOrder = (orderId: string) => {
    if (orderTabs.has(orderId)) {
      setActiveOrderId(orderId)
      setSelectedOrder(orderId)
      setCart(orderTabs.get(orderId)?.cart || [])
    }
  }

  const handleLaneDraftChange = useCallback((index: number, value: string) => {
    setLaneDrafts((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }, [])

  const handleLaneDraftAdd = useCallback(() => {
    setLaneDrafts((prev) => [...prev, `Lane ${prev.length + 1}`])
  }, [])

  const handleLaneDraftRemove = useCallback((index: number) => {
    setLaneDrafts((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, idx) => idx !== index)
    })
  }, [])

  const handleLaneManagerSave = useCallback(() => {
    const normalized = laneDrafts
      .map((lane, idx) => lane.trim() || `Lane ${idx + 1}`)
      .filter((lane, idx, arr) => arr.findIndex((candidate) => candidate.toLowerCase() === lane.toLowerCase()) === idx)

    const nextLanes = normalized.length > 0 ? normalized : [...DEFAULT_LANES]
    setLaneOptions(nextLanes)
    if (!nextLanes.includes(laneId)) {
      setLaneId(nextLanes[0])
    }
    setLaneManagerOpen(false)
    showGlassToast('Lane presets updated', `Now tracking ${nextLanes.length} checkout lane${nextLanes.length === 1 ? '' : 's'}.`)
  }, [laneDrafts, laneId, showGlassToast])

  // Load recent sales for Sales tab
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

  const handleDownloadReceiptPdf = useCallback(() => {
    if (!receiptPreviewBundle?.artifacts) {
      showGlassToast('Receipt unavailable', 'No receipt artifacts to download yet.')
      return
    }

    if (receiptPreviewBundle.artifacts.pdfBytes) {
      downloadPdf(
        receiptPreviewBundle.artifacts.pdfBytes,
        `${receiptPreviewBundle.result.receipt.receiptNumber}.pdf`,
      )
      return
    }

    showGlassToast('PDF not ready', 'The PDF copy is still generating. Try again shortly.')
  }, [receiptPreviewBundle, showGlassToast])

  const handlePrintReceipt = useCallback(async () => {
    if (!receiptPreviewBundle) {
      showGlassToast('Receipt unavailable', 'No receipt data available to print yet.')
      return
    }

    const escposBase64 =
      receiptPreviewBundle.artifacts?.escposBase64 ||
      (typeof receiptPreviewBundle.result.receipt.metadata?.escposBase64 === 'string'
        ? (receiptPreviewBundle.result.receipt.metadata?.escposBase64 as string)
        : undefined)

    if (typeof window !== 'undefined' && window.electronAPI?.receiptPrinter?.printEscPos && escposBase64) {
      try {
        await window.electronAPI.receiptPrinter.printEscPos({
          commandsBase64: escposBase64,
          jobName: receiptPreviewBundle.result.receipt.receiptNumber,
        })
        showGlassToast('Receipt sent to printer', receiptPreviewBundle.result.receipt.receiptNumber)
        return
      } catch (error) {
        console.error('ESC/POS print failed', error)
        showGlassToast('Printer error', error instanceof Error ? error.message : 'Failed to print receipt')
      }
    }

    if (typeof window !== 'undefined') {
      const previewWindow = window.open('', '_blank', 'width=420,height=600')
      if (previewWindow) {
        previewWindow.document.write(receiptPreviewBundle.artifacts?.html ?? '')
        previewWindow.document.close()
        previewWindow.focus()
        previewWindow.print()
        previewWindow.close()
      } else {
        window.print()
      }
    }
  }, [receiptPreviewBundle, showGlassToast])

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
    setLastInteractedProductId(p.id)
    
    // Show glassmorphic success toast
    showGlassToast('Added to cart', p.name)
    
    // Reset adding state after a short delay
    setTimeout(() => setAddingToCart(null), 500)
  }, [addingToCart, userData?.organizationName, showGlassToast])

  const incrementLine = (productId: string) => {
    setCart(prev => prev.map(l => (l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l)))
    setLastInteractedProductId(productId)
  }

  const decrementLine = (productId: string) => {
    setCart(prev => prev
      .map(l => (l.productId === productId ? { ...l, quantity: l.quantity - 1 } : l))
      .filter(l => l.quantity > 0)
    )
    setLastInteractedProductId(productId)
  }

  const cartTotal = useMemo(() => cart.reduce((sum, l) => sum + l.price * l.quantity, 0), [cart])
  const checkoutLines = useMemo(
    () =>
      cart.map((line) => ({
        productId: line.productId,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.price,
        lineTotal: line.price * line.quantity,
        image: line.image,
      })),
    [cart],
  )

  useEffect(() => {
    if (cart.length === 0) {
      setSelectedCartIndex(0)
      return
    }
    setSelectedCartIndex(prev => Math.min(prev, cart.length - 1))
  }, [cart.length])

  useEffect(() => {
    if (!lastInteractedProductId) return
    const idx = cart.findIndex(line => line.productId === lastInteractedProductId)
    if (idx >= 0 && idx !== selectedCartIndex) {
      setSelectedCartIndex(idx)
    }
  }, [cart, lastInteractedProductId, selectedCartIndex])

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

  const tryQuickAddByCode = useCallback((input: string) => {
    const raw = input.trim().toLowerCase()
    if (!raw) return false
    const byBarcode = products.find(
      (p) => p.pieceBarcode?.toLowerCase() === raw || p.cartonBarcode?.toLowerCase() === raw,
    )
    if (byBarcode) {
      addProductToCart(byBarcode)
      return true
    }
    const byId = products.find((p) => p.id.toLowerCase() === raw)
    if (byId) {
      addProductToCart(byId)
      return true
    }
    return false
  }, [addProductToCart, products])

  const handleBarcodeScan = useCallback(
    (raw: string) => {
      const code = raw.trim()
      if (!code) return

      const added = tryQuickAddByCode(code)
      if (added) {
        showGlassToast('Scanned', code)
        setSearchTerm('')
        return
      }

      const normalized = code.toLowerCase()
      const candidate = products.find((product) =>
        product.name?.toLowerCase().includes(normalized) || product.id.toLowerCase() === normalized,
      )

      if (candidate) {
        addProductToCart(candidate)
        showGlassToast('Scanned', candidate.name)
        setSearchTerm('')
        return
      }

      setSearchTerm(code)
      showGlassToast('Barcode not found', code)
    },
    [addProductToCart, products, showGlassToast, tryQuickAddByCode],
  )

  const { attach: attachScannerInput, focus: focusScannerInput } = useScannerFocus({
    targetRef: searchRef,
    onScan: handleBarcodeScan,
    updateInputValue: false,
  })

  const handleCheckoutSubmit = useCallback(async (result: CheckoutResult) => {
    const orgId = userData?.organizationName || 'default'
    const userId = userData?.uid || 'anonymous'

    if (cart.length === 0) {
      throw new Error('Cart is empty. Add items before checking out.')
    }

    const orderLines: POSOrderLine[] = cart.map((line) => ({
      productId: line.productId,
      name: line.name,
      quantityPieces: line.quantity,
      unitPrice: line.price,
      lineTotal: line.quantity * line.price,
    }))

    const orderNumber = activeOrderId || selectedOrder
    const receiptSuffix = Date.now().toString().slice(-6)
    const receiptNumber = `POS-${orderNumber}-${receiptSuffix}`
    const itemsCount = cart.reduce((count, line) => count + line.quantity, 0)

    const checkoutContext = {
      ...result.checkoutContext,
      registerId: result.checkoutContext.registerId ?? activeOrderId,
      deviceId: result.checkoutContext.deviceId ?? selectedDeviceId ?? undefined,
      subtotal: cartTotal,
      grandTotal: cartTotal,
      payments: result.checkoutContext.payments ?? result.payments,
      metadata: {
        ...(result.checkoutContext.metadata ?? {}),
        orderNumber,
        customerType: result.customerType,
        laneId,
        deviceId: selectedDeviceId ?? undefined,
      },
    }

    setCheckoutSubmitting(true)

    const finalizeSuccess = async (response: ProcessCheckoutSuccess) => {
      const statusCopy = response.status === 'paid' ? 'paid in full' : 'awaiting payment'
      toast({
        title: response.status === 'paid' ? 'Sale completed' : 'Sale saved with balance due',
        description: `Order #${orderNumber} • ${itemsCount} item(s) • ${formatMoney(cartTotal)} • ${statusCopy}`,
      })

      if (response.receiptBundle) {
        setReceiptPreviewBundle({
          result: response.receiptBundle,
          artifacts: response.receiptArtifacts,
        })
        setReceiptDialogOpen(true)
      }

      setCart([])

      if (orderTabs.size === 1) {
        addNewOrder()
      } else if (activeOrderId && orderTabs.has(activeOrderId)) {
        setOrderTabs((prev) => {
          const next = new Map(prev)
          const currentTab = next.get(activeOrderId)
          if (currentTab) {
            next.set(activeOrderId, {
              ...currentTab,
              cart: [],
              total: 0,
            })
          }
          return next
        })
      }

      try {
        const refreshedOrders = await listRecentOrders(orgId, 30)
        setRecentOrders(refreshedOrders)
      } catch (refreshError) {
        console.error('Failed to refresh recent orders:', refreshError)
      }

      setCheckoutOpen(false)
      showGlassToast('Checkout complete', `Order #${orderNumber} ${statusCopy}`)
    }

    try {
      // If offline, queue the order instead of processing immediately
      if (isOffline) {
        const queuedId = await queueOrder(orgId, userId, orderLines, {
          cashierId: userId,
          laneId,
          deviceId: selectedDeviceId ?? undefined,
          receiptNumber,
          status: result.status,
        })

        toast({
          title: 'Order queued (Offline)',
          description: `Order #${orderNumber} saved locally and will sync when connection is restored.`,
          variant: 'default'
        })

        // Simulate a successful offline checkout
        const offlineResponse: ProcessCheckoutSuccess = {
          success: true,
          orderId: queuedId,
          status: result.status,
          receiptBundle: undefined,
          receiptArtifacts: undefined,
          payments: [],
          paymentSummary: { totalApplied: 0, totalTendered: 0, totalChange: 0, balanceDue: 0 },
          balanceDue: 0
        }

        await finalizeSuccess(offlineResponse)
        return
      }

      const response = await processCheckout({
        orgId,
        userId,
        registerId: activeOrderId,
        lines: orderLines,
        total: cartTotal,
        payments: result.payments,
        checkoutContext,
        status: result.status,
        balanceDue: result.balanceDue,
        notes: result.notes,
        receiptNumber,
        cashierId: userId,
        laneId,
        deviceId: selectedDeviceId ?? undefined,
        events: {
          onInfo: (message) => showGlassToast('Payment update', message),
          onStatus: (status) => console.debug('[payments] status', status),
          onError: (message) =>
            toast({
              title: 'Payment notice',
              description: message,
            }),
          onOpenCashDrawer: async () => {
            const opened = await openCashDrawer()
            if (!opened) {
              showGlassToast('Drawer warning', 'Unable to trigger cash drawer automatically.')
            }
          },
        },
      })

      if (!response.success) {
        const failure = response.error
        let toastController: ReturnType<typeof toast> | null = null

        const updateToast = (title: string, description: ReactNode) => {
          if (!toastController) return
          toastController.update({
            id: toastController.id,
            title,
            description,
          })
        }

        async function handleRetryFromToast() {
          if (!failure.retry) return
          setCheckoutSubmitting(true)
          updateToast('Retrying payment…', renderToastContent('Retrying payment. Confirm the terminal response.'))
          try {
            const retryResult = await failure.retry()
            if (retryResult?.success) {
              toastController?.dismiss()
              await finalizeSuccess(retryResult)
            } else if (retryResult?.error) {
              updateToast('Payment still failing', renderToastContent(retryResult.error.message))
            }
          } catch (retryError) {
            console.error('Retry failed:', retryError)
            const message =
              retryError instanceof Error ? retryError.message : 'Retry attempt failed unexpectedly.'
            updateToast('Retry failed', renderToastContent(message))
          } finally {
            setCheckoutSubmitting(false)
          }
        }

        async function handleCancelFromToast() {
          if (!failure.cancel) return
          updateToast('Voiding order…', 'Cancelling the order. Please wait…')
          try {
            await failure.cancel()
            toastController?.dismiss()
            toast({
              title: 'Order cancelled',
              description: `Order #${orderNumber} was voided.`,
            })
            setCheckoutOpen(false)
          } catch (cancelError) {
            console.error('Cancel failed:', cancelError)
            const message =
              cancelError instanceof Error ? cancelError.message : 'Unable to cancel the order.'
            updateToast('Cancel failed', renderToastContent(message))
          } finally {
            setCheckoutSubmitting(false)
          }
        }

        function renderToastContent(message: string) {
          return (
            <div className="flex flex-col gap-3">
              <span>{message}</span>
              <div className="flex gap-2">
                {failure.retry && (
                  <Button size="sm" variant="secondary" onClick={handleRetryFromToast}>
                    Retry
                  </Button>
                )}
                {failure.cancel && (
                  <Button size="sm" variant="ghost" onClick={handleCancelFromToast}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )
        }

        toastController = toast({
          variant: 'destructive',
          title: 'Payment failed',
          description: renderToastContent(failure.message),
        })

        throw failure
      }

      await finalizeSuccess(response)
    } catch (error) {
      console.error('Checkout failed:', error)
      const description = error instanceof Error ? error.message : 'Unexpected error during checkout.'
      toast({
        title: 'Checkout failed',
        description,
        variant: 'destructive',
      })
      throw error instanceof Error ? error : new Error(description)
    } finally {
      setCheckoutSubmitting(false)
    }
  }, [
    userData?.organizationName,
    userData?.uid,
    cart,
    cartTotal,
    activeOrderId,
    selectedOrder,
    orderTabs,
    addNewOrder,
    setOrderTabs,
    setCart,
    showGlassToast,
    processCheckout,
    setCheckoutOpen,
    setRecentOrders,
    toast,
    openCashDrawer,
    laneId,
    selectedDeviceId,
  ])

  return (
    <motion.div 
      className="module-background flex flex-col h-[calc(100vh-2.5rem)] overflow-hidden"
      initial={{ x: 0, y: -300, rotate: 0, opacity: 0 }}
      animate={isExiting 
        ? { x: 0, y: -300, rotate: 0, opacity: 0 }
        : { x: 0, y: 0, rotate: 0, opacity: 1 }
      }
      transition={{ duration: 0.15, ease: [0.4, 0.0, 0.2, 1] }}
    >
      {/* Mobile Offline Indicator */}
      <OfflineIndicatorMini isOffline={isOffline} />
      
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
                  ${activeTab === 'sales' 
                    ? 'text-green-400 backdrop-blur-md bg-gradient-to-r from-green-500/[0.15] to-green-500/[0.08] border border-green-500/30 shadow-[0_4px_16px_-8px_rgba(34,197,94,0.3)]' 
                    : 'text-slate-200 hover:text-green-400 hover:bg-white/[0.05] backdrop-blur-sm'}`}
                onClick={() => setActiveTab('sales')}
              >
                <span className="relative">
                  Sales
                  {activeTab === 'sales' && (
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
            {/* Offline Status Indicator */}
            <OfflineStatus
              isOffline={isOffline}
              queuedCount={queueStats?.pending ?? 0}
              isSyncing={isSyncing}
              failedCount={queueStats?.failed ?? 0}
              conflictsCount={queueStats?.conflicts ?? 0}
              onSyncClick={() => syncQueue()}
              compact
              className="hidden sm:flex"
            />

            <div className="hidden sm:flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
              <div className="flex flex-col text-left min-w-[9rem]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Lane</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full border border-white/10 bg-slate-950/60 text-slate-300 hover:text-white"
                    onClick={() => setLaneManagerOpen(true)}
                    aria-label="Manage checkout lanes"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Select value={laneId} onValueChange={setLaneId}>
                  <SelectTrigger className="mt-2 h-9 w-full border-white/10 bg-slate-950/70 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-900/95 text-slate-100">
                    {laneOptions.map((lane) => (
                      <SelectItem value={lane} key={lane}>
                        {lane}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="mt-1 text-[11px] text-slate-400">Active lane for this checkout</span>
              </div>
              <div className="flex flex-col text-left min-w-[12rem]">
                <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Device</span>
                <Select
                  value={deviceSelectValue}
                  onValueChange={(value) => setSelectedDeviceId(value === 'no-device' ? null : value)}
                >
                  <SelectTrigger className="mt-2 h-9 w-full border-white/10 bg-slate-950/70 text-slate-100">
                    <SelectValue placeholder={hardwareAvailable ? 'Select device' : 'Simulated device'} />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-900/95 text-slate-100">
                    <SelectItem value="no-device">
                      {hardwareAvailable ? 'No device selected' : 'Simulated device'}
                    </SelectItem>
                    {deviceOptions.map((device) => (
                      <SelectItem value={device.id} key={device.id}>
                        <div className="flex flex-col">
                          <span>{device.label}</span>
                          <span className="text-xs text-slate-400">
                            {device.connected ? 'Online' : 'Offline'}
                            {device.simulated ? ' • Simulated' : ''}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="mt-1 text-[11px] text-slate-400">{deviceStatusLabel}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileLaneDeviceOpen(true)}
              className="sm:hidden group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105"
              aria-label="Lane and device settings"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.03] via-transparent to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <SlidersHorizontal className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
            </button>
            <div className="relative">
              <Input 
                ref={attachScannerInput}
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
                placeholder="Search…" 
                className="bg-gradient-to-r from-white/[0.08] to-white/[0.04] backdrop-blur-md border border-white/[0.08] hover:border-white/[0.15] text-white placeholder-slate-400 pr-8 w-64 transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] focus:shadow-[0_8px_24px_-8px_rgba(59,130,246,0.2)] focus:border-blue-400/30"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <div className="w-8 h-8 rounded-lg backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                  <Search className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            </div>
            <button 
              onClick={focusScannerInput}
              className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <ScanBarcode className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors duration-300" />
            </button>
            <button 
              onClick={() => setHardwareStatusCollapsed(!hardwareStatusCollapsed)}
              className="group relative w-10 h-10 rounded-xl backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-300 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-pink-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              <span className={`relative text-slate-300 group-hover:text-white transition-colors duration-300 font-medium transform ${hardwareStatusCollapsed ? 'rotate-90' : ''}`}>☰</span>
            </button>
          </div>
        </div>
      </div>

        {!hardwareStatusCollapsed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="px-4 py-3 bg-slate-900/30 border-b border-white/10 overflow-hidden"
          >
            <HardwareStatusStrip className="max-w-4xl" />
          </motion.div>
        )}

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
              {/* Cart Items */}
              <div className="flex-1 overflow-hidden">
                {cart.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <div className="text-center">
                      <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                      <p>Start adding products</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto thin-scroll px-6 pt-8 pb-24 space-y-3">
                    {cart.map((line, idx) => {
                      const isActive = idx === selectedCartIndex
                      return (
                        <motion.div
                          key={line.productId}
                          className={cn(
                            'flex items-center gap-4 rounded-2xl border border-white/6 bg-slate-800/35 px-4 py-3 transition-all duration-300 backdrop-blur-md shadow-[0_10px_24px_-20px_rgba(15,118,110,0.35)]',
                            isActive
                              ? 'selected border-emerald-400/35 bg-emerald-500/12 shadow-[0_14px_32px_-26px_rgba(16,185,129,0.45)]'
                              : 'hover:border-emerald-400/20 hover:bg-slate-800/55'
                          )}
                          whileHover={{ scale: 1.01, x: 4 }}
                          onClick={() => {
                            setSelectedCartIndex(idx)
                            setLastInteractedProductId(line.productId)
                          }}
                        >
                          <div className="relative">
                            {line.image ? (
                              <img
                                src={line.image}
                                alt={line.name}
                                className={cn(
                                  'h-12 w-12 rounded-xl object-cover border border-white/10 shadow-inner transition-all duration-300',
                                  isActive ? 'ring-2 ring-emerald-300/70' : ''
                                )}
                              />
                            ) : (
                              <div
                                className={cn(
                                  'h-12 w-12 rounded-xl border border-white/10 bg-slate-900/60 flex items-center justify-center text-slate-400 transition-all duration-300',
                                  isActive ? 'text-emerald-200' : ''
                                )}
                              >
                                <Package className="h-5 w-5" />
                              </div>
                            )}
                            {isActive && (
                              <div className="absolute -inset-1 rounded-xl border border-emerald-300/50 opacity-60 blur-sm pointer-events-none" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={cn(
                                'font-medium text-sm truncate transition-colors duration-300',
                                isActive ? 'text-emerald-100' : 'text-white'
                              )}
                            >
                              {line.name}
                            </div>
                            <div
                              className={cn(
                                'text-xs transition-colors duration-300',
                                isActive ? 'text-emerald-200/80' : 'text-slate-400'
                              )}
                            >
                              {formatMoney(line.price)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                'h-7 w-7 p-0 text-xs transition-colors duration-300',
                                isActive ? 'border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10' : ''
                              )}
                              onClick={(event) => {
                                event.stopPropagation()
                                decrementLine(line.productId)
                              }}
                            >-</Button>
                            <span
                              className={cn(
                                'text-sm w-7 text-center font-semibold transition-colors duration-300',
                                isActive ? 'text-emerald-100' : 'text-white'
                              )}
                            >
                              {line.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                'h-7 w-7 p-0 text-xs transition-colors duration-300',
                                isActive ? 'border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10' : ''
                              )}
                              onClick={(event) => {
                                event.stopPropagation()
                                incrementLine(line.productId)
                              }}
                            >+</Button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Cart Total */}
              {cart.length > 0 && (
                <div className="sticky bottom-0 p-6 bg-slate-900/30 backdrop-blur border-t border-white/10">
                  <div className="flex justify-between text-lg font-semibold mb-4 text-white">
                    <span>Total</span>
                    <span>{formatMoney(cartTotal)}</span>
                  </div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                  >
                    <Button
                      onClick={() => setCheckoutOpen(true)}
                      disabled={checkoutSubmitting}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-400/80 via-emerald-500/80 to-emerald-600/70 px-6 py-3 text-lg font-semibold text-white shadow-[0_16px_38px_-26px_rgba(5,150,105,0.48)] backdrop-blur-md hover:bg-emerald-500/90 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {checkoutSubmitting ? 'Finalizing…' : `Begin Checkout #${activeOrderId}`}
                    </Button>
                  </motion.div>
                  <p className="mt-3 text-xs text-emerald-200/80">
                    Multi-step checkout supports split tenders, change tracking, and detailed receipt notes.
                  </p>
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
                        whileHover={{ scale: 1.05, y: -6 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                        className="group relative rounded-3xl overflow-hidden backdrop-blur-2xl border border-white/8 bg-gradient-to-br from-slate-900/65 via-slate-900/42 to-emerald-900/30 transition-all duration-500 shadow-[0_10px_28px_-22px_rgba(12,104,96,0.32)] hover:border-emerald-300/35 hover:shadow-[0_18px_40px_-26px_rgba(5,150,105,0.28)] cursor-pointer"
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
        /* Enhanced Sales View with Dashboard Metrics */
        <EnhancedSalesTab />
      )}
      
      <Dialog open={laneManagerOpen} onOpenChange={setLaneManagerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Manage checkout lanes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400">
            Rename, add, or remove preset lanes. These options are saved locally for this device.
          </p>
          <div className="mt-4 space-y-3">
            {laneDrafts.map((lane, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={lane}
                  onChange={(event) => handleLaneDraftChange(index, event.target.value)}
                  className="flex-1 bg-slate-900/60 border-white/10"
                  placeholder={`Lane ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-slate-400 hover:text-red-400"
                  onClick={() => handleLaneDraftRemove(index)}
                  disabled={laneDrafts.length <= 1}
                  aria-label="Remove lane"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <Button type="button" variant="outline" onClick={handleLaneDraftAdd}>
              Add lane
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setLaneManagerOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleLaneManagerSave}>
                Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mobileLaneDeviceOpen} onOpenChange={setMobileLaneDeviceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Lane & device</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Lane</span>
              <Select value={laneId} onValueChange={setLaneId}>
                <SelectTrigger className="mt-2 h-9 w-full border-white/10 bg-slate-950/70 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900/95 text-slate-100">
                  {laneOptions.map((lane) => (
                    <SelectItem value={lane} key={lane}>
                      {lane}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 justify-start text-slate-400 hover:text-white"
                onClick={() => {
                  setMobileLaneDeviceOpen(false)
                  setLaneManagerOpen(true)
                }}
              >
                <Settings2 className="mr-2 h-4 w-4" /> Manage lanes
              </Button>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Device</span>
              <Select
                value={deviceSelectValue}
                onValueChange={(value) => setSelectedDeviceId(value === 'no-device' ? null : value)}
              >
                <SelectTrigger className="mt-2 h-9 w-full border-white/10 bg-slate-950/70 text-slate-100">
                  <SelectValue placeholder={hardwareAvailable ? 'Select device' : 'Simulated device'} />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900/95 text-slate-100">
                  <SelectItem value="no-device">
                    {hardwareAvailable ? 'No device selected' : 'Simulated device'}
                  </SelectItem>
                  {deviceOptions.map((device) => (
                    <SelectItem value={device.id} key={device.id}>
                      <div className="flex flex-col">
                        <span>{device.label}</span>
                        <span className="text-xs text-slate-400">
                          {device.connected ? 'Online' : 'Offline'}
                          {device.simulated ? ' • Simulated' : ''}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-slate-400">{deviceStatusLabel}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Glassmorphic Toast Container */}
      <POSCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        lines={checkoutLines}
        total={cartTotal}
        registerId={activeOrderId}
        submitting={checkoutSubmitting}
        onSubmit={handleCheckoutSubmit}
      />
      <ToastContainer />
        <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
          <DialogContent className="max-w-3xl" showCloseButton>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-100">
                Receipt preview
              </DialogTitle>
            </DialogHeader>
            {receiptPreviewBundle ? (
              <ReceiptPreview
                data={receiptPreviewBundle.result}
                artifacts={receiptPreviewBundle.artifacts}
                className="mt-2"
                actions={
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrintReceipt}>
                      Print receipt
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleDownloadReceiptPdf}
                    >
                      Download PDF
                    </Button>
                  </div>
                }
              />
            ) : (
              <p className="text-sm text-slate-300">No receipt available yet.</p>
            )}
          </DialogContent>
        </Dialog>

      {/* Conflict Resolution Dialog */}
      <ConflictResolutionDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        conflicts={conflicts}
        onResolve={handleResolveConflict}
      />

      <ToastContainer />
    </motion.div>
  )
}