# End-to-End Validation Runbook

_Last reviewed: 4 Oct 2025_

## 🎯 Goal
Validate the full distributor → retailer workflow end-to-end:
1. Low stock alert triggers a retailer purchase order.
2. Supplier approves and fulfills the PO, generating a sales order.
3. Invoice is issued and updated through `/api/invoices/[id]`.
4. Payment webhook confirms settlement and refreshes credit metrics.
5. Ledger and credit history artefacts are captured for audit.

## ⚙️ Environment & Prerequisites
- Access to the VendAI Firebase project (Firestore + Storage) with editor permissions.
- Test distributor organization with linked supplier inventory.
- Test retailer user seeded in `users` collection with role `retailer` and org mapping.
- Firebase Emulator Suite **or** staging project credentials for safe testing.
- Ability to invoke Cloud Functions / Next.js API routes locally (`npm run dev`) or via deployed staging instance.
- Optional: Safaricom Daraja sandbox credentials (if exercising real STK push).

### Required configuration
- Update `.env.local` with Firebase web config and service account creds for admin calls.
- Ensure OpenAI/Replicate keys are stubbed or disabled (not part of this test).
- If running locally, start Next.js (`npm run dev`) and point API calls to `http://localhost:3000`.

## 🧪 Test Data Seeding
- [ ] Create distributor org in `organizations` with realistic metadata.
- [ ] Seed supplier inventory in `pos_products` (minimum 5 SKUs) + `inventory` stock levels (`unitsPerBase`, reorder level below threshold for 2 SKUs).
- [ ] Insert retailer profile in `users` (role `retailer`) with `organizationId` referencing distributor.
- [ ] Add credit profile in `credit_profiles` for retailer (baseline limit, outstanding = 0).
- [ ] Optional: Pre-create `purchase_orders` document in `draft` state for reference.

## 🔁 Execution Steps
1. **Trigger low-stock alert**
   - [ ] Reduce inventory quantities below `reorderLevel` for selected SKUs.
   - [ ] Confirm alert surfaces in supplier module low-stock panel.
   - [ ] Initiate "Create PO" flow from alert (UI or API `POST /api/purchase-orders`).
2. **Supplier approval**
   - [ ] Approve PO via UI or `PATCH /api/purchase-orders/{id}` to transition `submitted → approved → fulfilled`.
   - [ ] Ensure `relatedInvoiceId` remains empty until invoice creation.
3. **Invoice creation & update**
   - [ ] Generate invoice (`POST /api/invoices`).
   - [ ] Call `PATCH /api/invoices/[id]` to mark status `issued`, set `paymentStatus=pending` and attach payment IDs placeholder.
4. **Payment webhook simulation**
   - [ ] Fire `POST /api/payments/webhook` with sandbox payload (use `docs/payment-webhook-flows.md`).
   - [ ] Verify idempotency key handling and payment record creation.
   - [ ] Confirm invoice payment status transitions to `paid` and PO marked `fulfilled`.
5. **Credit refresh**
   - [ ] Invoke `/api/credit/assess` with latest order/payment metrics.
   - [ ] Check `/api/credit/history` reflects new entry.
   - [ ] Update credit limit via `/api/credit/limits` if manual adjustment required.
6. **Ledger & audit artefacts**
   - [ ] Validate ledger entry appended via `createLedgerEntry` helper.
   - [ ] Snapshot Firestore docs (PO, invoice, payment, credit profile, ledger).

## 📊 Verification & Evidence Collection
- [ ] Screenshots: low-stock alert, PO approval screen, invoice detail before/after payment.
- [ ] Logs: API responses for PO, invoice, payment, credit endpoints.
- [ ] Firestore snapshots (JSON export) for mutated collections.
- [ ] Credit score/limit delta summary (before vs after webhook).
- [ ] Update `GO-LIVE-GUIDE.md` and `PRODUCTION-READINESS-REPORT.md` with findings.

## ✅ Sign-off Checklist
| Item | Owner | Status | Notes |
| --- | --- | --- | --- |
| Seed data prepared |  | Pending |  |
| Low-stock → PO submission |  | Pending |  |
| Supplier approval & fulfillment |  | Pending |  |
| Invoice issued & patched |  | Pending |  |
| Payment webhook executed |  | Pending |  |
| Credit refresh verified |  | Pending |  |
| Ledger entries confirmed |  | Pending |  |
| Evidence archived |  | Pending |  |

_Status:_ In planning. Execution requires shared staging credentials; no automated test run captured yet.

## 🔗 References
- `docs/payment-webhook-flows.md`
- `FIXES_SUMMARY_2025-10-04.md`
- `GO-LIVE-GUIDE.md`
- `lib/b2b-order-store.ts`, `lib/credit-engine.ts`
- API routes under `app/api/purchase-orders`, `app/api/invoices`, `app/api/payments`, `app/api/credit`

## 📝 Notes
- Consider recording the run (screen capture) for training material.
- If using Firebase emulator, adjust API URLs to `http://localhost:PORT` and seed via scripts in `scripts/` folder.
- Capture any schema discrepancies and feed back into `lib/validation.ts` or Firestore indexes list.
