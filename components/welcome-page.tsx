'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import { signInWithPopup, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { Download, ExternalLink } from 'lucide-react';

export function WelcomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [isVercel, setIsVercel] = useState(false);

  useEffect(() => {
    // Detect environment
    const checkElectron = () => {
      return !!(
        (window as any).electronAPI || 
        (window as any).require || 
        navigator.userAgent.toLowerCase().indexOf('electron') > -1
      );
    };
    
    const checkVercel = () => {
      return window.location.hostname.includes('vercel.app') || 
             window.location.hostname === 'app.vendai.digital';
    };

    setIsElectron(checkElectron());
    setIsVercel(checkVercel());
  }, []);

  const handleDownloadApp = () => {
    // Redirect to the main vendai.digital site for download
    window.open('https://vendai.digital', '_blank');
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      console.log('Starting Google sign in...', { isElectron, isVercel });
      
      if (isElectron && (window as any).electronAPI) {
        // Electron OAuth flow
        console.log('Using Electron OAuth flow...');
        
        const electronAPI = (window as any).electronAPI;
        const oauthResult = await electronAPI.googleOAuth() as any;
        
        if (oauthResult && oauthResult.success && oauthResult.user) {
          const googleUser = oauthResult.user;
          console.log('OAuth successful, creating Firebase user:', googleUser.email);
          
          try {
            const credential = GoogleAuthProvider.credential(
              oauthResult.tokens.idToken || null,
              oauthResult.tokens.accessToken || null
            );
            const userCred = await signInWithCredential(auth, credential);
            await handleUserAuthentication(userCred.user);
          } catch (fbErr: any) {
            console.error('Firebase sign-in with Google credential failed:', fbErr);
            // Fallback for Electron
            await handleElectronFallback(googleUser);
          }
        } else {
          throw new Error('OAuth failed or was cancelled');
        }
      } else {
        // Web OAuth flow (Vercel/browser)
        console.log('Using web OAuth flow...');
        
        try {
          const result = await signInWithPopup(auth, googleProvider);
          await handleUserAuthentication(result.user);
        } catch (webErr: any) {
          console.error('Web sign-in failed:', webErr);
          throw webErr;
        }
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      
      let friendlyMessage = 'An error occurred during sign in. Please try again.';
      
      if (error.message?.includes('OAuth timeout')) {
        friendlyMessage = 'Sign in timed out. Please try again.';
      } else if (error.message?.includes('cancelled') || error.message?.includes('closed')) {
        friendlyMessage = 'Sign in was cancelled. Please try again if you want to continue.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        friendlyMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.code === 'auth/popup-blocked') {
        friendlyMessage = 'Pop-up was blocked. Please allow pop-ups for this site and try again.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        friendlyMessage = 'Sign in was cancelled. Please try again if you want to continue.';
      }
      
      setErrorMessage(friendlyMessage);
      
      // Auto-clear error after 5 seconds
      setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserAuthentication = async (user: any) => {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      console.log('Existing user detected - checking onboarding status');
      const userData = userDoc.data();
      const userRole = userData?.role || 'retailer';
      const onboardingCompleted = userData?.onboardingCompleted;
      
      localStorage.setItem('vendai-user-role', userRole);
      
      if (userRole && onboardingCompleted) {
        console.log('User has role and completed onboarding - redirecting to dashboard');
        localStorage.setItem('vendai-first-login', 'false');
        router.push('/modules');
      } else {
        console.log('User exists but needs to complete onboarding');
        localStorage.setItem('vendai-first-login', 'true');
        router.push('/onboarding/choose');
      }
    } else {
      console.log('New user detected - creating profile and redirecting to onboarding');
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
        onboardingCompleted: false,
        role: 'retailer'
      });
      localStorage.setItem('vendai-first-login', 'true');
      router.push('/onboarding/choose');
    }
  };

  const handleElectronFallback = async (googleUser: any) => {
    const userDocRef = doc(db, 'users', googleUser.id);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid: googleUser.id,
        email: googleUser.email,
        displayName: googleUser.name,
        photoURL: googleUser.picture,
        createdAt: new Date().toISOString(),
        onboardingCompleted: false,
        role: 'retailer'
      });
      localStorage.setItem('vendai-first-login', 'true');
      router.push('/onboarding/choose');
    } else {
      const userData = userDoc.data();
      const userRole = userData?.role || 'retailer';
      const onboardingCompleted = userData?.onboardingCompleted;
      
      localStorage.setItem('vendai-user-role', userRole);
      
      if (userRole && onboardingCompleted) {
        console.log('User has role and completed onboarding - redirecting to dashboard');
        localStorage.setItem('vendai-first-login', 'false');
        router.push('/modules');
      } else {
        console.log('User exists but needs to complete onboarding');
        localStorage.setItem('vendai-first-login', 'true');
        router.push('/onboarding/choose');
      }
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-900/30 to-slate-900 flex items-center justify-center p-6 relative">
      <div className="max-w-md w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Logo/Brand Section */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-6"
            >
              <motion.div
                className="relative w-20 h-20 mx-auto cursor-pointer"
                whileHover={{ 
                  rotate: 360,
                  transition: { duration: 0.6, ease: "easeInOut" }
                }}
              >
                <Image
                  src="/images/logo-icon-remove.png"
                  alt="VendAI Logo"
                  width={80}
                  height={80}
                  className="w-full h-full object-contain drop-shadow-lg"
                />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-6"
            >
              <h1 className="text-2xl font-bold text-white mb-2">Welcome to VendAI</h1>
              <p className="text-slate-400 text-sm">
                {isElectron 
                  ? "AI-Powered POS & ERP Desktop Application"
                  : "Access your AI-Powered POS & ERP system"
                }
              </p>
            </motion.div>
          </div>

          {/* Environment-specific content */}
          {!isElectron && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mb-6"
            >
              <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                <div className="flex items-start space-x-3">
                  <Download className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <h3 className="text-white font-medium mb-1">Download Desktop App</h3>
                    <p className="text-slate-400 text-sm mb-3">
                      For the full experience, download the desktop application with offline capabilities.
                    </p>
                    <Button
                      onClick={handleDownloadApp}
                      variant="outline"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-sm h-8"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Download App
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Google Sign In Button */}
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className={`w-full py-4 px-6 font-medium rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
              errorMessage 
                ? 'bg-red-50 hover:bg-red-100 border border-red-300 hover:border-red-400 text-red-700' 
                : 'bg-white hover:bg-gray-50 border border-gray-300 hover:border-gray-400 text-black'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                <span>Signing in...</span>
              </>
            ) : errorMessage ? (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Try Again</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </Button>

          {/* Error Message */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
            >
              <p className="text-red-400 text-sm text-center">{errorMessage}</p>
            </motion.div>
          )}

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-slate-500 text-xs">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
            {isVercel && (
              <p className="text-slate-600 text-xs mt-2">
                Running on Vercel • Web Version
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}