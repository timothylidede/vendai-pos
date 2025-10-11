"use client"

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/service-worker'

/**
 * Client component to register service worker
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Register service worker for offline image caching
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      registerServiceWorker().then((registration) => {
        if (registration) {
          console.log('✅ Service Worker ready for offline image caching')
        }
      }).catch((error) => {
        console.error('❌ Service Worker registration failed:', error)
      })
    }
  }, [])

  return null // This component doesn't render anything
}
