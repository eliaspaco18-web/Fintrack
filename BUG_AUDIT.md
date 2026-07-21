# BUG_AUDIT.md

## Audit Scope

This audit reviewed the production-readiness risks in the FinTrack Next.js app without modifying functional code. The review covered project structure, scripts, dependencies, routes, layouts, navigation, Supabase setup, authentication/session handling, data fetching, portfolio loading, loading/error/empty/success states, interactions, forms, performance, responsive/accessibility basics, Vercel build readiness, and security concerns for a financial SaaS.

## Verification Run

- TypeScript: `./node_modules/.bin/tsc --noEmit --incremental false` passed.
- Lint: `npm run lint` passed.
- Production build: `npm run build` passed.
- E2E: `npm run test:e2e -- tests/e2e/auth-redirect.spec.ts` passed 4 unauthenticated protected-route tests.
- Authenticated E2E flows were not run because they require production-like test credentials and may create user data.

## Findings

### Critical

No confirmed critical runtime bug was found during static review and local build checks. Live Supabase RLS/query-plan validation is still required before declaring the app production-ready.

### High

#### HIGH-01: Portfolio server preload can silently degrade into empty data

- Affected file or area: `app/(dashboard)/portfolio/page.tsx:55`
- Probable cause: The portfolio page performs direct Supabase joined queries for `accounts`, `bank_entities`, and `user_currencies`, then converts any timeout or Supabase error into empty arrays. The page only passes `preloaded=false` to the client instead of an explicit preload error.
- Impact: A real RLS, missing migration, timeout, or Supabase failure can look like an empty portfolio or delayed load. This matches the reported portfolio loading bug pattern.
- Recommended solution: Preserve preload error details and show an explicit error/retry state. Reuse the same fallback behavior already present in `/api/accounts` for bank-entity compatibility.
- Risk: Low for a UI-only error-state fix; medium if changing the server preload/API contract.
- Requires approval: Yes if the fix changes API response shape, database schema, or RLS. No for a UI-only visible error state.
- How to test: Force one query to fail locally, load `/portfolio`, and verify an error banner appears instead of an empty state.

#### HIGH-02: Topbar "Nuevo portafolio" action points to the wrong query value

- Affected file or area: `components/layout/Topbar.tsx:271`, `components/management/PortfolioManager.tsx:549`
- Probable cause: Topbar links to `/portfolio?new=account`, but `PortfolioManager` only opens the create modal when `new=portfolio`.
- Impact: A visible action appears functional but does not open the expected modal.
- Recommended solution: Align the link and handler. The smallest fix is changing the link to `/portfolio?new=portfolio`.
- Risk: Low.
- Requires approval: No, unless the intended UX is to rename the query contract globally.
- How to test: From the topbar quick menu, click "Nuevo portafolio" and verify the portfolio creation modal opens.

#### HIGH-03: Middleware validates Supabase auth before skipping API/static pass-throughs

- Affected file or area: `middleware.ts:25`
- Probable cause: `supabase.auth.getUser()` runs before `isApiRoute`, `isStaticAsset`, and `isAuthCallbackRoute` early returns.
- Impact: Adds auth/session overhead to API requests and other pass-through routes. This can amplify slow module loading because client modules often fire multiple API requests after hydration.
- Recommended solution: Move route classification and safe early returns before `getUser()` where possible, while preserving maintenance-mode behavior and auth callback handling.
- Risk: Medium because this touches authentication/session middleware.
- Requires approval: Yes, auth/session behavior change.
- How to test: Compare request timings for API calls before/after, verify unauthenticated redirects still pass, and run authenticated smoke tests.

#### HIGH-04: Dashboard cold load uses a large client chunk and multiple API calls

- Affected file or area: `components/dashboard/DashboardWorkspace.tsx:57`, `app/(dashboard)/dashboard/page.tsx`, build output for `/dashboard`
- Probable cause: `/dashboard` first-load JS is 253 kB and the client fetches summary, money-flow, modules, and sidebar in parallel after hydration. Several endpoints call `DashboardService.getSummary()`, duplicating expensive server work.
- Impact: Cold dashboard load may feel slow; returning to the module is faster due to loaded JS chunks and SWR/browser cache.
- Recommended solution: Consolidate dashboard seed data server-side or introduce a single dashboard bootstrap endpoint/cache strategy. Avoid duplicate `getSummary()` calls across dashboard endpoints.
- Risk: Medium; data-fetching refactor can affect dashboard KPIs.
- Requires approval: No for internal endpoint consolidation if API contracts remain compatible; yes if changing API contracts.
- How to test: Measure cold `/dashboard` load and API waterfall in Playwright/Chrome DevTools before/after.

#### HIGH-05: Authenticated smoke tests appear stale against the current portfolio UI

- Affected file or area: `tests/e2e/authenticated-smoke.spec.ts:24`
- Probable cause: The test expects `portfolio-form` to be visible immediately on `/portfolio`, but current `PortfolioManager` renders the form inside a modal that is closed by default.
- Impact: Authenticated smoke tests may fail once credentials are supplied, reducing deployment confidence.
- Recommended solution: Decide whether `/portfolio` should auto-open the form or update tests to click the create button / navigate to `?new=portfolio`.
- Risk: Low for test-only update; medium if changing UX behavior.
- Requires approval: Yes, because this is an unclear UX contract.
- How to test: Run authenticated Playwright tests with `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`.

#### HIGH-06: Account update API response omits the joined bank entity it appears to return

- Affected file or area: `app/api/accounts/[id]/route.ts:257`
- Probable cause: `PATCH` selects `ACCOUNT_SELECT_WITH_BANK_ID`, but response construction reads `data.bank_entity`, which was not selected.
- Impact: After update, consumers may receive `bank_entity: null` even when the account has a bank. Current UI reloads the list afterward, hiding the issue in the main portfolio flow, but the API contract is inconsistent.
- Recommended solution: Either select `ACCOUNT_SELECT_WITH_BANK` on update or document/standardize that updates return only IDs.
- Risk: Low to medium depending on API consumers.
- Requires approval: Yes if treated as an API contract change.
- How to test: PATCH an account with `bank_entity_id` and verify the response includes the joined bank entity or intentionally excludes it according to the chosen contract.

### Medium

#### MEDIUM-01: Dashboard server fetch result is partially wasted

- Affected file or area: `components/dashboard/DashboardClient.tsx:9`
- Probable cause: `DashboardPage` fetches `resolveLiveUsdPenExchangeRate()`, but `DashboardClient` ignores `initialExchangeRate`.
- Impact: Extra server work on dashboard load with no visible benefit.
- Recommended solution: Either remove the unused fetch or wire the initial rate into the dashboard/currency context.
- Risk: Low.
- Requires approval: No if behavior stays equivalent.
- How to test: Confirm dashboard exchange-rate display and currency toggles remain correct.

#### MEDIUM-02: Server-rendered pages hide preload failures as empty/default data

- Affected file or area: `app/(dashboard)/transactions/page.tsx`, `app/(dashboard)/settings/page.tsx`, `app/(dashboard)/portfolio/page.tsx`
- Probable cause: `Promise.allSettled` plus fallback objects/arrays prevents hard crashes but also hides Supabase failures.
- Impact: Users may see empty forms, missing options, or default profile/account data instead of actionable errors.
- Recommended solution: Keep defensive fallbacks for non-critical optional data, but surface explicit warning/error states for required data.
- Risk: Low to medium.
- Requires approval: No for UI state changes; yes if changing API/data contracts.
- How to test: Simulate failed options/profile/account queries and verify visible retry/error UI.

#### MEDIUM-03: Production scripts include direct database and production release commands

- Affected file or area: `package.json:21`
- Probable cause: Scripts expose `release:production`, `db:push`, and `db:reset`.
- Impact: In a production financial SaaS, accidental use could affect production if environment variables point to production.
- Recommended solution: Add explicit guardrails or documentation requiring branch, preview, backup, and approval before use.
- Risk: Medium because script behavior may be relied upon.
- Requires approval: Yes for release/database process policy.
- How to test: Dry-run release flow in a non-production environment.

#### MEDIUM-04: Package includes likely unused dependency

- Affected file or area: `package.json:28`
- Probable cause: `@hookform/resolvers` is installed but no import was found in app code.
- Impact: Slight dependency surface and install/build size overhead.
- Recommended solution: Remove only after confirming no planned form resolver migration depends on it.
- Risk: Low.
- Requires approval: No for dependency cleanup, but do it in a separate maintenance task.
- How to test: Remove in a branch, run install, typecheck, lint, build, and form E2E.

#### MEDIUM-05: Topbar dropdowns have incomplete dismissal/focus behavior

- Affected file or area: `components/layout/Topbar.tsx`
- Probable cause: Quick/profile menus close on route change but do not include the same outside-click/Escape handling as `QuickActionsFAB`.
- Impact: Menus may remain open unexpectedly and keyboard behavior is weaker than expected for production UI.
- Recommended solution: Add outside-click, Escape, and focus-management behavior.
- Risk: Low.
- Requires approval: No.
- How to test: Open each menu, click outside, press Escape, tab through items, and verify it closes predictably.

#### MEDIUM-06: Authenticated E2E coverage is present but not routinely validated in this audit

- Affected file or area: `tests/e2e/authenticated-*.spec.ts`
- Probable cause: Tests require credentials and create data.
- Impact: Build can pass while authenticated module flows are broken.
- Recommended solution: Create a dedicated Supabase test user/project or seeded preview database and run authenticated smoke in CI/preview.
- Risk: Medium; requires environment/data setup.
- Requires approval: Yes if it affects Supabase project/test data strategy.
- How to test: Run the authenticated smoke suite against a preview Supabase project.

### Low

#### LOW-01: Root instruction files and docs instruction files diverge

- Affected file or area: `AGENTS.md`, `CODEX_RULES.md`, `docs/AGENTS.md`, `docs/CODEX_RULES.md`
- Probable cause: Root files were created, while docs copies remain empty and root `AGENTS.md` references `docs/CODEX_RULES.md`.
- Impact: Future agents may read an empty rulebook if they follow the old path literally.
- Recommended solution: Align root `AGENTS.md` with root `CODEX_RULES.md` or intentionally populate the docs copies.
- Risk: Low.
- Requires approval: No, but it is a documentation governance cleanup.
- How to test: Open all instruction files and confirm only one authoritative path exists.

#### LOW-02: Repository comments and technical docs contain Spanish despite the new English-docs rule

- Affected file or area: many source comments and docs.
- Probable cause: Existing project history predates the English-documentation rule.
- Impact: Lower consistency for future maintainers.
- Recommended solution: Do not mass-edit now. Translate only when touching nearby files for real fixes.
- Risk: Low.
- Requires approval: No.
- How to test: Spot-check changed files in future PRs.

#### LOW-03: Build/dev server reports a webpack cache warning

- Affected file or area: local Playwright web server output.
- Probable cause: Webpack cache serializes a large string around 140 kB.
- Impact: Developer cold-start/cache deserialization can be slower.
- Recommended solution: Investigate large inline strings/assets if dev startup becomes painful.
- Risk: Low.
- Requires approval: No.
- How to test: Compare local dev startup before/after any asset/string cleanup.

## Production Readiness Summary

FinTrack builds and passes static checks, but it is not ready for a "stable before redesign" sign-off until the high-priority portfolio, middleware latency, dashboard waterfall, stale E2E, and live Supabase verification items are resolved or explicitly accepted.
