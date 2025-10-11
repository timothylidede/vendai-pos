# Distributor Product Image Generation Workflow

## Overview
This document describes the workflow for generating product images for distributor catalogs, similar to the inventory image generation system.

## Purpose
Generate AI-powered product images for the first 10 products of each distributor to enhance the visual appeal of the supplier module's product catalog.

## Files Created

### 1. **Image Generation Script**
- **File**: `scripts/generate-distributor-images.ts`
- **Purpose**: TypeScript script that orchestrates the image generation process
- **Key Features**:
  - Processes first 10 products per distributor
  - Generates image URLs and placeholders
  - Logs all results to a file
  - Provides detailed progress reporting

### 2. **Batch Files**
- **Windows CMD**: `generate-distributor-images.bat`
- **PowerShell**: `generate-distributor-images.ps1`
- **Purpose**: Easy execution of the image generation script
- **Usage**: Double-click to run

### 3. **NPM Script**
- **Command**: `npm run images:distributors`
- **Added to**: `package.json`
- **Runs**: `ts-node scripts/generate-distributor-images.ts`

## How It Works

### Step 1: Product Selection
```typescript
const PRODUCTS_PER_DISTRIBUTOR = 10
```
- Selects first 10 products from each distributor's catalog
- Processes Sam West Distributors Ltd and Mahitaji Enterprises Ltd

### Step 2: Image Generation
For each product, the script:
1. Creates a descriptive prompt for AI image generation
2. Generates/downloads the product image
3. Saves it to `public/images/distributors/products/{distributorId}/{productId}.jpg`
4. Updates the product data with the image URL

### Step 3: Logging
Creates `distributor-image-generation.log` with:
- Timestamp
- Success/failure counts
- Detailed results per product
- Error messages if any

## Usage Instructions

### Quick Start (Windows)
1. Double-click `generate-distributor-images.bat` or `generate-distributor-images.ps1`
2. Press any key to start generation
3. Wait for completion
4. Check the log file for results

### Command Line
```bash
npm run images:distributors
```

### Programmatic Usage
```typescript
import { generateProductImage } from './scripts/generate-distributor-images'

// Generate image for a specific product
const result = await generateProductImage(distributor, product)
```

## Configuration

### Products Per Distributor
Edit `scripts/generate-distributor-images.ts`:
```typescript
const PRODUCTS_PER_DISTRIBUTOR = 10 // Change this number
```

### Output Directory
```typescript
const IMAGE_OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'distributors', 'products')
```

### Log File Location
```typescript
const LOG_FILE = path.join(process.cwd(), 'distributor-image-generation.log')
```

## Integration with OpenAI DALL-E (Production)

To use actual AI image generation, modify the `generateProductImage` function:

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function generateProductImage(distributor: any, product: DistributorProduct) {
  const prompt = `Professional product photography of ${product.name}, 
                  commercial catalog style, white background, 
                  high quality, studio lighting, centered composition`
  
  // Generate image with DALL-E
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
  })
  
  const imageUrl = response.data[0].url
  
  // Download and save image
  const imageBuffer = await fetch(imageUrl).then(r => r.arrayBuffer())
  const outputPath = path.join(IMAGE_OUTPUT_DIR, distributor.id, `${product.id}.jpg`)
  fs.writeFileSync(outputPath, Buffer.from(imageBuffer))
  
  return {
    distributorId: distributor.id,
    productId: product.id,
    imageUrl: `/images/distributors/products/${distributor.id}/${product.id}.jpg`,
    status: 'success'
  }
}
```

## Current Products

### Sam West Distributors Ltd (10 products)
1. 10KG ABABIL PK 386 PARBOILED RICE
2. 10KG AL-MAHAL BIRYANI RICE
3. 10KG CROWN PK 386 BASMATI RICE
4. 10KG FALCON BRAND BIRYANI RICE
5. 10KG FZAMI 1121 LONG GRAIN RICE
6. 10KG FZAMI BIRYANI RICE
7. 10KG FZAMI PK386 WHITE RICE
8. 10KG FZAMI SUPERIOR LONG GRAIN RICE
9. 10KG HIMALAYA FALCON PARBOILED RICE
10. 10KG INDUS 1121 SELLA BASMATI RICE

### Mahitaji Enterprises Ltd (10 products)
1. ACACIA KIDS APPLE 200MLX24
2. ACACIA KIDS BLK CURRNT 200MLX24
3. ACACIA KIDS BLUE RASPBRY 200MLX24
4. ACACIA KIDS S/BRY 200MLX24
5. ACACIA TETRA APPLE 250MLX24
6. AFIA RTD 1.5LTRX6 TROPICAL
7. AFIA RTD 300MLX12 MULTI-VITAMIN
8. AFIA RTD APPLE 500MLX12
9. AFYA HERBAL SALT 200GX12
10. AFYA PURE HONEY BOTTLE 500X12

## Output Structure

```
public/
└── images/
    └── distributors/
        └── products/
            ├── sam-west/
            │   ├── sw-1.jpg
            │   ├── sw-2.jpg
            │   └── ...
            └── mahitaji/
                ├── mh-1.jpg
                ├── mh-2.jpg
                └── ...
```

## Updating Product Data

After generating images, update `data/distributor-data.ts`:

```typescript
export const distributorProducts: Record<string, DistributorProduct[]> = {
  'sam-west': [
    { 
      id: 'sw-1', 
      code: '1', 
      name: '10KG ABABIL PK 386 PARBOILED RICE', 
      unitPrice: 1295, 
      unit: 'Bag', 
      inStock: true, 
      leadTime: '1-2 days', 
      category: 'Rice',
      imageUrl: '/images/distributors/products/sam-west/sw-1.jpg' // Add this
    },
    // ... more products
  ],
  // ... other distributors
}
```

## Error Handling

The script handles:
- Missing directories (creates them automatically)
- Failed API calls (logs and continues)
- Network errors (retries with backoff)
- Invalid product data (skips and logs)

## Best Practices

1. **Test with Small Batches**: Start with 1-2 products to test the workflow
2. **Monitor API Usage**: Track OpenAI API costs and rate limits
3. **Backup Images**: Keep a backup of generated images
4. **Version Control**: Don't commit large image files to git (use .gitignore)
5. **CDN Integration**: Consider using a CDN for production images

## Troubleshooting

### Script Won't Run
- Ensure `ts-node` is installed: `npm install -D ts-node`
- Check TypeScript configuration in `tsconfig.json`

### Images Not Appearing
- Verify output directory exists
- Check file permissions
- Ensure Next.js public folder is properly configured

### API Errors
- Verify OpenAI API key is set
- Check API rate limits
- Monitor API quota usage

## Future Enhancements

1. **Batch Processing**: Process multiple products in parallel
2. **Image Optimization**: Compress images after generation
3. **Caching**: Cache generated images to avoid regeneration
4. **Progress Bar**: Add visual progress indicator
5. **Web Interface**: Create a web UI for image management
6. **Alternative AI Providers**: Support for Stable Diffusion, Midjourney, etc.

## Related Files

- `data/distributor-data.ts` - Product data with image URLs
- `components/modules/supplier-module.tsx` - Displays product images
- `scripts/generate-product-images.cjs` - Similar workflow for inventory

## Support

For issues or questions:
1. Check the log file: `distributor-image-generation.log`
2. Review console output for errors
3. Verify all dependencies are installed
4. Test with a single product first
