'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Package, Upload, FileSpreadsheet, Plus, ShoppingBag, Store, Home, ShoppingCart, MessageSquare, Box, Users, TrendingUp, BarChart3, Settings, ChevronDown, User, Mail, Camera, FileText, ClipboardCheck, CheckCircle } from 'lucide-react';
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

type TabType = 'home' | 'orders' | 'messages' | 'products' | 'customers' | 'marketing' | 'analytics' | 'myshop' | 'settings';

interface GetStartedStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  time: string;
  completed: boolean;
}

export default function DistributorDashboard() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // Get started guide steps
  const getStartedSteps: GetStartedStep[] = [
    {
      id: 'profile-photo',
      title: 'Add profile photo',
      description: 'Upload a professional photo to build trust with retailers',
      icon: Camera,
      time: '1 min',
      completed: completedSteps.includes('profile-photo')
    },
    {
      id: 'brand-story',
      title: 'Add brand story',
      description: 'Tell retailers about your brand and what makes you unique',
      icon: FileText,
      time: '2 mins',
      completed: completedSteps.includes('brand-story')
    },
    {
      id: 'order-preferences',
      title: 'Add order preferences',
      description: 'Set minimum order quantities, payment terms, and shipping options',
      icon: ClipboardCheck,
      time: '5 mins',
      completed: completedSteps.includes('order-preferences')
    },
    {
      id: 'confirm-email',
      title: 'Confirm email address',
      description: `Check ${user?.email} for an email and follow the steps to verify your account`,
      icon: Mail,
      time: '1 min',
      completed: completedSteps.includes('confirm-email')
    },
    {
      id: 'add-products',
      title: 'Add products',
      description: 'Upload at least 2 products to go live to retailers',
      icon: Package,
      time: '10 mins',
      completed: completedSteps.includes('add-products')
    }
  ];

  const completionCount = completedSteps.length;
  const totalSteps = getStartedSteps.length;

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
      
      // Load completed steps from localStorage
      const savedSteps = localStorage.getItem('vendai-distributor-completed-steps');
      if (savedSteps) {
        try {
          setCompletedSteps(JSON.parse(savedSteps));
        } catch (e) {
          console.error('Error loading completed steps:', e);
        }
      }
    }
  }, [user, loading, router]);

  const toggleStepCompletion = (stepId: string) => {
    const newCompleted = completedSteps.includes(stepId)
      ? completedSteps.filter(id => id !== stepId)
      : [...completedSteps, stepId];
    setCompletedSteps(newCompleted);
    localStorage.setItem('vendai-distributor-completed-steps', JSON.stringify(newCompleted));
  };

  const sidebarTabs = [
    { id: 'home' as TabType, label: 'Home', icon: Home },
    { id: 'orders' as TabType, label: 'Orders', icon: ShoppingCart, hasDropdown: true },
    { id: 'messages' as TabType, label: 'Messages', icon: MessageSquare },
    { id: 'products' as TabType, label: 'Products', icon: Box, hasDropdown: true },
    { id: 'customers' as TabType, label: 'Customers', icon: Users, hasDropdown: true },
    { id: 'marketing' as TabType, label: 'Marketing', icon: TrendingUp, hasDropdown: true },
    { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3, hasDropdown: true },
    { id: 'myshop' as TabType, label: 'My shop', icon: Store, hasDropdown: true },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings, hasDropdown: true, route: '/distributor-dashboard/settings' },
  ];

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
      
      <div className={`flex min-h-screen bg-slate-950 ${neueHaas.className}`}>
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-white/10 bg-slate-900/50 backdrop-blur-xl">
          {/* Logo */}
          <div className="flex h-16 items-center px-6">
            <div className="flex items-center gap-2">
              <img src="/images/logo-icon-remove.png" alt="Vendai" className="h-8 w-8" />
              <span className="text-lg font-semibold tracking-tight text-slate-100" style={{ letterSpacing: '0.05em' }}>
                VENDAI
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-2 px-3">
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.route) {
                      router.push(tab.route);
                    } else {
                      setActiveTab(tab.id);
                    }
                  }}
                  className={`group mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all ${
                    isActive
                      ? 'bg-sky-500/10 text-sky-300 font-medium'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.hasDropdown && (
                    <ChevronDown className={`h-4 w-4 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Section */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
            <div className="text-xs text-slate-500">
              <div className="mb-1">Sales channels</div>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-800">
                  <Store className="h-4 w-4 text-slate-400" />
                </div>
                <span className="text-slate-400">Marketplace</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
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

          {/* Content Area */}
          <div className="relative z-10 px-8 py-6">
            {/* Home Tab - Get Started Guide */}
            {activeTab === 'home' && (
              <div className="mx-auto max-w-5xl">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8"
                >
                  <h1 className="mb-2 text-3xl font-bold text-slate-100">
                    Hi {userData?.displayName?.split(' ')[0] || user?.displayName?.split(' ')[0] || 'Timothy'},
                  </h1>
                  <p className="text-lg text-slate-300">
                    Let's finish setting up your shop
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Add at least 2 products to go live to retailers on Vendai.
                  </p>
                </motion.div>

                {/* Get Started Guide Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"
                >
                  <div className="border-b border-white/10 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="mb-1 text-2xl font-semibold text-slate-100">Get started guide</h2>
                        <p className="text-sm text-slate-400">Welcome to Vendai! Let's get some of the basics set up.</p>
                      </div>
                      <button className="text-slate-400 hover:text-slate-200">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                        <span>Guide completion</span>
                        <span className="font-semibold text-slate-200">{completionCount} / {totalSteps}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${(completionCount / totalSteps) * 100}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Steps List */}
                  <div className="divide-y divide-white/5">
                    {getStartedSteps.map((step, index) => {
                      const StepIcon = step.icon;
                      const isActive = index === 0 && !step.completed;
                      
                      return (
                        <motion.div
                          key={step.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                          className={`group flex items-center gap-4 p-6 transition-all hover:bg-white/5 ${
                            isActive ? 'bg-sky-500/5' : ''
                          }`}
                        >
                          {/* Icon */}
                          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                            step.completed
                              ? 'bg-green-500/20 text-green-300'
                              : isActive
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {step.completed ? (
                              <CheckCircle className="h-6 w-6" />
                            ) : (
                              <StepIcon className="h-6 w-6" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <h3 className={`font-medium ${
                                step.completed ? 'text-slate-400 line-through' : 'text-slate-100'
                              }`}>
                                {step.title}
                              </h3>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                isActive
                                  ? 'bg-sky-500/20 text-sky-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {step.time}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400">
                              {step.description}
                            </p>
                          </div>

                          {/* Action Button */}
                          {!step.completed && isActive && (
                            <Button
                              onClick={() => toggleStepCompletion(step.id)}
                              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
                            >
                              {step.id === 'confirm-email' ? 'Open your email' : 'Start'}
                            </Button>
                          )}
                          
                          {step.completed && (
                            <button
                              onClick={() => toggleStepCompletion(step.id)}
                              className="text-xs text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Mark incomplete
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Main Action Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:bg-white/10 transition-all"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/20">
                      <FileSpreadsheet className="h-6 w-6 text-green-300" />
                    </div>
                    
                    <h3 className="mb-2 text-lg font-semibold text-slate-100">Upload a spreadsheet</h3>
                    <p className="mb-4 text-sm text-slate-400">
                      Import your catalog from Etsy, WooCommerce, etc.
                    </p>
                    
                    <Button variant="outline" className="w-full rounded-lg border-white/20 text-slate-200 hover:bg-white/10">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload file
                    </Button>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:bg-white/10 transition-all"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20">
                      <ShoppingBag className="h-6 w-6 text-purple-300" />
                    </div>
                    
                    <h3 className="mb-2 text-lg font-semibold text-slate-100">Import from Shopify</h3>
                    <p className="mb-4 text-sm text-slate-400">
                      Seamlessly import your product catalog
                    </p>
                    
                    <Button variant="outline" className="w-full rounded-lg border-white/20 text-slate-200 hover:bg-white/10">
                      Import from Shopify
                    </Button>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:bg-white/10 transition-all"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/20">
                      <Plus className="h-6 w-6 text-sky-300" />
                    </div>
                    
                    <h3 className="mb-2 text-lg font-semibold text-slate-100">Add products individually</h3>
                    <p className="mb-4 text-sm text-slate-400">
                      Create products one by one
                    </p>
                    
                    <Button variant="outline" className="w-full rounded-lg border-white/20 text-slate-200 hover:bg-white/10">
                      Add product
                    </Button>
                  </motion.div>
                </div>
              </div>
            )}

            {/* Other Tabs - Placeholder */}
            {activeTab !== 'home' && (
              <div className="flex h-96 items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 text-6xl">🚧</div>
                  <h2 className="mb-2 text-2xl font-semibold text-slate-100 capitalize">
                    {activeTab} Section
                  </h2>
                  <p className="text-slate-400">Coming soon...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Welcome Modal - Moved outside main content */}
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
      </div>
    </>
  );
}
