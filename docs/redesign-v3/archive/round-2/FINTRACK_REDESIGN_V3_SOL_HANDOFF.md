# FinTrack V3 Round 02 — Operational Handoff for GPT-5.6 Sol

**Status: implementation specification, awaiting owner design and execution approval. Do not start production implementation merely because this file exists.**

Date: September 22, 2026. Design baseline: `4fdbe715f1a887ff59fc64868bf2da06c2d0cdae`, `codex/redisenio-total`. This mission changed only documentation and isolated design artifacts. No commit, deployment, API, auth, data or Supabase change is included.

## 0. Start here, not with another design exploration

1. Read `CODEX_RULES.md`, applicable `AGENTS.md`, current QA/stability documents and the owner's explicit approval. Record approved V1/V2/V3 and each separately authorized S/O package.
2. Read master-plan sections 3–8 for locked visual/financial behavior, section 9 for the current module, section 10 for gates, and sections 11–12 for sequence/acceptance. The master plan is the source of truth. This file is the execution map.
3. Open the refined preview, not the archived blue V3. Inspect the relevant screenshot IDs listed below. Do not infer a product requirement from simulator code or a reference image.
4. Reconcile the real implementation base. Local main was previously three commits behind the known remote; this study did not fetch/merge. Resolve overlapping owner changes without overwriting them. Record the chosen SHA and a baseline screenshot set.
5. Build one scoped phase/package at a time. Do not mix a bug fix, domain refactor, new feature and visual redesign in one change. Keep the previous renderer available until its replacement passes.

If a new brief conflicts with an approved decision, stop and ask which decision is being revised. Do not silently redesign.

### Authority boundaries

| Allowed after design/execution approval | Requires independent approval |
|---|---|
| Tokens, typography, approved FT assets, shell presentation, labels, layout, shared presentation components, documented chart replacement, responsive behavior, existing-operation form layout | Database/schema/RLS/RPC changes, authentication behavior, public API contracts, new finance formulas, FX/parser changes, repair/backfill, schedule engine, complete net-worth model, migrations |
| Pure selectors/adapters over existing verified values, with explicit scope and existing financial helpers | New aggregation endpoints, filters not supported by a service, hidden read-triggered repairs, invention of missing dates/currencies/history |
| Local synthetic QA and an explicitly authorized non-production Preview | Production deployment, live-data tests, real financial writes, testing access with other users' IDs |

## 1. Locked decisions in one page

- Direction: **Connected Financial Clarity**, recognizable FinTrack rather than a generic dashboard. Teal/green/mineral neutrals, restrained gold in FT12; light default, complete dark mapping. Manrope400/600/700, tabular financial numerals.
- Brand: preserve exact FT12 paths. Copy approved SVG assets from `docs/redesign-v3/preview/brand/` into the app's chosen asset location in a scoped brand PR; do not redraw, add an arrow or substitute a font monogram. Optical16/20px mono; full mark≥24px.
- Shell: desktop sidebar208px, tablet rail68px, desktop/tablet topbar56px, mobile topbar52px. Horizontal page padding28/22/16px, content max1560px;40px padding≥1600. The28px proposal bar must never ship.
- Navigation: Inicio, Movimientos, Cuentas / Presupuestos, Créditos, Por cobrar, Por pagar / Activos, Plantillas / Avisos, Catálogos, Configuración. Preserve existing paths, gates, IDs and quick-create URL contracts.
- Mobile bottom navigation: Inicio, Movimientos, Registrar, Cuentas, Más. No simultaneous FAB, hamburger and duplicate header CTA. Registrar opens all existing operation choices.
- Inicio desktop: position/pending band → attention line → independent left report/recent stack and right agenda/budgets/credit stack. Ratio1.85:1, gap18px; internal stack gap16px. No equal-height KPI wall.
- Tablet: report full width; agenda/budgets side by side; recent full width; credit strip. Mobile: position, attention, exact monthly facts, collapsed analytical detail, agenda2 rows, budgets, recent, credit.
- Money: `S/ 1,234.50`, `US$ 1,234.50`, exact cents, comma grouping/decimal point; missing≠zero. Native position separate from report PEN and equivalents. Keep original currency and stored precision. No cross-currency netting.
- Ledger rows56px minimum, headers38px, amount right-aligned. Detail520px, ordinary form580px, complex schedule form960px max. Mobile overlays full-screen and keyboard-safe.
- No health score, fabricated savings target, unqualified wealth hero/history, predictive confidence band, AI insight, bank sync claim or available-cash-plus-credit number.

All exact colors, states, sizes and exceptions are in master sections 3–6. Do not create a second token palette here.

## 2. Visual references and what they prove

Start the local reference with `node docs/redesign-v3/preview/serve.mjs`; open `http://127.0.0.1:4173/`. It serves only the isolated directory and disallows network connections from the page. Themes/states are controls in the review bar. Direct fixture entry example: `/?theme=dark&state=ready#dashboard`.

All paths below are relative to `docs/redesign-v3/screenshots/`:

| Checkpoint | Captures | Inspect before coding |
|---|---|---|
| Desktop Inicio | `01-dashboard-desktop-light.png`, `10-dashboard-desktop-dark.png` | Position, independent columns, integrated monthly explanation, data hierarchy, not just colors |
| Tablet | `02-dashboard-tablet-light.png`, `26-dashboard-tablet-landscape.png` | Rail, full report, paired agenda/budgets, horizontal credit context |
| Mobile | `03-dashboard-mobile-light.png`, `19-dashboard-mobile-viewport.png`, `20-dashboard-mobile-scrolled.png`, `24-mobile-analysis-expanded.png`, `16-dashboard-mobile-dark.png` | First viewport versus full page; fixed navigation; deliberate analytical disclosure |
| Movements | `04-transactions-desktop-light.png`, `11-transactions-dark.png`, `14-transactions-mobile.png`, `23-category-to-records.png` | Dense register, original amount signs, scope chips, filter context and mobile rows |
| Forms and detail | `05-transaction-detail-drawer.png`, `06-transaction-edit-form.png`, `15-mobile-create-form.png`, `27-filter-drawer.png` |520/580px overlays, amount-first hierarchy, dirty-dismiss protection, draft filters |
| Domain surfaces | `07-accounts-desktop-light.png`, `08-budgets-desktop-light.png`, `09-credits-desktop-light.png`, `18-obligations-currency-warning.png` | Native currency groups, exact period, credit-versus-loan, unverifiable opening balance |
| Connected investigation | `22-result-explanation.png`, `23-category-to-records.png`, `25-thirty-day-agenda.png`, `28-account-peek.png` | Summary → explanation → exact records → action;7/30 days and USD commitment |
| Identity | `21-ft-ligature-system.png`; `preview/brand.html` | Original Concept12 geometry, sizes, monochrome, dark, app icon |
| Availability | `12-dashboard-partial-error.png`, `13-first-use-mobile.png`, `17-loading-desktop.png` | Error≠empty≠loading, healthy neighbors retained |

The simulator is not production code. Its array totals, name-based category lookup, hash routes, fake saves, limited filter form, fixed current date, toast-only actions and simplified validation must NOT be transplanted. Real implementation must preserve full existing filters, fields, relationships, attachments and mutation contracts. Record the gaps between illustrative interactions and actual existing behavior in the phase PR.

Archive `docs/redesign-v3/archive/round-1/` is before-state evidence only. Never import its blue tokens, oversized rows or obsolete dashboard composition.

## 3. Integration map — keep domain ownership intact

| Area | Existing integration files/zones | Work to perform | Protected behavior |
|---|---|---|---|
| Foundation | `app/globals.css`, `lib/tokens.ts`, `tailwind.config.ts`, `app/layout.tsx` | Scoped V3 variables, compatibility aliases, self-hosted Manrope, dark equivalents | No blind global token replacement or font-induced change to every unmigrated screen |
| Shell | `components/layout/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `NavItem.tsx`, `QuickActionsFAB.tsx`, `lib/constants/nav.ts`, `app/(dashboard)/layout.tsx` | Approved IA, sizes, rail/bottom navigation, quick-create relocation | Session, visibility gates, auth redirects, providers, real main scroll container |
| Table/filter | `components/finance/data-table.tsx`, `components/tables/TransactionTable.tsx`, `lib/hooks/useTransactions.ts` | Evolve semantic table/mobile rows and presentational filters | Current list params, sort/page/selection, saved views, export and bulk partial results |
| Transactions | `components/transactions/TransactionsWorkspace.tsx`, `components/detail/TransactionDetailClient.tsx`, `app/(dashboard)/transactions/*` | Register-first layout; shared detail; deliberate analysis; exact deep links | Server/source value and report-participation semantics |
| Transaction forms | `components/forms/TransactionForm/index.tsx`, `form.orchestrator.ts`, `FormFields.tsx`, `sections/ModuleSections.tsx`, `NestedRecordCreationModals.tsx`, `components/forms/TransactionEditModal.tsx`, `components/transactions/OperationTypeSelector.tsx`, `components/ui/RecordModal.tsx` | Recompose existing sections inside approved drawers and nested subviews | All eight operation identities, Zod, payloads, account/currency checks, attachment compensation, exact target IDs |
| Accounts | `components/management/PortfolioManager.tsx`, `modules/portfolio/*`, Portfolio pages | Native groups,56px register, shared form/detail, factual opening/current amounts | Identity/linked-record/reference-data/timeout guards and custom currency support |
| Assets | `components/assets/AssetsWorkspace.tsx`, `AssetsListPanel.tsx`, `AssetsForm.tsx`, asset pages | Status-aware register/detail/form, linked purchase | Custom asset types, ACTIVE/SOLD/DEPRECIATED, unsupported attachment-write guards |
| Budgets | `components/management/BudgetsManager.tsx`, `BudgetDetail.tsx`, `lib/budgets/*`, budget pages | Period-first list, progress rows, explicit period/series actions | Existing spent/limit/remaining conversion and series target |
| Credits | `components/credits/CreditsWorkspace.tsx`, `components/management/CreditsManager.tsx`, `modules/credits/*`, credit pages | Card/loan split, dual-currency debt, exact schedule presentation | Rate-source guards, schedule components/total, linked credit account, documents |
| Receivables | `components/receivables/ReceivablesManager.tsx`, `DebtorDetail.tsx`, `DebtorForm.tsx`, `ReceivableForm.tsx`, `modules/obligations/*` | Currency buckets, open documented scope, contact/document detail, collection path | Legacy opening balance stays outside verified totals; no incidental repair refactor |
| Payables | `components/payables/PayablesWorkspace.tsx`, `CreditorDetail.tsx`, `CreditorForm.tsx`, `PayableForm.tsx` | Parallel presentation with its own direction and status behavior | Existing pay/partial/dispute guards; never blindly clone receivable mutations |
| Templates / notices | `components/recurring/*`, `components/alerts/*` | Templates as reusable data; notices as read/unread | No schedule engine; read does not mean financially resolved |
| Dashboard | `components/dashboard/DashboardWorkspace.tsx`, active dashboard widgets, `MoneyFlowChart.tsx`, dashboard page | Compose verified V3 components; adapters over current reads; independent states | Do not change `modules/dashboard/dashboard.service.ts` formulas/queries in the visual PR |
| Settings/catalogs | `components/settings/*`, `components/management/AdminWorkspace.tsx`, catalog managers and related pages | Section recipes from master9.11–9.12 | Imports/exports/security/profile and system-record restrictions unchanged |
| Auth/public/status | Existing auth forms/pages, public root, module-status/maintenance/error pages | Visual-only last stage | Auth callbacks/recovery/session/middleware unchanged; no new capability promises |

Read route files before using them. A filename beginning `GET` is not proof of read purity (F18). A path listed here is an integration zone, not authority to rewrite an entire large component.

## 4. Shared components and precise contracts

Create/evolve these before page assembly; use existing UI primitives where they satisfy the contract. Suggested names/locations match master11.2. Do not add a new component library just to implement simple styles.

| Component | Required input / output | Must not do |
|---|---|---|
| `MoneyText` | Verified value/currency, availability, direction, display precision, optional equivalent/provenance; accessible exact text | FX conversion, source rounding, unknown→0, non-PEN→USD fallback |
| `FinancialScope` | Native/report/equivalent basis; exact interval/as-of; included statuses/exclusions; uncertainty disclosure | Fabricated freshness, universal period selector |
| `PositionBand` | Ordered native account groups plus two pending fact groups; real counts/links and local boundaries | Add balances, receivables, assets and credit into one number |
| `DataBoundary` | Existing state: initial/slow/ready/empty/filtered/error/stale/partial; retry callback; geometry skeleton | Fetch or mutate automatically; turn permission error into empty |
| `RecordTable` / mobile renderer | Existing rows/IDs, semantic columns, sort, selection, pagination, row detail link | Client-filter only the visible page while labeling it a full filtered result |
| `FilterDrawer` / `ScopeChips` | Draft/applied query, apply/cancel/reset, adapters for existing names, retained saved views | Mutate results before Apply, reset unrelated scope on individual chip removal |
| `DetailDrawer` | Existing detail content,520px, trigger ref, return URL, sticky header/actions, exact record ID | Lose source scroll/filter/selection or replace direct detail routes |
| `RecordFormDrawer` | Existing controlled form sections and submit handlers,580px/960px, dirty state, nested subview | Reimplement finance validation, optimistic success before server confirmation |
| `ChartFrame` / `MonthlyFlowBars` | Verified values/period identity, chart/table alternative, partial-month state, tooltip | Invent months, smooth missing values, create fake baseline/history |
| `CategoryRanking` | Real category ID/name, type, report amount/basis/interval; top6 or top5+aggregated Others | Treat Others aggregation as a category ID, assume category name is unique |
| `ResultExplanation` | Same summary/category snapshot and scope; exact equation; source drilldowns | Recompute from recent records or hide an endpoint parity mismatch |
| `BudgetProgressRow` | Existing period ID, metrics, currency, availability, detail callback | Clamp numeric percent, infer category-wide spend, redirect edit to series accidentally |
| `CommitmentList` | Verified source type/ID/date/native currency/status/direction; coverage flags | Generate payment dates, default missing currency, pay on row click |
| `RecentMovementList` | Latest five existing records and detail actions | Become a second summary engine or duplicate transaction mutation handlers |
| `CreditOverview` | Native card debt; verified line-base utilization; separate native loan principal | Sum credit capacity with cash or relabel a cycle as minimum payment |
| `AttentionLine` | At most two already-known factual exceptions, linked exact source | Introduce score, AI advice or new notification-generation side effects |

Adapters should be pure and testable. Keep server-only retrieval in its current layer; interactive components are client boundaries only where needed. Each source must retain its own last-success/error state; a global request timestamp cannot establish freshness for all panels.

## 5. Dashboard data wiring and drilldown packet

### 5.1 Sources to reuse, not recreate

| Region | Existing contract | Implementation guard |
|---|---|---|
| Native accounts | `/api/accounts?include_inactive=true`; `modules/portfolio/currency-display.ts` | Active/non-technical only; use current helper to group verified original balances |
| Open documented pending | Unfiltered `/api/receivables` **without debtor_id** and `/api/payables` | Select PENDING/PARTIAL scope; map `collected_amount` / `paid_amount` to existing helper `settledAmount`. `isOpen` only counts; it does not filter or exclude a balance. Closed/write-off/disputed and currencyless initial balances are outside this scope and explicitly disclosed |
| Monthly summary | `/api/dashboard/summary` | Current month only; report PEN; S01/S03. No global historical selector |
| History | `/api/dashboard/money-flow?months=6&mode=mensual` | S02; localized `month` is not a reliable ISO date/year. No guessed date link |
| Categories | `/api/dashboard/sidebar?period=YYYY-MM` | Real category IDs, report amount fields; test summary/category parity; separate income/expense switch |
| Budgets | `/api/budget-periods?period=YYYY-MM`, current metrics | Exact period, verified basis, no new FX conversion |
| Recent | `/api/transactions?sort_by=transaction_date&sort_dir=desc&page=1&per_page=5` | Display only; summaries come from report contracts, never this five-row page |
| Credit | `/api/credits` + existing credit/schedule presentation helpers | Dual-native debt versus line-base equivalent; native loan principal separate |
| Agenda | Reuse verified due documents and existing owning credit/cycle/installment read paths | Alerts identify candidates, not complete coverage. Sidebar cycles omit currency. Verify native currency from the exact source; otherwise show unavailable amount and partial coverage |

Never add `GET /api/debtors` or debtor-filtered receivable reads simply to populate the dashboard: they can write via `repairLegacyReceivableLinks`. Do not call real APIs while generating design fixtures. O12 separately addresses explicit repair. Do not alter these GET handlers in a redesign PR.

Verify query coverage before calling unpaginated document sums complete. Backend row caps are possible even without pagination in a handler. If coverage is not demonstrable, state `Registros consultados · cobertura no verificada`, expose scope, and consult before API/O01/O10 changes. Unknown coverage is not an empty list or a trusted whole-account total.

Agenda records use a tagged source identity, not a shared ambiguous `id`: receivable, payable, card cycle or loan installment + persisted ID. Deduplicate notifications against their actual source when association is verified. Dated open receivables/payables and cycles/instalments remain distinct; do not count a payment transaction itself as another upcoming commitment. No-date items stay in module lists.

### 5.2 Exact transitions

- Income/expense amount → `/transactions` using `type=INCOME` / `type=EXPENSE`, current report start/end as `date_from` / `date_to`, `page=1`. Do NOT set `currency=PEN` merely because the summary is expressed in PEN.
- Result/info/ratio → `ResultExplanation`; same interval, equation, income categories, expense categories, no-return/no-balance explanation. Zero income = unavailable ratio. Negative result stays signed.
- Category → same type/period filters plus real `category_id`; selected chip visible. Removing category keeps type/period; clearing all resets all and page1. Do not treat display name as identity.
- If the existing register cannot filter report participation, explicitly disclose that category records may include entries excluded from reports; show that fact in detail. Do not promise list-sum parity without it. Ask before adding a filter/API field.
- Chart month → tooltip/data table first. Link to period records only with a verified date identity. When year is unavailable show that limitation, not inferred September of the current year.
- Agenda → exact source preview/detail, then explicit collect/pay using existing operation target. If current route accepts a contact ID rather than document ID, use its existing selection contract; never place a document ID in a contact route. If no supported exact deep link exists, the preview still shows the exact document and the module link is labeled as module navigation.
- Account count/balance → account peek, then exact account detail/Cuentas. Preserve native currency.
- Recent row → existing transaction detail; Edit reuses orchestration; closing returns to the original row and scroll.
- Budget → exact period detail; period/series distinction survives every edit/delete.
- Credit → actual card/loan detail, native debts and verified schedule; no new payment math.

### 5.3 Responsive implementation detail

Use responsive region placement without mounting duplicate fetching instances. Desktop source/focus order is report → recent → agenda → budgets → credit, matching its independent columns. Tablet/mobile source/focus order is report → agenda → budgets → recent → credit. Keep headings/landmarks; hold query ownership and selected interaction state above the single responsive presentation so wrapper changes do not repeat reads or discard a draft. The simulator's CSS-only reordering is illustrative, not certified focus behavior. Do not render a hidden copy of the mobile report or an old workspace to fetch data.

Mobile analysis is collapsed on first visit, exact facts always present; expansion stays for the current visit. Desktop/tablet analysis is always visible. Preserve selected category type and interval through overlay operations. Agenda7/30 changes agenda only, not balances/report/budgets. Show two commitments on mobile/four otherwise and the true interval count; full drawer includes all available verified rows with coverage disclosure.

Measure critical coordinates against captures with the28px review bar removed. Content heights are minimum/content-driven, not fixed to synthetic text. Long names wrap or truncate only descriptive text; monetary amounts never ellipsize. At200% zoom adapt layout rather than forcing desktop geometry.

## 6. Exact implementation sequence and phase packets

Dependencies follow the master plan's stages0–18. Stage1 packages require their own authority. Foundation work can be prepared in isolation, but dependent routes cannot be released with unresolved correctness/security gates.

| Stage | Deliverable / existing zones | Exit evidence before proceeding |
|---|---|---|
| 0 | Approval IDs, reconciled SHA, disposable fixture/environment plan, before screenshots, gate register | No production changes. Owner approval explicit; S01/S06 status recorded |
| 1 | Separate authorized S01–S06 packages, never bundled with redesign | Package-specific tests; effective RPC ownership in disposable DB; latest-N history; partial/stale reads; controlled errors; inactive-bank edit; authenticated harness |
| 2 | Scoped tokens/font/theme/FT assets in foundation files | Both-theme sentinel screens; no appearance changes to unopted modules; colors match master4; font license included |
| 3 | MoneyText, FinancialScope, PositionBand, DataBoundary | Pure tests for valid/missing/zero/negative/large/custom currency/equivalent states; no conversion introduced |
| 4 | Buttons/inputs/selects/menus/tabs/toasts/focus | Keyboard states,44px touch, busy widths, field errors/reduced motion; old API props compatible |
| 5 | Table/filter/detail/form shells and ChartFrame |56px rows;520/580/960 sizing; dirty close; focus return; draft Apply;320/390/834/1440 captures |
| 6 | Shell/IA/nav/quick-create relocation | Every existing link/gate/quick-create URL; sidebar/rail/bottom nav; private mode; no duplicate mounted renderers |
| 7 | Accounts pilot in PortfolioManager | S05 closed, current account unit suites; active/inactive/technical/custom-currency cases; metadata failure and guarded edit; capture07 |
| 8 | Assets workspace/list/form/detail | Status/custom-type/attachments tests; linked purchase and native values; module-specific state matrix |
| 9 | Movements register/filter/saved view/export/detail, NOT creation rewrite | Existing params and pagination/bulk/export scope; drawer/direct route; captures04/05/11/14/23 |
| 10 | Operation chooser + transaction create/edit/direct-new presentation | All eight operations, nested draft preservation, edit links, attachments, uncertain write; captures06/15 |
| 11 | Budgets list/detail/form/progress | Exact period/series actions,0/over-limit and existing conversion parity; budget scope suite; capture08 |
| 12 | Credits cards/loans/detail/forms/schedules | Dual native currencies; missing/mismatched rate; exact components and documents; credit suites; capture09 |
| 13 | Receivables list/contact/document/collection | Currency buckets, initial unknown, exact target, partial/overpay/attachment guards; no hidden repair expansion; capture18 |
| 14 | Payables list/contact/document/payment | Same presentation contracts with correct own statuses/direction; partial/paid/disputed; verify no unintended formula/filter change |
| 15 | Templates then Notices in separate PRs | Template prefill retains operation; no automation claim. Notice read/unread not paid/resolved; generator errors visible |
| 16 | Dashboard assembly from verified components and approved read adapters | Gates/source coverage; every source fails independently; summary/category parity; end-to-end investigation; captures01/02/03/10/12/16/19/20/22/24/25/26/28 |
| 17 | Settings, catalogs, developer/status, auth/public styling in separate PRs | Existing profile/security/import/export and permission flows, auth redirects unchanged; master9.11–9.14 |
| 18 | Consumer audit, compatibility cleanup, full QA/release evidence | No orphan old consumer before deletion; full suites/build/Preview/device check, owner final visual acceptance; independent release approval |

Do not skip the Accounts pilot to build the visually appealing dashboard first. Its shared money, availability, table and drawer foundations must be proven against a real module. Stages13/14 may reuse presentation primitives but remain independent mutation integrations. Stage17 is not permission to redesign authentication logic.

## 7. Tests to keep and tests to add

### Existing suites and reproduction

Current focused baseline: **117 unit tests passed** in this design mission. This is not proof of authenticated financial end-to-end correctness. Use the repository's supported Node20 runtime for production build/CI; the isolated design checks ran using the available local runtime and did not change engines/dependencies.

```sh
./node_modules/.bin/playwright test --config=playwright.unit.config.ts
npm run typecheck
npm run lint
npm run build
```

Run only the first command for a documentation-only change if relevant; the latter commands are required when product code changes and at final integration. Do not run deployment/database scripts as QA shortcuts.

Focused suites by phase:

- Accounts: `account-currency-display.spec.ts`, `account-identity-guard.spec.ts`, `account-linked-records.spec.ts`, `account-mutation-timeout.spec.ts`, `account-position.spec.ts`, `account-reference-data-state.spec.ts`.
- Assets: `assets-status-custom-type.spec.ts`, `legacy-attachment-safety.spec.ts`.
- Transactions: `active-attachment-core.spec.ts`, `legacy-attachment-safety.spec.ts` plus authenticated transaction/quick-create/saved-view E2E.
- Budgets: `budget-series-scope.spec.ts` plus period/limit/currency fixtures.
- Credits: `credit-detail-presentation.spec.ts`, `credit-exchange-rate-integrity.spec.ts`, `credit-loan-schedule-integrity.spec.ts`.
- Receivables/payables: `receivables-payables-currency.spec.ts`, `legacy-attachment-safety.spec.ts`.

All named unit files are in `tests/unit/`. E2E files in `tests/e2e/` include `authenticated-transactions.spec.ts`, `authenticated-management.spec.ts`, `authenticated-quick-create.spec.ts`, `authenticated-portfolio-identity.spec.ts`, `authenticated-saved-views.spec.ts`, `authenticated-smoke.spec.ts`, `login-ui.spec.ts`, `auth-redirect.spec.ts`, `api-auth.spec.ts`. Read their current environment/cleanup requirements before running. Fix stale selectors in a separate harness concern; never call a skipped authenticated test passed. Use only an explicitly allowlisted disposable Supabase project/user, not the owner's data.

### New automated acceptance cases

| Case | Required assertion |
|---|---|
| Native position |26,840PEN and3,200USD remain separate; technical/inactive excluded; custom currency displayed rather than USD-coerced |
| Month |12,480−7,360=5,120; two internal transfers excluded;41.0% with formula; zero denominator unavailable |
| Report drilldown | Actual category_id/type/date scope retained through register/detail/back; category removal does not clear period/type |
| Recent records | Five records sorted by transaction date; no summary math using those five; transfers retain neutral direction |
| Budget |800 limit/860 spent →107.5%,60 exceeded; bar capped only; exact budget period ID in actions |
| Credit |4,800PEN+180USD remain native buckets; illustrative line equivalent5,484/15,500=35.4% only with fixture's verified3.8 basis; capital10,800 separate |
| Obligation scope |2,850PEN+400USD receivable;3,100PEN+250USD payable; opening amount unknown excluded; correct PENDING/PARTIAL filtering before helper |
| Agenda | Four7-day and six30-day fixture items; USD400 original; duplicate notification/source not double counted; unknown cycle currency never PEN |
| Read purity | Network mocks assert no new `/api/debtors` or debtor-filtered receivable request from Inicio; no financial write on mount, filter, tooltip or theme switch |
| Partial data | Fail accounts, summary, categories, agenda, budgets, credits and recent independently; no fabricated0 and no hidden healthy sibling |
| Coverage | Simulate truncated document list/unknown count; no complete-total or complete-agenda claim |
| Month history | >N history picks verified latestN under S02; year unavailable does not create guessed date links; missing months not filled with fake0 |
| Responsive |320,390,430,768,834,1024,1280,1440,1920; no page overflow or clipped money; correct region order and touch targets |
| Accessibility | Keyboard create/cancel/filter/detail/chart-data; visible focus; focus return; announcements;200% zoom; reduced motion; both-theme contrast |

### Visual acceptance

Same fixture/font/theme/route/state before comparing. Principal boundaries within±4px of the approved reference at matched widths, after subtracting the review toolbar; exact tokens and information hierarchy. Synthetic content is not a fixed-height constraint. Compare light+dark dashboard and register, form, dirty dismissal, filter, account peek, explanation, agenda, partial error, first use and loading.

Reject: four equal KPI cards; missing recent records; category chart separated into an unrelated widget; full-height blank space in desktop columns; phone-like tablet stacking; oversized repeated CTA; clipped currencies; unapproved font/accent/logo; extra decorative chart. Financial amounts and source targeting must be identical before/after regardless of screenshot similarity.

## 8. Stop and consult — do not improvise

1. A required value needs a new formula, FX rate, parser behavior, schema/API field or Supabase query contract. Use the documented unavailable/partial state and request the relevant O package; never fabricate a number to fill a region.
2. Effective RPC ownership is unresolved for a dependent release (S01), or no safe authenticated QA environment exists (S06). Local component work may continue; production-readiness claim/release cannot.
3. New base changes invalidate paths/fields/invariants. Report the exact divergence and proposed minimal adaptation; don't rewrite the design or overwrite user work.
4. A detail route expects contact ID but only document ID is available; a cycle lacks verified currency; history lacks a year; a list may be capped. These are data-contract issues, not opportunities to guess.
5. A read invokes repair or writes, a link is matched by description/name, or an import/cleanup could touch real records. Stop that operation; request explicit technical authority. Design approval is insufficient.
6. New and old financial fixtures disagree, attachment association is unverifiable, mutation response is uncertain, a linked record disappears or original currency changes. Keep the protective state, stop rollout and investigate in a separately scoped package.
7. Achieving the approved appearance would remove a working existing action, route or required field. Preserve it in the specified overflow/detail/optional section; consult if that materially changes the approved flow.
8. A new dependency, complete component rewrite, route replacement or broad refactor is being considered only for convenience. Prefer a scoped adapter; explain risk before expanding scope.

Optional packages: O01 snapshot/availability; O02 money/parsing/FX provenance; O03 reconciled wealth; O04 schedules/scenarios; O05 calendar; O06 period/provenance/comparisons; O07 opening-balance currency; O08 budget model; O09 attachments; O10 bounded registers; O11 idempotency/reconciliation; O12 explicit legacy repair. Full impact/migration/priority/fallback details remain in master10. None is implicitly approved.

## 9. Rollout, rollback and mandatory PR evidence

Use a development/Preview-only V3 root attribute and separate shell/module switches during migration. Preserve compatibility tokens and old component props until all consumers are migrated. Render one active data owner, not both old/new trees hidden with CSS. A flag must never bypass auth or permissions.

Each phase PR/work record must contain:

1. Approved phase and prerequisite IDs, implementation SHA, changed files and purpose.
2. Protected domain functions/contracts left untouched; any independently approved deviation linked explicitly.
3. Actual commands/tests/results plus gaps, not checklist-only claims.
4. Matching screenshots and fixture version for required widths/themes/states.
5. Every affected visible action tested or explicitly disabled with a truthful reason.
6. Known risks, last-known-good commit and exact code-only rollback target.

Rollback on value/currency/date mismatch, wrong mutation target, broken existing action, auth regression, endless loading, hidden partial failure or inaccessible primary workflow. Disable the affected module flag or revert its scoped commit, then rerun its smoke/financial tests. Do not reset the whole worktree or revert unrelated user changes. Keep old renderer until acceptance; delete it only in stage18 after consumer proof.

Visual stages contain no database migration, so their rollback must be code-only. Optional structural packages need independent data/migration rollback and reconciliation; never imply that reverting a stylesheet restores repaired financial data. Production merge/deployment remains a separate owner decision.

## 10. Definition of implementation completion

All approved stages relevant to the release are complete; original financial fixtures and routes retain behavior; dark/light and responsive states match the refined reference; every visible action is functional or truthfully unavailable; required stability/security gates closed; authenticated QA evidence current; owner accepted the implementation's visuals. Prototype tests alone satisfy none of the live persistence/security obligations.

The intended outcome is operational construction, not another design round: Sol should spend its effort on integration, regressions, tests and delivery, while keeping the product and visual decisions in this specification fixed.
