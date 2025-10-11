# Manual Firestore Index Creation for Webhook System

**Date**: October 11, 2025  
**Status**: Requires Manual Setup

---

## Issue

The webhook system indexes couldn't be automatically deployed via `firebase deploy --only firestore:indexes` due to formatting constraints in the Firebase CLI. These indexes must be created manually in the Firebase Console.

---

## Required Indexes

### 1. `pos_webhook_configs` Collection

#### Index 1: orgId + enabled
```
Collection: pos_webhook_configs
Fields indexed:
  - orgId (Ascending)
  - enabled (Ascending)
Query scope: Collection
```

#### Index 2: orgId + enabled + events (array-contains)
```
Collection: pos_webhook_configs  
Fields indexed:
  - orgId (Ascending)
  - enabled (Ascending)
  - events (Array-contains)
Query scope: Collection
```

### 2. `pos_sync_logs` Collection

#### Index 3: orgId + createdAt
```
Collection: pos_sync_logs
Fields indexed:
  - orgId (Ascending)
  - createdAt (Descending)
Query scope: Collection
```

#### Index 4: status + nextRetryAt (for retry worker)
```
Collection: pos_sync_logs
Fields indexed:
  - status (Ascending)
  - nextRetryAt (Ascending)
Query scope: Collection
```

---

## How to Create Indexes in Firebase Console

### Step 1: Navigate to Firestore Database
1. Go to https://console.firebase.google.com/project/vendai-fa58c/firestore
2. Click on the "Indexes" tab

### Step 2: Create Composite Index
1. Click "Create Index" button
2. Select the collection (e.g., `pos_webhook_configs`)
3. Add fields:
   - Click "Add field"
   - Select field name from dropdown
   - Choose sort order (Ascending/Descending) or Array-contains
4. Set "Query scope" to "Collection"
5. Click "Create"

### Step 3: Wait for Index to Build
- Indexes typically build in 1-5 minutes for empty collections
- Check status in the Indexes tab (will show "Building..." then "Enabled")

---

## Alternative: Auto-Create via Query

When you run a query that needs an index, Firestore will provide a link to auto-create it:

1. Try running the webhook system (create a webhook config)
2. When a query fails, check browser console for error message
3. Click the provided Firebase Console link
4. Click "Create Index" button

---

## Required Queries (to trigger auto-index creation)

### Query 1: Get active webhooks for event type
```typescript
import { collection, query, where, getDocs } from 'firebase/firestore'

const q = query(
  collection(db, 'pos_webhook_configs'),
  where('orgId', '==', 'your-org-id'),
  where('enabled', '==', true),
  where('events', 'array-contains', 'stock.updated')
)

const snap = await getDocs(q)
// This will fail and provide index creation link
```

### Query 2: Get webhook logs for org
```typescript
const q = query(
  collection(db, 'pos_sync_logs'),
  where('orgId', '==', 'your-org-id'),
  orderBy('createdAt', 'desc'),
  limit(50)
)

const snap = await getDocs(q)
// This will fail and provide index creation link
```

### Query 3: Get logs for retry worker
```typescript
const q = query(
  collection(db, 'pos_sync_logs'),
  where('status', '==', 'retrying'),
  where('nextRetryAt', '<=', new Date()),
  orderBy('nextRetryAt', 'asc'),
  limit(50)
)

const snap = await getDocs(q)
// This will fail and provide index creation link
```

---

## Verification

After creating indexes, verify they work:

1. Open the Webhook Manager UI in VendAI
2. Create a test webhook configuration
3. Try to fetch webhook logs
4. No errors should appear in browser console

---

## Notes

- The base Firestore indexes (purchase_orders, products, etc.) were successfully deployed
- Only webhook-related indexes need manual creation
- Once created, these indexes will persist and don't need recreation
- Consider adding these to a deployment checklist for new environments

---

## Why Auto-Deployment Failed

The Firebase CLI validation is strict about composite index structures, especially when combining:
- Multiple sort orders (Ascending/Descending)
- Array-contains operations
- Field overrides

The manual approach via Console is more reliable for complex index configurations.
