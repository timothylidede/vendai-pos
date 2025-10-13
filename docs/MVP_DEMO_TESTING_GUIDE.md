# VendAI MVP Demo - End-to-End Testing Guide

**Version**: 1.0  
**Last Updated**: October 13, 2025  
**Testing Duration**: ~45-60 minutes  
**Status**: Ready for Demo

---

## 📋 Pre-Demo Checklist

### Environment Setup
- [ ] **Firebase Connection**: Verify Firestore is accessible
- [ ] **Authentication**: Test login with demo account
- [ ] **Network Status**: Check internet connection (for online features)
- [ ] **Browser**: Use latest Chrome/Edge (recommended)
- [ ] **Screen Resolution**: 1920x1080 or higher for best display
- [ ] **Sample Data**: Ensure test products, suppliers, and organizations exist

### Demo Accounts
```
Admin Account:
Email: admin@vendai.demo
Password: [Your demo password]

Retailer Account:
Email: retailer@vendai.demo
Password: [Your demo password]

Organization: Demo Retail Store
```

### Test Data Requirements
- ✅ 10+ products in inventory
- ✅ 2+ suppliers configured
- ✅ 1 active credit facility (for credit testing)
- ✅ Sample repayment schedule with upcoming payments
- ✅ Historical orders (for analytics)

---

## 🎯 Demo Flow Overview

**Total Demo Time**: 45 minutes

1. **POS Operations** (15 min) - Core checkout and offline capabilities
2. **Credit System** (20 min) - Application, disbursement, repayment
3. **Analytics & Admin** (10 min) - Dashboard, reporting, credit management

---

## 🛒 Part 1: POS Operations (15 minutes)

### Test 1.1: Basic Checkout Flow ✅
**Duration**: 3 minutes  
**Goal**: Demonstrate core POS functionality

#### Steps:
1. **Navigate to POS**:
   ```
   → Click "POS" in sidebar
   → Verify checkout interface loads
   ```

2. **Add Products**:
   ```
   → Search for "Milk" in product search
   → Click product card to add to cart
   → Verify cart shows: Product name, quantity (1), price
   → Click "+" button to increase quantity to 2
   → Search and add 2 more products (e.g., "Bread", "Sugar")
   ```

3. **Review Cart**:
   ```
   → Verify cart shows 3 items
   → Check subtotal calculation is correct
   → Note: Tax/discount if applicable
   ```

4. **Process Payment**:
   ```
   → Click "Checkout" button
   → Select payment method: "Cash"
   → Enter amount tendered: [amount > total]
   → Click "Complete Payment"
   → Verify change calculated correctly
   → Verify success message: "Order completed successfully"
   ```

5. **View Receipt**:
   ```
   → Verify receipt modal appears
   → Check receipt contains:
     - Order number
     - Date/time
     - Product list with quantities and prices
     - Subtotal, tax, total
     - Payment method
     - Change given
   → Click "Print Receipt" (optional)
   → Close receipt modal
   ```

**✅ Success Criteria**:
- Cart updates in real-time
- Total calculation is accurate
- Payment processes without errors
- Receipt generates correctly

---

### Test 1.2: Multi-Lane Checkout ✅
**Duration**: 3 minutes  
**Goal**: Show concurrent multi-lane capabilities

#### Steps:
1. **Open First Lane**:
   ```
   → Click "Lane 1" dropdown in header
   → Select "Lane 1" (if not already selected)
   → Add 2 products to cart
   → DO NOT checkout yet
   ```

2. **Switch to Second Lane**:
   ```
   → Click "Lane 1" dropdown
   → Select "Lane 2"
   → Verify cart is EMPTY (new lane)
   → Add 3 different products
   → DO NOT checkout yet
   ```

3. **Switch to Third Lane**:
   ```
   → Click "Lane 2" dropdown
   → Select "Lane 3"
   → Add 1 product
   → Click "Checkout"
   → Complete payment with "M-Pesa"
   → Verify order completes successfully
   ```

4. **Return to Lane 1**:
   ```
   → Click "Lane 3" dropdown
   → Select "Lane 1"
   → Verify cart still has 2 products from step 1
   → Complete checkout with "Cash"
   ```

5. **Verify Lane Metadata**:
   ```
   → Go to "Sales" tab
   → View recent orders
   → Verify orders show correct lane info (Lane 1, Lane 3)
   ```

**✅ Success Criteria**:
- Each lane maintains separate cart state
- Can switch between lanes without losing data
- Orders persist lane information
- No cart conflicts or data loss

---

### Test 1.3: Offline Queue Mode ✅
**Duration**: 5 minutes  
**Goal**: Demonstrate offline resilience

#### Steps:
1. **Enable Offline Mode**:
   ```
   → Open browser DevTools (F12)
   → Go to "Network" tab
   → Check "Offline" checkbox
   → Verify "Offline Mode" badge appears in UI (red/orange)
   ```

2. **Create Offline Orders**:
   ```
   → Add 3 products to cart
   → Click "Checkout"
   → Select payment method: "Cash"
   → Complete payment
   → Verify message: "Order queued for sync (offline)"
   → Verify queue badge shows "1 order pending"
   
   → Create a second offline order with 2 products
   → Verify queue badge shows "2 orders pending"
   ```

3. **View Offline Queue**:
   ```
   → Click "Offline Queue" icon/link
   → Verify modal shows 2 pending orders
   → Check order details (products, total, timestamp)
   → Note: Orders are stored in IndexedDB
   ```

4. **Go Back Online**:
   ```
   → In DevTools Network tab, uncheck "Offline"
   → Verify "Offline Mode" badge disappears
   → Verify "Syncing..." indicator appears
   → Wait for auto-sync (5-10 seconds)
   → Verify queue badge shows "0 orders pending"
   → Verify success message: "2 orders synced successfully"
   ```

5. **Verify Orders in Firestore**:
   ```
   → Go to "Sales" tab
   → Verify 2 new orders appear at top
   → Check orders have correct:
     - Products and quantities
     - Totals
     - Payment method
     - Lane information
   ```

**✅ Success Criteria**:
- Orders saved to IndexedDB when offline
- Queue counter updates correctly
- Auto-sync works when back online
- Orders appear in Firestore with correct data
- No data loss or corruption

---

### Test 1.4: Sales Analytics ✅
**Duration**: 2 minutes  
**Goal**: Show real-time analytics

#### Steps:
1. **View Sales Dashboard**:
   ```
   → Click "Sales" tab in sidebar
   → Verify metrics load:
     - Today's Revenue
     - Orders Count
     - Average Order Value
     - Top Payment Method
   ```

2. **Check Recent Orders**:
   ```
   → Scroll to "Recent Orders" table
   → Verify orders from Tests 1.1-1.3 appear
   → Check columns: Order #, Date, Customer, Items, Total, Payment, Status
   → Click on an order to view details
   ```

3. **Filter by Date**:
   ```
   → Select date range: "Today"
   → Verify only today's orders show
   → Select "This Week"
   → Verify more orders appear
   ```

4. **Payment Method Breakdown**:
   ```
   → View "Payment Methods" chart/table
   → Verify breakdown shows:
     - Cash: X orders, KES Y
     - M-Pesa: X orders, KES Y
     - Credit: X orders, KES Y (if any)
   ```

**✅ Success Criteria**:
- All metrics calculate correctly
- Recent orders update in real-time
- Filters work as expected
- Payment breakdown is accurate

---

### Test 1.5: Barcode Scanner (Optional) ⚡
**Duration**: 2 minutes  
**Goal**: Show hardware integration

#### Steps:
1. **Enable Scanner Mode**:
   ```
   → Click "Scan Mode" toggle/button
   → Verify search input shows "Scan barcode..."
   ```

2. **Scan Products**:
   ```
   → Use USB barcode scanner
   → Scan product barcode
   → Verify product adds to cart instantly
   → Scan 2 more products
   → Verify cart updates in real-time
   ```

3. **Complete Order**:
   ```
   → Checkout with any payment method
   → Verify order completes successfully
   ```

**✅ Success Criteria**:
- Scanner detected by browser
- Products add instantly after scan
- No manual search needed
- Fast checkout workflow

---

## 💳 Part 2: Credit System (20 minutes)

### Test 2.1: Credit Application ✅
**Duration**: 4 minutes  
**Goal**: Demonstrate retailer credit application

#### Steps:
1. **Navigate to Credit Application**:
   ```
   → Click "Credit" in sidebar
   → Click "Apply for Credit" button
   → Verify 5-step form loads
   ```

2. **Step 1: Business Information**:
   ```
   → Business Name: "Demo Retail Store"
   → Business Type: "Retail Shop"
   → KRA PIN: "A123456789X"
   → Business Registration: "BN/12345/2020"
   → Years in Business: "3"
   → Click "Next"
   ```

3. **Step 2: Contact Information**:
   ```
   → Owner Name: "John Doe"
   → Phone: "+254712345678"
   → Email: "john@demostore.co.ke"
   → Physical Address: "123 Main St, Nairobi"
   → Click "Next"
   ```

4. **Step 3: Financial Information**:
   ```
   → Monthly Revenue: "500000" (KES)
   → Monthly Expenses: "350000" (KES)
   → Existing Loans: "No" or enter amount
   → Bank Account: "12345678" (KCB)
   → Click "Next"
   ```

5. **Step 4: Document Upload**:
   ```
   → Upload KRA PIN Certificate (PDF/image)
   → Upload Business Certificate (PDF/image)
   → Upload ID Copy (image)
   → Upload Bank Statement (PDF) - optional
   → Verify all files show green checkmarks
   → Click "Next"
   ```

6. **Step 5: Terms & Signature**:
   ```
   → Check "I consent to CRB check"
   → Check "I agree to auto-debit M-Pesa"
   → Check "I accept Terms & Conditions"
   → Click "Sign Here" box
   → Draw signature with mouse/touch
   → Click "Submit Application"
   → Verify success message: "Application submitted successfully"
   ```

**✅ Success Criteria**:
- All form steps validate properly
- Document uploads work (Firebase Storage)
- Signature capture works
- Application saved to Firestore
- Confirmation message displays

---

### Test 2.2: Admin Credit Review ✅
**Duration**: 3 minutes  
**Goal**: Show admin credit management

#### Steps:
1. **Switch to Admin Account**:
   ```
   → Logout of retailer account
   → Login as admin@vendai.demo
   → Navigate to "Admin" → "Credit Management"
   ```

2. **View Credit Applications**:
   ```
   → Click "Applications" tab
   → Verify pending application from Test 2.1 appears
   → Check application shows:
     - Retailer name
     - Requested amount
     - Credit score (auto-calculated)
     - Status: "Pending Review"
   ```

3. **Review Application Details**:
   ```
   → Click "View Details" on application
   → Verify modal shows:
     - Business information
     - Contact details
     - Financial data
     - Uploaded documents (clickable)
     - Credit score breakdown (6 components)
     - Recommended credit limit
   ```

4. **Approve Application**:
   ```
   → Review credit score: Should be 40-60 (Starter tier)
   → Recommended limit: KES 100,000
   → Adjust limit if needed: Enter "100000"
   → Select loan term: "6 months"
   → Interest rate: "12%" annually
   → Click "Approve Application"
   → Verify confirmation dialog
   → Click "Confirm Approval"
   → Verify success message: "Credit facility created"
   ```

5. **Verify Credit Facility Created**:
   ```
   → Click "Facilities" tab
   → Verify new credit facility appears with:
     - Retailer name: "Demo Retail Store"
     - Approved Amount: KES 100,000
     - Available Credit: KES 100,000
     - Outstanding Balance: KES 0
     - Status: "Active"
     - Tier: "Starter"
   ```

**✅ Success Criteria**:
- Admin can view all applications
- Credit score displays correctly
- Approval workflow works
- Credit facility created in Firestore
- Status updates properly

---

### Test 2.3: "Pay with Credit" Flow ✅
**Duration**: 5 minutes  
**Goal**: Demonstrate credit disbursement

#### Steps:
1. **Switch Back to Retailer Account**:
   ```
   → Logout of admin
   → Login as retailer@vendai.demo
   → Navigate to "Suppliers" or "Inventory"
   ```

2. **View Credit Balance Widget**:
   ```
   → Verify credit widget appears (top-right or sidebar)
   → Check widget shows:
     - Available Credit: KES 100,000
     - Outstanding Balance: KES 0
     - Credit Utilization: 0%
     - Next Payment: N/A
   ```

3. **Create Supplier Order**:
   ```
   → Click "Suppliers" → "Place Order"
   → Select supplier: "Demo Wholesale Ltd"
   → Add products:
     - Product 1: 50 units @ KES 800 = KES 40,000
     - Product 2: 30 units @ KES 500 = KES 15,000
   → Order Total: KES 55,000
   → Click "Continue to Payment"
   ```

4. **Select Credit Payment**:
   ```
   → Payment method selector appears
   → Select "Pay with Credit"
   → Verify credit check runs
   → Verify message: "Available credit: KES 100,000"
   → Verify message: "This order will use KES 55,000 (55% utilization)"
   → Click "Confirm Payment with Credit"
   ```

5. **Process Credit Disbursement**:
   ```
   → Verify loading indicator: "Processing disbursement..."
   → Wait 2-3 seconds (API call to Pezesha sandbox)
   → Verify success message: "Order placed successfully! Credit disbursed."
   → Check order confirmation shows:
     - Order Number: #ORD-XXXXX
     - Payment Method: "Credit"
     - Amount: KES 55,000
   ```

6. **Verify Credit Balance Updated**:
   ```
   → Return to dashboard
   → Check credit widget now shows:
     - Available Credit: KES 45,000 (100K - 55K)
     - Outstanding Balance: KES 55,000
     - Credit Utilization: 55%
     - Next Payment: [Date in 30 days]
   ```

7. **View Disbursement History**:
   ```
   → Click "Credit" → "Disbursements"
   → Verify disbursement appears:
     - Date: Today
     - Supplier: "Demo Wholesale Ltd"
     - Amount: KES 55,000
     - Status: "Completed"
     - Reference: [Pezesha transaction ID]
   ```

**✅ Success Criteria**:
- Credit balance widget displays correctly
- Credit check validates before order
- Disbursement processes successfully
- Balances update in real-time
- Order created with "Credit" payment method
- Pezesha API integration works

---

### Test 2.4: Repayment Schedule ✅
**Duration**: 3 minutes  
**Goal**: Show repayment tracking and UI

#### Steps:
1. **Navigate to Repayments**:
   ```
   → Click "Credit" → "Repayments"
   → Verify repayment schedule page loads
   ```

2. **View Summary Metrics**:
   ```
   → Check 4 metric cards at top:
     - Total Due: KES X (sum of pending payments)
     - Overdue: KES 0 (no overdue yet)
     - Next Payment: KES Y (due in Z days)
     - Total Paid: KES 0 (no payments yet)
   ```

3. **View Repayment Table**:
   ```
   → Verify table shows installments:
     - Installment #1: Due in 30 days, KES X
     - Installment #2: Due in 60 days, KES Y
     - ... (up to 6 installments for 6-month term)
   → Check columns: Due Date, Installment #, Principal, Interest, Total, Status, Action
   → Verify status badges:
     - Blue "Upcoming" for future payments
     - No red "Overdue" yet
   ```

4. **Filter Repayments**:
   ```
   → Click "Upcoming" filter button
   → Verify only upcoming payments show
   → Click "All" to reset
   ```

5. **View Payment Details**:
   ```
   → Hover over an installment row
   → Verify countdown appears: "Due in 30 days" (or similar)
   → Note color coding:
     - Gray: >7 days away
     - Yellow: 1-7 days away
     - Orange: Due today
     - Red: Overdue
   ```

**✅ Success Criteria**:
- Repayment schedule displays correctly
- Summary metrics calculate properly
- Installments show correct amounts (principal + interest)
- Status badges color-coded appropriately
- Filters work as expected

---

### Test 2.5: M-Pesa Repayment ✅
**Duration**: 5 minutes  
**Goal**: Demonstrate M-Pesa STK Push payment

#### Steps:
1. **Initiate Payment**:
   ```
   → On repayment schedule page
   → Click "Make Payment" button on first installment
   → Verify payment modal opens
   ```

2. **Select M-Pesa Payment**:
   ```
   → Payment method: "M-Pesa" (default)
   → Verify installment details show:
     - Installment #: 1
     - Amount Due: KES X
     - Due Date: [Date]
   → Enter phone number: "254712345678"
   → Verify phone format validation (254XXXXXXXXX)
   → Click "Pay with M-Pesa"
   ```

3. **M-Pesa STK Push**:
   ```
   → Verify loading indicator: "Initiating M-Pesa payment..."
   → Wait 2-3 seconds
   → Verify success message: "STK push sent to 254712345678"
   → Verify instructions: "Check your phone for M-Pesa prompt"
   → Note: In demo, actual STK won't arrive (sandbox mode)
   ```

4. **Simulate Successful Payment** (Manual Webhook Trigger):
   ```
   → For demo purposes, manually mark as paid:
   → Close payment modal
   → In admin panel, go to "Credit" → "Transactions"
   → Find pending M-Pesa transaction
   → Click "Mark as Successful" (admin override for demo)
   → OR wait 30 seconds for sandbox callback
   ```

5. **Verify Payment Recorded**:
   ```
   → Return to repayment schedule
   → Verify first installment now shows:
     - Status: Green "Paid" badge
     - Paid Date: Today
     - Payment Method: M-Pesa
   → Check summary metrics updated:
     - Total Paid: KES X (increased)
     - Total Due: KES Y (decreased)
   → Verify payment appears in "Payment History" section at bottom
   ```

6. **Check Credit Balance Updated**:
   ```
   → Return to dashboard
   → Verify credit widget updated:
     - Outstanding Balance: Decreased by payment amount
     - Available Credit: Increased by payment amount
     - Credit Utilization: Decreased
   ```

**✅ Success Criteria**:
- M-Pesa payment modal works
- Phone number validation works
- STK push initiates successfully
- Transaction recorded in Firestore
- Repayment schedule updates
- Credit balance recalculates
- Payment history shows completed payment

---

## 📊 Part 3: Analytics & Admin (10 minutes)

### Test 3.1: Admin Dashboard Overview ✅
**Duration**: 3 minutes  
**Goal**: Show comprehensive admin view

#### Steps:
1. **Login as Admin**:
   ```
   → Login as admin@vendai.demo
   → Navigate to "Admin Dashboard"
   ```

2. **View Platform Metrics**:
   ```
   → Verify top-level KPIs:
     - Total Organizations: X
     - Active Credit Facilities: Y
     - Total Credit Disbursed: KES Z
     - Outstanding Credit: KES W
     - Average Credit Score: XX
   ```

3. **View Credit Portfolio**:
   ```
   → Scroll to "Credit Portfolio" section
   → Verify tier breakdown chart:
     - Starter: X retailers (0-54 score)
     - Growth: Y retailers (55-69 score)
     - Scale: Z retailers (70-84 score)
     - Elite: W retailers (85-100 score)
   ```

4. **View Recent Activity**:
   ```
   → Check "Recent Activity" timeline:
     - New credit applications
     - Disbursements today
     - Repayments received
     - Overdue payments
   → Verify real-time updates
   ```

**✅ Success Criteria**:
- All metrics load correctly
- Tier distribution displays
- Activity timeline updates
- No errors in console

---

### Test 3.2: Credit Score Details ✅
**Duration**: 3 minutes  
**Goal**: Show credit scoring transparency

#### Steps:
1. **View Credit Scores**:
   ```
   → In Admin Dashboard, click "Credit Scores" tab
   → Verify table shows all retailers with credit
   → Columns: Retailer, Score, Tier, Limit, Utilization, Last Updated
   ```

2. **View Score Breakdown**:
   ```
   → Click "View Details" on a retailer
   → Verify score breakdown modal shows 6 components:
     1. Business Tenure (20 points max)
     2. Sales Velocity (20 points max)
     3. Transaction Consistency (15 points max)
     4. Payment History (25 points max)
     5. Credit Utilization (10 points max)
     6. Dispute Rate (10 points max)
   → Check each component shows:
     - Current score
     - Maximum possible
     - Description
     - Data source (e.g., "90 days of sales data")
   ```

3. **View Recommendations**:
   ```
   → Scroll to "Recommendations" section
   → Verify AI-generated suggestions:
     - "Increase limit to KES X based on payment history"
     - "Monitor: Late payment detected 2 weeks ago"
     - "Reward: 6 consecutive on-time payments"
   ```

4. **View Score History**:
   ```
   → Scroll to "Score History" chart
   → Verify line graph shows score over time
   → Hover over data points to see exact scores
   → Check timeline matches payment events
   ```

**✅ Success Criteria**:
- Score breakdown displays all 6 components
- Recommendations are relevant
- Score history chart renders
- Data matches Firestore records

---

### Test 3.3: Payment Reminders (Simulated) ⚡
**Duration**: 2 minutes  
**Goal**: Show automated reminder system

#### Steps:
1. **View Communication Jobs**:
   ```
   → In Admin Dashboard, click "Communications" tab
   → Verify table shows scheduled reminders:
     - Type: "Payment Reminder" or "Overdue Notification"
     - Recipient: Retailer name
     - Channel: "SMS + Email"
     - Status: "Pending" or "Sent"
     - Scheduled For: Date/time
   ```

2. **Preview Reminder Message**:
   ```
   → Click "Preview" on a pending reminder
   → Verify SMS preview shows:
     - "Hi [Name], your credit payment of KES X is due in Y days..."
   → Verify email preview shows:
     - Professional HTML template
     - Payment details
     - Call-to-action button
     - VendAI branding
   ```

3. **Manually Trigger Reminder** (Optional):
   ```
   → Click "Send Now" on a pending reminder
   → Verify status changes to "Sent"
   → Check logs show SMS/email sent (sandbox mode)
   ```

**✅ Success Criteria**:
- Communication jobs display
- Message templates render correctly
- Manual send works (if enabled)
- Logs show activity

---

### Test 3.4: Reports & Exports ✅
**Duration**: 2 minutes  
**Goal**: Show data export capabilities

#### Steps:
1. **Generate Credit Report**:
   ```
   → Click "Reports" → "Credit Summary"
   → Select date range: "Last 30 Days"
   → Click "Generate Report"
   → Verify report shows:
     - Total disbursements: KES X
     - Total repayments: KES Y
     - Active facilities: Z
     - Default rate: W%
   ```

2. **Export Data**:
   ```
   → Click "Export as CSV" button
   → Verify CSV downloads with columns:
     - Retailer, Credit Limit, Outstanding, Utilization, Score, Status
   → Open CSV in Excel/Sheets to verify data
   ```

3. **View Audit Log**:
   ```
   → Click "Audit Log" tab
   → Verify log shows all admin actions:
     - "Admin approved credit application for [Retailer]"
     - "Admin updated credit limit from X to Y"
     - "System recalculated credit score for [Retailer]"
   → Check timestamps and user info are correct
   ```

**✅ Success Criteria**:
- Reports generate without errors
- CSV export works
- Data is accurate
- Audit log tracks all actions

---

## 🎬 Demo Script (Recommended Flow)

### Opening (2 minutes)
```
"Welcome to VendAI, Kenya's first POS system with embedded credit. 
Today I'll show you three key capabilities:

1. Robust POS operations with offline support
2. Complete credit lifecycle from application to repayment
3. Powerful admin tools for credit management

Let's start with a typical day at a retail shop..."
```

### Act 1: POS Demo (10 minutes)
```
"First, let me show you how fast checkout is..."
→ Run Test 1.1 (Basic Checkout)

"Now, many stores have multiple checkout counters..."
→ Run Test 1.2 (Multi-Lane)

"But what happens when internet goes down? Watch this..."
→ Run Test 1.3 (Offline Mode)

"And here's how retailers track their performance..."
→ Run Test 1.4 (Sales Analytics)
```

### Act 2: Credit Demo (20 minutes)
```
"Now, the game-changer: embedded credit. 
Retailers can apply directly in the app..."
→ Run Test 2.1 (Credit Application)

"On the admin side, we use AI-powered scoring..."
→ Run Test 2.2 (Admin Review)

"Once approved, retailers can instantly pay suppliers with credit..."
→ Run Test 2.3 (Pay with Credit)

"Repayment tracking is transparent and easy..."
→ Run Test 2.4 (Repayment Schedule)

"And we support M-Pesa for convenient payments..."
→ Run Test 2.5 (M-Pesa Payment)
```

### Act 3: Admin Tools (8 minutes)
```
"Let me show you the admin view..."
→ Run Test 3.1 (Dashboard)

"Every credit decision is data-driven..."
→ Run Test 3.2 (Credit Scores)

"We automate reminders to ensure on-time payments..."
→ Run Test 3.3 (Reminders)

"And you can export everything for analysis..."
→ Run Test 3.4 (Reports)
```

### Closing (5 minutes)
```
"So in summary, VendAI delivers:
- ✅ Reliable POS even offline
- ✅ Instant credit for inventory purchases
- ✅ Automated repayment collection
- ✅ AI-powered risk management

Questions?"
```

---

## 🐛 Troubleshooting

### Common Issues

#### Issue: Products Not Loading
**Symptoms**: Empty product list in POS  
**Solution**:
```
→ Check Firestore connection
→ Verify products exist in Firestore: /products collection
→ Check browser console for errors
→ Refresh page (Ctrl+R)
```

#### Issue: Offline Mode Not Working
**Symptoms**: Orders fail when offline  
**Solution**:
```
→ Check IndexedDB is enabled in browser
→ Clear browser cache and reload
→ Verify "Enable Offline Mode" setting is ON in app settings
→ Check console for IndexedDB errors
```

#### Issue: Credit Application Fails
**Symptoms**: Error on application submission  
**Solution**:
```
→ Verify all required fields filled
→ Check file uploads completed (green checkmarks)
→ Ensure organization has no existing active application
→ Check Firestore rules allow write to credit_applications
```

#### Issue: M-Pesa Payment Not Working
**Symptoms**: STK push fails or doesn't arrive  
**Solution**:
```
→ Verify M-Pesa credentials in .env.local
→ Check phone number format: 254XXXXXXXXX
→ Confirm M-Pesa sandbox is active
→ For demo: Use manual payment or admin override
→ Check logs: firebase functions:log
```

#### Issue: Credit Balance Not Updating
**Symptoms**: Widget shows stale data  
**Solution**:
```
→ Refresh page to trigger Firestore listener
→ Check credit_facilities document exists
→ Verify recent disbursement/payment saved correctly
→ Check browser console for listener errors
```

#### Issue: Dashboard Metrics Wrong
**Symptoms**: Numbers don't match reality  
**Solution**:
```
→ Check date range filter (Today vs All Time)
→ Verify Firestore queries returning correct data
→ Clear cache and reload
→ Check for pending offline orders not yet synced
```

---

## 📝 Post-Demo Checklist

### Immediate Actions
- [ ] **Gather Feedback**: Note questions, concerns, feature requests
- [ ] **Fix Demo Issues**: Document any bugs encountered
- [ ] **Update Test Data**: Clean up demo orders/applications
- [ ] **Export Logs**: Save Firebase logs for review

### Follow-Up Actions
- [ ] **Send Demo Recording**: Share video with stakeholders
- [ ] **Create Feature Comparison**: VendAI vs Competitors
- [ ] **Prepare Pricing Proposal**: Based on feedback
- [ ] **Schedule Pilot**: If demo successful

### Metrics to Track
- [ ] Demo duration vs planned (45 min target)
- [ ] Number of questions asked (interest level)
- [ ] Features that impressed most (for marketing)
- [ ] Technical issues encountered (for fixes)
- [ ] Stakeholder sentiment (positive/neutral/negative)

---

## 🚀 Advanced Demo Scenarios (Optional)

### Scenario A: High-Volume Store
**Duration**: 5 minutes  
**Goal**: Show scalability

```
→ Open 5 lanes simultaneously
→ Process 10 orders in 2 minutes
→ Show real-time analytics updating
→ Demonstrate no performance degradation
```

### Scenario B: Credit Default Simulation
**Duration**: 3 minutes  
**Goal**: Show risk management

```
→ Create repayment schedule with overdue payment
→ Show overdue notification sent
→ Demonstrate credit limit freeze
→ Show admin escalation workflow
```

### Scenario C: Credit Limit Increase
**Duration**: 3 minutes  
**Goal**: Show growth incentives

```
→ Make 3 on-time payments
→ Trigger credit score recalculation
→ Show score improved from Starter (50) to Growth (65)
→ Demonstrate auto-limit increase (100K → 250K)
```

### Scenario D: Multi-Organization Management
**Duration**: 3 minutes  
**Goal**: Show enterprise scalability

```
→ Switch between 3 different organizations
→ Show separate credit facilities
→ Demonstrate cross-org analytics
→ Show organization-level settings
```

---

## 📞 Support During Demo

### Technical Support Contacts
```
Developer: [Your phone/email]
Firebase Console: https://console.firebase.google.com
M-Pesa Sandbox: https://developer.safaricom.co.ke
```

### Backup Plans
1. **Internet Failure**: Use offline mode exclusively
2. **Firestore Down**: Use cached data and screen recordings
3. **M-Pesa Failure**: Demonstrate with manual payments instead
4. **Browser Crash**: Have second browser/device ready

### Emergency Reset
```bash
# Clear all demo data and reset
firebase firestore:delete /organizations/demo-org/orders --recursive
firebase firestore:delete /organizations/demo-org/credit_applications --recursive

# Recreate sample data
npm run seed-demo-data
```

---

## 🎓 Demo Best Practices

### Do's ✅
- ✅ **Practice first**: Run through entire flow 2-3 times before demo
- ✅ **Have backup data**: Pre-create orders, applications, etc.
- ✅ **Use realistic numbers**: KES 50K-100K orders, not KES 1M
- ✅ **Tell a story**: "Imagine you're Jane, a shop owner..."
- ✅ **Pause for questions**: Don't rush through features
- ✅ **Show, don't tell**: Click buttons, show real UI
- ✅ **Highlight differentiators**: Offline mode, embedded credit

### Don'ts ❌
- ❌ **Don't wing it**: Always follow a script
- ❌ **Don't skip errors**: Acknowledge and troubleshoot live
- ❌ **Don't use developer jargon**: Say "credit score" not "Firestore query"
- ❌ **Don't go too fast**: Stakeholders need time to process
- ❌ **Don't overload**: 3 key points, not 10
- ❌ **Don't apologize for UI**: If something looks rough, don't mention it
- ❌ **Don't promise vaporware**: Only demo what's built

---

## 📊 Success Metrics

### Demo Success Indicators
- ✅ All tests pass without errors
- ✅ Demo completed within 50 minutes
- ✅ Stakeholders understood credit flow
- ✅ At least 3 positive comments
- ✅ No critical bugs discovered

### Red Flags
- ❌ Multiple technical failures
- ❌ Confused stakeholders
- ❌ Negative feedback on UI/UX
- ❌ Questions about basic functionality
- ❌ Concerns about stability

---

## 🎯 Next Steps After Successful Demo

1. **Immediate** (Day 1):
   - Send thank you email with demo recording
   - Share pricing proposal
   - Schedule follow-up call

2. **Short-term** (Week 1):
   - Address all questions/concerns raised
   - Prepare pilot agreement
   - Identify 10 pilot retailers

3. **Long-term** (Month 1):
   - Launch pilot with 10 retailers
   - Gather feedback
   - Iterate on features
   - Prepare for full launch

---

**Demo Owner**: [Your Name]  
**Last Tested**: October 13, 2025  
**Next Review**: Before each demo  
**Feedback**: [Your email for suggestions]

---

🎉 **Good luck with your demo! You've got this!** 🚀
