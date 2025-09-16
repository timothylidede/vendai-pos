# Inventory + Supplier + POS — unified design, onboarding enforcement, and AI image pipeline (VendAI)

This spec is repo-aligned (Next.js 15 + Firebase/Firestore + Electron shell). It describes:
- Inventory module (store of truth, mappings, stock model)
- Supplier module (catalog and price lists linked to SKUs)
- POS linkage to inventory (idempotent ingestion already implemented)
- Onboarding requirement (block writes until inventory ready)
- AI image unification pipeline (Google Image Search → Replicate Flux img2img)
- Cursor-like side panel assistant
- A copy-pasteable prompt block for your Copilot (GPT-5)


## 1) Onboarding enforcement (must upload inventory)

Policy
- Retailer must complete inventory onboarding before they can place orders or post POS transactions.
- We allow a sandbox test (e.g., one order or one sale) for demos but block production writes until `inventory_status == "ready"`.

Storage
- `org_settings/{orgId}` document with fields:
  - `inventory_status`: 'not-started' | 'in-progress' | 'ready'
  - `allow_sandbox`: boolean
  - `theme_bg_hex`: optional app background color (e.g., #F6F4F2) used in image prompts

Middleware behavior (Next.js routes)
- Before handling POST writes (`/api/pos/transactions`, future `/api/orders`, etc.), check `org_settings.inventory_status`.
- If not ready and no sandbox allowance, return 409 with guidance.


## 2) Inventory module

Responsibilities
- Canonical SKU catalog per org, mapping from barcodes/vendor SKUs to a VendAI product id used by POS.
- Stock model (already used in code): `qtyBase`, `qtyLoose`, `unitsPerBase` with piece-first decrements.
- Reorder signals and basic metadata (brand, pack size, prices).

Collections in Firestore
- `pos_products` (existing) — POS-facing product catalog; includes `pieceBarcode`, `cartonBarcode`, `unitsPerBase`, retail price.
- `inventory` (existing) — per `orgId_productId` record with base/loose quantities.
- `pos_mappings` (new) — vendor/alias → productId mapping.
- `org_settings` (new/assumed) — onboarding gating status and theme color.

Upload and sync
- `/api/inventory/upload` — upload CSV/XLSX; parse rows into products; either match existing `pos_products` or create new; optional create skeleton inventory rows for the org.
- `/api/inventory/sync` — trigger connectors (future) for external POS/ERP imports.


## 3) Supplier module

Responsibilities
- Supplier profiles, price lists, and SKU mappings to VendAI products.
- Provide cost, lead time, and MOQ to support reordering and analytics.

Collections
- `suppliers` — supplier profile
- `supplier_skus` — `supplierId+key` → `productId`, with cost and terms

Endpoints (future)
- `/api/supplier/upload-pricelist` — parse supplier catalogs
- `/api/supplier/:id/catalog` — view supplier-linked SKUs


## 4) POS linkage (already partially implemented)

- Ingestion endpoint: `/api/pos/transactions` (added), idempotent, maps by barcode and `pos_mappings`, writes orders via `addPosOrder` which decrements inventory safely.
- Stock adjustments: `/api/pos/stock-adjustments` (added) to correct counts.


## 5) AI image unification pipeline

Goal
- Each SKU gets a single uniform, high-quality reference image with:
  - Background color = app theme (default #F6F4F2)
  - Product placed on a brown mahogany shelf with visible grain
  - Warm studio lighting (“precious” look)

Flow
1) Find reference images via Google Custom Search Images.
2) Choose best candidate(s) by resolution and face-on clarity.
3) Call Replicate Flux (image-to-image) to restage into the standard look.
4) Post-process (crop/pad/shadow) and store (CDN) → update SKU `image` field in `pos_products`.

Prompt template (Flux img2img)
- Use this as your base string; interpolate background color from `org_settings.theme_bg_hex`.

"Photorealistic product photo of the item shown in the reference image(s). Output a single centered product placed on a brown mahogany wooden shelf with visible wood grain. Lighting: warm, studio-quality, 'precious' accent lighting from top-left creating soft highlights and gentle shadows. Background color: {THEME_BG_HEX}. Camera: 50mm, slight 10° angle, product fully visible, no additional props. Keep product proportions and text readable. Ensure consistent composition across all SKUs: product centered, same distance from camera, shelf visible across bottom third of frame. High detail, high resolution, natural specular highlights on glossy surfaces. If no license to reproduce brand logos, render neutral label placeholders instead. Output format: 2048x2560 JPEG."

Safety / rights notes
- Track original URLs and license; prefer supplier-provided images.
- Allow manual approve/override; never auto-publish to production without review.


## 6) Side panel assistant (cursor-like)

Intent
- A contextual operator assistant that can answer questions and execute store tasks.

Context available
- org/store meta, inventory snapshot, low-stock alerts, open orders, last 30-day GMV, POS status, supplier price lists.

Capabilities (initial)
- Q&A: "Which SKUs are below min stock?"
- Actions: "Place reorder for SKU <id> 100 units from fastest supplier"
- Ops: "Map unmapped items", "Regenerate image for SKU <id>"

API
- `/api/assistant/execute` — accepts `{ orgId, userId, command, context? }`; returns proposed actions (structured) and optional confirmations. You can wire this to your LLM service later.


## 7) Copilot (GPT-5) prompt block

Copy/paste the block below into your Copilot GPT-5 agent to scaffold services and artifacts. It is technology-agnostic but references endpoints consistent with this repo.

SYSTEM: You are VendAI Copilot. Build code and artifacts for an Inventory + Supplier + POS integrated system with an automated image-unification pipeline. Output should include:
- OpenAPI spec for endpoints: /api/inventory/upload, /api/inventory/sync, /api/pos/transactions, /api/supplier/upload-pricelist, /api/image/generate, /api/assistant/execute
- Firestore collections and document shapes for: org_settings, pos_products, inventory, pos_mappings, suppliers, supplier_skus, pos_orders, pos_ingest_ids, pos_exceptions
- TypeScript route handler skeletons compatible with Next.js App Router
- A TypeScript `image-pipeline` outline that:
  1) Given sku_id and product name, calls Google Custom Search Images (env GOOGLE_CSE_ID/GOOGLE_API_KEY), downloads candidates.
  2) Selects best candidate (>= 800x800), calls Replicate Flux dev image2image with the prompt provided, strength=0.6, seed = hash(sku_id), output 2048x2560.
  3) Returns a signed URL placeholder (CDN) and the chosen image metadata.
- A middleware or helper that blocks POS/order writes if org_settings.inventory_status != 'ready' (sandbox allowed).
- Unit tests for idempotency and mapping fallback.
- The exact image prompt string in a constant, and a note about image licensing and manual approval.

USER INPUT: { sku_id: "vendai::123", product_name: "Coke 500ml", brand: "Coca-Cola", orgId: "org-demo" }
END


## 8) Next steps in this repo

- Implement readiness gating helper and use it in `/api/pos/transactions`.
- Add `/api/inventory/upload` to parse CSV and upsert `pos_products` + optional `inventory` stubs.
- Add `/api/image/generate` with stubs for Google search + Replicate call; return a plan (simulate URLs) until API keys configured.
- Add `/api/assistant/execute` returning a structured action plan skeleton.

This document is the companion spec for the current code. Keep POS math centralized in `lib/pos-operations.ts` and compose it from route handlers.
