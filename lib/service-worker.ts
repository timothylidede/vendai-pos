/**
 * Service Worker registration and image caching utilities
 */

export interface CacheStats {
  totalImages: number;
  cacheSize: number;
  oldestImage: string | null;
  newestImage: string | null;
}

/**
 * Register the service worker for offline image caching
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported in this environment');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('✅ Service Worker registered successfully');
    
    // Listen for updates
    registration.addEventListener('updatefound', () => {
      console.log('🔄 Service Worker update found');
      const newWorker = registration.installing;
      
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('✨ New Service Worker installed, refresh to activate');
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('❌ Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const success = await registration.unregister();
      console.log('Service Worker unregistered:', success);
      return success;
    }
    return false;
  } catch (error) {
    console.error('Failed to unregister Service Worker:', error);
    return false;
  }
}

/**
 * Prefetch product images for offline use
 */
export async function prefetchImages(imageUrls: string[]): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service Worker not available, cannot prefetch images');
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  
  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();
    
    messageChannel.port1.onmessage = (event) => {
      if (event.data.success) {
        console.log(`✅ Prefetched ${imageUrls.length} images`);
        resolve();
      } else {
        reject(new Error('Failed to prefetch images'));
      }
    };
    
    registration.active?.postMessage(
      {
        type: 'PREFETCH_IMAGES',
        urls: imageUrls
      },
      [messageChannel.port2]
    );
  });
}

/**
 * Clear the image cache
 */
export async function clearImageCache(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service Worker not available, cannot clear cache');
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  
  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();
    
    messageChannel.port1.onmessage = (event) => {
      if (event.data.success) {
        console.log('✅ Image cache cleared');
        resolve();
      } else {
        reject(new Error('Failed to clear cache'));
      }
    };
    
    registration.active?.postMessage(
      {
        type: 'CLEAR_IMAGE_CACHE'
      },
      [messageChannel.port2]
    );
  });
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return {
      totalImages: 0,
      cacheSize: 0,
      oldestImage: null,
      newestImage: null
    };
  }

  try {
    const cache = await caches.open('vendai-product-images-v1');
    const keys = await cache.keys();
    
    let totalSize = 0;
    const timestamps: { url: string; time: number }[] = [];
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
        
        // Try to get timestamp from response headers
        const lastModified = response.headers.get('last-modified');
        if (lastModified) {
          timestamps.push({
            url: request.url,
            time: new Date(lastModified).getTime()
          });
        }
      }
    }
    
    timestamps.sort((a, b) => a.time - b.time);
    
    return {
      totalImages: keys.length,
      cacheSize: totalSize,
      oldestImage: timestamps[0]?.url || null,
      newestImage: timestamps[timestamps.length - 1]?.url || null
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return {
      totalImages: 0,
      cacheSize: 0,
      oldestImage: null,
      newestImage: null
    };
  }
}

/**
 * Check if an image is cached
 */
export async function isImageCached(imageUrl: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return false;
  }

  try {
    const cache = await caches.open('vendai-product-images-v1');
    const response = await cache.match(imageUrl);
    return !!response;
  } catch (error) {
    console.error('Failed to check cache:', error);
    return false;
  }
}

/**
 * Format cache size for display
 */
export function formatCacheSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
