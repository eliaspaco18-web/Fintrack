# Performance closeout R1

## Scope and safety

This change closes only verified code-side request and preload duplication found while revisiting the approved performance audit. The implementation preserves API contracts and financial calculations. It adds no shared financial-data cache, dependency, schema change, migration, RLS change, or Production operation. User-scoped reads continue to use the authenticated user ID or the existing authenticated API.

Baseline source: `main` at `2322bee200dd51b2858a0d3195c2305afe2bcc5c`. Runtime checks use synthetic records and mocked APIs. No authenticated Production timing, Supabase query latency, or Vercel function telemetry was available or queried; p50/p95 and real-user timing are therefore not claimed.

## Reproducible before/after counts

Counts below are source-path request/query counts for a cold visit or one successful mutation. UI-trigger counts are measured by browser tests with a fixed synthetic fixture. They are not Production network measurements. “Required list read” means the existing financial list request remains in place.

| Journey | Baseline at approved `main` | Candidate | Evidence and interpretation |
| --- | --- | --- | --- |
| Credits, cold list (2 synthetic credit rows) | 1 required `/api/credits` SWR read + 1 explicit `/api/bank-entities` read = 2 API reads | 1 required `/api/credits` read; bank filter options derive from its already user-scoped joined relation | The real `CreditsListPanel` browser harness verifies no extra browser fetch and that the bank filter still contains the joined entity. `tests/unit/credits-performance.spec.ts` covers deduplication and sorting. |
| Credits, successful row mutation | Source has a bound SWR `refetch`, a global SWR invalidation, and `router.refresh()` | One global invalidation of the existing `/api/credits*` SWR keys | The candidate component integration harness observes 1 invalidation, 0 local refetches, 0 route refreshes, and one mocked list GET. SWR may deduplicate baseline requests, so this is a refresh-trigger reduction, not a claim of 2-to-1 Production HTTP traffic. |
| Budgets, cold current-period view | `/api/budgets` + `/api/budget-periods` + `/api/categories` = 3 requests | The two required list/period requests remain; category options load once when the create/edit form opens | The lazy-hook browser tests verify 0 category requests at list entry, 1 on first form open, no duplicate on reopen, and explicit retry after failure. The list filter derives categories from already loaded budget relations. |
| Settings, one server render by tab | `profiles SELECT *` + `accounts SELECT *` = 2 table reads for every tab | Profile: profile + exact account count (2 reads); Preferences: profile (1); Accounts: selected account fields (1); Security, Notifications, Export, Support: 0 table reads | `getSettingsPreloadPlan` and loader tests verify the active-tab plan and error handling. Authenticated `getUser()` remains required on every tab. Account count remains exact and user-scoped. |
| Assets, successful status/edit/delete action | Source has local SWR `refetch`, global `/api/assets*` invalidation, and `router.refresh()` | Mutation followed by one global `/api/assets*` invalidation | The real `AssetsListPanel` browser harness uses one synthetic asset and records 1 invalidation, 0 local refetch calls, 0 route refreshes, and 1 mocked list GET. |

No elapsed-time improvement is reported for database-backed routes because the safe local environment has no isolated authenticated database. The baseline production build compiled in 9.8 seconds; the candidate compiled in 5.5 seconds on a warmed local build cache, so those build figures are not a comparable runtime or bundle-size result and are excluded from the performance claim.

## Module review

| Module | Outcome |
| --- | --- |
| Home | Stage 1 dashboard overview reuse remains in place; no Stage 1 code was changed. No new safe duplicate read was demonstrated. |
| Movements | Stage 1 pagination, counters, deferred form options, and exchange-rate fixes remain untouched. |
| Credits | Removed the redundant bank-entity list read; collapsed mutation refresh triggers. The credit list's joined bank relation is reused. |
| Budgets | Deferred category catalog loading until a form opens; current filter choices use categories already present in loaded budget records. Budget metrics and currency calculations are unchanged. |
| Payables | No code change. The list and creditor/reference reads serve distinct data, and no safe consolidation was demonstrated without changing API/data semantics. |
| Accounts | No code change. Account, currency, and financial-institution options are used by the current filters and management workflow. |
| Assets | Collapsed mutation refresh triggers to one SWR invalidation. Existing type-option loading remains because it serves visible filters. |
| Recurring | No code change. The list is already a single read and form-specific options are already deferred. |
| Catalogs | No standalone change. Category data needed by budget forms is now deferred with the form; no broader catalog batching or cache was justified. |
| Configuration | Loads only data required by the selected tab and selects only fields used by Accounts. Profile saves remain blocked when their required profile/account-count data is unverified. |
| Avisos | Prior approved toast-persistence and bulk-clear behavior is unchanged. No new duplicate request path was changed in this closeout. |

## Validation and remaining measurement

The focused regression set covers real Credits and Assets panels with synthetic APIs, budget category lazy loading and retry, category/bank option derivation, and Settings tab query plans. Full lint, typecheck, production build, unit suite, and release guards are run on the candidate SHA before PR creation. GitHub's read-only pull-request CI runs the same local checks. No authenticated test uses Production.

The remaining measurement is an approved, isolated QA Preview with synthetic QA data and browser network/response instrumentation. It can establish route TTFB, time-to-useful-data, SQL/service timings where QA telemetry exposes them, and p50/p95 over repeated runs. Real Production query plans or plan-capacity changes would require separate read-only evidence and are outside this code-only closeout.

## Rollback

Reverting this commit restores the original eager category fetches, global Settings preloads, and duplicate refresh triggers. No data or server state needs repair.
