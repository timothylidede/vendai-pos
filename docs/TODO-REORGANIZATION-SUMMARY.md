# TODO Reorganization Summary

## Changes Made

### 1. Created New Comprehensive TODO (`docs/TODO.md`)
Reorganized and expanded the previous `b2b-order-payment-todo.md` into a complete project TODO list with:

- **Clear categorization** into API, Frontend (Distributor/Retailer sides), Integrations, etc.
- **Specific action items** for each module
- **Removed unnecessary context** - focused purely on actionable tasks
- **Added new requirements** based on user request:
  - Remove hardcoded suppliers from Supplier Module
  - Add search bars to Inventory Module
  - Implement cool pagination effects
  - Make Logistics Module fully functional
  - Make Retailers Module fully functional
  - Remove Retailers tab from Retailer-side Supplier Module

### 2. Deleted Old File
- Removed `docs/b2b-order-payment-todo.md`

---

## Key TODO Items Identified

### High Priority - Immediate Action Needed

#### Supplier Module (Distributor Side)
- **Issue**: Currently has hardcoded supplier data
- **Fix**: Fetch from Firestore `distributors` or `users` collection where role='distributor'
- **Location**: `components/modules/supplier-module.tsx`
- **Related**: Add PO inbox, sales orders, commission dashboard

#### Supplier Module (Retailer Side)
- **Issue**: Has a "Retailers" tab that doesn't make sense for retailers
- **Fix**: Remove the retailers view completely (lines with `activeView === 'retailers'`)
- **Location**: `components/modules/supplier-module.tsx`
- **Related**: Focus on supplier discovery, POs, invoices

#### Inventory Module (Both Sides)
- **Issue**: No search bar, no pagination
- **Fix**: 
  - Add search bar with debounced filtering
  - Implement animated pagination (infinite scroll or page transitions)
  - Consider using Framer Motion for smooth effects
- **Location**: `components/modules/inventory-module.tsx`

#### Logistics Module (Distributor Side)
- **Issue**: Hardcoded delivery data (see line 16-39 in `app/modules/logistics/page.tsx`)
- **Fix**: 
  - Fetch from `sales_orders` collection where status = 'in_transit' or 'delivered'
  - Integrate with Google Maps API for real tracking
  - Add delivery status update functionality
- **Location**: `app/modules/logistics/page.tsx`

#### Retailers Module (Distributor Side)
- **Issue**: Hardcoded retailer data (see line 17-51 in `app/modules/retailers/page.tsx`)
- **Fix**:
  - Fetch from `users` collection where role = 'retailer'
  - Add filtering by status, location, performance
  - Show real order history and GMV
- **Location**: `app/modules/retailers/page.tsx`

---

## Verification Checklist

Use this to verify previously completed tasks are truly done:

### ✅ API Endpoints (Completed)
- [x] `POST /api/purchase-orders` - Created ✓
- [x] `PATCH /api/purchase-orders/{id}` - Created ✓
- [x] `POST /api/invoices` - Created ✓
- [x] `GET /api/invoices` - Created ✓

**Verify by:**
```bash
# Check files exist and are working
ls app/api/purchase-orders/route.ts
ls app/api/purchase-orders/[purchaseOrderId]/route.ts
ls app/api/invoices/route.ts
```

### ✅ Data Models (Completed)
- [x] Firestore collections defined in `lib/b2b-order-store.ts` ✓
- [x] TypeScript types in `types/b2b-orders.ts` ✓
- [x] Validation schemas in `lib/validation.ts` ✓
- [x] Utility functions in `lib/b2b-order-utils.ts` and `lib/b2b-invoice-utils.ts` ✓

**Verify by:**
```bash
npm run type-check  # Should pass with no errors
```

---

## Next Steps (In Order)

1. **Remove hardcoded suppliers** from `components/modules/supplier-module.tsx`
   - Replace mock data with Firestore queries
   - Update state management to handle loading/errors

2. **Add search & pagination to Inventory Module**
   - Install any needed animation libraries
   - Implement debounced search input
   - Create pagination component with cool transitions

3. **Remove Retailers tab from Retailer view**
   - Check user role and conditionally hide the tab
   - Remove related state variables if no longer needed

4. **Make Logistics Module functional**
   - Connect to Firebase for delivery data
   - Add Google Maps integration
   - Implement status update handlers

5. **Make Retailers Module functional**
   - Connect to Firebase for retailer data
   - Add analytics and performance metrics
   - Implement filtering and search

6. **Continue with payment webhook** (`POST /api/payments/webhook`)
   - This is the next API milestone after frontend fixes

---

## Files to Review/Edit

Based on priorities:

1. `components/modules/supplier-module.tsx` - Remove hardcoded data, remove retailers tab
2. `components/modules/inventory-module.tsx` - Add search bar and pagination
3. `app/modules/logistics/page.tsx` - Make fully functional
4. `app/modules/retailers/page.tsx` - Make fully functional
5. `lib/firebase.ts` - Ensure collections are properly exported
6. `app/api/payments/webhook/route.ts` - Create next (doesn't exist yet)

---

## Questions to Consider

1. **Role-based views**: Should we split supplier-module.tsx into two separate components?
   - `supplier-module-distributor.tsx` (for distributor side)
   - `supplier-module-retailer.tsx` (for retailer side)

2. **Pagination style preference**: 
   - Infinite scroll (like Twitter/Instagram)?
   - Animated page numbers (smooth transitions)?
   - Load More button with fade-in effect?

3. **Search implementation**:
   - Client-side filtering (fast but limited to loaded data)?
   - Server-side search (slower but comprehensive)?
   - Hybrid approach (client-side with background fetch)?

4. **Maps API choice**:
   - Google Maps Platform (most features, paid)?
   - Mapbox (modern, good free tier)?
   - OpenStreetMap (free, self-hosted)?

---

**Document Created:** October 3, 2025
**Purpose:** Track TODO reorganization and guide implementation
