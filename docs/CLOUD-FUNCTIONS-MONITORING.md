# Cloud Functions Monitoring Guide

## 📊 How to Monitor Your Cloud Functions

### 1. **Firebase Console** (Recommended for Quick Checks)

#### View Function Logs
1. Go to: https://console.firebase.google.com/project/vendai-fa58c/functions
2. Click on any function to see:
   - Execution count
   - Error rate
   - Execution time
   - Memory usage

#### Real-time Logs
1. Go to: https://console.firebase.google.com/project/vendai-fa58c/functions/logs
2. Filter by:
   - Function name
   - Severity (info, warning, error)
   - Time range

### 2. **Command Line Monitoring**

#### Watch Logs in Real-time
```powershell
# All functions
npx firebase-tools functions:log

# Specific function
npx firebase-tools functions:log --only recalculateCreditScores

# Follow new logs (tail)
npx firebase-tools functions:log --follow
```

#### Check Function Status
```powershell
npx firebase-tools functions:list
```

### 3. **Testing Each Function**

#### A. Credit Recalculation (Scheduled - Every 6 hours)
**Function:** `recalculateCreditScores`

**How to verify it's working:**
```powershell
# Check logs for the scheduled run
npx firebase-tools functions:log --only recalculateCreditScores

# Expected log output:
# "Credit recalculation finished" with stats: {processed, skipped, failures, duration}
```

**Manual trigger for testing:**
1. Go to Firebase Console > Functions
2. Click on `recalculateCreditScores`
3. Click "Test function" (if available) or wait for next scheduled run
4. Check Firestore `credit_profiles` collection for updated `lastAssessment` and `metrics.lastRecalculated`

**Success indicators:**
- ✅ Log shows "Credit recalculation finished"
- ✅ `processed` count > 0
- ✅ `failures` count = 0
- ✅ Credit profiles have recent `updatedAt` timestamps

#### B. Payment-Triggered Credit Update
**Function:** `onPaymentReceived`

**How to test:**
1. Create a test payment in Firestore:
```javascript
// In Firebase Console > Firestore
// Add document to 'payments' collection:
{
  retailerId: "test_retailer_123",
  amount: 50000,
  status: "paid",
  invoiceId: "INV-001",
  receivedAt: new Date(),
  createdAt: new Date()
}
```

2. Check logs:
```powershell
npx firebase-tools functions:log --only onPaymentReceived
```

**Success indicators:**
- ✅ Function executes within 2-3 seconds of payment creation
- ✅ Log shows credit recalculation for the retailer
- ✅ Credit profile updated with new assessment
- ✅ Credit history entry created

#### C. Reconciliation Worker (Scheduled - Daily at 2:00 AM)
**Function:** `reconciliationWorker`

**How to verify it's working:**
```powershell
# Check logs for the daily run
npx firebase-tools functions:log --only reconciliationWorker

# Expected log output:
# "Reconciliation completed" with stats: {processed, mismatches, backfilled, issuesResolved}
```

**Manual verification:**
1. Check Firestore collections:
   - `reconciliation_issues` - Should have records for mismatches
   - `reconciliation_events` - Should have ledger backfill events
   - `ledger_entries` - Should have new auto-generated entries

**Success indicators:**
- ✅ Log shows "Reconciliation completed"
- ✅ Purchase orders from last 30 days processed
- ✅ Ledger entries created for paid invoices without ledger records
- ✅ Mismatch issues flagged in `reconciliation_issues`

#### D. Overdue Invoice Reminders (Scheduled - Daily at 9:00 AM)
**Function:** `overdueInvoiceReminders`

**How to test with a mock overdue invoice:**
1. Create test invoice in Firestore:
```javascript
// Add document to 'invoices' collection:
{
  number: "INV-TEST-001",
  retailerId: "test_retailer_123",
  retailerUserId: "user_123",
  retailerOrgId: "org_123",
  paymentStatus: "pending",
  dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  amount: { total: 100000, currency: "KES" },
  supplierId: "supplier_123",
  supplierName: "Test Supplier",
  createdAt: new Date()
}
```

2. Check logs:
```powershell
npx firebase-tools functions:log --only overdueInvoiceReminders
```

3. Verify created records:
   - `notifications` collection - Should have new overdue notification
   - `communication_jobs` collection - Should have email/SMS jobs queued
   - Invoice should have `lastReminderSent` updated

**Success indicators:**
- ✅ Log shows "Overdue reminders completed"
- ✅ Notifications created for overdue invoices
- ✅ Email jobs queued (if retailer has email)
- ✅ SMS jobs queued (if retailer has phone)
- ✅ Invoice `reminderCount` incremented

#### E. Dispute Handlers
**Functions:** `onDisputeCreated`, `onDisputeResolved`

**How to test dispute creation:**
1. Create test dispute:
```javascript
// Add document to 'disputes' collection:
{
  retailerId: "test_retailer_123",
  invoiceId: "INV-001",
  reason: "Product quality issue",
  status: "open",
  amount: 25000,
  createdAt: new Date()
}
```

2. Check logs:
```powershell
npx firebase-tools functions:log --only onDisputeCreated
```

**How to test dispute resolution:**
1. Update the dispute status:
```javascript
// Update the dispute document:
{
  status: "resolved",
  resolvedAt: new Date()
}
```

2. Check logs:
```powershell
npx firebase-tools functions:log --only onDisputeResolved
```

**Success indicators:**
- ✅ Credit score recalculated immediately after dispute creation/resolution
- ✅ Watchlist updated if dispute rate crosses threshold
- ✅ Credit history entry created with reason "dispute_created" or "dispute_resolved"

---

## 🚨 Error Monitoring

### Common Issues to Watch For

#### 1. Missing Retailer Data
**Error:** "Skipped credit recalculation because credit profile is missing"
**Solution:** Ensure all retailers have credit profiles initialized

#### 2. Permission Errors
**Error:** "PERMISSION_DENIED" or "Missing or insufficient permissions"
**Solution:** Check Firestore rules and service account permissions

#### 3. Timeout Errors
**Error:** Function execution timeout
**Solution:** Increase timeout in function configuration (currently 540s for heavy jobs)

#### 4. Memory Errors
**Error:** "Function exceeded memory limit"
**Solution:** Increase memory allocation (currently 1GB-2GB for batch jobs)

### Alerting Setup

#### Email Alerts for Errors
1. Go to Firebase Console > Functions
2. Click on a function
3. Go to "Health" tab
4. Click "Create Alert"
5. Set conditions:
   - Error rate > 5%
   - Execution time > 30s
   - Failure rate > 10 per hour

---

## 📈 Performance Metrics to Track

### Daily Checks
- [ ] Credit recalculation: Check `processed` count matches active retailers
- [ ] Reconciliation: Check `backfilled` count for ledger entry gaps
- [ ] Reminders: Check `notificationsSent` count matches overdue invoices
- [ ] Error rate < 1% for all functions

### Weekly Reviews
- [ ] Average execution time trending down
- [ ] Memory usage stable
- [ ] Cold start times acceptable
- [ ] Communication jobs being processed (check queue depth)

### Monthly Analysis
- [ ] Total executions per function
- [ ] Cost analysis (Cloud Functions billing)
- [ ] Credit score distribution changes
- [ ] Reconciliation issue trends

---

## 🔧 Quick Troubleshooting

### Function Not Running
1. Check if function deployed successfully:
   ```powershell
   npx firebase-tools functions:list
   ```
2. Check schedule configuration in code
3. Verify timezone setting (Africa/Nairobi)

### No Logs Appearing
1. Ensure you're looking at correct project
2. Check time filter in logs viewer
3. Verify function actually executed (check "Executions" tab)

### Data Not Updating
1. Verify Firestore security rules allow function writes
2. Check for error logs
3. Confirm trigger conditions are met (e.g., payment status = 'paid')

---

## 📞 Getting Help

### Firebase Support
- Documentation: https://firebase.google.com/docs/functions
- Support: https://firebase.google.com/support

### Debug Mode
To enable verbose logging, set environment config:
```powershell
npx firebase-tools functions:config:set debug.level="verbose"
npx firebase-tools deploy --only functions
```

---

**Last Updated:** October 4, 2025
**Monitoring Status:** Active
