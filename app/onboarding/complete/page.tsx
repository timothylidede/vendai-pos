'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Sparkles, ArrowRight, Store, Truck, AlertCircle } from 'lucide-react';
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
        console.log('No user logged in, redirecting to login');
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Show loading while checking status
  if (loading) {
    return (
      <div className="module-background relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-16 sm:px-10 lg:px-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[140px]" />
          <div className="absolute -top-24 left-1/2 h-[22rem] w-[22rem] -translate-x-1/2 rounded-full bg-sky-500/18 blur-[140px]" />
          <div className="absolute bottom-[-18%] right-[-10%] h-[24rem] w-[24rem] rounded-full bg-indigo-500/16 blur-[150px]" />
          <div className="absolute top-1/3 -left-16 h-64 w-64 rounded-full bg-cyan-400/14 blur-[130px]" />
        </div>
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-300/70 border-t-transparent" />
          </div>
          <p className="text-sm font-medium text-slate-200/80">Loading your workspace…</p>
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
    <div className="module-background relative min-h-screen w-full overflow-hidden px-6 py-16 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[140px]" />
        <div className="absolute -top-24 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-sky-500/18 blur-[160px]" />
        <div className="absolute bottom-[-18%] right-[-10%] h-[28rem] w-[28rem] rounded-full bg-indigo-500/16 blur-[170px]" />
        <div className="absolute top-1/3 -left-20 h-72 w-72 rounded-full bg-cyan-400/14 blur-[150px]" />
      </div>
      {/* Animated light specks */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: 0, opacity: 0 }}
            animate={{
              scale: [0, 1.15, 1],
              rotate: [0, 120, 240],
              opacity: [0, 1, 0.7],
              y: [0, -36, 0],
            }}
            transition={{
              delay: i * 0.12,
              duration: 1,
              ease: 'easeOut',
              repeat: Infinity,
              repeatDelay: 2.4,
            }}
            className="absolute h-2 w-2 rounded-full bg-gradient-to-r from-sky-300 to-indigo-300"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-400/25 bg-red-500/10 px-5 py-4 backdrop-blur-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-300" />
              <div>
                <p className="text-sm font-semibold text-red-200">Error</p>
                <p className="text-xs text-red-300/80">{error}</p>
              </div>
            </div>
          )}

          {/* Success Animation */}
          <div className="mb-10 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: "backOut" }}
              className="relative mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full border border-sky-300/40 bg-gradient-to-br from-sky-500/20 to-emerald-500/20 shadow-[0_25px_60px_-30px_rgba(16,185,129,0.6)] backdrop-blur-lg"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, duration: 0.3 }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-400/25 to-indigo-400/25 blur-[2px]"
              />
              <CheckCircle className="relative z-10 h-10 w-10 text-emerald-300" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="space-y-2"
            >
              <div className="mb-4 flex items-center justify-center gap-3 text-slate-100">
                <Sparkles className="h-6 w-6 text-sky-200" />
                <h1 className="text-3xl font-bold tracking-tight text-slate-50">You&rsquo;re all set!</h1>
                <Sparkles className="h-6 w-6 text-sky-200" />
              </div>
              <p className="text-base text-slate-300/85">
                <span className="font-semibold text-sky-200">{businessName}</span> is ready to operate on Vendai.
              </p>
            </motion.div>
          </div>

          {/* Completion Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 0.5, ease: "easeOut" }}
          >
            <Card className="group relative overflow-hidden rounded-[28px] border border-white/12 bg-white/[0.06] px-8 py-10 shadow-[0_35px_120px_-45px_rgba(12,24,46,0.85)] backdrop-blur-3xl">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.22),transparent_65%)] opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_70%)] opacity-60" />

              <div className="relative z-10 space-y-7">
                {/* Welcome Message */}
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/8 shadow-[0_20px_50px_-30px_rgba(56,189,248,0.8)]">
                    <Image
                      src="/images/logo-icon-remove.png"
                      alt="VendAI Logo"
                      width={40}
                      height={40}
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                  <h2 className="mb-2 text-xl font-semibold text-slate-100">
                    Welcome to VendAI, {businessName}!
                  </h2>
                  <p className="text-sm text-slate-300/80">
                    {userRole === 'retailer' 
                      ? 'Your POS workspace is ready for fast checkouts and live stock tracking.'
                      : 'Your distribution hub is set to manage orders, inventory, and deliveries.'
                    }
                  </p>
                </div>

                {/* Features Summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-100">Business profile created</div>
                      <div className="text-xs text-slate-300/75">
                        {userRole === 'retailer' ? 'Retail store profile' : 'Distribution profile'} now live
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-200">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-100">Location set</div>
                      <div className="text-xs text-slate-300/75">Ready for local matching and alerts</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
                      {userRole === 'retailer' ? <Store className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-100">
                        {userRole === 'retailer' ? 'POS system ready' : 'Distribution tools ready'}
                      </div>
                      <div className="text-xs text-slate-300/75">
                        {userRole === 'retailer' 
                          ? 'Start processing sales immediately.'
                          : 'Manage orders, inventory, and deliveries.'
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-sky-500/15 via-cyan-500/15 to-indigo-500/15 p-5">
                  <h3 className="mb-2 text-sm font-semibold text-slate-100">🚀 What&rsquo;s next?</h3>
                  <ul className="space-y-1 text-sm text-slate-200/80">
                    {userRole === 'retailer' ? (
                      <>
                        <li>• Process your first sale in the POS</li>
                        <li>• Track inventory and set reorder alerts</li>
                        <li>• Connect with nearby suppliers</li>
                      </>
                    ) : (
                      <>
                        <li>• Upload or refine your product catalogue</li>
                        <li>• Process retailer orders and invoices</li>
                        <li>• Track deliveries and payments</li>
                      </>
                    )}
                  </ul>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={handleGoToDashboard}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400/90 via-sky-400/95 to-indigo-500/90 px-6 py-4 text-sm font-semibold text-slate-950 shadow-[0_25px_60px_-35px_rgba(14,165,233,0.9)] transition hover:shadow-[0_30px_70px_-35px_rgba(14,165,233,1)]"
                >
                  <span>Enter dashboard</span>
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Button>

                {/* Help Text */}
                <div className="text-center">
                  <p className="text-xs text-slate-300/70">
                    Need help getting started? Check out our{' '}
                    <span className="cursor-pointer text-sky-200 hover:text-sky-100">quick start guide</span>
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
            <p className="text-sm text-slate-300/75">
              🎉 Thanks for choosing VendAI to power your operations.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}