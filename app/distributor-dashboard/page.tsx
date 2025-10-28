'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Package, Upload, FileSpreadsheet, Plus, ShoppingBag, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { UniversalLoading } from '@/components/universal-loading';
import localFont from 'next/font/local';

const neueHaas = localFont({
  src: [
    {
      path: '../../public/fonts/Neue Haas Grotesk Display Pro 55 Roman.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Neue Haas Grotesk Display Pro 65 Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Neue Haas Grotesk Display Pro 75 Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-neue-haas'
});

export default function DistributorDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      // Check if this is the first login
      const hasSeenWelcome = localStorage.getItem('hasSeenDistributorWelcome');
      if (!hasSeenWelcome) {
        setShowWelcome(true);
        localStorage.setItem('hasSeenDistributorWelcome', 'true');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return <UniversalLoading type="initializing" message="Loading your dashboard..." />;
  }

  return (
    <>
      <style jsx global>{`
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(56, 189, 248, 0.5);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(56, 189, 248, 0.7);
        }
      `}</style>
      
      <div className={`module-background relative min-h-screen w-full overflow-hidden px-6 py-16 sm:px-10 lg:px-16 ${neueHaas.className}`}>
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[140px]" />
          <div className="absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-sky-500/18 blur-[160px]" />
          <div className="absolute bottom-[-18%] right-[-12%] h-[24rem] w-[24rem] rounded-full bg-indigo-500/18 blur-[160px]" />
        </div>

        {/* Welcome Modal */}
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/12 bg-slate-900/95 p-8 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-6 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500">
                  <Package className="h-10 w-10 text-white" />
                </div>
              </div>
              
              <h2 className="mb-3 text-center text-3xl font-bold text-slate-100">
                Welcome to Vendai! 🎉
              </h2>
              
              <p className="mb-8 text-center text-slate-300">
                Let's get your shop set up and start selling to retailers across Kenya.
              </p>
              
              <Button
                onClick={() => setShowWelcome(false)}
                className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 py-3 text-white shadow-lg hover:shadow-xl transition-all"
              >
                Get Started
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* Main Content */}
        <div className="relative z-10 mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center"
          >
            <h1 className="mb-3 text-4xl font-bold text-slate-100">
              Hi {user?.displayName?.split(' ')[0] || 'there'},
            </h1>
            <p className="text-xl text-slate-300">
              Let's finish setting up your shop
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Add at least 2 products to go live to retailers on Vendai.
            </p>
          </motion.div>

          {/* Main Action Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] p-8 shadow-xl backdrop-blur-xl"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-2xl font-semibold text-slate-100">Upload a spreadsheet</h2>
                  <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-300">
                    Easiest
                  </span>
                </div>
                <p className="text-sm text-slate-300">
                  Import your catalog from Etsy, WooCommerce, PrestaShop, etc. by uploading your catalog file or fill out our catalog template.
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="flex gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/20">
                    <span className="text-xs font-bold text-orange-300">WOO</span>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/20">
                    <span className="text-xs font-bold text-orange-300">Etsy</span>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/20">
                    <FileSpreadsheet className="h-6 w-6 text-green-300" />
                  </div>
                </div>
              </div>
            </div>
            
            <Button className="mt-4 rounded-xl bg-slate-800 px-6 py-3 text-white hover:bg-slate-700">
              <Upload className="mr-2 h-4 w-4" />
              Upload file
            </Button>
          </motion.div>

          {/* Additional Options */}
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] p-8 backdrop-blur-xl"
            >
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800">
                <ShoppingBag className="h-8 w-8 text-sky-300" />
              </div>
              
              <h3 className="mb-2 text-xl font-semibold text-slate-100">Import from Shopify</h3>
              <p className="mb-6 text-sm text-slate-300">
                Seamlessly import your product catalog from Shopify. Choose which products you'd like to import and always keep your Shopify data safe and private.
              </p>
              
              <Button variant="outline" className="rounded-xl border-white/20 text-slate-200 hover:bg-white/10">
                Import from Shopify
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] p-8 backdrop-blur-xl"
            >
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800">
                <Plus className="h-8 w-8 text-indigo-300" />
              </div>
              
              <h3 className="mb-2 text-xl font-semibold text-slate-100">Add products individually</h3>
              <p className="mb-6 text-sm text-slate-300">
                Create new products one by one using a simple product creation form.
              </p>
              
              <Button variant="outline" className="rounded-xl border-white/20 text-slate-200 hover:bg-white/10">
                Add product
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
