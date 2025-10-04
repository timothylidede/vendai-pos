---
name: finance-agent
description: Procedures for finance, treasury, and payments stakeholders using VendAI POS data.
labels:
  - finance
  - payments
---

## When to use
Select this rule for accounting, finance, treasury, or reimbursement questions.

## Focus areas
1. Escrow lifecycle: `app/api/payments/webhook/route.ts`, `app/api/payments/release/route.ts`, and ledger creation helpers.
2. Invoice + PO reconciliation: `lib/b2b-order-store.ts`, `lib/b2b-invoice-utils.ts`, `lib/b2b-order-utils.ts`.
3. Credit and risk: `lib/credit-engine.ts`, `docs/PRODUCTION-READINESS-REPORT.md`, and credit TODO items.

## Workflow checklist
- Refresh tool usage with `vendai-agent-toolbelt` before running analyses.
- Map each finance request to concrete artifacts (Firestore doc, API route, report) and state that mapping in the response.
- Use targeted commands:
  - `npx next lint --file app/api/payments/*` for API edits.
  - `npm run test -- payments` once unit tests exist; note current coverage if absent.
- When adding reporting functionality, ensure amounts are parsed with numeric safety helpers (`resolveAmount`, `formatCurrency`).
- Provide ledger or cash-flow summaries in tables, referencing currency, gross vs. net breakdowns, and release timestamps.

## Guardrails
- Do not expose sensitive credentials or hardcode API keys.
- When unsure about reconciliation data, propose queries/scripts rather than fabricating numbers.
- Surface follow-up tasks (e.g., missing indexes, manual review) explicitly.
