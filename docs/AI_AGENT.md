# VendAI Agent Playbook

_Last updated: 4 Oct 2025_

## 1. Prompt Architecture
- **System prompt** (managed by Cursor) positions the assistant as the "world's best IDE" and enforces conversational, honest responses.
- **`.cursorrules` `<project_rules>`** now routes every task through project-specific directives:
  1. Fetch relevant rules from `.cursor/rules` before edits.
  2. Identify the user persona (operations, finance, engineering).
  3. Review the VendAI toolbelt reference before running commands.
  4. Prefer self-service lookup (search/read) over clarifying questions when the codebase answers exist.
- **Role rule files** (`.cursor/rules/*.md`) act like an encyclopedia. Each includes:
  - Front-matter metadata (name, description, labels) to maximize `fetch_rules` precision.
  - Persona-specific objectives, workflows, guardrails, and validation checklists.

## 2. Role Prompt Templates
Use these snippets when crafting high-signal follow-up instructions or when seeding new chat threads with Cursor.

### Operations / Logistics
```
@rules operations-agent vendai-agent-toolbelt
Task: <operational goal>
Context: [link to modules/logistics, ledger entries, delivery IDs]
Expectations: Summaries of delivery status, driver assignments, proof-of-delivery artifacts.
Validation: Targeted lint on touched components, refreshed Firestore queries.
```

### Finance / Treasury
```
@rules finance-agent vendai-agent-toolbelt
Task: <finance goal>
Context: Payment IDs, invoice IDs, ledger entry references.
Expectations: Reconciliation table (gross, net, fees, release timestamps) with next steps.
Validation: Lint/tests for impacted API routes, ledger entry verification.
```

### Engineering / Product
```
@rules engineering-agent vendai-agent-toolbelt
Task: <feature or bug>
Context: Relevant files (`app/...`, `lib/...`, `docs/TODO.md` entries).
Expectations: Plan → implementation summary → validation results → follow-ups.
Validation: Targeted lint/tests, documentation updates.
```

## 3. VendAI Toolbelt Inventory
| Capability | Purpose | Primary Command(s) |
|------------|---------|--------------------|
| Codebase discovery | Find concepts, symbols, or files | `codebase_search`, `file_search`, `grep_search` |
| Context acquisition | Read source files or docs | `read_file`, `list_dir` |
| Code editing | Apply scoped diffs | `edit_file`, `reapply` |
| Terminal execution | Run lint/tests/scripts | `run_terminal_cmd` |
| Rule lookup | Load persona guidance | `fetch_rules` |

_Usage tips derived from Roman Imankulov's “Cursor Under the Hood” (Feb 2025) and Shrivu Shankar's “How Cursor (AI IDE) Works” (Mar 2025)._ Key takeaways:
- Treat rules as retrieval documents; keep names/descriptions short and descriptive.
- Break large edits into bite-sized diffs to help the apply model succeed.
- Capture lint/test output in responses for self-correction.

## 4. Safety & Compliance Guardrails
- Never commit or display secrets. Point to `.env.*` templates instead.
- Do not modify production data; propose scripts or admin workflows.
- Limit destructive terminal commands; prefer read-only or build/test instructions.
- When instructions conflict, defer to `<project_rules>` ordering: toolbelt → persona rule → task-specific docs.

## 5. Maintenance Checklist
- Update role rules when new modules or processes ship.
- Review rule descriptions quarterly to ensure `fetch_rules` relevancy.
- Keep this playbook synchronized with `docs/TODO.md` AI assistant tasks.
- Log notable agent improvements or pain points in `docs/PRODUCTION-READINESS-REPORT.md`.
