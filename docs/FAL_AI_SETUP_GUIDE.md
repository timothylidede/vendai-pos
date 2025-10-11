# FAL.ai Setup Guide

## Step 1: Create FAL.ai Account & Get API Key

### 1.1 Sign Up for FAL.ai
1. Go to: **https://fal.ai/**
2. Click "Sign Up" or "Get Started"
3. Sign up with GitHub or Email
4. Verify your email

### 1.2 Get Your API Key
1. After logging in, go to: **https://fal.ai/dashboard/keys**
2. Click "Create New Key" or "Generate API Key"
3. Give it a name like "VendAI Production"
4. Copy the API key (starts with something like `fal-xxxxx...`)
5. **IMPORTANT**: Save it immediately - you won't see it again!

### 1.3 Pricing Information
- **FLUX schnell model**: $0.003 per image
- **Free tier**: $5 free credits (enough for ~1,600 images!)
- **No monthly subscription required** - pay as you go

### 1.4 Add Credits (Optional)
1. Go to: https://fal.ai/dashboard/billing
2. Click "Add Credits"
3. Recommended: Start with $25 for testing
4. For 7,000 distributor images: Add $30 ($21 + buffer)

---

## Step 2: Install Required Packages

Run these commands in your terminal:

```bash
# Install FAL.ai client
npm install @fal-ai/serverless-client

# Install OpenAI for embeddings (if not already installed)
npm install openai

# Install Firebase Admin SDK (if not already installed)
npm install firebase-admin
```

---

## Step 3: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# FAL.ai API Key (get from https://fal.ai/dashboard/keys)
FAL_API_KEY=your_fal_api_key_here

# OpenAI API Key (for embeddings - get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=your_openai_api_key_here

# Firebase Storage Bucket (already configured)
FIREBASE_STORAGE_BUCKET=vendai-fa58c.appspot.com
```

**IMPORTANT**: Make sure `.env.local` is in your `.gitignore`!

---

## Step 4: Verify Firebase Service Account

Make sure you have `serviceAccountKey.json` in your project root:

```bash
# Check if file exists
ls serviceAccountKey.json

# If missing, download it from Firebase Console:
# 1. Go to: https://console.firebase.google.com/project/vendai-fa58c/settings/serviceaccounts/adminsdk
# 2. Click "Generate New Private Key"
# 3. Save as serviceAccountKey.json in project root
```

---

## Step 5: Test Setup

Run this command to test FAL.ai connection:

```bash
# Test with 10 products (dry run first)
npx tsx scripts/generate-images-fal.ts --limit 10 --dry-run
```

This will:
- ✅ Parse 10 products from distributor pricelists
- ✅ Show you what would be generated (no API calls)
- ✅ Display cost estimate
- ✅ Save parsed products to JSON

---

## Step 6: Generate Test Images

Once dry run succeeds, generate actual images:

```bash
# Generate images for 10 products
npx tsx scripts/generate-images-fal.ts --limit 10

# Or test with just Sam West products
npx tsx scripts/generate-images-fal.ts --distributor sam-west --limit 5

# Or test with just Mahitaji products
npx tsx scripts/generate-images-fal.ts --distributor mahitaji --limit 5
```

Expected output:
```
🚀 FAL.ai Distributor Image Generator
Options: { distributor: null, limit: 10, dryRun: false, skipEmbeddings: false }

📦 Parsing distributor pricelists...

✅ Parsed 5938 products from Sam West
✅ Parsed 1119 products from Mahitaji

⚠️ Limited to 10 products for testing

📊 Total products to process: 10

💰 Cost Estimate:
   FAL.ai FLUX schnell: $0.03
   vs Replicate FLUX:   $0.30
   Savings:             $0.27 (90%)

🎨 Starting image generation...

[1/10] 10KG ABABIL PK 386 PARBOILED RICE
   ✅ Success
[2/10] 10KG AL-MAHAL BIRYANI RICE (Purple bag)
   ✅ Success
...
```

---

## Step 7: Verify Results

### Check Firebase Storage
1. Go to: https://console.firebase.google.com/project/vendai-fa58c/storage
2. Navigate to `distributor-images/`
3. You should see folders for each category with generated images

### Check Firestore
1. Go to: https://console.firebase.google.com/project/vendai-fa58c/firestore
2. Open `distributor_images` collection
3. You should see 10 documents with metadata

### Check Local Output
```bash
# View parsed products
cat data/parsed-distributor-products.json
```

---

## Troubleshooting

### Error: "Missing FAL_API_KEY"
- Make sure `.env.local` has `FAL_API_KEY=...`
- Restart your terminal after adding the key
- Try: `echo $env:FAL_API_KEY` (PowerShell) to verify

### Error: "Missing serviceAccountKey.json"
- Download from Firebase Console (see Step 4)
- Place in project root (same folder as package.json)

### Error: "Failed to initialize Firebase Admin"
- Check serviceAccountKey.json is valid JSON
- Verify file path is correct
- Make sure Firebase project ID matches

### Error: "Rate limit exceeded"
- FAL.ai free tier has rate limits
- Add credits to your account
- Reduce concurrency in script

### Images look wrong/blurry
- Check prompt in `scripts/generate-images-fal.ts`
- Try adjusting `num_inference_steps` (4-8 for FLUX schnell)
- Verify `image_size: 'square_hd'` for 1024x1024

---

## Next Steps After Testing

Once 10 test images look good:

1. **Generate Full Library** (7,000 images):
   ```bash
   npx tsx scripts/generate-images-fal.ts
   ```
   - Estimated time: ~2-3 hours
   - Total cost: ~$21

2. **Deploy Firestore Indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

3. **Build Matching Engine** (Week 2):
   - Implement `lib/image-matching-service.ts`
   - Integrate into CSV upload flow

4. **Launch to Retailers** (Week 3):
   - Test with 5 pilot retailers
   - Monitor reuse rate
   - Calculate actual savings

---

## Cost Tracking

Keep track of your spending:

| Task | Images | Cost | Date |
|------|--------|------|------|
| Initial test | 10 | $0.03 | |
| Full Sam West | 5,900 | $17.70 | |
| Full Mahitaji | 1,100 | $3.30 | |
| **TOTAL** | **7,000** | **$21.00** | |

View your usage: https://fal.ai/dashboard/billing

---

## Support

- **FAL.ai Docs**: https://fal.ai/docs
- **FAL.ai Discord**: https://discord.gg/fal-ai
- **FLUX schnell Model**: https://fal.ai/models/fal-ai/flux/schnell

---

**Document Version**: 1.0  
**Last Updated**: October 11, 2025
