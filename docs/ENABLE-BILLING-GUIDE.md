# 🔓 How to Enable Billing for Firebase Cloud Functions

## Quick Start (5 Minutes)

### Step 1: Open Firebase Console
1. Go to your project: https://console.firebase.google.com/project/vendai-fa58c
2. Look for the **"Spark"** or **"Blaze"** plan indicator in the bottom-left corner

### Step 2: Upgrade to Blaze Plan
1. Click on **"Upgrade"** or **"Upgrade to Blaze Plan"** in the Firebase Console
   - **Direct link:** https://console.firebase.google.com/project/vendai-fa58c/usage/details

2. Or navigate manually:
   - Click ⚙️ (gear icon) in top-left
   - Select **"Usage and billing"**
   - Click **"Details & Settings"**
   - Click **"Modify Plan"**

### Step 3: Set Up Billing Account
You'll see one of these scenarios:

#### Scenario A: You Have an Existing Billing Account
- Select your existing Google Cloud billing account
- Click **"Continue"**
- Accept terms
- Click **"Purchase"**

#### Scenario B: You Need to Create a Billing Account
1. Click **"Create Billing Account"**
2. Fill in billing information:
   - **Account name:** VendAI Production (or your choice)
   - **Country:** Kenya (or your country)
   - **Payment method:** Credit/Debit Card
3. Enter card details:
   - Card number
   - Expiration date
   - CVV
   - Billing address
4. Click **"Submit and enable billing"**

### Step 4: Set Budget Alert (Recommended)
Protect yourself from unexpected charges:

1. In Firebase Console, go to: https://console.firebase.google.com/project/vendai-fa58c/usage/details
2. Click **"Set budget alerts"**
3. Configure:
   - **Monthly budget:** $10 USD (or your preferred limit)
   - **Alert thresholds:** 50%, 90%, 100%
   - **Email notifications:** Your email address
4. Click **"Save"**

---

## 💰 Cost Breakdown (Don't Worry - It's Mostly Free!)

### Cloud Functions Free Tier (Monthly)
- ✅ **2 million invocations** - FREE
- ✅ **400,000 GB-seconds** compute time - FREE
- ✅ **200,000 GHz-seconds** CPU time - FREE
- ✅ **5 GB** network egress - FREE

### Your Expected Usage (6 Functions)
Based on your implementation:

| Function | Frequency | Monthly Invocations | Cost |
|----------|-----------|---------------------|------|
| `recalculateCreditScores` | Every 6 hours | ~120 | $0 |
| `onPaymentReceived` | Per payment | ~1,000 | $0 |
| `reconciliationWorker` | Daily | ~30 | $0 |
| `overdueInvoiceReminders` | Daily | ~30 | $0 |
| `onDisputeCreated` | Per dispute | ~10 | $0 |
| `onDisputeResolved` | Per resolution | ~10 | $0 |
| **TOTAL** | | **~1,200** | **$0** |

**Estimated Monthly Cost:** $0 (well within free tier)

### When You'd Start Paying
You'd need to exceed:
- 2 million function calls per month, OR
- Process 400,000+ GB-seconds of compute

**Realistically:** Even with 100 retailers, you'll stay in free tier for months.

---

## 🛡️ Safety Measures

### 1. Budget Alerts
Set up email alerts when you approach spending limits:
- 50% of budget: Warning email
- 90% of budget: Critical alert
- 100% of budget: Urgent notification

### 2. Spending Limit (Optional)
You can set a hard cap to prevent overcharges:

1. Go to: https://console.cloud.google.com/billing/00F0AC-C72D4E-D52F71/budgets?project=vendai-fa58c
2. Click **"Create Budget"**
3. Set hard limit (e.g., $20/month)
4. Enable **"Stop billing"** when limit reached

⚠️ **Note:** This will disable functions when limit hit!

### 3. Monitor Usage Weekly
Check dashboard: https://console.firebase.google.com/project/vendai-fa58c/usage/details

Watch for:
- Unexpected spikes in invocations
- High execution times
- Unusual error rates

---

## 📋 After Enabling Billing

### 1. Wait 2-3 Minutes
Google Cloud APIs need time to propagate the billing change.

### 2. Redeploy Functions
```powershell
cd c:/Users/lided/Downloads/vendai-pos
npx firebase-tools deploy --only functions
```

### 3. Verify Deployment
```powershell
npx firebase-tools functions:list
```

**Expected output:**
```
✔ recalculateCreditScores(us-central1)
✔ onPaymentReceived(us-central1)
✔ reconciliationWorker(us-central1)
✔ overdueInvoiceReminders(us-central1)
✔ onDisputeCreated(us-central1)
✔ onDisputeResolved(us-central1)
```

### 4. Test a Function
Create a test payment in Firestore to trigger `onPaymentReceived`:

1. Go to Firestore: https://console.firebase.google.com/project/vendai-fa58c/firestore
2. Add document to `payments` collection:
   ```json
   {
     "retailerId": "test_retailer_001",
     "amount": 10000,
     "status": "paid",
     "invoiceId": "test_invoice",
     "receivedAt": "2025-10-04T10:00:00Z",
     "createdAt": "2025-10-04T10:00:00Z"
   }
   ```
3. Check logs:
   ```powershell
   npx firebase-tools functions:log --only onPaymentReceived
   ```

---

## 🚨 Troubleshooting

### Issue: "Billing account is not enabled"
**Solution:** Wait 2-3 minutes after enabling billing, then try again.

### Issue: "Credit card declined"
**Solution:** 
- Verify card has international transactions enabled
- Try a different card
- Contact your bank
- Use PayPal as alternative (if available in your country)

### Issue: "Cannot create billing account"
**Solution:**
- Ensure you're logged in with project owner account
- Check that you have permission to create billing accounts
- Try using Google Cloud Console directly: https://console.cloud.google.com/billing

### Issue: Still getting deployment errors after enabling billing
**Solution:**
```powershell
# Clear Firebase cache
npx firebase-tools logout
npx firebase-tools login

# Verify project
npx firebase-tools use vendai-fa58c

# Redeploy
npx firebase-tools deploy --only functions
```

---

## 💳 Alternative: Use Google Cloud Free Trial

If you're new to Google Cloud, you get:
- **$300 USD in free credits**
- **90 days** to use them
- No automatic charges after trial ends

### To activate:
1. Go to: https://cloud.google.com/free
2. Click **"Get started for free"**
3. Sign in with your Firebase account
4. Provide payment info (won't be charged during trial)
5. Return to Firebase Console and deploy

---

## 📞 Need Help?

### Firebase Support
- Documentation: https://firebase.google.com/docs/projects/billing
- Support: https://firebase.google.com/support/contact/billing

### Payment Issues
- Google Cloud Billing Support: https://cloud.google.com/billing/docs/how-to/get-support

### Kenyan Users
If using Kenyan credit/debit card:
- ✅ Equity Bank cards work
- ✅ KCB cards work  
- ✅ Safaricom Virtual cards work
- ⚠️ Ensure international transactions are enabled
- ⚠️ Some banks require pre-authorization for Google charges

---

## ✅ Quick Checklist

Before deployment:
- [ ] Billing enabled (Blaze plan)
- [ ] Budget alert configured ($10/month recommended)
- [ ] Payment method verified
- [ ] Waited 2-3 minutes for propagation
- [ ] Functions compiled successfully (`npm run build`)

Ready to deploy:
```powershell
npx firebase-tools deploy --only functions
```

---

**Bottom Line:** Enabling billing is required for Cloud Functions, but with your usage, you'll stay in the free tier. The Blaze plan is "pay-as-you-go" with a generous free tier, not a fixed monthly charge.

**Time to Enable:** 5 minutes
**Expected Cost:** $0/month (with your current usage)
**Worth It:** 100% YES - you need this for automated jobs!
