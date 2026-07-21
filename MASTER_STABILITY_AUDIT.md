# MASTER_STABILITY_AUDIT.md

## Status

This is the source of truth for Phase 1 stabilization. It consolidates the current app review and the existing focused audits:

- `BUG_AUDIT.md`
- `QA_CHECKLIST.md`
- `IMPLEMENTATION_PLAN.md`
- `MISSING_DECISIONS.md`
- `PERFORMANCE_AUDIT.md`
- `CLEAN_LOADING_AUDIT.md`
- `HOTFIX_PLAN.md`
- `STUCK_LOADING_ROOT_CAUSE.md`
- `STUCK_LOADING_HOTFIX_PLAN.md`
- `PORTFOLIO_BUG_REPORT.md`
- `CLIENT_FETCH_TIMEOUT_TEST_PLAN.md`
- `REGRESSION_REPORT.md`

Branch baseline:

- Diagnostic branch: `audit/full-stability-master-plan`
- Synced with `origin/main` before this document was created.
- Functional code changes in this audit: none.
- Database schema, Supabase RLS, auth, middleware, and API contracts changed: no.

## Executive Summary

FinTrack is not ready for redesign yet. The app has passed previous local static checks and production build checks, and the recent client fetch timeout hotfix improves many client-loaded modules. However, several production stability risks remain:

1. `/portfolio` can still get stuck on a first direct cold visit because its server/layout render path can block before the client timeout code mounts.
2. Dashboard cold load still has a heavy seed waterfall and duplicate widget/API work.
3. Server-preloaded pages can convert Supabase failures into empty/default data instead of clear user-facing warnings.
4. Forms, filters, details, uploads, exports, and some action flows still use raw fetches or silent catches.
5. Middleware and dashboard layout auth/session behavior are likely performance contributors but require approval before implementation.
6. Supabase production/preview parity, RLS behavior, query plans, and Vercel environment parity still need controlled verification.

Conclusion: We are ready to continue fixing Phase A items without more broad diagnosis, starting with the portfolio direct-load issue. Approval-gated areas still require explicit owner approval and targeted diagnosis before code changes.

## Priority Phases

### Phase A: Critical Stability Blockers

Goal: remove infinite or ambiguous loading states and unblock direct module access.

1. Fix `/portfolio` first direct visit stuck-loading behavior by making the portfolio manager mount without waiting on server Supabase preload, or by adding an equivalent non-blocking escape hatch.
2. Surface server preload failures clearly in transactions and settings instead of silently using empty/default data.
3. Add bounded loading/error behavior to app shell nav badges and other shell fetches that can add post-hydration noise.
4. Run Vercel Preview reproduction for direct `/portfolio`, `/dashboard`, `/transactions`, and `/settings` with network and function logs.

### Phase B: Slow Loading And Performance

Goal: make first loads predictable before redesign.

1. Measure and reduce dashboard duplicate summary/sidebar/module calls.
2. Decide and, if approved, optimize middleware API/static pass-through before Supabase `getUser()`.
3. Measure Vercel cold starts and Supabase query latency for portfolio, dashboard, transactions, receivables, payables, and credits.
4. Review route chunk sizes and module waterfalls after Phase A fixes.

### Phase C: Buttons, Actions, And Modals

Goal: every visible action works, is disabled, or is documented.

1. Add consistent timeout/error behavior to form option loads, export metadata, uploads, and mutation calls.
2. Surface non-blocking option-load failures for filters and forms.
3. Add outside-click, Escape, and focus behavior parity to topbar quick/profile menus.
4. Verify quick-create query contracts for all topbar/FAB/module actions.

### Phase D: QA And Release Readiness

Goal: make release confidence repeatable.

1. Run authenticated E2E against a dedicated preview/test user.
2. Add manual Vercel smoke coverage for every module.
3. Verify Vercel preview and production env parity.
4. Review API error envelope consistency and user-safe database error handling.
5. Confirm release workflow guardrails before any production deployment.

### Phase E: Redesign Preparation

Goal: prepare for Phase 2 only after stability is proven.

1. Freeze current functional contracts after Phase D sign-off.
2. Document module state contracts: loading, error, empty, success, disabled, pending approval.
3. Create redesign inventory of stable components, not visual polish of the current UI.
4. Start redesign only after Phase A-D blockers are fixed or explicitly accepted.

## Master Issue Register

| ID | Module | Severity | Symptom | Likely cause | Affected files | User impact | Blocks redesign | Recommended fix | Risk | Approval required | How to test in Vercel |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A-01 | Portfolio | critical | Direct cold visit to `/portfolio` can remain on generic skeleton/loading; visiting another module first and returning can make it load. | `/portfolio` is an async Server Component inside the dashboard layout Suspense boundary. It waits on server auth/layout work and portfolio Supabase preload before `PortfolioManager` mounts, so client fetch timeout is bypassed. | `app/(dashboard)/layout.tsx`, `app/(dashboard)/portfolio/page.tsx`, `components/management/PortfolioManager.tsx`, `lib/client/fetch-with-timeout.ts` | Users may be unable to access portfolio on first visit and may believe the app is broken. | Yes | Make `/portfolio` render `PortfolioManager` immediately with client-bounded loading, or add a strict non-blocking server preload escape hatch. Use shared `fetchWithTimeout` for portfolio client loads. | Low-medium | No if limited to UI/data-loading path and no API/auth/schema/RLS contract changes. | Deploy preview, sign in, hard-open `/portfolio` in a fresh tab with cache disabled. Confirm it reaches data, empty, or error/retry within timeout and does not require visiting another module first. |
| A-02 | Portfolio | high | Server preload can behave differently from `/api/accounts` fallback behavior. | Page directly joins `bank_entities`; API has bank-entity compatibility fallback. | `app/(dashboard)/portfolio/page.tsx`, `app/api/accounts/route.ts`, `lib/server/supabase-errors.ts` | Production schema/RLS mismatch can break initial render even if API retry could recover. | Yes | Prefer Phase A client-loaded portfolio first. Later align page/API data path through a shared server helper if needed. | Medium | Yes if API behavior, schema, RLS, or production schema assumptions change. | In preview, compare `/portfolio` direct render and `/api/accounts?include_inactive=true` for the same user. Block/fail bank entities and verify controlled warning/retry. |
| A-03 | App shell/auth routes | high | Authenticated routes can spend time in shell/layout before child modules render. | Middleware and dashboard layout call Supabase `getUser()` without explicit timeout; layout also loads profile and exchange rate before rendering shell. | `middleware.ts`, `app/(dashboard)/layout.tsx`, `lib/server/exchange-rate.ts` | All modules can feel slow or appear stuck during cold Vercel visits. | Yes | Measure first. Then consider bounded layout auth/session handling and approved middleware pass-through optimization. | Medium | Yes, because auth/session and middleware behavior are approval-gated. | Compare document request timing and middleware/function logs on hard refresh for `/dashboard`, `/portfolio`, `/transactions`, and `/settings`. Verify redirects still work. |
| A-04 | Transactions / Movements | high | Transaction form options can silently become empty/default after server preload failure. | Server page catches timeout/failure and passes fallback empty option arrays without visible warning. | `app/(dashboard)/transactions/page.tsx`, `lib/server/transaction-form-options.ts`, `components/transactions/TransactionsWorkspace.tsx`, `components/forms/TransactionForm/index.tsx` | Users may not see accounts, categories, debtors, creditors, assets, or currencies and may think no data exists. | Yes | Pass a non-sensitive preload warning into the workspace/form and disable dependent submission paths until required options load or retry. | Low-medium | No for UI warning/disabled state. Yes if changing API contracts. | Block or slow option queries, open `/transactions?new=transaction`, and confirm warnings appear instead of silent empty selects. |
| A-05 | Configuration | medium | Settings can render default profile/account values when Supabase preload fails. | Server page uses `Promise.allSettled` and falls back to `null` profile and empty accounts. | `app/(dashboard)/settings/page.tsx`, `components/settings/*` | User may see incomplete profile/account state without knowing data failed to load. | Yes | Surface profile/account preload warning and retry/refresh guidance; keep fallback only for non-critical display. | Low-medium | No for UI warning. Yes for profile/API contract changes. | In preview, block profile/accounts query or simulate timeout and verify settings shows an explicit warning. |
| B-01 | Dashboard | high | Cold dashboard load is heavy and widgets can refetch data already loaded by the dashboard seed. | Workspace fetches summary, money-flow, modules, and sidebar; widgets then use SWR keys and some endpoints duplicate summary work. | `app/(dashboard)/dashboard/page.tsx`, `components/dashboard/DashboardWorkspace.tsx`, `components/dashboard/*Widget.tsx`, `app/api/dashboard/*`, dashboard service files | Dashboard feels slow; users may think the app is unstable before using other modules. | Yes | Make one dashboard bootstrap path authoritative or expand SWR fallback coverage. Remove or wire the page-level exchange-rate fetch if still unused. | Medium | No if internal contracts stay compatible. Yes if API contracts change. | Hard refresh `/dashboard` in preview with cache disabled; count API requests and slowest function logs before/after. |
| B-02 | Dashboard | medium | Dashboard page still does server exchange-rate work before the client dashboard loads. | `DashboardPage` fetches `resolveLiveUsdPenExchangeRate()` and passes `initialExchangeRate`; previous audit noted it was ignored or duplicated by layout/currency provider. | `app/(dashboard)/dashboard/page.tsx`, `components/dashboard/DashboardClient.tsx`, `lib/hooks/useDashboard.tsx`, `app/(dashboard)/layout.tsx` | Adds server work to cold dashboard load. | No, but should be resolved before redesign metrics. | Confirm whether `initialExchangeRate` is used. Remove duplicated work or wire it intentionally. | Low | No if behavior remains equivalent. | Compare dashboard document timing and exchange-rate UI before/after in preview. |
| B-03 | App shell/sidebar | medium | Nav badge fetch is not timeout-bounded and silently fails through SWR. | `AppShell` uses raw fetch for `/api/dashboard/nav-badges`. | `components/layout/AppShell.tsx`, `app/api/dashboard/nav-badges/route.ts`, `lib/server/nav-badges.ts` | Sidebar badges may lag or add post-hydration load noise. | No | Use shared client timeout and non-blocking fallback; keep shell usable if badges fail. | Low | No | Block `/api/dashboard/nav-badges` in preview and confirm shell stays usable with no console/runtime crash. |
| B-04 | Credits | medium | Main list has timeout via shared hook, but bank filter/options and credit forms can fail silently or wait on raw fetches. | `CreditsListPanel` loads bank entities with raw fetch and `.catch(() => null)`; forms fetch bank/account/billing-cycle options with raw fetches. | `components/credits/CreditsListPanel.tsx`, `components/credits/CreditCardForm.tsx`, `components/credits/BankLoanForm.tsx`, `app/api/credits/*` | Filters or forms can look empty/incomplete even when credit data exists. | Yes | Add timeout and visible option-load warnings; do not change credit API shape. | Low-medium | No for UI warnings/timeouts. Yes for credit API shape changes. | Block `/api/bank-entities` and `/api/accounts` while opening `/credits` and new credit forms; verify specific warnings and disabled dependent submit. |
| B-05 | Budgets | medium | Category load errors can be treated like main budget load errors; period rows lazy-load separately. | Budgets, categories, and period rows are separate requests; category error currently shares module-level error state. | `components/management/BudgetsManager.tsx`, `app/api/budgets/*`, `app/api/budget-periods/*`, `app/api/categories/route.ts` | Users may not know whether budgets failed or only category options failed. | Yes | Separate blocking budget errors from non-blocking category warnings; keep period row retry. | Low | No | Block `/api/categories?include_system=true` while `/api/budgets?include_inactive=true` succeeds. Confirm budgets render with category warning. |
| B-06 | Assets | medium | Main list has timeout via shared hook, but asset type filters and create form option loads can fail silently or generically. | Asset type option fetches use raw fetch/catch behavior in list/form. | `components/assets/AssetsWorkspace.tsx`, `components/assets/AssetsListPanel.tsx`, `components/assets/AssetsForm.tsx`, `app/api/assets/*`, `app/api/asset-types/route.ts` | Users may not be able to filter/create assets correctly. | Yes | Add visible asset-type/account option warning and shared timeout use in forms. | Low | No | Block `/api/asset-types` and `/api/accounts`; verify list/form warning and no indefinite loading. |
| B-07 | Receivables | medium | Top-level debtor list is timeout-bounded, but debtor detail and receivable form use raw option/detail fetches. | Detail fetches receivables/ledger/accounts separately; form fetches accounts with raw fetch. | `components/receivables/ReceivablesManager.tsx`, `components/receivables/DebtorDetail.tsx`, `components/receivables/ReceivableForm.tsx`, `app/api/debtors/*`, `app/api/receivables/*` | Users may see missing debtor detail, ledger, or account options without clear cause. | Yes | Add timeout/error/retry to detail and account option loads; label partial failures. | Low-medium | No unless API/schema/RLS changes are required. | Hard refresh `/receivables`, open debtor detail, block `/api/accounts?is_active=true`, and confirm visible warning. |
| B-08 | Payables | medium | Mirrors receivables: creditor list is timeout-bounded, but detail/form account loads are raw. | Detail and form fetch account/ledger data separately. | `components/payables/PayablesWorkspace.tsx`, `components/payables/CreditorDetail.tsx`, `components/payables/PayableForm.tsx`, `app/api/creditors/*`, `app/api/payables/*` | Payment forms can be incomplete while module appears loaded. | Yes | Add timeout/error/retry to detail and form option loads. | Low-medium | No unless API/schema/RLS changes are required. | Hard refresh `/payables`, open creditor detail, block accounts, and verify warning/no indefinite modal state. |
| B-09 | Recurring | medium | Main recurring list is timeout-bounded, but form account/category option loads are raw and generic. | Recurring form fetches accounts/categories directly and reports one generic option error. | `components/recurring/RecurringWorkspace.tsx`, `components/recurring/RecurringForm.tsx`, `app/api/recurring/*`, `app/api/accounts/route.ts`, `app/api/categories/route.ts` | Users may be unable to create templates and not know which dependency failed. | Yes | Add timeout and per-option-group warning/retry. | Low | No | Block `/api/accounts` then `/api/categories` while opening create recurring modal; verify specific warnings. |
| B-10 | Alerts | medium | Alert list has timeout/retry, but generate, mark-all, delete-read, and partial failures need stronger feedback. | Bulk and generation flows can be long-running; partial failures are mostly toast-level. | `components/alerts/AlertsWorkspace.tsx`, `app/api/alerts/*`, `lib/alerts/alert-generator.ts` | Risk inbox can feel unreliable; users may not know whether bulk actions completed. | Yes | Add bounded action states, clearer partial success/failure messages, and measure alert generation. | Low-medium | No for UI feedback. Yes for alert-generation logic/policy changes. | In preview, generate alerts and bulk mark/delete with throttling; confirm no endless busy state and partial failure copy appears. |
| C-01 | Administration | medium | Catalog lists have loading/error/empty states, but many catalog fetches and mutations use raw fetch/action paths without shared timeout. | Bank/category managers use raw fetch; currency/asset-type use server actions. | `components/management/BankEntitiesManager.tsx`, `components/management/CategoriesManager.tsx`, `components/management/CurrenciesManager.tsx`, `components/management/AssetTypesManager.tsx`, `components/management/catalog.tsx` | Admin catalog screens can wait on browser/network defaults and may surface inconsistent errors. | Yes | Apply consistent timeout/error messages and retry conventions to catalog loads and mutations. | Low-medium | No unless API/server action contracts change. | Test `/admin?tab=banks`, `/admin?tab=currencies`, `/admin?tab=categories`, `/admin?tab=asset-types` with request blocking. |
| C-02 | Transactions export | medium | Export metadata and file download can run without client timeout or clear stuck-state recovery. | Export modal uses raw fetch for metadata and export download. | `components/transactions/TransactionsWorkspace.tsx`, `app/api/transactions/export/route.ts` | Export button can appear busy for too long or fail late. | No | Add bounded metadata/download timeout and persistent modal error/retry. | Low-medium | No for client timeout. Yes if export API changes. | Open export modal, block `/api/transactions/export?meta=true`, then export; verify error and retry/cancel behavior. |
| C-03 | Uploads/attachments | medium | Attachment uploads can fail silently or not block the main flow, depending on module. | Asset attachment catch intentionally does not block; credit/transaction upload paths vary. | `components/assets/AssetsForm.tsx`, `components/credits/CreditCardForm.tsx`, `components/forms/TransactionForm/index.tsx`, `app/api/*/attachment/route.ts` | Users may assume supporting files were saved when they were not. | No | Decide where attachment failure should be blocking vs warning; add visible post-save warning where non-blocking. | Low-medium | Yes for product behavior if attachment failure policy changes. | Upload invalid/large files and simulate attachment route failure in preview; verify clear result. |
| C-04 | Topbar menus | medium | Topbar quick/profile dropdowns close on route change but lack outside-click and Escape parity. | Topbar only closes menus on pathname change. | `components/layout/Topbar.tsx`, `components/layout/QuickActionsFAB.tsx` | Menus may remain open unexpectedly; keyboard dismissal is weaker. | No | Add outside-click, Escape, and focus handling consistent with `QuickActionsFAB`. | Low | No | Open quick/profile menus, click outside, press Escape, tab through, and navigate. |
| C-05 | Quick-create contracts | medium | Some query-driven create paths must be validated across topbar, FAB, sidebar, and module CTAs. | Multiple modules open modals from query strings; not all topbar/FAB links cover all modules. | `components/layout/Topbar.tsx`, `components/layout/QuickActionsFAB.tsx`, `components/*/*Workspace.tsx` | Visible actions may appear to work but not open the intended modal. | Yes | Audit each visible CTA; make working, disabled, hidden, or documented as pending. | Low | No unless UX contract changes. | Click every visible CTA in preview and record expected modal/page result. |
| D-01 | API error handling | high | API routes do not consistently use the canonical envelope/helper and can expose raw database messages. | `lib/api/response.ts` exists, but many route handlers hand-roll `NextResponse.json` and return `error.message`. | `app/api/**/*/route.ts`, `lib/api/response.ts`, `lib/api/error-message.ts` | Users may see inconsistent or overly technical errors; frontend error parsing is harder. | Yes | Standardize route error mapping module by module without changing response contract shape. | Medium | No if contract shape remains `{ ok, data/error }`. Yes if status codes or payload shape change. | Force validation, auth, database, and business-rule failures in preview; confirm safe user-facing messages and console details. |
| D-02 | Supabase production/preview parity | high | Live RLS, schema, migrations, and query plans are not yet verified in a clone/preview. | Previous checks were local/static; production latency/RLS can differ. | Supabase project, migrations under `supabase/migrations`, API/query files | Data may appear empty or slow only in Vercel/Supabase production conditions. | Yes | Run read-only verification in preview/clone first: migrations, RLS user isolation, indexes/query plans, slow endpoints. | Medium-high | Yes | Use a test user with known data; compare preview/production results and Vercel function logs. |
| D-03 | Vercel preview/production behavior | high | Production and preview may differ due to env vars, serverless cold starts, region, service role availability, cron secret, and external exchange rates. | Vercel environment settings are outside the repo; release workflow can deploy/apply migrations. | `vercel.json`, `.github/workflows/production-release.yml`, Vercel env, Supabase env | Bugs may reproduce only on production/preview even when local build passes. | Yes | Compare env presence and request timings. Do not change env without approval. | Medium-high | Yes for env changes or production checks. | Deploy preview from diagnostic/fix branch; compare same user/session against production and record function durations. |
| D-04 | Release workflow guardrails | medium | Manual production workflow can apply Supabase migrations and deploy production. Package scripts include direct db/release commands. | Workflow inputs default to applying migrations/deploying; package scripts expose `db:push`, `db:reset`, `release:production`. | `.github/workflows/production-release.yml`, `package.json`, release scripts | Accidental production-impacting operations are possible if credentials/env target production. | No, but must be resolved before production readiness sign-off. | Add explicit documented approval/backups/branch checks and safer defaults in a separate process task. | Medium | Yes | Dry-run release checklist against non-production and verify required approvals are enforced. |
| D-05 | Authenticated E2E coverage | medium | Authenticated suites exist but require credentials and create data, so they are not always run. | Tests are skipped unless `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` are set. | `tests/e2e/*`, `playwright.config.ts`, Vercel/Supabase test data | Build can pass while authenticated module flows are broken. | Yes | Create dedicated preview/test user and resettable data strategy. Run authenticated smoke before release. | Medium | Yes if it affects Supabase project/test data. | Run `npm run test:e2e:registrations` against preview with test credentials and review created data cleanup. |
| D-06 | Mobile/responsive basics | medium | Mobile drawer, topbar, tables, modals, and dense finance screens need manual validation after stability fixes. | Complex responsive UI across modules; no mobile Playwright project configured. | `components/layout/*`, module workspace components, tables/forms/modals | Users on mobile may hit clipped controls, inaccessible actions, or scroll traps. | Yes | Add manual mobile QA now; consider mobile Playwright project later. | Low-medium | No for QA. Yes for significant layout changes. | Test iPhone-sized viewport in preview for every module, modal, drawer, and table/card switch. |
| D-07 | Console/runtime errors | medium | Console/runtime errors were not exhaustively verified for every module in Vercel. | Existing audits focused on static checks and targeted flows. | Whole app | Runtime errors can break loading state finalizers and leave skeletons visible. | Yes | During manual QA, capture console, network, and Vercel logs for every module. | Low | No | Hard refresh each route in preview with console open; fail one API dependency per module and confirm no uncaught exceptions. |
| E-01 | Redesign readiness | high | Redesign should not begin while stability contracts remain unresolved. | Loading/error/action behavior is still inconsistent across modules. | All visible modules and shared UI primitives | A redesign would hide or multiply current stability bugs. | Yes | Complete Phase A-D or explicitly accept remaining risks before starting Phase 2. | High if skipped | Yes to start redesign before full stability sign-off. | Confirm master QA pass, owner acceptance of remaining risks, and frozen module contracts. |

## Module Coverage Notes

### Dashboard

- Covered by issues B-01, B-02, D-07.
- Primary risk is not an infinite client fetch anymore; it is cold-load weight, duplicate dashboard data work, and widget-level refetches.
- Redesign should wait until dashboard bootstrap and widget contracts are stable.

### Portfolio

- Covered by issues A-01, A-02, C-05, D-02.
- This is the top priority because it is user-visible, central to financial data, and can block first direct access.
- `STUCK_LOADING_ROOT_CAUSE.md` and `STUCK_LOADING_HOTFIX_PLAN.md` are the main evidence.

### Movements / Transactions

- Covered by issues A-04, C-02, C-03, D-01.
- Main transaction list is timeout-protected through shared hooks.
- Remaining risk is server option preload fallback, export metadata/download, attachment upload, and form option visibility.

### Credits

- Covered by issues B-04, C-03, D-01.
- Main list uses shared timeout. Forms and bank/account/billing-cycle options need clearer failure handling.

### Budgets

- Covered by issue B-05.
- Main budget and period loads are timeout-protected, but blocking vs non-blocking option errors should be separated.

### Assets

- Covered by issues B-06 and C-03.
- Main list is timeout-protected. Asset-type/account options and attachment failure policy remain.

### Receivables

- Covered by issue B-07.
- Top-level debtor list is timeout-protected. Detail and form dependencies need bounded, visible failure states.

### Payables

- Covered by issue B-08.
- Mirrors receivables.

### Recurring

- Covered by issue B-09.
- Top-level list is timeout-protected. Form option loads need per-dependency visibility.

### Alerts

- Covered by issue B-10.
- Top-level list has error/retry; bulk and generation actions need better bounded feedback.

### Administration

- Covered by issue C-01.
- Catalog managers have basic loading/error/empty states but inconsistent timeout/error mechanisms.

### Configuration

- Covered by issue A-05 plus settings-specific QA in `MASTER_QA_PLAN.md`.
- Server preload failures should not become silent defaults.

### Login / Logout / Authenticated Routes

- Covered by issues A-03, D-05, D-07.
- Auth contract changes require approval. Current unauthenticated redirect tests exist; authenticated smoke requires configured credentials.

### App Shell / Layout / Sidebar / Topbar

- Covered by issues A-03, B-03, C-04, C-05, D-06.
- Shell should remain usable if nav badges or auxiliary state fail.

### Supabase Queries And Error Handling

- Covered by issues D-01 and D-02.
- No schema/RLS changes should be made without approval.

### Vercel Production / Preview Behavior

- Covered by issue D-03.
- Preview validation is mandatory before production release.

### Loading, Error, Empty, And Success States

- Covered across Phase A-D.
- Rule: empty state must only appear after a confirmed successful empty response, not after unknown failure.

### Buttons, Links, Modals, Dropdowns, Drawers, And CTAs

- Covered by Phase C.
- Rule: every visible action must work, be disabled, be hidden by permission/status, or be documented as pending decision.

### Mobile / Responsive Basics

- Covered by issue D-06.
- Manual QA is required before release readiness.

### Console / Runtime Errors

- Covered by issue D-07.
- Every Vercel manual module test must include console and network observation.
