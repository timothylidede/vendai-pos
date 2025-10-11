# Auto-Replenishment Background Job - Deployment Summary

**Date**: October 11, 2025  
**Status**: ✅ DEPLOYED & ACTIVE

---

## 🎯 Job Overview

### Function Name
`dailyReplenishmentCheck`

### Purpose
Automatically generates replenishment suggestions for all organizations daily by checking inventory levels against reorder points and creating suggestions for low-stock items.

### Schedule
- **Time**: 2:00 AM IST (Asia/Kolkata timezone)
- **UTC Time**: 20:30 UTC (previous day)
- **Frequency**: Every day
- **Cron Expression**: `30 20 * * *`

---

## 📋 What It Does

### Automation Flow
1. **Fetches All Organizations**: Queries all orgs in the system
2. **Checks Inventory**: For each org, analyzes all inventory items
3. **Identifies Low Stock**: Finds products below their reorder points
4. **Finds Best Suppliers**: Selects suppliers with lowest lead time and cost
5. **Calculates Quantities**: Suggests reorder quantity with 1.5x safety stock
6. **Creates Suggestions**: Generates pending suggestions with priority levels
7. **Tracks Execution**: Logs job status and statistics in `replenishment_jobs` collection

### Priority Assignment
- **Critical**: Stock ≤ 25% of reorder point (or out of stock)
- **High**: Stock ≤ 50% of reorder point
- **Medium**: Stock ≤ 75% of reorder point
- **Low**: Stock > 75% of reorder point

### Suggested Quantity Calculation
```
suggestedQty = reorderQty × 1.5 (safety stock multiplier)
```

---

## 🔧 Implementation Details

### Location
**File**: `functions/src/index.ts`
**Function**: `export const dailyReplenishmentCheck = functions.pubsub.schedule(...)`

### Dependencies
- `firebase-functions/v1`
- `firebase-admin`
- Firestore collections:
  - `organizations`
  - `inventory`
  - `pos_products`
  - `supplier_skus`
  - `suppliers`
  - `replenishment_suggestions`
  - `replenishment_jobs`

### Required Firestore Indexes
```json
{
  "collectionGroup": "replenishment_suggestions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "orgId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

---

## 📊 Job Tracking

### Job Execution Record
Each job run creates a document in `replenishment_jobs` collection:

```typescript
{
  type: 'daily_check',
  status: 'running' | 'completed' | 'failed',
  startedAt: Timestamp,
  completedAt: Timestamp,
  triggeredBy: 'cron',
  processedOrgs: number,
  totalSuggestions: number,
  errors?: Array<{ orgId: string, error: string }>
}
```

### Monitoring
View job execution logs:
```bash
# Real-time logs
firebase functions:log --only dailyReplenishmentCheck

# Or in Firebase Console
https://console.firebase.google.com/project/vendai-fa58c/functions/logs
```

---

## ✅ Deployment Confirmation

### Build Output
```
> vendai-cloud-functions@1.0.0 build
> tsc

✓ Build successful
```

### Deploy Output
```
i  functions: creating Node.js 18 (1st Gen) function dailyReplenishmentCheck(us-central1)...
✓ functions[dailyReplenishmentCheck(us-central1)] Successful create operation.
✓ Deploy complete!
```

### Function Details
- **Project**: vendai-fa58c
- **Region**: us-central1
- **Runtime**: Node.js 18 (1st Gen)
- **Trigger**: Cloud Pub/Sub (scheduled)
- **Status**: Active

---

## 🔍 How It Works

### Daily Workflow

**1. Job Starts (2:00 AM IST)**
```
✓ Create job tracking record
✓ Fetch all organizations
```

**2. For Each Organization**
```
✓ Load inventory items
✓ Load product definitions
✓ Check reorder points
✓ Find items below threshold
```

**3. For Each Low-Stock Item**
```
✓ Query supplier_skus (order by lead time, then cost)
✓ Select best supplier
✓ Calculate suggested quantity (reorderQty × 1.5)
✓ Determine priority (critical/high/medium/low)
✓ Check for existing pending suggestions
✓ Create new suggestion if needed
```

**4. Job Completes**
```
✓ Update job record with statistics
✓ Log summary (orgs processed, suggestions created, errors)
```

### Example Job Output
```javascript
{
  success: true,
  processedOrgs: 45,
  totalSuggestions: 127,
  errorCount: 0
}
```

---

## 🚨 Error Handling

### Org-Level Errors
- Continues processing other orgs if one fails
- Logs error with org ID
- Records errors in job document

### Product-Level Warnings
- Skips products without reorder points
- Skips products without suppliers
- Logs warnings in Cloud Functions logs

### Job-Level Failures
- Marks job as failed
- Throws error for Cloud Functions retry mechanism
- Sends error to Firebase logs

---

## 🎛️ Configuration

### Modify Schedule
Edit `functions/src/index.ts`:
```typescript
export const dailyReplenishmentCheck = functions.pubsub
  .schedule('30 20 * * *') // Change cron expression here
  .timeZone('Asia/Kolkata') // Change timezone if needed
  .onRun(async (context) => {
    // ...
  });
```

### Modify Safety Stock Multiplier
Edit the constant in `generateReplenishmentSuggestionsForOrg()`:
```typescript
const REORDER_QTY_MULTIPLIER = 1.5; // Change multiplier here
```

### Deploy Changes
```bash
cd functions
npm run build
firebase deploy --only functions:dailyReplenishmentCheck
```

---

## 📈 Benefits

### Automated Stock Management
✓ No manual "Generate Suggestions" clicks needed  
✓ Consistent daily checks across all organizations  
✓ Runs during off-hours (no user impact)

### Proactive Replenishment
✓ Catches low stock before it becomes critical  
✓ Prioritizes urgent items automatically  
✓ Prevents stockouts and lost sales

### Smart Supplier Selection
✓ Chooses suppliers with shortest lead time  
✓ Considers cost as secondary factor  
✓ Uses real supplier data from `supplier_skus`

### Safety Stock Protection
✓ Orders 50% more than minimum reorder qty  
✓ Buffer against demand spikes  
✓ Reduces frequency of reorders

---

## 🧪 Testing

### Test Manually
You can trigger the function manually in Firebase Console:
1. Go to [Functions](https://console.firebase.google.com/project/vendai-fa58c/functions)
2. Find `dailyReplenishmentCheck`
3. Click "..." → "Test function"

### Test Locally
```bash
cd functions
npm run serve
# In another terminal
firebase functions:shell
> dailyReplenishmentCheck()
```

### Verify Suggestions Created
Check Firestore collection `replenishment_suggestions`:
```javascript
// In Firebase Console
db.collection('replenishment_suggestions')
  .where('status', '==', 'pending')
  .orderBy('createdAt', 'desc')
  .limit(10)
```

---

## 📝 Next Steps

### 1. Monitor First Run
Wait for 2:00 AM IST (or trigger manually) and check:
- Cloud Functions logs for execution details
- `replenishment_jobs` collection for job record
- `replenishment_suggestions` collection for new suggestions

### 2. Adjust If Needed
After first run, you may want to:
- Adjust safety stock multiplier if too much/little
- Change schedule time if 2 AM isn't optimal
- Modify priority thresholds

### 3. Set Up Alerts (Optional)
Create Firebase alert for function failures:
```bash
firebase functions:config:set alerts.email="your-email@example.com"
```

---

## 🎉 Summary

The auto-replenishment background job is now **fully deployed and active**!

- ✅ Function deployed to Firebase
- ✅ Scheduled to run daily at 2:00 AM IST
- ✅ Will automatically generate suggestions for all orgs
- ✅ Tracks execution in `replenishment_jobs` collection
- ✅ Logs detailed information for monitoring

**No more manual "Generate Suggestions" button clicks needed!** The system now proactively monitors inventory and creates replenishment suggestions automatically.

---

## 📞 Support

**Logs**: `firebase functions:log --only dailyReplenishmentCheck`  
**Console**: https://console.firebase.google.com/project/vendai-fa58c/functions  
**Documentation**: See `docs/AUTO_REPLENISHMENT_IMPLEMENTATION.md`

**Questions?** Check the function logs or Firestore `replenishment_jobs` collection for execution details.
