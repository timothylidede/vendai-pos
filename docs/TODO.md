# VendAI POS — Development Roadmap & TODO

_Last updated: 11 Oct 2025_

**Context**: This roadmap reflects the integrated architecture of POS, Inventory, and Supplier modules documented in `docs/MODULES_OVERVIEW_POS_INVENTORY_SUPPLIER.md`. Priorities are organized into phases for supermarket/minimart readiness.

---

## 📘 Reference Documents
- `docs/MODULES_OVERVIEW_POS_INVENTORY_SUPPLIER.md` — Core module interactions and data models
- `docs/POS_MODULE.md` — POS ingestion, idempotency, and mapping details
- `docs/INVENTORY_SUPPLIER_POS.md` — Unified onboarding + AI image pipeline

---

## Phase 1: Core Workflow Completion (MVP+)

### 🔄 1.1 Unified Workflow & Data Loops

#### Receiving Flow Completion
- [x] Implement `/api/supplier/receiving` endpoint ✅
  - Accept delivery confirmation payload (PO reference, delivered quantities)
  - Validate against supplier purchase order
  - Atomically increment `inventory` (qtyBase/qtyLoose) in Firestore transaction
  - Mark PO as received; create ledger entry for COGS
- [x] Build receiving UI in supplier module ✅
  - Scan/enter PO number
  - Confirm delivered quantities per line item
  - Handle partial receipts (qty delivered < qty ordered)
  - Toast + redirect to updated inventory view
- [x] Add `purchase_orders` collection schema ✅
  - Fields: `orgId`, `supplierId`, `lines[]`, `status`, `expectedDate`, `receivedAt`
- [x] Wire supplier cart checkout to create PO documents ✅
- [x] Add Firestore indexes for purchase_orders ✅
- [x] Create receiving modal component ✅
- [x] Add "Receive Delivery" button to supplier module header ✅

**Implementation complete**. See `docs/RECEIVING_FLOW_IMPLEMENTATION.md` for details.

#### Two-way Sync with External POS
- [ ] Add `/api/pos/sync-out` webhook endpoint
  - Push live stock levels to external POS systems
  - Push price updates when `pos_products.retailPrice` changes
  - Support configurable webhook URLs per org in `org_settings`
- [ ] Implement retry logic with exponential backoff for webhook failures
- [ ] Add webhook delivery logs collection: `pos_sync_logs`

#### Real-time Dashboards
- [ ] Create `/app/dashboard` route with cards:
  - Low-stock alerts (products below reorder point)
  - Top 10 sellers (last 7/30 days)
  - Gross margin by category/product
  - Exception count (unmapped items, failed transactions)
- [ ] Add real-time Firestore listeners for dashboard metrics
- [ ] Implement dashboard refresh controls and date range filters

---

### 🔗 1.2 Supplier Integration Depth

#### Auto-replenishment Logic
- [ ] Add `reorderPoint` and `reorderQty` fields to `pos_products`
- [ ] Create background job (Cloud Function or API route cron):
  - Check inventory where `qtyBase * unitsPerBase + qtyLoose < reorderPoint`
  - Look up fastest supplier from `supplier_skus` (lowest `leadTimeDays`)
  - Auto-populate supplier cart or send notification to buyer
- [ ] Build UI to approve/edit suggested replenishment orders

#### Price Synchronization
- [ ] Add `/api/supplier/pricelist-update` endpoint
  - Accept bulk price changes from suppliers
  - Compare against current `supplier_skus.cost`
  - Flag products where cost increase > X% (configurable threshold)
  - Create alerts in `price_change_alerts` collection
- [ ] Build price alert review UI
  - Show old vs new cost, current retail price, margin impact
  - Approve/reject or adjust retail price in bulk

#### Delivery + Invoice Reconciliation
- [ ] Extend `/api/supplier/receiving` to accept invoice attachments
- [ ] Add three-way match logic: PO ↔ Delivery ↔ Invoice
  - Compare quantities, prices, and totals
  - Flag discrepancies for review
- [ ] Create `delivery_reconciliations` collection with match status
- [ ] Build reconciliation dashboard for ops review

---

### 🛍️ 1.3 Supermarket-grade POS Enhancements

#### Multi-lane Checkout Support
- [ ] Test concurrent `addPosOrder` calls from multiple cashiers
- [ ] Add `deviceId` and `laneId` to POS order metadata
- [ ] Implement optimistic locking or retry logic for inventory contention
- [ ] Add cashier performance dashboard (sales per lane, avg transaction time)

#### Offline Queue Mode
- [ ] Implement offline detection in Electron/web app
- [ ] Queue POS transactions in local IndexedDB when offline
- [ ] Auto-sync queued transactions when connection restored
- [ ] Add visual indicator for offline mode + queue depth
- [ ] Handle conflict resolution (e.g., insufficient stock after reconnect)

#### Receipt Printing API Layer
- [ ] Create `/api/pos/print-receipt` endpoint
  - Accept order ID and return formatted receipt data
  - Support ESC/POS command generation for thermal printers
  - Return HTML receipt for browser print fallback
- [ ] Add printer configuration in `org_settings`: IP, model, paper width
- [ ] Test with Epson TM-T88 series and Star TSP100 printers

#### Barcode Scale Support
- [ ] Implement weight-based barcode parsing (EAN-13 with price/weight encoding)
- [ ] Add `barcodeType` field to `pos_products`: 'standard' | 'weight-embedded'
- [ ] Parse weight from barcode and calculate price dynamically
- [ ] Add UI for configuring weight barcode format per org

---

## Phase 2: Onboarding & Usability

### 👥 2.1 Onboarding & Data Setup

#### Smart Import Assistant
- [ ] Enhance `/api/inventory/upload` with auto-detection:
  - Parse common CSV/XLSX formats from external POS/ERP exports
  - Auto-map columns using fuzzy matching (name, barcode, price, stock)
  - Provide confidence scores and suggestions for ambiguous mappings
- [ ] Build import preview UI before final commit
- [ ] Support rollback of last import batch

#### Bulk Mapping UI
- [ ] Create `/app/mappings` route for exception resolution
  - List all unmapped items from `pos_exceptions`
  - Drag-drop or search-select to map to existing `pos_products`
  - Bulk create new products from unmapped items
  - Mark exceptions as resolved
- [ ] Add mapping history and audit log

#### Inventory Wizard
- [ ] Create guided `/app/onboarding/inventory` flow:
  - Step 1: Upload products (CSV/manual entry)
  - Step 2: Set units per base for each product
  - Step 3: Enter initial stock counts
  - Step 4: Review summary + "Go Live" button
  - On completion: set `org_settings.inventory_status = 'ready'`
- [ ] Add progress indicator and ability to save draft

---

### 📲 2.2 Retailer Experience & Automation

#### Predictive Restock Recommendations
- [ ] Analyze POS order history to calculate:
  - Average daily sales velocity per product
  - Seasonal trends (day-of-week, monthly patterns)
  - Stockout frequency
- [ ] Generate recommended order quantities based on:
  - Forecasted demand over lead time
  - Safety stock levels
  - Supplier MOQ constraints
- [ ] Surface recommendations in supplier cart UI

#### Credit & Cashflow Insights
- [ ] Add lightweight credit tracking:
  - Track supplier payment terms (net 30, net 60, etc.)
  - Show aging report: invoices due this week, overdue
  - Calculate available credit headroom per supplier
- [ ] Create `/app/cashflow` dashboard with:
  - Upcoming payment obligations
  - Cash position forecast (sales - COGS - expenses)
  - Alerts for low cash / credit limit breaches

#### WhatsApp/USSD Companion
- [ ] Design low-bandwidth query API:
  - Check stock levels by SKU
  - Get top 5 low-stock items
  - Place simple reorders (SKU + quantity)
- [ ] Integrate with Twilio/Africa's Talking for WhatsApp/USSD
- [ ] Support USSD menu navigation for feature phones
- [ ] Add SMS receipts for completed orders

---

## Phase 3: Security, Compliance & Multi-tenancy

### 🔒 3.1 Ops & Multi-Tenant Safety

#### Role-based Access Control (RBAC)
- [ ] Define roles in `users` collection: manager, cashier, stock_clerk, supplier_rep
- [ ] Add permission matrix:
  - Cashier: POS transactions only
  - Stock clerk: inventory adjustments, receiving
  - Manager: all operations + reports
  - Supplier rep: view own orders, upload pricelists
- [ ] Implement middleware to enforce role checks on API routes
- [ ] Add role selection UI in user management

#### Org Audit Trails
- [ ] Create `audit_logs` collection:
  - Log all writes: inventory changes, orders, mappings, price updates
  - Fields: `timestamp`, `userId`, `action`, `resource`, `before`, `after`
- [ ] Add audit log viewer in admin dashboard
- [ ] Support filtering by user, date range, and action type

#### Inventory Lockout
- [ ] Add `allow_negative_stock` flag to `org_settings`
- [ ] When disabled, reject POS transactions if insufficient stock
- [ ] Add optional warning threshold (e.g., pause POS when < 5% of products in stock)
- [ ] Show lockout banner in POS UI with override capability for managers

---

## Phase 4: Advanced Features & AI

### 🧠 4.1 Optional AI Layer

#### Product Image Auto-cleanup
- [ ] Extend AI image pipeline (`image-gen/`) to:
  - Remove backgrounds automatically using Replicate or Remove.bg
  - Standardize aspect ratios and padding
  - Enhance low-resolution supplier images
- [ ] Add batch processing UI for re-generating images
- [ ] Support manual review/approval before publishing

#### Anomaly Detection
- [ ] Implement anomaly detection job (daily Cloud Function):
  - Detect sudden sales spikes (> 3 standard deviations)
  - Identify negative stock entries (bad barcode mappings)
  - Flag unusual price changes
- [ ] Create `anomalies` collection with severity and auto-resolution suggestions
- [ ] Add anomaly dashboard with acknowledge/investigate actions

#### Dynamic Reorder Point
- [ ] Train simple ML model (linear regression or moving average) on:
  - Historical sales velocity
  - Seasonality factors
  - Lead time variance
- [ ] Auto-adjust `reorderPoint` weekly based on predictions
- [ ] Show confidence intervals in supplier reorder UI
- [ ] Allow manual override and feedback loop

---

## Phase 5: Integrations & Ecosystem

### 🌐 5.1 Payment & Financial Integrations

#### M-Pesa Integration
- [ ] Implement Daraja API for STK Push (customer payments)
- [ ] Add B2B/B2C endpoints for supplier payouts
- [ ] Match M-Pesa callbacks to `pos_orders` and `purchase_orders`
- [ ] Add payment reconciliation dashboard

#### Card Payment Gateways
- [ ] Integrate with Stripe/Flutterwave for card acceptance
- [ ] Store payment intents and match to orders
- [ ] Support split payments (cash + card)

#### Accounting Software Export
- [ ] Export sales/COGS to QuickBooks/Xero format (CSV or API)
- [ ] Map VendAI transactions to chart of accounts
- [ ] Schedule automated daily/weekly exports

---

### 🔌 5.2 External POS/ERP Connectors

#### Common POS System Adapters
- [ ] Build connectors for:
  - Quickbooks POS
  - Square POS
  - Lightspeed Retail
  - SambaPOS (Kenya-popular)
- [ ] Each adapter: fetch sales, sync stock, update prices
- [ ] Standardize to canonical transaction format before ingestion

#### ERP Sync (Odoo, SAP B1)
- [ ] Implement two-way sync for products and inventory
- [ ] Map VendAI product IDs to ERP SKUs
- [ ] Sync purchase orders and receivings

---

## Recently Completed ✅

### Supplier Module
- ✅ Circular supplier logos with inventory-aware suggestions
- ✅ Shopping cart and checkout modal
- ✅ AI image generation pipeline (Replicate + Google Search)
- ✅ Pagination (20 products/page)
- ✅ Product cards with hover effects and glassmorphism

### Inventory Module
- ✅ Fixed `limitQuery` → `limit` import
- ✅ Product catalog with search and filtering
- ✅ Stock tracking with qtyBase/qtyLoose model

### POS Module
- ✅ Idempotent transaction ingestion (`/api/pos/transactions`)
- ✅ Atomic inventory decrements via `lib/pos-operations.ts`
- ✅ Exception tracking for unmapped items

### Infrastructure
- ✅ Reconciliation service (PO ↔ Invoice ↔ Payment matching)
- ✅ Ledger entries with tax breakdown
- ✅ Toast notifications (replaced all `alert()` calls)
- ✅ Loading/empty/error states across modules
- ✅ Unified dashboard search controls

---

## Engineering Notes

### Priority Scoring
- **P0 (Blocker)**: Required for production launch
- **P1 (High)**: Core value prop, needed within 1-2 sprints
- **P2 (Medium)**: Improves UX/ops efficiency
- **P3 (Nice-to-have)**: Future enhancement, defer if resource-constrained

### Suggested Phase Priorities
- **Phase 1** (MVP+): P0/P1 — Focus on receiving flow, multi-lane POS, offline mode
- **Phase 2** (Usability): P1/P2 — Onboarding wizard, bulk mapping, restock recommendations
- **Phase 3** (Security): P0 — RBAC, audit logs (required for multi-tenant SaaS)
- **Phase 4** (AI): P2/P3 — Image cleanup, anomaly detection (value-add features)
- **Phase 5** (Integrations): P1/P2 — M-Pesa (critical for Kenya), POS connectors (expands TAM)

### Testing Checklist Template
For each feature:
- [ ] Unit tests for core logic (Jest/Vitest)
- [ ] Integration tests for API routes (supertest)
- [ ] Firestore transaction tests (emulator)
- [ ] E2E tests for critical flows (Playwright)
- [ ] Manual QA on Windows + Electron shell
- [ ] Load testing for concurrent POS transactions

---

## Questions / Decisions Needed

- **Offline mode**: Use IndexedDB or LocalStorage? How long to retain queued transactions?
- **RBAC**: Firebase Auth custom claims or Firestore-based permissions?
- **Image pipeline**: Continue with Replicate or switch to OpenAI DALL-E?
- **Webhooks**: Retry policy — max 3 attempts or exponential backoff up to 24 hours?
- **Barcode scales**: Support only EAN-13 price-embedded or also custom formats?

---

_This roadmap is a living document. Update as features are completed or priorities shift._



## ✅ Already Done_Last updated: 4 Oct 2025_## A. Core API Endpoints

- [x] Firestore models and helpers for POs, invoices, payments, ledger entries (`types/b2b-orders.ts`, `lib/b2b-order-utils.ts`, `lib/b2b-invoice-utils.ts`, `lib/b2b-order-store.ts`).

- [x] Purchase order endpoints (`GET/POST /api/purchase-orders`, `PATCH /api/purchase-orders/[id]`).

- [x] Invoice endpoints (`GET/POST /api/invoices`).

- [x] Zod validation coverage for PO create/update and invoice create (`lib/validation.ts`).## ✅ Already Done### B2B Order & Payment Flow



## 🚨 Blockers (ship before cutover)- [x] Firestore data models and helpers for purchase orders, invoices, payments, and ledger entries (`types/b2b-orders.ts`, `lib/b2b-order-utils.ts`, `lib/b2b-invoice-utils.ts`, `lib/b2b-order-store.ts`).- [x] `POST /api/purchase-orders` - Create purchase orders

- [x] **Payments intake**

  - [x] Create `/app/api/payments/webhook/route.ts` per `docs/payment-webhook-flows.md` (verify signatures, idempotency, map payloads).- [x] REST endpoints to create and list purchase orders and invoices (`GET/POST /api/purchase-orders`, `PATCH /api/purchase-orders/[id]`, `GET/POST /api/invoices`).- [x] `PATCH /api/purchase-orders/{id}` - Update PO status, supplier actions

  - [x] Persist events with `createPaymentRecord`, update related invoice + PO, append ledger entry via `createLedgerEntry`.

  - [x] Invoke `lib/credit-engine.ts` success/failure hooks to refresh credit stats.- [x] Validation schemas covering purchase order create/update and invoice create flows (`lib/validation.ts`).- [x] `POST /api/invoices` - Generate invoices from fulfilled orders

- [x] **Supplier workspace parity** (`components/modules/supplier-module.tsx`)

  - [x] Strip hardcoded invoice/retailer fallbacks; show empty/error states driven by Firestore.- [x] `GET /api/invoices` - Query invoices with filters

  - [x] Ensure `loadSuppliers` reads canonical distributor source and surfaces failures in the UI (no `alert` usage).

  - [x] Add distributor "to-do" panel (pending PO approvals, overdue deliveries, unpaid invoices) backed by real queries.## 🚨 Blockers (must ship before production cutover)

- [x] **Logistics module** (`app/modules/logistics/page.tsx`) ✅ VERIFIED
  - [x] Replace static deliveries/routes/drivers arrays with live Firestore data (`sales_orders`, `drivers`, `routes`).
  - [x] Embed Google Maps visualisation with real-time driver ETA/status metrics sourced from Firestore.
  - [x] Persist driver assignment and proof-of-delivery metadata during payment release flow.
  - [x] Add refresh/search controls with toast-based error handling for operational parity.

- [x] **AI assistant agent orchestration** (`.cursor/rules`, `docs/AI_AGENT.md`)

  - [x] Restructure `.cursorrules` into a `<project_rules>` block so Cursor preloads project directives instead of mis-grouping them.
  - [x] Author role-specific prompt playbooks (operations, finance, engineering) mapping user roles to available system commands and data sources.
  - [x] Catalogue VendAI agent toolbelt (search, fetch data, run commands) and surface it in cursor rules for on-demand execution.
  - [x] Standardise rule naming/description metadata so `fetch_rules` selects the right instructions before edits, per Roman & Shrivu agent guidance.

- [x] **Payment intake pipeline**

  - [x] `POST /api/payments/webhook` - Handle M-Pesa/processor callbacks.
  - [x] Implement `/app/api/payments/webhook/route.ts` per `docs/payment-webhook-flows.md` (STK / processor callbacks, signature verification, idempotency guard).
  - [x] Enable status updates, driver assignment, proof-of-delivery capture.
  - [x] Integrate maps provider for route/ETA visualisation.
  - [x] `POST /api/payments/release` - Release escrow after delivery confirmation.

- [x] **Retailers module** (`app/modules/retailers/page.tsx`) ✅ VERIFIED
  - [x] Swap mocked retailers for Firestore (`users` where role = retailer) + aggregated order/GMV metrics.
  - [x] `GET /api/purchase-orders` - Query POs with filters and pagination
  - [x] Add filtering/sorting, credit exposure view, PO/invoice drill-downs.

- [x] **Inventory UX gaps** (`components/modules/inventory-module.tsx`) ✅ VERIFIED & FIXED
  - [x] Hook into `lib/credit-engine.ts` on success/failure to recalc credit limits and log score snapshots.
  - [x] `GET /api/ledger-entries` - Fetch commission and payout records
  - [x] Add debounced search input wired to Firestore queries.
  - [x] Implement real pagination/infinite scroll with smooth transitions (via `framer-motion`); stop loading entire collections.
  - [x] Fixed `limitQuery` compile error - replaced with proper `limit` function
  - [x] **Fixed Firestore index error** - Deployed composite index for `pos_products` (orgId + searchKeywords + updatedAt) ✅ DEPLOYED (5 Oct 2025)
  
- [x] **Supplier workspace accuracy** (`components/modules/supplier-module.tsx`) ✅ VERIFIED & FIXED
  - [x] Surface quick "Create PO" CTA on low-stock alerts to close ordering loop.
  - [x] Fixed Image component `fill` prop errors - replaced with explicit width/height
  - [x] Fixed variable declaration order issues (lowStockForSelectedSupplier, poTotals, loadTodoMetrics)
  - [x] Fixed RetailerData status type mismatch
  - [x] Fixed SettlementRecord status and dueDate type mismatches
  - [x] Added missing InvoicePayment.id field
  - [x] Added missing `loading` state variable

- [x] **Retailer-side supplier experience** ✅ VERIFIED
  - [x] Remove sample fallback data for invoices/retailers; display proper empty/error states instead of hardcoded suppliers.

### Credit & Risk Management

  - [x] Remove the Retailers tab when rendering the shared SupplierModule for retailer personas (split component if needed).

  - [x] Ensure supplier listings draw from live distributor data and expose PO creation + invoice tracking for retailers.

  - [x] Ensure `loadSuppliers` targets the canonical distributors collection and surfaces failures through the UI (no `alert` usage).

- [x] `POST /api/credit/assess` - Calculate credit score and limits ✅ VERIFIED
- [x] `GET /api/credit/history` - Fetch credit history and payment behavior ✅ VERIFIED
- [x] Add a distributor to-do strip (pending PO approvals, overdue deliveries, unpaid invoices) driven by live Firestore queries. ✅ VERIFIED

- [ ] **End-to-end validation**
  - [ ] Run and document full flow: low stock → PO submission → supplier approval → invoice → payment webhook → credit update → ledger entry. Capture logs & screenshots for go-live sign-off.



## 🔜 High Priority (after blockers)
- [x] Background job for credit score recalculation after payments ✅ DEPLOYED (functions/src/index.ts: recalculateCreditScores cron + onPaymentReceived trigger)
- [x] Build reconciliation worker (Cloud Function or scheduler) to match PO ↔ Invoice ↔ Payment and backfill ledger entries. ✅ DEPLOYED (functions/src/index.ts: reconciliationWorker - 2GB memory, daily 02:00)
- [x] Schedule overdue invoice reminders (email/SMS/in-app). ✅ DEPLOYED (functions/src/index.ts: overdueInvoiceReminders with communication queue - daily 09:00)
- [x] Extend credit engine integration to downgrade scores on disputes and update watchlist. ✅ DEPLOYED (functions/src/index.ts: onDisputeCreated, onDisputeResolved with real-time triggers)

### Reconciliation & Reporting

## 🎨 UX & Polish

- [x] Swap `alert()` calls for toast notifications (`components/ui/use-toast`). ✅ UPDATED (Firebase Migration Panel now surfaces success/error toasts)
- [ ] **Distributor retailers module** (`app/modules/retailers/page.tsx`)
- [x] Build reconciliation service (PO ↔ Invoice ↔ Payment matching) ✅ DEPLOYED (see Cloud Function `reconciliationWorker`)

- [x] Provide loading/empty/error states for supplier, invoice, retailer, logistics tables. ✅ Logistics map overlay & retry affordances added

- [x] Standardise search/filter UI across distributor dashboards. ✅ Unified dashboard search component adopted by logistics, retailers, and supplier modules.
  - [x] Swap hardcoded retailer list for Firestore (`users` where role = retailer) enriched with order/GMV aggregates.
  - [x] Generate ledger entries (commission, supplier payout, tax breakdown) ✅ Tax amounts recorded on ledger entries during webhook + release flows.

- [x] Add animated pagination/skeleton loaders consistent with VendAI design. ✅ Already rolled out across modules

- [x] Add dashboard widget summarising supplier to-dos (pending POs, invoices due, today’s deliveries). ✅ VERIFIED
  - [x] Inject filtering, sorting, and credit exposure metrics; support drill-down to PO/invoice history.
  - [x] Flag mismatches for operations review



## 🛡️ Security & Ops

- [x] Audit `firestore.rules` / `firestore-optimized.rules` for new collections (distributors, retailers, payments, ledger_entries, settlements)
  - Updated helpers and match blocks to enforce org-scoped access and mirrored changes in `firestore-optimized.rules`.
- [ ] Populate prod secrets (M-Pesa, Stripe/Flutterwave, credit engine, Firebase admin) and document deployment steps
  - [x] Authored `docs/PROD-SECRETS.md` with provisioning + deployment instructions.
  - [ ] Provision production values in Vercel/Firebase (ops handoff).
- [x] Add rate limiting / abuse protection for payment + order APIs
  - Applied global + actor-scoped rate limits to `app/api/invoices` and `app/api/purchase-orders/[purchaseOrderId]`.
- [x] Remove remaining fallback/sample data before release; rely on telemetry + empty states ✅ VERIFIED
- [ ] Confirm required Firestore indexes exist (suppliers by org, invoices by status, sales orders by driver/date)
  - [x] Reviewed `firestore.indexes.json` for coverage.
  - [ ] Validate presence in Firebase console before launch.

---

## 📚 Launch Readiness

- [ ] Update `GO-LIVE-GUIDE.md` with final flow diagrams, endpoint list, incident response.
- [ ] Produce distributor & retailer user guides (PO creation, invoice download, payment tracking).
- [ ] Document rollback procedure for payment/credit issues.
- [ ] Capture performance benchmarks (API latency, dashboard load) and add to `PRODUCTION-READINESS-REPORT.md`.
- [ ] Assemble final sign-off checklist assigning owners for backend, distributor UI, retailer UI, payments, credit, ops.

---

## B. Frontend Modules - Distributor Side

### 1. Supplier Module (Distributor View)

- [ ] **PO Inbox** - Display incoming purchase orders from retailers
  - [ ] Approve/Edit/Reject actions with status history
  - [ ] Bulk approval for multiple POs
  - [ ] Filtering by status, retailer, date range
- [ ] **Sales Orders** - Convert approved POs to sales orders
  - [ ] Fulfillment checklist with delivery checkpoints
  - [ ] Assign driver/warehouse

  - [ ] Mark as delivered with proof capture
- [ ] **Commission Dashboard** - Visualize earnings and payouts
  - [ ] Use `components/ui/chart.tsx` for revenue trends
  - [ ] Show pending vs paid commissions
  - [ ] Payout schedule calendar
- [ ] **Invoice Management** - Auto-generated invoices
  - [ ] Link invoices to POs and payments
  - [ ] Download/print invoice PDFs
  - [ ] Track payment status

### 2. Inventory Module (Distributor View)

- [ ] **Product catalog management** - Add/edit distributor products
- [ ] **Stock level tracking** - Real-time inventory counts
- [x] **Low stock alerts** - Notifications when stock < threshold ✅ VERIFIED
- [x] **Add search bar** with debounced filtering ✅ VERIFIED
- [x] **Implement cool pagination effect** (animated transitions, infinite scroll or load more) ✅ VERIFIED
- [ ] Bulk product upload via CSV
- [ ] Product image management with lazy loading

### 3. Logistics Module (Distributor View)

- [ ] **Active Deliveries** - Real-time delivery tracking
  - [ ] Fetch from `sales_orders` where status = 'in_transit'
  - [ ] GPS tracking integration (Google Maps API)
  - [ ] Update delivery status (picked up, in transit, delivered)
  - [ ] Proof of delivery capture (photo, signature)
- [ ] **Route Planning** - Optimize delivery routes
  - [ ] Group deliveries by location
  - [ ] Assign routes to drivers
  - [ ] Calculate ETAs
- [ ] **Driver Management** - Manage delivery personnel
  - [ ] Fetch from `drivers` collection
  - [ ] Assign deliveries to drivers
  - [ ] Track driver performance metrics
  - [ ] Driver availability calendar

### 4. Retailers Module (Distributor View)

- [ ] **Retail Partners** - Manage retailer network
  - [ ] Fetch from `users` where role = 'retailer'
  - [ ] View retailer profiles and business info
  - [ ] Track total orders, GMV, payment history
  - [ ] Credit limit management
- [ ] **Partner Orders** - View orders from all retailers
  - [ ] Filter by retailer, date, status
  - [ ] Export order reports
- [ ] **Performance Analytics** - Retailer insights
  - [ ] Top performing retailers
  - [ ] Order frequency trends
  - [ ] Payment behavior scores

---

## C. Frontend Modules - Retailer Side

### 1. Supplier Module (Retailer View)
- [x] **Remove Retailers tab completely** - Not relevant for retailer view ✅ VERIFIED
- [x] **Remove all hardcoded supplier data** - fetch from Firestore ✅ VERIFIED
- [ ] **Supplier Discovery** - Browse and connect with distributors
  - [ ] Search by name, category, location
  - [ ] View supplier profiles (products, terms, ratings)
  - [ ] Request partnership
- [ ] **My Suppliers** - Connected distributors
  - [ ] View products from each supplier
  - [ ] Compare pricing across suppliers
  - [ ] Quick reorder from order history
- [ ] **Purchase Orders** - Create and track POs
  - [ ] Create PO from inventory low-stock alerts
  - [ ] Pre-fill with product info and quantities
  - [ ] Track PO status (draft, submitted, approved, fulfilled)
  - [ ] View delivery ETA and checkpoints
- [ ] **Invoices** - Received invoices from suppliers
  - [ ] View invoice details and line items
  - [ ] Payment status tracking
  - [ ] Download/print invoices
- [ ] **Payment Methods** - Manage payment preferences
  - [ ] M-Pesa Till/Paybill setup
  - [ ] Bank transfer details
  - [ ] VendAI credit terms and limits

### 2. Inventory Module (Retailer View)
- [x] **Add search bar** with real-time filtering ✅ VERIFIED
- [x] **Implement cool pagination effect** (animated page transitions or infinite scroll) ✅ VERIFIED
- [x] **Low stock alerts** - Visual indicators for products < reorder level ✅ VERIFIED
  - [ ] Quick "Create PO" button from low-stock item
  - [ ] Suggested order quantities
- [ ] **Stock adjustment** - Record wastage, theft, returns
- [ ] **Product suggestions** - AI-powered recommendations
- [ ] **Barcode scanning** - Quick stock updates

---

## D. Payment Integrations

### M-Pesa Integration
- [ ] STK Push implementation via Safaricom Daraja or aggregator
- [ ] Store Till/Paybill credentials in secure env vars
- [x] Callback handler at `/api/payments/webhook` ✅ `app/api/payments/webhook/route.ts` handles processor callbacks with signature verification and idempotency guards.
- [ ] Auto-match payments to invoices using `account_reference`
- [ ] Handle payment failures and retries

### Bank Transfer
- [ ] Manual proof upload (PDF/Image) with admin approval
- [ ] Bank API integration (optional Phase 2) - Equity, KCB
- [ ] Auto-match incoming transfers to invoices

### Escrow Management
- [ ] Set up Stripe Connect or Flutterwave escrow accounts
- [ ] Hold funds until delivery confirmation
- [ ] Release endpoint after goods acknowledged
- [ ] Handle escrow disputes

---

## E. Credit Engine Integration

- [x] Wire credit engine to payment flow ✅ Payment webhook triggers `updateCreditProfile` to refresh metrics and limits.
  - [x] Call `assessCredit` after successful payment
  - [x] Update credit score snapshot
  - [x] Recalculate credit limits
- [x] Lower scores on payment failure/dispute ✅ Dispute/webhook flows adjust metrics and manual adjustments.
- [x] Update watchlist collection for high-risk accounts ✅ Cloud Functions persist watchlist entries when score dips or disputes spike.
- [ ] **Credit Insights Dashboard** (new component)
  - [ ] Display credit tier, limit, available balance
  - [ ] Forecast sparkline using `forecastCreditTrajectory`
  - [ ] Payment history timeline
  - [ ] Recommendations to improve score

---

## F. UI/UX Enhancements

### Search & Filtering
- [x] Add search bars to all list views (suppliers, products, invoices, orders) ✅ VERIFIED
- [x] Implement debounced search for performance ✅ VERIFIED
- [ ] Advanced filters (date range, status, category, etc.)
- [ ] Save filter presets

### Pagination & Loading States
- [x] Replace basic pagination with animated transitions ✅ VERIFIED
- [x] Implement infinite scroll or "Load More" with smooth animations ✅ VERIFIED
- [x] Skeleton loaders for better perceived performance ✅ VERIFIED
- [ ] Optimistic UI updates

### Data Visualization
- [ ] Revenue/commission charts using `components/ui/chart.tsx`
- [ ] Order volume trends
- [ ] Payment status pie charts
- [ ] Credit utilization gauges

### Mobile Responsiveness
- [ ] Test all modules on mobile devices
- [ ] Optimize touch interactions
- [ ] Responsive layouts for tablets

---

## G. Testing & QA

### Unit Tests
- [ ] Credit engine scoring (edge cases) - `__tests__/lib/credit-engine.test.ts`
- [ ] Invoice calculation functions
- [ ] Date/timestamp utilities

### Integration Tests
- [ ] API route handlers (mock Firestore & payment webhooks)
- [ ] End-to-end PO → Invoice → Payment flow
- [ ] Payment webhook scenarios (success, failure, timeout)

### Manual Testing
- [ ] Create scenario playbooks in `QUICK-TEST.md`
- [ ] Test "Mary's Duka" retailer journey
- [ ] Test distributor approval workflow
- [ ] Payment webhook testing with sandbox

### Load Testing
- [ ] Simulate payment webhook bursts
- [ ] Test concurrent PO creation
- [ ] Database query performance under load

---

## H. Compliance & Security

- [ ] KYB/KYC enforcement via payment processor
- [ ] Store verification status in Firestore
- [ ] Dispute handling workflow
  - [ ] Freeze credit exposure during disputes
  - [ ] Notify support team
  - [ ] Track resolution timeline
- [ ] Environment variables for payment secrets
  - [ ] M-Pesa credentials
  - [ ] Stripe/Flutterwave API keys
  - [ ] Firebase service account
- [ ] SOP documentation for manual overrides
  - [ ] Force close PO
  - [ ] Manual payout adjustments
  - [ ] Credit limit overrides

---

## I. Performance & Optimization

- [ ] Lazy load images with `LazyImage` component
- [ ] Implement code splitting for large modules
- [ ] Add service worker for offline support (retailer PO drafts)
- [ ] Optimize Firestore queries with proper indexes
- [ ] Cache frequently accessed data (suppliers, products)
- [ ] Implement stale-while-revalidate for API calls

---

## J. Documentation

- [ ] API endpoint documentation (request/response schemas)
- [ ] Firebase security rules documentation
- [ ] Payment webhook integration guide
- [ ] Credit engine scoring algorithm documentation
- [ ] User guides for retailers and distributors
- [ ] Admin operations manual

---

## K. Future Enhancements

- [ ] Multi-currency support (USD, GBP in addition to KES)
- [ ] Multi-language support (Swahili, English)
- [ ] SMS notifications for order updates
- [ ] WhatsApp Business API integration
- [ ] Advanced analytics and forecasting
- [ ] Loyalty program for retailers
- [ ] Bulk ordering discounts
- [ ] Supplier rating and review system
- [ ] Delivery scheduling preferences
- [ ] Tax compliance reports (VAT, withholding tax)

---

## Priority Matrix

### High Priority (This Sprint)
1. ✅ Remove hardcoded data from Supplier Module - COMPLETED
2. ✅ Add search bars and pagination to Inventory Module - COMPLETED
3. ✅ Remove Retailers tab from Retailer-side Supplier Module - COMPLETED
4. Make Logistics Module fetch real data
5. Make Retailers Module fetch real data

### Medium Priority (Next Sprint)
1. ✅ Implement payment webhook handler - COMPLETED
2. Wire credit engine to payment flow - IN PROGRESS (need background recalc job)
3. Add PO inbox for distributors
4. ✅ Implement invoice PATCH endpoint - COMPLETED
5. Build reconciliation service

### Low Priority (Backlog)
1. Escrow release workflow
2. Advanced analytics dashboards
3. Mobile app (React Native)
4. Multi-currency support
5. WhatsApp integration

---

**Last Updated:** October 3, 2025
**Status:** Active Development
