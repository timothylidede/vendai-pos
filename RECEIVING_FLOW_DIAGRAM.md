# Supplier Receiving Flow — Visual Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUPPLIER RECEIVING FLOW - ARCHITECTURE                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: CREATE PURCHASE ORDER (Retailer)                                     │
└──────────────────────────────────────────────────────────────────────────────┘

  Retailer (Supplier Module)
         │
         │ Browse catalog, add to cart
         ▼
   ┌──────────────┐
   │  Cart Items  │
   │  Coke: 50    │
   │  Rice: 100   │
   └──────────────┘
         │
         │ Click "Place Order"
         ▼
   ┌─────────────────────────────────────┐
   │  POST /api/supplier/purchase-orders │
   └─────────────────────────────────────┘
         │
         │ Groups by distributor
         ▼
   ┌────────────────────────┐
   │   Firestore Write      │
   │  purchase_orders/po_1  │
   │  - orgId: org_xyz      │
   │  - supplierId: sam-west│
   │  - lines: [...]        │
   │  - status: submitted   │
   └────────────────────────┘
         │
         │ Returns PO ID
         ▼
   ┌────────────────────────┐
   │   Toast Notification   │
   │  "2 POs created        │
   │   totaling KES 45,000" │
   └────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: RECEIVE DELIVERY (Warehouse/Stock Clerk)                             │
└──────────────────────────────────────────────────────────────────────────────┘

  Warehouse Staff
         │
         │ Click "Receive" button
         ▼
   ┌─────────────────┐
   │ Receiving Modal │
   │ Enter PO Number │
   └─────────────────┘
         │
         │ Fetch PO details
         ▼
   ┌──────────────────────────┐
   │  getPurchaseOrder(poId)  │
   └──────────────────────────┘
         │
         ▼
   ┌────────────────────────────┐
   │  Display PO Details        │
   │  - Supplier: Sam West      │
   │  - Total: KES 129,500      │
   │  - Lines:                  │
   │    • Rice: 100 ordered     │
   │             0 received     │
   │            100 remaining   │
   └────────────────────────────┘
         │
         │ Enter received quantities
         ▼
   ┌────────────────────────────┐
   │  User Input                │
   │  Rice: 98 (2 damaged)      │
   └────────────────────────────┘
         │
         │ Click "Confirm Receipt"
         ▼
   ┌────────────────────────────┐
   │ POST /api/supplier/receiving│
   └────────────────────────────┘
         │
         ▼
   ┌─────────────────────────────────────────────────────────┐
   │           FIRESTORE TRANSACTION (Atomic)                 │
   │                                                          │
   │  1. Read PO document                                     │
   │     - Validate orgId, status                             │
   │                                                          │
   │  2. For each received line:                              │
   │     a) Read inventory/{orgId}_{productId}                │
   │     b) Convert pieces to qtyBase + qtyLoose              │
   │        Example: 98 pieces, unitsPerBase=24               │
   │        → qtyBase = 4 cartons                             │
   │        → qtyLoose = 2 pieces                             │
   │     c) Update inventory document                         │
   │                                                          │
   │  3. Update PO document:                                  │
   │     - lines[].quantityReceived += received               │
   │     - status = "partially_received" or "received"        │
   │     - receivedAt = now()                                 │
   │                                                          │
   │  4. Create ledger entry:                                 │
   │     - type: COGS                                         │
   │     - amount = Σ(qty × unitPrice)                        │
   │     - poId, supplierId, productIds                       │
   │                                                          │
   │  ✅ All succeed together or all fail                     │
   └─────────────────────────────────────────────────────────┘
         │
         │ Transaction committed
         ▼
   ┌────────────────────────┐
   │   Success Response     │
   │  {                     │
   │    success: true,      │
   │    status: "received", │
   │    inventoryUpdated    │
   │  }                     │
   └────────────────────────┘
         │
         ▼
   ┌────────────────────────┐
   │   Toast Notification   │
   │  "Delivery received    │
   │   and inventory        │
   │   updated"             │
   └────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│ DATA FLOW SUMMARY                                                             │
└──────────────────────────────────────────────────────────────────────────────┘

  Cart Items                   Purchase Orders              Inventory
      │                             │                            │
      │ Place Order                 │                            │
      ├────────────────────────────►│                            │
      │                             │ (status: submitted)        │
      │                             │                            │
      │                             │ Receive Delivery           │
      │                             ├───────────────────────────►│
      │                             │                            │
      │                             │ ◄─────────────────────────┤
      │                             │ (Atomic Transaction)       │
      │                             │                            │
      │                             │ - Update PO status         │
      │                             │ - Increment qtyBase/Loose  │
      │                             │ - Create COGS ledger       │
      │                             │                            │
      │                             ▼                            ▼
                            (status: received)        (Stock increased)


┌──────────────────────────────────────────────────────────────────────────────┐
│ COLLECTIONS STRUCTURE                                                         │
└──────────────────────────────────────────────────────────────────────────────┘

purchase_orders/
├── po_abc123
│   ├── orgId: "org_xyz"
│   ├── supplierId: "sam-west"
│   ├── supplierName: "Sam West Supermarket"
│   ├── lines: [
│   │   {
│   │     productId: "sw-1",
│   │     quantityOrdered: 100,
│   │     quantityReceived: 98,
│   │     unitPrice: 1295
│   │   }
│   ├── ]
│   ├── status: "received"
│   ├── totalAmount: 129500
│   ├── createdAt: Timestamp
│   └── receivedAt: Timestamp

inventory/
├── org_xyz_sw-1
│   ├── orgId: "org_xyz"
│   ├── productId: "sw-1"
│   ├── qtyBase: 4        ← Incremented (cartons)
│   ├── qtyLoose: 2       ← Incremented (pieces)
│   ├── unitsPerBase: 24
│   └── updatedAt: Timestamp

ledger_entries/
├── ledger_xyz789
│   ├── orgId: "org_xyz"
│   ├── type: "COGS"
│   ├── poId: "po_abc123"
│   ├── supplierId: "sam-west"
│   ├── amount: 126910    ← 98 × 1295
│   ├── productIds: ["sw-1"]
│   ├── description: "COGS for PO po_abc123"
│   └── createdAt: Timestamp


┌──────────────────────────────────────────────────────────────────────────────┐
│ UI COMPONENTS                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘

Supplier Module Header:
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back    [Supplier] [Credit]            [Receive] 🛒 (2)          │
└─────────────────────────────────────────────────────────────────────┘
              ↑                               ↑        ↑
              Tabs                      Receive   Cart with
                                        Button     badge

Receiving Modal:
┌─────────────────────────────────────────────────────────────────────┐
│  📦 Receive Delivery                                          [X]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Purchase Order Number: [po_abc123____________]  [Load PO]           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Supplier: Sam West Supermarket                                │  │
│  │ Status: submitted         Order Total: KES 129,500            │  │
│  │ Expected: 2025-10-15                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Items to Receive:                                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 10KG ABABIL Rice                                              │  │
│  │ Ordered: 100 PCS • Received: 0 • Remaining: 100 PCS           │  │
│  │                                           [-] [98] [+]         │  │
│  │ ✓ Receiving 98 PCS (KES 126,910)                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Receiving Total: 98 items    Value: KES 126,910               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [Cancel]                      [✓ Confirm Receipt]                  │
└─────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│ STATUS TRANSITIONS                                                            │
└──────────────────────────────────────────────────────────────────────────────┘

    draft
      │
      │ Submit
      ▼
  submitted ──────────┐
      │               │
      │ Receive some  │ Cancel
      ▼               │
partially_received    │
      │               │
      │ Receive rest  │
      ▼               ▼
  received        cancelled


┌──────────────────────────────────────────────────────────────────────────────┐
│ INVENTORY MATH EXAMPLE                                                        │
└──────────────────────────────────────────────────────────────────────────────┘

Product: Rice 10KG
unitsPerBase: 24 (24 pieces per carton)

Initial Stock:
  qtyBase = 2 cartons
  qtyLoose = 5 pieces
  Total = 2×24 + 5 = 53 pieces

Receive 98 pieces:
  New total = 53 + 98 = 151 pieces
  New qtyBase = 151 ÷ 24 = 6 cartons (floor)
  New qtyLoose = 151 % 24 = 7 pieces

Final Stock:
  qtyBase = 6 cartons
  qtyLoose = 7 pieces
  Total = 6×24 + 7 = 151 pieces ✓


┌──────────────────────────────────────────────────────────────────────────────┐
│ API ENDPOINTS                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘

POST /api/supplier/purchase-orders
  ├─ Input: CreatePurchaseOrderRequest
  ├─ Auth: Firebase currentUser required
  ├─ Validation: lines, prices, orgId
  └─ Output: { success: true, poId: "po_123" }

POST /api/supplier/receiving
  ├─ Input: ReceiveDeliveryRequest
  ├─ Auth: Firebase currentUser required
  ├─ Transaction: Atomic PO + Inventory + Ledger update
  └─ Output: { success: true, status: "received", inventoryUpdated: [...] }


┌──────────────────────────────────────────────────────────────────────────────┐
│ SECURITY CHECKS                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

✅ Auth: Firebase currentUser checked in all routes
✅ OrgId: Validated to prevent cross-org access
✅ Status: PO status checked before receiving
✅ Quantities: Can't receive more than remaining
✅ Transactions: Atomic updates prevent corruption
✅ Validation: Line items, prices, IDs validated


┌──────────────────────────────────────────────────────────────────────────────┐
│ TESTING CHECKLIST                                                             │
└──────────────────────────────────────────────────────────────────────────────┘

□ Create PO from cart
□ View PO in Firestore console
□ Open receiving modal
□ Load PO by number
□ Receive full quantity
□ Check inventory updated
□ Check COGS ledger entry created
□ Verify PO status = "received"
□ Try partial receipt
□ Receive remaining
□ Try over-receiving (should block)
□ Try receiving cancelled PO (should fail)
□ Try receiving already-received PO (should fail)

```
