# Modules Overview — POS, Inventory, and Supplier (VendAI)

Audience: Product, engineering, onboarding, and ops. This is a simple, repo‑aligned explainer for how the three core modules work together.

Stack: Next.js 15 App Router + optional Electron wrapper, Firebase/Firestore.

Related specs:
- POS module detail: `docs/POS_MODULE.md`
- Unification + onboarding: `docs/INVENTORY_SUPPLIER_POS.md`
- Supplier module: `SUPPLIER-MODULE-*.md`

---

## 1) What each module does

- Inventory (source of truth)
  - Owns the product catalog and stock levels per organization.
  - Provides barcodes/SKUs and the unit maths used during sales.
  - Exposes upload/import paths and adjustments.

- POS (sales ingestion + checkout)
  - Receives sales (from our UI or external POSes) and converts them to orders.
  - Decrements inventory atomically via shared logic.
  - Handles idempotency and item mapping exceptions.

- Supplier (catalogs, price lists, and ordering)
  - Stores supplier profiles and price lists mapped to our products.
  - Powers a catalog/cart UI so retailers can prepare purchase orders.
  - Provides cost/lead‑time data for replenishment decisions.

Why they matter together: Inventory keeps truth, POS consumes it (sales), Supplier replenishes it (purchases).

---

## 2) Core Firestore collections (repo‑aligned)

- `pos_products` — POS‑facing product catalog per org
  - Key fields: `name`, `pieceBarcode`, `cartonBarcode`, `unitsPerBase`, `retailPrice`, `image`
- `inventory` — stock by `orgId_productId`
  - Stock model: `qtyBase`, `qtyLoose`, `unitsPerBase`
- `pos_orders` — orders created from POS sales
- `pos_mappings` — external vendor/alias → `productId` assertions
- `pos_ingest_ids` — idempotency keys for transaction dedupe
- `pos_exceptions` — unmapped lines, failures, reconciliation notes
- `suppliers` — supplier profiles
- `supplier_skus` — supplier SKUs mapped to `productId` with cost, terms
- `org_settings` — onboarding gates and org config (e.g., `inventory_status`)

---

## 3) Inventory module in a nutshell

Responsibilities
- Define products and barcodes/SKUs used by POS and supplier mapping.
- Maintain stock with a piece‑first model that supports cartons/loose units.
- Provide upload/sync paths to initialize data quickly.

Key concepts
- Stock math: we track two numbers per SKU — `qtyBase` (e.g., cartons) and `qtyLoose` (pieces). `unitsPerBase` bridges them. 
- Truth table: POS can only sell what inventory says is available; decrements are atomic in Firestore transactions.

Typical actions
- Upload products via CSV/XLSX (planned routes: `/api/inventory/upload`, `/api/inventory/sync`).
- Adjust stock (manual counts, corrections) via a stock‑adjustment route.
- Gate POS until inventory is ready with `org_settings.inventory_status`.

UI/Assets
- Product images can be standardized using the AI image pipeline (see supplier docs and `image-gen/`).

---

## 4) POS module in a nutshell

Responsibilities
- Ingest sales from our own checkout UI and external POS systems.
- Map incoming line items by barcode/SKU to our `pos_products`.
- Create a `pos_orders` document and atomically decrement inventory.

Important pieces
- Canonical sale payload: see `docs/POS_MODULE.md` (maps to `POSOrderDoc`/`POSOrderLine`).
- Mapping order: barcode match in `pos_products` → `pos_mappings` by vendor/alias → else exception.
- Idempotency: dedupe using `pos_ingest_ids` keyed by `{orgId_vendor_storeId_txId}`; recommend `Idempotency-Key` header.
- Central stock math: `lib/pos-operations.ts:addPosOrder()` is the single entry point that decrements inventory in a Firestore transaction.

Primary endpoints (App Router)
- POST `/api/pos/transactions` — sales/returns ingestion (idempotent)
- POST `/api/pos/stock-adjustments` — manual stock corrections
- POST `/api/pos/mappings` — bulk SKU/barcode mapping updates
- GET  `/api/pos/orders?orgId=...` — recent orders

Failure modes
- Unmapped item: record in `pos_exceptions`; org policy can choose to reject entire sale or accept partial with flags.
- Insufficient stock: Firestore transaction fails; no partial decrements are persisted.

---

## 5) Supplier module in a nutshell

Responsibilities
- Manage supplier profiles and their price lists (SKUs mapped to our products).
- Provide a catalog/cart experience for retailers to assemble purchase orders.
- Feed replenishment (not yet fully wired to inventory receipts in this repo).

What’s implemented (see `SUPPLIER-MODULE-*.md`)
- Catalog UI with product cards, pagination, and a shopping cart modal.
- Data utilities under `data/distributors/*` for demo distributors.
- Image workflow scaffolding using Google Image Search + Replicate to unify product images.

Data link
- `supplier_skus` entries include `productId` so we can know cost per SKU and raise purchase orders against the same IDs inventory/POS use.

---

## 6) How they interact — three key flows

A) POS sale (external POS or our UI)
1) Incoming payload → `/api/pos/transactions`.
2) Map each line to a `productId` (barcode → `pos_products`; else `pos_mappings`).
3) Build order lines → call `addPosOrder(orgId, userId|'edge', lines)`.
4) Firestore transaction decrements `inventory` and writes `pos_orders`.
5) Any unmapped items → `pos_exceptions` for follow‑up.

B) Supplier price list import
1) Upload a supplier pricelist → parse SKUs and costs.
2) Create/merge `supplier_skus` and ensure each is linked to a `productId`.
3) If new items → create products in `pos_products` and optional skeleton `inventory` rows.
4) Retailers can browse supplier catalogs and add to cart; future step converts to a purchase order and increments inventory upon receipt.

C) Onboarding gate (safety)
1) Retailer signs up; until inventory is loaded, `org_settings.inventory_status != 'ready'`.
2) POST writes (e.g., POS transactions) are blocked or allowed in sandbox mode.
3) Once products + initial stock are in place → set `inventory_status = 'ready'` → POS opens for sales.

---

## 7) Minimal data shapes (orientation only)

Product (`pos_products`)
```ts
{
  id: string,
  orgId: string,
  name: string,
  pieceBarcode?: string,
  cartonBarcode?: string,
  unitsPerBase: number,   // e.g., 24 pieces per carton
  retailPrice?: number,
  image?: string
}
```

Inventory record (`inventory`)
```ts
{
  id: `${orgId}_${productId}`,
  orgId: string,
  productId: string,
  qtyBase: number,
  qtyLoose: number,
  unitsPerBase: number
}
```

POS order (simplified `pos_orders`)
```ts
{
  id: string,
  orgId: string,
  createdAt: Timestamp,
  lines: Array<{
    productId: string,
    name: string,
    quantityPieces: number,
    unitPrice: number,
    lineTotal: number
  }>,
  source?: { vendor?: string, storeId?: string, deviceId?: string },
  payments?: Array<{ method: string, amount: number }>,
  status: 'pending'|'completed'|'paid'
}
```

Supplier SKU (`supplier_skus`)
```ts
{
  id: `${supplierId}_${supplierSku}`,
  supplierId: string,
  orgId: string,
  supplierSku: string,
  productId: string,  // maps to our catalog
  cost: number,
  moq?: number,
  leadTimeDays?: number
}
```

---

## 8) Security, tenancy, and indexes

- Every document carries `orgId`. API routes must scope reads/writes by `orgId`.
- Auth: Firebase ID Tokens for users; Org API Key for server‑to‑server POS ingestion (if enabled).
- Recommended indexes: `pos_orders` composite (orgId + createdAt desc); single‑field on `inventory.orgId`; optional text indexes for `pos_products`.

---

## 9) Operator cheat sheet (day‑to‑day)

- Upload inventory (CSV/XLSX) → verify barcodes and units per base.
- Set `inventory_status = 'ready'` in `org_settings` when satisfied.
- Connect external POS (if any): provide API key and the POST URL for `/api/pos/transactions`.
- Watch `pos_exceptions` for unmapped items; add `pos_mappings` as needed.
- Maintain supplier price lists; ensure `supplier_skus.productId` is set for each item.
- Use the supplier catalog/cart to prepare purchase orders (future: receiving flow increments inventory).

---

## 10) FAQ

- Q: Can we accept sales with unknown barcodes?
  - A: Yes, by policy; we log exceptions. Best practice is to block or resolve quickly to keep stock truthful.

- Q: Does the system handle returns?
  - A: Returns can be sent through the same POS endpoint with `type = 'return'`; inventory increments are the inverse of sales (implementation per `POS_MODULE.md`).

- Q: How do supplier prices affect retail prices?
  - A: Today they’re separate. You can reference `supplier_skus.cost` to inform pricing rules; automation can be added later.

---

## 11) Roadmap — What's missing and what's next

This section outlines enhancements needed to make VendAI a deeply integrated, supermarket/minimart‑grade solution. Organized by priority phases for engineering alignment.

### Phase 1: Core Data Loops & Integration (Foundation)

**🔗 Unified Workflow Completion**
- [ ] **Receiving flow**: Automate supplier → purchase order → goods receipt → inventory increment
  - API: `POST /api/supplier/orders` (create PO), `POST /api/inventory/receive` (process receipt)
  - Update `inventory.qtyBase` and `qtyLoose` on confirmed delivery
  - Link to `supplier_skus` for cost tracking
- [ ] **Two-way POS sync**: Add webhook/API to push live stock levels and price updates back to external POS systems
  - Endpoint: `POST /api/pos/sync-stock` (push inventory changes to external systems)
  - Support for common POS formats (JSON, XML)
- [ ] **Real-time dashboards**: Low-stock alerts, top sellers, gross margin by product, exception notifications
  - Widget: Low stock (< reorder point)
  - Widget: Top 10 sellers (last 7/30 days)
  - Widget: Unmapped items in `pos_exceptions`
  - Widget: Gross margin by category

**📊 Onboarding & Data Setup**
- [ ] **Smart import assistant**: Parse supplier or POS exports (Excel, CSV, JSON) and auto-map columns
  - UI: Drag-drop upload → preview → column mapping → confirm
  - Support: SKU, barcode, name, price, units detection
- [ ] **Bulk mapping UI**: Resolve `pos_exceptions` visually — drag-drop unknown SKUs to known products
  - View: Grid of unmapped items with search/filter
  - Action: Map to existing product or create new
- [ ] **Inventory wizard**: Guided first-time setup flow
  - Step 1: Upload products
  - Step 2: Set units per base and barcodes
  - Step 3: Review and set initial stock
  - Step 4: Set `org_settings.inventory_status = 'ready'`

### Phase 2: Supermarket-grade POS Features

**🛍️ Advanced POS Capabilities**
- [ ] **Multi-lane checkout support**: Enable multiple cashiers writing to same inventory atomically
  - Already handled by Firestore transactions; add UI for lane assignment
  - Monitor: Active lanes dashboard
- [ ] **Offline queue mode**: If connection drops, queue transactions and sync when online
  - IndexedDB buffer for pending `pos_orders`
  - Background sync on reconnect
  - Conflict resolution for concurrent updates
- [ ] **Receipt printing API layer**: Abstract printing for browser POS and hardware terminals
  - Endpoint: `POST /api/pos/print-receipt` (ESC/POS, PDF, HTML formats)
  - Support: Epson ESC/POS, Star, browser print dialog
- [ ] **Barcode scale support**: Integrate weight-based barcodes (fruits, deli, produce)
  - Parse embedded weight in barcode (EAN-13 format 2xxxxx)
  - Calculate price = unitPrice × weight
  - Add `weightBased` flag to `pos_products`

**🔒 Security & Multi-Tenancy**
- [ ] **Role-based access control (RBAC)**: Manager, cashier, stock clerk, supplier rep
  - Firestore rules per role
  - UI: Role assignment in org settings
- [ ] **Org audit trails**: Log who made each stock change or order edit
  - Collection: `audit_log` with userId, action, timestamp, changes
  - UI: Audit view for managers
- [ ] **Inventory lockout**: Optionally pause POS when stock is zero or below threshold
  - Setting: `org_settings.lockout_on_zero_stock`
  - Enforcement: Pre-check in `addPosOrder`

### Phase 3: Supplier Integration Depth

**🔗 Advanced Supplier Features**
- [ ] **Auto-replenishment logic**: When stock hits reorder level, auto-suggest or auto-create supplier cart items
  - Calculate: `qtyBase + qtyLoose/unitsPerBase < reorderPoint`
  - Suggest: Order quantity based on lead time and MOQ
  - UI: "Smart Restock" button in inventory dashboard
- [ ] **Price synchronization**: When supplier price lists update, flag products whose cost increase affects margins
  - Monitor: `supplier_skus.cost` changes
  - Alert: Products with margin < threshold
  - UI: Price change review panel
- [ ] **Delivery + invoice reconciliation**: Confirm deliveries and match to orders
  - Flow: PO → Delivery Note → Invoice → Payment
  - UI: Receiving queue with line-item matching
  - Status: `ordered`, `shipped`, `received`, `invoiced`, `paid`

**👥 Retailer Experience & Automation**
- [ ] **Predictive restock recommendations**: Leverage POS order history for next purchase quantities
  - Algorithm: Moving average + seasonality detection
  - UI: "Suggested order" with confidence score
- [ ] **Credit & cashflow insights**: Track supplier terms and due dates
  - Collection: `supplier_invoices` with due dates
  - Dashboard: Upcoming payments, credit utilization
- [ ] **WhatsApp/USSD companion**: For minimarts with limited data access
  - Endpoint: USSD gateway for stock checks and reordering
  - WhatsApp bot: Natural language order placement

### Phase 4: AI & Intelligence Layer

**🧠 Optional AI Enhancements**
- [ ] **Product image auto-cleanup**: Continue improving image normalization from supplier uploads
  - Batch process: Re-stage all images with updated prompt
  - Quality check: Flag low-res or off-brand images
- [ ] **Anomaly detection**: Detect sudden sales spikes or negative stock due to mismatched barcodes
  - Monitor: Unusual velocity changes (>3 std dev)
  - Alert: Possible data errors or stockouts
- [ ] **Dynamic reorder point**: AI-based reorder thresholds based on velocity and seasonality
  - Model: Time-series forecasting per SKU
  - Update: `reorderPoint` field automatically
  - UI: Confidence intervals and override option

---

## 12) Acceptance criteria by phase

### Phase 1 (Foundation) — Must have
- [ ] Receiving flow completes purchase-to-inventory cycle end-to-end
- [ ] Smart import wizard onboards a retailer from CSV to "ready" in <10 minutes
- [ ] Real-time dashboard shows low stock, top sellers, exceptions
- [ ] Bulk mapping UI resolves 20+ unmapped items in <5 minutes

### Phase 2 (POS Enhancements) — Supermarket-grade
- [ ] Multi-lane checkout tested with 3+ concurrent cashiers
- [ ] Offline mode buffers 50+ transactions and syncs without loss
- [ ] Receipt printing works on Epson TM-T88 and browser print
- [ ] Barcode scale products calculate price correctly from weight

### Phase 3 (Supplier Depth) — Automation
- [ ] Auto-replenishment suggests correct quantities for 90%+ of SKUs
- [ ] Price sync alerts trigger within 1 hour of supplier update
- [ ] Delivery reconciliation matches 95%+ of lines automatically

### Phase 4 (AI Layer) — Intelligence
- [ ] Anomaly detection flags real issues (not false positives) 80%+ of time
- [ ] Dynamic reorder points outperform static thresholds by 15%+ (fewer stockouts)

---

## 13) Engineering checklist (next sprint)

**Immediate priorities** (pick 3–5 for next 2 weeks):
- [ ] Wire onboarding gate helper into POS routes to enforce `inventory_status`
- [ ] Add `/api/inventory/upload` to parse CSV and upsert `pos_products` + `inventory` stubs
- [ ] Implement receiving flow: `POST /api/inventory/receive` with inventory increment
- [ ] Build bulk mapping UI for `pos_exceptions` with drag-drop
- [ ] Add real-time low-stock widget to main dashboard
- [ ] Add offline queue mode with IndexedDB buffer and background sync
- [ ] Implement RBAC with Firebase rules and role assignment UI

**Quick wins** (can be done in parallel):
- [ ] Add `reorderPoint` and `reorderQty` fields to `pos_products` schema
- [ ] Create `audit_log` collection and middleware to log all writes
- [ ] Add `org_settings.lockout_on_zero_stock` flag and enforce in `addPosOrder`
- [ ] Build "Smart Restock" button that auto-populates supplier cart from low stock

---

This file is intentionally concise and should be the starting point for new contributors and onboarding teammates. For implementation details, use the linked specs (`POS_MODULE.md`, `INVENTORY_SUPPLIER_POS.md`).
