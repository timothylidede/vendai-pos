'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Sparkles, ArrowRight, Store, Truck } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'retailer' | 'distributor'>('retailer');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Check if user has already completed onboarding
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.onboardingCompleted) {
              // Get user data for display
              setUserRole(userData.role || 'retailer');
              setBusinessName(userData.organizationName || 'Your Business');
              setLoading(false);
            } else {
              // User hasn't completed onboarding, redirect back to onboarding
              console.log('User has not completed onboarding, redirecting to onboarding');
              router.push('/onboarding');
              return;
            }
          } else {
            // No user document, redirect to onboarding
            console.log('No user document found, redirecting to onboarding');
            router.push('/onboarding');
            return;
          }
        } catch (error) {
          console.error('Error checking onboarding status:', error);
          setError('Failed to load user data. Please try again.');
          setLoading(false);
        }
      } else {
        console.log('No user logged in, redirecting to signup');
        router.push('/signup');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Show loading while checking status
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-900/30 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  const handleGoToDashboard = () => {
    // Route based on user role
    if (userRole === 'retailer') {
      router.push('/modules/pos'); // Retailers land on POS first
    } else {
      router.push('/modules/inventory'); // Distributors land on inventory/orders first
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-900/30 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 opacity-20">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: 0, opacity: 0 }}
            animate={{
              scale: [0, 1.2, 1],
              rotate: [0, 180, 360],
              opacity: [0, 1, 0.8],
              y: [0, -50, 0],
            }}
            transition={{
              delay: i * 0.1,
              duration: 0.8,
              ease: "easeOut",
              repeat: Infinity,
              repeatDelay: 2
            }}
            className="absolute w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="max-w-lg w-full relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Success Animation */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: "backOut" }}
              className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500/30 to-blue-500/30 backdrop-blur-sm border border-green-400/30 flex items-center justify-center shadow-2xl shadow-green-500/30 mb-6 relative"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, duration: 0.3 }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400/20 to-blue-400/20 animate-pulse"
              />
              <CheckCircle className="w-10 h-10 text-green-400 relative z-10" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Sparkles className="w-6 h-6 text-yellow-400" />
                <h1 className="text-3xl font-bold text-white">You're All Set!</h1>
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </div>
              <p className="text-lg text-slate-300">
                <span className="text-blue-400 font-semibold">{businessName}</span> is ready to go
              </p>
            </motion.div>
          </div>

          {/* Completion Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            <Card className="backdrop-blur-xl bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-slate-900/70 border border-slate-700/40 rounded-2xl p-8 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.6)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-blue-500/5 pointer-events-none"></div>
              
              <div className="relative z-10 space-y-6">
                {/* Welcome Message */}
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-slate-600/20 backdrop-blur-sm border border-blue-400/20 flex items-center justify-center shadow-xl mb-4">
                    <Image
                      src="/images/logo-icon-remove.png"
                      alt="VendAI Logo"
                      width={40}
                      height={40}
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">
                    Welcome to VendAI, {businessName}!
                  </h2>
                  <p className="text-slate-400 text-sm">
                    {userRole === 'retailer' 
                      ? 'Your POS system is ready to process sales and manage inventory'
                      : 'Your distribution platform is ready to manage orders and catalog'
                    }
                  </p>
                </div>

                {/* Features Summary */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-slate-800/20 rounded-lg border border-slate-700/30">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">Business Profile Created</div>
                      <div className="text-slate-400 text-xs">
                        {userRole === 'retailer' ? 'Retail store profile' : 'Distribution business profile'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 bg-slate-800/20 rounded-lg border border-slate-700/30">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">Location Set</div>
                      <div className="text-slate-400 text-xs">Ready for local business connections</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 bg-slate-800/20 rounded-lg border border-slate-700/30">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      {userRole === 'retailer' ? <Store className="w-4 h-4 text-purple-400" /> : <Truck className="w-4 h-4 text-purple-400" />}
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">
                        {userRole === 'retailer' ? 'POS System Ready' : 'Distribution Platform Ready'}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {userRole === 'retailer' 
                          ? 'Start processing sales immediately'
                          : 'Manage orders and inventory'
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl">
                  <h3 className="text-white font-medium mb-2">🚀 What's Next?</h3>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {userRole === 'retailer' ? (
                      <>
                        <li>• Process your first sale with the POS system</li>
                        <li>• Track inventory and get reorder alerts</li>
                        <li>• Connect with nearby suppliers</li>
                      </>
                    ) : (
                      <>
                        <li>• Manage your product catalog</li>
                        <li>• Process retailer orders</li>
                        <li>• Track deliveries and payments</li>
                      </>
                    )}
                  </ul>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={handleGoToDashboard}
                  className="w-full py-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center space-x-2"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>

                {/* Help Text */}
                <div className="text-center">
                  <p className="text-slate-500 text-xs">
                    Need help getting started? Check out our{' '}
                    <span className="text-blue-400 hover:text-blue-300 cursor-pointer">quick start guide</span>
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Footer Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="text-center mt-6"
          >
            <p className="text-slate-400 text-sm">
              🎉 Thank you for choosing VendAI for your business
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}