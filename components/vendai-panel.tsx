'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import styles from './vendai-panel.module.css'
import { AIAssistant } from './ai-assistant'

export function VendaiPanel() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  
  const handleToggle = () => {
    // Spin the logo for feedback
    setIsSpinning(true)
    setTimeout(() => setIsSpinning(false), 600)
    // Toggle panel expanded state and update global CSS var/class
    setIsExpanded((v) => {
      const next = !v
      try {
        // animate the floating button
        if (btnRef.current) {
          if (next) {
            btnRef.current.classList.remove('reappear')
            // ensure paint then add hidden
            requestAnimationFrame(() => btnRef.current && btnRef.current.classList.add('hidden'))
          } else {
            // show with pop
            btnRef.current.classList.remove('hidden')
            // trigger reappear animation
            void btnRef.current.offsetWidth
            btnRef.current.classList.add('reappear')
          }
        }
        if (next) {
          document.body.classList.add('vendai-panel-open')
          document.documentElement.style.setProperty('--vendai-panel-width', '24rem')
        } else {
          document.body.classList.remove('vendai-panel-open')
          document.documentElement.style.setProperty('--vendai-panel-width', '0px')
        }
      } catch (e) {
        // noop for SSR safety
      }

      return next
    })
  }

  // Ensure class is removed if component unmounts
  useEffect(() => {
    return () => {
      try {
        document.body.classList.remove('vendai-panel-open')
        document.documentElement.style.setProperty('--vendai-panel-width', '0px')
        if (btnRef.current) {
          btnRef.current.classList.remove('hidden', 'reappear')
        }
      } catch (e) {
        // noop
      }
    }
  }, [])

  // keep button classes in sync when isExpanded changes (covers global open events)
  useEffect(() => {
    if (!btnRef.current) return
    if (isExpanded) {
      btnRef.current.classList.remove('reappear')
      requestAnimationFrame(() => btnRef.current && btnRef.current.classList.add('hidden'))
    } else {
      btnRef.current.classList.remove('hidden')
      void btnRef.current.offsetWidth
      btnRef.current.classList.add('reappear')
    }
  }, [isExpanded])

  // Listen for global open events so other UI pieces can open this single panel
  useEffect(() => {
    const handleOpen = () => {
      setIsExpanded(true)
      try {
        document.body.classList.add('vendai-panel-open')
        document.documentElement.style.setProperty('--vendai-panel-width', '24rem')
      } catch (e) {}
    }

    window.addEventListener('vendai:open-assistant', handleOpen)
    return () => window.removeEventListener('vendai:open-assistant', handleOpen)
  }, [])
  
  return (
    <>
      {/* Vendai Logo Button (styled like ModulesDashboard) */}
      <button
        onClick={handleToggle}
        style={{ touchAction: 'manipulation' }}
        className={`${styles.toggleButton} fixed bottom-6 right-6 z-[9999] p-4 rounded-full bg-slate-800 shadow-2xl border-2 border-slate-600 hover:bg-slate-700 transform hover:scale-110 active:scale-95 focus:outline-none ${isSpinning ? 'animate-spin-continuous' : ''}`}
        data-expanded={isExpanded}
        aria-label="Open Vendai Assistant"
      >
        <Image
          src="/images/logo-icon-remove.png"
          alt="Vendai Logo"
          width={40}
          height={40}
          className="w-10 h-10 object-contain"
        />
      </button>

      {/* Sliding Panel (single assistant) */}
      <div 
        data-expanded={isExpanded}
        className={cn(styles.slidingPanel, "border-l border-slate-700/50")}
        aria-hidden={!isExpanded}
      >
        <AIAssistant isExpanded={isExpanded} onClose={() => {
          setIsExpanded(false)
          try {
            document.body.classList.remove('vendai-panel-open')
            document.documentElement.style.setProperty('--vendai-panel-width', '0px')
          } catch (e) {}
        }} />
      </div>
    </>
  )
}
