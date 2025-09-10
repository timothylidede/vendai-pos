"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import type { User as FirebaseUser } from "firebase/auth"
import type { UserData } from "@/lib/types"

interface AuthContextType {
  user: FirebaseUser | null
  userData: UserData | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  logout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: () => void
    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser)
        if (firebaseUser) {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid))
          if (userDoc.exists()) {
            setUserData({
              uid: firebaseUser.uid,
              name: userDoc.data().name || firebaseUser.displayName || null,
              displayName: userDoc.data().displayName || firebaseUser.displayName || null,
              email: userDoc.data().email || firebaseUser.email || null,
              phone: userDoc.data().phone || null,
              photoURL: userDoc.data().photoURL || firebaseUser.photoURL || null,
              provider: userDoc.data().provider || "email",
              address: userDoc.data().address,
              city: userDoc.data().city,
              area: userDoc.data().area,
              createdAt: userDoc.data().createdAt || firebaseUser.metadata.creationTime || new Date().toISOString(),
              updatedAt: userDoc.data().updatedAt || firebaseUser.metadata.lastSignInTime || new Date().toISOString(),
            })
          } else {
            setUserData(null)
          }
        } else {
          setUserData(null)
        }
        setLoading(false)
      })
    } catch (error) {
      console.error("Auth state change error:", error)
      setUser(null)
      setUserData(null)
      setLoading(false)
    }
    return () => unsubscribe && unsubscribe()
  }, [])

  const logout = async () => {
    try {
      await firebaseSignOut(auth)
      setUser(null)
      setUserData(null)
      console.log("Logged out successfully at", new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }))
    } catch (error) {
      console.error("Logout error:", error)
      throw error
    }
  }

  return <AuthContext.Provider value={{ user, userData, loading, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
