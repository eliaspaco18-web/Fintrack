# MISSING_DECISIONS.md

## Decisions Required Before Implementation

### DECISION-01: Portfolio create UX and E2E contract

- Severity: High
- Affected file or area: `/portfolio`, `components/management/PortfolioManager.tsx`, `tests/e2e/authenticated-smoke.spec.ts`
- Decision needed: Should `/portfolio` show only the list by default, or should it expose/open the create form immediately?
- Why approval is required: Current tests expect the form to be visible, while current UI keeps it in a closed modal.
- Recommended decision: Keep list view by default and update tests to open the create modal through `?new=portfolio` or the create button.

### DECISION-02: Account PATCH response contract

- Severity: High
- Affected file or area: `app/api/accounts/[id]/route.ts`
- Decision needed: Should account PATCH responses include joined `bank_entity` or return only scalar account fields plus `bank_entity_id`?
- Why approval is required: This is an API contract decision.
- Recommended decision: Return the joined `bank_entity` for parity with GET/list responses.

### DECISION-03: Middleware auth/session optimization

- Severity: High
- Affected file or area: `middleware.ts`
- Decision needed: May we reorder middleware so API/static/auth-callback pass-through routes avoid Supabase `getUser()` when auth is not needed?
- Why approval is required: This changes authentication/session middleware behavior.
- Recommended decision: Approve a narrow middleware performance fix with auth redirect regression tests.

### DECISION-04: Portfolio preload behavior on partial Supabase failure

- Severity: High
- Affected file or area: `app/(dashboard)/portfolio/page.tsx`, `components/management/PortfolioManager.tsx`
- Decision needed: Should partial preload failures block the page, show a warning with retry, or silently fallback?
- Why approval is required: This affects UX behavior and may expose backend/RLS errors to users.
- Recommended decision: Show a clear non-technical error banner with retry; keep empty state only for confirmed empty data.

### DECISION-05: Currency fallback behavior

- Severity: Medium
- Affected file or area: portfolio currency selector and `user_currencies`
- Decision needed: If `user_currencies` fails to load, should the app allow only PEN/USD, block account creation, or show a warning?
- Why approval is required: This affects financial data correctness for multi-currency users.
- Recommended decision: Allow PEN/USD fallback with a visible warning and retry; do not silently hide custom currencies.

### DECISION-06: Live Supabase RLS/index verification

- Severity: High
- Affected file or area: Supabase production or preview project
- Decision needed: Can we run read-only RLS checks and EXPLAIN/query-plan checks against a production clone or approved production window?
- Why approval is required: This touches live data-access verification and may require production credentials.
- Recommended decision: Use a Supabase preview/clone first; production read-only only after backup and explicit approval.

### DECISION-07: Database index or RLS changes if live verification finds gaps

- Severity: High
- Affected file or area: Supabase migrations and policies
- Decision needed: Approve or reject any new migration for missing indexes, schema hardening, or RLS policy corrections after verification.
- Why approval is required: Database schema/RLS changes are explicitly approval-gated.
- Recommended decision: Review each proposed migration separately with rollback plan.

### DECISION-08: Release/database script guardrails

- Severity: Medium
- Affected file or area: `package.json`, release scripts, Supabase CLI workflow
- Decision needed: Should `release:production`, `db:push`, and `db:reset` include explicit environment/branch/confirmation guards?
- Why approval is required: This is a production process decision.
- Recommended decision: Add guardrails before future production releases.

### DECISION-09: Instruction file source of truth

- Severity: Low
- Affected file or area: `AGENTS.md`, `CODEX_RULES.md`, `docs/AGENTS.md`, `docs/CODEX_RULES.md`
- Decision needed: Should the root files be the only source of truth, or should the docs copies be populated and referenced?
- Why approval is required: Documentation governance affects future agent behavior.
- Recommended decision: Make root `AGENTS.md` and root `CODEX_RULES.md` authoritative, then remove or populate empty docs copies in a separate docs-only task.
