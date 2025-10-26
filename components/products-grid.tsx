"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import type { CSSProperties, TransitionEvent } from "react"

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
  { id: "1", name: "Premium Rice 25kg", price: 3500, brand: "Mahitaji", image: "/images/products/rice.png", category: "food" },
  { id: "2", name: "Cooking Oil 5L", price: 1200, brand: "Fresh", image: "/images/products/oil.png", category: "food" },
  { id: "3", name: "Maize Flour 10kg", price: 850, brand: "Soko", image: "/images/products/flour.png", category: "food" },
  { id: "4", name: "Sugar 50kg", price: 5500, brand: "Sweet Co", category: "food" },
  { id: "5", name: "Laundry Soap 800g", price: 120, brand: "Clean Pro", category: "household" },
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
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl">
          <p className="mb-1 text-xs text-slate-400">{product.brand}</p>
          <h2 className="mb-3 text-xl font-semibold text-white">{product.name}</h2>
          <p className="mb-6 text-2xl font-bold text-sky-400">KES {product.price.toLocaleString()}</p>
          
          <div className="flex gap-3">
            <button className="flex-1 rounded-lg bg-sky-500/80 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-400">
              Add to cart
            </button>
            <button className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white transition hover:bg-white/10">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

type ProductsGridProps = {
  isExpanded: boolean
}

export function ProductsGrid({ isExpanded }: ProductsGridProps) {
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

  // Filter products by categories
  const recentlyViewed = MOCK_PRODUCTS.filter(p => viewedProducts.has(p.id)).slice(0, itemsPerRow)
  const newProducts = MOCK_PRODUCTS.slice(0, itemsPerRow)
  const popularProducts = MOCK_PRODUCTS.slice(2, 2 + itemsPerRow)
  const recommendedProducts = MOCK_PRODUCTS.slice(1, 1 + itemsPerRow)

  return (
    <div className="relative h-full">
      <div className={`p-6 transition-opacity duration-300 ${selectedProduct ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-white">Recently viewed</h2>
            <div className={`grid gap-4 transition-all duration-500 ease-in-out ${isExpanded ? "grid-cols-6" : "grid-cols-4"}`}>
              {recentlyViewed.map((product) => {
                const refKey = `recent-${product.id}`
                return (
                  <button
                    key={refKey}
                    onClick={() => handleProductClick(product, refKey)}
                    className="group relative flex flex-col transition-transform hover:scale-105"
                  >
                    <div ref={assignImageRef(refKey)} className="mb-2 aspect-square overflow-hidden rounded-lg bg-slate-800/50">
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
                    <h3 className="text-xs text-slate-300 line-clamp-2">{product.name}</h3>
                    <p className="text-sm font-semibold text-white">KES {product.price.toLocaleString()}</p>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* New from brands you follow */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-white">New from brands you follow</h2>
          <div className={`grid gap-4 transition-all duration-500 ease-in-out ${isExpanded ? "grid-cols-6" : "grid-cols-4"}`}>
            {newProducts.map((product) => {
              const refKey = `new-${product.id}`
              return (
                <button
                  key={refKey}
                  onClick={() => handleProductClick(product, refKey)}
                  className="group relative flex flex-col transition-transform hover:scale-105"
                >
                  <div ref={assignImageRef(refKey)} className="mb-2 aspect-square overflow-hidden rounded-lg bg-slate-800/50">
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
                  <h3 className="text-xs text-slate-300 line-clamp-2">{product.name}</h3>
                  <p className="text-sm font-semibold text-white">KES {product.price.toLocaleString()}</p>
                </button>
              )
            })}
          </div>
        </section>

        {/* Popular with shops like yours */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-white">Popular with shops like yours</h2>
          <div className={`grid gap-4 transition-all duration-500 ease-in-out ${isExpanded ? "grid-cols-6" : "grid-cols-4"}`}>
            {popularProducts.map((product) => {
              const refKey = `popular-${product.id}`
              return (
                <button
                  key={refKey}
                  onClick={() => handleProductClick(product, refKey)}
                  className="group relative flex flex-col transition-transform hover:scale-105"
                >
                  <div ref={assignImageRef(refKey)} className="mb-2 aspect-square overflow-hidden rounded-lg bg-slate-800/50">
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
                  <h3 className="text-xs text-slate-300 line-clamp-2">{product.name}</h3>
                  <p className="text-sm font-semibold text-white">KES {product.price.toLocaleString()}</p>
                </button>
              )
            })}
          </div>
        </section>

        {/* Brands you might like */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-white">Brands you might like</h2>
          <div className={`grid gap-4 transition-all duration-500 ease-in-out ${isExpanded ? "grid-cols-6" : "grid-cols-4"}`}>
            {BRANDS.map((brand) => (
              <div key={brand.name} className="group rounded-lg border border-white/10 bg-slate-800/30 p-4 transition hover:border-sky-400/30 hover:bg-slate-800/50">
                <div className="mb-2 flex h-16 items-center justify-center rounded-lg bg-slate-700/50">
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
              </div>
            ))}
          </div>
        </section>

        {/* Products you might like */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-white">Products you might like</h2>
          <div className={`grid gap-4 transition-all duration-500 ease-in-out ${isExpanded ? "grid-cols-6" : "grid-cols-4"}`}>
            {recommendedProducts.map((product) => {
              const refKey = `recommended-${product.id}`
              return (
                <button
                  key={refKey}
                  onClick={() => handleProductClick(product, refKey)}
                  className="group relative flex flex-col transition-transform hover:scale-105"
                >
                  <div ref={assignImageRef(refKey)} className="mb-2 aspect-square overflow-hidden rounded-lg bg-slate-800/50">
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
                  <h3 className="text-xs text-slate-300 line-clamp-2">{product.name}</h3>
                  <p className="text-sm font-semibold text-white">KES {product.price.toLocaleString()}</p>
                </button>
              )
            })}
          </div>
        </section>
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
