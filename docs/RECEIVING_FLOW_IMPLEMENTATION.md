# Supplier Receiving Flow — Implementation Guide

**Status**: ✅ Complete  
**Phase**: 1.1 Core Workflow Completion  
**Date**: October 11, 2025

---

## What was implemented

### 1. Purchase Order Types & Data Model
**File**: `types/purchase-orders.ts`

- `PurchaseOrder` interface with status tracking
- `PurchaseOrderLine` for line items with ordered/received quantities
- `CreatePurchaseOrderRequest` and `ReceiveDeliveryRequest` DTOs
- Status flow: `draft` → `submitted` → `confirmed` → `partially_received` → `received` (or `cancelled`)

### 2. Purchase Order Operations Library
**File**: `lib/purchase-order-operations.ts`

Core functions:
- `createPurchaseOrder()` — Create PO from cart
- `getPurchaseOrder()` — Fetch PO by ID
- `listPurchaseOrders()` — Query POs for an org
- `receiveDelivery()` — **Atomic transaction** that:
  - Updates PO line quantities
  - Increments inventory (qtyBase/qtyLoose)
  - Creates COGS ledger entry
  - Updates PO status based on fulfillment

### 3. API Endpoints

#### POST `/api/supplier/purchase-orders`
**File**: `app/api/supplier/purchase-orders/route.ts`

- Creates purchase orders from supplier cart checkout
- Validates line items and prices
- Returns PO ID

**Request body**:
```json
{
  "orgId": "org_123",
  "supplierId": "supplier_abc",
  "supplierName": "Sam West Supermarket",
  "lines": [
    {
      "productId": "prod_1",
      "productName": "Rice 10KG",
      "quantity": 50,
      "unitPrice": 1200,
      "unit": "PCS"
    }
  ],
  "expectedDate": "2025-10-15",
  "notes": "Urgent order"
}
```

**Response**:
```json
{
  "success": true,
  "poId": "po_xyz789",
  "message": "Purchase order created successfully"
}
```

#### POST `/api/supplier/receiving`
**File**: `app/api/supplier/receiving/route.ts`

- Accepts delivery confirmation
- Atomically updates inventory and PO
- Creates COGS ledger entry

**Request body**:
```json
{
  "poId": "po_xyz789",
  "orgId": "org_123",
  "receivedLines": [
    {
      "productId": "prod_1",
      "quantityReceived": 48
    }
  ],
  "notes": "2 units damaged"
}
```

**Response**:
```json
{
  "success": true,
  "poId": "po_xyz789",
  "inventoryUpdated": ["prod_1"],
  "status": "partially_received",
  "message": "Partial delivery received"
}
```

### 4. Receiving UI Component
**File**: `components/modules/receiving-modal.tsx`

Features:
- Scan/enter PO number to load
- Shows PO details (supplier, total, expected date)
- Lists all line items with:
  - Quantity ordered
  - Already received
  - Remaining to receive
- Inline quantity controls (+/- buttons, manual input)
- Prevents over-receiving (can't exceed remaining)
- Shows receiving summary (total items, value)
- Atomic confirm receipt action

### 5. Supplier Module Integration
**File**: `components/modules/supplier-module.tsx`

Updates:
- **Receive Delivery** button in header (blue button with Package icon)
- Cart checkout now creates actual POs via API
- Groups cart by distributor and creates one PO per supplier
- Shows loading state while creating POs
- Success toast with PO count and total value

### 6. Firestore Indexes
**File**: `firestore.indexes.json`

Added indexes for `purchase_orders`:
```json
{
  "collectionGroup": "purchase_orders",
  "fields": [
    { "fieldPath": "orgId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "purchase_orders",
  "fields": [
    { "fieldPath": "orgId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

---

## Firestore Collections

### `purchase_orders`
```typescript
{
  id: string,
  orgId: string,
  supplierId: string,
  supplierName: string,
  lines: [
    {
      productId: string,
      productName: string,
      quantityOrdered: number,
      quantityReceived: number,
      unitPrice: number,
      unit: string,
      lineTotal: number
    }
  ],
  status: 'draft' | 'submitted' | 'confirmed' | 'partially_received' | 'received' | 'cancelled',
  totalAmount: number,
  expectedDate: Timestamp,
  receivedAt?: Timestamp,
  createdAt: Timestamp,
  createdBy: string,
  notes?: string
}
```

### `ledger_entries` (COGS)
```typescript
{
  id: string,
  orgId: string,
  type: 'COGS',
  poId: string,
  supplierId: string,
  amount: number,
  productIds: string[],
  createdAt: Timestamp,
  description: string
}
```

---

## User Flow

### 1. Create Purchase Order (Retailer)
1. Browse supplier catalog in Supplier Module
2. Add products to cart
3. Click cart icon to review
4. Click "Place Order"
5. System creates PO(s) grouped by supplier
6. Toast shows success with PO count

### 2. Receive Delivery (Warehouse/Stock Clerk)
1. Click "Receive" button in Supplier Module header
2. Enter/scan PO number
3. System loads PO details
4. For each line item:
   - See quantities ordered, already received, remaining
   - Enter quantity received (use +/- or type)
5. Review summary (total items, value)
6. Click "Confirm Receipt"
7. System atomically:
   - Updates inventory (qtyBase + qtyLoose)
   - Updates PO status
   - Creates COGS ledger entry
8. Toast confirms success
9. Inventory dashboard reflects new stock

---

## Transaction Safety

The receiving flow uses **Firestore transactions** to ensure:
- ✅ Inventory increments are atomic
- ✅ PO updates and inventory changes happen together or not at all
- ✅ No partial updates on failure
- ✅ COGS ledger entries match actual inventory changes

---

## Testing Checklist

- [ ] Create PO from cart with single supplier
- [ ] Create PO from cart with multiple suppliers (should create separate POs)
- [ ] Receive full delivery (status → `received`, inventory incremented)
- [ ] Receive partial delivery (status → `partially_received`)
- [ ] Receive remaining partial delivery (status → `received`)
- [ ] Try to over-receive (should be prevented by UI)
- [ ] Verify inventory qtyBase/qtyLoose calculation is correct
- [ ] Check COGS ledger entry created with correct amount
- [ ] Try to receive cancelled PO (should fail with error)
- [ ] Try to receive already-received PO (should fail with error)

---

## Deploy Steps

1. **Deploy Firestore indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

2. **Verify collections exist** (will be auto-created):
   - `purchase_orders`
   - `ledger_entries`

3. **Test end-to-end**:
   - Create test org/user
   - Add products to inventory
   - Create PO from supplier cart
   - Use receiving modal to receive delivery
   - Verify inventory updated in Inventory Module

4. **Deploy to production**:
   ```bash
   npm run build
   vercel --prod
   ```

---

## Security Notes

- ✅ All API routes check `auth.currentUser` (Firebase Auth)
- ✅ `orgId` validation prevents cross-org data access
- ✅ PO status validation prevents invalid state transitions
- ✅ Atomic transactions prevent inventory corruption

---

## Future Enhancements

- [ ] Email/SMS notifications when PO created
- [ ] Supplier portal to view and confirm POs
- [ ] Barcode scanning for receiving (scan product barcodes)
- [ ] Photo upload for proof of delivery
- [ ] Damage/shortage workflow (return items, adjust PO)
- [ ] Receiving history and audit log
- [ ] PO approval workflow (manager review before submission)
- [ ] Scheduled deliveries and auto-reminders

---

## Related Files

- Types: `types/purchase-orders.ts`
- Operations: `lib/purchase-order-operations.ts`
- API: `app/api/supplier/purchase-orders/route.ts`, `app/api/supplier/receiving/route.ts`
- UI: `components/modules/receiving-modal.tsx`, `components/modules/supplier-module.tsx`
- Indexes: `firestore.indexes.json`
- Docs: `docs/MODULES_OVERVIEW_POS_INVENTORY_SUPPLIER.md`

---

**Status**: Ready for testing and deployment 🚀
