# R0 — FinTrack Visual Baseline and Acceptance Contract

Status: source-of-truth visual QA contract

Scope: the protected FinTrack product experience under `app/(dashboard)`

Audit base: `main` at `01e19ac2de641dee10e4ec2f4c32c7711c6e76f1` (`docs: add premium redesign master plan (#12)`)

Implementation status: no redesign implementation is authorized by this document

## 1. Purpose

This document defines the visual evidence, state coverage, regression checks, and acceptance rules required before and after every FinTrack premium-redesign pull request.

It converts `REDESIGN_MASTER_PLAN.md` into an executable review contract based on the current repository. It is not a generic SaaS checklist and it does not approve the current styling as the target. The current UI is the baseline for:

- information, controls, actions, financial meaning, and route availability that must be preserved;
- current loading, empty, error, warning, disabled, and pending behavior that must be understood before it is redesigned;
- visual problems that the redesign is expected to solve;
- known state gaps that require a separate stability decision instead of being silently mixed into a redesign PR.

The target remains the master plan's **calm financial operating desk**: warm, precise, restrained, data-led, accessible, and premium through hierarchy rather than decoration.

## 2. Scope and guardrails

### 2.1 In scope for R0

- inventorying the actual protected routes and route variants;
- defining representative data and state coverage per module;
- defining required viewport, zoom, and theme coverage;
- identifying manual screenshots that must exist before implementation;
- defining functional flows that visual work must not regress;
- defining local and Vercel Preview visual QA;
- defining future PR acceptance and rejection rules;
- recording current baseline gaps without fixing them.

### 2.2 Out of scope for R0

- product or UI implementation;
- API, data-loading, cache, or performance changes, including B3.4 `dashboard.layout-data`;
- financial calculations, formulas, chart series, exchange-rate behavior, or metric changes;
- Supabase schema, RLS, migrations, data persistence, or production data changes;
- authentication, login, session, middleware, redirect, or permission changes;
- Vercel configuration or environment changes;
- adding a UI, icon, chart, form, motion, or visual-regression library;
- deleting or deprecating existing components;
- creating screenshot-only code paths, debug flags, or fixture APIs in product code.

### 2.3 Baseline principles

1. Use the real FinTrack route, component, and state behavior.
2. Use a dedicated non-production QA account with synthetic financial data.
3. Never capture or publish real customer names, emails, account numbers, balances, documents, or uploaded files.
4. Do not mutate production to manufacture a screenshot state.
5. Simulate latency and recoverable failures through browser/network tooling, not product-code changes.
6. Capture before and after with the same data, browser, viewport, theme, route, state, and scroll position.
7. A baseline screenshot freezes behavior and content structure; it does not require preserving weak visual styling.
8. Light and dark mode ship together.
9. One module is redesigned per PR, except approved shared-foundation or shell prerequisites.
10. Missing state behavior is logged as a gap and handled in a separate stability PR when code behavior must change.

## 3. Baseline environment and data contract

### 3.1 Capture metadata

Every screenshot pack must record:

- source commit SHA and branch;
- capture date and timezone (`America/Lima`);
- local or Vercel Preview URL;
- browser name and version;
- operating system;
- viewport width and height;
- device scale factor;
- browser zoom;
- theme;
- QA account identifier, using a non-sensitive alias;
- state recipe and any intercepted request;
- whether the screenshot is viewport-only, scrolled section, or full-page.

The approved R0 pack must originate from the merged `main` baseline above or a newer explicitly recorded `main` SHA captured before the first redesign implementation. Future PRs must not compare a new Preview against an undocumented moving baseline.

### 3.2 QA account requirements

Use a dedicated test user in an approved local/Preview environment. The populated account should contain enough synthetic data to exercise the real UI:

- active and inactive portfolio accounts in PEN and USD;
- at least one account without a bank entity and one credit-card technical account;
- enough transactions to show pagination, categories, dates, positive/negative direction, selection, and saved views;
- income, expense, transfer, asset-purchase, receivable issue/collect, and payable issue/pay transaction paths;
- one credit card with billing cycles and one bank loan with installments;
- active and inactive assets with asset types and valuation context;
- healthy, near-limit, over-limit, active, and inactive budget/period examples;
- a debtor with pending and collected entries and a creditor with pending and paid entries;
- recurring templates of more than one transaction type;
- critical and operational alerts, including read and unread records;
- custom and system admin catalog records;
- profile, preferences, accounts, and export/import views with synthetic data only.

Use a separate empty QA account, or an approved isolated reset of a disposable account, for true-empty states. Do not delete useful QA or production records merely to capture an empty screen.

### 3.3 Content-stress data

At least one screenshot per affected module must include:

- a long bank/account/category/counterparty/budget name;
- PEN and USD values;
- a large value, a small decimal value, zero, and a negative value where the module supports them;
- due, overdue, inactive, or high-utilization semantic status where applicable;
- enough rows to expose table alignment and pagination;
- text that wraps to two lines without truncating essential meaning.

## 4. Protected route matrix

The current repository contains 23 protected `page.tsx` routes. Redirect-only and gated routes are included because route behavior is part of the acceptance contract.

| ID | Route | Actual screen or behavior | Required baseline surfaces |
| --- | --- | --- | --- |
| R01 | `/dashboard` | `DashboardClient` / `DashboardWorkspace` | Overview plus Transacciones, Presupuestos, Créditos, Cobros y pagos, and Ahorro y patrimonio tabs |
| R02 | `/portfolio` | `PortfolioManager` | List, cards, filters, create/edit, deactivate/delete confirmation, technical-account context |
| R03 | `/transactions` | `TransactionsWorkspace` and `TransactionTable` | Populated table, filters, selection, saved views, export, create selector/form, edit/delete overlays |
| R04 | `/transactions/new` | Redirects to `/transactions?new=transaction`, preserving safe query values | Redirect result and opened operation selector; no duplicate page design |
| R05 | `/transactions/[id]` | Server detail plus `TransactionDetailClient` | Populated detail, related module context, edit/delete actions, not-found behavior |
| R06 | `/credits` | `CreditsWorkspace` / `CreditsListPanel` | List, cards, type selector, card form, loan form, schedules, edit/delete |
| R07 | `/credits/[id]` | Server credit detail | Card detail, loan detail with installments, not-found behavior |
| R08 | `/assets` | `AssetsWorkspace` / `AssetsListPanel` | List, cards, filters, create/edit, upload/comprobante, delete confirmation |
| R09 | `/assets/[id]` | Server asset detail | Populated detail, related transaction, actions, not-found behavior |
| R10 | `/budgets` | `BudgetsManager` | Series view, period view, filters, create/edit, progress states, budget detail overlay, delete confirmation |
| R11 | `/receivables` | `ReceivablesManager` | Debtor list/cards, create debtor, issue receivable, collect, drawer/detail, edit/delete |
| R12 | `/receivables/[id]` | Server receivable detail | Populated detail, related transaction, actions, not-found behavior |
| R13 | `/payables` | `PayablesWorkspace` | Creditor list/cards, create creditor, issue payable, pay, drawer/detail, edit/delete |
| R14 | `/payables/[id]` | Server payable detail | Populated detail, related transaction, actions, not-found behavior |
| R15 | `/recurring` | `RecurringWorkspace` | List, cards, filters, create/edit, use, delete confirmation |
| R16 | `/alerts` | `AlertsWorkspace` | Risk inbox, read/unread and severity filters, navigation, bulk actions, manual-rule modal |
| R17 | `/settings` | Settings workspace | `profile`, `security`, `preferences`, `notifications`, `accounts`, `export`, and `support` query tabs |
| R18 | `/admin` | `AdminWorkspace` | `banks`, `currencies`, `categories`, and `asset-types` query tabs, CRUD modals, system/protected records |
| R19 | `/admin/icon-studio` | Gated legacy redirect | With developer tools enabled, redirects to `/developer/bank-icons`; otherwise not found |
| R20 | `/developer` | Gated `DeveloperWorkspace` | Available and disabled/“Próximo” tool cards; local-only environment banner |
| R21 | `/developer/bank-icons` | Gated `BankIconStudio` | Upload, crop/preview, asset states, and local-only context when enabled |
| R22 | `/developer/control-center` | Gated `DeveloperControlCenter` | Global maintenance and module-status editor presentation when enabled |
| R23 | `/module-status/[moduleKey]` | `AppStateScreen` or redirect | Live redirects to the module; maintenance, coming-soon, and launch visuals are conditional fixture states |

### 4.1 Route coverage rules

- R01–R18 are production-user baseline routes and require steady-state coverage.
- R19–R23 are conditional/gated. They require behavioral verification in every affected shell/status PR and screenshots only in an approved environment where the state already exists.
- Dynamic detail routes use synthetic fixture IDs recorded in the capture manifest.
- A detail route that redirects, returns not found, or requires a gate is not replaced with a fabricated screenshot.
- `/login` is outside `app/(dashboard)`, but it remains an auth-regression sentinel because every protected route depends on it.

## 5. State definitions and safe capture recipes

| State | Contract | Safe capture recipe |
| --- | --- | --- |
| Loading | Initial content is absent and geometry-matching feedback appears promptly | Clear browser cache for the relevant request, reload the route, and capture the first stable skeleton frame |
| Slow loading | The loading state remains understandable, bounded, and free of content collapse | Delay only the relevant request to just below its current timeout; separately exceed the timeout to verify recovery, without changing code |
| Empty | The underlying approved QA dataset has no records and the screen explains the valid next action | Use the dedicated empty QA account; never delete production data for capture |
| Filtered empty | Records exist, but a search/filter combination returns none and offers reset/recovery | Use an impossible search term or mutually exclusive existing filters, then capture the reset affordance |
| Populated | Realistic synthetic records, summaries, actions, pagination, and status semantics render | Use the populated QA account and record the exact dataset revision/date |
| Recoverable error | A visible error explains failure and offers retry without an infinite loader | Block or return a safe test 500 for the module's read request, capture the error, then restore the request and prove retry works |
| Stale data plus warning | Previously loaded data remains visible while refresh/revalidation failure is clearly communicated | Warm the screen, block its next read request, trigger refresh/filter revalidation, and capture retained data plus warning |
| Disabled/pending | An unavailable, protected, submitting, or future action is visibly non-interactive and understandable | Use existing saving/busy states, protected system records, unavailable selector options, support/developer “Próximo” states, or current module-status fixtures |

Network simulation must use browser DevTools, Playwright routing, or an approved proxy in the QA environment. It must not add product-code toggles or mutate API behavior in the repository.

## 6. Module/state matrix

Legend:

- **M** — mandatory representative capture for the module before its redesign.
- **S** — supported as a subview/widget/action state; capture when that subview is in PR scope.
- **G** — known current gap; document it and create a separate stability decision before changing behavior.
- **—** — not meaningful for the current screen.

| Area | Loading | Slow | Empty | Filtered empty | Populated | Recoverable error | Stale + warning | Disabled/pending |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Authenticated shell | S: layout fallback | M: protected-route transition | — | — | M: expanded/collapsed/drawer | S: global route error | G: nav-badge failure is silent | M: menus, logout busy, announcements |
| Dashboard | M: workspace skeleton | M: summary/modules delay | S: widget no-data states | S: chart/range no-data only | M: all six tabs | M: initial critical-data error + retry | G: refresh failure with seed has no workspace warning | M: refresh button busy |
| Portfolio | M | M: accounts/banks/currencies | M: empty account | M: search/currency/type/bank/status | M: list and cards | M: accounts failure + retry | M: accounts retained while bank/currency reload warns | M: technical fields, busy actions, confirmations |
| Transactions | M: table rows | M: transaction list/filter options | M: no transactions | M: search/account/category/date/preset | M: table, pagination, selection | S: preload/filter-options errors; **G** for list-fetch error | G: refresh indicator exists, but list error is not surfaced | M: saved-view delete, export, bulk/delete busy |
| Transaction create/edit | S: option/subform loading | S | S: missing account/category options | — | M: selector plus every operation path | M: validation/submit error | S: preload warning with usable form | M: submit, unavailable options, nested modal busy |
| Credits | M | M: credits/bank options | M | M: search/type/bank/status | M: list/cards, card and loan | M: data/action error + retry | M: retained SWR data plus error | M: action busy, missing bank/account, schedule disabled |
| Assets | M | M: assets/types | M | M: search/type/date/status | M: list/cards/form/detail | M: data/action error + retry | M: retained SWR data plus error | M: missing account/type, upload/action busy |
| Budgets | M: series and period | M: budgets/categories/periods | M: no budgets | M: currency/period/category/search | M: series, periods, detail | M: list or period error + retry | M: retained list plus reload warning | M: saving, row action, confirmation |
| Receivables | M | M: `/api/debtors` | M | M: search/status | M: list/cards/drawer/ledger | M: error + retry | M: retained debtors plus reload warning | M: row action, forms, confirmation |
| Payables | M | M: `/api/creditors` | M | M: search/status | M: list/cards/drawer/ledger | M: error + retry | M: retained creditors plus reload warning | M: row action, forms, confirmation |
| Recurring | M | M: `/api/recurring` | M | M: search/type/portfolio | M: list/cards/create/edit/use | M: error + retry | M: retained templates plus reload warning | M: use/edit/delete busy and confirmation |
| Alerts | M | M: `/api/alerts` | M | M: severity/read/module/search | M: read/unread and priority mix | M: error + retry | M: retained alerts plus refresh warning | M: bulk actions, rule-title validation, saving |
| Admin catalogs | M: each tab | S: active catalog request | M: custom catalog empty where safe | M: search/status per manager | M: all four tabs | M: catalog error + retry | S: retained catalog plus action/load error | M: system/protected records and busy actions |
| Settings | G: no route-specific initial loader | G: server preload waits before render | S: accounts/export initial state | — | M: all seven tabs | S: action errors/toasts | M: profile/accounts preload warnings with usable data | M: profile lock, security validation, support pending, import/export busy |
| Detail routes | G: no protected route `loading.tsx` | G | — | — | M: transaction/credit/asset/receivable/payable | G: not-found replaces an inline retry state | — | S: edit/delete busy and unavailable actions |
| Module status/developer | — | — | — | — | S: enabled local tools | — | — | M: maintenance/coming-soon/launch and “Próximo” cards |

### 6.1 Known baseline gaps

The following are audit findings, not authorization to fix them inside a redesign PR:

1. The protected route tree has no route-level `loading.tsx` or route-level error boundary. Individual workspaces and the shared layout provide inconsistent coverage.
2. Dashboard initial failure is recoverable, but a refresh failure after seed data exists is not presented as a workspace-level stale warning.
3. `useTransactions` exposes `error`, but `TransactionTable` does not currently render the list-fetch error. It renders filter-option and preload warnings instead.
4. Dynamic detail routes use server redirect/not-found behavior and do not provide an inline recoverable error state.
5. Settings handles profile/account failures through partial preload warnings but has no route-specific initial skeleton while its server preload is pending.
6. Shell navigation-badge refresh failures are intentionally non-retrying and currently have no visible stale/error message.

If a future visual scope requires behavior that does not exist, open a separate stability task and PR. Do not hide the behavior change inside CSS or component migration.

## 7. Viewport matrix

| ID | Viewport | Primary FinTrack risk | Mandatory checks |
| --- | --- | --- | --- |
| V1 | 375 × 812 | Mobile topbar, drawer, fixed FAB, cards, forms, overlays | Drawer closed/open, no obscured content, single-column financial hierarchy, full-width modal/drawer actions |
| V2 | 768 × 1024 | `md` breakpoint activates static sidebar; tablet density | Sidebar/content balance, tabs and controls, modal height, table-to-record transition |
| V3 | 1024 × 768 | Small-laptop vertical pressure and crowded topbar/toolbars | Sidebar mode, topbar actions, filter wrapping/disclosure, sticky areas, charts above fold |
| V4 | 1280 × 800 | Canonical desktop operational view | Tables, list/card parity, form columns, overlay sizing, dashboard widget rhythm |
| V5 | 1440 × 900 minimum | Max-width and wide-canvas behavior | 1320/1440px containers, chart/table stretch, whitespace, sidebar-to-content proportion |
| V6 | 1280 × 800 at 200% browser zoom | Effective narrow layout and accessibility reflow | No lost controls, clipped focus, hidden actions, overlapping fixed regions, or two-dimensional page scrolling |

Additional rules:

- Use device scale factor 1 for comparable desktop screenshots.
- At 1440+, also inspect one available wider monitor size; V5 remains the comparison artifact.
- At 200% zoom, use pass/fail evidence rather than pixel-level comparison.
- Full-page screenshots supplement, but never replace, viewport screenshots that show the initial hierarchy.
- Wait for fonts and entry animation to settle before capture; do not disable motion through product code.

## 8. Theme matrix

| Surface | Light | Dark | Acceptance requirement |
| --- | --- | --- | --- |
| Shell/navigation | Required | Required | Active route, menus, focus, badges, drawer, and overlay contrast |
| Every production route steady state | Required | Required | Same information/actions and no theme-specific layout change |
| Loading/skeleton | Required in affected PR | Required in affected PR | Geometry and contrast remain visible without excessive shimmer |
| Empty/filtered empty | Required in affected PR | Required in affected PR | Message, illustration/icon, reset/create action remain legible |
| Error/stale warning | Required in affected PR | Required in affected PR | Danger/warning is not color-only and retry remains prominent |
| Forms and validation | Required in affected PR | Required in affected PR | Labels, fields, help, errors, disabled and focus states pass |
| Modals/drawers/menus/tooltips | Required in affected PR | Required in affected PR | Backdrop, surface, scroll, stacking, and focus work in both themes |
| Charts/status/progress | Required in affected PR | Required in affected PR | Axes, legend, tooltip, thresholds, and series remain distinguishable |
| Detail pages | Required | Required | No hard-coded dark-only text/border assumptions remain after migration |

Theme persistence is part of the contract: toggle theme, navigate between protected routes, reload directly, and confirm the selected theme returns without a damaging flash.

## 9. Core flow regression matrix

All data-changing checks use disposable synthetic records in the approved QA environment. The before and after flow must produce identical financial values and persistence results.

| ID | Flow | Required invariant and evidence |
| --- | --- | --- |
| F01 | Login/session continuity | Unauthenticated deep link redirects to `/login?next=...`; valid login returns safely; authenticated refresh/direct navigation works; `/login` redirects authenticated user away; theme/session persist; logout reaches login |
| F02 | Dashboard load | Cold and warm load resolve; all six tabs remain keyboard/click accessible; refresh works; metrics, chart series, currencies, labels, and risk meaning are unchanged |
| F03 | Portfolio registry | List/cards show the same accounts; search and currency/type/bank/status/technical filters work; create via `/portfolio?new=portfolio`; edit preserves bank/currency; deactivate/reactivate/delete confirmations retain rules |
| F04 | Transactions list | Quick filters, search, account/category/date, sort, per-page, pagination, selection, bulk actions, row actions, and reset remain available |
| F05 | Transaction saved views/export | Save/apply/delete local saved view; open export; load export metadata; select year/portfolio/format; validation and download behavior remain unchanged |
| F06 | Transaction create/edit selector | `/transactions/new` opens selector through redirect; income, expense, transfer, asset purchase, receivable issue/collect, and payable issue/pay reach the correct form; edit retains defaults and validation |
| F07 | Credits | List/card parity; create card and loan paths; bank/account unavailable states; card billing cycles; loan installment schedule; edit/deactivate/reactivate/delete and details retain behavior |
| F08 | Assets | List/card/filter parity; create/edit preserves type/account/value/date; file validation and attachment presentation; deactivate/reactivate/delete; detail navigation |
| F09 | Budgets | Series and period views; filters; create/edit; healthy/near/over progress; open detail; period rows; deactivate/reactivate/delete retain calculations and labels |
| F10 | Receivables | Create/edit debtor; issue receivable; collect against pending entry; list/card parity; open drawer and detail; filters; linked portfolio remains visible; delete rules remain |
| F11 | Payables | Create/edit creditor; issue payable; pay pending entry; list/card parity; open drawer and detail; filters; linked portfolio remains visible; delete rules remain |
| F12 | Recurring | List/card/filter parity; create/edit; use template opens the correct transaction context; delete confirmation and busy/error states remain |
| F13 | Alerts | Read/unread toggle; severity/read/module/search filters; navigation target; bulk actions; manual-rule validation/save behavior remain exactly as implemented |
| F14 | Settings profile/preferences | Profile data/avatar controls, theme, currency, private-mode presentation, preload lock/warnings, and save feedback remain unchanged |
| F15 | Settings security/export | Password validation, reset cooldown, sign-out-all, delete-account confirmation, export download, import analyze/commit/report/rollback states remain unchanged; never execute destructive checks outside disposable QA |
| F16 | Admin catalogs | All four tabs, search/filter, create/edit, system-record restrictions, deactivate/delete confirmation, and icon identity remain available |
| F17 | Shell/navigation | Every live sidebar link, topbar quick create, profile/theme menu, mobile drawer, collapsed sidebar, release gate, update banner, and QuickActionsFAB action remains functional or clearly disabled |
| F18 | Detail pages | Direct load, back navigation, related financial context, edit/delete actions, and not-found behavior remain unchanged across transaction, credit, asset, receivable, and payable details |

Existing Playwright coverage already provides useful regression anchors in `authenticated-smoke`, `authenticated-transactions`, `authenticated-saved-views`, `authenticated-quick-create`, and `authenticated-management`. Future redesign PRs must use the relevant existing tests; R0 does not change or run them.

## 10. Manual screenshot capture checklist

### 10.1 Naming and capture rules

Use:

`R0_<route-id>__<surface>__<state>__<viewport-id>__<theme>.png`

Example:

`R0_R02__portfolio-list__populated__V4__light.png`

For every capture:

- [ ] Use the recorded baseline SHA and QA dataset.
- [ ] Hide or replace sensitive browser UI and personal identifiers.
- [ ] Wait for `document.fonts` and visible animations to settle.
- [ ] Keep browser zoom at 100%, except V6.
- [ ] Reset scroll to the agreed position.
- [ ] Close unrelated DevTools panels and browser extensions.
- [ ] Include overlay trigger context when capturing a modal/menu/drawer.
- [ ] Record intentional dynamic content such as current date, alert count, or exchange-rate timestamp.
- [ ] Do not compare screenshots made with different records or currencies.

### 10.2 Shell baseline pack

- [ ] V5 light/dark: expanded sidebar, topbar, active route, update banner if present, and FAB closed.
- [ ] V3 light/dark: small-laptop shell with topbar actions and representative dense module content.
- [ ] V2 light/dark: static sidebar at the `md` boundary.
- [ ] V1 light/dark: drawer closed, drawer open, FAB open, topbar quick-create menu, and profile menu.
- [ ] V4 light/dark: collapsed sidebar and tooltip state.
- [ ] Announcement/release modal in both themes when the existing gate is active.

### 10.3 Dashboard baseline pack

- [ ] Each of the six dashboard tabs at V4 in light and dark.
- [ ] Overview at V1, V2, V3, and V5 in both themes.
- [ ] Workspace loading, slow loading, and initial recoverable error at V4 in both themes.
- [ ] Widget no-data/error examples for each widget family that currently supports them.
- [ ] Chart hover tooltip/range state for Money Flow, Saldos, Cash Flow Projection, budgets, credits, and wealth widgets.
- [ ] Refresh button busy state and the current stale-warning gap recorded in the manifest.

### 10.4 Portfolio and transaction baseline pack

- [ ] Portfolio list and cards, populated, V1/V4, light/dark.
- [ ] Portfolio true empty, filtered empty, loading, error, and stale-data warning.
- [ ] Portfolio create, edit, deactivate confirmation, delete confirmation, and technical-account disabled fields.
- [ ] Transactions populated table at V1/V3/V4/V5, light/dark.
- [ ] Transaction true empty, filtered empty, loading, filter-options error, and preload warning.
- [ ] Transaction row selection/bulk toolbar, pagination, saved-view menu/modal/delete confirmation.
- [ ] Export modal: initial, metadata loading/warning, invalid selection, and ready state.
- [ ] Operation selector and each of the eight operation paths at V1 and V4; capture representative simple and module-specific form layouts in both themes.
- [ ] Transaction edit and delete confirmation; transaction detail at V1/V4 in both themes.

### 10.5 Registry and ledger module baseline pack

- [ ] Credits list/cards, true/filtered empty, loading/error/stale, type selector, card form/schedule, loan form/schedule, edit/delete, card and loan details.
- [ ] Assets list/cards, true/filtered empty, loading/error/stale, create/edit/upload, delete, and detail.
- [ ] Budgets series/period views, true/filtered empty, loading/error/stale, create/edit, healthy/near/over-limit examples, detail overlay, and delete.
- [ ] Receivables list/cards, true/filtered empty, loading/error/stale, debtor form, issue/collect forms, drawer ledger, delete, and route detail.
- [ ] Payables list/cards, true/filtered empty, loading/error/stale, creditor form, issue/pay forms, drawer ledger, delete, and route detail.
- [ ] Recurring list/cards, true/filtered empty, loading/error/stale, create/edit/use, busy state, and delete confirmation.
- [ ] For each module above: V1 and V4 populated light/dark plus V6 at 200% zoom; add V2/V3/V5 when the module PR changes breakpoint behavior.

### 10.6 Alerts, admin, and settings baseline pack

- [ ] Alerts populated mix of critical/operational and read/unread; true/filtered empty; loading/error/stale; bulk busy; rule modal valid/disabled states; V1/V4 light/dark.
- [ ] Admin banks, currencies, categories, and asset-types tabs at V4 light/dark; one tab at V1/V2; loading/empty/error; create/edit/delete; protected system-record disabled state.
- [ ] Settings profile, security, preferences, notifications, accounts, export, and support tabs at V1/V4 light/dark.
- [ ] Profile/accounts partial preload warning, profile locked state, avatar busy/error, preference saving, password mismatch/strength, reset cooldown, and delete-account confirmation.
- [ ] Export/import initial, analyzing, warnings/errors, ready-to-import, importing, committed, failed, and rollback presentation using disposable QA data.
- [ ] Support and any “Próximamente/Pendiente” controls visibly non-interactive.

### 10.7 Conditional route pack

- [ ] Developer landing at V1/V4 light/dark when the existing environment gate is enabled.
- [ ] Bank icon studio and control center in the gated local environment.
- [ ] `/admin/icon-studio` redirect or not-found behavior, matching the active gate.
- [ ] `AppStateScreen` maintenance, coming-soon, and launch variants only when an approved fixture provides them.
- [ ] Live `/module-status/[moduleKey]` redirects to the module and does not show a duplicate status page.

## 11. What “approved visual baseline” means

The R0 baseline is approved only when:

1. Every production route and conditional route behavior in the route matrix has an owner-reviewed entry.
2. Required steady-state screenshots exist in light and dark at their mandatory viewports.
3. Each module has representative loading, slow, empty, filtered-empty, populated, recoverable-error, stale-warning, and disabled/pending evidence where applicable.
4. Known gaps are explicitly marked and are not disguised as passed states.
5. The QA dataset and capture metadata are recorded and contain no sensitive data.
6. Core-flow regression evidence confirms the current fields, actions, filters, views, values, and routes.
7. The owner labels observed elements as one of:
   - **Preserve:** information, behavior, or product pattern that must survive.
   - **Redesign:** visual treatment expected to change.
   - **Gap:** missing/inconsistent state requiring a separate decision.
   - **Approval required:** behavior, terminology, route, or dependency decision outside visual scope.
8. The owner confirms the baseline captures the real app, not an isolated component demo.

Approval does not mean the current screen is visually good. It means reviewers agree on what exists, what must not regress, and what evidence will prove the redesign is complete.

## 12. Future PR evidence requirements

### 12.1 Module PR

Every module redesign PR must include:

- the exact approved before screenshots for that module;
- matching after screenshots from Vercel Preview;
- light and dark coverage;
- V1, V4, V6, and every breakpoint materially affected;
- all supported state variants affected by the diff;
- modal/drawer/menu screenshots where changed;
- a core-flow regression result;
- financial-value parity confirmation;
- an annotated list of intentional visual differences;
- known unrelated baseline gaps, unchanged and linked;
- exact rollback commit/PR instructions.

### 12.2 Shared foundation or primitive PR

A shared foundation PR must include a consumer sentinel pack, not only a component sample:

- shell/navigation;
- dashboard widget/chart;
- transaction table/filter;
- portfolio registry/card/form;
- one detail page;
- one modal and one drawer;
- settings row/form;
- loading, empty, error, warning, focus, disabled, and destructive states.

If a shared change affects more consumers, its screenshot pack expands accordingly.

### 12.3 Shell PR

A shell PR must show the shell around at least Dashboard, Transactions, Portfolio, one detail page, Settings, and Admin at V1–V6 in both themes. It must also show drawer, sidebar modes, topbar menus, QuickActionsFAB, update/announcement surfaces, and content clearance.

## 13. Local QA checklist

### Scope and safety

- [ ] Diff contains only the approved redesign batch.
- [ ] No unrelated module, bug fix, feature, or refactor is included.
- [ ] No API, calculation, Supabase, auth, middleware, redirect, Vercel, or environment file changed.
- [ ] No existing action, field, filter, view mode, table column, chart, route, or status disappeared.
- [ ] No sensitive data appears in screenshots, logs, or fixtures.

### Visual comparison

- [ ] Before/after use identical data, route, state, viewport, zoom, theme, and scroll position.
- [ ] All intentional differences are annotated.
- [ ] Page hierarchy matches the master plan: one title context, one primary action, one primary data region.
- [ ] No new unnecessary card-inside-card hierarchy appears.
- [ ] New work uses approved `--ft-*` tokens and does not invent local color/radius systems.
- [ ] Financial values use stable alignment and tabular numerals where required.
- [ ] Positive/negative direction and risk are not conflated.
- [ ] Teal and semantic colors retain their approved meanings.
- [ ] Long names, large values, multiple currencies, and wrapped text remain readable.

### Responsive and zoom

- [ ] V1–V5 pass for the affected screen.
- [ ] V6 passes at 200% zoom.
- [ ] No required page has ordinary two-dimensional scrolling.
- [ ] Tables transform into deliberate mobile records without losing essential fields/actions.
- [ ] Sticky topbar/footer, sidebar/drawer, FAB, menus, and overlays do not cover content.
- [ ] Modals/drawers remain scrollable with headers/actions reachable.
- [ ] Selects, tooltips, menus, chart tooltips, and date controls do not clip.

### States and behavior

- [ ] Loading feedback appears promptly and resembles final geometry.
- [ ] Slow loading remains bounded; timeout resolves to a visible recoverable state.
- [ ] Empty and filtered-empty are distinct and offer the correct create/reset action.
- [ ] Recoverable errors explain failure and retry successfully.
- [ ] Stale data remains usable and is paired with a warning where current behavior supports it.
- [ ] Disabled/pending controls cannot activate and explain their state when necessary.
- [ ] No infinite spinner, skeleton, or busy button remains after failure.
- [ ] Create/edit/delete/confirm/retry/filter/reset/pagination/view-toggle behavior is unchanged.
- [ ] Financial calculations and displayed values are identical for the same data.

### Interaction and accessibility

- [ ] Keyboard-only primary flow succeeds.
- [ ] Focus order follows visual order; focus-visible is never clipped.
- [ ] Escape and outside click behave consistently; unsaved work is not discarded unexpectedly.
- [ ] Closing a menu/modal/drawer restores focus to its trigger.
- [ ] Touch targets meet 44px where touch use is expected.
- [ ] Icon-only actions have accessible names.
- [ ] Form labels, help text, and errors remain associated.
- [ ] Tabs/segmented controls expose selection and support keyboard navigation.
- [ ] Reduced motion removes non-essential movement.
- [ ] Text, focus, controls, and semantic states meet WCAG AA contrast.
- [ ] Console shows no new errors, warnings, or hydration issues in the tested flow.

## 14. Vercel Preview checklist

- [ ] Preview build succeeds with existing configuration.
- [ ] Base/head and PR diff match the approved module batch.
- [ ] Preview uses approved non-production environment variables and synthetic QA data.
- [ ] Authenticated non-admin flow passes; admin flow passes when relevant.
- [ ] Unauthenticated direct route redirects correctly and session continuity is unchanged.
- [ ] Direct load and refresh work for every affected route/detail route.
- [ ] Cold and warm load screenshots match the approved state recipes.
- [ ] Light/dark persistence and initial render do not produce a damaging theme flash.
- [ ] V1–V6 are rechecked in Preview, not assumed from local behavior.
- [ ] Current Chrome, Safari/WebKit, and Firefox are checked for the affected high-value flow.
- [ ] At least one real mobile device or device browser verifies touch, drawer, modal scroll, and fixed controls.
- [ ] Fonts, images, bank icons, uploaded-file placeholders, and charts load without layout breakage.
- [ ] No failed assets, unexpected requests, console errors, or hydration warnings appear.
- [ ] Existing relevant Playwright checks pass.
- [ ] Before/after artifacts and intentional-difference notes are attached to the PR.
- [ ] Owner reviews the deployed screen using the real app flow.
- [ ] Exact revert path and production smoke steps are written before merge.

## 15. PR acceptance rules

A future redesign PR may be approved only when all are true:

1. The PR is one module or one approved shared prerequisite.
2. Its diff is visual/presentational and respects all master-plan guardrails.
3. Before and after evidence is complete and comparable.
4. Both themes and all affected viewports/states pass.
5. Core flows, financial values, fields, actions, filters, charts, and routes retain parity.
6. The migrated scope uses the final approved visual language; it is not incremental polishing of the old style.
7. Current baseline gaps are either unchanged and documented or resolved in a separate stability PR.
8. No new library, route/IA change, terminology change, field removal, or behavioral change appears without explicit owner approval.
9. Local and Vercel Preview checklists are complete.
10. The PR has a precise rollback path and owner visual approval.

## 16. Strict rejection criteria

Reject a future redesign PR if any of the following is true:

- it mixes redesign with bug fixing, refactoring, performance work, or a new feature;
- it changes API contracts, financial calculations, Supabase, auth/session/middleware, redirects, Vercel config, or `.env` files without separate explicit approval;
- it includes B3.4 `dashboard.layout-data` work;
- it redesigns more than one operational module in the same PR;
- it lacks matching before/after screenshots or uses different data, viewport, theme, or state;
- it tests only light mode, only dark mode, or only desktop;
- V1, V2, V3, V4, V5, or relevant 200% zoom behavior has clipped, hidden, overlapping, or unreachable content;
- it removes or hides a current route, action, field, filter, saved view, view mode, table column, chart, or status without approval;
- any financial value, currency, date, formula result, chart series, threshold, or semantic meaning changes;
- a loading state can become infinite or no longer resembles final geometry;
- empty, filtered-empty, error, stale-warning, disabled, or pending states are missing where the affected scope requires them;
- an error has no recovery path where one exists in the baseline;
- stale data looks current or trustworthy without a warning where the baseline supports a warning;
- keyboard focus, escape, focus return, touch target, label association, contrast, or reduced-motion behavior regresses;
- a dropdown, tooltip, chart tooltip, modal, drawer, sticky footer, topbar, sidebar, or FAB clips or covers essential content;
- it introduces new hard-coded theme colors, arbitrary radii, token namespaces, decorative bounce/ping, or unnecessary nested surfaces contrary to the master plan;
- it introduces a new library or changes brand/font/navigation decisions without owner approval;
- visible actions look enabled but do nothing, or pending behavior is not explicit;
- Vercel Preview is unavailable, failing, materially different from local, or unreviewed;
- the PR has no rollback plan or contains cleanup/deletion before consumer proof.

## 17. Rollback expectations

- Every redesign batch must be independently revertible at PR level.
- The PR description must identify the last known-good commit and the exact revert target.
- Shared primitives keep compatibility props/aliases until every consumer is migrated and verified.
- Do not delete the old implementation in the same PR that first introduces its replacement when rollback would become difficult.
- If Vercel Preview fails visual or functional acceptance, do not merge; restore the branch by reverting only the redesign commit(s).
- If a regression is found after merge, revert the latest affected redesign PR first. Do not combine the rollback with a new redesign or unrelated fix.
- Because redesign PRs must not contain data/schema migrations, rollback remains code-only and must not require financial-data repair.
- Re-run the affected baseline sentinel pack after rollback to prove the previous experience is restored.

## 18. R0 completion criteria

R0 is complete when:

- this contract is approved by the owner;
- a manual sanitized screenshot pack is captured from the recorded `main` baseline before Phase 1 code begins;
- the capture manifest records route, state, viewport, theme, and data revision;
- known gaps have tracking decisions and are not assigned implicitly to redesign PRs;
- the owner confirms the pack represents the real FinTrack experience and the required non-regression flows;
- no product or UI code was changed to create the contract.

## 19. Resumen simple en español

Este documento define exactamente qué pantallas, estados y funciones de FinTrack deben revisarse antes y después de cada cambio visual. Incluye las rutas reales de la aplicación, celular, tablet, laptop, escritorio, zoom al 200%, modo claro y modo oscuro.

Las capturas deben hacerse con una cuenta de prueba y datos ficticios. Nunca se deben publicar datos financieros reales. También se revisarán cargas, errores, pantallas vacías, filtros sin resultados, datos antiguos con aviso y botones deshabilitados.

El rediseño podrá cambiar la apariencia, pero no podrá eliminar funciones, cambiar cálculos, modificar datos, alterar la seguridad ni romper los flujos actuales. Si un PR no incluye las capturas correctas, falla en móvil o modo oscuro, cambia valores financieros o mezcla otros trabajos, debe ser rechazado.

R0 no implementa el rediseño. Solo crea el contrato de revisión que permitirá avanzar con seguridad y revertir cada etapa por separado si aparece un problema.
