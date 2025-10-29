'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Search, Filter, ChevronDown, Plus, Upload } from 'lucide-react';

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

interface TabCounts {
  all: number;
  published: number;
  unpublished: number;
  drafts: number;
}

export default function ProductsPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'published' | 'unpublished' | 'drafts'>('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [tabCounts, setTabCounts] = useState<TabCounts>({
    all: 0,
    published: 0,
    unpublished: 0,
    drafts: 0
  });

  useEffect(() => {
    if (userData?.role !== 'distributor') {
      router.push('/modules');
      return;
    }
    loadProducts();
  }, [userData, activeTab, sortBy]);

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
      if (activeTab !== 'all') {
        const statusMap = {
          published: 'published',
          unpublished: 'unpublished',
          drafts: 'draft'
        };
        q = query(q, where('status', '==', statusMap[activeTab]));
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

      // Calculate counts for all tabs
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

  const handleAddProduct = () => {
    router.push('/distributor-dashboard/products/add');
  };

  const handleBulkUpload = () => {
    // TODO: Implement bulk upload
    alert('Bulk upload coming soon!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-b from-slate-900/50 to-transparent backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Products</h1>
              <p className="text-slate-400">Manage your product catalog</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleBulkUpload}
                className="px-4 py-2.5 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all duration-200 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Bulk upload
              </button>
              <button
                onClick={handleAddProduct}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                Add product
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 mb-6">
            {[
              { key: 'all', label: 'All', count: tabCounts.all },
              { key: 'published', label: 'Published', count: tabCounts.published },
              { key: 'unpublished', label: 'Unpublished', count: tabCounts.unpublished },
              { key: 'drafts', label: 'Drafts', count: tabCounts.drafts }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`relative px-1 py-2 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-white/5 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500" />
                )}
              </button>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-3">
            {/* Search */}
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

            {/* Filter Button */}
            <button className="p-3 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all duration-200">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center mb-6">
              <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No products yet</h2>
            <p className="text-slate-400 text-center mb-8 max-w-md">
              {activeTab === 'all' 
                ? "Get started by adding your first product to your catalog"
                : `No ${activeTab} products found`}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAddProduct}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-5 h-5" />
                Add your first product
              </button>
              <button
                onClick={handleBulkUpload}
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
                <div className="aspect-square bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-20 h-20 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
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
    </div>
  );
}
