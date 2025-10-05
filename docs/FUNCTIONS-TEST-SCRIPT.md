# 🧪 Cloud Functions Test Script

## Quick Verification After Deployment

### 1. List All Deployed Functions
```powershell
npx firebase-tools functions:list
```

**Expected Output:**
```
✔ recalculateCreditScores(us-central1)
✔ onPaymentReceived(us-central1)
✔ reconciliationWorker(us-central1)
✔ overdueInvoiceReminders(us-central1)
✔ onDisputeCreated(us-central1)
✔ onDisputeResolved(us-central1)
```

---

### 2. Test Payment Trigger (Easiest to Test)

#### Create Test Payment in Firestore Console:
1. Go to: https://console.firebase.google.com/project/vendai-fa58c/firestore
2. Navigate to `payments` collection (create if doesn't exist)
3. Click **"Add document"**
4. Use auto-ID or enter: `test_payment_001`
5. Add these fields:
   ```json
   {
     "retailerId": "test_retailer_123",
     "amount": 50000,
     "status": "paid",
     "invoiceId": "test_invoice_001",
     "receivedAt": "2025-10-04T10:00:00Z",
     "createdAt": "2025-10-04T10:00:00Z"
   }
   ```
6. Click **"Save"**

#### Watch the Function Execute:
```powershell
# Watch logs in real-time
npx firebase-tools functions:log --only onPaymentReceived --follow
```

#### Verify It Worked:
- Check `credit_profiles` collection for updated data
- Check `credit_history` subcollection for new entry
- Look for "Credit recalculation" in logs

---

### 3. Test Dispute Creation Trigger

#### Create Test Dispute:
1. Go to Firestore: https://console.firebase.google.com/project/vendai-fa58c/firestore
2. Navigate to `disputes` collection
3. Add document with fields:
   ```json
   {
     "retailerId": "test_retailer_123",
     "invoiceId": "test_invoice_001",
     "reason": "Product quality issue",
     "status": "open",
     "amount": 25000,
     "createdAt": "2025-10-04T10:00:00Z"
   }
   ```

#### Watch Logs:
```powershell
npx firebase-tools functions:log --only onDisputeCreated --follow
```

---

### 4. Check Scheduled Jobs

The cron jobs won't run immediately, but you can verify they're scheduled:

#### View Firebase Console:
1. Go to: https://console.firebase.google.com/project/vendai-fa58c/functions
2. Click on `recalculateCreditScores`
3. Look for **"Trigger"** section showing "Scheduled (every 6 hours)"

#### Check Cloud Scheduler:
1. Go to: https://console.cloud.google.com/cloudscheduler?project=vendai-fa58c
2. You should see 3 scheduled jobs:
   - `recalculateCreditScores` - every 6 hours
   - `reconciliationWorker` - daily at 02:00
   - `overdueInvoiceReminders` - daily at 09:00

---

### 5. Watch All Functions in Real-Time
```powershell
# See all function executions as they happen
npx firebase-tools functions:log --follow
```

---

### 6. Manually Trigger a Scheduled Function (Testing Only)

You can't directly trigger scheduled functions via CLI, but you can:

#### Option A: Use Firebase Console
1. Go to: https://console.firebase.google.com/project/vendai-fa58c/functions
2. Click on function name (e.g., `recalculateCreditScores`)
3. Click **"Logs"** tab
4. Wait for next scheduled run OR...

#### Option B: Use Cloud Scheduler
1. Go to: https://console.cloud.google.com/cloudscheduler?project=vendai-fa58c
2. Find the job (e.g., `firebase-schedule-recalculateCreditScores-us-central1`)
3. Click ⋮ (three dots)
4. Click **"Force run"**

---

## 🎯 Success Checklist

After deployment completes, verify:

- [ ] All 6 functions appear in `functions:list`
- [ ] Payment trigger fires when you add a payment document
- [ ] Dispute trigger fires when you add a dispute document
- [ ] Credit profiles get updated after triggers
- [ ] Scheduled jobs appear in Cloud Scheduler
- [ ] No errors in function logs

---

## 📊 Monitor Function Health

### Check Function Metrics:
```powershell
# View recent executions
npx firebase-tools functions:log | Select-Object -First 20
```

### Check for Errors:
```powershell
# Filter for errors only
npx firebase-tools functions:log | Select-String "ERROR"
```

### View in Console:
https://console.firebase.google.com/project/vendai-fa58c/functions

Look for:
- ✅ Green checkmarks (no errors)
- 📊 Execution count > 0 (functions are running)
- ⏱️ Execution time < 10s (good performance)

---

## 🚨 Troubleshooting

### Function Shows but Won't Trigger
- Wait 2-3 minutes after deployment for cold start
- Check Firestore rules allow function writes
- Verify trigger conditions match (e.g., payment status = 'paid')

### No Logs Appearing
- Ensure you're watching the correct function name
- Check time filter (default is last hour)
- Try adding a test document to trigger the function

### Scheduled Jobs Not Running
- Check timezone configuration (should be Africa/Nairobi)
- Verify Cloud Scheduler is enabled
- Check next run time in Cloud Scheduler console

---

## 📞 Quick Links

- **Functions Dashboard:** https://console.firebase.google.com/project/vendai-fa58c/functions
- **Real-time Logs:** https://console.firebase.google.com/project/vendai-fa58c/functions/logs
- **Cloud Scheduler:** https://console.cloud.google.com/cloudscheduler?project=vendai-fa58c
- **Firestore Console:** https://console.firebase.google.com/project/vendai-fa58c/firestore

---

**Pro Tip:** Keep `npx firebase-tools functions:log --follow` running in a terminal to see all function activity in real-time!
