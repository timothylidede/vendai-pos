# ⚠️ Cloud Functions Deployment Troubleshooting

## Deployment Failed - Common Causes & Solutions

### Issue: "Failed to create function"

This happens when:

#### 1. **Billing Not Enabled** (Most Common)
Cloud Functions requires a billing account even for free tier usage.

**Solution:**
1. Go to: https://console.cloud.google.com/billing?project=vendai-fa58c
2. Link a billing account to your project
3. Redeploy:
   ```powershell
   npx firebase-tools deploy --only functions
   ```

**Note:** You won't be charged unless you exceed free tier limits:
- 2M invocations/month
- 400,000 GB-seconds compute time
- 200,000 CPU-seconds

#### 2. **APIs Not Fully Enabled**
Some required APIs may need manual enabling.

**Solution:**
Enable these APIs manually:
1. Cloud Functions API: https://console.cloud.google.com/apis/library/cloudfunctions.googleapis.com?project=vendai-fa58c
2. Cloud Build API: https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=vendai-fa58c
3. Cloud Scheduler API: https://console.cloud.google.com/apis/library/cloudscheduler.googleapis.com?project=vendai-fa58c
4. Artifact Registry API: https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com?project=vendai-fa58c

After enabling, wait 2-3 minutes then redeploy.

#### 3. **Permissions Issue**
Your Firebase account may not have owner/editor permissions.

**Solution:**
1. Go to: https://console.cloud.google.com/iam-admin/iam?project=vendai-fa58c
2. Ensure your account has "Editor" or "Owner" role
3. If not, contact project owner to grant permissions

#### 4. **Region Availability**
Functions might not be available in the selected region.

**Solution:**
The functions are deploying to `us-central1` which should work. If issues persist, you can change region in `functions/src/index.ts`:
```typescript
// Add region specification
export const recalculateCreditScores = functions
  .region('us-central1')  // or try 'europe-west1', 'asia-east1'
  .runWith({...})
  ...
```

---

## Quick Diagnostic Steps

### 1. Check Billing Status
```powershell
# Open browser to billing page
start https://console.cloud.google.com/billing?project=vendai-fa58c
```

### 2. Check API Status
```powershell
# Open Cloud Console APIs page
start https://console.cloud.google.com/apis/dashboard?project=vendai-fa58c
```

### 3. Check IAM Permissions
```powershell
# Open IAM page
start https://console.cloud.google.com/iam-admin/iam?project=vendai-fa58c
```

### 4. Try Deploying One Function at a Time
```powershell
# Test with just one function
npx firebase-tools deploy --only functions:onPaymentReceived
```

---

## Alternative: Local Testing First

If deployment continues to fail, you can test functions locally:

### Setup Local Emulator
```powershell
# Install emulators
npx firebase-tools setup:emulators:firestore
npx firebase-tools setup:emulators:functions

# Start emulators
npx firebase-tools emulators:start
```

### Test Functions Locally
1. Functions will run on `http://localhost:5001`
2. Firestore emulator on `http://localhost:8080`
3. Test payment triggers by adding documents to emulated Firestore
4. View logs in terminal

---

## After Fixing Billing/Permissions

### Redeploy All Functions
```powershell
cd c:/Users/lided/Downloads/vendai-pos
npx firebase-tools deploy --only functions
```

### Expected Success Output
```
✔  functions[recalculateCreditScores]: Successful create operation.
✔  functions[onPaymentReceived]: Successful create operation.
✔  functions[reconciliationWorker]: Successful create operation.
✔  functions[overdueInvoiceReminders]: Successful create operation.
✔  functions[onDisputeCreated]: Successful create operation.
✔  functions[onDisputeResolved]: Successful create operation.

✔  Deploy complete!
```

---

## Contact Information

If issues persist after enabling billing and APIs:

**Firebase Support:**
- https://firebase.google.com/support/contact/troubleshooting

**Check Status Page:**
- https://status.firebase.google.com

---

**Most Likely Fix:** Enable billing on the project, then redeploy. This is required for Cloud Functions even though you're on the free tier.
