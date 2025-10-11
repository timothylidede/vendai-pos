# FAL.ai Setup Checklist

## ✅ Complete These Steps

### Step 1: Get FAL.ai API Key (5 minutes)

1. [ ] Go to https://fal.ai/
2. [ ] Click "Sign Up" and create account (use GitHub for fastest signup)
3. [ ] Verify your email
4. [ ] Go to https://fal.ai/dashboard/keys
5. [ ] Click "Create New Key" and name it "VendAI Production"
6. [ ] **Copy the API key** (starts with `fal-...`) - you won't see it again!

**Free tier includes $5 credits = 1,600 images!**

---

### Step 2: Add API Key to Environment (2 minutes)

1. [ ] Open `.env.local` file in project root
2. [ ] Add this line:
   ```
   FAL_API_KEY=your_key_here
   ```
3. [ ] Replace `your_key_here` with the key you copied
4. [ ] Save the file
5. [ ] Restart your terminal/VS Code to load new environment variable

**Example `.env.local`:**
```bash
# FAL.ai
FAL_API_KEY=fal-abc123xyz...

# OpenAI (you should already have this)
OPENAI_API_KEY=sk-...

# Firebase (you should already have these)
NEXT_PUBLIC_FIREBASE_API_KEY=...
FIREBASE_STORAGE_BUCKET=vendai-fa58c.appspot.com
```

---

### Step 3: Verify Firebase Service Account (1 minute)

1. [ ] Check if `serviceAccountKey.json` exists in project root:
   ```powershell
   Test-Path serviceAccountKey.json
   ```

2. [ ] If it returns `False`, download it:
   - Go to: https://console.firebase.google.com/project/vendai-fa58c/settings/serviceaccounts/adminsdk
   - Click "Generate New Private Key"
   - Save as `serviceAccountKey.json` in project root

---

### Step 4: Install FAL.ai Package (1 minute)

Already done! ✅

```powershell
npm install @fal-ai/serverless-client
```

---

### Step 5: Test API Connection (2 minutes)

Run this command to verify FAL.ai is working:

```powershell
npx tsx scripts/test-fal-connection.ts
```

**Expected output:**
```
🧪 FAL.ai Connection Test

✅ FAL_API_KEY found: fal-abc123...

🎨 Generating test image with FLUX schnell...
   Prompt: "Professional product photo of Coca-Cola bottle on white background"

   📋 In queue (position: 1)
   ⏳ Generation in progress...

✅ SUCCESS! Image generated in 3245 ms
📊 Details:
   - Image URL: https://...
   - Size: 1024 x 1024
   - Content type: image/jpeg
   - Seed: 12345

📥 Downloading test image...
✅ Test image saved to: test-images\fal-test-coca-cola.jpg

💰 Cost: $0.003 (3/10 of a cent)

🎉 FAL.ai is working perfectly!
```

3. [ ] Open `test-images/fal-test-coca-cola.jpg` and verify quality
4. [ ] If image looks good, proceed to Step 6

**If you get errors:**
- `Missing FAL_API_KEY`: Go back to Step 2
- `401 Unauthorized`: Your API key is wrong, get a new one
- `429 Rate limit`: Wait a few minutes or add credits

---

### Step 6: Dry Run with 10 Products (1 minute)

Test the parser without generating images:

```powershell
npx tsx scripts/generate-images-fal.ts --limit 10 --dry-run
```

**Expected output:**
```
🚀 FAL.ai Distributor Image Generator
Options: { distributor: null, limit: 10, dryRun: true, skipEmbeddings: false }

📦 Parsing distributor pricelists...

✅ Parsed 5938 products from Sam West
✅ Parsed 1119 products from Mahitaji

⚠️ Limited to 10 products for testing

📊 Total products to process: 10

💰 Cost Estimate:
   FAL.ai FLUX schnell: $0.03
   vs Replicate FLUX:   $0.30
   Savings:             $0.27 (90%)

🏁 Dry run complete - no images generated

✅ Parsed products saved to: data/parsed-distributor-products.json
```

5. [ ] Verify output shows 10 products parsed
6. [ ] Check `data/parsed-distributor-products.json` to see what will be generated

---

### Step 7: Generate 10 Test Images (5 minutes)

Now generate actual images for 10 products:

```powershell
npx tsx scripts/generate-images-fal.ts --limit 10
```

**Expected output:**
```
🎨 Starting image generation...

[1/10] 10KG ABABIL PK 386 PARBOILED RICE
   ✅ Success
[2/10] 10KG AL-MAHAL BIRYANI RICE (Purple bag)
   ✅ Success
[3/10] 10KG CROWN PK 386 BASMATI RICE
   ✅ Success
...

🎉 Batch Processing Complete!
✅ Successful: 10
❌ Failed: 0
📊 Success rate: 100.0%
💰 Total cost: $0.03
```

**This will:**
- Generate 10 product images with FAL.ai
- Upload to Firebase Storage (`distributor-images/...`)
- Store metadata in Firestore (`distributor_images` collection)
- Generate OpenAI embeddings for each product
- **Total cost: $0.03 + $0.001 = ~$0.031**

---

### Step 8: Verify Results (3 minutes)

1. [ ] Check Firebase Storage:
   - Go to: https://console.firebase.google.com/project/vendai-fa58c/storage
   - Navigate to `distributor-images/`
   - You should see 10 images organized by category

2. [ ] Check Firestore:
   - Go to: https://console.firebase.google.com/project/vendai-fa58c/firestore
   - Open `distributor_images` collection
   - You should see 10 documents with rich metadata

3. [ ] Review image quality:
   - Open a few images from Firebase Storage
   - Verify they look professional and match product descriptions
   - Check background is slate gray (#1f2937) and clean

---

### Step 9: Generate More or Full Library (Optional)

If 10 test images look good:

**Option A: Test with 50 products**
```powershell
npx tsx scripts/generate-images-fal.ts --limit 50
```
Cost: $0.15 + Time: 10 minutes

**Option B: Generate full Sam West catalog** (~5,900 images)
```powershell
npx tsx scripts/generate-images-fal.ts --distributor sam-west
```
Cost: $17.70 + Time: ~2 hours

**Option C: Generate full library** (7,000 images)
```powershell
npx tsx scripts/generate-images-fal.ts
```
Cost: $21 + Time: ~3 hours

---

## 🐛 Troubleshooting

### Error: "Missing FAL_API_KEY"
```powershell
# Verify environment variable is loaded
$env:FAL_API_KEY
```
If empty, restart terminal after adding to `.env.local`

### Error: "401 Unauthorized"
- API key is invalid or expired
- Get a new key from https://fal.ai/dashboard/keys

### Error: "Rate limit exceeded"
- Free tier has rate limits (10-20 requests/minute)
- Add credits at https://fal.ai/dashboard/billing
- Or wait 5 minutes and try again

### Error: "Failed to initialize Firebase Admin"
- Check `serviceAccountKey.json` exists
- Verify it's valid JSON (open in editor)
- Re-download from Firebase Console if corrupted

### Images look wrong/blurry
- Check image URL in Firebase Storage (should be 1024x1024)
- Try regenerating with `--limit 5` to test
- Adjust prompt in `scripts/generate-images-fal.ts` if needed

---

## 📊 Progress Tracking

| Task | Status | Cost | Time |
|------|--------|------|------|
| ☐ Get FAL.ai API key | | $0 | 5 min |
| ☐ Test connection | | $0.003 | 2 min |
| ☐ Dry run (10 products) | | $0 | 1 min |
| ☐ Generate 10 test images | | $0.03 | 5 min |
| ☐ Verify results | | $0 | 3 min |
| ☐ Generate 50 more (optional) | | $0.15 | 10 min |
| ☐ Generate full library (later) | | $21 | 3 hrs |

---

## 🎯 Success Criteria

You're ready for the full generation when:

- [x] Test connection script works
- [ ] 10 test images generated successfully
- [ ] Images visible in Firebase Storage
- [ ] Metadata stored in Firestore
- [ ] Image quality looks professional
- [ ] Background color is consistent slate gray
- [ ] Products are centered and well-framed

---

## 📞 Support

**FAL.ai Issues:**
- Documentation: https://fal.ai/docs
- Discord: https://discord.gg/fal-ai
- Status page: https://status.fal.ai/

**Firebase Issues:**
- Console: https://console.firebase.google.com/project/vendai-fa58c
- Documentation: https://firebase.google.com/docs

---

**Last Updated:** October 11, 2025  
**Estimated Total Time:** 15-20 minutes  
**Estimated Test Cost:** $0.03 (3 cents)
