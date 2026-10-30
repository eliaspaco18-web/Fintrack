# FinTrack V3 Round 05 — Operational Handoff for GPT-5.6 Sol

**Status: implementation specification, awaiting owner design and execution approval. Do not start production implementation merely because this file exists.**

Date: September 22, 2026. Design baseline: `4fdbe715f1a887ff59fc64868bf2da06c2d0cdae`, `codex/redisenio-total`. This mission changed only documentation and isolated design artifacts. No commit, deployment, API, auth, data or Supabase change is included.

## 0. Start here, not with another design exploration

1. Read `CODEX_RULES.md`, applicable `AGENTS.md`, current QA/stability documents and the owner's explicit approval. Record approved V1/V2/V3 and each separately authorized S/O package.
2. Read master-plan sections 3–8 for locked visual/financial behavior, especially sections3.3,4.3–4.5 and7.1; section9 for the current module, including round05 credit contract9.5.1 and selection/action contracts6.1/6.6, section10 for gates, and sections11–12 for sequence/acceptance. The master plan is the source of truth. This file is the execution map.
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

- Direction: **Connected Financial Clarity**, recognizable FinTrack rather than a generic dashboard. White/cool-neutral material, deep teal controls and semantic green, restrained gold in FT12; light default, neutral graphite dark surfaces with teal accents. Manrope400/600/700, tabular financial numerals.
- Brand: preserve exact FT12 paths. Copy approved SVG assets from `docs/redesign-v3/preview/brand/` into the app's chosen asset location in a scoped brand PR; do not redraw, add an arrow or substitute a font monogram. Optical16/20px mono; full mark≥24px.
- Shell: desktop sidebar208↔68px with stationary32px FT mark, tablet68px rail with temporary208px label overlay, desktop/tablet topbar56px, mobile topbar52px. Horizontal page padding28/22/16px, content max1560px;40px padding≥1600. The28px proposal bar must never ship.
- Navigation: Inicio, Movimientos, Cuentas / Presupuestos, Créditos, Por cobrar, Por pagar / Activos, Plantillas / Avisos, Catálogos, Configuración. Preserve existing paths, gates, IDs and quick-create URL contracts.
- Mobile destinations: Inicio, Movimientos, Cuentas, Más. Registrar occupies a reserved right-hand dock slot (56px action, radius18, right12, bottom6 + safe-area), replacing the old center Registrar. No floating action over mobile amounts, second hamburger or duplicate generic Registrar. Desktop/tablet action52px, right/bottom24/20px.
- Inicio desktop: position/pending band → attention line → independent left report/recent stack and right agenda/budgets/credit stack. Ratio1.85:1, gap18px; internal stack gap16px. No equal-height KPI wall.
- Tablet: report full width; agenda/budgets side by side; recent full width; credit strip. Mobile: position, attention, exact monthly facts, collapsed analytical detail, agenda2 rows, budgets, recent, credit.
- Money: `S/ 1,234.50`, `US$ 1,234.50`, exact cents, comma grouping/decimal point; missing≠zero. Native position separate from report PEN and equivalents. Keep original currency and stored precision. No cross-currency netting.
- Movements rows48px desktop (reference48.5–49 with collapsed borders)/56px tablet; header34px target; amount right-aligned. Income green, expense red, transfer neutral, with existing sign/type semantics. Other two-line registers56px minimum; Credits68px desktop rich rows. Detail/filter/form580px with a stable shared frame, complex schedule form960px max. Mobile workbenches have8px gutters,24px corners and keyboard-safe near-full-height; confirmation is an auto-height bottom sheet.
- No health score, fabricated savings target, unqualified wealth hero/history, predictive confidence band, AI insight, bank sync claim or available-cash-plus-credit number.
- Rounds03–04 refine the established IA: rounded semantic surfaces6/10/14/18/24px; detached580px workbench; paired-flow inspection lens; contextual docking. Use the exact optical/mobile exceptions in master4.3. Read/edit/filters share one frame; do not restore the predecessor's520px square detail.
- Motion is meaningful and bounded:260ms enter/160ms exit workbench; independently timed veil/content; trigger-origin menus; no keyboard motion, animated financial values, page scaling or spring overshoot. Pointer module reveal is exactly three timing groups ending228ms after commit; no exit wait or per-row stagger.

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
| Forms and detail | `05-transaction-detail-drawer.png`, `06-transaction-edit-form.png`, `15-mobile-create-form.png`, `27-filter-drawer.png` |580px shared workbenches, amount-first hierarchy, dirty-dismiss protection, draft filters |
| Domain surfaces | `07-accounts-desktop-light.png`, `08-budgets-desktop-light.png`, `09-credits-desktop-light.png`, `18-obligations-currency-warning.png` | Native currency groups, exact period, credit-versus-loan, unverifiable opening balance |
| Connected investigation | `22-result-explanation.png`, `23-category-to-records.png`, `25-thirty-day-agenda.png`, `28-account-peek.png` | Summary → explanation → exact records → action;7/30 days and USD commitment |
| Identity | `21-ft-ligature-system.png`; `preview/brand.html` | Original Concept12 geometry, sizes, monochrome, dark, app icon |
| Round05 selection and action protocol | captures47–59; master6.1/6.6 | Natural credits, local mutation feedback, errors, searchable selection, mobile and dark |
| Availability | `12-dashboard-partial-error.png`, `13-first-use-mobile.png`, `17-loading-desktop.png` | Error≠empty≠loading, healthy neighbors retained |
| Refined chart/menu | `29-flow-inspection-tooltip.png`, `30-anchored-operation-menu.png` | Selected month must not change current-month summary; exact tooltip and all8 operations |
| Context/surfaces | `31-contextual-record-workbench.png`, `32-rounded-delete-confirmation.png`, `33-dark-record-workbench.png`, `34-mobile-record-workbench.png` | Record meaning, shared frame,24px corners, native currency, guarded changes |
| Natural credit register | `36-credits-scalable-register.png`, `37-loan-contextual-workbench.png`, `42-credits-tablet.png`, `44-credits-mobile.png` | List hierarchy, natural12-product example, selected loan components, tablet/mobile adaptation; stress2/40 through internal QA only |
| Round04 shell | `38-sidebar-compact-identity.png`, `43-tablet-navigation-expanded.png` | Stationary FT; compact active state, modal tablet labels, no narrowing |
| Round04 graphite/density | `39-dashboard-graphite-dark.png`, `40-dense-ledger-graphite.png`, `46-mobile-ledger-dense.png` | Neutral dark foundations, direction-colored amounts, denser records |
| Round04 quick action | `41-contextual-quick-actions.png`, `45-mobile-quick-actions.png`; `preview/evolution.js`/`evolution.css` | Eight operations, context, fixed safe placement, mobile dock slot |
| Motion | `preview/motion.html`, `35-motion-review-workshop.png`, `preview/refinement.js`, `preview/refinement.css` | Inspect live1× and reduced; screenshots cannot prove lifecycle or timing. Slow mode and workshop UI are review-only |

The simulator is not production code. Its array totals, name-based category lookup, hash routes, fake saves, limited filter form, fixed current date, toast-only actions and simplified validation must NOT be transplanted. Real implementation must preserve full existing filters, fields, relationships, attachments and mutation contracts. Record the gaps between illustrative interactions and actual existing behavior in the phase PR.

Archives `docs/redesign-v3/archive/round-4/` (immediate predecessor), `archive/round-3/` (earlier shell/material study), `archive/round-2/` (earlier teal proposal) and `archive/round-1/` (blue V3) are before-state evidence only. Never import its blue tokens, oversized rows or obsolete dashboard composition.

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
| `DetailDrawer` | Existing detail content,580px, trigger ref, return URL, sticky header/actions, exact record ID | Lose source scroll/filter/selection or replace direct detail routes |
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

### 4.1 Round03 build packet — implement before integrating any module

Do not copy `refinement.js`'s global function overrides or render-all event architecture. They are isolated review wiring, not an acceptable React design. Extract the following behaviors into the existing component tree in stage4/5. Suggested new paths are proposals, not claims that they already exist; reuse an equivalent owned primitive if present.

| Build order inside stages4/5 | Files / shared component | Exact work | Stop condition |
|---|---|---|---|
| A | `lib/tokens.ts`, scoped V3 CSS, optionally `lib/ui/motion.ts` | Master4.3 tokens and4.4 named curves/timings. Centralize motion policy: pointer + no reduced preference only. Keep old aliases until migration ends | Any global change leaks into unmigrated screens |
| B | Existing menu/select/popover primitives; proposed `components/ui/AnchoredPopover.tsx` only if needed | Collision-aware anchor origin,160/110ms, keyboard arrow/Escape behavior, menu ownership inside modal, restore trigger focus | New dependency or portal change breaks current focus/position contract; consult before broad replacement |
| C | Existing `components/ui/RecordModal.tsx`, `ModalOverlayPortal.tsx`, `components/detail/primitives.tsx`; proposed `components/detail/DetailDrawer.tsx` / internal `WorkbenchFrame` adapter |580px detached frame;24px corners; stable read/edit/filter geometry; independently scrolling body; content-sized footer. Keep existing submit handlers and contracts | A required current field/action cannot fit without changing the approved hierarchy |
| D | Shared overlay lifecycle hook / existing presence mechanism | Cancel-safe `closed/opening/open/closing`, current-pose interruption, generation guard, exit-before-unmount, background inert until current completion, immediate keyboard/reduced path | Any stale animation callback closes a newer view, draft is cleared early or background becomes interactive during exit |
| E | `TransactionDetailClient.tsx`, shared record header/summary/facts/context | Keep exact record identity, original amount, actual links/status. Read/Context tabs and visible-order previous/next. More→guarded delete. Source stays filtered/scrolled | Missing linkage/report-participation evidence; disclose unavailable, do not create a confidence/status claim |
| F | Shared form adapter, existing nested creation stack | Header back returns to same record; dirty back/dismiss/route guarded; parent draft retained. Footer reflects actual busy/error/uncertain response | Existing mutation assumptions conflict; no mutation rewrite in this package |
| G | `ChartFrame` / `MonthlyFlowBars`, `CategoryRanking`, `BudgetProgressRow` | Exact geometry/encodings in master7.1; selected/pinned month state separate from summary scope; table alternative; bars never animate numeric values | Data provenance/year or chart/source parity unknown; don't infer or fetch an unauthorized new source |

Keep interactive scope narrow: motion and focus are client behavior; money/provenance selectors remain pure; current server reads and financial helpers retain ownership. The inspected package manifest has no dedicated motion/presence dependency; existing `RecordModal`, `ModalOverlayPortal` and `FocusTrap` own relevant integration boundaries. Use CSS/Web Animations plus a scoped lifecycle adapter; no new animation library is required. The choice of engine is technical, not permission to choose different motion.

### 4.2 State-machine implementation notes

1. On open, record the actual trigger ref and source scroll context. Mount/inert/focus first; then animate if policy allows. Initial inspection focus targets the labeled heading, not an accidental destructive action.
2. On replacement while open, retain frame dimensions and backdrop, replace only the owned content/subview, restore relevant form state, then180ms body settle. Preserve draft under subview keys, not serialized money strings.
3. On close request, run existing dirty/busy/uncertain-outcome guards **before** starting exit. Keep draft, focus trap and inert until current exit resolves. On cancellation, keep editing focuses back within the draft.
4. On interruption, read computed transform/opacity before canceling. Increment a generation token and ignore obsolete completion callbacks. Keep one current close completion. Unmount cleanup cancels animations/listeners safely, including development StrictMode double effects.
5. When reduced preference changes, finish the correct logical state immediately. Keyboard opens/closes/tabs/menus have zero motion/delay; CSS press transitions must also respect this.
6. Internal links and direct-detail routing retain their established history/deep-link contract; animation must not become routing authority. No exit delay before a keyboard route change.
7. Shared frame default top/right/bottom12px. Prototype top40px includes28px review chrome, never a production token. Mobile8px gutters/all24px corners. Header/action layout changes by content, not via animated width/height.
8. Context tabs explain verified record meaning, not a new backend lifecycle. If “attachment” or “included in report” is unknown, render unavailable state. A synthetic always-present phrase is not proof of an API field.

### 4.3 Locked chart interaction contract

- Keep the existing chart inventory decisions; no Sankey/area/treemap substitution. Income solid green, expense neutral outlined, quiet dashed grid, solid zero, selected month wash and difference bracket, exact chart-local result readout.
- Selecting August cannot mutate September's12480/7360/5120 summary or other regions. Maintain `focusedMonth` and `pinnedMonth` separately. Hover/focus reads; tap/Enter pins; leave restores pin; Escape/outside hides tooltip; arrows move focus. Never add a financial mutation or broad filter as hover behavior.
- Values remain exact strings; no springing/count-up/morph between amounts. Missing months are gaps, not zero; current partial month explicitly labeled; unverified year forbids invented drilldown dates. Respect S02 separately.
- Below600px use3 months plus6-month table. Otherwise3/6 selector; touch hit groups≥44px and rendered labels≥11px. Do not rely on unscaled SVG font-size declarations.
- Category amount + share always visible. Amount-normalized-to-largest track is distinct from share-of-total. Preserve actual category IDs and Others aggregation behavior.
- Budget fill capped100%, label uncapped; terminal tick at limit. Credit uses its verified line-base equivalent while native debt stays outside the track label. No new FX math.


### 4.4 Round04 implementation packet — execute within the existing phase order

Do not copy the simulator's late function overrides into React. Reuse component ownership and existing hooks. No new motion package, finance endpoint or migration is required.

| Order / stage | Files or components | Exact implementation decision | Acceptance / stop condition |
|---|---|---|---|
| A /2–5 | `app/globals.css`, `lib/tokens.ts`, V3 theme root; `MoneyText`; table density variants | Master4.1 graphite palette; neutral dark inset#25292D and expense fill#394148. Use round05 light tokens from master4.1 and neutral shadow/inset roles from4.3; preserve FT12 art. Direction amount class from actual operation type, not sign alone; income green/expense red/transfer neutral. Movements48px desktop,56px touch tablet, compact mobile; no redundant desktop type subtitle | Both-theme amount/surface contrast, all signs/zero/unknown/currencies; actual row measurements;44px touch controls. Stop if operation type is unavailable—do not infer financial identity |
| B /6 | `lib/hooks/useLayout.tsx`, `components/layout/Sidebar.tsx`, `Topbar.tsx`, `AppShell.tsx`, `NavItem.tsx` | Reuse existing `sidebar-collapsed` key/string-boolean preference and provider, with safe storage failure fallback. Expanded208/rail68 desktop; fixed32px FT at x18. Labels close100ms and open150ms after55; flat background240ms dock + workspace translation only. Tablet temporary modal208 over68; mobile ignores desktop preference | Same logo rectangle before/after; tooltip/focus/aria-current; rapid reversal; reload; blocked storage; breakpoint crossing; tablet trap/Escape/outside; main width unchanged on tablet. No auth/provider redesign |
| C /6 | Existing `QuickActionsFAB.tsx`, `OperationTypeSelector.tsx`, shared `AnchoredPopover`, mobile nav owner in `AppShell` | One persistent operation launcher.52px desktop/tablet;56px mobile reserved dock slot. Four destinations + right creation utility; eight existing operations and contextual account/budget/credit creation only. Match master3.3 menu order/position/focus. Keep theme/currency/profile capabilities in Settings/profile; never delete underlying functions | Test all8 entry paths and deep-link params; no wrong target auto-selected; no overlap with mobile amounts; keyboard open/Escape/Tab; safe-area, virtual keyboard, modal ownership and long scroll. One operation definition, no duplicated payload builders |
| D /6 | Shared client route-content boundary inside existing shell; motion policy from packet4.1 | Commit route immediately. Heading0/160/Y3, summary24/180/Y5, work48/180/Y6, opacity.35→1, out curve. At most228ms. Cancel obsolete generation. No animation on keyboard/reduced, same-route filter/page or restored history | Title focus/announcement, existing dirty guard, back/forward scroll, fast A→B→C, loading/error boundaries and no stale request committing wrong module. Stop if route authority must move into animation code |
| E /11 | `components/management/BudgetsManager.tsx`, `BudgetDetail.tsx`, current summary/list sections | Same Planning summary contract, full-width register, compact factual exception above. Keep exact-period/series distinction and linked movements | Exception absent when none exists; one/over/unknown/partial states; mobile action44px; source values and period identity unchanged |
| F /12 | `components/credits/CreditsWorkspace.tsx`, `CreditsListPanel.tsx`; `lib/credits/display-type.ts`, `modules/credits/credit-detail-presentation.ts` (reuse, not modify); owning detail/schedule/form components | Master9.5.1 list always default; CARD/LOAN/LINE/unknown evidence preserved; summary by verified native currency; filter + bounded pagination; exact selected-product workbench. Production page20, retain supported options; review page8 is not a backend contract | Many products stay rows. Card debt≠original loan principal≠line availability. No remaining-principal inference. Unverified evidence/unknown currency disclosed; closed products inspectable. Current forms/payments/attachments remain available via correct product target |

Dependencies: A → shared surface/motion foundation → B → C → D; then existing Accounts/Assets/Movements pilot stages, E at budget stage and F at credit stage. Dashboard assembly remains stage16. Documentation-only approval does not activate these phases.

**Credit integration detail:** `CreditsListPanel` already supports list/card presentation, issuer/type and active/closed filtering. Preserve these even when the preview illustrates only the core subset. Use the display-type helper rather than raw CREDIT_CARD/LINE_OF_CREDIT to identify bank loans. Verified loan presentation returns original principal; only an independently supplied verified outstanding field may be labeled remaining. Keep active summary independent from search/page and annotate coverage. If completeness cannot be shown, display partial/unavailable summaries and consult O10 before adding aggregation APIs.

**Navigation implementation detail:** derive rail mode from provider + viewport; keep desktop preference separate from tablet temporary open state. Use existing focus/portal infrastructure. Background may scale; content and FT never do. Put route heading/focus handling outside animation promises; cancel obsolete effects on route change, resize and unmount. Reduced preference changes settle the logical state immediately. The simulator's document scrolling/hash routes and simplified modal trap are not production integration architecture.

**Preview-to-production differences:** do not ship the28px review bar, internal2/40 fixture hook, generated copies, fixed dates, speed/response controls, eight-row review pagination,520ms fake latency or no-op financial saves. There is no visible scale selector. Default12-product credit fixture and its recorded agenda are coherent across Inicio/Créditos;2 featured credit records are labeled as a subset. Read-only credit drawers do not process payments and do not authorize removing real edit/payment/document actions. The category-action example mutates only an independent ephemeral catalog. Real saves must use existing service results and relationships. UI collapse preference is the only data persisted after reload.

**Additional stop points:** capped register presented as whole-portfolio total; remaining principal would require a new calculation; sidebar hydration would require changing auth cookies; collapse scales charts/text; two modals/FAB active at once; any of8 operation types dropped. Report the conflict and retain the verified fallback.


### 4.5 Round05 build packet: material, selection and confirmed actions

This packet refines phases2,4,5,6a,9–10 and12 below. Implement its shared foundation **before** binding the first module. Master4.1/4.3,6.1,6.6 and9.5.1 are normative. Do not copy the HTML override chain, MutationObserver, local fixtures or fake validation into React.

| Order / phase | Existing ownership and exact task | Acceptance / stop condition |
|---|---|---|
| P1 /2 | V3 token scope in `app/globals.css`, `lib/tokens.ts`; neutralize light canvas/surface/text/borders/shadows, preserve charcoal dark. Current nav neutral fill + teal icon; result inset neutral; native amount direction unchanged | Compare captures01/10/47/56. No app-wide green cast; normal text≥4.5:1, essential boundaries/focus≥3:1. No edits to financial helpers |
| P2 /4 | Evolve `components/ui/AppSelect.tsx` in place. Reuse `AppSelectOption.value/label/hint/disabled/icon`, controlled value/onChange, existing aria props and compact variant. Preserve callers. Search visible for any option count. Replace current random ID generation with deterministic accessible IDs within existing React capabilities | Arrow keys, Enter/Escape/Tab/IME; explicit commit; disabled/inactive prior selection; no duplicate layer/IDs; trigger focus restored. Keep stable values, not labels, as identities |
| P3 /4–5 | Connect selector layer to current `ModalOverlayPortal.tsx`, `RecordModal.tsx` and focus ownership; collision-aware anchor and mobile visualViewport placement; status slots for loading/error/no match. No network owned by the primitive | Parent dialog remains open after first Escape; search/active item visible with keyboard; scroll bounded; no second modal trap or portal outside active modal accessibility tree. Ask if the current primitive cannot safely support this contract |
| P4 /5 | Small UI-only `useConfirmedActionFeedback` (proposed, name may follow repo convention): input is existing operation lifecycle + record ID + trigger ref; output is busy/control state, contextual receipt and row transition request. Do not make it own mutation payload, money computation, write retry or cache source of truth | Separate idle/submitting/confirmed/rejected/unknown. Fast response has no forced delay. Error retains draft. Unknown never auto-retries. Rapid navigation/unmount cancels only visual callbacks, never pretends to cancel a write |
| P5 /6a | `components/management/CategoriesManager.tsx` is the first low-risk integration pilot. Keep current fields, color/icon/upload, linked/system restrictions, validators and service calls. Wire successful create/edit/state/delete to returned record/context and existing list refresh. Shared `ConfirmDialog` and catalog rows receive exact semantics | Run current category tests plus state/relationship tests. Category with links cannot be removed; system category remains protected. Archive only if an actual domain action exists. The reduced prototype form is not a reason to remove production fields |
| P6 /9–10 | Apply the verified action adapter to `components/forms/TransactionForm/SubmitButton.tsx`, `form.orchestrator.ts` consumer, `TransactionEditModal.tsx`, `FormFields.tsx`, transaction table/row and other owning forms | **Do not rewrite the orchestrator or financial logic.** All8 operation payload/target paths preserved. On confirmed write update by actual ID with existing invalidation contract. No optimistic money/delete, no synthetic520ms delay, no no-op success. Stop if success/unknown cannot be identified safely |
| P7 /12 | `CreditsWorkspace.tsx`, `CreditsListPanel.tsx`: all available products with normal search/type/state controls and existing bounded pagination. State default `Todos los estados`; closed records remain identifiable. No `Revisar escala` or size simulator | Records/results/summary coverage truthful; active-only native summary unaffected by search. Preserve existing pagination/options/service coverage. Original principal is never remaining principal. QA2/12/40 not product UX |
| P8 /affected modules | Adopt the same selection/action presentation in account, budget, credit, contact, asset, recurring and settings forms, without removing their module-specific fields/actions | Inspect each current handler and its validation/partial-result/unknown contract. No global mutation wrapper that changes APIs or treats bulk partial success as all-success |

**Selector integration detail.** Search query, committed value, active option and remote loading status are separate state. Opening has an empty query and highlights the selected item; filtering never commits. Extend props for loading/error/retry/coverage only where the owning form already knows those states. Use current service paging, not a new request from each dropdown. Retain associated historical IDs while options load or disappear. Validate unknown/default fallback explicitly. Input owns combobox semantics and active descendant; popup owns labeled dialog + listbox. Confirm every aria relationship against actual rendered IDs. One active selection layer; close old layer before opening a new one; menu exit never steals focus from a newly opened drawer.

**Action geometry/lifecycle.** Button width remains stable while the real request is pending. Check140ms, workbench exit160ms, created row220ms, deleted row exit160ms then neighbor FLIP220ms. Edit/state outline is1px teal at.5 opacity; hold1400ms then fade240ms. Receipt160ms and persistent text, not a transient toast. Keyboard/reduced is immediate. Layer retention and stale-callback guards apply to selector and row as well as drawer. Unmount cancels motion only; unresolved mutation still needs status handling. The prototype's pending spinner is not a reason to delay a fast response.

**After success, preserve the work.** Do not reset search, pagination, period, selected account, scroll or saved view to make the changed row visible. For an out-of-filter record show an exact receipt link, state why it is absent, and let the user choose to clear the filter. Confirm create from transaction detail returns to the appropriate source context; direct routes remain direct routes. Delete focus goes to next surviving row, then prior row, then a useful header control. Do not animate numbers or replay the whole page reveal. For an actual financial action, updated amount/context is evidence from the existing confirmed data flow, never a local subtraction guessed for animation.

**Error/unknown.** Inline blocking text is primary. Rejected operation keeps the entered values and re-enables a safe manual submission. Unknown preserves draft/ID and disables repeat; use only existing safe reconciliation. Prototype review control `Comprobar resultado` always knows its fake local outcome; that is **not** an implementation of financial reconciliation. If production cannot determine status, stop for O11/owner decision. No new idempotency header/column/API call, repair-on-read or retry policy in a visual PR.

**Boundaries.** Fixtures are not migrations. Do not add category archive fields, broad financial optimistic updates, a new combobox package, an animation library, server search or a schema change to recreate screenshots. Native date/file pickers and intentional segmented controls remain appropriate; action menus stay menus. Do not reproduce screen-sharing/system overlays or review chrome as product components.

**Reference tour for this packet.** Open `/#credits` (47), movement form category search (48–49), contextual financial demonstration receipt (50), `/#admin` create/edit/state/delete/restriction/error/unknown (51–55), dark selection (56), mobile selector (57) and mobile catalog/receipt (58–59). `motion.html` remains the inherited live motion reference. Both live actions and fixed screenshots are required for approval.

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
| 4 | Buttons/inputs/selects/menus/tabs/toasts/focus; packets4.1 A–B and4.5 P2–P3 | Keyboard states,44px touch, busy widths, field errors/reduced motion, anchored origins/overflow; old API props compatible |
| 5 | Table/filter/detail/form shells, motion lifecycle and ChartFrame; packet4.1 C–G |48px Movements /56px ordinary two-line /68px Credits desktop density variants;580px stable frame/960px complex form; guarded back; interrupted enter/exit; reduced/keyboard immediate; focus return; draft Apply;320/390/834/1440 captures |
| 6 | Shell/IA/nav/quick-create; execute round04 packet4.4 B–D in order | Existing links/gates/quick-create URLs;208↔68 persistent desktop,68→208 temporary modal tablet, stationary logo, focus/tooltips; fixed Registrar +4 mobile destinations;228ms pointer route reveal; no duplicate query owner |
| 6a | Category action-protocol pilot, packet4.5 P5 | Create/edit/state/delete on existing category services; links/system restrictions; contextual receipt, errors and unknown writes; captures51–59. Preserve all existing color/icon/upload fields |
| 7 | Accounts pilot in PortfolioManager | S05 closed, current account unit suites; active/inactive/technical/custom-currency cases; metadata failure and guarded edit; capture07 |
| 8 | Assets workspace/list/form/detail | Status/custom-type/attachments tests; linked purchase and native values; module-specific state matrix |
| 9 | Movements register/filter/saved view/export/detail, NOT creation rewrite | Existing params and pagination/bulk/export scope; drawer/direct route; captures04/05/11/14/23 |
| 10 | Operation chooser + transaction create/edit/direct-new presentation | All eight operations, nested draft preservation, edit links, attachments, uncertain write; captures06/15 |
| 11 | Budgets list/detail/form/progress; packet4.4 E | Full-width register + horizontal exception band; exact period/series actions,0/over-limit and conversion parity; budget suite; capture08 |
| 12 | Credits natural list + selected-product detail/forms/schedules; packets4.4 F and4.5 P7 |2/12/40 internal synthetic tests, no user-facing scale control, filters/pagination/type/status, native amounts, original≠remaining principal, unknown product/evidence; correct cycle/installment target; exact components/documents; captures09/36/37/42/44 |
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
| Agenda | Five7-day and eleven30-day fixture items; USD400 original; duplicate notification/source not double counted; unknown cycle currency never PEN |
| Read purity | Network mocks assert no new `/api/debtors` or debtor-filtered receivable request from Inicio; no financial write on mount, filter, tooltip or theme switch |
| Partial data | Fail accounts, summary, categories, agenda, budgets, credits and recent independently; no fabricated0 and no hidden healthy sibling |
| Coverage | Simulate truncated document list/unknown count; no complete-total or complete-agenda claim |
| Month history | >N history picks verified latestN under S02; year unavailable does not create guessed date links; missing months not filled with fake0 |
| Responsive |320,390,430,768,834,1024,1280,1440,1920; no page overflow or clipped money; correct region order and touch targets |
| Accessibility | Keyboard create/cancel/filter/detail/chart-data; visible focus; focus return; announcements;200% zoom; reduced motion; both-theme contrast |
| Motion interruption | Close during opening, reopen during exit, replace while entering, unmount, repeated rapid activations; no stale close, trapped orphan backdrop or lost draft |
| Frame continuity | Same580px x/y/width/height before and after detail→edit; body-only transition; previous/next restricted to current visible order |
| Motion timing/policy | Pointer dock260ms/content180ms+36delay/exit160ms; menu160/110; sidebar240ms; route three groups/max228ms; immediate keyboard/reduced; no animation on financial values |
| Context integrity | Expense/income/transfer context differs correctly; original record/date/category/currency kept in edit; no synthetic reconciliation, paid status or bank-sync claim |
| Surface system | Shared radius tokens on all ordinary primitives, mobile gutters/all four24px corners, no square drawer or module-local arbitrary panel radius |
| Chart inspection | Pin/hover/leave/keyboard/Escape retain correct scope and exact values; null/zero/negative/very large series; real-time partial-state label; no accidental financial write |


### Round04 regression additions

- Logo rectangle32×32/x18 identical expanded/compact; wordmark is not a second focusable link; no lingering inert visual clone.
- Desktop preference survives reload and mobile/tablet visits; storage denial remains usable. Tablet expansion keeps workspace x68, traps focus, releases inert on Escape/outside/route/breakpoint.
- Module commit precedes animation completion; three timing groups only; slow data does not produce double reveal. Reduced/keyboard, rapid reversal, history and dirty form.
- Movement12-row reference48.5–49px desktop; preserve readability, direction names/signs, exact cents and hit targets at200% zoom. Expense amount red, transfer neutral in both themes.
- Credit2/12/40+, active/closed, CARD/LOAN/LINE/UNAVAILABLE, long name, native mismatch, unknown coverage,0/missing due, original≠remaining principal. Filter/page never changes summary scope or mutation target.
- FAB/menu viewport bounds, eight operation IDs, contextual action, keyboard, short-screen scrolling, safe-area and virtual keyboard. No generic mobile duplicate Registrar or control covering record amounts.
- All preserved round03 drawer/chart interruption and reduced-motion cases. New shell does not waive prior financial, overlay or source-state gates.

### Round05 regression additions

- Test current `AppSelect` callers with1,2,8,19,100 and paged options, selected/inactive/unknown IDs, metadata, disabled options, accented search, empty/no match/loading/error/retry, clear query, Escape, Tab, Arrow keys, IME and rapid reopen. Mobile keyboard + visualViewport on physical iOS/Android is required, not inferred from desktop emulation.
- Check stable pending width, duplicate prevention, true successful returned IDs, explicit rejection, unknown timeout, existing safe reconciliation, dirty cancel, cancel during entry, asynchronous completion after navigation, permanent delete and state-only change. Never count an unknown result as saved.
- Observe new row/changed row/deletion neighbors with motion slowed in local review;0 animations for keyboard/reduced. No height/value tween. Status text remains available without seeing motion.
- Preserve active filters: create/edit that falls outside the current view does not reset it; receipt explains absence and links the actual record. Delete last row, first row, final page and linked/system records. Check pagination correction after server response using existing contract.
- Synthetic fixture:12 credit products visible through pagination,11 active;7-day agenda5/30-day11 dates; highlighted2 are explicitly a subset. No scale dropdown or hidden production fixture route.
- General prototype suite, inherited motion/shell suites and `verify-precision.mjs` must pass. This is evidence for design only. Real API, authenticated E2E, assistive technology and existing operation tests remain required before shipping.

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
9. The existing overlay/presence architecture cannot preserve focus, dirty/busy state or current routing under interrupted exits without a broad rewrite. Isolate the incompatibility and propose a bounded adapter; do not waive the acceptance test or silently remove motion.
10. Existing data cannot support a context sentence/status, date identity or category share. Use the documented unavailable state and consult if a new contract is required; “intelligent” UI is not permission to invent evidence.

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

For this design-only round, the complete round04 is preserved at `docs/redesign-v3/archive/round-4/`. A rollback is a reviewed restoration of proposal files, not `git reset`, repository deletion or a database operation. Motion can also be disabled in an isolated implementation Preview while correcting a lifecycle defect, but a persistent defect is a release blocker, not an accepted alternate design.

## 10. Definition of implementation completion

All approved stages relevant to the release are complete; original financial fixtures and routes retain behavior; dark/light and responsive states match the refined reference; every visible action is functional or truthfully unavailable; required stability/security gates closed; authenticated QA evidence current; owner accepted the implementation's visuals. Prototype tests alone satisfy none of the live persistence/security obligations.

The intended outcome is operational construction, not another design round: Sol should spend its effort on integration, regressions, tests and delivery, while keeping the product and visual decisions in this specification fixed.
