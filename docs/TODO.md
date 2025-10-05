# VendAI POS - Development TODO

_Last updated: 5 Oct 2025_

## 🔧 Recent Fixes (5 Oct 2025)

- ✅ Retailer supplier module restyled with cool-toned visuals, inventory-aware distributor suggestions, and a minimal empty state (`components/modules/supplier-module.tsx`).

### Fixed Issues in Suppli## 🎨 U### Reconciliation & Reporting

- [x] Build reconciliation service (PO ↔ Invoice ↔ Payment matching) ✅ Cloud Function `reconciliationWorker` matches PO, invoice, and payment documents nightly.
- [x] Generate ledger entries (commission, supplier payout, tax breakdown) ✅ Ledger records now capture tax amounts and supplier payout metadata during payment release and webhook ingestion.
- [x] Flag mismatches for operations review
- [ ] `GET /api/reports/settlements` - Monthly settlement statements
- [ ] `GET /api/reports/reconciliation` - Reconciliation status dashboard

## 🎨 UX & Polish

- [x] Swap `alert()` calls for toast notifications (`components/ui/use-toast`) ✅ `useToast` is wired across distributor and retailer modules; no `alert()` usage remains.
- [x] Provide loading/empty/error states for supplier, invoice, retailer, logistics tables ✅ VERIFIED
- [x] Standardise search/filter UI across distributor dashboards ✅ Shared dashboard search controls rolled out across logistics, retailers, and supplier views.
- [x] Add animated pagination/skeleton loaders consistent with VendAI design ✅ VERIFIED
- [x] Add dashboard widget summarising supplier to-dos (pending POs, invoices due, today's deliveries) ✅ VERIFIED
- [x] Swap `alert()` calls for toast notifications (`components/ui/use-toast`).
- [x] Build reconciliation service (PO ↔ Invoice ↔ Payment matching)
- [x] Provide loading/empty/error states for supplier, invoice, retailer, logistics tables.
- [x] Standardise search/filter UI across distributor dashboards. ✅ Unified dashboard search component adopted by logistics, retailers, and supplier modules.
- [x] Generate ledger entries (commission, supplier payout, tax breakdown) ✅ Ledger entries now include explicit tax amounts alongside commission and payout data.
- [x] Add animated pagination/skeleton loaders consistent with VendAI design.
- [x] Add dashboard widget summarising supplier to-dos (pending POs, invoices due, today's deliveries). ✅ VERIFIED
- [x] Flag mismatches for operations review
- ✅ **Supplier Module** (`components/modules/supplier-module.tsx`)
  - Fixed Image component errors (removed `fill` prop, added explicit width/height)
  - Fixed variable declaration order (moved useMemo hooks before callbacks that depend on them)
  - Fixed RetailerData status type to properly enforce union type
  - Fixed SettlementRecord status and dueDate type mismatches
  - Added missing InvoicePayment.id field
  - Added missing `loading` state variable

- ✅ **Inventory Module** (`components/modules/inventory-module.tsx`)
  - Fixed `limitQuery` error by replacing with correct `limit` function from firebase/firestore

### Verification Status
- ✅ **Logistics Module** - Verified to use real Firestore data (sales_orders, drivers, routes)
- ✅ **Retailers Module** - Verified to use real Firestore data (users where role = retailer)
- ✅ **Credit API** - `/api/credit/assess`, `/api/credit/history`, and `/api/credit/limits` implemented
- ✅ **Invoice PATCH** - `/api/invoices/[id]` supports status and payment updates



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
