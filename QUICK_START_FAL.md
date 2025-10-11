# 🚀 Quick Start: FAL.ai Image Generation

## Prerequisites
1. Get API key from https://fal.ai/dashboard/keys
2. Add to `.env.local`: `FAL_API_KEY=your_key_here`
3. Make sure `serviceAccountKey.json` exists in project root

---

## Commands

### Test Connection (No cost, 1 minute)
```powershell
npx tsx scripts/test-fal-connection.ts
```
Generates 1 Coca-Cola test image to verify API is working.  
**Cost:** $0.003

---

### Dry Run - Parse Only (No cost, 1 minute)
```powershell
npx tsx scripts/generate-images-fal.ts --limit 10 --dry-run
```
Parses products but doesn't generate images. Good for testing parser.  
**Cost:** $0

---

### Generate 10 Test Images (5 minutes)
```powershell
npx tsx scripts/generate-images-fal.ts --limit 10
```
**Cost:** $0.03

---

### Generate 50 Images (10 minutes)
```powershell
npx tsx scripts/generate-images-fal.ts --limit 50
```
**Cost:** $0.15

---

### Generate Full Sam West Catalog (2 hours)
```powershell
npx tsx scripts/generate-images-fal.ts --distributor sam-west
```
~5,900 products  
**Cost:** $17.70

---

### Generate Full Mahitaji Catalog (30 minutes)
```powershell
npx tsx scripts/generate-images-fal.ts --distributor mahitaji
```
~1,100 products  
**Cost:** $3.30

---

### Generate Everything (3 hours)
```powershell
npx tsx scripts/generate-images-fal.ts
```
~7,000 products from both distributors  
**Cost:** $21.00

---

### Skip OpenAI Embeddings (Faster, but can't do semantic matching later)
```powershell
npx tsx scripts/generate-images-fal.ts --limit 10 --skip-embeddings
```
Saves ~30% time but loses semantic search capability.

---

## Verify Results

### Check Firebase Storage
https://console.firebase.google.com/project/vendai-fa58c/storage  
Navigate to: `distributor-images/`

### Check Firestore
https://console.firebase.google.com/project/vendai-fa58c/firestore  
Collection: `distributor_images`

### View Parsed Products
```powershell
cat data/parsed-distributor-products.json
```

---

## Troubleshooting

### API Key Not Working
```powershell
# Check if loaded
$env:FAL_API_KEY

# If empty, restart terminal after adding to .env.local
```

### Rate Limit Errors
- Free tier: ~10-20 requests/minute
- Add credits: https://fal.ai/dashboard/billing
- Or add delays between requests

### Firebase Errors
```powershell
# Verify service account exists
Test-Path serviceAccountKey.json

# Should return: True
```

---

## Cost Reference

| Images | FAL.ai Cost | Replicate Cost | Savings |
|--------|-------------|----------------|---------|
| 10 | $0.03 | $0.30 | $0.27 (90%) |
| 50 | $0.15 | $1.50 | $1.35 (90%) |
| 100 | $0.30 | $3.00 | $2.70 (90%) |
| 1,000 | $3.00 | $30.00 | $27.00 (90%) |
| 7,000 | $21.00 | $210.00 | $189.00 (90%) |

---

## What Gets Created

For each product image:
- ✅ High-quality 1024x1024 JPEG in Firebase Storage
- ✅ Metadata in Firestore (brand, category, pack size, etc.)
- ✅ OpenAI embedding for semantic matching (1536 dimensions)
- ✅ Semantic tags for search
- ✅ Usage tracking (timesReused, reusedByRetailers)

---

## Next Steps After Generation

1. **Deploy Firestore Indexes:**
   ```powershell
   firebase deploy --only firestore:indexes
   ```

2. **Build Image Matching Engine:**
   - Implement `lib/image-matching-service.ts`
   - 3-tier matching (exact, semantic, fuzzy)

3. **Integrate into CSV Upload:**
   - Auto-match retailer products to distributor images
   - 80-90% reuse rate expected

4. **Launch to Retailers:**
   - Test with 5 pilot retailers
   - Monitor cost savings
   - Refine matching algorithm

---

**Documentation:**
- Full setup guide: `docs/FAL_AI_SETUP_GUIDE.md`
- Checklist: `docs/FAL_AI_SETUP_CHECKLIST.md`
- System overview: `docs/DISTRIBUTOR_IMAGE_LIBRARY_SYSTEM.md`

**Support:**
- FAL.ai Discord: https://discord.gg/fal-ai
- FAL.ai Docs: https://fal.ai/docs
