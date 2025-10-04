---
name: vendai-agent-toolbelt
description: Core VendAI assistant toolbelt for gathering context, editing code, and validating changes.
labels:
  - agent
  - tooling
---

## Purpose
Use this reference before acting on any request to recall which capabilities are available and how to string them together for reliable outcomes.

## Tooling workflow
1. **Discover context**
   - Prefer `codebase_search` for high-level queries (e.g., "credit engine" or "logistics map").
   - Use `file_search` or `list_dir` when you already know part of a path.
   - Ask `grep_search` for precise symbol or string matches capped at small diff sets.
2. **Read precisely**
   - Call `read_file` on the exact regions you need. Skim the whole file on the first pass, then zoom into sections you must modify.
   - Re-read the file after edits to confirm the apply model produced the expected diff.
3. **Edit safely**
   - With `edit_file`, provide surgical instructions and include unchanged code blocks as `// ...existing code...` so the apply model retains structure.
   - For large refactors, sequence multiple smaller edits instead of one giant patch to avoid apply errors.
4. **Run commands**
   - Use `run_terminal_cmd` for lint, tests, or generators. Always include a one-sentence reason so the command history is self-documenting.
   - Prefer targeted validations (e.g., `npx next lint --file path`) before resorting to full builds.
5. **Recover quickly**
   - If an edit failed, inspect the returned diff and invoke `reapply` with tightened instructions.
   - Capture lint/test output snippets in responses to explain fixes or remaining debt.

## Data sources and references
- **Firestore schema**: `types/b2b-orders.ts`, `lib/b2b-order-store.ts`, `lib/b2b-order-utils.ts`
- **Payments & credit flows**: `app/api/payments/*`, `lib/credit-engine.ts`, `docs/payment-webhook-flows.md`
- **Operations dashboards**: `app/modules/logistics/page.tsx`, `components/modules/*.tsx`
- **Documentation hub**: `docs/` directory (deployment, go-live, optimization reports)

## Safety guardrails
- Never hardcode secrets; load from environment files.
- Avoid destructive commands (no `rm -rf`, no dropping Firebase collections).
- Confirm impacted files and lint/tests are green before claiming success.

## Response hygiene
- Maintain conversational, confident tone as described in the system prompt.
- Present plan → action → validation structure in summaries.
- Link deliverables back to TODO items or docs so stakeholders can trace progress.
