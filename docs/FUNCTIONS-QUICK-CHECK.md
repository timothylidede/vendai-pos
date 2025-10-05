# 🚀 Quick Reference: Cloud Functions Status Check

## Instant Health Check Commands

### 1. Check if Functions are Deployed
```powershell
npx firebase-tools functions:list
```
**Expected output:**
- ✅ `recalculateCreditScores` - SCHEDULED (every 6 hours)
- ✅ `onPaymentReceived` - FIRESTORE TRIGGER (payments/{id})
- ✅ `reconciliationWorker` - SCHEDULED (daily 02:00)
- ✅ `overdueInvoiceReminders` - SCHEDULED (daily 09:00)
- ✅ `onDisputeCreated` - FIRESTORE TRIGGER (disputes/{id})
- ✅ `onDisputeResolved` - FIRESTORE TRIGGER (disputes/{id})

### 2. Watch Live Logs
```powershell
# All functions (tail mode)
npx firebase-tools functions:log --follow

# Specific function
npx firebase-tools functions:log --only recalculateCreditScores --follow
```

### 3. Quick Test Each Function

#### Test Credit Recalculation
```powershell
# Create a test payment in Firestore Console
# Then watch the trigger fire:
npx firebase-tools functions:log --only onPaymentReceived --follow
```

#### Check Scheduled Job History
```powershell
# See if cron jobs ran
npx firebase-tools functions:log --only recalculateCreditScores | Select-Object -First 50
```

---

## 📊 Firebase Console URLs

**Functions Dashboard:**
https://console.firebase.google.com/project/vendai-fa58c/functions

**Real-time Logs:**
https://console.firebase.google.com/project/vendai-fa58c/functions/logs

**Firestore Data:**
https://console.firebase.google.com/project/vendai-fa58c/firestore

---

## ✅ Success Indicators

### Credit Recalculation Working
- [ ] Logs show "Credit recalculation finished"
- [ ] `credit_profiles` collection has recent updates
- [ ] `credit_history` subcollection has new entries
- [ ] `watchlist` collection updated based on scores

### Reconciliation Working
- [ ] Logs show "Reconciliation completed"
- [ ] `ledger_entries` collection has auto-generated entries
- [ ] `reconciliation_issues` collection has mismatch records
- [ ] `reconciliation_events` collection has backfill events

### Reminders Working
- [ ] Logs show "Overdue reminders completed"
- [ ] `notifications` collection has overdue alerts
- [ ] `communication_jobs` collection has email/SMS jobs
- [ ] Invoices have `lastReminderSent` updated

### Dispute Handling Working
- [ ] Dispute creation triggers credit recalculation
- [ ] Credit scores decrease when disputes filed
- [ ] Credit scores restore when disputes resolved
- [ ] `credit_history` shows dispute-triggered changes

---

## 🚨 Immediate Alerts

### If You See Zero Executions
1. Check if cron scheduler is enabled:
   ```powershell
   # Cloud Scheduler API must be enabled
   # Check in: https://console.cloud.google.com/apis/library/cloudscheduler.googleapis.com?project=vendai-fa58c
   ```

2. Manually trigger a test:
   - Create a payment document in Firestore
   - Should trigger `onPaymentReceived` within seconds

### If You See Errors
```powershell
# Filter error logs only
npx firebase-tools functions:log --only recalculateCreditScores | Select-String "ERROR"
```

---

## 🔄 Next Cron Job Times (Africa/Nairobi Timezone)

**Credit Recalculation:** Next runs at 02:00, 08:00, 14:00, 20:00 EAT daily

**Reconciliation Worker:** Next runs at 02:00 EAT daily

**Overdue Reminders:** Next runs at 09:00 EAT daily

---

## 📞 Emergency Commands

### Stop All Functions (if needed)
```powershell
# Delete all functions
npx firebase-tools functions:delete recalculateCreditScores
npx firebase-tools functions:delete onPaymentReceived
npx firebase-tools functions:delete reconciliationWorker
npx firebase-tools functions:delete overdueInvoiceReminders
npx firebase-tools functions:delete onDisputeCreated
npx firebase-tools functions:delete onDisputeResolved
```

### Redeploy Specific Function
```powershell
# If one function has issues, redeploy just that one:
npx firebase-tools deploy --only functions:recalculateCreditScores
```

---

**Save this file for quick reference!**
