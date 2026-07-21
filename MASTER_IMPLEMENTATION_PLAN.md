# MASTER_IMPLEMENTATION_PLAN.md

## Purpose

This plan defines the exact implementation order for Phase 1 stabilization. It does not authorize functional changes by itself. It does not include redesign, broad refactors, database schema changes, Supabase RLS changes, auth changes, middleware changes, or API contract changes unless explicitly approved.

Source of truth: `MASTER_STABILITY_AUDIT.md`.

## Implementation Order

### First: Phase A Critical Stability Blockers

#### A1. Fix portfolio first direct visit loading

- Source issue: `A-01`
- Implement first because it is the clearest user-facing blocker and has a narrow safe option.
- Recommended scope:
  - Stop `/portfolio` from blocking first render on server account/bank/currency preload, or add an equivalent non-blocking escape hatch.
  - Render `PortfolioManager` quickly.
  - Use shared `fetchWithTimeout` for portfolio client account and bank loads.
  - Keep visible loading, error, empty, and success states unchanged in design.
  - Keep API response contracts unchanged.
- Files likely affected:
  - `app/(dashboard)/portfolio/page.tsx`
  - `components/management/PortfolioManager.tsx`
  - possibly an existing currency/client option path if currencies need client loading
- Do not include:
  - middleware changes
  - auth/session changes
  - Supabase schema or RLS changes
  - API contract changes
  - redesign
- Vercel acceptance:
  - Fresh signed-in direct `/portfolio` visit reaches data, empty state, or controlled error/retry.
  - It does not remain on skeleton indefinitely.
  - Visiting another module first is no longer required.

#### A2. Add explicit server preload warnings for transactions

- Source issue: `A-04`
- Implement after portfolio.
- Recommended scope:
  - Preserve current fallback options, but pass a warning/error reason into `TransactionsWorkspace`.
  - Show a non-technical warning when required options fail to preload.
  - Disable or clearly constrain transaction creation when required account/category options are missing because of load failure.
- Files likely affected:
  - `app/(dashboard)/transactions/page.tsx`
  - `components/transactions/TransactionsWorkspace.tsx`
  - `components/forms/TransactionForm/index.tsx` only if needed for visible warnings/disabled state
- Approval required:
  - No for UI warnings.
  - Yes if API contracts or form option contracts change.

#### A3. Add explicit server preload warnings for settings

- Source issue: `A-05`
- Recommended scope:
  - Keep page rendering resilient.
  - Surface profile/account preload failure as a warning rather than silently rendering defaults.
- Files likely affected:
  - `app/(dashboard)/settings/page.tsx`
  - maybe `components/settings/*` if panel-level warning display is needed
- Approval required:
  - No for UI warnings.
  - Yes if profile/API contract changes.

#### A4. Bound non-blocking shell badge fetch

- Source issue: `B-03`
- Recommended scope:
  - Use shared client timeout for `/api/dashboard/nav-badges`.
  - Keep existing fallback badges and avoid blocking navigation.
- Files likely affected:
  - `components/layout/AppShell.tsx`
- Approval required: no.

### Second: Phase B Slow Loading And Performance

#### B1. Measure dashboard cold-load waterfall

- Source issues: `B-01`, `B-02`
- This is a diagnostic step before dashboard code changes.
- Capture:
  - `/dashboard` document timing
  - `/api/dashboard/summary`
  - `/api/dashboard/money-flow`
  - `/api/dashboard/modules-summary`
  - `/api/dashboard/sidebar`
  - widget SWR endpoints
  - Vercel function durations
- Output:
  - A short measurement note in the relevant PR or QA report.
- Approval required: no for measurement.

#### B2. Reduce dashboard duplicate bootstrap/widget work

- Source issue: `B-01`
- Implement after measurement.
- Recommended scope:
  - Expand SWR fallback from the initial dashboard seed where possible.
  - Avoid duplicate summary/sidebar/module queries in one cold render.
  - Keep endpoint contracts stable.
- Files likely affected:
  - `components/dashboard/DashboardWorkspace.tsx`
  - dashboard widgets
  - `app/api/dashboard/*`
- Approval required:
  - No for internal fallback/cache reuse.
  - Yes if endpoint response shapes change.

#### B3. Resolve dashboard exchange-rate duplication

- Source issue: `B-02`
- Recommended scope:
  - Confirm whether `initialExchangeRate` is used by `DashboardClient`.
  - Remove unused server fetch or wire it intentionally without changing user behavior.
- Files likely affected:
  - `app/(dashboard)/dashboard/page.tsx`
  - `components/dashboard/DashboardClient.tsx`
  - `lib/hooks/useDashboard.tsx`
- Approval required: no if behavior stays equivalent.

#### B4. Decide middleware/auth optimization

- Source issue: `A-03`
- Do not implement until approved.
- Recommended scope after approval:
  - Move safe API/static/auth-callback pass-through classification before Supabase `getUser()` where safe.
  - Preserve maintenance-mode behavior and auth callback behavior.
- Files likely affected:
  - `middleware.ts`
- Approval required: yes.

### Third: Phase C Buttons, Actions, Modals, And Options

#### C1. Surface non-blocking option-load failures across modules

- Source issues: `B-04` through `B-09`, `C-01`
- Recommended module order:
  1. Credits bank/account/billing-cycle options
  2. Assets account/asset-type options
  3. Receivables detail/account options
  4. Payables detail/account options
  5. Recurring account/category options
  6. Administration catalog list/mutation timeout consistency
- Approval required:
  - No for UI warnings/timeouts.
  - Yes for API/schema/RLS changes.

#### C2. Stabilize export, upload, and long action feedback

- Source issues: `C-02`, `C-03`, `B-10`
- Recommended scope:
  - Add bounded feedback for transaction export metadata and file generation.
  - Add clear warning policy for non-blocking attachment failures.
  - Improve alerts generate/bulk action partial failure messages.
- Approval required:
  - No for client feedback.
  - Yes for product behavior changes around attachment failure policy.

#### C3. Fix topbar menu dismissal and CTA audit

- Source issues: `C-04`, `C-05`
- Recommended scope:
  - Add outside-click/Escape handling to topbar quick/profile menus.
  - Validate every visible topbar/FAB/sidebar/module CTA.
  - Document any pending action as a decision or disable it clearly.
- Approval required: no unless changing intended UX.

### Fourth: Phase D QA And Release Readiness

#### D1. Run manual Vercel QA module by module

- Use `MASTER_QA_PLAN.md`.
- Required for every fix PR before production.

#### D2. Configure and run authenticated E2E

- Source issue: `D-05`
- Requires owner-approved preview/test user and data strategy.
- Commands after setup:
  - `npm run test:e2e -- tests/e2e/login-ui.spec.ts tests/e2e/auth-redirect.spec.ts`
  - `npm run test:e2e:registrations`
- Approval required: yes if creating/changing Supabase test data strategy.

#### D3. Standardize API error handling module by module

- Source issue: `D-01`
- Recommended approach:
  - Do not change all APIs at once.
  - Standardize one module per PR after its UI state is stable.
  - Keep `{ ok: true, data }` and `{ ok: false, error }` shape unless owner approves contract changes.
- Approval required:
  - No for preserving shape and improving message mapping.
  - Yes for status/payload contract changes.

#### D4. Verify Supabase and Vercel parity

- Source issues: `D-02`, `D-03`, `D-04`
- Requires owner approval before production or credentialed checks.
- Read-only checks first.

### Fifth: Phase E Redesign Preparation

Do not begin redesign until:

- `A-01` is fixed and verified in Vercel Preview.
- Phase A warnings are implemented or explicitly accepted.
- Dashboard cold-load behavior is measured and accepted or improved.
- Every module has manual QA notes for loading, error, empty, and success states.
- Authenticated E2E is configured or owner explicitly accepts the risk.
- Remaining approval-gated decisions are either approved, rejected, or deferred in writing.

## Stop Conditions

Stop and ask for approval before implementation if a proposed fix requires any of these:

- Database schema changes.
- Supabase RLS policy changes.
- Auth/session logic changes.
- Middleware behavior changes.
- API response contract changes.
- Production Vercel environment changes.
- Production Supabase verification using live credentials.
- Redesign or visual-language changes.

## Rollback Notes

Each implementation PR should be narrow and reversible:

- Portfolio loading fix: revert `app/(dashboard)/portfolio/page.tsx` and `components/management/PortfolioManager.tsx`.
- Transaction/settings preload warnings: revert the specific warning props/UI.
- Shell badge timeout: revert `AppShell` fetcher change.
- Dashboard performance: revert the dashboard bootstrap/fallback change.
- Option warnings: revert the module-specific form/list warning state.
- Topbar dismissal: revert `Topbar` event handling changes.

Do not batch unrelated phases into one PR.
