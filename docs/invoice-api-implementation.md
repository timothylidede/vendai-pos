# Invoice API Implementation Summary

## Overview
Implemented the POST /invoices endpoint as part of the B2B order & payment flow milestone.

## Files Created

### 1. `lib/b2b-invoice-utils.ts`
Utility functions for invoice operations:
- **serializeInvoice**: Converts Firestore timestamps to ISO strings for JSON responses
- **buildInvoiceStatusHistoryEntry**: Creates status history entries with server timestamps
- **calculateInvoiceItemLineTotal**: Computes line totals for invoice items
- **generateInvoiceNumber**: Auto-generates invoice numbers (format: `INV-{SUPPLIER}-{YYYYMM}-{TIMESTAMP}`)
- **calculateDueDate**: Computes due dates based on payment terms (cod, net7, net14, net30, net60)
- **parseIssueDate**: Parses and validates issue dates
- **parseDueDate**: Parses due dates with fallback to auto-calculation

### 2. `app/api/invoices/route.ts`
REST API endpoints for invoice management:

#### GET /api/invoices
Query invoices with filters:
- `?purchaseOrderId={id}` - Filter by purchase order
- `?retailerOrgId={id}` - Filter by retailer organization
- `?supplierOrgId={id}` - Filter by supplier organization
- `?status={status}` - Filter by status (draft, issued, partially_paid, paid, overdue, cancelled)
- `?limit={number}` - Limit results

**Response:**
```json
{
  "success": true,
  "invoices": [...],
  "count": 10
}
```

#### POST /api/invoices
Create a new invoice (typically auto-generated on delivery confirmation):

**Request Body:**
```json
{
  "retailerOrgId": "org_123",
  "supplierOrgId": "org_456",
  "purchaseOrderId": "po_789",
  "retailerId": "user_retailer",
  "retailerName": "Mary's Duka",
  "supplierId": "user_supplier",
  "supplierName": "Acme Distributors",
  "issueDate": "2025-10-03",
  "paymentTerms": "net30",
  "items": [
    {
      "productId": "prod_123",
      "productName": "Coca-Cola 500ml",
      "quantity": 24,
      "unitPrice": 45.00,
      "unit": "bottle"
    }
  ],
  "amount": {
    "subtotal": 1080.00,
    "tax": 172.80,
    "total": 1252.80,
    "currency": "KES"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "invoice": {...},
  "invoiceId": "inv_generated_id"
}
```

**Features:**
- Auto-generates invoice number if not provided
- Auto-calculates line totals for items
- Auto-calculates due date based on payment terms
- Creates initial status history entry
- Sets payment status to "pending"
- Initializes empty payment IDs array

### 3. `lib/validation.ts` (Updated)
Added new Zod schemas:
- **invoiceItemSchema**: Extends purchase order items with lineTotal field
- **invoiceCreateSchema**: Validates invoice creation requests with all required fields

## Integration Points

### With Purchase Orders
- Invoices link to purchase orders via `purchaseOrderId`
- Inherit payment terms, supplier/retailer info from PO
- Can update PO with `relatedInvoiceId` after creation

### With Payments
- Ready for payment webhook integration
- `paymentIds` array tracks related payments
- `paymentStatus` field auto-managed based on payments

### With Firestore
- Uses `invoicesCollection()` from `lib/b2b-order-store.ts`
- Leverages `createInvoice()` helper with automatic timestamps
- Properly serializes Firestore Timestamps for JSON responses

## Data Flow Example

```
1. Supplier marks PO as "fulfilled"
   ↓
2. System triggers POST /api/invoices
   - Copies data from PO
   - Generates invoice number
   - Calculates due date
   - Sets status to "issued"
   ↓
3. Invoice created with link to PO
   ↓
4. PO updated with relatedInvoiceId
   ↓
5. Invoice ready for payment collection
```

## Next Steps (From TODO)

1. **POST /payments/webhook** - Handle M-Pesa/processor callbacks
2. **Invoice status updates** - PATCH endpoint for status changes
3. **Credit engine integration** - Update credit scores on invoice events
4. **Reconciliation logic** - Match invoices to payments and create ledger entries
5. **Frontend wiring** - Display invoices in supplier & payments modules

## Testing Checklist

- [ ] Create invoice from approved PO
- [ ] Auto-generate invoice number
- [ ] Calculate due dates correctly for all payment terms
- [ ] Query invoices by various filters
- [ ] Handle validation errors gracefully
- [ ] Verify Firestore document structure
- [ ] Test with missing optional fields
- [ ] Verify status history creation

## Notes

- Invoice numbers are auto-generated but can be overridden if needed
- Due dates auto-calculate but can be explicitly set
- COD (cash on delivery) has same-day due date
- All dates support string (ISO 8601) or Date objects
- Line totals are auto-calculated (quantity × unitPrice)
- Status history tracks all invoice lifecycle events
