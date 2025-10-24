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

const resolvePostAuthRoute = (role?: string | null, onboardingCompleted?: boolean) => {
  if (!onboardingCompleted) {
    return '/onboarding/choose'
  }

  return role === 'distributor' ? '/modules/inventory' : '/modules'
}

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    if (!auth || !db) {
      setIsLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser)
        try {
          // Check if user has completed onboarding
          const userDocRef = doc(db!, 'users', authUser.uid)
          const userDoc = await getDoc(userDocRef)
          
          if (userDoc.exists()) {
            const userData = userDoc.data()
            const rawRole = typeof userData.role === 'string' ? userData.role.toLowerCase() : null
            const normalizedRole = rawRole === 'distributor' ? 'distributor' : 'retailer'
            const onboardingCompleted = Boolean(userData.onboardingCompleted)
            const destination = resolvePostAuthRoute(normalizedRole, onboardingCompleted)
            
            router.replace(destination)
            setIsLoading(false)
            return
          } else {
            // User document doesn't exist - redirect to onboarding chooser
            router.replace('/onboarding/choose')
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error('Error checking user data:', error)
          // On error, redirect to onboarding chooser to be safe
          router.replace('/onboarding/choose')
          setIsLoading(false)
          return
        }
      } else {
        // No user logged in - show welcome page
        setUser(null)
        setIsLoading(false)
      }
    })

    return () => unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="module-background flex h-[calc(100vh-2.5rem)] overflow-hidden">
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
