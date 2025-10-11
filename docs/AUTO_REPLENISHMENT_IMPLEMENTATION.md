# Auto-Replenishment System Implementation

**Date:** October 11, 2025  
**Status:** ✅ Core Logic Complete | 🔄 TypeScript Refinement Needed | ⏳ UI Pending

---

## Overview

Implemented an intelligent auto-replenishment system that automatically detects low-stock products and generates purchase order suggestions based on supplier lead times and availability.

---

## Components Created

### 1. Type Definitions (`types/replenishment.ts`)

**ReplenishmentSuggestion**
- Tracks individual product replenishment recommendations
- Fields: productId, currentStock, reorderPoint, suggestedQty, preferredSupplier, priority
- Status workflow: pending → approved/rejected → ordered

**SupplierSKU**
- Maps products to suppliers with pricing and lead time data
- Fields: supplierId, cost, leadTimeDays, minOrderQty, availability

**ReplenishmentSettings**
- Org-level configuration for auto-replenishment behavior
- autoApprove threshold, check frequency, priority thresholds

**ReplenishmentJob**
- Tracks background job execution
- Records products checked, suggestions created, errors encountered

### 2. Core Engine (`lib/replenishment-engine.ts`)

**Key Functions:**

```typescript
// Main replenishment check - analyzes all inventory
generateReplenishmentSuggestions(orgId, settings?)

// Find optimal supplier based on lead time
findBestSupplier(productId, orgId)

// Calculate smart order quantities
calculateSuggestedQty(currentStock, reorderPoint, reorderQty, minOrderQty)

// Priority calculation (critical/high/medium/low)
calculatePriority(currentStock, reorderPoint)

// Workflow management
approveReplenishmentSuggestion(suggestionId, userId)
rejectReplenishmentSuggestion(suggestionId)
markSuggestionOrdered(suggestionId, purchaseOrderId)

// Batch operations
batchApproveAndCreatePO(suggestionIds[], userId, orgId)
```

**Logic Flow:**
1. Fetch all inventory records for organization
2. Fetch all products to check reorder points
3. For each product below reorder point:
   - Find best supplier (lowest lead time, in stock)
   - Calculate suggested order quantity
   - Determine priority level
   - Create suggestion document in Firestore
4. Log job execution metrics

### 3. Data Model Extensions

**POSProduct** (updated in `lib/types.ts`)
```typescript
reorderPoint?: number      // Trigger threshold
reorderQty?: number       // Fixed reorder quantity
preferredSupplierId?: string // Default supplier
```

---

## Firestore Collections

### `replenishment_suggestions`
```
{
  orgId: string
  productId: string
  productName: string
  currentStock: number
  reorderPoint: number
  suggestedQty: number
  preferredSupplierId: string
  preferredSupplierName: string
  supplierLeadTime: number
  unitCost: number
  totalCost: number
  status: 'pending' | 'approved' | 'rejected' | 'ordered'
  createdAt: ISO timestamp
  approvedAt?: ISO timestamp
  approvedBy?: userId
  orderedAt?: ISO timestamp
  purchaseOrderId?: string
  reason: string
  priority: 'low' | 'medium' | 'high' | 'critical'
}
```

**Indexes Needed:**
- `orgId` + `status` + `priority` (DESC) + `createdAt` (DESC)
- `orgId` + `productId` + `createdAt` (DESC)

### `replenishment_jobs`
```
{
  orgId: string
  runAt: ISO timestamp
  status: 'running' | 'completed' | 'failed'
  suggestionsCreated: number
  productsChecked: number
  errors?: string[]
  completedAt?: ISO timestamp
  durationMs?: number
}
```

### `supplier_skus`
```
{
  supplierId: string
  supplierName: string
  productId: string
  supplierSKU: string
  cost: number
  leadTimeDays: number
  minOrderQty: number
  availability: 'in_stock' | 'low_stock' | 'out_of_stock'
  lastUpdated: ISO timestamp
}
```

**Indexes Needed:**
- `productId` + `availability` + `leadTimeDays` (ASC)
- `supplierId` + `productId`

---

## Background Job Implementation

### Option 1: Cloud Function (Recommended)

```typescript
// functions/src/index.ts

export const autoReplenishmentCheck = functions
  .pubsub.schedule('every 24 hours')
  .onRun(async (context) => {
    const orgsSnapshot = await admin.firestore()
      .collection('organizations')
      .where('replenishmentEnabled', '==', true)
      .get()

    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id
      const settings = orgDoc.data().replenishmentSettings

      try {
        await generateReplenishmentSuggestions(orgId, settings)
        console.log(`✅ Replenishment check complete for ${orgId}`)
      } catch (error) {
        console.error(`❌ Replenishment check failed for ${orgId}:`, error)
      }
    }
  })
```

### Option 2: API Route with Cron (Vercel/Next.js)

```typescript
// app/api/cron/replenishment/route.ts

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const results = await runReplenishmentForAllOrgs()
  
  return Response.json({ 
    success: true, 
    orgsProcessed: results.length 
  })
}
```

**Vercel Cron Configuration** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/cron/replenishment",
    "schedule": "0 2 * * *"
  }]
}
```

---

## UI Components Needed

### 1. Replenishment Dashboard (`components/modules/replenishment-dashboard.tsx`)

**Features:**
- Summary cards: Pending suggestions, Critical items, Total cost
- Priority filter tabs (All, Critical, High, Medium, Low)
- Suggestion list with product details, supplier, cost
- Bulk actions: Approve All, Create PO
- Individual actions: Approve, Reject, View Details

**Mock:**
```
┌─────────────────────────────────────────────────┐
│  🔔 12 Pending | 🔴 5 Critical | 💰 $2,340 Total │
├─────────────────────────────────────────────────┤
│ [All] [Critical] [High] [Medium] [Low]          │
├─────────────────────────────────────────────────┤
│ 🔴 Coca-Cola 500ml                              │
│    Current: 5 units | Reorder: 50 units        │
│    Supplier: ABC Distributors (2 days)         │
│    Suggested: 120 units @ $1.20 = $144         │
│    [✓ Approve] [✗ Reject] [📝 Edit]            │
├─────────────────────────────────────────────────┤
│ ...more items...                                 │
└─────────────────────────────────────────────────┘
```

### 2. Product Reorder Settings (`components/product-reorder-settings.tsx`)

Embedded in product edit modal:
```tsx
<div className="border-t pt-4 mt-4">
  <h3>Auto-Replenishment Settings</h3>
  
  <Input
    label="Reorder Point"
    type="number"
    value={reorderPoint}
    onChange={(e) => setReorderPoint(e.target.value)}
    helper="Alert when stock falls below this level"
  />
  
  <Input
    label="Reorder Quantity"
    type="number"
    value={reorderQty}
    onChange={(e) => setReorderQty(e.target.value)}
    helper="Fixed quantity to reorder (leave blank for auto-calculate)"
  />
  
  <Select
    label="Preferred Supplier"
    options={suppliers}
    value={preferredSupplierId}
    onChange={(value) => setPreferredSupplierId(value)}
  />
</div>
```

### 3. Replenishment History (`components/replenishment-history.tsx`)

Shows past suggestions and their outcomes:
- Approved suggestions → linked to PO
- Rejected suggestions with reason
- Ordered suggestions with delivery status

---

## API Endpoints to Create

### `POST /api/replenishment/generate`
Manually trigger replenishment check for org
```typescript
{
  orgId: string
  settings?: Partial<ReplenishmentSettings>
}
→ { suggestions: ReplenishmentSuggestion[], job Id: string }
```

### `GET /api/replenishment/suggestions`
Fetch pending suggestions
```typescript
?orgId=xxx&status=pending&priority=critical
→ { suggestions: ReplenishmentSuggestion[] }
```

### `PATCH /api/replenishment/suggestions/:id`
Approve/reject suggestion
```typescript
{
  action: 'approve' | 'reject'
  userId: string
}
→ { success: boolean, suggestion: ReplenishmentSuggestion }
```

### `POST /api/replenishment/create-po`
Batch create PO from suggestions
```typescript
{
  suggestionIds: string[]
  userId: string
  orgId: string
}
→ { poId: string, suggestions: ReplenishmentSuggestion[] }
```

---

## Firestore Indexes to Deploy

```json
{
  "indexes": [
    {
      "collectionGroup": "replenishment_suggestions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "orgId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "priority", "order": "DESCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "supplier_skus",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "productId", "order": "ASCENDING" },
        { "fieldPath": "availability", "order": "ASCENDING" },
        { "fieldPath": "leadTimeDays", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Deploy:**
```bash
firebase deploy --only firestore:indexes
```

---

## Testing Checklist

- [ ] Create test products with `reorderPoint` set
- [ ] Create matching `supplier_skus` documents
- [ ] Manually trigger `generateReplenishmentSuggestions()`
- [ ] Verify suggestions created with correct priority
- [ ] Test `approveReplenishmentSuggestion()` → status update
- [ ] Test `batchApproveAndCreatePO()` → PO creation
- [ ] Verify `markSuggestionOrdered()` links PO correctly
- [ ] Test with multiple suppliers per product (choose lowest lead time)
- [ ] Test edge cases: no suppliers, all out of stock, min order qty

---

## Next Steps

### Immediate (Phase 1)
1. ✅ Add `reorderPoint`, `reorderQty`, `preferredSupplierId` to POSProduct type
2. ✅ Create replenishment engine logic
3. ⏳ Fix TypeScript errors (db null checks)
4. ⏳ Deploy Firestore indexes
5. ⏳ Create API routes for manual trigger + CRUD
6. ⏳ Build replenishment dashboard UI component

### Short-term (Phase 2)
7. Set up Cloud Function or Vercel cron for daily checks
8. Add notification system (email/in-app) for critical items
9. Build product reorder settings UI in inventory module
10. Create replenishment history/analytics view

### Future Enhancements (Phase 3)
- Predictive reordering based on sales velocity trends
- Multi-supplier comparison (cost vs lead time trade-off)
- Seasonal adjustment factors
- Integration with supplier catalogs for automatic cost updates
- Bulk approval workflows with manager review

---

## Known Issues / TypeScript Errors

**Current Status:**
- Core logic is functionally complete
- TypeScript errors related to `db: Firestore | null` typing
- Need to add null checks or use non-null assertions

**Fix Strategy:**
Either add null checks at function entry:
```typescript
if (!db) throw new Error('Firestore not initialized')
```

Or use getFirestore() directly:
```typescript
import { getFirestore } from 'firebase/firestore'
const firestore = getFirestore()
```

---

## Success Metrics

- **Automation Rate**: % of low-stock items automatically suggested
- **Approval Rate**: % of suggestions approved by buyers
- **Lead Time Reduction**: Days saved by proactive ordering
- **Stockout Prevention**: Reduction in out-of-stock incidents
- **Cost Optimization**: Savings from optimal supplier selection

---

**Implementation complete pending TypeScript refinement and UI development.**
