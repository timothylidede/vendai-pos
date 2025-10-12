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

## 11) Next steps (repo‑specific)

- Wire the onboarding gate helper into POS routes to enforce `inventory_status`.
- Add `/api/inventory/upload` to parse CSV and upsert `pos_products` (+ optional `inventory` stubs).
- Implement receiving flow (convert supplier cart → purchase order → inventory increment).
- Add small dashboard cards: exceptions to resolve, low‑stock, last 7‑day sales.

This file is intentionally concise and should be the starting point for new contributors and onboarding teammates. For implementation details, use the linked specs.
