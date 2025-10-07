'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  role: 'retailer' | 'distributor';
  organizationName: string;
  organizationDisplayName?: string;
  contactNumber?: string;
  location?: string;
  coordinates?: { lat: number; lng: number };
  isOrganizationCreator: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  joinedAt?: string;
  updatedAt?: string;
  photoURL?: string;
}

interface ElectronUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  electronUser: ElectronUser | null;
  loading: boolean;
  isElectron: boolean;
  refreshUserData: () => Promise<void>;
  clearUserData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [electronUser, setElectronUser] = useState<ElectronUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Detect if running in Electron
    const ua = navigator.userAgent.toLowerCase();
    const detectedElectron = Boolean(
      (window as any).electronAPI ||
      (window as any).vendaiAPI?.isElectron ||
      (window as any).require ||
      ua.includes('electron')
    );
    setIsElectron(detectedElectron);

    // Check for stored Electron user data
    if (detectedElectron) {
      const storedUser = localStorage.getItem('vendai-electron-user');
      if (storedUser) {
        try {
          const electronUserData = JSON.parse(storedUser);
          setElectronUser(electronUserData);
          console.log('🔄 Restored Electron user from localStorage:', electronUserData.email);
        } catch (error) {
          console.error('Error parsing stored Electron user:', error);
          localStorage.removeItem('vendai-electron-user');
        }
      }
    }
  }, []);

  const fetchUserData = async (user: User) => {
    if (!db) {
      console.warn('Firestore not initialized, skipping user data fetch');
      setUserData(null);
      return null;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data() as UserData;
        setUserData(data);
        return data;
      } else {
        setUserData(null);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(null);
      return null;
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user);
    }
  };

  const clearUserData = () => {
    setUser(null);
    setUserData(null);
    setElectronUser(null);
    // Clear any cached data
    localStorage.removeItem('vendai-user-role');
    localStorage.removeItem('vendai-first-login');
    localStorage.removeItem('vendai-electron-user');
  };

  useEffect(() => {
    if (!auth) {
      console.warn('Firebase Auth not initialized');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      
      if (user) {
        setUser(user);
        await fetchUserData(user);
      } else {
        // Only clear Firebase user data, keep Electron user if present
        setUser(null);
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    userData,
    electronUser,
    loading,
    isElectron,
    refreshUserData,
    clearUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};