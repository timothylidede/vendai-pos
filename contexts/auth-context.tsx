'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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

const USER_DATA_CACHE_PREFIX = 'vendai-user-data::';
const USER_DATA_CACHE_TTL_MS = 1000 * 60 * 5;

type CachedUserPayload = {
  data: UserData;
  timestamp: number;
};

const buildUserCacheKey = (uid: string) => `${USER_DATA_CACHE_PREFIX}${uid}`;

const getCachedUserData = (uid: string): UserData | null => {
  try {
    const raw = localStorage.getItem(buildUserCacheKey(uid));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedUserPayload>;
    if (!parsed?.data || !parsed?.timestamp) {
      localStorage.removeItem(buildUserCacheKey(uid));
      return null;
    }

    if (Date.now() - parsed.timestamp > USER_DATA_CACHE_TTL_MS) {
      localStorage.removeItem(buildUserCacheKey(uid));
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.warn('Failed to read cached user data', error);
    return null;
  }
};

const cacheUserData = (uid: string, data: UserData) => {
  try {
    const payload: CachedUserPayload = { data, timestamp: Date.now() };
    localStorage.setItem(buildUserCacheKey(uid), JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to cache user data', error);
  }
};

const removeCachedUserData = (uid: string) => {
  try {
    localStorage.removeItem(buildUserCacheKey(uid));
  } catch (error) {
    console.warn('Failed to clear cached user data', error);
  }
};

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  electronUser: ElectronUser | null;
  loading: boolean;
  isElectron: boolean;
  organization: { id: string; name: string } | null;
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
  const lastUserIdRef = useRef<string | null>(null);

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
        cacheUserData(user.uid, data);
        return data;
      } else {
        setUserData(null);
        removeCachedUserData(user.uid);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(null);
      removeCachedUserData(user.uid);
      return null;
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user);
    }
  };

  const clearUserData = () => {
    const currentUid = user?.uid || lastUserIdRef.current;
    setUser(null);
    setUserData(null);
    setElectronUser(null);
    // Clear any cached data
    localStorage.removeItem('vendai-user-role');
    localStorage.removeItem('vendai-first-login');
    localStorage.removeItem('vendai-electron-user');
    if (currentUid) {
      removeCachedUserData(currentUid);
    }
    lastUserIdRef.current = null;
  };

  useEffect(() => {
    if (!auth) {
      console.warn('Firebase Auth not initialized');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setLoading(true);

      if (nextUser) {
        setUser(nextUser);
        lastUserIdRef.current = nextUser.uid;

        const cachedData = getCachedUserData(nextUser.uid);
        if (cachedData) {
          setUserData(cachedData);
          setLoading(false);
          void fetchUserData(nextUser);
          return;
        }

        await fetchUserData(nextUser);
        setLoading(false);
        return;
      }

      if (lastUserIdRef.current) {
        removeCachedUserData(lastUserIdRef.current);
        lastUserIdRef.current = null;
      }
      setUser(null);
      setUserData(null);
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
    organization: userData ? { id: userData.organizationName, name: userData.organizationDisplayName || userData.organizationName } : null,
    refreshUserData,
    clearUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};