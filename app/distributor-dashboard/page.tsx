'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Upload, FileSpreadsheet, Plus, ShoppingBag, Store, Home, ShoppingCart, MessageSquare, Box, Users, TrendingUp, BarChart3, Settings, ChevronDown, User, Mail, Camera, FileText, ClipboardCheck, CheckCircle, X, Search, Filter, ImageIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { UniversalLoading } from '@/components/universal-loading';
import localFont from 'next/font/local';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

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

interface Product {
  id: string;
  name: string;
  description: string;
  status: 'published' | 'unpublished' | 'draft';
  images: string[];
  price?: number;
  wholesalePrice?: number;
  minOrderQty?: number;
  createdAt: any;
  updatedAt: any;
}

// Products Content Component
function ProductsContent({ 
  activeProductsTab, 
  setActiveProductsTab,
  userData 
}: { 
  activeProductsTab: 'all' | 'published' | 'unpublished' | 'drafts';
  setActiveProductsTab: (tab: 'all' | 'published' | 'unpublished' | 'drafts') => void;
  userData: any;
}) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [tabCounts, setTabCounts] = useState({
    all: 0,
    published: 0,
    unpublished: 0,
    drafts: 0
  });

  useEffect(() => {
    loadProducts();
  }, [activeProductsTab, sortBy, userData]);

  const loadProducts = async () => {
    if (!(userData as any)?.organizationId) return;

    setLoading(true);
    try {
      let q = query(
        collection(db!, 'products'),
        where('organizationId', '==', (userData as any).organizationId),
        where('createdBy', '==', userData!.uid)
      );

      // Filter by status
      if (activeProductsTab !== 'all') {
        const statusMap = {
          published: 'published',
          unpublished: 'unpublished',
          drafts: 'draft'
        };
        q = query(q, where('status', '==', statusMap[activeProductsTab]));
      }

      // Sort
      if (sortBy === 'newest') {
        q = query(q, orderBy('createdAt', 'desc'));
      } else if (sortBy === 'oldest') {
        q = query(q, orderBy('createdAt', 'asc'));
      } else if (sortBy === 'name') {
        q = query(q, orderBy('name', 'asc'));
      }

      const snapshot = await getDocs(q);
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];

      setProducts(productsData);

      // Calculate counts
      const allQuery = query(
        collection(db!, 'products'),
        where('organizationId', '==', (userData as any).organizationId),
        where('createdBy', '==', userData!.uid)
      );
      const allSnapshot = await getDocs(allQuery);
      const allProducts = allSnapshot.docs.map(doc => doc.data());

      setTabCounts({
        all: allProducts.length,
        published: allProducts.filter((p: any) => p.status === 'published').length,
        unpublished: allProducts.filter((p: any) => p.status === 'unpublished').length,
        drafts: allProducts.filter((p: any) => p.status === 'draft').length
      });
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-slate-100">Products</h1>
          <p className="text-slate-400">Manage your product catalog</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => alert('Bulk upload coming soon!')}
            className="px-4 py-2.5 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all duration-200 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Bulk upload
          </button>
          <button
            onClick={() => router.push('/distributor-dashboard/products/add')}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Add product
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="px-4 py-3 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all duration-200 flex items-center gap-2 min-w-[140px] justify-between"
          >
            <span className="text-sm">
              {sortBy === 'newest' && 'Newest'}
              {sortBy === 'oldest' && 'Oldest'}
              {sortBy === 'name' && 'Name'}
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {showSortDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSortDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-48 rounded-xl backdrop-blur-2xl bg-slate-900/95 border border-white/10 shadow-2xl overflow-hidden z-20">
                {['newest', 'oldest', 'name'].map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSortBy(option);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm transition-all duration-200 ${
                      sortBy === option
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button className="p-3 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all duration-200">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filteredProducts.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center mb-6">
            <Box className="w-16 h-16 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No products yet</h2>
          <p className="text-slate-400 text-center mb-8 max-w-md">
            {activeProductsTab === 'all' 
              ? "Get started by adding your first product to your catalog"
              : `No ${activeProductsTab} products found`}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/distributor-dashboard/products/add')}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-5 h-5" />
              Add your first product
            </button>
            <button
              onClick={() => alert('Bulk upload coming soon!')}
              className="px-6 py-3 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all duration-200 flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Bulk upload
            </button>
          </div>
        </div>
      ) : (
        /* Products Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="group rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-blue-500/10"
            >
              {/* Product Image */}
              <div className="aspect-square relative overflow-hidden bg-white">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100">
                    <ImageIcon className="w-20 h-20 text-slate-400" />
                  </div>
                )}
                
                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium backdrop-blur-md ${
                    product.status === 'published'
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : product.status === 'unpublished'
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                  }`}>
                    {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="font-semibold text-white mb-1 line-clamp-1">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm">
                  {product.wholesalePrice && (
                    <span className="text-slate-300 font-medium">
                      KES {product.wholesalePrice.toLocaleString()}
                    </span>
                  )}
                  {product.minOrderQty && (
                    <span className="text-slate-400">
                      Min: {product.minOrderQty}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DistributorDashboard() {
  const router = useRouter();
  const { user, userData, loading, clearUserData } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'shop' | 'shipping' | 'account' | 'team'>('shop');
  const [showProductsDropdown, setShowProductsDropdown] = useState(false);
  const [activeProductsTab, setActiveProductsTab] = useState<'all' | 'published' | 'unpublished' | 'drafts'>('all');
  
  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSortBy, setProductSortBy] = useState('newest');
  const [showProductSortDropdown, setShowProductSortDropdown] = useState(false);
  const [activeProductTab, setActiveProductTab] = useState<'all' | 'published' | 'unpublished' | 'drafts'>('all');
  const [productTabCounts, setProductTabCounts] = useState({ all: 0, published: 0, unpublished: 0, drafts: 0 });

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
    { id: 'settings' as TabType, label: 'Settings', icon: Settings, hasDropdown: true },
  ];

  const handleSignOut = async () => {
    try {
      await signOut(auth!);
      clearUserData();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

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
      
      <div className={`flex h-screen overflow-hidden bg-slate-950 ${neueHaas.className}`}>
        {/* Sidebar - Fixed */}
        <div className="flex w-64 flex-shrink-0 flex-col border-r border-white/10 bg-slate-900/50 backdrop-blur-xl">
          {/* Logo */}
          <div className="flex h-16 flex-shrink-0 items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <img src="/images/logo-icon-remove.png" alt="Vendai" className="h-8 w-8" />
            </div>
            
            {/* Account Button */}
            <button
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <User className="h-4 w-4 text-slate-300" />
            </button>
          </div>

          {/* Navigation - Scrollable if needed but shouldn't scroll normally */}
          <nav className="flex-1 overflow-y-auto px-3 py-2">
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isSettings = tab.id === 'settings';
              
              return (
                <div key={tab.id}>
                  <button
                    onClick={() => {
                      if (isSettings) {
                        setShowSettingsDropdown(!showSettingsDropdown);
                      } else if (tab.id === 'products') {
                        setShowProductsDropdown(!showProductsDropdown);
                        setActiveTab('products');
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
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                        (isSettings && showSettingsDropdown) || (tab.id === 'products' && showProductsDropdown) ? 'rotate-180' : ''
                      } ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                    )}
                  </button>
                  
                  {/* Products Dropdown */}
                  {tab.id === 'products' && showProductsDropdown && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
                      <button
                        onClick={() => {
                          setActiveProductsTab('all');
                          setActiveTab('products');
                        }}
                        className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-all ${
                          activeProductsTab === 'all'
                            ? 'bg-sky-500/10 text-sky-300 font-medium'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                      >
                        All products
                      </button>
                      <button
                        onClick={() => {
                          setActiveProductsTab('published');
                          setActiveTab('products');
                        }}
                        className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-all ${
                          activeProductsTab === 'published'
                            ? 'bg-sky-500/10 text-sky-300 font-medium'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                      >
                        Published
                      </button>
                      <button
                        onClick={() => {
                          setActiveProductsTab('unpublished');
                          setActiveTab('products');
                        }}
                        className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-all ${
                          activeProductsTab === 'unpublished'
                            ? 'bg-sky-500/10 text-sky-300 font-medium'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                      >
                        Unpublished
                      </button>
                      <button
                        onClick={() => {
                          setActiveProductsTab('drafts');
                          setActiveTab('products');
                        }}
                        className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-all ${
                          activeProductsTab === 'drafts'
                            ? 'bg-sky-500/10 text-sky-300 font-medium'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                      >
                        Drafts
                      </button>
                    </div>
                  )}
                  
                  {/* Settings Dropdown */}
                  {isSettings && showSettingsDropdown && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
                      <button
                        onClick={() => {
                          setActiveSettingsTab('shop');
                          setActiveTab('settings');
                        }}
                        className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      >
                        Shop settings
                      </button>
                      <button
                        onClick={() => {
                          setActiveSettingsTab('shipping');
                          setActiveTab('settings');
                        }}
                        className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      >
                        Shipping tools
                      </button>
                      <button
                        onClick={() => {
                          setActiveSettingsTab('account');
                          setActiveTab('settings');
                        }}
                        className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      >
                        Account settings
                      </button>
                      <button
                        onClick={() => {
                          setActiveSettingsTab('team');
                          setActiveTab('settings');
                        }}
                        className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      >
                        Team
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Bottom Section - Fixed */}
          <div className="flex-shrink-0 border-t border-white/10 p-4">
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="pointer-events-none fixed inset-0 -z-10">
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
          <div className="relative z-10">
            {/* Home Tab - Get Started Guide */}
            {activeTab === 'home' && (
              <div className="px-6 py-4">
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
                    
                    <Button variant="outline" className="w-full rounded-lg border-white/20 text-slate-200 hover:bg-white/10 cursor-pointer">
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
                    
                    <Button variant="outline" className="w-full rounded-lg border-white/20 text-slate-200 hover:bg-white/10 cursor-pointer">
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
                    
                    <Button variant="outline" className="w-full rounded-lg border-white/20 text-slate-200 hover:bg-white/10 cursor-pointer">
                      Add product
                    </Button>
                  </motion.div>
                </div>
                </div>
              </div>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
              <div className="px-6 py-4">
                <ProductsContent 
                activeProductsTab={activeProductsTab}
                setActiveProductsTab={setActiveProductsTab}
                userData={userData}
              />
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="px-6 py-4">
                <div className="mx-auto max-w-5xl">
                  <div className="mb-8">
                    <h1 className="mb-2 text-3xl font-bold text-slate-100">
                      {activeSettingsTab === 'shop' && 'Shop settings'}
                      {activeSettingsTab === 'shipping' && 'Shipping tools'}
                      {activeSettingsTab === 'account' && 'Account settings'}
                      {activeSettingsTab === 'team' && 'Team'}
                    </h1>
                    <p className="text-slate-400">
                      {activeSettingsTab === 'shop' && 'Manage your shop details and preferences'}
                      {activeSettingsTab === 'shipping' && 'Configure shipping options and rates'}
                      {activeSettingsTab === 'account' && 'Update your account information'}
                      {activeSettingsTab === 'team' && 'Manage team members and permissions'}
                    </p>
                  </div>

                  {/* Settings Content */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
                    {activeSettingsTab === 'shop' && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Shop Name</label>
                          <input
                            type="text"
                            placeholder="Your shop name"
                            className="w-full px-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Shop Description</label>
                          <textarea
                            placeholder="Tell retailers about your shop"
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Business Type</label>
                          <select className="w-full px-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                            <option value="">Select business type</option>
                            <option value="manufacturer">Manufacturer</option>
                            <option value="distributor">Distributor</option>
                            <option value="wholesaler">Wholesaler</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {activeSettingsTab === 'shipping' && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Shipping Methods</label>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                              <input type="checkbox" className="w-4 h-4" />
                              <span className="text-slate-200">Standard Shipping</span>
                            </div>
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                              <input type="checkbox" className="w-4 h-4" />
                              <span className="text-slate-200">Express Shipping</span>
                            </div>
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                              <input type="checkbox" className="w-4 h-4" />
                              <span className="text-slate-200">Free Shipping (Minimum Order)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeSettingsTab === 'account' && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                          <input
                            type="text"
                            defaultValue={userData?.displayName || user?.displayName || ''}
                            className="w-full px-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                          <input
                            type="email"
                            defaultValue={user?.email || ''}
                            disabled
                            className="w-full px-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-slate-400 placeholder-slate-400"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number</label>
                          <input
                            type="tel"
                            placeholder="+254 700 000 000"
                            className="w-full px-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          />
                        </div>
                      </div>
                    )}

                    {activeSettingsTab === 'team' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between mb-6">
                          <p className="text-slate-300">Manage your team members and their access</p>
                          <Button className="bg-sky-500 hover:bg-sky-600 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Invite Member
                          </Button>
                        </div>
                        <div className="text-center py-12 text-slate-400">
                          No team members yet. Invite someone to collaborate!
                        </div>
                      </div>
                    )}

                    {/* Save Button */}
                    <div className="mt-8 flex justify-end gap-3">
                      <Button variant="outline" className="border-white/20 text-slate-200 hover:bg-white/10">
                        Cancel
                      </Button>
                      <Button className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white">
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="px-6 py-4">
                <div className="mx-auto max-w-7xl">
                  {/* Header */}
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h1 className="mb-2 text-3xl font-bold text-slate-100">Orders</h1>
                      <p className="text-slate-400">Manage and fulfill your orders</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" className="border-white/20 text-slate-200 hover:bg-white/10">
                        Export
                      </Button>
                      <Button className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white">
                        Create order
                      </Button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="mb-6 flex items-center gap-2 border-b border-white/10">
                    {['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((tab) => (
                      <button
                        key={tab}
                        className="px-4 py-3 text-sm font-medium text-slate-300 hover:text-white border-b-2 border-transparent hover:border-sky-500 transition-all"
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Empty State */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-12 text-center">
                    <div className="mb-6 flex justify-center">
                      <div className="w-48 h-48 rounded-full bg-gradient-to-br from-slate-800/50 to-slate-900/50 flex items-center justify-center">
                        <ShoppingCart className="w-20 h-20 text-slate-400" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-100 mb-2">No orders yet</h2>
                    <p className="text-slate-400 mb-6">You haven't received any orders yet.</p>
                    <Button className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white">
                      View Products
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <div className="px-6 py-4">
                <div className="mx-auto max-w-7xl">
                  <div className="mb-6">
                    <h1 className="mb-2 text-3xl font-bold text-slate-100">Messages</h1>
                    <p className="text-slate-400">Communicate with your retailers</p>
                  </div>

                  <div className="grid grid-cols-3 gap-6 h-[calc(100vh-200px)]">
                    {/* Conversations List */}
                    <div className="col-span-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-white/10">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search conversations..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg backdrop-blur-md bg-white/5 border border-white/10 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          />
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto">
                        {/* Empty State */}
                        <div className="p-8 text-center">
                          <MessageSquare className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                          <p className="text-slate-400 text-sm">No messages yet</p>
                        </div>
                      </div>
                    </div>

                    {/* Message View */}
                    <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-center">
                      <div className="text-center">
                        <MessageSquare className="w-20 h-20 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-300 text-lg">Select a conversation</p>
                        <p className="text-slate-400 text-sm">Choose a conversation to start messaging</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Customers Tab */}
            {activeTab === 'customers' && (
              <div className="px-6 py-4">
                <div className="mx-auto max-w-7xl">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h1 className="mb-2 text-3xl font-bold text-slate-100">Customers</h1>
                      <p className="text-slate-400">Manage your retail customer base</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" className="border-white/20 text-slate-200 hover:bg-white/10">
                        Export
                      </Button>
                      <Button className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Add customer
                      </Button>
                    </div>
                  </div>

                  {/* Search and Filter */}
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search customers..."
                        className="w-full pl-12 pr-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                    <Button variant="outline" className="border-white/20 text-slate-200 hover:bg-white/10">
                      <Filter className="w-4 h-4 mr-2" />
                      Filters
                    </Button>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Total Customers', value: '0', icon: Users },
                      { label: 'Active This Month', value: '0', icon: TrendingUp },
                      { label: 'Average Order Value', value: 'KES 0', icon: BarChart3 },
                      { label: 'Repeat Customers', value: '0%', icon: Users }
                    ].map((stat, index) => {
                      const Icon = stat.icon;
                      return (
                        <div key={index} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-sky-500/20">
                              <Icon className="w-4 h-4 text-sky-300" />
                            </div>
                            <span className="text-xs text-slate-400">{stat.label}</span>
                          </div>
                          <p className="text-2xl font-bold text-white">{stat.value}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Empty State */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-12 text-center">
                    <Users className="w-20 h-20 text-slate-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-100 mb-2">No customers yet</h2>
                    <p className="text-slate-400 mb-6">Start getting orders to build your customer base</p>
                  </div>
                </div>
              </div>
            )}

            {/* Marketing Tab */}
            {activeTab === 'marketing' && (
              <div className="px-6 py-4">
                <div className="mx-auto max-w-7xl">
                  <div className="mb-6">
                    <h1 className="mb-2 text-3xl font-bold text-slate-100">Marketing</h1>
                    <p className="text-slate-400">Promote your products and grow your business</p>
                  </div>

                  {/* Marketing Cards */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Promotions */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-100 mb-2">Promotions</h3>
                          <p className="text-sm text-slate-400">Create special offers and discounts</p>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-500/20">
                          <TrendingUp className="w-6 h-6 text-purple-300" />
                        </div>
                      </div>
                      <div className="mb-4">
                        <p className="text-3xl font-bold text-white">0</p>
                        <p className="text-sm text-slate-400">Active promotions</p>
                      </div>
                      <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Promotion
                      </Button>
                    </div>

                    {/* Email Campaigns */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-100 mb-2">Email Campaigns</h3>
                          <p className="text-sm text-slate-400">Send targeted emails to retailers</p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-500/20">
                          <Mail className="w-6 h-6 text-blue-300" />
                        </div>
                      </div>
                      <div className="mb-4">
                        <p className="text-3xl font-bold text-white">0</p>
                        <p className="text-sm text-slate-400">Campaigns sent</p>
                      </div>
                      <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Campaign
                      </Button>
                    </div>
                  </div>

                  {/* Marketing Tools */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">Marketing Tools</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { title: 'New Product Launch', desc: 'Announce new products to retailers', icon: Sparkles },
                        { title: 'Seasonal Offers', desc: 'Create limited-time seasonal deals', icon: TrendingUp },
                        { title: 'Loyalty Program', desc: 'Reward repeat customers', icon: Users },
                        { title: 'Bundle Deals', desc: 'Create product bundles', icon: Package },
                        { title: 'Free Shipping', desc: 'Offer free shipping promotions', icon: ShoppingBag },
                        { title: 'Referral Program', desc: 'Get retailers to refer others', icon: Users }
                      ].map((tool, index) => {
                        const Icon = tool.icon;
                        return (
                          <button
                            key={index}
                            className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-left group"
                          >
                            <Icon className="w-8 h-8 text-slate-400 group-hover:text-sky-300 transition-colors mb-3" />
                            <h4 className="text-sm font-medium text-slate-100 mb-1">{tool.title}</h4>
                            <p className="text-xs text-slate-400">{tool.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="px-6 py-4">
                <div className="mx-auto max-w-7xl">
                  <div className="mb-6">
                    <h1 className="mb-2 text-3xl font-bold text-slate-100">Analytics</h1>
                    <p className="text-slate-400">Track your performance and insights</p>
                  </div>

                  {/* Date Range Selector */}
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days'].map((range) => (
                        <button
                          key={range}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 transition-all"
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                    <Button variant="outline" className="border-white/20 text-slate-200 hover:bg-white/10">
                      Export Report
                    </Button>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Total Sales', value: 'KES 0', change: '+0%', icon: TrendingUp },
                      { label: 'Orders', value: '0', change: '+0%', icon: ShoppingCart },
                      { label: 'Average Order', value: 'KES 0', change: '+0%', icon: BarChart3 },
                      { label: 'Products Sold', value: '0', change: '+0%', icon: Package }
                    ].map((metric, index) => {
                      const Icon = metric.icon;
                      return (
                        <div key={index} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-slate-400">{metric.label}</span>
                            <Icon className="w-5 h-5 text-slate-400" />
                          </div>
                          <p className="text-3xl font-bold text-white mb-1">{metric.value}</p>
                          <span className="text-sm text-green-400">{metric.change}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Sales Chart */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                      <h3 className="text-lg font-semibold text-slate-100 mb-4">Sales Overview</h3>
                      <div className="h-64 flex items-center justify-center border border-dashed border-white/10 rounded-xl">
                        <div className="text-center">
                          <BarChart3 className="w-16 h-16 text-slate-400 mx-auto mb-2" />
                          <p className="text-slate-400 text-sm">No sales data yet</p>
                        </div>
                      </div>
                    </div>

                    {/* Top Products */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                      <h3 className="text-lg font-semibold text-slate-100 mb-4">Top Products</h3>
                      <div className="h-64 flex items-center justify-center border border-dashed border-white/10 rounded-xl">
                        <div className="text-center">
                          <Package className="w-16 h-16 text-slate-400 mx-auto mb-2" />
                          <p className="text-slate-400 text-sm">No product data yet</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Insights */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                      <h4 className="text-sm font-medium text-slate-400 mb-3">Customer Growth</h4>
                      <p className="text-2xl font-bold text-white mb-1">0</p>
                      <p className="text-xs text-slate-400">New customers this month</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                      <h4 className="text-sm font-medium text-slate-400 mb-3">Conversion Rate</h4>
                      <p className="text-2xl font-bold text-white mb-1">0%</p>
                      <p className="text-xs text-slate-400">Views to orders</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                      <h4 className="text-sm font-medium text-slate-400 mb-3">Return Rate</h4>
                      <p className="text-2xl font-bold text-white mb-1">0%</p>
                      <p className="text-xs text-slate-400">Orders returned</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* My Shop Tab */}
            {activeTab === 'myshop' && (
              <div className="px-6 py-4">
                <div className="mx-auto max-w-7xl">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h1 className="mb-2 text-3xl font-bold text-slate-100">My Shop</h1>
                      <p className="text-slate-400">Manage how your shop appears to retailers</p>
                    </div>
                    <Button className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white">
                      Preview Shop
                    </Button>
                  </div>

                  {/* Shop Status */}
                  <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center">
                          <Store className="w-8 h-8 text-slate-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-slate-100 mb-1">
                            {userData?.organizationDisplayName || userData?.organizationName || 'Your Shop'}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 rounded-full bg-amber-400"></span>
                            <span className="text-sm text-amber-400">Inactive - Complete setup to go live</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" className="border-white/20 text-slate-200 hover:bg-white/10">
                        Edit Details
                      </Button>
                    </div>
                  </div>

                  {/* Shop Sections */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Brand Story */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-100">Brand Story</h3>
                        <Button variant="ghost" className="text-sky-400 hover:text-sky-300">
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                      <div className="border border-dashed border-white/10 rounded-xl p-8 text-center">
                        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm mb-2">Tell retailers your story</p>
                        <p className="text-xs text-slate-500">Share what makes your brand unique</p>
                      </div>
                    </div>

                    {/* Shop Images */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-100">Shop Images</h3>
                        <Button variant="ghost" className="text-sky-400 hover:text-sky-300">
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                      <div className="border border-dashed border-white/10 rounded-xl p-8 text-center">
                        <Camera className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm mb-2">Add shop photos</p>
                        <p className="text-xs text-slate-500">Show your products and workspace</p>
                      </div>
                    </div>
                  </div>

                  {/* Shop Policies */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">Shop Policies</h3>
                    <div className="space-y-4">
                      {[
                        { title: 'Minimum Order Quantity', value: 'Not set', icon: Package },
                        { title: 'Payment Terms', value: 'Not set', icon: BarChart3 },
                        { title: 'Shipping Policy', value: 'Not set', icon: ShoppingBag },
                        { title: 'Return Policy', value: 'Not set', icon: ClipboardCheck }
                      ].map((policy, index) => {
                        const Icon = policy.icon;
                        return (
                          <div key={index} className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-3">
                              <Icon className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="text-sm font-medium text-slate-100">{policy.title}</p>
                                <p className="text-xs text-slate-400">{policy.value}</p>
                              </div>
                            </div>
                            <Button variant="ghost" className="text-sky-400 hover:text-sky-300 text-sm">
                              Configure
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other Tabs - Placeholder */}
            {activeTab !== 'home' && activeTab !== 'products' && activeTab !== 'settings' && 
             activeTab !== 'orders' && activeTab !== 'messages' && activeTab !== 'customers' && 
             activeTab !== 'marketing' && activeTab !== 'analytics' && activeTab !== 'myshop' && (
              <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center px-6 py-4">
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

        {/* Account Menu Modal */}
        {showAccountMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-black/20"
            onClick={() => setShowAccountMenu(false)}
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute left-72 top-20 w-96 rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Account</h3>
                <button
                  onClick={() => setShowAccountMenu(false)}
                  className="rounded-lg p-1 hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              {/* User Info */}
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
                  <User className="h-6 w-6 text-slate-300" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">
                    {userData?.displayName || user?.displayName || 'Timothy Lidede'}
                  </div>
                  <div className="text-sm text-slate-400">
                    {userData?.organizationDisplayName || userData?.organizationName || 'Mahitaji'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button 
                  onClick={() => {
                    setShowAccountMenu(false);
                    // Navigate to profile settings
                    setActiveTab('settings');
                    setActiveSettingsTab('account');
                    setShowSettingsDropdown(true);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5"
                >
                  Manage profile
                </button>
                <button 
                  onClick={handleSignOut}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                >
                  Sign out
                </button>
              </div>

              {/* Shop Section */}
              <div className="mt-6 border-t border-white/10 pt-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
                    <Store className="h-5 w-5 text-slate-300" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-100">
                      {userData?.organizationDisplayName || userData?.organizationName || 'Mahitaji'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <span className="flex h-2 w-2 rounded-full bg-amber-400"></span>
                      Inactive
                    </div>
                  </div>
                </div>
                
                <button className="flex w-full items-center gap-2 rounded-lg border border-dashed border-white/20 px-3 py-2 text-sm text-slate-400 hover:bg-white/5">
                  <Plus className="h-4 w-4" />
                  Add another brand
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </>
  );
}
