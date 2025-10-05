# VendAI Cloud Functions

Background jobs and triggers for the VendAI POS system.

## Functions Overview

### Credit Score Recalculation (`recalculateCreditScores`)
**Trigger:** Scheduled (every 6 hours)  
**Purpose:** Batch recalculates credit scores for all active retailers based on payment history, order volume, and credit utilization.

**Algorithm:**
- Base score: 500
- Payment behavior (40% weight): +200 points for perfect on-time rate
- Volume (30% weight): Up to +150 points based on trailing 90-day GMV
- Utilization (30% weight): +150 for low (<30%), +75 for medium (<70%), -50 for high (>70%)
- Score range: 300-850

### Payment-Triggered Credit Update (`onPaymentReceived`)
**Trigger:** Firestore `payments/{paymentId}` onCreate  
**Purpose:** Immediately updates credit metrics when a payment is received, increments consecutive on-time payment counter.

### Reconciliation Worker (`reconciliationWorker`)
**Trigger:** Scheduled (daily at 2:00 AM EAT)  
**Purpose:** Matches Purchase Orders ↔ Invoices ↔ Payments and flags mismatches in the `reconciliation_issues` collection.

**Checks:**
- PO without invoice
- Amount mismatches between PO and invoice (>1 KES tolerance)
- Payment total vs invoice amount (>1 KES tolerance)
- Missing ledger entries for paid invoices

### Overdue Invoice Reminders (`overdueInvoiceReminders`)
**Trigger:** Scheduled (daily at 9:00 AM EAT)  
**Purpose:** Sends notifications for overdue invoices (rate-limited to once per 24 hours per invoice).

**Notification channels:**
- In-app notifications (implemented)
- Email (TODO: integrate SendGrid/SES)
- SMS (TODO: integrate Africa's Talking/Twilio)

### Dispute Handler (`onDisputeCreated`)
**Trigger:** Firestore `disputes/{disputeId}` onCreate  
**Purpose:** Downgrades credit scores when disputes are raised (-50 points per dispute), adds retailer to watchlist if score drops below 500.

### Dispute Resolution Handler (`onDisputeResolved`)
**Trigger:** Firestore `disputes/{disputeId}` onUpdate  
**Purpose:** Restores credit scores when disputes are resolved in retailer's favor (+25 points).

## Deployment

### Prerequisites
```bash
npm install -g firebase-tools
firebase login
```

### Local Development
```bash
cd functions
npm install
npm run build:watch  # Watch mode

# In another terminal
npm run serve  # Start emulators
```

### Deploy to Production
```bash
cd functions
npm run deploy
```

### Deploy Specific Function
```bash
firebase deploy --only functions:recalculateCreditScores
firebase deploy --only functions:reconciliationWorker
firebase deploy --only functions:overdueInvoiceReminders
```

## Configuration

### Environment Variables
Set these in Firebase Console > Functions > Configuration:

```bash
# Email notifications (optional)
firebase functions:config:set sendgrid.api_key="SG.xxx"
firebase functions:config:set sendgrid.from_email="noreply@vendai.com"

# SMS notifications (optional)
firebase functions:config:set sms.api_key="xxx"
firebase functions:config:set sms.username="xxx"
```

## Monitoring

### View Logs
```bash
# All functions
firebase functions:log

# Specific function
firebase functions:log --only recalculateCreditScores

# Last 100 lines
firebase functions:log --limit 100
```

### Firebase Console
- Monitor function executions: https://console.firebase.google.com/project/YOUR_PROJECT/functions
- Check Cloud Scheduler: https://console.cloud.google.com/cloudscheduler

## Collections Created

### `reconciliation_issues`
Stores mismatches found by the reconciliation worker:
```typescript
{
  type: 'missing_invoice' | 'amount_mismatch' | 'payment_mismatch' | 'missing_ledger_entry',
  purchaseOrderId?: string,
  invoiceId?: string,
  description: string,
  status: 'open' | 'resolved' | 'ignored',
  createdAt: Timestamp,
  resolvedAt?: Timestamp,
  resolvedBy?: string,
  resolution?: string
}
```

### `watchlist`
Tracks retailers with low credit scores or active disputes:
```typescript
{
  retailerId: string,
  reason: string,
  creditScore: number,
  activeDisputes: number,
  addedAt: Timestamp,
  removedAt?: Timestamp,
  notes?: string
}
```

## Testing

### Trigger Functions Manually
```bash
# In Firebase console or using admin SDK
firebase functions:shell

# Then in the shell:
recalculateCreditScores()
reconciliationWorker()
overdueInvoiceReminders()
```

### Unit Tests (TODO)
```bash
npm test
```

## Performance & Costs

### Estimated Costs (per month)
- `recalculateCreditScores`: ~120 invocations/month × 2-5 min = 240-600 GB-seconds
- `reconciliationWorker`: ~30 invocations/month × 3-8 min = 90-240 GB-seconds
- `overdueInvoiceReminders`: ~30 invocations/month × 1-3 min = 30-90 GB-seconds
- Event-triggered functions: Variable based on usage

**Total estimated cost:** $5-15/month (Firebase Blaze plan)

### Optimization Tips
- Adjust schedules based on actual business needs
- Use batched writes (max 500 operations per batch)
- Monitor timeout settings and adjust as needed
- Consider using Firestore composite indexes for complex queries

## Troubleshooting

### Function Timeout
Increase timeout in function configuration:
```typescript
.runWith({
  timeoutSeconds: 540, // Max 9 minutes
  memory: '2GB'
})
```

### Memory Issues
Increase memory allocation or process data in smaller batches.

### Missing Firestore Indexes
Check logs for index creation URLs and create required composite indexes.

## Next Steps

1. ✅ Credit score recalculation - Implemented
2. ✅ Reconciliation worker - Implemented
3. ✅ Overdue invoice reminders - Implemented
4. ✅ Dispute handling - Implemented
5. 🔜 Email/SMS integration for notifications
6. 🔜 Unit and integration tests
7. 🔜 Performance monitoring and alerting

## Support

For issues or questions:
- Check Firebase Functions logs
- Review Firestore indexes
- Monitor Cloud Scheduler execution history
- Contact: dev@vendai.com
