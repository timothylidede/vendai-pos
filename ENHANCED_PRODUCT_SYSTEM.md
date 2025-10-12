# Enhanced Product Extraction & Image Generation System

## 🎯 Overview

This system has been significantly improved to provide better product data extraction and AI-generated product images for distributor catalogs.

## ✨ Key Improvements

### 1. **Enhanced Product Extraction (OpenAI)**

#### Fixed Issues:
- ✅ **Brand Extraction**: Now correctly extracts brand names (e.g., "Ababil" instead of "KG" or size prefixes)
- ✅ **Name Formatting**: Product names are in Title Case instead of ALL CAPS
- ✅ **Price Structure**: Removed duplicate `wholesalePrice` - now uses single `price` field
- ✅ **Better Filtering**: Removes headers, footers, page numbers, and non-product entries
- ✅ **Data Validation**: Enhanced validation to catch and filter invalid entries

#### Features:
- Intelligent brand name extraction from product titles
- Detailed product descriptions with all relevant information
- Category-specific classification
- Robust error handling and retry logic
- Cached results per chunk to avoid re-processing
- Cost-efficient using GPT-4o-mini (~$0.30-0.50 for 7,000 products)

### 2. **FAL.ai Image Generation (Image-to-Image)**

#### Fixed Issues:
- ✅ **Multiple Reference Images**: Now fetches and uses up to 5 reference images (was just 1)
- ✅ **Image-to-Image Model**: Properly uses FAL.ai FLUX Pro image-to-image for better results
- ✅ **Category-Specific Prompts**: Tailored prompts for each product category (beverages, food, grains, oils, etc.)
- ✅ **Better Reference Search**: Improved Google Image Search with e-commerce site priority

#### Features:
- **90% cost savings** vs Replicate ($0.003 vs $0.03 per image)
- Multiple reference images for more accurate product representation
- Category-specific prompts that focus on realistic packaged products:
  - Beverages: Bottles, cans, cartons with clear labels
  - Food: Package integrity, nutritional labels, brand visibility
  - Grains: Bag textures, weight display, grain windows
  - Oils: Bottle clarity, volume display, liquid visibility
  - Dairy: Fresh appearance, moisture effects, date visibility
  - Personal Care: Container types, size display, product type
  - Cleaning: Warning labels, spray mechanisms, usage info
- Batch processing with configurable concurrency
- Firestore integration for image URL storage
- Detailed generation logs and cost tracking

## 📁 File Structure

```
scripts/
├── extract-all-products-openai.ts          # Enhanced product extraction
├── generate-distributor-images-fal.ts      # New FAL.ai image generation
└── generate-distributor-images.ts          # Old Replicate version (deprecated)

lib/
└── fal-image-generator.ts                  # Updated with img2img support

data/
├── distributors/
│   ├── sam-west-products.ts               # Generated product data
│   └── mahitaji-products.ts               # Generated product data
└── .extraction-cache/                      # Cached extraction results
    ├── sam-west/
    │   ├── chunk-1.json
    │   └── chunk-2.json
    └── mahitaji/
        └── chunk-1.json

generate-products-enhanced.ps1              # PowerShell runner script
generate-products-enhanced.bat              # Batch runner script
```

## 🚀 Usage

### Method 1: Using Runner Scripts (Recommended)

#### PowerShell:
```powershell
.\generate-products-enhanced.ps1
```

#### Command Prompt:
```cmd
generate-products-enhanced.bat
```

These interactive scripts will guide you through:
1. Product extraction (with optional cache clearing)
2. Image generation (with distributor selection and limits)

### Method 2: Using npm Scripts

#### Extract Products:
```bash
# Normal extraction (uses cache if available)
npm run extract:products

# Clear cache and re-extract everything
npm run extract:products -- --clear-cache
```

#### Generate Images:
```bash
# Generate 50 images for Sam West (skip existing)
npm run generate:distributor-images sam-west 50

# Generate 100 images for Mahitaji (skip existing)
npm run generate:distributor-images mahitaji 100

# Regenerate all images (including existing)
npm run generate:distributor-images sam-west 50 --regenerate
```

### Method 3: Direct Script Execution

#### Extract Products:
```bash
tsx scripts/extract-all-products-openai.ts
tsx scripts/extract-all-products-openai.ts --clear-cache
```

#### Generate Images:
```bash
tsx scripts/generate-distributor-images-fal.ts sam-west 50
tsx scripts/generate-distributor-images-fal.ts mahitaji 100 --regenerate
```

## ⚙️ Configuration

### Required Environment Variables

```env
# OpenAI (for product extraction)
OPENAI_API_KEY=sk-...

# FAL.ai (for image generation)
FAL_API_KEY=...

# Google Custom Search (for reference images)
GOOGLE_CSE_API_KEY=...
GOOGLE_CSE_CX=...

# Firebase (for storage)
FIREBASE_SERVICE_ACCOUNT_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
```

### Optional Configuration

You can customize these in the script files:

**Product Extraction** (`extract-all-products-openai.ts`):
- `maxChars`: Chunk size (default: 20000)
- Model: GPT-4o-mini (cost-effective)
- Temperature: 0.1 (more deterministic)

**Image Generation** (`generate-distributor-images-fal.ts`):
- `BATCH_SIZE`: Products per batch (default: 5)
- `imageSize`: Image dimensions (default: 'square_hd' = 1024x1024)
- `strength`: Image-to-image strength (default: 0.65)

## 📊 Cost Estimates

### Product Extraction (OpenAI GPT-4o-mini)
- Input: $0.150 per 1M tokens
- Output: $0.600 per 1M tokens
- **~7,000 products: $0.30-0.50 USD**

### Image Generation (FAL.ai FLUX)
- $0.003 per image (vs $0.03 for Replicate)
- **50 images: $0.15 USD**
- **100 images: $0.30 USD**
- **1,000 images: $3.00 USD**
- **7,000 images: $21.00 USD**

**Total for complete catalog: ~$21.50 USD** (vs $210+ with Replicate)

## 🎨 Category-Specific Prompts

Each product category gets optimized prompts:

### Beverages
- Focus on bottle/can/carton visibility
- Clear label text and branding
- Accurate liquid color if visible
- Upright positioning

### Food
- Complete package with nutritional info
- Brand logos clearly visible
- Natural orientation
- Window displays of contents

### Grains
- Bag texture and design
- Weight display
- Variety information
- Grain windows if present

### Oils
- Container clarity
- Volume markings
- Liquid visibility
- Proper lighting for reflections

### Dairy
- Fresh appearance
- Moisture effects
- Date visibility
- Realistic scale

### Personal Care
- Container type clarity
- Size information
- Product type display
- Label readability

### Cleaning
- Warning labels
- Spray mechanisms
- Usage instructions
- Brand prominence

## 🔍 Quality Checks

### Product Extraction Validation
- Minimum name length (3 characters)
- Valid price range (> 0, < 1,000,000)
- Invalid pattern detection (headers, footers, etc.)
- Brand name validation (not size/weight)
- Category classification

### Image Generation Validation
- Multiple reference images (up to 5)
- E-commerce site priority in search
- Image quality scoring
- Resolution checking
- Invalid URL filtering

## 📝 Output Files

### Product Files
```typescript
// data/distributors/sam-west-products.ts
export const sam_west_products: Product[] = [
  {
    id: 1,
    code: "110",
    name: "Ababil PK 386 Parboiled Rice",  // Title Case
    description: "Ababil brand parboiled rice, 10kg bag...",
    price: 1295,  // Single price
    category: "grains",
    brand: "Ababil",  // Correct brand
    unit: "BAG",
    inStock: true,
    distributorName: "Sam West",
    image: "https://..."
  }
]
```

### Firestore Documents
```javascript
// Collection: distributor_images
{
  distributorId: "sam-west",
  productId: "1",
  productCode: "110",
  productName: "Ababil PK 386 Parboiled Rice",
  brand: "Ababil",
  category: "grains",
  imageUrl: "https://...",
  generatedAt: "2025-10-11T...",
  model: "fal-ai/flux-pro/v1.1-ultra"
}
```

## 🐛 Troubleshooting

### Product Extraction Issues

**Problem: Products have wrong brand names**
- Solution: Re-run with `--clear-cache` flag to re-extract with improved prompts

**Problem: Too many junk entries**
- Solution: The enhanced filtering should catch most, but you can add more patterns in the validation function

**Problem: OpenAI timeout errors**
- Solution: Script has automatic retries and progress tracking. Large chunks may take 30-120 seconds.

### Image Generation Issues

**Problem: No reference images found**
- Solution: Check Google CSE API key and CX in environment variables

**Problem: Images don't match products**
- Solution: Ensure product names and brands are correctly extracted first

**Problem: Generation fails**
- Solution: Check FAL_API_KEY and review Firestore logs

## 🔄 Workflow

1. **Extract Products**:
   ```bash
   npm run extract:products
   ```
   - Extracts from PDF text files
   - Generates TypeScript product files
   - Creates cache for chunks

2. **Generate Images** (First batch):
   ```bash
   npm run generate:distributor-images sam-west 50
   ```
   - Processes first 50 products without images
   - Saves to Firestore

3. **Re-run Extraction** (Updates image URLs):
   ```bash
   npm run extract:products
   ```
   - Fetches generated images from Firestore
   - Updates product files with image URLs

4. **Generate More Images**:
   ```bash
   npm run generate:distributor-images sam-west 50
   ```
   - Processes next batch

5. **Repeat** until all products have images

## 📈 Performance

- **Extraction**: ~2-3 minutes for 7,000 products (with caching)
- **Image Generation**: ~5-10 seconds per image
  - 50 images: ~5-8 minutes
  - 100 images: ~10-15 minutes
  - 1,000 images: ~1.5-2 hours

## 🎯 Next Steps

1. Review generated product files for accuracy
2. Generate images in batches (start with 50-100)
3. Check Firestore `distributor_images` collection
4. Test products in supplier module
5. Continue generating images until complete

## 📚 References

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [FAL.ai FLUX Models](https://fal.ai/models/fal-ai/flux)
- [Google Custom Search API](https://developers.google.com/custom-search)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

**Last Updated**: October 11, 2025
**Version**: 2.0.0 - Enhanced Edition
