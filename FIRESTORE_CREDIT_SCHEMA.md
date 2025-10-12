# Firestore Credit System Schema

## Collections Overview

```
/organizations/{orgId}/
  /credit_applications/
  /credit_facilities/
  /credit_disbursements/
  /repayment_schedules/
  /credit_scores/
```

---

## 1. credit_applications

**Path**: `/organizations/{orgId}/credit_applications/{applicationId}`

### Document Structure

```typescript
interface CreditApplication {
  // Identifiers
  id: string
  applicationId: string // From Pezesha
  retailerId: string
  organizationId: string
  
  // Status
  status: 'draft' | 'submitted' | 'pending' | 'under_review' | 'approved' | 'rejected'
  submittedAt: Timestamp | null
  reviewedAt: Timestamp | null
  approvedAt: Timestamp | null
  
  // Business Information
  business: {
    name: string
    registrationNumber: string
    kraPinNumber: string
    email: string
    phone: string
    address: string
    industry: string
    businessType: 'sole_proprietor' | 'partnership' | 'limited' | 'cooperative'
  }
  
  // Owner Information
  owner: {
    name: string
    idNumber: string
    phone: string
    email: string
    dateOfBirth: string
    nationality: string
  }
  
  // Credit Request
  creditRequest: {
    amount: number
    currency: 'KES'
    purpose: string
    requestedTenorDays: number
  }
  
  // Credit Assessment
  creditAssessment: {
    score: number
    breakdown: {
      sales: number
      payments: number
      consistency: number
      tenure: number
      growth: number
      utilization: number
    }
    tier: 'starter' | 'growth' | 'scale' | 'elite'
    recommendedLimit: number
  }
  
  // Financial Metrics
  financialMetrics: {
    monthlySalesVolume: number
    averageOrderValue: number
    orderFrequency: number
    businessTenureDays: number
    outstandingBalance: number
    existingCreditLimit: number
  }
  
  // Documents (Firebase Storage URLs)
  documents: {
    kraPin: string | null
    businessCertificate: string | null
    ownerId: string | null
    bankStatement: string | null
    proofOfAddress: string | null
  }
  
  // Consent & Signatures
  consent: {
    kyc: boolean
    crb: boolean
    dataSharing: boolean
    termsAndConditions: boolean
    autoDebit: boolean
    timestamp: Timestamp
    ipAddress: string
    signature: string | null
  }
  
  // Pezesha Response
  pezeshaResponse: {
    approvedAmount: number | null
    creditLimit: number | null
    interestRate: number | null
    tenorDays: number | null
    rejectionReason: string | null
    nextReviewDate: Timestamp | null
    message: string | null
  } | null
  
  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
  updatedBy: string
}
```

### Indexes

```json
{
  "collectionGroup": "credit_applications",
  "indexes": [
    {
      "fields": [
        {"fieldPath": "retailerId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "submittedAt", "order": "DESCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "organizationId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "createdAt", "order": "DESCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "creditAssessment.score", "order": "DESCENDING"}
      ]
    }
  ]
}
```

---

## 2. credit_facilities

**Path**: `/organizations/{orgId}/credit_facilities/{facilityId}`

### Document Structure

```typescript
interface CreditFacility {
  // Identifiers
  id: string
  facilityId: string
  retailerId: string
  organizationId: string
  applicationId: string // Link to credit_applications
  
  // Credit Details
  approvedAmount: number
  currency: 'KES'
  interestRate: number // Annual percentage
  tenorDays: number
  
  // Balances
  totalDisbursed: number
  totalRepaid: number
  outstandingBalance: number
  availableCredit: number
  creditUtilization: number // Percentage (0-100)
  
  // Status
  status: 'active' | 'suspended' | 'closed' | 'defaulted' | 'expired'
  activatedAt: Timestamp
  expiryDate: Timestamp
  lastDisbursementAt: Timestamp | null
  lastRepaymentAt: Timestamp | null
  
  // Pezesha Integration
  pezeshaFacilityId: string
  pezeshaStatus: string
  
  // Credit Limit History
  limitHistory: Array<{
    previousLimit: number
    newLimit: number
    reason: string
    changedAt: Timestamp
    changedBy: string
  }>
  
  // Performance Metrics
  metrics: {
    totalDisbursements: number
    successfulRepayments: number
    lateRepayments: number
    averageRepaymentLagDays: number
    currentStreak: number // Consecutive on-time payments
    longestStreak: number
  }
  
  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Indexes

```json
{
  "collectionGroup": "credit_facilities",
  "indexes": [
    {
      "fields": [
        {"fieldPath": "retailerId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "organizationId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "creditUtilization", "order": "DESCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "expiryDate", "order": "ASCENDING"}
      ]
    }
  ]
}
```

---

## 3. credit_disbursements

**Path**: `/organizations/{orgId}/credit_disbursements/{disbursementId}`

### Document Structure

```typescript
interface CreditDisbursement {
  // Identifiers
  id: string
  disbursementId: string
  facilityId: string // Link to credit_facilities
  retailerId: string
  organizationId: string
  
  // Disbursement Details
  amount: number
  currency: 'KES'
  purpose: string
  referenceNumber: string
  
  // Recipient Information
  recipient: {
    type: 'supplier' | 'retailer' | 'other'
    id: string | null // supplierId if type=supplier
    name: string
    phone: string
    bankAccount: {
      accountNumber: string
      bankCode: string
      accountName: string
    } | null
  }
  
  // Status & Tracking
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  requestedAt: Timestamp
  processedAt: Timestamp | null
  completedAt: Timestamp | null
  failedAt: Timestamp | null
  
  // Pezesha Integration
  pezeshaDisbursementId: string | null
  pezeshaTransactionRef: string | null
  pezeshaStatus: string | null
  
  // Related Order (if applicable)
  relatedOrder: {
    orderId: string
    orderNumber: string
    supplierId: string
  } | null
  
  // Repayment Terms
  repaymentDueDate: Timestamp
  repaymentAmount: number // Principal + interest
  interestAmount: number
  principalAmount: number
  
  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
  
  // Error Handling
  error: {
    code: string
    message: string
    timestamp: Timestamp
  } | null
}
```

### Indexes

```json
{
  "collectionGroup": "credit_disbursements",
  "indexes": [
    {
      "fields": [
        {"fieldPath": "retailerId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "requestedAt", "order": "DESCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "facilityId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "organizationId", "order": "ASCENDING"},
        {"fieldPath": "repaymentDueDate", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "relatedOrder.orderId", "order": "ASCENDING"}
      ]
    }
  ]
}
```

---

## 4. repayment_schedules

**Path**: `/organizations/{orgId}/repayment_schedules/{scheduleId}`

### Document Structure

```typescript
interface RepaymentSchedule {
  // Identifiers
  id: string
  scheduleId: string
  facilityId: string
  disbursementId: string
  retailerId: string
  organizationId: string
  
  // Schedule Details
  totalAmount: number
  principalAmount: number
  interestAmount: number
  currency: 'KES'
  
  // Due Date
  dueDate: Timestamp
  remindersSent: number
  lastReminderAt: Timestamp | null
  
  // Status
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'defaulted' | 'waived'
  
  // Payment Tracking
  amountPaid: number
  amountOutstanding: number
  payments: Array<{
    paymentId: string
    amount: number
    method: 'mpesa' | 'bank_transfer' | 'auto_debit'
    transactionRef: string
    paidAt: Timestamp
    notes: string | null
  }>
  
  // Overdue Tracking
  daysOverdue: number
  overdueAt: Timestamp | null
  lateFees: number
  
  // Pezesha Integration
  pezeshaScheduleId: string | null
  pezeshaRepaymentIds: string[]
  
  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
  paidAt: Timestamp | null
}
```

### Indexes

```json
{
  "collectionGroup": "repayment_schedules",
  "indexes": [
    {
      "fields": [
        {"fieldPath": "retailerId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "dueDate", "order": "ASCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "facilityId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "organizationId", "order": "ASCENDING"},
        {"fieldPath": "dueDate", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "daysOverdue", "order": "DESCENDING"}
      ]
    }
  ]
}
```

---

## 5. credit_scores

**Path**: `/organizations/{orgId}/credit_scores/{scoreId}`

### Document Structure

```typescript
interface CreditScore {
  // Identifiers
  id: string
  retailerId: string
  organizationId: string
  
  // Score
  score: number // 0-100
  previousScore: number | null
  scoreDelta: number
  
  // Breakdown (6-component system)
  breakdown: {
    sales: number        // 30 points max
    payments: number     // 30 points max
    consistency: number  // 15 points max
    tenure: number       // 10 points max
    growth: number       // 10 points max
    utilization: number  // 5 points max
  }
  
  // Tier
  tier: 'starter' | 'growth' | 'scale' | 'elite'
  previousTier: string | null
  
  // Credit Limits
  recommendedLimit: number
  currentLimit: number
  limitDelta: number
  
  // Input Snapshot
  inputData: {
    trailingVolume90d: number
    trailingGrowthRate: number
    orders90d: number
    averageOrderValue: number
    onTimePaymentRate: number
    disputeRate: number
    repaymentLagDays: number
    creditUtilization: number
    currentOutstanding: number
    consecutiveOnTimePayments: number
    daysSinceSignup: number
  }
  
  // Alerts & Flags
  alerts: string[]
  watchlist: boolean
  upgradeCandidate: boolean
  
  // Review
  nextReviewDate: Timestamp
  lastReviewDate: Timestamp
  
  // Metadata
  calculatedAt: Timestamp
  validUntil: Timestamp
  version: string // Credit engine version
}
```

### Indexes

```json
{
  "collectionGroup": "credit_scores",
  "indexes": [
    {
      "fields": [
        {"fieldPath": "retailerId", "order": "ASCENDING"},
        {"fieldPath": "calculatedAt", "order": "DESCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "organizationId", "order": "ASCENDING"},
        {"fieldPath": "score", "order": "DESCENDING"},
        {"fieldPath": "calculatedAt", "order": "DESCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "tier", "order": "ASCENDING"},
        {"fieldPath": "score", "order": "DESCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "watchlist", "order": "ASCENDING"},
        {"fieldPath": "score", "order": "ASCENDING"}
      ]
    },
    {
      "fields": [
        {"fieldPath": "upgradeCandidate", "order": "DESCENDING"},
        {"fieldPath": "score", "order": "DESCENDING"}
      ]
    }
  ]
}
```

---

## Security Rules

### Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Credit Applications
    match /organizations/{orgId}/credit_applications/{applicationId} {
      // Retailers can read their own applications
      allow read: if request.auth != null && 
                     (request.auth.uid == resource.data.retailerId ||
                      hasRole('admin') ||
                      hasRole('credit_manager'));
      
      // Only retailers and admins can create applications
      allow create: if request.auth != null && 
                       (request.auth.uid == request.resource.data.retailerId ||
                        hasRole('admin'));
      
      // Only admins can update applications
      allow update: if request.auth != null && 
                       (hasRole('admin') || hasRole('credit_manager'));
      
      // Only admins can delete
      allow delete: if request.auth != null && hasRole('admin');
    }
    
    // Credit Facilities
    match /organizations/{orgId}/credit_facilities/{facilityId} {
      // Retailers can read their own facilities
      allow read: if request.auth != null && 
                     (request.auth.uid == resource.data.retailerId ||
                      hasRole('admin') ||
                      hasRole('credit_manager') ||
                      hasRole('finance'));
      
      // Only admins can write
      allow write: if request.auth != null && 
                      (hasRole('admin') || hasRole('credit_manager'));
    }
    
    // Credit Disbursements
    match /organizations/{orgId}/credit_disbursements/{disbursementId} {
      // Retailers and suppliers can read their own disbursements
      allow read: if request.auth != null && 
                     (request.auth.uid == resource.data.retailerId ||
                      request.auth.uid == resource.data.recipient.id ||
                      hasRole('admin') ||
                      hasRole('finance'));
      
      // Retailers can create, admins can update
      allow create: if request.auth != null && 
                       request.auth.uid == request.resource.data.retailerId;
      allow update: if request.auth != null && 
                       (hasRole('admin') || hasRole('finance'));
      allow delete: if request.auth != null && hasRole('admin');
    }
    
    // Repayment Schedules
    match /organizations/{orgId}/repayment_schedules/{scheduleId} {
      // Retailers can read their own schedules
      allow read: if request.auth != null && 
                     (request.auth.uid == resource.data.retailerId ||
                      hasRole('admin') ||
                      hasRole('finance'));
      
      // Only system and admins can write
      allow write: if request.auth != null && 
                      (hasRole('admin') || hasRole('finance'));
    }
    
    // Credit Scores
    match /organizations/{orgId}/credit_scores/{scoreId} {
      // Retailers can read their own scores
      allow read: if request.auth != null && 
                     (request.auth.uid == resource.data.retailerId ||
                      hasRole('admin') ||
                      hasRole('credit_manager'));
      
      // Only system and admins can write
      allow write: if request.auth != null && 
                      (hasRole('admin') || hasRole('credit_manager'));
    }
    
    // Helper function to check user roles
    function hasRole(role) {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }
  }
}
```

---

## Cloud Functions Triggers

### 1. Calculate Credit Score on Application Submit

```typescript
export const calculateCreditScoreOnApplication = functions.firestore
  .document('organizations/{orgId}/credit_applications/{applicationId}')
  .onCreate(async (snap, context) => {
    const application = snap.data()
    
    // Fetch retailer data
    const retailerData = await fetchRetailerMetrics(application.retailerId)
    
    // Calculate credit score
    const assessment = assessCredit(retailerData)
    
    // Update application with credit assessment
    await snap.ref.update({
      creditAssessment: assessment,
      updatedAt: FieldValue.serverTimestamp()
    })
    
    // Store credit score in credit_scores collection
    const scoreRef = admin.firestore()
      .collection('organizations').doc(context.params.orgId)
      .collection('credit_scores').doc()
    
    await scoreRef.set({
      retailerId: application.retailerId,
      organizationId: application.organizationId,
      score: assessment.score,
      breakdown: assessment.breakdown,
      tier: assessment.tier,
      calculatedAt: FieldValue.serverTimestamp(),
      // ... other fields
    })
  })
```

### 2. Update Facility Balance on Disbursement

```typescript
export const updateFacilityOnDisbursement = functions.firestore
  .document('organizations/{orgId}/credit_disbursements/{disbursementId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()
    
    // Only process when status changes to 'completed'
    if (before.status !== 'completed' && after.status === 'completed') {
      const facilityRef = admin.firestore()
        .collection('organizations').doc(context.params.orgId)
        .collection('credit_facilities').doc(after.facilityId)
      
      await facilityRef.update({
        totalDisbursed: FieldValue.increment(after.amount),
        outstandingBalance: FieldValue.increment(after.repaymentAmount),
        availableCredit: FieldValue.increment(-after.amount),
        lastDisbursementAt: FieldValue.serverTimestamp(),
        'metrics.totalDisbursements': FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      })
      
      // Create repayment schedule
      await createRepaymentSchedule(context.params.orgId, after)
    }
  })
```

### 3. Recalculate Score on Repayment

```typescript
export const recalculateScoreOnRepayment = functions.firestore
  .document('organizations/{orgId}/repayment_schedules/{scheduleId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()
    
    // Only process when status changes to 'paid'
    if (before.status !== 'paid' && after.status === 'paid') {
      const retailerId = after.retailerId
      
      // Recalculate credit score
      const retailerData = await fetchRetailerMetrics(retailerId)
      const assessment = assessCredit(retailerData)
      
      // Update credit facility
      const facilityRef = admin.firestore()
        .collection('organizations').doc(context.params.orgId)
        .collection('credit_facilities').doc(after.facilityId)
      
      await facilityRef.update({
        totalRepaid: FieldValue.increment(after.amountPaid),
        outstandingBalance: FieldValue.increment(-after.amountPaid),
        availableCredit: FieldValue.increment(after.amountPaid),
        lastRepaymentAt: FieldValue.serverTimestamp(),
        'metrics.successfulRepayments': FieldValue.increment(1),
        'metrics.currentStreak': FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      })
      
      // Store new credit score
      // ... (similar to calculateCreditScoreOnApplication)
    }
  })
```

---

## Migration Script

Run this to create all collections with sample data:

```bash
npx tsx scripts/setup-credit-schema.ts
```

**File**: `scripts/setup-credit-schema.ts`

```typescript
import admin from 'firebase-admin'

async function setupCreditSchema() {
  const db = admin.firestore()
  
  // Create sample application
  await db.collection('organizations/demo-org/credit_applications').add({
    status: 'draft',
    business: { name: 'Sample Store' },
    // ... full structure
  })
  
  console.log('✅ Credit schema setup complete')
}

setupCreditSchema()
```
