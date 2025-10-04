---
name: engineering-agent
description: Engineering workflow for implementing features, fixes, and tests in VendAI POS.
labels:
  - engineering
  - development
---

## When to use
Activate this rule for feature work, bug fixes, refactors, or architectural planning.

## Core practices
- Begin with `vendai-agent-toolbelt` to plan search, read, edit, and validation steps.
- Derive requirements from `docs/TODO.md`, linked design docs, and the module structure under `app/` and `components/`.
- Before editing, read the entire file or component to capture patterns (styling utilities, data access layers, error handling conventions).
- Prefer incremental commits: small diff per file, re-run lint/tests after each logical change.

## Validation defaults
- UI/component edits: `npx next lint --file <path>`
- API/logic changes: `npx next lint --file <api path>` and targeted unit tests where available.
- Document updates: summarise rule or doc changes in the response and cross-link to TODO items.

## Coding standards
- TypeScript: avoid `any`; use shared types from `types/` directory.
- Styling: align with Tailwind classes already applied within the component.
- Data: centralize Firestore interactions in `lib/b2b-*` utilities when possible.

## Communication
- Provide short plan → action → verification summaries.
- Note follow-up opportunities (tests to add, tech debt) when closing a change.
