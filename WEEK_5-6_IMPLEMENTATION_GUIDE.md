# Week 5-6 Implementation Guide: Credit Disbursement

**Goal**: Enable retailers to place supplier orders using their approved credit facility.

---

## 🎯 Features to Implement

### 1. "Pay with Credit" Option in Supplier Orders

**Location**: Supplier order placement page

**UI Changes Needed**:
```tsx
// Add payment method selector
<RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
  <RadioGroupItem value="immediate" label="Pay Now (Cash/M-Pesa)" />
  <RadioGroupItem value="credit" label="Pay with Credit" />
</RadioGroup>

// Show credit balance if credit is available
{hasCreditFacility && (
  <Card className="bg-blue-50 border-blue-200">
    <CardContent className="p-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-semibold">Available Credit</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(availableCredit)}
          </p>
        </div>
        <Badge variant="success">Credit Approved</Badge>
      </div>
      <Progress value={creditUtilization} className="mt-2" />
      <p className="text-xs text-muted-foreground mt-1">
        {creditUtilization.toFixed(0)}% utilized
      </p>
    </CardContent>
  </Card>
)}
```

---

### 2. Credit Limit Checks

**Implementation**:

```typescript
// lib/credit-operations.ts

export async function checkCreditAvailability(
  retailerId: string,
  organizationId: string,
  requestedAmount: number
): Promise<{
  hasCredit: boolean
  availableCredit: number
  creditLimit: number
  message: string
}> {
  // Get active credit facility
  const facilitiesRef = collection(
    db,
    'organizations',
    organizationId,
    'credit_facilities'
  )
  const q = query(
    facilitiesRef,
    where('retailerId', '==', retailerId),
    where('status', '==', 'active'),
    limit(1)
  )
  const snapshot = await getDocs(q)

  if (snapshot.empty) {
    return {
      hasCredit: false,
      availableCredit: 0,
      creditLimit: 0,
      message: 'No active credit facility found. Apply for credit to get started.',
    }
  }

  const facility = snapshot.docs[0].data()
  const available = facility.approvedAmount - facility.outstandingBalance

  if (requestedAmount > available) {
    return {
      hasCredit: false,
      availableCredit: available,
      creditLimit: facility.approvedAmount,
      message: `Insufficient credit. You need ${formatCurrency(requestedAmount)} but have ${formatCurrency(available)} available.`,
    }
  }

  return {
    hasCredit: true,
    availableCredit: available,
    creditLimit: facility.approvedAmount,
    message: 'Credit available for this order',
  }
}
```

---

### 3. Pezesha Disbursement API Integration

**Create New API Route**: `app/api/credit/disburse/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { pezeshaClient, generateDisbursementReference } from '@/lib/pezesha-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      retailerId,
      organizationId,
      orderId,
      supplierId,
      supplierName,
      supplierPhone,
      supplierBankAccount,
      amount,
      purpose,
    } = body

    // Validate credit availability
    const creditCheck = await checkCreditAvailability(
      retailerId,
      organizationId,
      amount
    )

    if (!creditCheck.hasCredit) {
      return NextResponse.json(
        { success: false, error: creditCheck.message },
        { status: 400 }
      )
    }

    // Get facility ID
    const facilitiesRef = collection(
      db,
      'organizations',
      organizationId,
      'credit_facilities'
    )
    const q = query(
      facilitiesRef,
      where('retailerId', '==', retailerId),
      where('status', '==', 'active'),
      limit(1)
    )
    const snapshot = await getDocs(q)
    const facilityId = snapshot.docs[0].id
    const facilityData = snapshot.docs[0].data()

    // Generate reference number
    const referenceNumber = generateDisbursementReference(retailerId)

    // Calculate repayment terms
    const interestRate = facilityData.interestRate || 12 // 12% annual
    const tenorDays = facilityData.tenorDays || 30
    const interestAmount = (amount * (interestRate / 100) * (tenorDays / 365))
    const repaymentAmount = amount + interestAmount

    // Create disbursement record in Firestore
    const disbursementRef = collection(
      db,
      'organizations',
      organizationId,
      'credit_disbursements'
    )
    const disbursementDoc = await addDoc(disbursementRef, {
      disbursementId: '', // Will be updated after Pezesha response
      facilityId,
      retailerId,
      organizationId,
      amount,
      currency: 'KES',
      purpose,
      referenceNumber,
      recipient: {
        type: 'supplier',
        id: supplierId,
        name: supplierName,
        phone: supplierPhone,
        bankAccount: supplierBankAccount || null,
      },
      relatedOrder: {
        orderId,
        orderNumber: referenceNumber,
        supplierId,
      },
      status: 'pending',
      requestedAt: FieldValue.serverTimestamp(),
      processedAt: null,
      completedAt: null,
      failedAt: null,
      pezeshaDisbursementId: null,
      pezeshaTransactionRef: null,
      pezeshaStatus: null,
      repaymentDueDate: new Date(Date.now() + tenorDays * 24 * 60 * 60 * 1000),
      repaymentAmount,
      interestAmount,
      principalAmount: amount,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: retailerId,
      error: null,
    })

    // Request disbursement from Pezesha
    const pezeshaResponse = await pezeshaClient.requestDisbursement({
      applicationId: facilityData.pezeshaFacilityId,
      retailerId,
      amount,
      recipientName: supplierName,
      recipientPhone: supplierPhone,
      recipientBankAccount: supplierBankAccount,
      purpose,
      referenceNumber,
      metadata: {
        orderId,
        supplierId,
        organizationId,
      },
    })

    // Update disbursement with Pezesha ID
    await disbursementDoc.update({
      pezeshaDisbursementId: pezeshaResponse.disbursementId,
      pezeshaStatus: pezeshaResponse.status,
      status: 'processing',
      processedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      success: true,
      disbursementId: disbursementDoc.id,
      pezeshaDisbursementId: pezeshaResponse.disbursementId,
      status: pezeshaResponse.status,
      message: pezeshaResponse.message,
    })
  } catch (error: any) {
    console.error('Disbursement request failed:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

---

### 4. Outstanding Balance Tracking

**Create Credit Dashboard Widget**: `components/credit/credit-balance-widget.tsx`

```tsx
'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DollarSign, TrendingUp, AlertCircle } from 'lucide-react'

export function CreditBalanceWidget() {
  const { user, organization } = useAuth()
  const [loading, setLoading] = useState(true)
  const [facility, setFacility] = useState<any>(null)

  useEffect(() => {
    if (!user || !organization) return
    loadCreditFacility()
  }, [user, organization])

  async function loadCreditFacility() {
    if (!user || !organization || !db) return

    try {
      const facilitiesRef = collection(
        db,
        'organizations',
        organization.id,
        'credit_facilities'
      )
      const q = query(
        facilitiesRef,
        where('retailerId', '==', user.uid),
        where('status', '==', 'active')
      )
      const snapshot = await getDocs(q)

      if (!snapshot.empty) {
        setFacility(snapshot.docs[0].data())
      }
    } catch (error) {
      console.error('Error loading credit facility:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading credit info...</div>
  }

  if (!facility) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credit Facility</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            You don't have an active credit facility yet.
          </p>
          <Button>Apply for Credit</Button>
        </CardContent>
      </Card>
    )
  }

  const availableCredit = facility.approvedAmount - facility.outstandingBalance
  const utilization = (facility.outstandingBalance / facility.approvedAmount) * 100

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Credit Balance</CardTitle>
        <Badge variant={utilization > 85 ? 'destructive' : 'success'}>
          {facility.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Available Credit */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Available</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(availableCredit)}
            </span>
          </div>
          <Progress value={100 - utilization} className="mt-2 bg-red-100" />
        </div>

        {/* Outstanding Balance */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Outstanding</span>
            <span className="text-lg font-semibold text-red-600">
              {formatCurrency(facility.outstandingBalance)}
            </span>
          </div>
        </div>

        {/* Credit Limit */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Credit Limit</span>
            <span className="text-sm font-medium">
              {formatCurrency(facility.approvedAmount)}
            </span>
          </div>
        </div>

        {/* Utilization Warning */}
        {utilization > 85 && (
          <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700">
              High credit utilization. Consider making a payment to free up credit.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            View Details
          </Button>
          <Button variant="default" size="sm" className="flex-1">
            Make Payment
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

### 5. Credit Utilization Monitoring

**Create Alert System**: `lib/credit-alerts.ts`

```typescript
export interface CreditAlert {
  level: 'info' | 'warning' | 'danger'
  title: string
  message: string
  action?: string
}

export function checkCreditAlerts(facility: any): CreditAlert[] {
  const alerts: CreditAlert[] = []
  const utilization = (facility.outstandingBalance / facility.approvedAmount) * 100

  // High utilization warning
  if (utilization > 85) {
    alerts.push({
      level: 'danger',
      title: 'High Credit Utilization',
      message: `You're using ${utilization.toFixed(0)}% of your credit limit. Make a payment to avoid reaching your limit.`,
      action: 'Make Payment',
    })
  } else if (utilization > 70) {
    alerts.push({
      level: 'warning',
      title: 'Credit Utilization Alert',
      message: `You're using ${utilization.toFixed(0)}% of your credit limit. Consider planning a payment soon.`,
    })
  }

  // Overdue payments check
  if (facility.metrics.lateRepayments > 0) {
    alerts.push({
      level: 'danger',
      title: 'Overdue Payment',
      message: 'You have overdue payments. Please settle them to maintain your credit score.',
      action: 'View Schedule',
    })
  }

  // Limit increase eligibility
  if (
    facility.metrics.successfulRepayments >= 6 &&
    facility.metrics.currentStreak >= 6 &&
    utilization < 50
  ) {
    alerts.push({
      level: 'info',
      title: 'Eligible for Limit Increase',
      message: 'Your payment history qualifies you for a credit limit increase!',
      action: 'Request Increase',
    })
  }

  return alerts
}
```

---

## 📋 Implementation Checklist

### Backend Changes
- [ ] Create `lib/credit-operations.ts` with credit availability check
- [ ] Create `app/api/credit/disburse/route.ts` for disbursement requests
- [ ] Update supplier order model to include `paymentMethod` field
- [ ] Add credit facility loading to supplier order page

### Frontend Changes
- [ ] Add "Pay with Credit" radio button to supplier order page
- [ ] Create `CreditBalanceWidget` component
- [ ] Add credit balance display to supplier module
- [ ] Show credit utilization warnings
- [ ] Add "Apply for Credit" CTA if no facility exists

### Integration
- [ ] Test Pezesha disbursement API in sandbox
- [ ] Handle disbursement success/failure responses
- [ ] Update order status based on disbursement status
- [ ] Send notifications on successful disbursement

### Testing
- [ ] Test credit availability check
- [ ] Test insufficient credit error handling
- [ ] Test disbursement request flow
- [ ] Test webhook handling for disbursement.completed
- [ ] Test credit utilization updates

---

## 🎯 Expected Outcomes

After implementing Week 5-6 features:

1. ✅ Retailers can select "Pay with Credit" when placing supplier orders
2. ✅ System checks available credit before allowing order
3. ✅ Disbursement request sent to Pezesha automatically
4. ✅ Credit balance updated in real-time
5. ✅ Retailers see their available credit in supplier module
6. ✅ Utilization warnings displayed when credit is high
7. ✅ Admin dashboard tracks all disbursements
8. ✅ Webhooks update disbursement status automatically

---

## 📚 Files to Modify

1. `lib/credit-operations.ts` (NEW) - Credit availability checks
2. `app/api/credit/disburse/route.ts` (NEW) - Disbursement endpoint
3. `components/credit/credit-balance-widget.tsx` (NEW) - Balance widget
4. `lib/credit-alerts.ts` (NEW) - Alert system
5. Supplier order page (MODIFY) - Add "Pay with Credit" option
6. Supplier module layout (MODIFY) - Add credit balance widget

---

**Estimated Time**: 2-3 days  
**Dependencies**: Pezesha sandbox API access, existing credit system (Weeks 1-4)  
**Next**: Week 7-8 Repayment Management
