/**
 * Mobile responsiveness utilities and touch optimization for VendAI POS
 */

// Touch event handlers for better mobile interaction
export const touchHandlers = {
  // Prevent scrolling on touch elements
  preventScroll: (e: TouchEvent) => {
    e.preventDefault()
  },

  // Handle touch-friendly click events
  handleTouchClick: (callback: () => void) => ({
    onClick: callback,
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault()
      callback()
    }
  }),

  // Long press handler for mobile context menus
  createLongPressHandler: (onLongPress: () => void, delay = 500) => {
    let timeout: NodeJS.Timeout | null = null
    
    return {
      onTouchStart: () => {
        timeout = setTimeout(onLongPress, delay)
      },
      onTouchEnd: () => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
      },
      onTouchMove: () => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
      }
    }
  }
}

// Responsive breakpoint detection hook
export const useResponsive = () => {
  const [screenSize, setScreenSize] = React.useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    width: 0,
    height: 0
  })

  React.useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      setScreenSize({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        width,
        height
      })
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    window.addEventListener('orientationchange', updateSize)

    return () => {
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('orientationchange', updateSize)
    }
  }, [])

  return screenSize
}

// Mobile-friendly input components
export const MobileInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}>(({ label, error, className, ...props }, ref) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <input
        ref={ref}
        {...props}
        className={`
          w-full px-4 py-3 rounded-lg
          bg-slate-800 border border-slate-600
          text-white placeholder-slate-400
          focus:border-blue-500 focus:ring-1 focus:ring-blue-500
          touch-manipulation
          text-base
          ${error ? 'border-red-500' : ''}
          ${className || ''}
        `}
      />
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
    </div>
  )
})

// Mobile-optimized button component
export const MobileButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}>(({ variant = 'primary', size = 'md', fullWidth = false, className, children, ...props }, ref) => {
  const baseClasses = 'touch-manipulation transition-colors font-medium rounded-lg focus:outline-none focus:ring-2'
  
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white focus:ring-slate-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
  }

  const sizes = {
    sm: 'px-3 py-2 text-sm min-h-[40px]',
    md: 'px-4 py-3 text-base min-h-[44px]',
    lg: 'px-6 py-4 text-lg min-h-[48px]'
  }

  return (
    <button
      ref={ref}
      {...props}
      className={`
        ${baseClasses}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className || ''}
      `}
    >
      {children}
    </button>
  )
})

// Mobile-friendly modal/drawer component
export const MobileModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  className = ''
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}) => {
  const { isMobile } = useResponsive()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`
        absolute bottom-0 left-0 right-0
        ${isMobile ? 'h-[90vh] rounded-t-2xl' : 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-md w-full mx-4 rounded-xl max-h-[80vh]'}
        bg-slate-900 border border-slate-700
        ${className}
      `}>
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// Touch-friendly card component
export const MobileCard = ({ 
  children, 
  onClick,
  className = '',
  ...props 
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) => {
  return (
    <div
      {...props}
      {...(onClick ? touchHandlers.handleTouchClick(onClick) : {})}
      className={`
        glass border border-slate-700 rounded-xl p-4
        ${onClick ? 'cursor-pointer hover:border-slate-600 active:scale-95 transition-all touch-manipulation' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

// Mobile-optimized grid layout
export const ResponsiveGrid = ({ 
  children,
  cols = { sm: 1, md: 2, lg: 3 },
  gap = 4,
  className = ''
}: {
  children: React.ReactNode
  cols?: { sm: number, md: number, lg: number }
  gap?: number
  className?: string
}) => {
  return (
    <div className={`
      grid gap-${gap}
      grid-cols-${cols.sm}
      md:grid-cols-${cols.md}
      lg:grid-cols-${cols.lg}
      ${className}
    `}>
      {children}
    </div>
  )
}

// Mobile navigation helper
export const MobileNavigation = ({ 
  items,
  activeItem,
  onItemSelect 
}: {
  items: Array<{ id: string, label: string, icon: React.ReactNode }>
  activeItem: string
  onItemSelect: (id: string) => void
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 safe-area-inset-bottom">
      <div className="flex">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemSelect(item.id)}
            className={`
              flex-1 flex flex-col items-center py-3 px-2 space-y-1
              touch-manipulation transition-colors
              ${activeItem === item.id 
                ? 'text-blue-400 bg-slate-800' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }
            `}
          >
            <div className="w-6 h-6">
              {item.icon}
            </div>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Viewport meta tag helper
export const setMobileViewport = () => {
  if (typeof document !== 'undefined') {
    let viewport = document.querySelector('meta[name=viewport]')
    if (!viewport) {
      viewport = document.createElement('meta')
      viewport.setAttribute('name', 'viewport')
      document.head.appendChild(viewport)
    }
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
  }
}

// CSS classes for common mobile patterns
export const mobileClasses = {
  // Touch targets should be at least 44px
  touchTarget: 'min-h-[44px] min-w-[44px]',
  
  // Safe area insets for devices with notches
  safeAreaTop: 'pt-safe-area-inset-top',
  safeAreaBottom: 'pb-safe-area-inset-bottom',
  safeAreaLeft: 'pl-safe-area-inset-left',
  safeAreaRight: 'pr-safe-area-inset-right',
  
  // Mobile-specific spacing
  mobilePadding: 'px-4 py-2',
  mobileMargin: 'mx-4 my-2',
  
  // Mobile text sizes
  mobileText: 'text-base leading-relaxed',
  mobileTitle: 'text-xl font-semibold',
  mobileSubtitle: 'text-sm text-slate-400',
  
  // Mobile-friendly scrolling
  mobileScroll: 'overflow-y-auto -webkit-overflow-scrolling-touch',
  
  // Hide scrollbars on mobile
  hideScrollbar: 'scrollbar-hide',
  
  // Mobile-specific animations
  mobileSlideIn: 'animate-slide-in-bottom',
  mobileFadeIn: 'animate-fade-in'
}

import React from 'react'
import { X } from 'lucide-react'