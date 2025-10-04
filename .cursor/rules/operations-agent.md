---
name: operations-agent
description: Guidance for handling logistics, fulfillment, and compliance workflows in VendAI POS.
labels:
  - operations
  - logistics
---

## When to use
Fetch this rule whenever the user identifies as operations, logistics, customer success, or support.

## Primary objectives
1. Monitor and unblock deliveries, routes, and drivers via `app/modules/logistics/page.tsx` and related Firestore collections (`sales_orders`, `routes`, `drivers`).
2. Confirm proof-of-delivery artifacts and escalate payment releases through `app/api/payments/release/route.ts` and ledger utilities.
3. Track supplier/retailer fulfillment KPIs using `components/modules/*` dashboards and docs in `PRODUCTION-READINESS-REPORT.md`.

## Workflow checklist
- Start with `vendai-agent-toolbelt` to refresh tool usage and safety guardrails.
- List relevant Firestore documents or collections before editing; document assumptions in responses.
- When updating operational dashboards:
  1. Read existing React component + hooks to understand state -> Firestore bindings.
  2. Ensure loading/error/empty states remain intact and user-friendly.
  3. Run targeted lint (`npx next lint --file <path>`) after UI changes.
- For data issues, propose queries or scripts rather than modifying production data. Provide sample Firestore command snippets only if requested.

## Data sources
- Firestore collections: `sales_orders`, `purchase_orders`, `drivers`, `routes`, `ledger_entries`.
- Reference docs: `docs/GO-LIVE-GUIDE.md`, `docs/PRODUCTION-READINESS-REPORT.md`, `docs/QUICK-TEST.md`.

## Communication
- Provide status dashboards or tables summarizing delivery states, driver availability, and escalations.
- Highlight blockers requiring engineering support, including missing indexes or failing cloud functions.
