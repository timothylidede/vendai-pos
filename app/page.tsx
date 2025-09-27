'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { WelcomePage } from "@/components/welcome-page"
import { MainDashboard } from "@/components/main-dashboard"
// Assistant is now hosted globally by `vendai Panel` (components/vendai-panel.tsx)
import { NotificationDots } from "@/components/notification-dots"
import { Sidebar } from "@/components/sidebar"
import { UniversalLoading } from "@/components/universal-loading"

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          // Check if user has completed onboarding
          const userDocRef = doc(db, 'users', authUser.uid)
          const userDoc = await getDoc(userDocRef)
          
          if (userDoc.exists()) {
            const userData = userDoc.data()
            const hasRole = userData.role
            const onboardingCompleted = userData.onboardingCompleted
            
            if (hasRole && onboardingCompleted) {
              // User is authenticated and onboarded - redirect to modules
              router.push('/modules')
              return
            } else {
              // User exists but hasn't completed onboarding
              router.push('/onboarding/choose')
              return
            }
          } else {
            // User document doesn't exist - redirect to onboarding chooser
            router.push('/onboarding/choose')
            return
          }
        } catch (error) {
          console.error('Error checking user data:', error)
          // On error, redirect to onboarding chooser to be safe
          router.push('/onboarding/choose')
          return
        }
      } else {
        // No user logged in - show welcome page
        setUser(null)
        setIsLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  // Show loading while checking authentication
  if (isLoading) {
    return <UniversalLoading type="auth" message="Checking authentication..." />;
  }

  // Show welcome page for non-authenticated users
  if (!user) {
    return <WelcomePage />
  }

  // Fallback - shouldn't reach here due to redirects above
  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar with Notification Dots */}
        <div className="h-12 glass border-b border-slate-700/50 flex items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-slate-400 font-mono text-sm ml-4">vendai dashboard.</span>
          </div>
          <NotificationDots />
        </div>
        <div className="flex-1 overflow-auto p-6">
          {/* Main Dashboard Content */}
          <MainDashboard />
        </div>
      </div>
    </div>
  )
}
