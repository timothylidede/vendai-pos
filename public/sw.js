/**
 * Service Worker for VendAI POS
 * Handles offline caching of Firebase Storage images
 */

const CACHE_NAME = 'vendai-images-v1';
const IMAGE_CACHE_NAME = 'vendai-product-images-v1';

// Firebase Storage domains to cache
const FIREBASE_STORAGE_DOMAINS = [
  'firebasestorage.googleapis.com',
  'firebasestorage.app'
];

// Install event - setup caches
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cache opened');
      return cache;
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - cache Firebase Storage images
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check if this is a Firebase Storage image
  const isFirebaseStorageImage = FIREBASE_STORAGE_DOMAINS.some(domain => 
    url.hostname.includes(domain)
  );
  
  if (isFirebaseStorageImage) {
    // Cache-first strategy for images
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[Service Worker] Serving from cache:', url.pathname);
            return cachedResponse;
          }
          
          // Not in cache, fetch from network
          return fetch(event.request).then((networkResponse) => {
            // Only cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              console.log('[Service Worker] Caching new image:', url.pathname);
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((error) => {
            console.error('[Service Worker] Fetch failed:', error);
            // Return a placeholder or cached version if available
            return cache.match(event.request);
          });
        });
      })
    );
  } else {
    // For non-image requests, use network-first strategy
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});

// Background sync for when connection is restored
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-images') {
    event.waitUntil(syncImages());
  }
});

// Sync images when connection is restored
async function syncImages() {
  console.log('[Service Worker] Syncing images...');
  // Could implement logic to pre-fetch missing images
  // or update stale cached images
}

// Handle messages from the app
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data.type === 'CLEAR_IMAGE_CACHE') {
    event.waitUntil(
      caches.delete(IMAGE_CACHE_NAME).then(() => {
        console.log('[Service Worker] Image cache cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data.type === 'PREFETCH_IMAGES') {
    event.waitUntil(
      prefetchImages(event.data.urls).then(() => {
        console.log('[Service Worker] Images prefetched');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

// Prefetch specific images
async function prefetchImages(urls) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  
  return Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response && response.status === 200) {
          await cache.put(url, response);
          console.log('[Service Worker] Prefetched:', url);
        }
      } catch (error) {
        console.error('[Service Worker] Failed to prefetch:', url, error);
      }
    })
  );
}
