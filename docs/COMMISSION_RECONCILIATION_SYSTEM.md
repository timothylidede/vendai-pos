# VendAI POS — Commission Reconciliation System

_Last updated: October 11, 2025_

## Overview

VendAI charges **5% commission on distributor orders**, reconciled **bi-weekly**. This document details the payment flow, reconciliation process, and technical implementation similar to Uber/Bolt's driver commission model.

---

## Commission Model

### Key Principles
1. **Direct Payment**: Retailer pays distributor 100% of order value directly
2. **Deferred Commission**: Platform collects 5% from distributor bi-weekly
3. **Transparent Tracking**: Real-time commission accumulation visible to distributors
4. **Automated Reconciliation**: Periods close automatically, invoices generated
5. **Flexible Payment**: Multiple payment methods, payment plans supported

### Commission Rate
- **Standard Rate**: 5% of order GMV (Gross Merchandise Value)
- **Calculation**: `commissionAmount = orderAmount × 0.05`
- **Applied To**: All completed distributor orders (after payment confirmed)
- **Excludes**: Cancelled orders, refunds, disputes (until resolved)

### Reconciliation Cycle
- **Frequency**: Every 2 weeks (bi-weekly)
- **Period Start**: Monday 00:00 (start of week)
- **Period End**: Sunday 23:59 (end of second week)
- **Invoice Date**: Monday after period end
- **Payment Due**: 7 days after invoice date
- **Late Fee**: 2% per week overdue (configurable)

---

## Payment Flow

### Step 1: Retailer Places Order
```
Retailer → Distributor
- Retailer creates purchase order (PO) in VendAI POS
- PO sent to distributor for approval
- Order total: KES 50,000
```

### Step 2: Distributor Fulfills Order
```
Distributor → Retailer
- Distributor approves PO and prepares goods
- Goods delivered to retailer
- Delivery confirmation in VendAI system
```

### Step 3: Retailer Pays Distributor Directly
```
Retailer → Distributor (Direct Payment)
- Payment method: M-Pesa, bank transfer, cash on delivery
- Payment amount: KES 50,000 (100% of order value)
- Payment proof: M-Pesa code, bank reference, receipt
- Status: Order marked as "Paid" in system
```

### Step 4: Commission Calculation (Automatic)
```
VendAI Platform (Background)
- Order status changed to "Paid"
- Trigger: Cloud Function on order payment confirmation
- Calculate: KES 50,000 × 5% = KES 2,500 commission
- Create: Commission transaction record
- Status: Commission marked as "Pending"
```

### Step 5: Bi-weekly Reconciliation
```
VendAI Platform → Distributor (Every 2 Weeks)
- Period closes: 14 days of commission transactions
- Total commission owed: KES 87,500 (35 orders × avg KES 2,500)
- Invoice generated: Itemized list of all orders
- Invoice sent: Email + in-app notification
- Payment due: 7 days from invoice date
```

### Step 6: Commission Payment
```
Distributor → VendAI Platform
- Payment method: M-Pesa, bank transfer, card payment
- Payment amount: KES 87,500 (total commission)
- Payment proof: Uploaded to system
- Status: Commission marked as "Paid"
- Period: Reconciliation period marked as "Closed"
```

---

## Data Models

### Commission Transaction
```typescript
interface CommissionTransaction {
  id: string                          // Unique transaction ID
  orderId: string                     // Reference to original order
  distributorId: string               // Distributor org ID
  retailerId: string                  // Retailer org ID
  
  // Order Details
  orderDate: Timestamp                // When order was placed
  orderAmount: number                 // Total order value (KES)
  paymentMethod: string               // M-Pesa, bank, cash, etc.
  paymentConfirmedAt: Timestamp       // When retailer paid distributor
  
  // Commission Details
  commissionRate: number              // 0.05 (5%)
  commissionAmount: number            // Calculated commission (KES)
  status: 'pending' | 'reconciled' | 'paid' | 'disputed'
  
  // Reconciliation Period
  periodId: string                    // Which bi-weekly period
  periodStart: Timestamp              // Start of period
  periodEnd: Timestamp                // End of period
  
  // Payment Tracking
  reconciledAt?: Timestamp            // When period closed
  invoiceId?: string                  // Generated invoice reference
  paidAt?: Timestamp                  // When distributor paid commission
  paymentProof?: string               // URL to payment proof
  
  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
  notes?: string                      // Admin notes
}
```

### Reconciliation Period
```typescript
interface ReconciliationPeriod {
  id: string                          // Period ID (e.g., "2025-W20-W21")
  periodNumber: number                // Sequential number (1, 2, 3...)
  
  // Period Dates
  startDate: Timestamp                // Monday 00:00
  endDate: Timestamp                  // Sunday 23:59 (2 weeks later)
  status: 'active' | 'closed' | 'reconciled'
  
  // Aggregate Metrics
  totalOrders: number                 // Count of all orders in period
  totalGMV: number                    // Sum of all order values
  totalCommission: number             // Sum of all commissions
  
  // Distributor Breakdown
  distributorBreakdown: {
    [distributorId: string]: {
      distributorName: string
      orderCount: number              // Orders from this distributor
      gmv: number                     // Total sales from this distributor
      commissionOwed: number          // 5% of GMV
      status: 'pending' | 'invoiced' | 'paid' | 'overdue'
      invoiceId?: string              // Generated invoice ID
      paidAt?: Timestamp              // When they paid
      paymentProof?: string           // Payment receipt URL
    }
  }
  
  // Reconciliation Tracking
  closedAt?: Timestamp                // When period ended
  invoicesGeneratedAt?: Timestamp     // When invoices sent
  fullyReconciledAt?: Timestamp       // When all distributors paid
  
  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Commission Invoice
```typescript
interface CommissionInvoice {
  id: string                          // Invoice ID (e.g., "INV-2025-W20-001")
  periodId: string                    // Reconciliation period reference
  distributorId: string               // Distributor org ID
  
  // Invoice Details
  invoiceNumber: string               // Human-readable number
  invoiceDate: Timestamp              // Issue date
  dueDate: Timestamp                  // Payment due (7 days from issue)
  
  // Line Items
  lineItems: {
    orderId: string
    orderDate: Timestamp
    retailerName: string
    orderAmount: number
    commissionAmount: number
  }[]
  
  // Totals
  subtotal: number                    // Sum of line items
  lateFee: number                     // If overdue (2% per week)
  total: number                       // Subtotal + late fees
  
  // Payment Tracking
  status: 'pending' | 'paid' | 'overdue' | 'disputed'
  paidAt?: Timestamp
  paymentMethod?: string
  paymentReference?: string
  paymentProof?: string               // URL to receipt/proof
  
  // Reminders
  remindersSent: Timestamp[]          // When reminders sent
  lastReminderAt?: Timestamp
  
  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
  notes?: string
}
```

### Commission Payment
```typescript
interface CommissionPayment {
  id: string
  invoiceId: string                   // Invoice being paid
  periodId: string                    // Reconciliation period
  distributorId: string
  
  // Payment Details
  amount: number                      // Amount paid (KES)
  paymentMethod: 'mpesa' | 'bank' | 'card'
  paymentDate: Timestamp
  paymentReference: string            // M-Pesa code, bank ref, etc.
  paymentProof?: string               // URL to receipt
  
  // Status
  status: 'pending' | 'verified' | 'completed' | 'failed'
  verifiedBy?: string                 // Admin user who verified
  verifiedAt?: Timestamp
  
  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
  notes?: string
}
```

---

## API Endpoints

### Commission Calculation
```typescript
POST /api/commissions/calculate
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "orderId": "order_abc123",
  "orderAmount": 50000,
  "paymentMethod": "mpesa",
  "paymentReference": "ABC123XYZ"
}

Response:
{
  "success": true,
  "commission": {
    "id": "comm_xyz789",
    "orderId": "order_abc123",
    "commissionAmount": 2500,
    "commissionRate": 0.05,
    "status": "pending",
    "periodId": "2025-W20-W21"
  }
}
```

### Get Distributor Commission Summary
```typescript
GET /api/commissions/distributor/:distributorId
Authorization: Bearer <token>

Query Params:
- periodId (optional): Filter by specific period
- status (optional): Filter by status

Response:
{
  "success": true,
  "currentPeriod": {
    "periodId": "2025-W20-W21",
    "orderCount": 35,
    "gmv": 1750000,
    "commissionOwed": 87500,
    "status": "active"
  },
  "historicalPeriods": [
    {
      "periodId": "2025-W18-W19",
      "orderCount": 42,
      "gmv": 2100000,
      "commissionOwed": 105000,
      "status": "paid",
      "paidAt": "2025-05-15T12:00:00Z"
    }
  ],
  "totalLifetimeCommission": 487500,
  "totalPaid": 400000,
  "totalOutstanding": 87500
}
```

### Close Reconciliation Period
```typescript
POST /api/reconciliation/close-period
Authorization: Bearer <admin-token>
Content-Type: application/json

Request Body:
{
  "periodId": "2025-W20-W21"
}

Response:
{
  "success": true,
  "period": {
    "id": "2025-W20-W21",
    "status": "closed",
    "totalOrders": 523,
    "totalGMV": 26150000,
    "totalCommission": 1307500,
    "distributorCount": 89,
    "invoicesGenerated": 89
  }
}
```

### Generate Invoice
```typescript
POST /api/reconciliation/invoice
Authorization: Bearer <admin-token>
Content-Type: application/json

Request Body:
{
  "periodId": "2025-W20-W21",
  "distributorId": "dist_abc123"
}

Response:
{
  "success": true,
  "invoice": {
    "id": "inv_xyz789",
    "invoiceNumber": "INV-2025-W20-001",
    "distributorId": "dist_abc123",
    "subtotal": 87500,
    "lateFee": 0,
    "total": 87500,
    "dueDate": "2025-05-22T23:59:59Z",
    "lineItems": [
      {
        "orderId": "order_001",
        "orderDate": "2025-05-01T10:30:00Z",
        "retailerName": "Mary's Duka",
        "orderAmount": 50000,
        "commissionAmount": 2500
      }
      // ... 34 more line items
    ]
  }
}
```

### Record Payment
```typescript
POST /api/reconciliation/record-payment
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "invoiceId": "inv_xyz789",
  "amount": 87500,
  "paymentMethod": "mpesa",
  "paymentReference": "ABC123XYZ",
  "paymentProof": "https://storage.example.com/receipts/receipt.pdf"
}

Response:
{
  "success": true,
  "payment": {
    "id": "pay_123",
    "invoiceId": "inv_xyz789",
    "amount": 87500,
    "status": "pending",
    "verificationRequired": true
  }
}
```

### Admin Commission Overview
```typescript
GET /api/admin/commissions/overview
Authorization: Bearer <admin-token>

Query Params:
- startDate (optional): Filter from date
- endDate (optional): Filter to date

Response:
{
  "success": true,
  "overview": {
    "totalGMV": 47382000,
    "totalCommission": 2369100,
    "paidCommission": 1881800,
    "pendingCommission": 487300,
    "overdueCommission": 124500,
    "averagePaymentTime": 5.2,  // days
    "distributorCount": 89,
    "onTimePaymentRate": 0.876
  },
  "topDistributors": [
    {
      "id": "dist_001",
      "name": "Kenya Grocers Ltd",
      "gmv": 18240000,
      "commissionOwed": 91200,
      "status": "pending"
    }
  ]
}
```

---

## Automated Workflows

### 1. Commission Calculation (Real-time)
```typescript
// Cloud Function: Triggered on order payment confirmation
export const calculateCommission = functions.firestore
  .document('pos_orders/{orderId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data()
    const oldData = change.before.data()
    
    // Only trigger on payment confirmation
    if (oldData.paymentStatus !== 'paid' && newData.paymentStatus === 'paid') {
      const orderId = context.params.orderId
      const orderAmount = newData.total
      const distributorId = newData.distributorId
      const retailerId = newData.orgId
      
      // Calculate commission
      const commissionAmount = orderAmount * 0.05
      
      // Get current active period
      const activePeriod = await getActivePeriod()
      
      // Create commission transaction
      await db.collection('commission_transactions').add({
        orderId,
        distributorId,
        retailerId,
        orderDate: newData.createdAt,
        orderAmount,
        paymentMethod: newData.paymentMethod,
        paymentConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        commissionRate: 0.05,
        commissionAmount,
        status: 'pending',
        periodId: activePeriod.id,
        periodStart: activePeriod.startDate,
        periodEnd: activePeriod.endDate,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
      
      // Update period totals
      await updatePeriodTotals(activePeriod.id, {
        totalOrders: admin.firestore.FieldValue.increment(1),
        totalGMV: admin.firestore.FieldValue.increment(orderAmount),
        totalCommission: admin.firestore.FieldValue.increment(commissionAmount),
        [`distributorBreakdown.${distributorId}.orderCount`]: admin.firestore.FieldValue.increment(1),
        [`distributorBreakdown.${distributorId}.gmv`]: admin.firestore.FieldValue.increment(orderAmount),
        [`distributorBreakdown.${distributorId}.commissionOwed`]: admin.firestore.FieldValue.increment(commissionAmount)
      })
      
      console.log(`Commission calculated: ${commissionAmount} KES for order ${orderId}`)
    }
  })
```

### 2. Close Period (Cron Job)
```typescript
// Cloud Function: Runs every 2 weeks on Monday at 00:01
export const closePeriod = functions.pubsub
  .schedule('1 0 * * 1')  // Every Monday at 00:01
  .timeZone('Africa/Nairobi')
  .onRun(async (context) => {
    const now = new Date()
    
    // Check if it's the end of a 2-week period (even week number)
    const weekNumber = getWeekNumber(now)
    if (weekNumber % 2 !== 0) {
      console.log(`Week ${weekNumber} is odd, skipping period close`)
      return null
    }
    
    // Get current active period
    const activePeriod = await getActivePeriod()
    
    if (!activePeriod) {
      console.log('No active period found')
      return null
    }
    
    // Close the period
    await db.collection('reconciliation_periods').doc(activePeriod.id).update({
      status: 'closed',
      closedAt: admin.firestore.FieldValue.serverTimestamp()
    })
    
    // Mark all commission transactions as reconciled
    const batch = db.batch()
    const commissions = await db.collection('commission_transactions')
      .where('periodId', '==', activePeriod.id)
      .where('status', '==', 'pending')
      .get()
    
    commissions.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'reconciled',
        reconciledAt: admin.firestore.FieldValue.serverTimestamp()
      })
    })
    
    await batch.commit()
    
    // Create new active period
    const newPeriodStart = new Date(now)
    const newPeriodEnd = new Date(now)
    newPeriodEnd.setDate(newPeriodEnd.getDate() + 13)  // 2 weeks - 1 day
    
    await db.collection('reconciliation_periods').add({
      periodNumber: activePeriod.periodNumber + 1,
      startDate: admin.firestore.Timestamp.fromDate(newPeriodStart),
      endDate: admin.firestore.Timestamp.fromDate(newPeriodEnd),
      status: 'active',
      totalOrders: 0,
      totalGMV: 0,
      totalCommission: 0,
      distributorBreakdown: {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })
    
    console.log(`Period ${activePeriod.id} closed, new period created`)
    return null
  })
```

### 3. Generate Invoices (Cron Job)
```typescript
// Cloud Function: Runs every Monday at 09:00 (after period close)
export const generateInvoices = functions.pubsub
  .schedule('0 9 * * 1')  // Every Monday at 09:00
  .timeZone('Africa/Nairobi')
  .onRun(async (context) => {
    // Get last closed period
    const closedPeriods = await db.collection('reconciliation_periods')
      .where('status', '==', 'closed')
      .where('invoicesGeneratedAt', '==', null)
      .orderBy('closedAt', 'desc')
      .limit(1)
      .get()
    
    if (closedPeriods.empty) {
      console.log('No closed periods awaiting invoice generation')
      return null
    }
    
    const period = closedPeriods.docs[0]
    const periodData = period.data()
    
    // Generate invoice for each distributor
    const invoicePromises = Object.entries(periodData.distributorBreakdown).map(
      async ([distributorId, breakdown]: [string, any]) => {
        // Get all commission transactions for this distributor in this period
        const transactions = await db.collection('commission_transactions')
          .where('periodId', '==', period.id)
          .where('distributorId', '==', distributorId)
          .where('status', '==', 'reconciled')
          .get()
        
        // Build line items
        const lineItems = await Promise.all(
          transactions.docs.map(async doc => {
            const data = doc.data()
            const retailer = await db.collection('users').doc(data.retailerId).get()
            
            return {
              orderId: data.orderId,
              orderDate: data.orderDate,
              retailerName: retailer.data()?.businessName || 'Unknown',
              orderAmount: data.orderAmount,
              commissionAmount: data.commissionAmount
            }
          })
        )
        
        // Create invoice
        const invoiceNumber = `INV-${period.id}-${String(Object.keys(periodData.distributorBreakdown).indexOf(distributorId) + 1).padStart(3, '0')}`
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 7)  // 7 days from now
        
        const invoice = await db.collection('commission_invoices').add({
          periodId: period.id,
          distributorId,
          invoiceNumber,
          invoiceDate: admin.firestore.FieldValue.serverTimestamp(),
          dueDate: admin.firestore.Timestamp.fromDate(dueDate),
          lineItems,
          subtotal: breakdown.commissionOwed,
          lateFee: 0,
          total: breakdown.commissionOwed,
          status: 'pending',
          remindersSent: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        })
        
        // Update period with invoice ID
        await period.ref.update({
          [`distributorBreakdown.${distributorId}.invoiceId`]: invoice.id,
          [`distributorBreakdown.${distributorId}.status`]: 'invoiced'
        })
        
        // Send invoice email/notification
        await sendInvoiceNotification(distributorId, invoice.id)
        
        console.log(`Invoice ${invoiceNumber} generated for distributor ${distributorId}`)
      }
    )
    
    await Promise.all(invoicePromises)
    
    // Mark period as invoiced
    await period.ref.update({
      invoicesGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
    })
    
    console.log(`All invoices generated for period ${period.id}`)
    return null
  })
```

### 4. Send Payment Reminders (Cron Job)
```typescript
// Cloud Function: Runs daily at 10:00
export const sendPaymentReminders = functions.pubsub
  .schedule('0 10 * * *')  // Every day at 10:00
  .timeZone('Africa/Nairobi')
  .onRun(async (context) => {
    const now = new Date()
    
    // Get all pending invoices
    const pendingInvoices = await db.collection('commission_invoices')
      .where('status', '==', 'pending')
      .get()
    
    for (const doc of pendingInvoices.docs) {
      const invoice = doc.data()
      const dueDate = invoice.dueDate.toDate()
      const daysToDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      // Send reminders at: 3 days before, due date, 3 days overdue, 7 days overdue
      const reminderPoints = [3, 0, -3, -7]
      
      if (reminderPoints.includes(daysToDue)) {
        const lastReminder = invoice.remindersSent[invoice.remindersSent.length - 1]
        const lastReminderDate = lastReminder ? lastReminder.toDate() : null
        
        // Don't send if we already sent a reminder today
        if (!lastReminderDate || 
            (now.getTime() - lastReminderDate.getTime()) > 1000 * 60 * 60 * 20) {  // 20 hours
          
          await sendReminderNotification(invoice.distributorId, doc.id, daysToDue)
          
          await doc.ref.update({
            remindersSent: admin.firestore.FieldValue.arrayUnion(
              admin.firestore.FieldValue.serverTimestamp()
            ),
            lastReminderAt: admin.firestore.FieldValue.serverTimestamp()
          })
          
          // Mark as overdue if past due date
          if (daysToDue < 0) {
            await doc.ref.update({ status: 'overdue' })
            
            // Calculate late fee (2% per week)
            const weeksOverdue = Math.ceil(Math.abs(daysToDue) / 7)
            const lateFee = invoice.subtotal * 0.02 * weeksOverdue
            const newTotal = invoice.subtotal + lateFee
            
            await doc.ref.update({
              lateFee,
              total: newTotal
            })
          }
          
          console.log(`Reminder sent for invoice ${invoice.invoiceNumber} (${daysToDue} days to due)`)
        }
      }
    }
    
    return null
  })
```

### 5. Suspend Overdue Distributors (Cron Job)
```typescript
// Cloud Function: Runs weekly on Sunday at 23:00
export const suspendOverdueDistributors = functions.pubsub
  .schedule('0 23 * * 0')  // Every Sunday at 23:00
  .timeZone('Africa/Nairobi')
  .onRun(async (context) => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    // Get all overdue invoices >30 days
    const overdueInvoices = await db.collection('commission_invoices')
      .where('status', '==', 'overdue')
      .where('dueDate', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
      .get()
    
    const distributorsToSuspend = new Set<string>()
    
    overdueInvoices.docs.forEach(doc => {
      distributorsToSuspend.add(doc.data().distributorId)
    })
    
    // Suspend each distributor
    for (const distributorId of distributorsToSuspend) {
      await db.collection('users').doc(distributorId).update({
        'status': 'suspended',
        'suspensionReason': 'Commission payment overdue >30 days',
        'suspendedAt': admin.firestore.FieldValue.serverTimestamp()
      })
      
      await sendSuspensionNotification(distributorId)
      
      console.log(`Distributor ${distributorId} suspended for overdue payments`)
    }
    
    return null
  })
```

---

## Distributor Dashboard

### Current Period Widget
```tsx
<Card className="glassmorphism">
  <CardHeader>
    <CardTitle>Current Period Commission</CardTitle>
    <CardDescription>May 6 - May 19, 2025</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="text-4xl font-bold text-emerald-400">
      KES 87,500
    </div>
    <div className="text-sm text-gray-400 mt-2">
      35 orders • KES 1,750,000 GMV
    </div>
    <Progress value={71} className="mt-4" />
    <p className="text-xs text-gray-500 mt-2">
      Period ends in 5 days
    </p>
  </CardContent>
</Card>
```

### Payment History Table
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Period</TableHead>
      <TableHead>Orders</TableHead>
      <TableHead>GMV</TableHead>
      <TableHead>Commission</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Apr 22 - May 5</TableCell>
      <TableCell>42</TableCell>
      <TableCell>KES 2,100,000</TableCell>
      <TableCell>KES 105,000</TableCell>
      <TableCell>
        <Badge variant="success">Paid</Badge>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm">View Receipt</Button>
      </TableCell>
    </TableRow>
    <TableRow>
      <TableCell>Apr 8 - Apr 21</TableCell>
      <TableCell>38</TableCell>
      <TableCell>KES 1,900,000</TableCell>
      <TableCell>KES 95,000</TableCell>
      <TableCell>
        <Badge variant="warning">Overdue 3 days</Badge>
      </TableCell>
      <TableCell>
        <Button variant="default" size="sm">Pay Now</Button>
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Invoice Detail Modal
```tsx
<Dialog open={showInvoice} onOpenChange={setShowInvoice}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Commission Invoice #{invoiceNumber}</DialogTitle>
      <DialogDescription>
        Period: {periodStart} - {periodEnd}
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* Invoice Header */}
      <div className="flex justify-between">
        <div>
          <p className="text-sm text-gray-500">Invoice Date</p>
          <p className="font-semibold">{invoiceDate}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Due Date</p>
          <p className="font-semibold">{dueDate}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Status</p>
          <Badge variant={statusVariant}>{status}</Badge>
        </div>
      </div>
      
      {/* Line Items */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Retailer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Commission (5%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.map(item => (
            <TableRow key={item.orderId}>
              <TableCell className="font-mono text-xs">
                {item.orderId}
              </TableCell>
              <TableCell>{formatDate(item.orderDate)}</TableCell>
              <TableCell>{item.retailerName}</TableCell>
              <TableCell>KES {formatNumber(item.orderAmount)}</TableCell>
              <TableCell>KES {formatNumber(item.commissionAmount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Totals */}
      <div className="border-t pt-4">
        <div className="flex justify-between mb-2">
          <span>Subtotal</span>
          <span>KES {formatNumber(subtotal)}</span>
        </div>
        {lateFee > 0 && (
          <div className="flex justify-between mb-2 text-red-500">
            <span>Late Fee (2% per week)</span>
            <span>KES {formatNumber(lateFee)}</span>
          </div>
        )}
        <div className="flex justify-between text-xl font-bold">
          <span>Total Due</span>
          <span>KES {formatNumber(total)}</span>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handlePayNow} className="flex-1">
          Pay Now
        </Button>
        <Button variant="outline" onClick={downloadInvoice}>
          Download PDF
        </Button>
        <Button variant="ghost" onClick={handleDispute}>
          Dispute
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

---

## Platform Admin Dashboard

### Commission Overview
```tsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <Card className="glassmorphism">
    <CardContent className="pt-6">
      <div className="text-2xl font-bold text-emerald-400">
        KES 2.37M
      </div>
      <p className="text-sm text-gray-400">Total Commission (This Month)</p>
    </CardContent>
  </Card>
  
  <Card className="glassmorphism">
    <CardContent className="pt-6">
      <div className="text-2xl font-bold text-blue-400">
        KES 1.88M
      </div>
      <p className="text-sm text-gray-400">Paid Commission</p>
    </CardContent>
  </Card>
  
  <Card className="glassmorphism">
    <CardContent className="pt-6">
      <div className="text-2xl font-bold text-yellow-400">
        KES 487K
      </div>
      <p className="text-sm text-gray-400">Pending Commission</p>
    </CardContent>
  </Card>
  
  <Card className="glassmorphism">
    <CardContent className="pt-6">
      <div className="text-2xl font-bold text-red-400">
        KES 124K
      </div>
      <p className="text-sm text-gray-400">Overdue Commission</p>
    </CardContent>
  </Card>
</div>
```

### Top Distributors by Commission Owed
```tsx
<Card className="glassmorphism">
  <CardHeader>
    <CardTitle>Top Distributors (Current Period)</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Distributor</TableHead>
          <TableHead>Orders</TableHead>
          <TableHead>GMV</TableHead>
          <TableHead>Commission Owed</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {topDistributors.map(d => (
          <TableRow key={d.id}>
            <TableCell className="font-semibold">{d.name}</TableCell>
            <TableCell>{d.orderCount}</TableCell>
            <TableCell>KES {formatNumber(d.gmv)}</TableCell>
            <TableCell>KES {formatNumber(d.commissionOwed)}</TableCell>
            <TableCell>
              <Badge variant={d.statusVariant}>{d.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

### Reconciliation Period Management
```tsx
<Card className="glassmorphism">
  <CardHeader>
    <CardTitle>Reconciliation Periods</CardTitle>
    <CardDescription>
      Manage bi-weekly commission periods
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Period</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Orders</TableHead>
          <TableHead>Total Commission</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-semibold">Period 12</TableCell>
          <TableCell>May 6 - May 19</TableCell>
          <TableCell>523</TableCell>
          <TableCell>KES 1,307,500</TableCell>
          <TableCell>
            <Badge variant="success">Active</Badge>
          </TableCell>
          <TableCell>
            <Button variant="ghost" size="sm" disabled>
              Close Period
            </Button>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-semibold">Period 11</TableCell>
          <TableCell>Apr 22 - May 5</TableCell>
          <TableCell>612</TableCell>
          <TableCell>KES 1,530,000</TableCell>
          <TableCell>
            <Badge>Closed</Badge>
          </TableCell>
          <TableCell>
            <Button variant="ghost" size="sm">
              Generate Invoices
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

---

## Payment Methods

### M-Pesa (Primary)
- **Paybill Number**: 123456 (VendAI Platform)
- **Account Number**: Distributor ID (e.g., `DIST001`)
- **Instructions**:
  1. Go to M-Pesa menu
  2. Select "Lipa na M-Pesa"
  3. Select "Paybill"
  4. Enter Business Number: 123456
  5. Enter Account Number: Your Distributor ID
  6. Enter Amount: Commission total
  7. Enter PIN and confirm
  8. Upload M-Pesa message screenshot to VendAI

### Bank Transfer
- **Bank**: Equity Bank Kenya
- **Account Name**: VendAI Technologies Ltd
- **Account Number**: 0123456789
- **Branch**: Westlands, Nairobi
- **SWIFT Code**: EQBLKENA (for international)
- **Instructions**:
  1. Initiate bank transfer with commission amount
  2. Use invoice number as reference
  3. Upload bank receipt/confirmation to VendAI

### Card Payment (Coming Soon)
- **Processor**: Stripe/Flutterwave
- **Supported Cards**: Visa, Mastercard, Amex
- **Processing Fee**: 2.9% + KES 30 (passed to distributor)

---

## Dispute Resolution

### Dispute Process
1. **Distributor initiates dispute** on invoice
2. **Provide reason and evidence** (screenshots, receipts, order details)
3. **VendAI admin reviews** within 2 business days
4. **Options**:
   - **Accept dispute**: Adjust invoice, recalculate commission
   - **Reject dispute**: Provide explanation, invoice stands
   - **Partial adjustment**: Modify specific line items
5. **Resolution logged** in audit trail
6. **Updated invoice sent** if adjustments made

### Common Dispute Reasons
- Order cancelled after payment confirmation
- Refund issued to retailer
- Duplicate commission charge
- Incorrect order amount
- Payment proof not recognized

---

## Success Metrics

### Commission Collection Rate
- **Target**: 95% collected within 14 days of invoice
- **Current**: 87.6% (78/89 distributors paid on time)
- **Overdue Rate**: 9.0% (8/89 distributors 1-15 days overdue)
- **Suspended Rate**: 3.4% (3/89 distributors >15 days overdue)

### Average Payment Time
- **Target**: <7 days from invoice date
- **Current**: 5.2 days average
- **Median**: 4 days

### Dispute Rate
- **Target**: <5% of invoices disputed
- **Current**: 2.1% (12/523 invoices in last period)
- **Resolution Time**: 1.8 days average

---

## Compliance & Legal

### Tax Implications
- **VAT on Commission**: 16% VAT charged on commission (Kenya)
- **Withholding Tax**: Distributors may be subject to withholding tax
- **Tax Invoice**: Generated for each commission payment
- **Tax Reports**: Quarterly VAT returns filed with KRA

### Contracts
- **Distributor Agreement**: Signed on onboarding, includes commission terms
- **Invoice Terms**: 7-day payment terms, 2% weekly late fee
- **Suspension Policy**: Automatic suspension after 30 days overdue
- **Termination**: VendAI may terminate for repeated non-payment

### Audit Trail
- All commission calculations logged
- All payment records immutable
- Admin actions logged with user ID and timestamp
- Full audit export available for compliance

---

## Future Enhancements

### Phase 2
- [ ] Tiered commission rates (4% for high-volume distributors)
- [ ] Commission discount programs (early payment discount)
- [ ] Automated dispute resolution (ML-based)
- [ ] Multi-currency support (USD, GBP)

### Phase 3
- [ ] Commission financing (advance payment options)
- [ ] Commission analytics (trends, forecasting)
- [ ] Commission referral bonuses
- [ ] White-label commission management for distributors

---

## Conclusion

The 5% commission reconciliation system provides transparent, automated commission tracking and collection similar to Uber/Bolt's model. By allowing direct retailer-distributor payments and reconciling commission bi-weekly, VendAI minimizes friction while ensuring predictable revenue collection.

**Next Steps**:
1. Implement commission calculation Cloud Function
2. Build platform admin dashboard
3. Create distributor commission portal
4. Set up automated invoicing and reminders
5. Test end-to-end flow with pilot distributors

---

**For Implementation Details**: See `TODO.md` Phase 5.0
**For Free Distribution Model**: See `FREE_DISTRIBUTION_MODEL.md`
