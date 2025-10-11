/**
 * React hook for service worker and image caching
 */

import { useEffect, useState } from 'react';
import {
  registerServiceWorker,
  prefetchImages,
  clearImageCache,
  getCacheStats,
  isImageCached,
  formatCacheSize,
  type CacheStats
} from '@/lib/service-worker';

export function useServiceWorker() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator;
    setIsSupported(supported);

    if (supported) {
      registerServiceWorker().then((reg) => {
        if (reg) {
          setRegistration(reg);
          setIsRegistered(true);
        }
      });
    }
  }, []);

  return {
    isRegistered,
    isSupported,
    registration
  };
}

export function useImageCache() {
  const [stats, setStats] = useState<CacheStats>({
    totalImages: 0,
    cacheSize: 0,
    oldestImage: null,
    newestImage: null
  });
  const [isLoading, setIsLoading] = useState(false);

  const refreshStats = async () => {
    setIsLoading(true);
    try {
      const newStats = await getCacheStats();
      setStats(newStats);
    } catch (error) {
      console.error('Failed to refresh cache stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const prefetch = async (urls: string[]) => {
    setIsLoading(true);
    try {
      await prefetchImages(urls);
      await refreshStats();
    } catch (error) {
      console.error('Failed to prefetch images:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clear = async () => {
    setIsLoading(true);
    try {
      await clearImageCache();
      await refreshStats();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const checkCached = async (url: string) => {
    return await isImageCached(url);
  };

  useEffect(() => {
    refreshStats();
  }, []);

  return {
    stats,
    formattedSize: formatCacheSize(stats.cacheSize),
    isLoading,
    refreshStats,
    prefetch,
    clear,
    checkCached
  };
}
