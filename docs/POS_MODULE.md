# VendAI POS Module — Design, Plan, and Execution (repo-aligned)

Tagline: “Bring POS-level intelligence without POS hardware” — unify data across many POS systems and keep inventory truthful.

This document refines the earlier POS guide into a concrete plan for this repository’s stack (Next.js 15 App Router + Electron shell + Firebase/Firestore). It keeps only what fits the current architecture and defines how to integrate external POS systems while staying tightly coupled to the inventory and supplier modules.


## 0) Current repo snapshot (what we already have)

Core tech:
- Next.js 15 (App Router) + Electron wrapper
- Firebase Firestore for data

Relevant code & collections:
- `lib/pos-operations.ts`
  - `listPOSProducts(orgId, search?)`
  - `getInventory(orgId, productId)`
  - `addPosOrder(orgId, userId, lines)` — decrements inventory atomically
  - `listRecentOrders(orgId)` — warns when index missing
  - `hasInventory(orgId)`
- `lib/types.ts`
  - `POSProduct`, `InventoryRecord`, `POSOrderLine`, `POSOrderDoc` (piece-first pricing, base/loose stock model)
- Firestore collections in use (or implied):
  - `pos_products` — POS-facing product catalog
  - `inventory` — inventory records per `orgId_productId`
  - `pos_orders` — POS orders/sales

What this means
- We already have a correct inventory decrement flow at POS checkout (`addPosOrder`).
- We need an ingestion path to accept sales from external POSs and map them into `POSOrderDoc`/`POSOrderLine` before calling that function.


## 1) Scope and principles (trimmed to fit repo now)

In-scope now
- Canonical transaction schema that other POSs can post to.
- Next.js API endpoints to ingest transactions and stock adjustments.
- SKU/barcode mapping store and workflow for unmatched items.
- Idempotent ingestion + dedupe.
- Tight coupling to existing inventory decrement (reuse `addPosOrder`).
- CSV batch import for legacy POSs (reusing our existing upload path style).

Out-of-scope for now (can be phased in later)
- Kafka/PubSub and microservices (we’ll stick to Firestore + Next.js routes).
- Full-blown payments (M-Pesa, cards) — we’ll carry payment refs but won’t integrate gateways yet.
- Heavy ETR/Tax printer integration.
- Complex promo engine; keep price/discount fields simple.


## 2) Canonical data model (maps to existing types)

Minimal canonical sale transaction (POST body)
- Chosen to map directly into `POSOrderDoc`/`POSOrderLine` and inventory math (piece-first):

```json
{
  "orgId": "ORG_123",
  "source": {
    "vendor": "SambaPOS",
    "storeId": "KBL_WESTLANDS",
    "deviceId": "TILL_2"
  },
  "transaction": {
    "txId": "a1b2c3d4",
    "timestamp": "2025-09-16T10:15:00Z",
    "cashierId": "user_abc",
    "items": [
      { "barcode": "1234567890123", "skuRef": "", "name": "Coke 500ml", "qtyPieces": 2, "unitPrice": 80, "discount": 0, "tax": 16 }
    ],
    "payments": [
      { "method": "CASH", "amount": 160 }
    ],
    "total": 160,
    "type": "sale"
  }
}
```

Mapping rules
- Try resolve item by `barcode` against `pos_products` (`pieceBarcode` or `cartonBarcode`).
- Fallbacks: `skuRef` mapping table → VendAI product id; if missing, create an “unmapped line” exception.
- Convert each item into `POSOrderLine`:
  - `productId` = resolved VendAI product id
  - `name` = item name (override with our canonical product name when mapped)
  - `quantityPieces` = `qtyPieces` (always in pieces)
  - `unitPrice` = piece price
  - `lineTotal` = `qtyPieces * unitPrice - discounts` (pre-tax or tax-included based on org config; keep stored value as sent, but record a `pricingMode` in the doc)
- Wrap into `POSOrderDoc` (status `pending` initially) and call `addPosOrder` to apply inventory decrement transactionally.

Additional collections
- `pos_mappings` (new): stores vendor/barcode/alias → `productId` assertions and audit.
- `pos_ingest_ids` (new): idempotency dedupe store, keyed by `orgId_vendor_storeId_txId`.
- `pos_exceptions` (new): capture unmapped or failed lines for operator review.


## 3) API surface (App Router)

All endpoints are private to retailer orgs and authenticated via Firebase ID Token (Authorization: Bearer). For machine-to-machine (external POS), allow an organization-scoped API key (stored in Firestore `org_settings`) and validate in middleware.

Endpoints
- POST `/api/pos/transactions` — ingest a sale/return; idempotent.
- POST `/api/pos/stock-adjustments` — manual adjustments (e.g., shrinkage, counts).
- POST `/api/pos/mappings` — create/update SKU/barcode mappings in bulk (CSV/JSON).
- GET  `/api/pos/orders?orgId=...&limit=...` — list recent orders (uses `listRecentOrders`).

Behavior highlights
- Idempotency — require headers: `Idempotency-Key` (recommended). Also dedupe by body keys.
- On unmapped items — do not block the entire transaction by default; store the order with partial lines flagged OR reject with 409 based on org policy. Always record an exception row with enough context.


## 4) Ingestion flow (how it runs)

1) Validate org and auth.
2) Dedupe: create a doc in `pos_ingest_ids/{orgId_vendor_storeId_txId}` inside a transaction; if exists, return 200 with existing order id.
3) Map each item → VendAI product id using:
   - exact barcode match in `pos_products` (check `pieceBarcode` and `cartonBarcode`)
   - if missing, try `pos_mappings` by vendor or `skuRef`
   - else, mark exception and decide whether to continue (org policy)
4) Build `POSOrderLine[]` and invoke `addPosOrder(orgId, userId|'edge', lines)` to atomically decrement inventory.
5) Update the created `pos_orders` doc with source/payment/metadata, and finalize status to `completed` or `paid` if provided.
6) Emit an exception document if any unmapped/failed lines occurred.


## 5) Inventory interaction (as-is)

- We keep the existing inventory model: `qtyBase` + `qtyLoose` with `unitsPerBase`.
- `addPosOrder` already handles safe decrement across loose/base units.
- If stock insufficient, the transaction fails and no inventory changes are persisted (Firestore transaction guarantees).


## 6) CSV batch import (legacy POS)

- Reuse the pattern of `app/api/aplord/route.ts` for parsing and validation.
- Define a CSV template for sales with headers: `timestamp, barcode, qty, unit_price, total, tx_id, store_id`.
- Batch endpoint can upsert `pos_mappings` automatically when a barcode matches a product.


## 7) Firestore indexes (required now)

- `pos_orders` composite index: where `orgId ==`, order by `createdAt desc` (already hinted by code).
- `inventory` single-field on `orgId` (for presence checks and per-org queries).
- `pos_products` indexes for text search are optional; we currently filter client-side.


## 8) Security & tenancy

- Auth: accept Firebase ID Tokens for human users; for external POS, accept an Org API Key in `Authorization: ApiKey <key>`.
- Multi-tenancy: all docs must carry `orgId`. New collections (`pos_mappings`, `pos_ingest_ids`, `pos_exceptions`) include `orgId` in the id or as a field. Prefer composite keys in document ids to reduce query complexity.


## 9) Exceptions & reconciliation (minimum viable)

- Exceptions: any unmapped item or failed decrement writes a row in `pos_exceptions` with `status: open|resolved`, `reason`, and payload.
- Reconciliation: start manual — run a report comparing `pos_orders` totals vs inventory decrements over a period. Automate later with a scheduled job.


## 10) Developer execution guide (Windows, this repo)

Local run

```powershell
# 1) Install dependencies
npm install

# 2) Run web + electron (optional)
npm run electron:dev
# or just the Next.js dev server
npm run dev
```

Proposed implementation steps (PR checklist)
1. Create API routes:
   - `app/api/pos/transactions/route.ts`
   - `app/api/pos/stock-adjustments/route.ts`
   - `app/api/pos/mappings/route.ts`
2. Add collections: `pos_mappings`, `pos_ingest_ids`, `pos_exceptions` (no schema enforcement needed; document in this file).
3. Implement idempotent ingestion (Section 4). Reuse `addPosOrder` to apply inventory changes.
4. Write a small test script or use Postman to POST a sample transaction body; verify a new `pos_orders` doc appears and that inventory decremented.
5. Add the `pos_orders` index (Section 7). Confirm `listRecentOrders` no longer warns.
6. Optional: Add a CSV import variant for sales, modeled after `aplord` route.

Sample minimal payload to test

```json
{
  "orgId": "DEMO_ORG",
  "source": {"vendor": "WebhookPOS", "storeId": "STORE_A", "deviceId": "K1"},
  "transaction": {
    "txId": "TX12345",
    "timestamp": "2025-09-16T12:00:00Z",
    "cashierId": "edge",
    "items": [
      { "barcode": "1234567890123", "name": "Sample Product", "qtyPieces": 1, "unitPrice": 100, "discount": 0, "tax": 16 }
    ],
    "payments": [{ "method": "CASH", "amount": 100 }],
    "total": 100,
    "type": "sale"
  }
}
```


## 11) Acceptance criteria (phase 1)

- [ ] POST `/api/pos/transactions` accepts the sample payload and creates a `pos_orders` row.
- [ ] Inventory decremented correctly using `addPosOrder`.
- [ ] Idempotency: repeat POST with same `{orgId, source, txId}` returns same order id without duplicating.
- [ ] Unmapped barcode triggers a `pos_exceptions` doc.
- [ ] Index added: `pos_orders` by `orgId + createdAt desc`.


## 12) Discarded (for now) and why

- Kafka / microservices — overkill for current monolith; Firestore + routes suffice.
- Full payments matching (M-Pesa) — defer until ingestion is solid; keep `paymentRef` fields to support future matching.
- Complex promos and ETR integrations — not needed to unify with supplier/inventory immediately.


## 13) Future phases

- Add M-Pesa webhooks and payment matching.
- Promotion rules & returns workflow.
- Scheduled reconciliation and dashboards.
- Edge Agent (Node) for offline buffering if needed on-prem.


---
This doc is the source of truth for the POS module in this repo. Keep `lib/pos-operations.ts` as the single place for inventory decrement logic; ingestion routes should compose it rather than duplicating stock math.
