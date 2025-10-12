# Pezesha Credit Integration Guide

## Executive Summary

**VendAI x Pezesha Partnership**: Enabling Kenyan retailers to access up to **KES 500,000** in working capital credit through automated credit scoring and seamless disbursement.

**Date**: October 12, 2025  
**Status**: Design & Implementation Phase

---

## 🎯 Value Proposition for Retailers

### Credit Access Tiers

| Tier | Credit Limit | Requirements | Repayment Terms |
|------|-------------|--------------|-----------------|
| **Starter** | KES 50,000 - 100,000 | 30 days business history | 30 days, weekly payments |
| **Growth** | KES 100,000 - 250,000 | 90 days history, 85% on-time payment | 45 days, bi-weekly payments |
| **Scale** | KES 250,000 - 350,000 | 180 days history, 90% on-time payment | 60 days, monthly payments |
| **Elite** | KES 350,000 - 500,000 | 365 days history, 95% on-time payment | 90 days, flexible payments |

### Why This Matters
- **Cash Flow**: Buy inventory now, pay later
- **Growth**: Stock more products without depleting working capital
- **Predictability**: Fixed repayment schedules aligned with sales cycles
- **Flexibility**: Credit limits grow with your business performance

---

## 🏦 Pezesha Integration Overview

### What is Pezesha?
Pezesha is Kenya's leading embedded finance platform that enables businesses to offer credit to their customers through API integration. They handle:
- **Credit disbursement** (M-Pesa, bank transfer)
- **Repayment collection** (M-Pesa STK push, bank)
- **Compliance** (CRB reporting, KYC/AML)
- **Risk management** (fraud detection, default handling)

### Integration Points

```
VendAI Platform
    ↓
Credit Assessment Engine
    ↓
Pezesha API
    ↓
Disbursement (M-Pesa/Bank) → Retailer
    ↓
Repayment Collection ← Retailer
    ↓
Pezesha Webhook → VendAI
    ↓
Credit Limit Update
```

---

## 📊 Credit Scoring System

### VendAI Credit Score (0-100)

Our proprietary scoring algorithm evaluates retailers based on real POS data:

#### Score Components

| Component | Weight | Data Source | Max Points |
|-----------|--------|-------------|------------|
| **Sales Volume** | 30% | POS transactions (90-day trailing) | 30 |
| **Payment Behavior** | 30% | Invoice payment history | 30 |
| **Order Consistency** | 15% | Order frequency and patterns | 15 |
| **Business Tenure** | 10% | Days since signup | 10 |
| **Growth Rate** | 10% | Revenue trend (30d vs 60d vs 90d) | 10 |
| **Utilization Management** | 5% | Credit usage vs limit | 5 |

#### Penalties (Deductions)

| Penalty | Impact | Threshold |
|---------|--------|-----------|
| **Late Payments** | -2 pts per incident | Payment >7 days overdue |
| **High Credit Utilization** | -5 pts | >85% of limit used |
| **Dispute Rate** | -1 pt per 1% | Disputed orders/total orders |
| **Repayment Lag** | -0.5 pts per day | Average days beyond due date |

### Scoring Algorithm

```typescript
function calculateCreditScore(input: CreditAssessmentInput): number {
  let score = 0
  
  // 1. Sales Volume (30 points)
  const volumeScore = Math.min(30, (input.trailingVolume90d / 1000000) * 30)
  score += volumeScore
  
  // 2. Payment Behavior (30 points)
  const paymentScore = input.onTimePaymentRate * 30
  score += paymentScore
  
  // 3. Order Consistency (15 points)
  const orderScore = Math.min(15, (input.orders90d / 100) * 15)
  score += orderScore
  
  // 4. Business Tenure (10 points)
  const tenureScore = Math.min(10, (input.daysSinceSignup / 365) * 10)
  score += tenureScore
  
  // 5. Growth Rate (10 points)
  const growthScore = Math.min(10, Math.max(0, input.trailingGrowthRate * 10))
  score += growthScore
  
  // 6. Utilization Management (5 points)
  const utilizationScore = input.creditUtilization <= 0.7 ? 5 : 
                          input.creditUtilization <= 0.85 ? 3 : 0
  score += utilizationScore
  
  // Apply Penalties
  score -= (input.disputeRate * 100) // -1 per 1%
  score -= (input.repaymentLagDays * 0.5)
  score -= (100 - input.onTimePaymentRate) * 2 // -2 per late payment
  
  if (input.creditUtilization > 0.85) score -= 5
  
  // Sector risk adjustment
  if (input.sectorRisk === 'high') score *= 0.9
  if (input.sectorRisk === 'low') score *= 1.05
  
  // Manual adjustments (fraud, special circumstances)
  score += input.manualAdjustment || 0
  
  return Math.min(100, Math.max(0, score))
}
```

---

## 💰 Credit Limit Calculation

### Formula

```
Recommended Credit Limit = Base Limit × Tier Multiplier × Performance Factor
```

**Where:**
- **Base Limit** = Average 30-day sales volume
- **Tier Multiplier** = 1.1 (Starter), 1.6 (Growth), 2.1 (Scale), 2.6 (Elite)
- **Performance Factor** = Score / 70 (capped at 1.3x)

### Example Calculations

#### Example 1: Starter Retailer
- Average 30-day sales: KES 80,000
- Credit score: 45
- Tier: Starter (1.1x multiplier)
- Performance factor: 45/70 = 0.64

**Recommended Limit**: 80,000 × 1.1 × 0.64 = **KES 56,320**

#### Example 2: Growth Retailer
- Average 30-day sales: KES 200,000
- Credit score: 68
- Tier: Growth (1.6x multiplier)
- Performance factor: 68/70 = 0.97

**Recommended Limit**: 200,000 × 1.6 × 0.97 = **KES 310,400** (capped at KES 250,000 for Growth tier)

#### Example 3: Elite Retailer
- Average 30-day sales: KES 350,000
- Credit score: 92
- Tier: Elite (2.6x multiplier)
- Performance factor: 1.3 (capped)

**Recommended Limit**: 350,000 × 2.6 × 1.3 = **KES 1,183,000** (capped at KES 500,000 for Elite tier)

---

## 📈 Data Capture Requirements

### 1. POS Transaction Data (Real-time)

**What we track:**
```typescript
interface POSTransaction {
  orderId: string
  retailerId: string
  timestamp: string
  total: number
  lineItems: Array<{
    productId: string
    quantity: number
    unitPrice: number
    total: number
  }>
  paymentMethod: 'cash' | 'mpesa' | 'card'
  laneId?: string
  cashierId?: string
}
```

**Why it matters for Pezesha:**
- Daily sales volume → Credit limit calculation
- Transaction consistency → Business stability indicator
- Growth trends → Repayment capacity forecast

### 2. Supplier Invoice Data

**What we track:**
```typescript
interface SupplierInvoice {
  invoiceId: string
  retailerId: string
  supplierId: string
  issueDate: string
  dueDate: string
  totalAmount: number
  paidAmount: number
  paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue'
  paymentDate?: string
  daysOverdue?: number
}
```

**Why it matters for Pezesha:**
- Payment punctuality → On-time payment rate (30% of score)
- Days overdue → Repayment lag penalty
- Payment patterns → Credit behavior history

### 3. Inventory Replenishment Data

**What we track:**
```typescript
interface ReplenishmentOrder {
  orderId: string
  retailerId: string
  supplierId: string
  orderDate: string
  fulfillmentDate?: string
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
  }>
  paymentTerms: string // e.g., "Net 30"
  creditUsed: boolean
  totalValue: number
}
```

**Why it matters for Pezesha:**
- Order frequency → Business consistency (15% of score)
- Order size → Credit utilization patterns
- Fulfillment reliability → Dispute rate tracking

### 4. Business Profile Data

**What we track:**
```typescript
interface RetailerProfile {
  retailerId: string
  businessName: string
  kraPin: string
  phoneNumber: string
  mpesaNumber: string
  accountSignupDate: string
  primaryCategory: string
  location: {
    county: string
    subCounty: string
    gpsCoordinates?: string
  }
  ownerDetails: {
    name: string
    idNumber: string
    phoneNumber: string
  }
}
```

**Why it matters for Pezesha:**
- KRA PIN → Tax compliance verification
- Signup date → Business tenure (10% of score)
- Location → Sector risk assessment
- ID verification → KYC/AML compliance

### 5. Credit Usage Analytics

**What we track:**
```typescript
interface CreditUsageMetrics {
  retailerId: string
  currentLimit: number
  outstandingBalance: number
  availableCredit: number
  utilizationRate: number
  totalDrawdowns: number
  totalRepayments: number
  averageRepaymentDays: number
  consecutiveOnTimePayments: number
  defaultsCount: number
}
```

**Why it matters for Pezesha:**
- Utilization rate → Risk indicator (penalty if >85%)
- Repayment speed → Behavior scoring
- Default history → Major risk flag

---

## 🔄 Integration Flow

### Phase 1: Credit Application

```mermaid
Retailer Dashboard → "Apply for Credit" Button
    ↓
VendAI collects business data (auto-populated from profile)
    ↓
VendAI calculates preliminary score & limit
    ↓
Show pre-qualification: "You may qualify for up to KES X"
    ↓
Retailer confirms application
    ↓
VendAI sends data to Pezesha API
    ↓
Pezesha performs KYC/CRB check
    ↓
Pezesha returns approval decision (instant or 24-48 hours)
    ↓
VendAI notifies retailer + updates credit limit
```

### Phase 2: Credit Drawdown

```mermaid
Retailer places supplier order
    ↓
Selects "Pay with Credit" option
    ↓
VendAI checks available credit (limit - outstanding)
    ↓
If sufficient: Approve order + reserve credit
    ↓
Notify Pezesha of drawdown request
    ↓
Pezesha disburses to supplier (M-Pesa or bank)
    ↓
VendAI tracks: outstandingBalance += orderAmount
    ↓
Repayment schedule created (auto-debit dates set)
```

### Phase 3: Repayment

```mermaid
Repayment due date approaches
    ↓
VendAI sends reminder (7 days, 3 days, 1 day before)
    ↓
Auto-debit via M-Pesa STK push (if enrolled)
    OR
Manual M-Pesa payment to Pezesha paybill
    ↓
Pezesha webhook: Payment received
    ↓
VendAI updates: outstandingBalance -= paymentAmount
    ↓
VendAI recalculates credit score (reward on-time payment)
    ↓
If score improved: Offer limit increase
```

---

## 🛡️ Pezesha Compliance Requirements

### 1. KYC (Know Your Customer)

**Required Documents:**
- Business registration certificate
- KRA PIN certificate
- National ID (owner)
- Proof of business location (utility bill, lease agreement)

**VendAI's Role:**
- Collect and verify documents
- Submit to Pezesha for final validation
- Store securely (encrypted in Firestore)

### 2. CRB (Credit Reference Bureau) Check

**What Pezesha checks:**
- Existing loans and credit facilities
- Payment history across all lenders
- Negative listings (defaults, bounced checks)
- Credit score from Metropol/TransUnion

**VendAI's Role:**
- Provide retailer consent form
- Pass CRB results into credit decision
- Monitor CRB status monthly (background job)

### 3. Responsible Lending

**Debt Service Coverage Ratio (DSCR)**:
```
DSCR = Monthly Net Income / Monthly Debt Obligations

Minimum DSCR for approval: 1.5x
```

**Example**:
- Retailer monthly net income (from POS data): KES 120,000
- Proposed monthly credit repayment: KES 60,000
- DSCR = 120,000 / 60,000 = 2.0x ✅ (Above 1.5x threshold)

**VendAI's Role:**
- Calculate DSCR from POS transaction data
- Only allow credit if DSCR > 1.5x
- Warn retailer if utilization would push DSCR below 1.5x

### 4. Fraud Prevention

**Red Flags:**
- Sudden spike in transaction volume
- Multiple failed repayment attempts
- Account access from unusual locations
- Duplicate KRA PINs or ID numbers

**VendAI's Role:**
- Real-time monitoring of transaction patterns
- Alert Pezesha immediately if fraud suspected
- Freeze credit facility pending investigation

---

## 💻 Technical Implementation

### API Integration

#### 1. Credit Application Endpoint

**Request:**
```http
POST https://api.pezesha.co.ke/v1/credit/apply
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "retailer_id": "vendai_ret_12345",
  "business_name": "Mama Jane's Shop",
  "kra_pin": "A001234567P",
  "owner_id_number": "12345678",
  "phone_number": "+254712345678",
  "mpesa_number": "+254712345678",
  "requested_limit": 150000,
  "requested_term_days": 45,
  "business_tenure_days": 180,
  "monthly_revenue": 250000,
  "credit_score": 68,
  "score_breakdown": {
    "sales_volume": 25,
    "payment_behavior": 28,
    "order_consistency": 12,
    "tenure": 7,
    "growth": 8,
    "utilization": 4
  }
}
```

**Response:**
```json
{
  "application_id": "pez_app_67890",
  "status": "approved",
  "approved_limit": 150000,
  "term_days": 45,
  "interest_rate": 0.12,
  "disbursement_fee": 1500,
  "repayment_schedule": [
    {
      "due_date": "2025-11-15",
      "amount": 52500
    },
    {
      "due_date": "2025-11-30",
      "amount": 52500
    },
    {
      "due_date": "2025-12-15",
      "amount": 52500
    }
  ]
}
```

#### 2. Drawdown/Disbursement Endpoint

**Request:**
```http
POST https://api.pezesha.co.ke/v1/disbursements
Authorization: Bearer {API_KEY}

{
  "retailer_id": "vendai_ret_12345",
  "application_id": "pez_app_67890",
  "amount": 75000,
  "purpose": "Inventory purchase - Order #ORD-456",
  "beneficiary": {
    "type": "supplier",
    "name": "Sam West Distributors",
    "mpesa_number": "+254722334455",
    "account_number": "1234567890",
    "bank_code": "01"
  },
  "metadata": {
    "order_id": "ORD-456",
    "items_count": 12,
    "supplier_id": "sup_samwest"
  }
}
```

**Response:**
```json
{
  "disbursement_id": "pez_disb_78901",
  "status": "pending",
  "initiated_at": "2025-10-12T10:30:00Z",
  "expected_completion": "2025-10-12T10:35:00Z"
}
```

#### 3. Repayment Webhook

**Pezesha → VendAI:**
```http
POST https://vendai.app/api/webhooks/pezesha/repayment
X-Pezesha-Signature: {HMAC_SHA256_SIGNATURE}

{
  "event": "repayment.received",
  "disbursement_id": "pez_disb_78901",
  "retailer_id": "vendai_ret_12345",
  "amount": 26250,
  "payment_date": "2025-11-14T09:15:00Z",
  "payment_method": "mpesa",
  "transaction_ref": "QRT45678",
  "status": "completed",
  "days_to_due_date": 1
}
```

---

## 📱 User Interface Flow

### 1. Credit Dashboard (Retailer View)

**Location**: Dashboard → Credit Tab

**Components:**
- **Credit Score Badge**: Large circular gauge showing 0-100 score
- **Credit Limit Card**: Current limit, outstanding balance, available credit
- **Repayment Schedule**: Upcoming payment dates and amounts
- **Application CTA**: "Apply for Credit" or "Request Limit Increase"
- **Payment History**: List of past repayments with status

**Example UI:**
```
┌─────────────────────────────────────────┐
│  Your Credit Score: 68                  │
│  ███████░░░ Growth Tier                 │
│                                         │
│  Credit Limit: KES 150,000              │
│  Outstanding: KES 75,000                │
│  Available: KES 75,000                  │
│                                         │
│  Next Payment: KES 26,250 on Nov 15    │
│  [Pay Now] [View Schedule]              │
│                                         │
│  [Request Limit Increase]               │
└─────────────────────────────────────────┘
```

### 2. Credit Application Modal

**Trigger**: Click "Apply for Credit"

**Steps:**
1. **Pre-qualification Check**
   - Auto-fill business details
   - Show estimated limit
   - Confirm phone/M-Pesa number

2. **Document Upload**
   - Business registration
   - KRA PIN certificate
   - ID copy
   - Proof of location

3. **Terms & Consent**
   - Credit agreement (PDF)
   - CRB consent checkbox
   - Auto-debit authorization

4. **Submission**
   - "Processing..." screen
   - Email/SMS confirmation
   - Expected decision time (instant or 24-48 hours)

### 3. Order Payment Selection

**Location**: Supplier Order → Payment Method

**Options:**
- ☑️ Pay with Credit (KES 75,000 available)
- ☐ Pay on Delivery
- ☐ Bank Transfer

**When "Pay with Credit" selected:**
- Show: "KES 45,000 will be added to your outstanding balance"
- Show: "New outstanding: KES 120,000 of KES 150,000"
- Repayment schedule preview
- [Confirm Order] button

---

## 📊 Reporting & Analytics

### For Retailers

**Credit Health Dashboard:**
- Credit score trend (last 12 months)
- Utilization rate over time
- Payment punctuality score
- Tips to improve credit score

**Repayment Tracker:**
- Total borrowed vs repaid (lifetime)
- Average repayment speed
- Late payment count
- Next review date

### For VendAI (Admin)

**Credit Portfolio View:**
- Total credit disbursed
- Outstanding balance across all retailers
- Default rate by tier
- Average credit score by county

**Pezesha Reconciliation:**
- Disbursements vs repayments (daily)
- Commission earned (% of disbursements)
- CRB check costs
- Net revenue from credit program

---

## 💡 Marketing Messages for Retailers

### Homepage Banner
> **"Grow Your Business Without Cash Stress"**  
> Access up to KES 500,000 in working capital. Buy inventory today, pay later.  
> [Apply Now →]

### Email Campaign
**Subject**: You're pre-approved for KES 150,000 credit!

> Hi Mama Jane,
>
> Great news! Based on your sales performance, you qualify for up to **KES 150,000** in business credit.
>
> ✅ No collateral required  
> ✅ Approval in 24 hours  
> ✅ Flexible repayment (45 days)  
> ✅ Credit limit grows with your business
>
> Your current credit score: **68/100** (Growth Tier)
>
> [Apply Now] [Learn More]

### SMS Notification
> VendAI: Your credit limit increased to KES 200K! You can now order more inventory. Check your dashboard.

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Pezesha API credentials (sandbox)
- [ ] Create Firestore collections for credit data
- [ ] Build credit score calculation engine
- [ ] Create admin dashboard for credit management

### Phase 2: Application Flow (Weeks 3-4)
- [ ] Build credit application UI
- [ ] Integrate document upload (Firebase Storage)
- [ ] Connect Pezesha application API
- [ ] Set up webhook handlers for approvals

### Phase 3: Disbursement (Weeks 5-6)
- [ ] Add "Pay with Credit" option to order flow
- [ ] Credit limit checks before order placement
- [ ] Integrate Pezesha disbursement API
- [ ] Track outstanding balances in real-time

### Phase 4: Repayment (Weeks 7-8)
- [ ] Build repayment schedule UI
- [ ] Set up M-Pesa STK push for auto-debit
- [ ] Handle Pezesha repayment webhooks
- [ ] Credit score recalculation on payments

### Phase 5: Launch (Weeks 9-10)
- [ ] Pilot with 10 retailers
- [ ] Monitor default rates and adjust limits
- [ ] Train support team on credit queries
- [ ] Launch marketing campaign

---

## 📞 Next Steps

1. **Contact Pezesha**: Schedule onboarding call
2. **Get API Access**: Request sandbox credentials
3. **Legal Review**: Credit agreement template
4. **Pilot Selection**: Choose 10 high-performing retailers
5. **Build MVP**: Focus on application + disbursement first

---

## ❓ FAQs

**Q: Is KES 500,000 realistic?**  
A: Yes, for Elite tier retailers with 12+ months history and excellent payment records. Most retailers will start at KES 50-100K.

**Q: What's Pezesha's interest rate?**  
A: Typically 10-15% per annum, lower than traditional banks (18-25%).

**Q: Who bears default risk?**  
A: Depends on agreement structure:
- **Option A**: Pezesha bears all risk (VendAI gets fixed commission per disbursement)
- **Option B**: Shared risk (80/20 split), higher commission for VendAI

**Q: How does CRB reporting work?**  
A: Pezesha reports to Metropol/TransUnion. On-time payments improve retailer's national credit score.

---

**Document Version**: 1.0  
**Last Updated**: October 12, 2025  
**Owner**: Timothy Lidede / VendAI Team
