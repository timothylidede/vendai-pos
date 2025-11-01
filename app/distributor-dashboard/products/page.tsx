'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { POS_PRODUCTS_COL } from '@/lib/pos-operations';
import { AIProcessingModal } from '@/components/ai-processing-modal';
import type { ProcessedProduct } from '@/data/products-data';
import { Upload, Plus, Search, ChevronDown, FileText, History } from 'lucide-react';

type ProcessingStep = {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
};

type ProcessingStats = {
  totalProducts: number;
  productsAdded: number;
  productsUpdated: number;
  duplicatesFound: number;
  estimatedTimeRemaining: number;
  suppliersAnalyzed: number;
  locationMatches: number;
};

type PricelistStats = {
  totalProducts?: number;
  productsAdded?: number;
  productsUpdated?: number;
  duplicatesFound?: number;
};

type PricelistInfo = {
  fileName: string;
  downloadUrl: string;
  uploadedAt?: string;
  uploadedBy?: string | null;
  size?: number;
  contentType?: string;
  stats?: PricelistStats;
};

type ProductRecord = {
  id: string;
  name?: string;
  brand?: string;
  category?: string;
  supplier?: string;
  pieceBarcode?: string;
  cartonBarcode?: string;
  retailUom?: string;
  baseUom?: string;
  unitsPerBase?: number;
  piecePrice?: number | string;
  wholesalePrice?: number | string;
  updatedAt?: string;
  createdAt?: string;
  image?: string;
};

type ProcessEnhancedResponse = {
  success?: boolean;
  preview?: ProcessedProduct[];
  stats?: {
    totalProducts?: number;
    total?: number;
    productsAdded?: number;
    productsUpdated?: number;
    duplicatesFound?: number;
    suppliersAnalyzed?: number;
    locationMatches?: number;
  };
  error?: string;
  pricelist?: PricelistInfo;
};

const DEFAULT_STATS: ProcessingStats = {
  totalProducts: 0,
  productsAdded: 0,
  productsUpdated: 0,
  duplicatesFound: 0,
  estimatedTimeRemaining: 0,
  suppliersAnalyzed: 0,
  locationMatches: 0
};

const initializeProcessingSteps = (): ProcessingStep[] => [
  { id: 'file_validation', title: 'Validate file', description: 'Checking format and size', status: 'pending' },
  { id: 'ai_extraction', title: 'Extract products', description: 'Parsing product data', status: 'pending' },
  { id: 'importing', title: 'Sync with catalog', description: 'Upserting products', status: 'pending' },
  { id: 'finalization', title: 'Finish up', description: 'Wrapping up', status: 'pending' }
];

const formatCurrency = (value?: number | string | null): string => {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isFinite(num)) return '—';
  return `KES ${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const formatUpdated = (iso?: string): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

const formatSize = (bytes?: number): string => {
  if (!bytes || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

const getStatsLabel = (value?: number): string => (Number.isFinite(value) && value ? value.toLocaleString() : '0');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function ProductsPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const organizationId = (userData as any)?.organizationId as string | undefined;
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated-desc' | 'updated-asc' | 'name-asc' | 'name-desc'>('updated-desc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [processingModalOpen, setProcessingModalOpen] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string>();
  const [processingError, setProcessingError] = useState('');
  const [processingStats, setProcessingStats] = useState<ProcessingStats>(DEFAULT_STATS);
  const [previewProducts, setPreviewProducts] = useState<ProcessedProduct[]>([]);
  const [lastPricelist, setLastPricelist] = useState<PricelistInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userData) return;
    if (userData.role && userData.role !== 'distributor') {
      router.push('/modules');
    }
  }, [userData, router]);

  useEffect(() => {
    if (!organizationId || !db) {
      setProducts([]);
      setLoadingProducts(false);
      return;
    }

    setLoadingProducts(true);
    const colRef = collection(db, POS_PRODUCTS_COL);
    const orgQuery = query(colRef, where('orgId', '==', organizationId));
    const unsubscribe = onSnapshot(
      orgQuery,
      (snapshot) => {
        const items: ProductRecord[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: typeof data.name === 'string' ? data.name : undefined,
            brand: typeof data.brand === 'string' ? data.brand : undefined,
            category: typeof data.category === 'string' ? data.category : undefined,
            supplier: typeof data.supplier === 'string' ? data.supplier : undefined,
            pieceBarcode: typeof data.pieceBarcode === 'string' ? data.pieceBarcode : undefined,
            cartonBarcode: typeof data.cartonBarcode === 'string' ? data.cartonBarcode : undefined,
            retailUom: typeof data.retailUom === 'string' ? data.retailUom : undefined,
            baseUom: typeof data.baseUom === 'string' ? data.baseUom : undefined,
            unitsPerBase: typeof data.unitsPerBase === 'number' ? data.unitsPerBase : undefined,
            piecePrice: typeof data.piecePrice === 'number' || typeof data.piecePrice === 'string' ? (data.piecePrice as number | string) : undefined,
            wholesalePrice: typeof data.wholesalePrice === 'number' || typeof data.wholesalePrice === 'string' ? (data.wholesalePrice as number | string) : undefined,
            updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
            createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
            image: typeof data.image === 'string' ? data.image : undefined
          };
        });
        setProducts(items);
        setLoadingProducts(false);
      },
      (error) => {
        console.error('Products listener error:', error);
        setLoadingProducts(false);
      }
    );

    return () => unsubscribe();
  }, [organizationId]);

  const loadPricelistMeta = useCallback(async () => {
    if (!organizationId || !db) {
      setLastPricelist(null);
      return;
    }
    try {
      const docRef = doc(db, 'org_pricelists', organizationId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        setLastPricelist(null);
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      const stats = (typeof data.stats === 'object' && data.stats !== null) ? data.stats as PricelistStats : undefined;
      setLastPricelist({
        fileName: typeof data.fileName === 'string' ? data.fileName : 'pricelist',
        downloadUrl: typeof data.downloadUrl === 'string' ? data.downloadUrl : '',
        uploadedAt: typeof data.uploadedAt === 'string' ? data.uploadedAt : undefined,
        uploadedBy: typeof data.uploadedBy === 'string' ? data.uploadedBy : null,
        size: typeof data.size === 'number' ? data.size : undefined,
        contentType: typeof data.contentType === 'string' ? data.contentType : undefined,
        stats
      });
    } catch (error) {
      console.error('Failed to load pricelist metadata:', error);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadPricelistMeta();
  }, [loadPricelistMeta]);

  const updateStepStatus = useCallback((stepId: string, status: ProcessingStep['status'], progress?: number) => {
    setProcessingSteps(prev =>
      prev.map(step => step.id === stepId ? { ...step, status, progress } : step)
    );
    setCurrentStep(stepId);
  }, []);

  const handleRetry = useCallback(() => {
    setProcessingModalOpen(false);
    setProcessingError('');
    setTimeout(() => fileInputRef.current?.click(), 250);
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!organizationId) {
      alert('Select an organization before uploading a pricelist.');
      event.target.value = '';
      return;
    }

    setProcessingSteps(initializeProcessingSteps());
    setProcessingStats(DEFAULT_STATS);
    setPreviewProducts([]);
    setProcessingError('');
    setProcessingModalOpen(true);

    try {
      updateStepStatus('file_validation', 'processing');
      await sleep(350);
      updateStepStatus('file_validation', 'completed');

      updateStepStatus('ai_extraction', 'processing');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('orgId', organizationId);
      if (userData?.uid) {
        formData.append('uploadedBy', userData.uid);
      } else if (userData?.email) {
        formData.append('uploadedBy', userData.email);
      }

      const response = await fetch('/api/inventory/process-enhanced', {
        method: 'POST',
        body: formData
      });

      let result: ProcessEnhancedResponse = {};
      try {
        result = await response.json() as ProcessEnhancedResponse;
      } catch (parseError) {
        console.error('Failed to parse processing response:', parseError);
      }

      if (!response.ok || !result?.success) {
        const message = result?.error || `Processing failed (${response.status})`;
        setProcessingError(message);
        updateStepStatus('ai_extraction', 'error');
        return;
      }

      updateStepStatus('ai_extraction', 'completed');

      const statsSource = result.stats || {};
      setProcessingStats({
        totalProducts: Number(statsSource.totalProducts ?? statsSource.total ?? 0) || 0,
        productsAdded: Number(statsSource.productsAdded ?? 0) || 0,
        productsUpdated: Number(statsSource.productsUpdated ?? 0) || 0,
        duplicatesFound: Number(statsSource.duplicatesFound ?? 0) || 0,
        estimatedTimeRemaining: 0,
        suppliersAnalyzed: Number(statsSource.suppliersAnalyzed ?? 0) || 0,
        locationMatches: Number(statsSource.locationMatches ?? 0) || 0
      });

      if (Array.isArray(result.preview)) {
        setPreviewProducts(result.preview);
      }

      if (result.pricelist) {
        setLastPricelist(result.pricelist);
      } else {
        void loadPricelistMeta();
      }

      updateStepStatus('importing', 'processing');
      await sleep(400);
      updateStepStatus('importing', 'completed');

      updateStepStatus('finalization', 'processing');
      await sleep(250);
      updateStepStatus('finalization', 'completed');

      setTimeout(() => {
        setProcessingModalOpen(false);
        setProcessingSteps([]);
        setCurrentStep(undefined);
      }, 1200);
    } catch (error) {
      console.error('Pricelist processing error:', error);
      setProcessingError(error instanceof Error ? error.message : 'Upload failed');
      updateStepStatus(currentStep || 'ai_extraction', 'error');
    } finally {
      event.target.value = '';
    }
  }, [organizationId, userData, updateStepStatus, currentStep, loadPricelistMeta]);

  const filteredProducts = useMemo(() => {
    const phrase = searchQuery.trim().toLowerCase();
    const subset = phrase
      ? products.filter(product => {
          const haystack = [
            product.name,
            product.brand,
            product.category,
            product.supplier,
            product.pieceBarcode,
            product.cartonBarcode
          ]
            .filter(Boolean)
            .map(value => String(value).toLowerCase());
          return haystack.some(value => value.includes(phrase));
        })
      : products;

    const sorted = [...subset];
    sorted.sort((a, b) => {
      if (sortBy === 'name-asc' || sortBy === 'name-desc') {
        const left = (a.name || '').toLowerCase();
        const right = (b.name || '').toLowerCase();
        if (left === right) return 0;
        const comparison = left < right ? -1 : 1;
        return sortBy === 'name-asc' ? comparison : -comparison;
      }
      const leftDate = a.updatedAt || a.createdAt || '';
      const rightDate = b.updatedAt || b.createdAt || '';
      const leftTime = new Date(leftDate).getTime();
      const rightTime = new Date(rightDate).getTime();
      const safeLeft = Number.isFinite(leftTime) ? leftTime : -Infinity;
      const safeRight = Number.isFinite(rightTime) ? rightTime : -Infinity;
      return sortBy === 'updated-desc' ? safeRight - safeLeft : safeLeft - safeRight;
    });
    return sorted;
  }, [products, searchQuery, sortBy]);

  const totalProducts = products.length;
  const recentStats = processingStats || DEFAULT_STATS;
  const effectiveStats = lastPricelist?.stats
    ? {
        ...recentStats,
        totalProducts: Number(lastPricelist.stats.totalProducts ?? recentStats.totalProducts ?? 0),
        productsAdded: Number(lastPricelist.stats.productsAdded ?? recentStats.productsAdded ?? 0),
        productsUpdated: Number(lastPricelist.stats.productsUpdated ?? recentStats.productsUpdated ?? 0),
        duplicatesFound: Number(lastPricelist.stats.duplicatesFound ?? recentStats.duplicatesFound ?? 0)
      }
    : recentStats;

  const lastUploadTimestamp = lastPricelist?.uploadedAt ? formatUpdated(lastPricelist.uploadedAt) : null;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleAddProduct = () => {
    router.push('/distributor-dashboard/products/add');
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.pdf,.txt"
          className="hidden"
          onChange={handleFileUpload}
        />

        <div className="border-b border-white/10 bg-gradient-to-b from-slate-900/50 to-transparent backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Products</h1>
                <p className="text-slate-400">
                  Upload your distributor price list and let the AI pipeline keep this catalog synced.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleUploadClick}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Upload className="w-4 h-4" />
                  Upload pricelist
                </button>
                <button
                  onClick={handleAddProduct}
                  className="px-4 py-2.5 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New product
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Total products</span>
                  <FileText className="w-4 h-4 text-blue-300" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-white">{totalProducts.toLocaleString()}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Includes every product synced into `pos_products` for this organization.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Latest import</span>
                  <History className="w-4 h-4 text-purple-300" />
                </div>
                <p className="mt-3 text-xl font-semibold text-white">
                  {getStatsLabel(effectiveStats.productsAdded)} added · {getStatsLabel(effectiveStats.productsUpdated)} updated
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {lastUploadTimestamp ? `Uploaded ${lastUploadTimestamp}` : 'No pricelist uploaded yet.'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Duplicates flagged</span>
                  <FileText className="w-4 h-4 text-rose-300" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {getStatsLabel(effectiveStats.duplicatesFound)}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  AI deduplication prevents double entries when your pricelist repeats SKUs.
                </p>
              </div>
            </div>

            {lastPricelist && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Last upload</p>
                    <p className="text-slate-300 text-sm mt-1">{lastPricelist.fileName}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {lastUploadTimestamp || 'Pending'} · {formatSize(lastPricelist.size)}
                      {lastPricelist.uploadedBy ? ` · by ${lastPricelist.uploadedBy}` : ''}
                    </p>
                  </div>
                  {lastPricelist.downloadUrl && (
                    <a
                      href={lastPricelist.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white transition-all duration-200"
                    >
                      <FileText className="w-4 h-4" />
                      Download source
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, brand, category, or barcode..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowSortDropdown((prev) => !prev)}
                className="px-4 py-3 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all duration-200 flex items-center gap-2 min-w-[160px] justify-between"
              >
                <span className="text-sm">
                  {sortBy === 'updated-desc' && 'Newest first'}
                  {sortBy === 'updated-asc' && 'Oldest first'}
                  {sortBy === 'name-asc' && 'A → Z'}
                  {sortBy === 'name-desc' && 'Z → A'}
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
                    {[
                      { key: 'updated-desc', label: 'Newest first' },
                      { key: 'updated-asc', label: 'Oldest first' },
                      { key: 'name-asc', label: 'A → Z' },
                      { key: 'name-desc', label: 'Z → A' }
                    ].map(option => (
                      <button
                        key={option.key}
                        onClick={() => {
                          setSortBy(option.key as typeof sortBy);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left text-sm transition-all duration-200 ${
                          sortBy === option.key
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {previewProducts.length > 0 && (
            <div className="mb-8 rounded-2xl border border-blue-500/20 bg-blue-500/10 backdrop-blur-xl p-6">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div>
                  <p className="text-sm font-semibold text-blue-100">Preview ({previewProducts.length})</p>
                  <p className="text-xs text-blue-200/80">
                    First items returned by the AI parser. The full list is already syncing into Firestore.
                  </p>
                </div>
                <button
                  onClick={() => setPreviewProducts([])}
                  className="px-3 py-1.5 text-xs rounded-lg border border-blue-400/40 text-blue-100 hover:bg-blue-400/20 transition-all duration-200"
                >
                  Dismiss
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {previewProducts.slice(0, 9).map((item, index) => (
                  <div
                    key={`${item.pieceBarcode || item.name}-${index}`}
                    className="rounded-xl border border-white/10 bg-white/10 backdrop-blur-xl p-4"
                  >
                    <p className="text-sm font-semibold text-white line-clamp-1">{item.name}</p>
                    <p className="text-xs text-blue-100/90 mt-1 line-clamp-1">
                      {item.brand || '—'} · {item.category || 'Uncategorized'}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-blue-100/80">
                      <div>
                        <p className="uppercase tracking-wide text-[10px] text-blue-200/70">Unit price</p>
                        <p className="mt-1 text-sm text-white">{formatCurrency(item.unitPrice)}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wide text-[10px] text-blue-200/70">Carton price</p>
                        <p className="mt-1 text-sm text-white">{formatCurrency(item.cartonPrice)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-blue-100/70 line-clamp-2">
                      {item.pieceBarcode ? `Piece barcode ${item.pieceBarcode}` : 'No barcode detected'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingProducts ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center mb-6">
                <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {searchQuery ? 'No matching products' : 'Upload your first pricelist'}
              </h2>
              <p className="text-slate-400 text-center mb-8 max-w-md">
                {searchQuery
                  ? 'Try a different search term or upload a fresh pricelist.'
                  : 'Upload a CSV or PDF pricelist to populate your catalog automatically.'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleUploadClick}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Upload className="w-5 h-5" />
                  Upload pricelist
                </button>
                <button
                  onClick={handleAddProduct}
                  className="px-6 py-3 rounded-xl backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add manually
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="group rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 overflow-hidden"
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white line-clamp-2">
                          {product.name || 'Unnamed product'}
                        </h3>
                        {(product.brand || product.supplier) && (
                          <p className="text-sm text-slate-400 mt-1 line-clamp-1">
                            {[product.brand, product.supplier].filter(Boolean).join(' · ') || '—'}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {product.updatedAt ? formatUpdated(product.updatedAt) : 'New'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                        {product.category || 'Uncategorized'}
                      </span>
                      {product.retailUom && (
                        <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                          Unit: {product.retailUom}
                        </span>
                      )}
                      {product.baseUom && (
                        <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                          Case: {product.baseUom}
                        </span>
                      )}
                      {Number.isFinite(product.unitsPerBase) && product.unitsPerBase ? (
                        <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                          {product.unitsPerBase} per case
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-200">
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Unit price</p>
                        <p className="mt-2 text-base font-semibold text-white">
                          {formatCurrency(product.piecePrice)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Wholesale</p>
                        <p className="mt-2 text-base font-semibold text-white">
                          {formatCurrency(product.wholesalePrice)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-slate-400 border-t border-white/5 pt-3">
                      {product.pieceBarcode && (
                        <span className="rounded-lg bg-white/5 px-2 py-1">
                          Piece barcode: {product.pieceBarcode}
                        </span>
                      )}
                      {product.cartonBarcode && (
                        <span className="rounded-lg bg-white/5 px-2 py-1">
                          Carton: {product.cartonBarcode}
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

      <AIProcessingModal
        isOpen={processingModalOpen}
        onClose={() => setProcessingModalOpen(false)}
        steps={processingSteps}
        currentStep={currentStep}
        error={processingError}
        onRetry={processingError ? handleRetry : undefined}
        stats={processingStats}
      />
    </>
  );
}
