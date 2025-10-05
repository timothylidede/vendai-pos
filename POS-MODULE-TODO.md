# POS Module Modernization TODO

_Updated: October 5, 2025_

## 🎯 Mission
Bring the `POSPage` experience in line with a production-ready retail POS that supports rich payment workflows, receipt handling, and hardware integrations while preserving offline resilience and analytics.

---

## 1. Data Model & Types
- [x] Extend `POSOrderDoc` to include:
  - `payments: POSPayment[]`
  - `balanceDue`, `receiptNumber`, `completedAt`, `cashierId`
  - richer status enum: `draft | awaiting_payment | paid | void`
- [x] Define shared types in `types/pos.ts`:
  - `POSPayment`, `POSPaymentMethod`, `POSReceipt`, `POSCheckoutContext`
- [x] Add Firestore indexes / validation rules for the new fields.
- [ ] Write a one-time migration script to backfill legacy orders with default payment metadata.

## 2. Checkout UX & State
- [x] Replace the single "Complete Order" button with a multi-step checkout modal:
  - Payment method selector (cash, card, mobile money, mixed)
  - Tender inputs (amount received, reference numbers, phone for STK push)
  - Summary view (items, totals, taxes, discounts)
- [x] Track checkout state locally (support multiple tenders, change due, notes).
- [x] Add validation + guard rails (insufficient payment, overpayments, refund prompts).
- [x] Provide guest vs identified customer capture (optional loyalty information).

## 3. Payment Service Layer
- [x] Create `lib/payments/` with method-specific adapters:
  - `cash.ts`: simple acknowledgement, drawer trigger hook.
  - `mpesa.ts`: initiate STK push, poll/receive webhook callback.
  - `card-terminal.ts`: bridge to hardware SDK via Electron IPC.
  - `mixed.ts`: orchestrate multiple adapters in sequence.
- [x] Implement `useProcessPayment` hook to orchestrate:
  - Firestore order creation (`status: awaiting_payment`)
  - Payment processing + retries
  - Order finalization (`status: paid`, attach `payments[]`)
- [x] Surface failures to the UI with actionable retry/cancel options.

## 4. Receipt Generation & Printing
- [x] Build `lib/receipts/receipt-builder.ts` to assemble receipt data.
- [x] Create React receipt preview component for web/print.
- [x] Add HTML ↔ PDF export (for email / archive).
- [x] Wire ESC/POS command generator for thermal printers (Electron path).
- [x] Implement IPC bridge `electron/receipt-printer.ts` for USB/Bluetooth printers.
- [x] Persist receipt metadata & storage location on the order doc.

## 5. Hardware Integrations
- [x] Barcode scanner: confirm HID support & add focus management helpers.
- [x] Cash drawer: trigger via printer kick or dedicated relay (Electron IPC).
- [x] Card reader SDK: encapsulate vendor-specific flows.
- [x] Device status indicators in the UI (connected/disconnected).

## 6. Inventory & Reporting Enhancements
- [ ] Ensure stock deductions reflect multi-tender transactions (e.g., void on failure).
- [ ] Add audit logging per payment + cashier.
- [ ] Update dashboards to visualize payments by method, refunds, voids.
- [ ] Create nightly job to reconcile payment gateway settlements vs POS records.

## 7. Offline & Sync Strategy
- [ ] Store cart + checkout state in IndexedDB for offline continuity.
- [ ] Queue payment intents when offline; retry on reconnect with operator confirmation.
- [ ] Add conflict resolution (e.g., duplicate payments, stale inventory counts).

## 8. QA & Tooling
- [ ] Unit tests for payment adapters & receipt builder.
- [ ] Integration tests covering cash and mobile money happy paths.
- [ ] Cypress/E2E scenario for full checkout + printing (mock hardware layer).
- [ ] Update lint/test scripts to cover new directories.

## 9. Documentation & Rollout
- [ ] Author developer guide (`docs/POS-Payments.md`) covering architecture, environment setup, hardware pairing.
- [ ] Draft cashier user manual with walkthroughs + troubleshooting.
- [ ] Staged rollout plan with feature flags (enable payments per tenant).
- [ ] Training checklist for on-site deployment.

---

### Nice-to-Have Enhancements
- Loyalty & rewards integration.
- Digital receipt delivery (email/SMS/WhatsApp).
- Customer-facing display webview showing cart totals.
- AI-powered upsell suggestions during checkout.

---

**Owner:** POS squad  
**Next milestone:** Prototype payment modal + cash flow  
**Related files:** `components/modules/pos-page.tsx`, `lib/pos-operations-optimized.ts`, `electron/*.ts`, `types/pos.ts`
