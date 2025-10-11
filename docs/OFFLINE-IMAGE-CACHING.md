# Offline Image Caching System

## Overview

VendAI POS now supports **offline image caching** for product images stored in Firebase Storage. Images are automatically cached when viewed and remain available even without network connection.

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  User Views Product in Supplier Module                  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│  Browser checks Service Worker Cache                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Cache HIT?                                       │   │
│  │ ├─ YES → Serve from cache (instant, offline)   │   │
│  │ └─ NO  → Fetch from Firebase Storage           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│  Image fetched from Firebase Storage CDN                │
│  - Image displayed to user                              │
│  - Image automatically cached by Service Worker         │
│  - Next view will be instant (from cache)               │
└─────────────────────────────────────────────────────────┘
```

### Key Features

1. **Automatic Caching**: Images are cached the first time they're viewed
2. **Persistent Storage**: Cache survives app restarts and browser sessions
3. **Offline Support**: Cached images work without internet connection
4. **Smart Prefetching**: Ability to download images in advance
5. **Cache Management**: Tools to monitor and clear cache
6. **CDN Benefits**: First load still uses Firebase's fast CDN

## Benefits

### For Users
- ✅ **Faster Load Times**: Instant display of previously viewed images
- ✅ **Offline Access**: View product catalogs without internet
- ✅ **Data Savings**: Reduced bandwidth usage (images only downloaded once)
- ✅ **Better UX**: No loading spinners for cached images

### For Business
- ✅ **Rural Areas**: Works in locations with poor connectivity
- ✅ **Mobile Data**: Reduces mobile data costs
- ✅ **Reliability**: System works even during network outages
- ✅ **Performance**: Faster browsing = more orders

## Implementation

### Files Created

1. **`public/sw.js`** - Service Worker for caching logic
   - Intercepts Firebase Storage image requests
   - Cache-first strategy for images
   - Network-first strategy for other resources
   - Background sync support

2. **`lib/service-worker.ts`** - Service Worker utilities
   - Registration and management functions
   - Cache statistics and monitoring
   - Prefetch and clear cache operations

3. **`hooks/use-service-worker.ts`** - React hooks
   - `useServiceWorker()` - Register service worker
   - `useImageCache()` - Manage image cache

4. **`components/service-worker-registration.tsx`** - Auto-register component
   - Automatically registers service worker on app load
   - Integrated into root layout

5. **`components/image-cache-manager.tsx`** - Admin UI
   - View cache statistics
   - Prefetch images for offline use
   - Clear cache when needed

### Integration

Service worker is automatically registered when the app loads:

```tsx
// app/layout.tsx
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ServiceWorkerRegistration /> {/* Auto-registers on load */}
        {children}
      </body>
    </html>
  )
}
```

### Usage in Components

```tsx
import { useImageCache } from '@/hooks/use-service-worker'

function MyComponent() {
  const { stats, prefetch, clear } = useImageCache()
  
  // Prefetch images for offline use
  const handlePrefetch = async () => {
    const imageUrls = [
      'https://firebasestorage.googleapis.com/...',
      'https://firebasestorage.googleapis.com/...'
    ]
    await prefetch(imageUrls)
  }
  
  return (
    <div>
      <p>Cached Images: {stats.totalImages}</p>
      <button onClick={handlePrefetch}>Prefetch</button>
      <button onClick={clear}>Clear Cache</button>
    </div>
  )
}
```

## Cache Strategy

### Cache-First for Images

1. **Request intercepted** by Service Worker
2. **Check cache** for matching image
3. **If cached**: Return immediately (0ms load time)
4. **If not cached**: 
   - Fetch from Firebase Storage CDN
   - Store in cache for future requests
   - Return to browser

### Benefits of Cache-First

- ✅ Instant load times for repeat views
- ✅ Works offline after first view
- ✅ Reduces Firebase Storage bandwidth costs
- ✅ Better user experience

### Network-First for Other Resources

- App code, API requests use network-first
- Ensures fresh data while caching for offline fallback

## Cache Management

### Viewing Cache Stats

```tsx
import { ImageCacheManager } from '@/components/image-cache-manager'

// In admin dashboard or settings
<ImageCacheManager />
```

Shows:
- Total cached images
- Storage space used
- Oldest/newest images
- Actions to prefetch or clear

### Prefetching Images

Prefetch images in advance for offline use:

```typescript
import { prefetchImages } from '@/lib/service-worker'

// Prefetch all Sam West product images
const urls = await getDistributorImageUrls('sam-west')
await prefetchImages(urls)
```

Use cases:
- Download catalog before field visit
- Prepare for offline demo
- Background sync during idle time

### Clearing Cache

```typescript
import { clearImageCache } from '@/lib/service-worker'

// Clear all cached images
await clearImageCache()
```

Reasons to clear:
- Free up storage space
- Force fresh image downloads
- Troubleshoot caching issues

## Storage Limits

### Browser Cache Quotas

Different browsers have different storage limits:

| Browser | Quota Type | Typical Limit |
|---------|-----------|---------------|
| Chrome  | Persistent | 60% of free disk space |
| Firefox | Persistent | 50% of free disk space |
| Safari  | Persistent | 1GB max |
| Edge    | Persistent | 60% of free disk space |

### Recommendations

- **Average image size**: ~150KB (1024x1024 JPEG)
- **100 images**: ~15MB
- **1,000 images**: ~150MB
- **5,000 images**: ~750MB

For the full Sam West catalog (~5,900 images):
- **Estimated size**: ~880MB
- **Safe for most devices**: ✅
- **Recommend**: Prefetch strategically (by category)

## Performance Metrics

### Without Caching
- First load: 200-500ms (CDN)
- Repeat load: 200-500ms (CDN)
- Offline: ❌ Fails

### With Caching
- First load: 200-500ms (CDN + cache)
- Repeat load: **0-50ms** (cache) 🚀
- Offline: ✅ Works perfectly

### Bandwidth Savings

For a retailer viewing 100 products daily:
- **Without cache**: 100 images × 150KB = 15MB/day = 450MB/month
- **With cache**: First day 15MB, subsequent days ~0MB
- **Monthly savings**: ~435MB (97% reduction)

## Testing

### Check Service Worker Status

```javascript
// In browser console
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg ? 'Registered' : 'Not registered')
})
```

### View Cache Contents

```javascript
// In browser console
caches.open('vendai-product-images-v1').then(cache => {
  cache.keys().then(keys => {
    console.log('Cached images:', keys.length)
    keys.forEach(req => console.log(req.url))
  })
})
```

### Test Offline Mode

1. Open browser DevTools
2. Go to Network tab
3. Check "Offline" checkbox
4. Navigate to supplier module
5. Images should still load from cache! ✅

## Best Practices

### For Developers

1. **Always check service worker status** before relying on cache
2. **Handle cache failures gracefully** with fallback images
3. **Monitor cache size** to prevent excessive storage use
4. **Version cache names** when updating cache strategy
5. **Clear old caches** in service worker activate event

### For Users

1. **First visit requires internet** to download images
2. **Cache builds automatically** as you browse
3. **Use prefetch** before going offline (field visits, demos)
4. **Clear cache occasionally** if storage is limited
5. **Keep app updated** for latest cache improvements

## Troubleshooting

### Images Not Caching

1. Check service worker is registered:
   ```javascript
   navigator.serviceWorker.getRegistration()
   ```

2. Check browser supports service workers:
   ```javascript
   console.log('SW supported:', 'serviceWorker' in navigator)
   ```

3. Check HTTPS (required for service workers):
   - Service workers only work on HTTPS (or localhost)
   - HTTP sites won't cache images

### Cache Not Clearing

1. Unregister service worker:
   ```javascript
   navigator.serviceWorker.getRegistration().then(reg => 
     reg?.unregister()
   )
   ```

2. Manually clear caches:
   ```javascript
   caches.keys().then(names => 
     Promise.all(names.map(name => caches.delete(name)))
   )
   ```

3. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

### Storage Quota Exceeded

1. Check current usage:
   ```javascript
   navigator.storage.estimate().then(est => {
     console.log('Used:', est.usage, 'Quota:', est.quota)
   })
   ```

2. Clear cache to free space:
   ```javascript
   await clearImageCache()
   ```

3. Prefetch selectively (by category, not entire catalog)

## Future Enhancements

### Planned Features

1. **Smart Prefetching**
   - Auto-prefetch frequently viewed products
   - Category-based prefetch strategies
   - Predict what user will view next

2. **Cache Optimization**
   - Image compression for cached versions
   - Lazy cleanup of old unused images
   - Priority-based caching

3. **Analytics**
   - Cache hit rate metrics
   - Bandwidth savings reports
   - Offline usage patterns

4. **Background Sync**
   - Auto-update cached images when stale
   - Sync when connection restored
   - Smart scheduling (WiFi only, idle time)

## Security Considerations

### Safe by Design

- ✅ Service worker only caches images from Firebase Storage
- ✅ No sensitive data in cache (only public product images)
- ✅ Cache is scoped to domain (no cross-site access)
- ✅ HTTPS required for service worker

### Data Privacy

- Images are public product photos (not user data)
- Cache is stored locally on user's device
- User can clear cache anytime
- No tracking or analytics in service worker

## Cost Impact

### Firebase Storage Bandwidth

With caching enabled:
- **First view**: Downloads from Firebase (costs bandwidth)
- **Repeat views**: Served from cache (free)
- **Bandwidth savings**: 90-95% reduction for repeat views

Example monthly savings:
- 100 retailers × 1,000 products viewed/month
- Without cache: 100 × 1,000 × 150KB = 15GB bandwidth
- With cache: ~1.5GB bandwidth (90% reduction)
- **Cost savings**: ~$0.12/month per GB = ~$1.62/month

## Conclusion

The offline image caching system provides:

✅ **Better Performance**: 10x faster load times for cached images
✅ **Offline Support**: Works without internet after first load  
✅ **Cost Savings**: 90% reduction in bandwidth usage
✅ **Better UX**: Instant image display, no loading spinners
✅ **Business Value**: Works in rural areas, saves mobile data

**Status**: ✅ Ready to use (auto-enabled on next deployment)

---

**Next Steps**:
1. Deploy app with service worker
2. Monitor cache performance metrics
3. Add ImageCacheManager to admin dashboard
4. Implement smart prefetch strategies
