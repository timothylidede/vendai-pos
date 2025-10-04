# VendAI POS - Development TODO

_Last updated: 4 Oct 2025_

## 🔧 Recent Fixes (4 Oct 2025)

### Fixed Issues in Supplier & Inventory Modules
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

  - [x] Add distributor "to-do" panel (pending PO approvals, overdue deliveries, unpaid invoices) backed by real queries.## 🚨 Blockers (must ship before production cutover)- [ ] `PATCH /api/invoices/[id]` - Update invoice status, payments ❌ NOT IMPLEMENTED (only GET/POST exist)

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
  
- [x] **Supplier workspace accuracy** (`components/modules/supplier-module.tsx`) ✅ VERIFIED & FIXED
  - [x] Surface quick "Create PO" CTA on low-stock alerts to close ordering loop.
  - [x] Fixed Image component `fill` prop errors - replaced with explicit width/height
  - [x] Fixed variable declaration order issues (lowStockForSelectedSupplier, poTotals, loadTodoMetrics)
  - [x] Fixed RetailerData status type mismatch
  - [x] Fixed SettlementRecord status and dueDate type mismatches
  - [x] Added missing InvoicePayment.id field
  - [x] Added missing `loading` state variable

- [ ] **Retailer-side supplier experience**

  - [ ] Remove sample fallback data for invoices/retailers; display proper empty/error states instead of hardcoded suppliers.

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
- [x] **Distributor logistics module** (`app/modules/logistics/page.tsx`)
- [x] `PATCH /api/credit/limits` - Manual limit adjustments ✅ VERIFIED

- [ ] Add `PATCH /api/invoices/{id}` for status transitions, payment IDs, status history.

- [x] Expose `/api/payments/release` to handle escrow payouts post-delivery.

  - [x] Replace static deliveries/routes/drivers arrays with Firestore-backed data (`sales_orders`, `drivers`, `routes`).
  - [x] Provide actions to update delivery status, assign drivers, and store proof-of-delivery metadata.
  - [x] Integrate chosen maps provider for live route/ETA visualisation.

- [ ] Background job for credit score recalculation after payments

- [ ] Build reconciliation worker (Cloud Function or scheduler) to match PO ↔ Invoice ↔ Payment and backfill ledger entries.

- [ ] Schedule overdue invoice reminders (email/SMS/in-app).

- [ ] Extend credit engine integration to downgrade scores on disputes and update watchlist.

  - [ ] Integrate chosen maps provider for live route/ETA visualisation.### Reconciliation & Reporting

## 🎨 UX & Polish

- [ ] Swap `alert()` calls for toast notifications (`components/ui/use-toast`).- [ ] **Distributor retailers module** (`app/modules/retailers/page.tsx`)- [ ] Build reconciliation service (PO ↔ Invoice ↔ Payment matching)

- [ ] Provide loading/empty/error states for supplier, invoice, retailer, logistics tables.

- [ ] Standardise search/filter UI across distributor dashboards.  - [ ] Swap hardcoded retailer list for Firestore (`users` where role = retailer) enriched with order/GMV aggregates.- [ ] Generate ledger entries (commission, supplier payout, tax breakdown)

- [ ] Add animated pagination/skeleton loaders consistent with VendAI design.

- [ ] Add dashboard widget summarising supplier to-dos (pending POs, invoices due, today’s deliveries).  - [ ] Inject filtering, sorting, and credit exposure metrics; support drill-down to PO/invoice history.- [ ] Flag mismatches for operations review



## 🛡️ Security & Ops- [ ] **Inventory module UX gaps** (`components/modules/inventory-module.tsx`)- [ ] `GET /api/reports/settlements` - Monthly settlement statements

- [ ] Audit `firestore.rules` / `firestore-optimized.rules` for new collections (distributors, retailers, payments, ledger_entries, settlements).

- [ ] Populate prod secrets (M-Pesa, Stripe/Flutterwave, credit engine, Firebase admin) and document deployment steps.  - [ ] Add debounced search input tied to Firestore queries.- [ ] `GET /api/reports/reconciliation` - Reconciliation status dashboard

- [ ] Add rate limiting / abuse protection for payment + order APIs.

- [ ] Remove remaining fallback/sample data before release; rely on telemetry + empty states.  - [ ] Implement real pagination / infinite scroll with smooth transitions using `framer-motion`; avoid loading entire collections at once.

- [ ] Confirm required Firestore indexes exist (suppliers by org, invoices by status, sales orders by driver/date).

  - [ ] Surface quick "Create PO" CTA for low-stock items to close the PO loop.---

## 📚 Launch Readiness

- [ ] Update `GO-LIVE-GUIDE.md` with final flow diagrams, endpoint list, incident response.- [ ] **Retailer-side supplier experience**

- [ ] Produce distributor & retailer user guides (PO creation, invoice download, payment tracking).

- [ ] Document rollback procedure for payment/credit issues.  - [ ] Remove the Retailers tab when the shared `SupplierModule` renders for retailer personas; split view components if necessary.## B. Frontend Modules - Distributor Side

- [ ] Capture performance benchmarks (API latency, dashboard load) and add to `PRODUCTION-READINESS-REPORT.md`.

- [ ] Assemble final sign-off checklist assigning owners for backend, distributor UI, retailer UI, payments, credit, ops.  - [ ] Ensure supplier listings read from live distributor data and expose PO creation + invoice tracking workflows for retailers.


- [ ] **End-to-end validation**### 1. Supplier Module (Distributor View)

  - [ ] Execute and document a full scenario: low stock → PO submission → supplier approval → invoice creation → payment webhook → credit update → ledger entry. Capture logs/screenshots for go-live.- [ ] **Remove all hardcoded supplier data** - fetch from Firestore `distributors` collection

- [ ] **PO Inbox** - Display incoming purchase orders from retailers

## 🔜 High Priority (immediately after blockers)  - [ ] Approve/Edit/Reject actions with status history

- [ ] Implement `PATCH /api/invoices/{id}` for status transitions, payment ID linkage, and status history updates.  - [ ] Bulk approval for multiple POs

- [ ] Expose `/api/payments/release` to process escrow payouts after confirmed delivery.  - [ ] Filtering by status, retailer, date range

- [ ] Build reconciliation worker (Cloud Function / scheduled job) to match PO ↔ Invoice ↔ Payment, flag mismatches, and backfill ledger docs.- [ ] **Sales Orders** - Convert approved POs to sales orders

- [ ] Schedule reminders for overdue invoices (email/SMS/notifications).  - [ ] Fulfillment checklist with delivery checkpoints

- [ ] Extend credit engine integration to downgrade scores on disputes and update the watchlist collection.  - [ ] Assign driver/warehouse

  - [ ] Mark as delivered with proof capture

## 🎨 UX & Polish- [ ] **Commission Dashboard** - Visualize earnings and payouts

- [ ] Replace `alert()` calls with toast notifications via `components/ui/use-toast`.  - [ ] Use `components/ui/chart.tsx` for revenue trends

- [ ] Provide loading, empty, and error states for supplier, invoice, retailer, and logistics tables.  - [ ] Show pending vs paid commissions

- [ ] Standardise search/filter controls across distributor dashboards (suppliers, invoices, retailers, logistics).  - [ ] Payout schedule calendar

- [ ] Add animated pagination or skeleton loaders to align with VendAI visual language.- [ ] **Invoice Management** - Auto-generated invoices

- [ ] Ship a dashboard widget summarising supplier to-dos (pending POs, invoices due, deliveries today).  - [ ] Link invoices to POs and payments

  - [ ] Download/print invoice PDFs

## 🛡️ Security & Ops  - [ ] Track payment status

- [ ] Audit `firestore.rules` / `firestore-optimized.rules` for new collections (`distributors`, `retailers`, `payments`, `ledger_entries`, `settlements`) to ensure org-level access control.

- [ ] Populate production secrets (M-Pesa, Stripe/Flutterwave, credit engine, Firebase admin) and document deployment steps.### 2. Inventory Module (Distributor View)

- [ ] Add rate limiting / abuse protection for payment and order endpoints.- [ ] **Product catalog management** - Add/edit distributor products

- [ ] Purge remaining fallback/sample data blocks before final build; rely on telemetry + empty states.- [ ] **Stock level tracking** - Real-time inventory counts

- [ ] Verify required Firestore indexes exist (suppliers by org, invoices by status, sales orders by driver/date).- [ ] **Low stock alerts** - Notifications when stock < threshold

- [ ] **Add search bar** with debounced filtering

## 📚 Documentation & Launch Readiness- [ ] **Implement cool pagination effect** (animated transitions, infinite scroll or load more)

- [ ] Update `GO-LIVE-GUIDE.md` with final flow diagrams, endpoint list, and incident response steps.- [ ] Bulk product upload via CSV

- [ ] Deliver distributor and retailer user guides (PO creation, invoice download, payments tracking).- [ ] Product image management with lazy loading

- [ ] Document rollback procedures for payment failures and credit mis-calculations.

- [ ] Capture performance benchmarks (API latency, dashboard load times) and summarize in `PRODUCTION-READINESS-REPORT.md`.### 3. Logistics Module (Distributor View)

- [ ] Compile a final sign-off checklist assigning owners for backend, distributor UI, retailer UI, payments, credit, and ops.- [ ] **Make fully functional** - Remove hardcoded data

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
- [ ] **Make fully functional** - Remove hardcoded data
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
- [ ] **Remove Retailers tab completely** - Not relevant for retailer view
- [ ] **Remove all hardcoded supplier data** - fetch from Firestore
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
- [ ] **Add search bar** with real-time filtering
- [ ] **Implement cool pagination effect** (animated page transitions or infinite scroll)
- [ ] **Low stock alerts** - Visual indicators for products < reorder level
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
- [ ] Callback handler at `/api/payments/webhook`
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

- [ ] Wire credit engine to payment flow
  - [ ] Call `assessCredit` after successful payment
  - [ ] Update credit score snapshot
  - [ ] Recalculate credit limits
- [ ] Lower scores on payment failure/dispute
- [ ] Update watchlist collection for high-risk accounts
- [ ] **Credit Insights Dashboard** (new component)
  - [ ] Display credit tier, limit, available balance
  - [ ] Forecast sparkline using `forecastCreditTrajectory`
  - [ ] Payment history timeline
  - [ ] Recommendations to improve score

---

## F. UI/UX Enhancements

### Search & Filtering
- [ ] Add search bars to all list views (suppliers, products, invoices, orders)
- [ ] Implement debounced search for performance
- [ ] Advanced filters (date range, status, category, etc.)
- [ ] Save filter presets

### Pagination & Loading States
- [ ] Replace basic pagination with animated transitions
- [ ] Implement infinite scroll or "Load More" with smooth animations
- [ ] Skeleton loaders for better perceived performance
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
1. Remove hardcoded data from Supplier Module
2. Add search bars and pagination to Inventory Module
3. Remove Retailers tab from Retailer-side Supplier Module
4. Make Logistics Module fetch real data
5. Make Retailers Module fetch real data

### Medium Priority (Next Sprint)
1. Implement payment webhook handler
2. Wire credit engine to payment flow
3. Add PO inbox for distributors
4. Implement invoice PATCH endpoint
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
