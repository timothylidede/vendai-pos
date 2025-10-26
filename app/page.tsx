'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { WelcomePage } from "@/components/welcome-page"
import { UniversalLoading } from "@/components/universal-loading"

const resolvePostAuthRoute = (role?: string | null, onboardingCompleted?: boolean) => {
  if (!onboardingCompleted) {
    return '/onboarding/choose'
  }

  return '/modules'
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

  // Fallback - show loading while redirecting to modules dashboard
  return <UniversalLoading type="auth" message="Let's go" />
}
