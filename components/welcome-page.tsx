'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import { signInWithPopup, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import { UniversalLoading } from './universal-loading';
import { useAuth } from '@/contexts/auth-context';

type FirebaseUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

type ElectronOAuthResult = {
  success: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
  tokens: {
    idToken?: string | null;
    accessToken?: string | null;
  };
};

export function WelcomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { user, userData, loading: authLoading } = useAuth();

  useEffect(() => {
    setIsMounted(true);
    
    const ua = navigator.userAgent.toLowerCase();
    const detectedElectron = Boolean(
      (window as any).electronAPI ||
      (window as any).vendaiAPI?.isElectron ||
      (window as any).require ||
      ua.includes('electron')
    );

    setIsElectron(detectedElectron);
  }, []);

  useEffect(() => {
    if (!isMounted || authLoading) return;
    if (!user) return;

    const hasCompletedOnboarding = Boolean(userData?.onboardingCompleted);
    const targetRoute = hasCompletedOnboarding ? '/modules' : '/onboarding/choose';

    setIsRedirecting(true);
    router.replace(targetRoute);
  }, [authLoading, isMounted, router, user, userData?.onboardingCompleted]);

  const handleGoogleSignIn = async () => {
    if (!isMounted || isRedirecting || authLoading) return;
    
    setIsLoading(true);
    setErrorMessage(null);

    try {
      console.log('🚀 Starting authentication process...');
      console.log('- Environment:', process.env.NODE_ENV);
      console.log('- Current Domain:', window.location.hostname);
      console.log('- Is Electron:', isElectron);
      console.log('- Firebase Auth Domain:', auth?.app?.options?.authDomain);
      console.log('- Firebase Project ID:', auth?.app?.options?.projectId);
      console.log('- Firebase API Key (last 4):', auth?.app?.options?.apiKey?.slice(-4));
      
      if (isElectron && (window as any).electronAPI) {
        await handleElectronSignIn();
      } else {
        await handleWebSignIn();
      }
    } catch (error: any) {
      console.error('🔴 Google sign in error:', error);
      console.error('Error details:', {
        code: error?.code,
        message: error?.message,
        customData: error?.customData,
        stack: error?.stack
      });
      console.error('Firebase state:', {
        authDomain: auth?.app?.options?.authDomain,
        currentDomain: window.location.hostname,
        hasAuth: Boolean(auth),
        hasGoogleProvider: Boolean(googleProvider),
      });

      let friendlyMessage = 'An error occurred during sign in. Please try again.';

      if (error?.code === 'auth/unauthorized-domain') {
        friendlyMessage = 'This domain is not authorized for Google sign-in. Please contact support or try again later.';
      } else if (error?.code === 'auth/popup-blocked') {
        friendlyMessage = 'Pop-up was blocked. Please allow pop-ups for this site and try again.';
      } else if (error?.code === 'auth/popup-closed-by-user') {
        friendlyMessage = 'Sign in was cancelled. Click the button again to continue.';
      } else if (error?.code === 'auth/cancelled-popup-request') {
        friendlyMessage = 'Sign in was cancelled. Click the button again to continue.';
      } else if (error?.code === 'auth/network-request-failed') {
        friendlyMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error?.code === 'auth/too-many-requests') {
        friendlyMessage = 'Too many sign-in attempts. Please wait a few minutes and try again.';
      } else if (error?.code === 'auth/invalid-action-code') {
        friendlyMessage = 'Sign-in request expired or invalid. Please try again.';
      } else if (typeof error?.message === 'string') {
        if (error.message.includes('The requested action is invalid')) {
          friendlyMessage = 'Sign-in request expired. Please try again.';
        } else if (error.message.includes('OAuth timeout') || error.message.includes('timeout')) {
          friendlyMessage = 'Sign in timed out. Please try again.';
        } else if (error.message.includes('cancelled') || error.message.includes('closed')) {
          friendlyMessage = 'Sign in was cancelled. Click the button again to continue.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          friendlyMessage = 'Network error. Please check your internet connection and try again.';
        }
      }

      setErrorMessage(friendlyMessage);
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebSignIn = async () => {
    if (!auth || !googleProvider) {
      throw new Error('Firebase authentication not initialized');
    }

    try {
      // Clear any existing auth state first
      if (auth.currentUser) {
        await auth.signOut();
      }
      
      const result = await signInWithPopup(auth, googleProvider);
      await handleUserAuthentication(result.user);
    } catch (error) {
      // Re-throw to be handled by the main error handler
      throw error;
    }
  };

  const handleElectronSignIn = async () => {
    const electronAPI = (window as any).electronAPI;
    const oauthResult = await electronAPI.googleOAuth() as ElectronOAuthResult | undefined;

    if (!oauthResult || !oauthResult.success || !oauthResult.user) {
      throw new Error('Electron OAuth failed or was cancelled');
    }

    try {
      if (!auth) {
        throw new Error('Firebase authentication not initialized');
      }

      const credential = GoogleAuthProvider.credential(
        oauthResult.tokens.idToken || null,
        oauthResult.tokens.accessToken || null
      );

      const userCred = await signInWithCredential(auth, credential);
      await handleUserAuthentication(userCred.user);
    } catch (firebaseError) {
      console.warn('Firebase credential sign-in failed, falling back to local profile creation.', firebaseError);
      await handleElectronFallback(oauthResult.user);
    }
  };

  const handleUserAuthentication = async (user: FirebaseUser) => {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const userDocRef = doc(db, 'users', user.uid);
    const snapshot = await getDoc(userDocRef);

    if (snapshot.exists()) {
      const userData = snapshot.data() as { role?: string; onboardingCompleted?: boolean };
      const role = userData.role || 'retailer';
      const onboardingCompleted = Boolean(userData.onboardingCompleted);

      localStorage.setItem('vendai-user-role', role);
      localStorage.setItem('vendai-first-login', onboardingCompleted ? 'false' : 'true');
      setIsRedirecting(true);
      router.push(onboardingCompleted ? '/modules' : '/onboarding/choose');
    } else {
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
        onboardingCompleted: false,
        role: 'retailer',
      });

      localStorage.setItem('vendai-first-login', 'true');
      setIsRedirecting(true);
      router.push('/onboarding/choose');
    }
  };

  const handleElectronFallback = async (googleUser: ElectronOAuthResult['user']) => {
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    const userDocRef = doc(db, 'users', googleUser.id);
    const snapshot = await getDoc(userDocRef);

    if (snapshot.exists()) {
      const data = snapshot.data() as { role?: string; onboardingCompleted?: boolean };
      const role = data.role || 'retailer';
      const onboardingCompleted = Boolean(data.onboardingCompleted);

      localStorage.setItem('vendai-user-role', role);
      localStorage.setItem('vendai-first-login', onboardingCompleted ? 'false' : 'true');
      router.push(onboardingCompleted ? '/modules' : '/onboarding/choose');
      return;
    }

    await setDoc(userDocRef, {
      uid: googleUser.id,
      email: googleUser.email,
      displayName: googleUser.name,
      photoURL: googleUser.picture ?? null,
      createdAt: new Date().toISOString(),
      onboardingCompleted: false,
      role: 'retailer',
    });

    localStorage.setItem('vendai-first-login', 'true');
    setIsRedirecting(true);
    router.push('/onboarding/choose');
  };

  // Don't render until mounted to prevent hydration issues
  if (!isMounted || authLoading || isRedirecting) {
    return <UniversalLoading type="auth" />;
  }

  // Show loading screen during sign-in process
  if (isLoading) {
    return <UniversalLoading type="auth" />;
  }

  return (
    <div className="module-background flex min-h-screen w-full items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="mb-8"
          >
            <motion.div
              className="relative w-20 h-20 mx-auto"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            >
              <Image
                src="/images/logo-icon-remove.png"
                alt="vendai Logo"
                width={80}
                height={80}
                className="w-full h-full object-contain drop-shadow-xl"
              />
            </motion.div>
          </motion.div>

          <div className="mb-8">
            <p className="text-slate-300 text-sm">Secure Google sign-in keeps your vendai workspace connected across desktop and web.</p>
          </div>

          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-4 px-6 font-medium rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform bg-white text-slate-900 border-0 hover:bg-gray-50 hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continue with Google</span>
          </Button>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm"
            >
              {errorMessage}
            </motion.div>
          )}

          <p className="text-slate-500 text-xs mt-6">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-slate-300 hover:text-white underline underline-offset-2">
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-slate-300 hover:text-white underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </div>
  );
}