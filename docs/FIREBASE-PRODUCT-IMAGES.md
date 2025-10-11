# Firebase Product Images Integration

## Overview

The supplier module now displays AI-generated product images stored in Firebase. Images are generated using FAL.ai FLUX schnell with smart e-commerce reference images.

## Architecture

### Components

1. **Image Generation** (`scripts/generate-sam-west-batch.ts`)
   - Generates product images in batches of 100
   - Uses smart e-commerce reference search
   - Uploads to Firebase Storage
   - Stores metadata in Firestore `distributor_images` collection

2. **Image Fetching** (`lib/firebase-product-images.ts`)
   - Fetches images from Firestore
   - Creates product ID to image URL mapping
   - Supports multiple matching strategies

3. **Data Integration** (`data/distributor-data.ts`)
   - `getDistributorProductsWithImages()` - Async function to fetch products with images
   - Enriches product data with Firebase image URLs
   - Falls back gracefully if images unavailable

4. **UI Display** (`components/modules/supplier-module.tsx`)
   - Updated to use async image-enriched products
   - Displays images in product cards
   - Supports pagination (40 products per page)

## Firebase Schema

### Collection: `distributor_images`

```typescript
{
  productId: string          // Normalized product identifier
  productName: string        // Original product name
  distributorId: string      // 'sam-west', 'mahitaji', etc.
  imageUrl: string          // Public Firebase Storage URL
  storageUrl: string        // Firebase Storage path
  category: string          // Product category
  brand: string             // Product brand
  createdAt: string         // ISO timestamp
  prompt: string            // AI generation prompt used
  referenceUrls: string[]   // Source reference images
  embedding: number[]       // Semantic search vector
}
```

## Product Matching

The system uses multiple strategies to match products with images:

1. **Exact Product ID Match**: `productId === imageMap.get(productId)`
2. **Normalized Name Match**: Removes special chars, converts to lowercase
3. **Fuzzy Match**: Substring matching for similar names

Example:
```typescript
Product: "KG ABABIL PK 386 PARBOILED RICE"
Matches: "kg-ababil-pk-386-parboiled-rice" (normalized)
```

## Usage

### Generate Images

```bash
# Generate first 100 products
npx tsx scripts/generate-sam-west-batch.ts 1

# Generate products 101-200
npx tsx scripts/generate-sam-west-batch.ts 2

# Continue for remaining batches (3-59)
```

### View in Supplier Module

1. Navigate to Supplier Module
2. Select "Sam West" distributor
3. Images will automatically load with products
4. Use pagination to browse all products

## Image Specifications

- **Size**: 1024x1024 (square_hd)
- **Format**: JPEG
- **Background**: Slate gray (#1f2937)
- **Style**: Professional studio product photography
- **Quality**: 4-8 reference images per product
- **Cost**: $0.003 per image

## Performance

- **Generation Speed**: ~20-30 seconds per image (including upload)
- **Batch Processing**: 100 products in 30-45 minutes
- **Image Loading**: Async, doesn't block UI
- **Caching**: Firebase CDN for fast delivery

## Error Handling

1. **Missing Images**: Products display without images gracefully
2. **Firebase Errors**: Logs error, returns products without images
3. **Match Failures**: Uses fuzzy matching before giving up
4. **Network Issues**: UI shows loading states and error messages

## Monitoring

Check generation progress in terminal:
```
[21/5173] PCS NIP NAP WIPES
   🔍 Searching: "PCS NIP NAP WIPES product packaging"
   📸 Found 8 reference URLs
   ✅ Loaded reference 1 (13KB)
   ✅ Loaded reference 2 (45KB)
   🎯 Using 4 reference images
   🎨 Generating with FAL.ai...
   ✅ Success
```

## Future Enhancements

1. **Smart Matching Engine**: Semantic search with embeddings
2. **Image Recycling**: Reuse images for similar products
3. **Batch Analytics**: Track success rates and costs
4. **Quality Review UI**: Manual review and regeneration
5. **Retailer Uploads**: Match retailer photos with distributor catalog

## Cost Optimization

- **Sam West**: ~5,900 products × $0.003 = ~$18
- **Mahitaji**: ~1,100 products × $0.003 = ~$3
- **Total**: ~$21 for full catalog
- **Savings**: 90% cheaper than Replicate ($210 → $21)

## Files Changed

1. `lib/firebase-product-images.ts` - NEW: Image fetching utilities
2. `data/distributor-data.ts` - Added `getDistributorProductsWithImages()`
3. `components/modules/supplier-module.tsx` - Updated to use async images
4. `scripts/generate-sam-west-batch.ts` - Smart reference integration

## Testing

1. ✅ Smart reference search (71% e-commerce URLs)
2. ✅ Image generation with FAL.ai
3. ✅ Firebase upload and metadata storage
4. ✅ Product matching algorithms
5. ⏸️ UI display (ready to test after batch 1 completes)

## Support

For issues or questions:
- Check Firebase console for uploaded images
- Review Firestore `distributor_images` collection
- Monitor terminal output during generation
- Check browser console for UI errors
