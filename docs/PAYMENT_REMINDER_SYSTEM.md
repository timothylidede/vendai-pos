# Payment Reminder System

Automated payment reminder and overdue notification system for VendAI credit repayments.

## Overview

The payment reminder system consists of three Firebase Cloud Functions that run on scheduled intervals:

1. **sendPaymentReminders** - Sends reminders 7, 3, and 1 days before payment due dates
2. **sendOverdueNotifications** - Sends overdue alerts on days 1, 3, 7, 14, 21, 28 after due date
3. **processCommunicationJobs** - Processes queued SMS/email jobs every 10 minutes

## Architecture

```
┌─────────────────────┐
│  Firebase Scheduler │
│   (PubSub Cron)     │
└──────────┬──────────┘
           │
           ├─→ sendPaymentReminders (Daily 8 AM)
           ├─→ sendOverdueNotifications (Daily 9 AM)
           └─→ processCommunicationJobs (Every 10 min)
                    │
                    ├─→ Query repayment_schedules
                    ├─→ Create communication_jobs
                    └─→ Send SMS/Email via providers
```

## Schedule

- **Payment Reminders**: Daily at 8:00 AM EAT
- **Overdue Notifications**: Daily at 9:00 AM EAT
- **Job Processor**: Every 10 minutes

## Reminder Timing

### Pre-Due Reminders
- **7 days before**: First reminder (normal priority)
- **3 days before**: Second reminder (normal priority)
- **1 day before**: Final reminder (high priority)

### Overdue Notifications
- **Day 1**: Immediate overdue alert
- **Day 3**: Second overdue notice
- **Day 7**: Credit limit freeze warning
- **Day 14**: Escalation notice (urgent)
- **Day 21**: Collections warning
- **Day 28**: Final notice

## Communication Channels

Each reminder/notification is sent via:
- **SMS**: Short urgent message with payment amount and due date
- **Email**: Detailed HTML email with payment instructions and consequences

## Firestore Schema

### Collection: `communication_jobs`

```typescript
{
  type: 'payment_reminder' | 'overdue_notification',
  channel: 'sms_and_email' | 'sms' | 'email',
  priority: 'urgent' | 'high' | 'normal',
  status: 'pending' | 'processing' | 'completed' | 'failed',
  data: {
    retailerId: string,
    organizationId: string,
    repaymentScheduleId: string,
    installmentNumber: number,
    dueDate: Date,
    totalAmount: number,
    retailerName?: string,
    retailerEmail?: string,
    retailerPhone?: string,
    daysUntilDue?: number,  // for reminders
    daysOverdue?: number,   // for overdue
    outstandingAmount?: number, // for overdue
  },
  createdAt: Timestamp,
  scheduledFor: Timestamp,
  processingAt?: Timestamp,
  completedAt?: Timestamp,
  failedAt?: Timestamp,
  error?: string,
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Set Environment Variables

```bash
# In functions/.env
AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_USERNAME=your_username
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@vendai.app
```

### 3. Configure SMS Provider

The system is designed to work with AfricasTalking for SMS. To integrate:

```typescript
// In functions/src/index.ts - processCommunicationJobs function
import * as AfricasTalking from 'africastalking';

const africastalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY!,
  username: process.env.AFRICASTALKING_USERNAME!,
});

// Send SMS
await africastalking.SMS.send({
  to: [job.data.retailerPhone],
  message: generateReminderSMS(job.data),
  from: 'VendAI',
});
```

### 4. Configure Email Provider

The system uses SendGrid for email. To integrate:

```typescript
import * as sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

// Send email
await sgMail.send({
  to: job.data.retailerEmail,
  from: process.env.SENDGRID_FROM_EMAIL!,
  subject: generateReminderEmailSubject(job.data),
  html: generateReminderEmailBody(job.data),
});
```

### 5. Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:sendPaymentReminders
```

### 6. Monitor Functions

```bash
# View logs
firebase functions:log

# View specific function logs
firebase functions:log --only sendPaymentReminders
```

## Testing

### Test Payment Reminders Locally

```bash
# Run function shell
cd functions
npm run shell

# Test reminder function
sendPaymentReminders()
```

### Test with Sample Data

Create a test repayment schedule with a due date 7 days from now:

```typescript
const testSchedule = {
  retailerId: 'test_retailer',
  organizationId: 'test_org',
  installmentNumber: 1,
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  totalAmount: 50000,
  principalAmount: 45000,
  interestAmount: 5000,
  status: 'pending',
};

await db
  .collection('organizations')
  .doc('test_org')
  .collection('repayment_schedules')
  .add(testSchedule);
```

## Message Templates

Message templates are defined in `communication-templates.ts` and support:

### SMS Templates
- Payment reminder SMS (160 characters max)
- Overdue notification SMS (160 characters max)

### Email Templates
- HTML-formatted reminder emails with payment instructions
- HTML-formatted overdue emails with consequences and urgency indicators

## Cost Estimation

### SMS Costs (AfricasTalking Kenya rates)
- KES 0.80 per SMS
- 100 retailers × 3 reminders/month = KES 240/month
- 100 retailers × 2 overdue/month = KES 160/month
- **Total**: ~KES 400/month for 100 retailers

### Email Costs (SendGrid)
- Free tier: 100 emails/day
- Essential plan: $19.95/month for 50,000 emails
- **Total**: Free for <100 retailers

### Firebase Costs
- Cloud Functions: First 2M invocations free
- ~10 invocations/day = ~300/month
- **Total**: Free tier

## Monitoring & Alerts

### Key Metrics to Monitor
1. **Reminder Success Rate**: % of reminders successfully sent
2. **Job Processing Time**: Time to process communication queue
3. **Bounce Rate**: % of emails/SMS that failed
4. **Response Rate**: % of retailers who pay after reminder

### Set Up Alerts

```bash
# Create alert for failed jobs
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="Payment Reminder Failures" \
  --condition-display-name="High failure rate" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=300s
```

## Troubleshooting

### Function Not Running
```bash
# Check function status
firebase functions:list

# Check scheduler
gcloud scheduler jobs list

# View recent logs
firebase functions:log --only sendPaymentReminders --limit 50
```

### SMS Not Sending
1. Verify AfricasTalking API key is valid
2. Check phone number format (254XXXXXXXXX)
3. Verify SMS balance in AfricasTalking dashboard
4. Check function logs for errors

### Email Not Sending
1. Verify SendGrid API key is valid
2. Check sender email is verified in SendGrid
3. Review SendGrid activity log
4. Check spam folder

## Production Considerations

### Scaling
- Current setup handles ~1,000 retailers with <100 function invocations/day
- For >10,000 retailers, consider:
  - Batch processing in smaller chunks
  - Rate limiting SMS/email sends
  - Implementing exponential backoff for retries

### Security
- Store API keys in Firebase Functions config or Secret Manager
- Implement HMAC signature verification for webhooks
- Use VPC connectors for private API access

### Compliance
- Include opt-out mechanism for SMS/email
- Store communication logs for audit trail
- Follow GDPR/data protection regulations for customer data

## Future Enhancements

1. **Multi-language Support**: SMS/email templates in Swahili
2. **WhatsApp Integration**: Use WhatsApp Business API for richer messages
3. **Smart Timing**: Send reminders at optimal times based on retailer behavior
4. **A/B Testing**: Test different message templates for better response rates
5. **Predictive Alerts**: Send proactive reminders to retailers likely to miss payments

## Support

For issues or questions:
- Email: dev@vendai.app
- Slack: #credit-system
- Documentation: https://docs.vendai.app/credit/reminders
