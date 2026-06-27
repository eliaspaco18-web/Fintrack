# PORTFOLIO_BUG_REPORT.md

## Summary

The portfolio loading bug is likely caused by multiple smaller issues rather than one confirmed TypeScript/build failure. The most important risks are silent server preload failure, mismatch between direct server queries and API fallback behavior, a broken quick-create query parameter, and an inconsistent account update response contract.

## Implementation Update - First Safe Stability Batch

Status: implemented for the approved safe scope only.

- Fixed `components/layout/Topbar.tsx` so "Nuevo portafolio" opens `/portfolio?new=portfolio`.
- Updated `app/(dashboard)/portfolio/page.tsx` to pass a non-sensitive preload failure message into the portfolio manager when accounts, banks, or currencies fail during server preload.
- Updated `components/management/PortfolioManager.tsx` so portfolio account and bank refetches use a client timeout, retry together, and do not show the empty portfolio state when the real state is a blocking load error.
- Updated authenticated E2E tests that expected `portfolio-form` to be visible on plain `/portfolio`; they now open the create modal through `/portfolio?new=portfolio`.

Not changed in this batch:

- Database schema, Supabase RLS policies, authentication, middleware, API contracts, dashboard performance work, and redesign.
- The server preload fallback mismatch with `/api/accounts`; that remains documented because a shared data-path change has higher blast radius.
- The account PATCH response shape; that remains an API contract decision.

## Complete Flow Reviewed

- Route: `app/(dashboard)/portfolio/page.tsx`
- Client component: `components/management/PortfolioManager.tsx`
- APIs: `app/api/accounts/route.ts`, `app/api/accounts/[id]/route.ts`, `app/api/bank-entities/route.ts`
- Repository: `modules/portfolio/portfolio.repository.ts`
- Types: `types/database.types.ts`, local portfolio item types
- Permissions: Supabase RLS migrations for `accounts`, `bank_entities`, and `user_currencies`
- UI states: loading skeleton, error banner, empty state, create/edit/deactivate/delete flows

## Findings

### High

#### HIGH-PORT-01: Server preload hides Supabase errors and timeouts

- Affected file or area: `app/(dashboard)/portfolio/page.tsx:57`
- Probable cause: `Promise.allSettled` with `withTimeout` converts failed preload queries into empty arrays and only passes `preloaded=false`.
- Impact: Real data-access failures can look like an empty or slow portfolio. Users do not know whether data is empty, loading, or blocked by Supabase/RLS.
- Recommended solution: Pass structured preload error information to `PortfolioManager` and display a visible retry/error banner.
- Current status: Fixed for visible non-sensitive preload reporting in the first safe stability batch.
- Risk: Low for visible UI state; medium if changing API contracts.
- Requires approval: No for UI-only error state; yes for API/schema/RLS changes.
- How to test: Force the accounts preload query to fail and verify the UI shows an explicit error.

#### HIGH-PORT-02: Server preload lacks the API fallback for missing bank-entity feature

- Affected file or area: `app/(dashboard)/portfolio/page.tsx:60`, `app/api/accounts/route.ts:99`
- Probable cause: `/api/accounts` falls back when `bank_entities` is missing, but the server page query directly joins `bank_entities` and does not fallback.
- Impact: A partially migrated production database can break initial portfolio preload even though the API would recover.
- Recommended solution: Reuse API-level fallback logic or move portfolio preload behind a shared server helper.
- Risk: Medium.
- Requires approval: Yes if this changes API/server contracts or confirms production schema state.
- How to test: Run against a database without `bank_entities` relation and verify portfolio still loads legacy account data with a visible warning.

#### HIGH-PORT-03: Topbar quick-create link does not open the portfolio create modal

- Affected file or area: `components/layout/Topbar.tsx:271`, `components/management/PortfolioManager.tsx:549`
- Probable cause: Query mismatch: `new=account` versus expected `new=portfolio`.
- Impact: Visible action fails silently from the user's perspective.
- Recommended solution: Change the link to `/portfolio?new=portfolio` or support both values intentionally.
- Current status: Fixed in the first safe stability batch by changing the topbar link to `/portfolio?new=portfolio`.
- Risk: Low.
- Requires approval: No unless product wants a different URL contract.
- How to test: Click topbar "Nuevo portafolio" and confirm the modal opens.

#### HIGH-PORT-04: Authenticated portfolio smoke test likely no longer matches current UX

- Affected file or area: `tests/e2e/authenticated-smoke.spec.ts:24`
- Probable cause: Test expects `portfolio-form` to be visible on `/portfolio`; current form is inside a closed modal.
- Impact: Authenticated test suite can fail after credentials are supplied, or test expectations may pressure the app toward unintended behavior.
- Recommended solution: Decide the correct UX: direct page form, modal opened by query, or modal opened by create button. Then update tests or UX accordingly.
- Current status: Fixed for the approved current UX by opening the modal through `/portfolio?new=portfolio`.
- Risk: Low for test update; medium for UX change.
- Requires approval: Yes, unclear UX behavior.
- How to test: Run authenticated E2E after decision.

### Medium

#### MEDIUM-PORT-01: Account PATCH response does not include joined `bank_entity`

- Affected file or area: `app/api/accounts/[id]/route.ts:257`
- Probable cause: Update selects `ACCOUNT_SELECT_WITH_BANK_ID`, then response reads `data.bank_entity`.
- Impact: API consumers may receive `bank_entity: null` after update even when the account has a bank.
- Recommended solution: Either select `ACCOUNT_SELECT_WITH_BANK` or standardize the response as ID-only.
- Risk: Low to medium.
- Requires approval: Yes if changing API response contract.
- How to test: PATCH an account with a bank and inspect JSON response.

#### MEDIUM-PORT-02: Currencies preload failure falls back to hard-coded PEN/USD

- Affected file or area: `app/(dashboard)/portfolio/page.tsx:73`, `components/management/PortfolioManager.tsx` currency options.
- Probable cause: Missing/failed `user_currencies` load produces empty `initialCurrencies`, and the client falls back to PEN/USD.
- Impact: Multi-currency users may not see their configured currencies if `user_currencies` is blocked by RLS or unavailable.
- Recommended solution: Decide whether currency preload failures should block saving, show a warning, or fallback silently.
- Risk: Medium for multi-currency data integrity.
- Requires approval: Yes, product/data behavior decision.
- How to test: Create a non-PEN/USD active currency and verify it appears in portfolio create/edit.

#### MEDIUM-PORT-03: Portfolio page bypasses `PortfolioRepository`

- Affected file or area: `modules/portfolio/portfolio.repository.ts`, `app/(dashboard)/portfolio/page.tsx`, `app/api/accounts/route.ts`
- Probable cause: Portfolio list logic is duplicated across server page, API route, and repository.
- Impact: Fallbacks, filters, and selected fields can drift.
- Recommended solution: Centralize portfolio read logic in a shared server helper/repository used by page and API.
- Risk: Medium because it touches data paths.
- Requires approval: No if behavior remains compatible; yes if API changes.
- How to test: Compare `/portfolio` initial data and `/api/accounts?include_inactive=true` output for the same user.

## Recommended Fix Order

1. Fix the quick-create query mismatch.
2. Add explicit portfolio preload error reporting.
3. Align server preload fallback with `/api/accounts`.
4. Decide and fix the authenticated E2E portfolio UX contract.
5. Standardize account PATCH response shape.
6. Verify live Supabase RLS and indexes for `accounts`, `bank_entities`, and `user_currencies`.
