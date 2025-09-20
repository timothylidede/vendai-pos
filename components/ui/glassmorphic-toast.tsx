import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, X } from 'lucide-react'

interface GlassmorphicToastProps {
  show: boolean
  title: string
  description?: string
  duration?: number
  onClose: () => void
}

export function GlassmorphicToast({ show, title, description, duration = 3000, onClose }: GlassmorphicToastProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [show, duration, onClose])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ 
            type: 'spring', 
            stiffness: 300, 
            damping: 20,
            duration: 0.5 
          }}
          className="fixed top-4 right-4 z-[9999] max-w-sm"
        >
          {/* Glassmorphic Toast */}
          <div className="relative rounded-2xl backdrop-blur-2xl bg-gradient-to-br from-white/[0.15] to-white/[0.08] border border-white/[0.12] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.08] via-emerald-500/[0.04] to-green-600/[0.06] opacity-80" />
            
            {/* Success indicator line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-400 to-emerald-400 origin-left"
            />
            
            {/* Content */}
            <div className="relative p-4">
              <div className="flex items-start gap-3">
                {/* Success Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 400, 
                    damping: 15,
                    delay: 0.1 
                  }}
                  className="flex-shrink-0 mt-0.5"
                >
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </motion.div>
                
                {/* Text Content */}
                <div className="flex-1 min-w-0">
                  <motion.p
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm font-medium text-white/90"
                  >
                    {title}
                  </motion.p>
                  {description && (
                    <motion.p
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-xs text-white/70 mt-1 truncate"
                    >
                      {description}
                    </motion.p>
                  )}
                </div>
                
                {/* Close Button */}
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="flex-shrink-0 p-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-white/60 hover:text-white/80" />
                </motion.button>
              </div>
              
              {/* Progress Bar */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ 
                  duration: duration / 1000, 
                  ease: 'linear',
                  delay: 0.5 
                }}
                className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-green-400 to-emerald-400 origin-left mt-3"
              />
            </div>
            
            {/* Floating particles effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    opacity: 0, 
                    x: Math.random() * 100, 
                    y: 100 
                  }}
                  animate={{ 
                    opacity: [0, 0.6, 0], 
                    x: Math.random() * 100, 
                    y: -20 
                  }}
                  transition={{ 
                    duration: 2, 
                    delay: i * 0.3,
                    repeat: Infinity,
                    repeatDelay: 3 
                  }}
                  className="absolute w-1 h-1 bg-green-400/60 rounded-full"
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Hook for managing glassmorphic toast state
export function useGlassmorphicToast() {
  const [toasts, setToasts] = useState<Array<{
    id: string
    title: string
    description?: string
    duration?: number
  }>>([])

  const showToast = (title: string, description?: string, duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, title, description, duration }])
  }

  const hideToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const ToastContainer = () => (
    <>
      {toasts.map((toast, index) => (
        <div key={toast.id} style={{ top: `${16 + index * 80}px` }}>
          <GlassmorphicToast
            show={true}
            title={toast.title}
            description={toast.description}
            duration={toast.duration}
            onClose={() => hideToast(toast.id)}
          />
        </div>
      ))}
    </>
  )

  return { showToast, ToastContainer }
}