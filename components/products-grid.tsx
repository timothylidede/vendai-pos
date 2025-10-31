"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import type { CSSProperties, TransitionEvent } from "react"
import { motion } from "framer-motion"

type Rect = {
  top: number
  left: number
  width: number
  height: number
}

type Product = {
  id: string
  name: string
  price: number
  brand: string
  image?: string
  category?: string
}

type SelectedProductState = Product & {
  originRect: Rect
}

type ProductDetailOverlayProps = {
  product: Product
  originRect: Rect
  isClosing: boolean
  onCloseComplete: () => void
}

// Mock product data
const MOCK_PRODUCTS: Product[] = [
  { id: "1", name: "Premium Rice 25kg", price: 3500, brand: "Mahitaji", image: "/products/rice.png", category: "food" },
  { id: "2", name: "Cooking Oil 5L", price: 1200, brand: "Fresh", image: "/products/cooking-oil.png", category: "food" },
  { id: "3", name: "Maize Flour 10kg", price: 850, brand: "Soko", image: "/products/maize-flour.png", category: "food" },
  { id: "4", name: "Wheat Flour 25kg", price: 2800, brand: "Soko", image: "/products/wheat-flour.png", category: "food" },
  { id: "5", name: "Sugar 50kg", price: 5500, brand: "Sweet Co", image: "/products/sugar.png", category: "food" },
  { id: "6", name: "Tea Leaves 500g", price: 450, brand: "Chai Plus", category: "beverages" },
  { id: "7", name: "Bottled Water 24pk", price: 480, brand: "Pure", category: "beverages" },
  { id: "8", name: "Washing Powder 2kg", price: 380, brand: "Fresh", category: "household" },
]

const BRANDS = [
  { name: "Mahitaji", rating: 4.9, minOrder: 300 },
  { name: "Fresh", rating: 4.8, minOrder: 150 },
  { name: "Soko", rating: 4.7, minOrder: 75 },
  { name: "Sweet Co", rating: 5.0, minOrder: 150 },
]

function ProductDetailOverlay({ product, originRect, isClosing, onCloseComplete }: ProductDetailOverlayProps) {
  const initialStyle = useMemo<CSSProperties>(
    () => ({
      left: `${originRect.left}px`,
      top: `${originRect.top}px`,
      width: `${originRect.width}px`,
      height: `${originRect.height}px`,
      borderRadius: "0.5rem",
    }),
    [originRect]
  )

  const [imageStyle, setImageStyle] = useState<CSSProperties>(initialStyle)
  const [targetMetrics, setTargetMetrics] = useState({ width: originRect.width, top: originRect.top })
  const [contentVisible, setContentVisible] = useState(false)

  useEffect(() => {
    setImageStyle(initialStyle)
    setTargetMetrics({ width: originRect.width, top: originRect.top })
    setContentVisible(false)
  }, [initialStyle, originRect])

  useEffect(() => {
    if (isClosing) {
      setContentVisible(false)
      setImageStyle(initialStyle)
      return
    }

    const frame = requestAnimationFrame(() => {
      if (typeof window === "undefined") return
      const containerWidth = originRect.width * 1.5
      const width = Math.min(400, containerWidth)
      const top = 100
      setTargetMetrics({ width, top })
      setImageStyle({
        left: "50%",
        top: `${top}px`,
        width: `${width}px`,
        height: `${width}px`,
        borderRadius: "0.75rem",
        transform: "translateX(-50%)",
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [initialStyle, isClosing, originRect.width])

  const handleTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      if (event.propertyName !== "top") return
      if (isClosing) {
        onCloseComplete()
        return
      }
      setContentVisible(true)
    },
    [isClosing, onCloseComplete]
  )

  const detailsStyle = useMemo<CSSProperties>(
    () => ({
      left: "50%",
      top: `${targetMetrics.top + targetMetrics.width + 24}px`,
      transform: "translateX(-50%)",
    }),
    [targetMetrics.top, targetMetrics.width]
  )

  return (
    <>
      <div
        className="absolute z-20 flex items-center justify-center overflow-hidden bg-slate-900/80 transition-[top,left,width,height,border-radius,transform] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)]"
        style={{ ...imageStyle, pointerEvents: "none", position: "absolute" }}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="relative h-full w-full">
          {product.image ? (
            <div className="relative h-full w-full">
              <Image
                src={product.image}
                alt={product.name}
                width={400}
                height={400}
                sizes="(min-width: 768px) 420px, 60vw"
                className="h-full w-full object-contain"
                priority
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/30">
              <svg className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          )}
        </div>
      </div>
      <div
        className={`absolute z-20 w-full max-w-lg px-4 text-center transition-all duration-300 ease-out ${
          contentVisible && !isClosing ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
        style={detailsStyle}
      >
        <h2 className="mb-1 text-[11px] font-light uppercase tracking-[0.3em] text-white/90">
          {product.name}
        </h2>
        <p className="mb-1 text-[9px] font-extralight uppercase tracking-[0.25em] text-white/60">
          {product.brand}
        </p>
        <p className="mb-6 text-lg font-light text-white">
          KES {product.price.toLocaleString()}
        </p>
        
        <button className="mx-auto rounded-lg bg-white px-8 py-2.5 text-[10px] font-normal uppercase tracking-[0.2em] text-slate-900 transition-all duration-300 hover:bg-white/90 hover:shadow-lg">
          Add to cart
        </button>
      </div>
    </>
  )
}

type ProductsGridProps = {
  isExpanded: boolean
  viewMode?: 'products' | 'brands'
}

export function ProductsGrid({ isExpanded, viewMode = 'products' }: ProductsGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductState | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [viewedProducts, setViewedProducts] = useState<Set<string>>(new Set())
  const imageRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const itemsPerRow = isExpanded ? 6 : 4

  const handleProductClick = useCallback((product: Product, refKey: string) => {
    if (selectedProduct || isClosing) return

    const rect = imageRefs.current[refKey]?.getBoundingClientRect()
    if (!rect) return

    const originRect: Rect = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    }

    setSelectedProduct({ ...product, originRect })
    setIsClosing(false)
    
    // Track viewed product
    setViewedProducts(prev => new Set([...prev, product.id]))
  }, [selectedProduct, isClosing])

  const handleClose = useCallback(() => {
    if (!selectedProduct || isClosing) return
    setIsClosing(true)
  }, [selectedProduct, isClosing])

  const handleCloseComplete = useCallback(() => {
    setSelectedProduct(null)
    setIsClosing(false)
  }, [])

  const assignImageRef = useCallback((key: string) => (node: HTMLDivElement | null) => {
    imageRefs.current[key] = node
  }, [])

  useEffect(() => {
    if (!selectedProduct) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [selectedProduct, handleClose])

  // Organize products following the specified arrangement
  // 1. Most recently ordered (simulated with first products)
  const recentlyOrdered = MOCK_PRODUCTS.slice(0, 2)
  const usedIds = new Set(recentlyOrdered.map(p => p.id))
  
  // 2. Most recently viewed
  const recentlyViewed = MOCK_PRODUCTS.filter(p => viewedProducts.has(p.id) && !usedIds.has(p.id)).slice(0, 2)
  recentlyViewed.forEach(p => usedIds.add(p.id))
  
  // 3. Frequently purchased (simulated with next products)
  const frequentlyPurchased = MOCK_PRODUCTS.filter(p => !usedIds.has(p.id)).slice(0, 2)
  frequentlyPurchased.forEach(p => usedIds.add(p.id))
  
  // 4. Similar products (same category as recently ordered/viewed)
  const similarProducts = MOCK_PRODUCTS.filter(p => {
    if (usedIds.has(p.id)) return false
    const recentCategories = [...recentlyOrdered, ...recentlyViewed].map(rp => rp.category)
    return recentCategories.includes(p.category)
  }).slice(0, 3)
  similarProducts.forEach(p => usedIds.add(p.id))
  
  // 5. New arrivals / trending (remaining products)
  const newArrivals = MOCK_PRODUCTS.filter(p => !usedIds.has(p.id)).slice(0, 3)
  newArrivals.forEach(p => usedIds.add(p.id))
  
  // 6. Promotional items (any remaining)
  const promotional = MOCK_PRODUCTS.filter(p => !usedIds.has(p.id))
  
  // Combine all products in order without duplication
  const organizedProducts = [
    ...recentlyOrdered,
    ...recentlyViewed,
    ...frequentlyPurchased,
    ...similarProducts,
    ...newArrivals,
    ...promotional
  ]

  return (
    <div className="relative h-full">
      <div className={`p-6 transition-opacity duration-300 ${selectedProduct ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        {/* Products View */}
        {viewMode === 'products' && (
          <motion.div
            layout
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            className={`grid gap-4 ${isExpanded ? "grid-cols-6" : "grid-cols-4"}`}
          >
            {organizedProducts.map((product, index) => {
              const refKey = `product-${product.id}-${index}`
              return (
                <motion.button
                  layout
                  key={refKey}
                  onClick={() => handleProductClick(product, refKey)}
                  className="group relative transition-transform hover:scale-105"
                >
                  <div ref={assignImageRef(refKey)} className="aspect-square overflow-hidden rounded-lg">
                    {product.image ? (
                      <Image src={product.image} alt={product.name} width={200} height={200} className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-600">
                        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </motion.div>
        )}

        {/* Brands View */}
        {viewMode === 'brands' && (
        <section className="mb-10">
          <motion.div
            layout
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            className={`grid gap-4 ${isExpanded ? "grid-cols-6" : "grid-cols-4"}`}
          >
            {BRANDS.map((brand) => (
              <motion.div layout key={brand.name} className="group rounded-lg border border-white/10 p-4 transition hover:border-sky-400/30">
                <div className="mb-2 flex h-16 items-center justify-center rounded-lg">
                  <span className="text-lg font-semibold text-white">{brand.name.slice(0, 2)}</span>
                </div>
                <h3 className="mb-1 text-sm font-medium text-white">{brand.name}</h3>
                <div className="mb-1 flex items-center gap-1 text-xs text-slate-400">
                  <svg className="h-3 w-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>{brand.rating}</span>
                </div>
                <p className="text-xs text-slate-500">Min ${brand.minOrder}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>
        )}
        
      </div>

      {selectedProduct && (
        <>
          <div
            className={`absolute inset-0 z-10 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-500 ${
              isClosing ? "opacity-0" : "opacity-100"
            }`}
            onClick={handleClose}
          />
          <ProductDetailOverlay
            product={selectedProduct}
            originRect={selectedProduct.originRect}
            isClosing={isClosing}
            onCloseComplete={handleCloseComplete}
          />
        </>
      )}
    </div>
  )
}
