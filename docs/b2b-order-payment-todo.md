# B2B Order & Payment Flow — Build Plan

_A living implementation plan for the PO → Invoice → Payment loop that powers VendAI's 5% commission marketplace. Update as milestones complete._

## 1. Current Baseline (October 2025)

- **Order capture**: `app/api/orders/route.ts` stores basic POS orders without PO/payment state separation.
- **Inventory intelligence**: `components/modules/inventory-module.tsx` already surfaces low-stock signals and supplier suggestions.
- **Supplier ops**: `components/modules/supplier-module.tsx` lists distributors, products, invoices, and retailer stats (needs deeper integration).
- **Payments**: No end-to-end flow yet. `docs/payment-webhook-flows.md` describes the marketplace payment architecture using a processor like Stripe Connect.
- **Credit modelling**: Fresh module at `lib/credit-engine.ts` models tiers and limit recommendations (not wired into UI/API yet).

## 2. Target Flow Recap

1. Retailer triggers **Purchase Order** from low-stock suggestion.
2. Supplier reviews → approves, edits, or rejects → becomes **Sales Order**.
3. Delivery + auto-generated **Invoice** (linked to PO).
4. **Payment collection** via M-Pesa Till/Paybill, bank transfer, or VendAI credit terms.
5. Automatic **reconciliation** across PO → Invoice → Payment with 5% commission extraction and ledger updates.

## 3. Workstream Breakdown & TODOs

### A. Data Model & Storage
- [x] Create Firestore collections:
  - `purchase_orders` (status: draft, submitted, approved, rejected, fulfilled).
  - `sales_orders` (mirror of PO once supplier approves).
  - `invoices` (link to PO + delivery confirmation).
  - `payments` (store processor payload, method, settlement refs).
  - `ledger_entries` (commission, supplier payout, reconciliation status).
- [x] Add composite indexes (FireStore `firestore-optimized.indexes.json`) for filtering by org, status, and supplier.
- [x] Extend `types/` with shared interfaces (PO, SalesOrder, Invoice, Payment, LedgerLine) for API & UI reuse.
- [x] Store audit trail (status history array) inside each PO and Invoice document.

### B. API & Backend Logic
- [ ] Build REST endpoints under `app/api/orders/b2b/` (or refactor existing) for:
  - [x] `POST /purchase-orders` (create from inventory trigger).
  - [x] `PATCH /purchase-orders/{id}` (supplier actions, status updates).
  - [ ] `POST /invoices` (auto-generate on delivery confirmation).
  - [ ] `POST /payments/webhook` (handles processor/M-Pesa callbacks — reference `docs/payment-webhook-flows.md`).
- [x] Implement server-side validation with Zod schemas inside `lib/validation.ts`.
- [ ] Integrate credit engine:
  - On successful payment, call `assessCredit` to recalc limit, persist score snapshot.
  - On payment failure/dispute, lower scores and update watchlist collection.
- [ ] Add background job (Cloud Functions or scheduled API) to reconcile unpaid invoices, send reminders, and trigger credit reviews.

### C. Frontend Modules
- [ ] **Inventory Module**
  - Surface “Create PO” CTA when stock < threshold.
  - Pre-fill PO form with `InventoryProduct` info and preferred suppliers.
  - Show PO status chip and delivery ETA tracker.
- [ ] **Supplier Module**
  - Add PO inbox for suppliers with approve/edit/reject actions.
  - Display Sales Orders + fulfillment checklist.
  - Visualize commission and payout schedule using `components/ui/chart.tsx`.
- [ ] **Payments Module (new)**
  - Create `components/modules/payments-module.tsx` for finance overview (PO → Invoice → Payment timeline, ledger, reconciliation alerts).
  - Include quick actions: mark manual bank transfer received, upload proof, trigger dispute workflow.
- [ ] **Credit Insights**
  - New dashboard card summarising credit tier, recommended limit, and headroom (reuse `lib/credit-engine.ts`).
  - Add forecast sparkline using `forecastCreditTrajectory` output.

### D. Integrations
- [ ] **M-Pesa Till/Paybill**
  - Wire STK push via chosen aggregator (e.g., Safaricom Daraja, Flutterwave) with callback URL hitting `/api/payments/webhook`.
  - Store Till/Paybill credentials in secure config (Vault / environment secrets).
  - Map callback payload → payment record; auto-match to invoice using `account_reference` (set to invoice ID).
- [ ] **Bank Transfer**
  - Phase 1: manual proof upload (PDF/Image) + finance approval toggle.
  - Phase 2: optional bank API integration (Equity, KCB) to auto-match incoming transfers.
- [ ] **Escrow control**
  - When VendAI acts as escrow, set `transfer_data` destination supplier account (Stripe Connect) and hold release until delivery confirmation.
  - Implement release endpoint `/api/payments/release` after goods acknowledged.

### E. Reconciliation & Reporting
- [ ] Build reconciliation service that:
  - Matches PO ↔ Invoice ↔ Payment via shared IDs.
  - Generates ledger entries (commission, supplier net payout, tax breakdown).
  - Flags mismatches (e.g., delivered but unpaid) for operations review.
- [ ] Extend admin dashboard with timeline view & filters (paid/unpaid, overdue).
- [ ] Export CSV/PDF reports for accounting (monthly settlement statements).

### F. Compliance & Ops
- [ ] Enforce KYB/KYC on suppliers via payment processor onboarding, store verification status locally.
- [ ] Implement dispute handling workflow (freeze credit exposure, notify support, track resolution).
- [ ] Update `FIREBASE_SERVICE_ACCOUNT_SETUP.md` or new runbook with env vars/configs for payment processor & M-Pesa secrets.
- [ ] Draft SOP for manual overrides (force close PO, manual payout adjustments).

### G. Testing & QA
- [ ] Write unit tests for credit engine scoring (edge cases) — place under `__tests__/lib/credit-engine.test.ts`.
- [ ] Add integration tests using Next.js route handlers (mock Firestore & payment webhooks).
- [ ] Create scenario playbooks (Mary’s Duka) in `QUICK-TEST.md` to validate end-to-end flow.
- [ ] Conduct load tests on webhook endpoint (simulate payment bursts).

## 4. Milestone Suggestions

1. **Milestone 1 — PO → Invoice plumbing**
   - Data models + CRUD APIs + UI wiring (no payments yet).
2. **Milestone 2 — Payment integration**
   - M-Pesa + processor webhook + ledger auto-generation.
3. **Milestone 3 — Credit & reconciliation intelligence**
   - Credit engine wiring, analytics, alerting, reporting.
4. **Milestone 4 — Escrow & compliance hardening**
   - Escrow release flow, dispute handling, SOP docs.

## 5. Open Questions

- Preferred processor for marketplace payouts (Stripe Connect vs Flutterwave vs Adyen)?
- Which suppliers qualify for escrow by default vs direct settlement?
- Do we require offline-first support for PO creation (saves draft locally)?
- What SLA do we promise for manual bank transfer approvals?

Keep this TODO in sync with actual progress. Tag owners next to tasks as work starts.
