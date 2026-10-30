# FinTrack V3: Product and Design Master Plan

**Status: definitive design recommendation, awaiting owner approval. Not authorization to implement or release.**

Prepared September 21–22, 2026. Repository baseline: `4fdbe715f1a887ff59fc64868bf2da06c2d0cdae`, branch `codex/redisenio-total`. The branch was created from local `main`; the earlier Git inspection showed local `main` behind the known remote by three commits. No fetch, merge, or production access was performed. Reconcile the approved implementation base before starting work.

This is the implementation source of truth for GPT-5.6 Sol **after approval**. Existing redesign documents remain intact and historical. The owner's current brief authorizes a new evaluation, including different navigation, terminology and chart decisions. It does not authorize production code, database, API, auth or calculation changes. Repository stability requirements remain release gates; they do not prevent this isolated design study.

## 1. Decision and intended product

FinTrack should be a **clear personal financial record that connects position, movement and commitments**. Its advantage is understanding relationships: a purchase changes a balance, may create an asset, may use credit, and may consume a budget. The interface should make those relationships inspectable without requiring the user to understand database tables.

The proposed direction is **Clarity of Record**. A person opens FinTrack at a desk during the day to review a month, or on a phone after a purchase to record what happened. The interface feels calm, precise, legible and capable. Light is the default because sustained comparison of rows and forms is the dominant workflow; dark is an equally specified preference for evening use. Neither theme changes the financial meaning of color.

The signature consists of:

1. A horizontal position band separating native currencies instead of a giant, ambiguously consolidated wealth number.
2. A record-oriented navigation hierarchy and a compact, date-led commitments list.
3. A consistent distinction between stock (today's position), flow (a dated interval), and commitment (an obligation).
4. An inspectable trail from summary to filtered records to linked detail to action.
5. Restrained blue for action, green for incoming flow, slate for ordinary spending, and red only for exceptions/destruction or an explicit deficit.

Avoid a trading terminal, gamified financial score, bank connection claims, gradients, floating decorative cards, red walls of normal expenses, charts that imply fabricated history, and a second navigation system inside the dashboard that duplicates every module.

### 1.1 Alternatives considered

| Direction | Strength | Why it was not selected |
|---|---|---|
| Extend the former teal Portfolio reference throughout the app | Low visual transition cost; already described in earlier documents | Does not resolve competing dashboard hierarchies, semantic naming, oversized forms or duplicate navigation. Recoloring is not the requested outcome. |
| Wealth-first dashboard with a prominent net-worth curve | Immediate emotional reward; attractive long-term narrative | The repository does not establish a complete reconciled net-worth model or real wealth snapshots. The visual promise would exceed the data. |
| Activity-first ledger with no overview | Excellent speed for frequent recorders | Makes obligations, budgets and the current multi-currency position harder to discover. |
| **Position + month + next commitments** | Understandable with current concepts; supports both review and recording | Selected. Requires disciplined data scope and a few separately gated correctness fixes rather than stronger financial claims. |

### 1.2 What success looks like

In a five-person usability review using synthetic data, at least four participants should, without explanation: identify PEN and USD balances separately within 10 seconds; distinguish a transfer from an expense; find the next recorded payment and its detail within two navigation actions; register a simple expense without opening an unrelated module; explain that a read notification is not a paid debt. These are acceptance targets, not research already performed.

## 2. Research basis and limits

This proposal is grounded in source inspection of the actual repository, not an authenticated production walkthrough. No live database schema, RLS deployment, user records, balances, bank accounts or production settings were inspected or changed. Static findings below identify code behavior or risks; they do not certify the currently deployed environment.

Reviewed areas: App Router routes/layouts; shell/navigation/theme providers; operational workspaces, forms and register components; dashboard widgets and services; schemas and transaction orchestration; account/credit/obligation integrity helpers; budget metrics; SQL migrations, views, triggers and RPCs; auth middleware and callback boundaries; import/export and attachment paths; error and timeout helpers; tests; global CSS, Tailwind and token modules; installed skill catalog; previous redesign and stability documents.

Earlier material used as context: `REDESIGN_MASTER_PLAN.md`, `REDESIGN_VISUAL_BASELINE.md`, `DASHBOARD_RESTRUCTURE_PROPOSAL.md`, `FINTRACK_APPROVED_REDESIGN_BLUEPRINT.md`, `FINTRACK_REDESIGN_APPROVAL_ROADMAP.md`, `GATE_1A_STABILITY_EVIDENCE_REPORT.md`, `GATE_1_STABILITY_CLOSURE_REPORT.md`, `QA_CHECKLIST.md`, and the targeted loading/preload plans. The earlier blueprint's external HTML references are not present in this checkout; their appearance is not treated as observed evidence.

The inspected skills were deliberately narrowed to `impeccable` (product register, clarity, states, contrast, motion) and `frontend-design` (a coherent high-fidelity prototype). `ui-ux-design-pro` was assessed but its preset generation was not applied. Installed brand-library styles were not blended. Image-generation and image-to-code workflows were not selected: readable financial numbers, real responsive layout and testable interactions benefit more from HTML/CSS/SVG here. The user's extensive strategic brief and repository research provide the product context; no separate skill onboarding interview is required to exercise the explicitly delegated design judgment.

Evidence refreshed in this mission: **117 existing unit tests passed** using `./node_modules/.bin/playwright test --config=playwright.unit.config.ts`. These cover the focused financial-integrity helpers, not end-to-end financial correctness. Authenticated E2E and a new production build were not run because production code was not changed, and no disposable authenticated environment was established. Prototype verification and captures are recorded separately in `docs/redesign-v3/QA_REPORT.md`.

### 2.1 Architecture as it exists

| Layer | Existing implementation | Consequence for the redesign |
|---|---|---|
| Runtime | Next.js 14.2.29, React 18, TypeScript, Tailwind | Keep the application stack; do not port the static preview as an app replacement. |
| Reads | Server page preloads, client `fetch`, SWR, repositories, Dashboard RPC | Preserve ownership of reads. Consolidate request orchestration only in a separately approved technical package. |
| Writes | Server Actions and Route Handlers; Zod schemas; transaction service; atomic create RPC plus other multi-step paths | Presentation must delegate to existing mutations. UI success follows confirmed server outcomes. |
| Data | Supabase Postgres, RLS, user-scoped records, database views/triggers | Never derive a second source of financial truth in a component. |
| Forms | React Hook Form with orchestration plus module-local forms | Reshape layout around existing fields, conditions and payloads. |
| Charts | Recharts and hand-built SVG | Keep both initially; unify visual grammar, not chart libraries in a redesign PR. |
| Shell | `AppShell`, `Sidebar`, `Topbar`, `QuickActionsFAB`, layout/currency/theme providers | Replace presentation and navigation placement; keep session/permission contracts. |
| Styling | `--ft-*`, compatibility aliases `--c-*`/`--color-*`, hardcoded `lib/tokens.ts`, local Tailwind | Introduce approved V3 values under the canonical namespace and migrate scoped consumers, not a blind global replacement. |
| Tests | 117 unit cases; protected-route/API E2E; authenticated registration/management/saved-view suites | Keep identifiers/contracts where possible. Update obsolete selectors independently before claiming regression coverage. |

`app/globals.css` has 3,608 lines; TransactionForm has 3,203; TransactionTable 2,216; PortfolioManager 1,866 at the baseline. These are change-risk indicators, not proof that the files must be rewritten. Shared presentational extraction is useful, but business orchestration stays intact.

### 2.2 Data relationships that must remain understandable

`profiles/auth.users` owns accounts, transactions, assets, credits, loans, counterparties, budgets and templates. A transaction references its source account, optional destination and category, and can be related to an asset, credit/loan, receivable/payable, recurring template and budget/period. Credits relate to accounts, loans and billing cycles; loans own installments. Debtors/creditors group receivable/payable documents and their ledger. Legacy budgets coexist with `budget_series` and `budget_periods`, with `legacy_budget_id` bridges and `transactions.budget_period_id`.

Do not merge these entities just because the interface groups them. A contact is not a receivable. A billing cycle is not an ordinary transaction. A technical card account is not cash. A budget series is not the selected period. A recurring template is not an executable schedule.

### 2.3 New diagnosis and verified findings

| ID | Finding and source | Product consequence | Treatment |
|---|---|---|---|
| F01 | `DashboardWorkspace.tsx` has six tabs mirroring module navigation; overview prioritizes `FinancialHealthScore` and projection | The first screen requires interpreting models before reviewing recorded facts | Replace overview hierarchy and move analytical material to its owning module |
| F02 | `radar-score.ts` multiplies savings by 5, type count by 25, and penalizes alert counts; thresholds label health | Unread state and arbitrary weights can look like validated financial advice | Remove health score/radar from the default product; retain source until consumer proof, no formula rewrite |
| F03 | Latest checked-in `fn_dashboard_summary` computes `net_worth_pen` from active included accounts; `v_net_worth` also aggregates accounts | “Patrimonio neto” overstates completeness and may conflict with asset/debt concepts | Show native account balances; expose the old result only with explicit legacy scope; full wealth model is O03 |
| F04 | `getDailyFlow` accumulates reportable net transactions from zero; `/saldos-dia` calls it `saldo` | It is not a historical bank balance | Relabel as cumulative result for the selected interval, move to Movements analysis, omit average-bank-balance claims |
| F05 | `getCashFlow` sorts monthly rows ascending then limits, without selecting the latest months | A “last 6 months” chart can contain the earliest six months | Separate correctness issue S02; until fixed label actual returned range, never infer recency |
| F06 | `/projection` infers recurrence dates from `created_at`; confidence is fixed at 1 / .8 / .6; billing-cycle events hardcode PEN | The projection has assumptions and currency limitations, not calibrated certainty | Remove from default dashboard; only disclose as a legacy scenario with verified inputs, O04 |
| F07 | `SavingsRateTrendChart` calls 20% “Meta” and labels above/below goal | A default benchmark looks like a personal saved goal | Remove goal line and evaluative labels; show ratio and denominator only |
| F08 | `DashboardWorkspace` seeds with coupled `Promise.all`; refresh error is set but not passed to the seeded content | A failing dependency hides healthy data or silently leaves stale data | Separate stability package S03 before dashboard migration |
| F09 | `ui.contracts.formatCurrency` maps every non-PEN currency to USD; `utils/currency-format` treats missing/invalid data as zero; Portfolio has a safer native-currency formatter | One application has conflicting money semantics | New typed presentation primitive using verified values; do not replace every formatter at once |
| F10 | `parseCurrencyInput` removes signs and can interpret grouped input differently from `numeric-input.ts` | An attractive input must not silently change the submitted amount | Preserve parser contracts; separately approve unified parsing O02; show an explicit preview of the parsed value |
| F11 | Budget conversion falls back to 3.7; month increments use JavaScript month rollover | Hidden exchange assumptions and month-end cases require dedicated tests | O02/O05, not rewritten during visual work |
| F12 | `AlertsWorkspace` labels read items “Resueltas”; recurring copy says scheduled/automatic without a demonstrated execution scheduler | Presentation claims completion or automation beyond persistence | Rename read state and recurring surface as specified |
| F13 | `isBankEntitiesFeatureMissing` and notification helper include 42501/RLS/permission signals; some APIs surface database messages | Permission failures may look empty; user copy can leak internal details | S04, keep API/auth/RLS changes separately approved |
| F14 | The checked-in summary RPC is `SECURITY DEFINER`, accepts `p_user_id`, grants authenticated execution, and the inspected body lacks an `auth.uid()` ownership check | Potential cross-user RPC access if deployed with this definition and privileges | **S01 urgent isolated security verification.** No exploit attempted; deployed state unknown; no production certification |
| F15 | Large `full-form` modal preset reaches 1680px; transaction operations/inline creation have many parallel sections | Registration competes with the underlying workspace and increases scanning distance | 580px main form drawer, 960px maximum for schedule-heavy forms, full-screen mobile |
| F16 | Multiple small type scales (10–11px), many color roles, local shadows/radii and several fonts | Visual prominence follows widget construction rather than financial importance | One type family, simpler surfaces, 12–14px routine text, specified data hierarchy |
| F17 | Historical synthetic Portfolio charts and earlier currency/schedule/attachment blockers were already addressed by G1B–G1G | Repeating old diagnoses would waste work and risk reversing fixes | Explicitly preserve current helpers and tests; do not reopen closed packages |

The critical security finding is a source-level risk, not a claim of confirmed access to another user's records. Sol must not test it with real user IDs or alter policies as part of the redesign.

## 3. Locked design decisions for approval

Approving the visual proposal approves these product presentation changes, not optional structural items:

| Decision | Exact choice |
|---|---|
| Primary navigation | Inicio, Movimientos, Cuentas; then planning and position modules in the order below |
| Terminology | Dashboard → Inicio; Portafolio → Cuentas; Recurrentes → Plantillas; Alertas → Avisos; Administración → Catálogos |
| Routes | Keep existing pathnames, IDs, query-driven creation contracts and permissions |
| Dashboard | Single overview with facts first; no six-tab duplicate of all modules |
| Wealth and credit | No unqualified net-worth hero and no cash + credit “available” total |
| Money | Native currency first, exact decimals, explicit approximation/provenance for an existing conversion |
| Charts | Grouped monthly bars, ranked category bars, budget bullet rows; remove score and decorative history |
| Tables | Default list view with right-aligned exact amounts; keep existing alternate card views as a secondary option |
| Forms | Progressive sections, 580px drawer for ordinary operations; long schedule form is a dedicated 960px surface |
| Theme | Light default, first-class dark; preference compatibility retained |
| Typeface | Manrope, one family, tabular numerals for money; no monospaced UI-wide money treatment |
| Accent | Record blue; prior teal is not the canonical action color |
| Branding | FinTrack name retained. The preview's simple F/register mark is a proposed monochrome mark, not an already approved replacement asset. Approve separately as V2 below. |

### 3.1 Navigation and shell

Desktop (width ≥1200): 224px persistent sidebar, 64px topbar, content padding 36px, content maximum 1512px including padding, centered when wider. At ≥1600 padding becomes 48px. A 1440px viewport leaves 1216px beside the sidebar and 1144px inside the content paddings.

Sidebar groups, exact order:

- **Tu día a día:** Inicio `/dashboard`; Movimientos `/transactions`; Cuentas `/portfolio`.
- **Planificación:** Presupuestos `/budgets`; Créditos `/credits`; Por cobrar `/receivables`; Por pagar `/payables`.
- **Registro y activos:** Activos `/assets`; Plantillas `/recurring`.
- Footer: Avisos `/alerts`; Catálogos `/admin`; Configuración `/settings`; profile/sign-out menu. Developer routes remain visible only under existing environment gating, after Catálogos.

Group labels are organizational aids, not extra routes. Do not fuse receivable/payable datasets. The group **Registro y activos** deliberately avoids implying that reusable templates are wealth. Do not create a new route for a group heading.

Topbar: current route breadcrumb left; last successful retrieval context where actually known, privacy, unread notice control and profile right. No global currency toggle, universal search, large exchange-rate ticker or persistent global CTA. Page-level primary action names the operation. Existing quick-create options move into a compact “Registrar” menu reachable from the page action/mobile center action; preserve all supported operation paths and URL entry points.

Tablet 768–1199: fixed 72px icon rail with 46px hit areas and accessible names; labels via focus/hover tooltip. Content padding 24px. At 960–1199 dashboard chart and agenda retain two columns. At 768–959 chart is full width, agenda becomes a three-column horizontal list, lower analysis stays two columns when each is ≥260px. No horizontal scrolling for page content.

Mobile <768: no rail; 56px topbar; 20px page padding (16px below360). Bottom navigation: Inicio, Movimientos, Registrar, Cuentas, Más. Center action opens the operation selector; it is not a selected destination. Más opens full navigation in a full-height sheet; closing returns focus. Respect `env(safe-area-inset-bottom)`; reserve 88px content clearance. No competing FAB. Existing desktop sidebar collapse preference remains supported: expanded224/collapsed72; tablet forces72, mobile ignores desktop preference without overwriting it.

Keep a single active scroll container in production (`AppShell` main) and restore expected per-route scroll. The static prototype uses document scrolling to keep it independent; do not copy that implementation detail into the app. Skip link lands on the real main. Topbar and fixed bottom navigation must not hide keyboard focus or error messages.

## 4. Visual system

These values are normative. The preview uses short local names; production maps them to `--ft-*`. Hex values are the reproducible sRGB reference. Additional tints should be derived in OKLCH, not invented per component. Do not replace source colors on user bank/category icons; keep them localized and bounded.

### 4.1 Color tokens

| Token / role | Light | Dark |
|---|---|---|
| `--ft-canvas` | `#F6F7F9` | `#161B25` |
| `--ft-surface` | `#FDFEFD` | `#1D2431` |
| `--ft-surface-muted` | `#EEF1F5` | `#252E3E` |
| `--ft-surface-hover` | `#E9EDF5` | `#2B3548` |
| `--ft-text-strong` | `#222B3B` | `#E8EDF5` |
| `--ft-text-muted` | `#5D687A` | `#ACB8CA` |
| `--ft-text-subtle` | `#626D7E` | `#9BA9BE` |
| `--ft-border` decorative division | `#DCE1E8` | `#384456` |
| `--ft-control-border` essential input boundary | `#8691A2` | `#7F90A9` |
| `--ft-primary` | `#3659A2` | `#A1BDF7` |
| `--ft-primary-hover` | `#294681` | `#BED2FA` |
| `--ft-primary-soft` | `#E9EFFB` | `#2B3B57` |
| `--ft-text-on-primary` | `#FDFEFD` | `#192438` |
| `--ft-success` / recorded incoming flow | `#26705E` | `#82CEB2` |
| `--ft-success-soft` | `#E9F4EF` | `#213D37` |
| `--ft-danger` | `#AD454C` | `#F1A0A5` |
| `--ft-danger-soft` | `#FBEEF0` | `#452C37` |
| `--ft-warning` | `#876018` | `#EBCA80` |
| `--ft-warning-soft` | `#F9F0DC` | `#3C3425` |
| `--ft-chart-expense` | `#68778E` | `#AAB7CD` |
| `--ft-overlay` | `rgba(24,34,52,.36)` | `rgba(5,9,16,.66)` |

Blue means action/selection, not “good finances.” Green means an incoming financial direction or confirmed success, not a high score. A negative transaction amount is not automatically dangerous; expense rows remain ink/slate. Red signals an exceeded limit, overdue obligation, error, destructive action, or negative result when that interpretation matters. Pair status color with a label/icon; never rely on hue alone. Selected surfaces use both tint and selected semantics. Chart bars use different positions/shapes/labels plus a data alternative.

### 4.2 Typography

Self-host Manrope Latin/Spanish subset, weights400/600/700. Load through the app's font mechanism in the foundation stage, retaining a system fallback. Three local TTFs are bundled only for offline review; production should generate optimized WOFF2/subsets. Verify OFL license stays with redistribution.

| Role | Desktop / tablet | Mobile | Weight / tracking |
|---|---|---|---|
| Page title | 28/36px | 24/32px | 700 / −.8px (−.7 mobile) |
| Position amount | 31/40px (32 on narrow tablet full row) | 26/36px | 600 / −1px |
| Module summary amount | 23/32px | 21/28px | 600 / −.7px |
| Section heading | 17/24px | 16/24px | 700 / −.25px |
| Form/dialog title | 20/28px | 19/28px | 700 |
| Standard body | 14/22px | 14/22px | 400 |
| Form label / data row | 12/18px / 13–14px primary row values | 12/18px; 13px money | 600 labels / 400 values |
| Supporting text | 12/18px | 11–12/18px | 400 |
| Input | 14/22px | **16/24px** | 400, avoids iOS input zoom |
| Chart ticks / compact metadata | 11/16px minimum | 11/16px minimum | 400 |
| Sidebar group | 10/16px uppercase | not on bottom navigation | 700 / 1px; nonessential categorization only |

Use `font-variant-numeric: tabular-nums lining-nums` for money, dates, percentages and counters. Currency prefixes may be smaller on position amounts but must remain adjacent and readable. Do not shrink a large amount until it fits: allow two currency blocks to stack; use responsive layout. Do not truncate money with ellipsis. Critical values must stay legible at 200% zoom. Body paragraphs max72ch.

The final preview includes a shared legibility calibration for chart/metadata labels. The minimum size above is measured at rendered size, not SVG viewBox size; a scaled chart must not shrink labels below11px. Nonessential sidebar grouping and the clearly separated proposal toolbar may use10px.

### 4.3 Geometry and elevation

Spacing scale:4,8,12,16,20,24,28,32,36,40,48,64px. Field label gap7px is the only optical exception, inherited by all fields. Field gaps20px vertical/16px horizontal; section gap28px; dashboard panel gap24px desktop/18px tablet; major sections28–32px.

Radii:4px badges,5px small date tile,7px controls/row icon tile,10px registers,12px panels,14px modal. Drawer square at viewport edge. Cards are used for a bounded chart or separate object, not every metric. Position band uses horizontal dividers, not separate KPI cards. Do not put nested cards inside panels; use rows and spacing.

Borders1px. Data panels and tables have no ambient shadow. Popover shadow `0 8px 24px rgba(18,31,50,.12)`; dialog `0 20px 70px rgba(18,31,50,.18)`; dark uses the same geometry with black at .28/.4. Only elevation overlays use shadows. Decorative borders are not substitutes for essential control boundaries.

Z layers: base0, sticky30, navigation40, popover60, backdrop80, dialog100, toast120, skip link140. Never put a tooltip beneath its active drawer. Use portals in production.

### 4.4 Motion, focus and icons

Interaction feedback140ms; popover120ms opacity+4px translation; drawer220ms opacity+16px translation; confirmation160ms opacity+4px. Easing `cubic-bezier(.22,1,.36,1)`. Closing140ms. No bounce, count-up, chart grow animation, parallax, perpetual pulse on ordinary content, or staged dashboard entrance. Reduced motion removes movement and uses immediate state replacement; retain feedback semantics.

Focus:2px solid primary, offset3px, never clipped. Preserve native button/link roles. Dialog uses trapped focus, `aria-modal`, accessible title, Escape, return to trigger; unsaved form requires explicit discard. Nested create uses an in-drawer subview with a back control, not a second stacked modal.

Iconography: consistent24px viewBox,1.6px stroke, rounded caps;20px navigation,16px inline actions,14px metadata. Use the existing repo-native icon source or a single approved library only if required; adding a library is not a design requirement. No emoji as account/category default. Bank/user-provided art stays at32px with neutral fallback initials.

## 5. Financial presentation contract

### 5.1 Money and scale

The application speaks Spanish but retains the current stable `1,234.56` financial separator convention explicitly. Use grouping comma and decimal point across every surface, regardless of browser locale. Never silently switch to `1.234,56` on a different device.

| Case | Exact presentation |
|---|---|
| PEN | `S/ 1,234.50`; `PEN` visible in multi-currency table column/section context |
| USD | `US$ 1,234.50`, never bare `$` |
| Other verified ISO currency | `EUR 1,234.50`, `CLP 1,234.00`; preserve current stored precision, do not alter ledger precision by assuming ISO minor units |
| Custom currency | `CODE 1,234.50`, code from catalog; optional name in secondary text; never coerce to USD |
| Unknown currency metadata | Original code plus value; badge `Moneda no verificada`; no conversion |
| Missing/failed amount | `—` plus `No disponible` or section-level error, never `0.00` |
| Known zero | `S/ 0.00`, neutral color; normalize display of negative zero only |
| Expense ledger | `−S/ 480.00` with Egreso label; neutral ink |
| Income ledger | `+S/ 2,880.00` with Ingreso label; green is supplementary |
| Transfer ledger | `S/ 600.00` without positive/negative sign; origin→destination; excluded from report income/expense under current rules |
| Deficit/result | `−S/ 125.50`; label the period and meaning; red permissible |
| Credit debt, pending obligation | Positive magnitude with `Deuda` / `Pendiente`, not a minus sign merely because it is owed |
| KPI/table/form/detail | Always exact cents, including `.00`; no K/M shorthand |
| Chart axes only | `5 mil`, `1.2 M`, unit in title; tooltip exact full value; disambiguate billions as `mil M` rather than ambiguous B |
| Narrow mobile amount | Preserve exact digits, move prefix or whole block to a new line; never ellipsis or scientific notation |

Amounts remain numbers/decimal values in the data layer; presentation formatting does not round stored values or feed strings back into business logic. Display unknown values with a typed availability state before invoking existing formatters. An error cannot be mapped through `value ?? 0` and then labeled an observed zero.

Native sums: only same currency and verified compatible units. Use the existing `groupPortfolioBalancesByCurrency` and obligation currency helpers where applicable. Balances, report-converted cash flow, and forecast estimates are different bases; do not compare them without a named calculation contract.

Existing equivalents: show `≈ S/ 1,900.00` secondary to `US$ 500.00`, with rate basis if provided: `1 USD = 3.8000 PEN · contable · 21 sep 2026`. If source/time is not exposed, say `Tipo de cambio según cálculo actual; procedencia no disponible`. Do not invent a fresh timestamp or reuse a live market rate to relabel a booked transaction. A source=`fallback` rate must never be called “actualizado.” No new FX conversions in visual components.

### 5.2 Percentages and comparisons

- Use a decimal point and one decimal place: `75.0%`, `107.5%`. Whole percentages are permissible only in a compact dashboard row with exact1-decimal detail available. Inputs for rates retain the existing schema precision.
- A percentage change is not a percentage-point change. `20.0% → 25.0%` is `+5.0 pp`; relative change, if relevant, is separately labeled `+25.0%`.
- Previous zero or missing denominator: `Sin base comparable`, not infinity or0%. Negative denominators must follow the existing named formula; no universal ratio invented by Sol.
- Current partial month is not compared against a complete previous month as an equivalent interval. Default V3 omits change badges. Matched elapsed-period comparisons require O06 or a verified existing endpoint; show absolute periods even when a comparison is available.
- No “meta de ahorro” unless a persisted target and ownership are established. The old 20% threshold is not a personal goal. A savings ratio can be displayed as `Resultado / ingresos del período` with its formula and undefined state for zero income.
- Budget progress is `spent/limit`, not elapsed-time-adjusted. Preserve values above100%; clamp only bar fill to100%, add numeric exceedance. Preserve negative remaining amount. Zero limit shows unavailable ratio, not a reassuring0%.
- Credit utilization is not the same as repayment progress. Display debt buckets separately; use the server's verified line-base utilization only when all required currency inputs are valid.

### 5.3 Dates and states

User copy: `21 sep 2026`; exact date inputs use `YYYY-MM-DD`. Day-only stored financial dates are calendar dates, never parsed through UTC then shifted into the prior day. Presentation timezone for timestamps is `America/Lima`, marked when relevant. Do not silently change backend due-date calculation during a visual PR; timezone/calendar correctness is O05.

Use `Vence hoy`, `Vence en 3 días`, `Vencido · 2 días` with the exact date in the same item or detail. Missing due date is `Sin fecha de vencimiento`, not zero days. Paid/collected/written-off records must not remain overdue merely because their historical date is past. Stored status wins over a decorative badge. Preserve ACTIVE/SOLD/DEPRECIATED and dispute/write-off distinctions.

Evidence vocabulary:

- **Registrado:** a persisted fact or deterministic result of its documented current calculation.
- **Equivalente:** a converted presentation with known basis, approximate prefix.
- **Programado:** only a stored, actual schedule date. A due receivable is an expected collection, never guaranteed income.
- **Estimado:** model result with assumptions; dashed line and explicit label, no probability without calibration.
- **No verificable:** missing provenance/currency/schedule/document association; preserve value/source reference outside trusted totals.

All summary scopes must answer: which records, which dates, which currencies, which statuses, and when last read. Put a short scope line beside the number/chart and extended definition behind an information button, not a hover-only tooltip.

## 6. Shared components and interaction contracts

### 6.1 Buttons, inputs and selection

One primary action per screen region. Primary38px desktop/44px touch, horizontal padding14px, radius7px,13px semibold. Secondary neutral border/surface. Ghost for navigation to more detail. Destructive reserved for confirmations, not normal expense creation. Icon-only36px desktop/44px touch with accessible name. Preserve loading width, disable double submission, show `Guardando…`; a timeout on a write is `No pudimos confirmar el resultado`, not proof of failure or permission to blindly retry.

Inputs44px desktop/touch; amount64px with28px tabular amount; textarea88px minimum. Permanent label above, help below, optional explicitly labeled, required according to actual schema. Validate on blur and submit, not on every keystroke. Error border plus text and `aria-describedby`; submit focuses first invalid field and summary where needed. Invalid reference-data load disables only dependent fields/actions, retaining entered text and existing associations.

Select uses native select for short lists on touch; accessible searchable combobox for >8 accounts/categories/counterparties, with type-ahead, arrow keys, Enter/Escape and visible selection. Include account currency and status. Inactive selected references remain visible as historical associations; do not erase or auto-reassign them.

Numeric input: preserve the existing parser until separately approved. The approved visual contract shows the parsed amount on blur and warns on ambiguous separators instead of guessing silently. For new presentation tests use `1,250.50`, `1250.50`, empty, zero, negative, `1.250,50`, `1,234`, and8-digit amounts. Negative permitted only in fields whose schema permits it (e.g. initial balance); operation amount remains positive with direction determined by operation type.

### 6.2 Filters and tabs

Search left, frequently used type tabs above, advanced filters in a right drawer (desktop520px/mobile full screen). Filters: date range, account, category, type, currency, sorting, page size where supported. Draft filter edits commit on Apply; Cancel leaves old results. Active chips contain explicit labels and individual remove actions; Clear resets all including query/page. Changing a filter resets page1 and clears cross-page selection unless the existing contract explicitly provides it.

Preserve `TransactionListParams`, URL spelling (`account_id`, `date_from`, etc.), saved-view local persistence and backend sorting behavior. A saved view is not a new backend feature. State chips are not tabs; tabs change a coherent view and use tab semantics only for same-page panels. Route links remain links with `aria-current`. Preserve existing list/card toggle in overflow/view options, list default; do not remove its code before migration evidence.

### 6.3 Register/table

Desktop row64px for two-line records,48px single-line catalog, header40px. Cell16px padding; 12px at narrow tablet. A semantic `<table>` for tabular data, header associations and announced sort direction. Primary text13px, secondary12px, amount14px; final amount right aligned. Tabular digits across all rows. Date/status/amount never available only on hover. Keep selection checkbox32px interaction wrapper desktop/44px touch. Entire row may support pointer inspection, but contains a proper primary button/link for keyboard use and avoids nested interactive elements.

Transactions column order: selection36, Movement flexible minimum220, Account160, Category144, Date112, Original amount160, Actions44. Hide Category below1200 and move into row subtitle; hide Account below960 and include it in detail/subtitle. At <768 use record rows with description+exact amount first, date/category second, account/action third. No sideways scrolling for the ordinary register. Schedule tables with many indispensable numeric components may scroll horizontally inside a labeled region, never the whole page.

Single-row action menu: inspect, edit, delete, and module-specific actions. Detail opens520px drawer, preserves scroll/filter/selection; Escape returns focus to the exact trigger. Direct detail routes still work and use the same detail component. Desktop next/previous respects current visible ordering; never skips into another user or page without a deliberate fetch. Bulk toolbar appears only with selection; no checkboxes on charts. Preserve current bulk-delete confirmations and partial-result handling; export includes stated filtered/selected scope, never silently all data.

### 6.4 Forms and overlays

Simple operations use580px drawer, sticky header, independently scrollable body and72px footer. Mobile full-height `100dvh`, safe areas, scroll-padding for keyboard/footer. Main sequence: amount+currency → account → date+category → description → module-specific required fields → optional details → effect summary. Two columns only for short paired fields; meaningful descriptions span full width.

Operation chooser contains eight understandable actions mapped to current `OperationType`; no new API operation. Preserve the distinguishing debt creation/settlement pathways. New nested account/category/contact creation is a subview of the same drawer, retains parent draft, back control, and returns newly created selection only after confirmation. It does not reset the transaction. Complex bank-loan/schedule forms use a960px max dialog on desktop and full-screen multi-section view on touch. Preview demonstrates the main operation form; exact per-module form recipes are below.

Confirmation:480px max, object name, currency, amount/date where relevant, known consequences, cancel-first keyboard order. No vague “Are you sure?” alone. Typed confirmation only for current account deletion/security contracts requiring it, not every financial record. No decorative success page; toast plus updated record context, with next action only if useful.

Popover:280–360px width,8px padding, max-height min(400px, available viewport), collision-aware, escape/outside-click. Desktop date picker max360px, mobile native date or sheet. Tooltip is optional information, not the only location for fees, FX assumptions, errors or required values.

### 6.5 Loading, errors, empty and notification states

| State | Required behavior |
|---|---|
| Initial load | Show geometry-matched neutral skeleton quickly; no fake chart traces or zeros |
| Slow read | After2s show `Está tardando más de lo habitual`; keep read timeout10s unless the module already uses a stricter limit |
| Timeout/error without prior data | Local error with human-readable message, retry and request reference if safe; ordinary empty CTA must not replace error |
| Partial dependency failure | Healthy data remains; identify failed dependency and disable only actions that require it |
| Refresh failure with prior data | Keep old data, label `No actualizado` and actual last success when known; never show a new timestamp |
| Empty account | `Tu primera cuenta, un punto de partida.` with add-account action and opening-date explanation |
| Empty transactions | Register empty with record action; no chart or score generated from nothing |
| Filtered empty | `No hay coincidencias` + clear filters; never “start your finances” |
| Unsupported action | Disabled with plain reason; no toast claiming a feature worked |
| No access | Permission message; do not treat as an empty list or missing feature |
| Mutation uncertain | Preserve draft, show unknown result, reconcile with existing fetch contract; do not automatic-resubmit |

Toast at bottom right desktop/max360px, above bottom navigation mobile. Success4s, noncritical info5s, error persistent until dismiss or context recovery. Inline form error is primary and persists; toast never replaces it. Announce polite status for success and assertive only for submission-blocking errors. Preserve release announcements but make ordinary updates nonblocking; mandatory existing release gates retain behavior until separately approved.

## 7. Chart decisions, one by one

Every chart has a question, data contract, label, failure state and exact-value alternative. No chart is justified merely by the existence of an endpoint. Existing calculation functions remain untouched even when their visualization is removed. “Remove” below means remove from the approved presentation; code deletion comes only after the final consumer audit.

| Current chart or visual | Decision | V3 visualization and destination | Reason / conditions |
|---|---|---|---|
| `FinancialHealthScore` radar and average | **Remove** | Replace with direct position facts and dated commitments on Inicio | Six normalized axes obscure their assumptions, and alert count is not financial discipline. No replacement health score. |
| `DashboardHeader` KPI sparklines and trends | **Replace** | Native-currency position band plus three exact monthly flow values | A sparkline beside “wealth” must not stand for cumulative transaction result or another quantity. |
| `CreditCapacityPanel` / `AvailabilitySplitPanel` | **Remove combined availability** | Credit line and debt stay under Créditos; cash stays under Cuentas | Borrowing capacity is not own money. Preserve separate factual numbers only. |
| `MoneyFlowChart` | **Modify and keep** | Paired vertical income/expense bars, shared zero baseline,6 actual monthly buckets by default,3/6/12 control in module analysis | Compare magnitude and surplus without a dual axis. If S02 is not closed, label actual returned period, not recent months. |
| `SaldosDiaChart` | **Rename and modify** | Single straight/step cumulative result line, zero baseline, period controls5D/1M/3M/6M/1A; Movimientos → Análisis | `Resultado acumulado del período`, explicitly not bank balance. Preserve computed series and real date gaps. No average-balance narrative. |
| `EgresosCategoriasWidget` | **Keep concept, simplify** | Ranked horizontal bars top5 + Otros, exact value labels, current-month scope; all categories in expanded Movements analysis | Easiest category comparison. No colored rainbow for ordinary categories. |
| Income-category breakdown from sidebar | **Keep as secondary** | Same ranked bars inside Movements analysis, switch Income/Expense | Does not deserve a second dashboard panel unless explicitly chosen later. |
| `SavingsRateTrendChart` gauge, goal line and sparkline | **Replace** | Ratio line in Movements analysis below flow, with actual month values and no goal band | Removes invented20% personal target. Missing/zero-income month is a gap, not zero. |
| `PresupuestosMesWidget` | **Modify** | Up to3 budget progress rows on Inicio; bullet/progress register in Budgets | One visual grammar serves summary and detailed action. |
| `BudgetVarianceBars` | **Merge visual treatment** | Limit track + spent fill + exact remaining/excess in each budget row | Avoid two panels showing the same comparison. Retain underlying period query and linked detail. |
| `CreditosUsoRapidoWidget` utilization ring | **Replace** | Per-card horizontal utilization track with explicit limit and verified line base, native debt PEN/USD separately | A consolidated donut can hide which card has the upcoming obligation. |
| `FlujoPendienteWidget` net comparison | **Replace** | Separate native-currency receivable and payable summaries with dated lists | Do not cancel two currencies or equate future collections with available funds. |
| `VencimientosWidget` / `OverviewRiskStrip` | **Merge presentation** | Date-led agenda, overdue first, then chronological upcoming; one link to owning record | Avoid duplicate alerts and urgency decorations. Use verified record IDs to deduplicate. |
| `CashFlowProjectionWidget` waterfall/confidence shading | **Remove from default; gate legacy analysis** | No forecast in approved core overview. An existing legacy scenario can be accessed under advanced analysis only with explicit assumptions, no probability band and verified currency support | Template dates and uncalibrated confidence do not support a forecast hero. Rich forecast is optional O04. |
| `SaldosBancariosWidget` distribution | **Move/simplify** | Cuentas register; optional per-currency sorted balance bars, no bank pie | A total in one base currently obscures account type/currency. Exact account rows answer the main question. |
| `PatrimonioComposicionWidget` donut | **Replace** | Separate account and asset native-currency registers; no common100% donut until O03 establishes non-overlap and liabilities | Current composition excludes negative account values, includes positive accounts as liquidity and adds asset values; may double count/omit debt. |
| Portfolio opening/current graphic | **Keep facts, simplify** | Two adjacent labeled amounts with dates in account detail | Retains the G1B-P04 truthfulness fix, no synthetic intermediate line. |
| Receivable/payable progress | **Keep within verified currency bucket** | Settled/total/remaining label + thin progress track per currency | Cross-currency progress is prohibited; currencyless initial balance stays outside. |
| Asset purchase/current comparison | **Keep exact facts** | Table columns and signed difference only if existing calculation supplies it | Do not label appreciation a realized return; no invented market series. |
| Legacy `widgets/CashFlowChart`, `ExpenseBreakdown`, `FinanceWidgets`, `KpiCards` | **Do not reintroduce** | Audit actual imports; migrate any active consumer to the relevant V3 primitive | Older alternatives are not a second design system. Delete only after import and runtime proof. |

Chart grammar: 2px line, 4px data point only on selection or sparse series; no area fill unless the area itself has meaning;3–4 horizontal grid lines; no vertical grid by default; money axis begins at zero for magnitude bars. Negative results extend below zero. Percent axes may extend below0/above100 when the metric does; do not clip a real loss. Keep record dates as dates, no smooth interpolation implying missing observations.

All charts: title, unit, exact interval, full-value keyboard-accessible tooltip, accessible short summary and `Ver datos` table. Mobile bars use minimum16px width with4px separation and adequate month spacing; reduce default displayed buckets to3 only if the6-bucket chart cannot maintain11px rendered text and tappable group hit areas. A3/6/12 control explicitly changes the range. Tooltip persists on tap and closes with Escape/outside tap. Hover is not required to know current totals.

Missing history is a gap/empty state, never a filled zero or generated curve. Chart error keeps the section title/scope and retry; healthy adjacent sections remain. Rendering must not wait for an unrelated chart's fetch. No new plotting library is required.

## 8. Dashboard specification

### 8.1 Purpose and visual order

The first screen answers: “What is my recorded position in each currency; what did this month produce; what requires review next?” It is not a complete report or a claim of predictive financial health.

Exact order, desktop:

1. Page header `Tu dinero, en perspectiva.`; supporting current calendar date; primary `Nuevo movimiento`.
2. **Position band.** Left native active non-technical account totals, beginning PEN then USD then other codes alphabetical. Right separate current asset value by native currency and card debt by native currency when verified. No combined assets-minus-debt number. At most two secondary facts; links open owning module/detail. Extra currencies appear as a wrapping row, never squeezed.
3. **Month + agenda.** Left flow panel (1.8fr), right commitments (1fr, min272px). Flow title `El ritmo de tu dinero`, subtitle `Ingresos y egresos de tus reportes · PEN`; three monthly facts Income/Expense/Result; paired bars; explicit partial month note; data alternative and Movements link. Agenda title `En los próximos días`,3 records maximum, with stored due date, type, original amount/currency, status, record link.
4. **Spending + budgets.** Ranked expenses left (same column proportions), up to3 budget rows right. Expense ranking top5 plus Otros, budget rows sorted exceeded first then percentage descending. In the synthetic fixture the visible order is Transporte107.5%, Servicios85.3%, Alimentación75.0%.
5. One scope note; no extra “smart tip”, financial score, repeated module summary or promotional block.

Desktop1440×900 acceptance: page title, full position band, flow summary and at least the first two commitments visible. The complete overview may scroll. Do not shrink fonts to satisfy the previous artificial “everything above fold” constraint. At1440×1080 the main chart and agenda should be readable together. At1920 contain width rather than stretching bars/numbers to the edges.

Tablet834:72px rail, position totals on one row, secondary facts below separated by one divider, full-width flow, compact three-column agenda below, two-column lower analysis. Tablet1024: two main columns if minimum widths hold. Mobile390: page title/header, native balances, secondary facts, flow metrics and plot, then vertical agenda, spending, budget rows. No nested horizontal scrolling. High-priority overdue state adds a concise tappable warning above the position band, so urgent action remains reachable before scrolling. Bottom navigation stays consistent.

### 8.2 Data contract by visible block

| Block | Existing source | V3 mapping | Gate / prohibited inference |
|---|---|---|---|
| Native accounts | `/api/accounts?include_inactive=true`, Portfolio currency helper | Filter active and type≠CREDIT_CARD, group `balance` by exact currency | This is `Saldos de tus cuentas`, not guaranteed liquid cash; do not use mixed RPC `balancePen` for these totals |
| Current assets | `/api/assets` / existing Assets repository | Use native `current_value` totals by verified currency/status scope, label active registered assets | Do not use `total_soles` as if native for a mixed dataset; no live market valuation |
| Card debt | Existing `/api/credits` native dual-currency fields and credit presentation helper | Sum only verified same-currency card debt; label card debt specifically | Do not include bank-loan remaining principal under this label; do not fall back to credit limit |
| Month report income/expense/result | `/api/dashboard/summary`, existing report amounts | Preserve fields/formula; explicitly PEN report base | If conversion provenance missing, information panel admits it. No native-only claim for converted report amounts. |
| Monthly bars | `/api/dashboard/money-flow?months=6&mode=mensual` | `ingresos`,`egresos`, actual returned dates/range | S02; raw API month labels lack year metadata, O06 recommended; do not hallucinate missing months |
| Due obligations | `/api/dashboard/alerts`, `/api/dashboard/sidebar` verified due records | Merge by source type+record ID, original currency where known, explicit source link | Sidebar `monto` alone is insufficient for a native-currency claim; use verified owning-record currency or mark unavailable. Do not promise a complete agenda from a partial response. |
| Expense ranking | `/api/dashboard/sidebar?period=YYYY-MM` current category amounts | Sort descending, retain category IDs; top5+Otros | Must label PEN report/equivalent basis according to actual route; do not assume booked FX parity across endpoints without testing |
| Budget rows | `/api/budget-periods?period=YYYY-MM` and existing metrics helpers | Exact period amount/spent/remaining/progress; link to selected period | No inferred all-month category spend or series-wide action |

These are independent existing reads, not permission to create a new aggregate endpoint. A presentation adapter can select/label/group existing values, but must not invent rates, schedules, balances or new accounting semantics. The live fan-out should be measured before deciding O01.

### 8.3 Filters, links and comparisons

No global historical dashboard period selector in core V3 because `/summary` is current-month-only. The header's month element is a **scope control**, not an operative whole-page date filter: selecting it explains that balances are current and which panels support dated analysis. In production render it as a clearly labeled `Mes actual: septiembre` scope disclosure, not a dropdown chevron suggesting unsupported options. Movements, budget and category sections retain their own supported date controls.

Bar click opens an inspectable tooltip/data table, with a secondary `Ver movimientos de este mes` deep link using existing date filters. Category row opens Movements with its category+period. Others opens the expanded category breakdown, not an invented “Other” ID. Agenda goes to the exact record, never automatically initiates payment. Budget row opens that exact period. Totals open an accessible definition popover with scope, exclusions and any uncertainty.

No default percentage comparison, because full previous month and partial current month are not comparable. Never show `+12% patrimonio` using monthly net divided by inferred previous balance. Keep original `monthly_balance_variation` available to a legacy diagnostic only with explicit definition until O06 is decided.

### 8.4 Dashboard states

No accounts and no movements: two-step first-run state, add account then first movement. Accounts but no movements: show accounts, empty flow panel with `Registrar movimiento`, agenda/budgets show real empty states independently. No due records: `No hay vencimientos registrados en este intervalo`; do not say “you have no debt.” No budget: compact `Define un límite para una categoría` action; avoid a large onboarding illustration.

Partial account failure: position unavailable with local retry; render month/agenda if healthy. Partial agenda failure: visible isolated error, not `0 compromisos`. Missing category metadata: label `Sin categoría` preserving amount. Stale refresh: read-time warning, preserve successful prior snapshot. Mixed currencies: rows per native currency. Privacy mode masks figures and chart tooltip values; it must not leave accessible-label amounts exposed when the existing preference promises privacy.

## 9. Screen-by-screen operational specifications

The following recipes plus shared components are normative even where the interactive preview covers only a subset of controls. A visual screenshot cannot remove a field/action that the recipe or current contract requires.

### 9.1 Movements `/transactions`

**Job:** find, inspect, correct or register an event. **Primary region:** the record list, not an analytical dashboard above it.

Structure: title+new movement; one summary strip for the current report period (Income, Expense, Result, base explicitly labeled); type tabs All/Income/Expense/Transfers; search, Filters, Saved views, Export; active scope chips; register; pagination. Summary must say whether it is whole-period or filtered. Do not recalculate a period summary from only the current page; if the API lacks filtered aggregate, keep period summary labeled `Resumen del mes, no cambia con filtros` or hide it for arbitrary ranges.

Default sort transaction date descending, stable tie-break as existing backend; page size20 with existing supported options. Filter dates are inclusive per contract; no client timezone shift. Preserve quick filters, advanced filters, sort, pagination, saved-view create/select/delete, selection, bulk delete and export. No group-by feature unless already supported; optional client grouping must not change server page semantics.

Analysis is a secondary in-page `Análisis` view or collapsible section after the register toolbar, entered deliberately. Exact charts: monthly paired bars, cumulative period result, category ranking and optional result/income ratio. Do not keep dashboard module-tabs just to house these charts. A new UI query parameter may persist view state without changing route/API contracts; choose `view=analysis`, default register, ignore unknown values safely.

Desktop detail:520px drawer with original amount, type, date, accounts, category, report participation, actual linked modules, attachment association status; edit/delete actions in footer; open full detail link. Direct `/transactions/[id]` has breadcrumb, original amount and same facts, then linked objects and notes/documents. Two-column details ≥960 (2fr/1fr), one column otherwise. Preserve fetching and attachment restrictions.

Mobile: record row with exact amount and direction, description, date/category, account; details full screen; full selection mode reachable from “Seleccionar” overflow and 44px hit targets. Pagination remains available. Search and filters do not disappear. Empty/filter-empty/error/stale contracts from§6.5 apply; financial summary must not show0 while loading.

Files: `components/tables/TransactionTable.tsx`, `components/transactions/TransactionsWorkspace.tsx`, `components/finance/data-table.tsx`, `lib/hooks/useTransactions.ts`, `components/detail/TransactionDetailClient.tsx`, transaction routes/pages. Keep hook/service logic unless a separately approved correctness package changes it.

### 9.2 Transaction creation/editing `/transactions/new` and overlays

Use existing orchestration, Zod and action functions. Do not infer operation purely from an amount sign. Every current hidden field/module flag remains synchronized by the existing implementation.

| User action | Existing operation | Required field recipe / effect |
|---|---|---|
| Registrar ingreso | `income` | Amount/currency; receiving account; date; income category; description; optional sender, notes, attachment, recurring template. Incoming report participation remains existing logic. |
| Registrar egreso | `expense` | Amount/currency; source/payment method; credit card and consumption/payment selector when applicable; date; category; description; optional recipient, budget period, notes/attachment/template. |
| Transferir | `transfer` | Amount/currency; source and destination; date; supported FX context; optional description/notes. Distinct accounts, do not count as report income/expense. |
| Comprar activo | `asset_purchase` | Expense foundation + asset name/type/custom type, serial/location if available; supplier; actual category trigger. Explain linked asset creation. |
| Prestar dinero | `receivable_issue` | Expense foundation; debtor; optional due date; concept; explain new receivable and outgoing money. |
| Registrar cobro | `receivable_collect` | Select exact receivable or supported debtor settlement target; receiving account; amount/currency/date; notes. Preserve settlement currency and overpayment guards. |
| Recibir dinero a devolver | `payable_issue` | Income foundation; creditor; optional due date; explain new payable and incoming money. The product label is not generic “create bill” if funds are received. |
| Pagar pendiente | `payable_pay` | Exact payable or supported creditor target; paying account; amount/currency/date; preserve payment-plan/remaining guards. |

For edit, keep operation identity from stored record, load all original relationships before enabling Save, show immutable restrictions with reason. Do not reset an existing value because its reference list failed. Unsupported attachment writes remain disabled, historical references preserved. A payment to credit is its existing configured path, not a newly invented ninth transaction endpoint.

Effect summary describes intended route (“salida”, “entrada”, “transferencia”, “crea pendiente”) and original amount; show computed balance-after only if an existing verified calculation supports it, otherwise omit. Preview's summaries deliberately avoid an invented post-save balance.

On success close/dismiss after confirmed response, invalidate the existing affected caches and reselect/announce the resulting record. On partial attachment failure preserve the created transaction and show verified attachment status, following existing compensation contracts. Long forms do not reset when a nested record is created. No autosave of real financial data is introduced.

Files: `TransactionForm/index.tsx`, `form.orchestrator.ts`, `FormFields.tsx`, `sections/*`, `NestedRecordCreationModals.tsx`, `TransactionEditModal.tsx`, `OperationTypeSelector.tsx`, `RecordModal.tsx`. A presentational split can be prepared independently; no rewrite of the3203-line orchestrated form in one PR.

### 9.3 Accounts `/portfolio`

**Job:** know what is recorded in each account and safely maintain account identity.

Structure: native currency totals; Active/Inactive/Technical views; search; currency/type/bank filters; list default, existing card view in View menu; rows with account+bank, type, currency, opening balance/date, current balance, actions. Do not use a consolidated hero. Include currency codes beyond PEN/USD instead of dropping them. Technical account view links to its card/credit and clearly labels non-operating balances.

Details: current amount first; opening/date; type/bank/status; include-in-net-worth flag labeled `Incluida en el cálculo actual de cuentas` with legacy field explanation; notes; linked records; edit/deactivate/reactivate/delete as permitted. Opening/current comparison is factual numbers, no sparkline or inferred return.

Create/edit fields exact order: name, account type, bank entity optional, currency, initial balance, initial-balance date, include-in-calculation setting, notes, optional appearance (color/icon). Initial balance negative allowed within current schema. Currency and operating/card-type boundary retain current guards. An old inactive-bank association must remain visible; S05 must establish safe unchanged-association editing before visual rollout.

Tablet retains native totals and table, may move opening date to secondary text. Mobile account rows show name+balance, bank+currency, opening fact; detail reveals all options. No infinite card list decorated with per-record chart. Preserve account/reference-data error separation and bounded mutations.

Files: PortfolioManager, `/portfolio/page.tsx`, `modules/portfolio/*`, existing account routes. Use existing helpers as invariants, not duplication targets. All six Portfolio unit suites and authenticated identity flows gate this stage.

### 9.4 Budgets `/budgets`

**Job:** see which concrete period is exceeding its limit and inspect linked spending.

Structure: period selector using supported period endpoints; per-currency Assigned/Spent/Remaining summaries; period/status/currency/search controls; `Este período`, `Excedidos`, `Otros períodos`; main register2fr and one contextual review note1fr at≥1200, single column otherwise. Only show a note when there is a factual exception; no generic advice card.

Row: name/category, complete period dates, spent, limit, percentage, remaining, status, exact-period detail. Use progress track plus numeric overage, not two separate charts. Sort default active period then exceeded descending by overage ratio, then name; allow existing user sort/filter where implemented. Category spending and budget-linked spending must remain distinct.

Create fields: name, description, category, currency, amount, frequency, start/end, active state and any current period/series controls. Preserve current validation, including overlaps and periods. Edit title `Editar este período`; confirmation names exact dates/ID; series-wide edits absent without O08. Detail: spend/limit/remaining, linked transactions and pagination, period metadata, record-scoped actions. Legacy rows use current `budget-action-scope` verification.

Mobile: name and percentage row; progress; spent/limit; remaining and dates below; link to exact detail. Never clip107.5% to100% text. No budget/no period/filtered empty are different states. Deleted period does not appear successfully removed until server confirmation and cache reconciliation.

Files: BudgetsManager, BudgetDetail, `BudgetVarianceBars`, `PresupuestosMesWidget`, `lib/budgets/*`, `modules/budgets/budget-action-scope.ts`, existing budget/series/period routes. Preserve all calculation and action-scope tests.

### 9.5 Credits `/credits`, `/credits/[id]`

**Job:** understand actual debt, upcoming dues and record-backed repayment context.

Structure: Cards/Bank loans/All selector, upcoming dues secondary view, type-specific summaries with explicit native currencies. List default when>4 records; existing cards remain optional. Card data: issuer/name/status; PEN debt and USD debt separated; line limit and its base; verified line-base utilization; available credit explicitly labeled; cycle close and payment date; cycle/document actions. No debt-total ring that merges card and bank-loan semantics.

Loan data: lender/name, native currency, original principal, verified principal outstanding when supplied, next installment/date, status, detail. Missing principal field shows `No disponible`, not inferred from total installments. Do not present “available” on a loan as credit limit minus principal unless current type-specific helper says it is valid.

Card form: issuer→name→line currency/limit→initial PEN debt→initial USD debt→closing/payment day→existing optional details/documents. Loan form: lender→disbursement account→name→currency/principal→positive FX if USD→installment count→disbursement/first-due dates→description→schedule. Schedule preserves installment number, date, capital, interest, insurance, other charges, total and status. Header summarizes sums of these actual supplied columns; no redistribution of total across missing components. Documents keep AVAILABLE/UNVERIFIED distinction and current supported routes.

Detail sections: summary; next commitment; card cycles or loan schedule; linked account/transactions; documents; notes. At≥960 schedule displays table with sticky first label column and numeric alignment; touch allows labeled internal horizontal region plus row detail. Disabled actions explain missing required verified schedule/rate data. Unknown currency mismatch is visible, not corrected by label.

Files: CreditsWorkspace, CreditsListPanel, CreditCardForm, BankLoanForm, CreditCardScheduleModal, BankLoanScheduleModal, CreditsManager, credit branches of ModuleDetails, `modules/credits/*`. Existing rate, schedule, detail and attachment unit tests mandatory.

### 9.6 Receivables `/receivables`, `/receivables/[id]`

**Job:** know who owes what, in which currency, and record a collection against the right obligation.

Native-currency pending summaries; unknown initial-balance notice with affected record count; search and status filter; Persons list as existing mental model, each row contains a currency stack rather than one consolidated amount. Status labels Pending/Partial/Collected/Written off retain meaning. Counterparty activation is separate from settlement state.

Person detail520px drawer / direct route: name/contact metadata; separate currency buckets of documented total/collected/pending; preserved unverified initial balance; dated obligations; transaction ledger with signed incoming/outgoing meaning; create obligation, collect, edit person and permitted deactivate/delete. One currency per progress bar. Do not cancel positive PEN with negative USD. Unknown records cannot produce a “settled” badge.

Counterparty form: name, current supported contact fields, notes and legacy initial value if already available. Do not introduce a mandatory new currency column for initial debt without O07. Obligation form: debtor, associated account, amount/currency, issue date, optional due date, concept/description, notes/template option. Preserve whether the existing path records a transaction; do not merge standalone document creation and lending-transaction creation without explanation.

Mobile person row: name; pending buckets (two lines if two currencies); nearest recorded due; action. Details group obligations before full ledger. Error on person summary does not overwrite documented obligations. Unsupported attachments remain unavailable with preserved legacy references.

Files: ReceivablesManager, DebtorForm, ReceivableForm, DebtorDetail, shared obligation components, `/api/debtors/*`, `/api/receivables/*`, existing collection action. No mutation/API change implied.

### 9.7 Payables `/payables`, `/payables/[id]`

Mirror the Receivables interaction system but use creditor/payable/paid semantics. Header `Por pagar`; primary `Registrar pago`; secondary `Nueva obligación` and `Añadir persona`. Summary buckets Pending in PEN/USD/other verified currencies, not expected income. A disputed obligation remains visibly `En disputa`; paid and partial remain distinct. Negative ledger direction must follow existing creditor contracts, not copied from debtor arithmetic.

Person details: documented total/paid/pending per currency, unverified initial amount, due obligations, payment ledger. Form: creditor, associated account, amount/currency, issue/due dates, description, notes, existing template option. A settlement selects exact payable or supported creditor target; validates currency/amount before submit; no overpayment or whole-contact settlement assumption.

Desktop/tablet/mobile layout mirrors Receivables to reduce learning. Preserve activation controls, detail drawer/routes, delete guards and attachment limitations. Ship separately from Receivables because money direction and mutation actions differ.

Files: PayablesWorkspace, CreditorDetail, CreditorForm, PayableForm, shared obligation helpers, payable/creditor routes and payment action.

### 9.8 Assets `/assets`, `/assets/[id]`

Native registered-value summary by currency; counts by actual ACTIVE/SOLD/DEPRECIATED state; no ROI hero. Filters status/type/currency/search; list columns name/type, purchase date/value, current registered value, currency, status, actions. Preserve custom type name and legacy fallback helper. Detail: original acquisition, current recorded value, original transaction/account, notes/location/serial, status and supported action controls.

Asset purchase flow keeps existing expense linkage: name/custom type, purchase account, amount/currency/date, supplier, description, notes. Standalone edit does not silently create another purchase. Unsupported attachment control remains disabled and historical reference read-only. Values are user-recorded, not automatically market-valued. Any depreciation is existing logic, not a newly imposed schedule.

Tablet column reduction moves type/date below name; mobile name/value, type/status, detail. No generic card grid when dozens of items exist. Empty offers register-asset path; type-list failure disables type-dependent submission without deleting form entries.

Files: AssetsWorkspace, AssetsListPanel, AssetsForm, ModulesDetails asset branch, `modules/assets/asset-presentation.ts` and repository.

### 9.9 Templates `/recurring`

Rename presentation to `Plantillas`, keep route. Explicit subtitle: `Reutiliza un movimiento y revisa los datos antes de registrarlo.` Remove “automatic”, “scheduled payments” and monthly expected totals unless an actual frequency/execution model is later approved. Count active templates and display native amounts; summing templates is not a monthly cost forecast.

Rows: name, operation type, description, source/destination/category, original amount/currency, active state, `Usar`, edit/delete. `Usar` keeps the existing `/transactions/new` prefill contract; opens reviewable form, no immediate write. Create fields retain type/accounts/category/counterparty/name/amount/currency/description/notes. Existing edit restrictions may limit changes to name/description/notes; show locked financial fields rather than enabling unsupported changes.

Mobile rows preserve amount and Use action44px. Empty explains saving a repeated transaction shape; no fake calendar. No-data and read-error remain distinct. Files: RecurringWorkspace, RecurringForm, recurring routes. O04 is the only path toward actual scheduling.

### 9.10 Notices `/alerts`

Inbox hierarchy: Unread/Read/All; severity/module/search filters; dated rows with source record link; regenerate/manual notice/current bulk actions in secondary toolbar. Status is `Leído`, never `Resuelto` from `is_read`. Separate severity from read state: reading an overdue notice does not make it paid. No health/risk claim beyond the generating condition.

Each row: severity icon+label, concrete title, why generated, date, linked module, read action, delete overflow. Header can display unread counts only when valid. Manual form preserves current fields/validation; labels describe a saved manual notice, not a continuing automated rule when no rule engine is persisted. Bulk “mark read” and deletion use supported mutations with partial outcomes disclosed.

Mobile cards are flat list rows with full title and44px actions; no multi-card severity dashboard. Generator error keeps existing inbox. Files: AlertsWorkspace, AlertsCenter/Card/Filters/Summary, alert-generator and existing alert APIs unchanged unless S04 independently approved.

### 9.11 Settings `/settings`

Internal navigation: Perfil, Seguridad, Preferencias, Notificaciones, Cuentas, Datos, Soporte. Preserve existing SettingsTab query mapping even if visible labels change. Desktop180px internal list plus content max880px; tablet same if≥960 otherwise scrollable section tabs; mobile section selector above content.

- **Profile:** avatar, full name, email read-only where currently immutable; save scoped to edited fields; avatar upload independently busy/error. Failed profile preload locks save and explains retry.
- **Security:** password/current supported validation, reset request cooldown, sign-out-all, existing deletion confirmation; destructive zone below ordinary security rows. All auth behavior unchanged, no auto-submit or prefilled credentials.
- **Preferences:** theme, display-currency preference where applicable, privacy mode. Global display preference never rewrites native account/obligation money. Persist through existing hook/profile contract, maintain theme bootstrap key.
- **Notifications:** existing preference channels and switches with precise labels, explicit save if currently required; no fake delivery confirmation.
- **Accounts:** existing account-related settings kept; link to Cuentas for full operations rather than maintain a divergent manager.
- **Data:** Export and Import as distinct sections. Import sequence Upload → Analyze → Review warnings/errors → Confirm → Result/report. Show affected record counts and supported rollback before commit; do not change parser/commit/rollback logic. No synthetic import ever points to production.
- **Support:** real contact/help links only. Pending features explicitly disabled. Avoid implementation jargon (“P5”, “standalone”, “ledger contract”) in user copy.

States per panel are independent; a failed account preload cannot hide a successfully loaded profile. Files: Settings page and `components/settings/*`, current profile/import/export routes unchanged.

### 9.12 Catalogs, developer and status routes

`/admin`: present as personal `Catálogos`, with current permissions unchanged. Tabs Banks, Currencies, Categories, Asset types; searchable single-line48px rows; active/inactive state; new/edit/deactivate/delete; system-record restrictions plainly visible. Fields remain current schema, including currency code/symbol/name and category scope/system key. Prevent the design from implying that all users have system-admin powers. Mobile tab row may scroll horizontally; record list does not.

`/developer`, `/developer/bank-icons`, `/developer/control-center`, `/admin/icon-studio`: preserve current environment gate and redirects. Functional tools use same type/control vocabulary, dense tables/preview grid as appropriate. Clearly label local/developer environment. No new live controls or production-config mutation authority.

`/module-status/[moduleKey]`, `/maintenance`, not-found and global-error: one title, useful explanation, allowed retry/back/home action, and existing authenticated/system redirect behavior. Do not render navigation to disabled modules as live actions. Maintenance should not promise recovery time without provided data.

### 9.13 Authentication and public entry

This remains within visual scope only. `/login` and `/register`: neutral canvas, constrained420px form, wordmark, title, email/password/confirmation according to actual form, submission errors at field/form, password visibility accessible, sign-up/reset links. Optional product illustration must be real approved UI, not fake financial growth. Desktop one form column plus quiet explanatory panel only if it adds understanding; mobile form first and no carousel before fields. Preserve callback, recovery, redirect and session code byte-for-byte in visual stages.

Public `/`: coherent typography and palette, concise description of tracking money, debts and plans; true current capabilities; primary enter/sign-in and current registration flow. Do not promise live bank connections, investment performance, automated payments or certified financial advice. No landing-page conversion redesign is required to approve the operational app direction; extend brand tokens after core app acceptance.

### 9.14 Universal detail anatomy

Breadcrumb/back preserving source context; object name/status; native amount and meaning; dated facts; linked records; documents with verified association state; notes; permitted actions. A record that no longer exists shows specific not-found, not an empty healthy detail. Server load error is retryable without suggesting record deletion. Direct-load detail pages must remain functional when opened from a saved URL and signed-in session. Mobile detail is a full page/sheet with one clear return action and footer spacing.

## 10. Structural opportunities, independently approvable

None of these proposals is authorized by visual approval. “Optional” means independently scoped, not that correctness/security issues may be ignored. S01–S06 below are prerequisites or verification packages; O01–O11 are optional product/architecture investments. The core visual design has a safe fallback for each optional item.

### 10.1 Stability/security gates before affected production changes

| ID | Scope and current evidence | Required outcome | Authority / dependency |
|---|---|---|---|
| S01 | Summary RPC SECURITY DEFINER/user-ID ownership concern (F14) | In a disposable DB, inspect effective function body/grants and verify one authenticated user cannot supply another's ID. If exposed, separately approved least-privilege/ownership correction and cross-user regression tests. | Security/RPC/RLS authority required before any change. Urgent; no live exploit in this mission. |
| S02 | Monthly query selects ascending rows then limits (F05) | Correctly retrieve the intended most recentN months, return/display chronological order; test histories>N and missing months. | Separate calculation/query correctness PR, no redesign mixed. Dashboard/analysis recency claims blocked until verified. |
| S03 | Coupled critical dashboard fetches; stale refresh message lost | Independent section availability and visible stale state; existing healthy values and caches retained. | Separate stability PR if it changes orchestration. Same money results and API contracts. |
| S04 | Raw DB error text and permission-as-feature-missing detection | Controlled user errors; permission failures not empty success; log internal detail safely. | Separate server/API review, explicit contract approval if error shape changes. No policy change implied. |
| S05 | Inactive/unavailable bank can block unrelated account edit | Preserve verified unchanged association, reject unverified new association; regression with both metadata failure and inactive bank. | Focused Portfolio correctness package before account edit migration. |
| S06 | Historical Gate1 authenticated environment/harness evidence incomplete | Disposable test project/user, current selectors, deterministic seed/cleanup, authenticated module matrix and Preview evidence | Production-readiness gate; existing old test reports are not fresh release certification. |

These should be addressed through separate requests/PRs. Sol may prepare design-only foundations locally before all gates are closed, but cannot mark the app production-ready or ship dependent routes while relevant gates remain open.

Impact and approval details for these prerequisite packages:

| Gate | Benefit / principal risk | Existing data and migration | API / Supabase impact | Difficulty / priority |
|---|---|---|---|---|
| S01 | Enforce user isolation; a poorly scoped restriction could break legitimate summary reads | No financial records changed. A versioned function/grant migration only if exposure is confirmed; never bulk data repair | Direct RPC authorization and potentially grants/RLS require explicit approval; preserve legitimate application payload/results | Medium-high / P0 verification; severity of remediation depends on confirmed effective privileges |
| S02 | Truthful latest-period history; window changes may surprise users accustomed to the erroneous range | No stored records or balances change; no schema migration | Service query ordering/window changes, response shape stable; same Supabase view | Low-medium / P1 before claims of recent history |
| S03 | Healthy sections remain useful and stale results are visible; races may replace newer cached values | No record/schema migration | Preserve endpoints; client/server orchestration and cache behavior change. Same user-scoped Supabase reads | Medium / P1 before dashboard integration |
| S04 | Honest failures and safer user copy; changing error classification may expose hidden dependency failures | No records/schema migration | Review error payload compatibility independently. No RLS workaround; permission errors remain errors | Medium / P1 |
| S05 | Edit unrelated account metadata without invalidating a preserved bank link; accidental acceptance of a new invalid reference is the main risk | Keep original bank foreign key unless a separately validated edit requests otherwise; no backfill/migration | Same mutation fields and Supabase relationship; narrowly change reference-validation behavior only after approval | Medium / P1 before account-form migration |
| S06 | Reproducible release evidence; a misconfigured seed/cleanup could target real records | Disposable test data only, explicit project/user allowlist and scoped cleanup; no production migration | Exercise existing APIs/RLS/auth without weakening them; non-production environment setup needs owner authority | Medium / P1 release gate |

The current state, problem and required proposal for each gate are in the preceding table and findings F01–F17. These impact rows complete their approval scope; they do not turn the design request into authority to execute any fix.

### O01. Shared read snapshot and partial availability

- **Current:** several dashboard endpoints call the same summary RPC; the layout waits on profile and FX work; SWR keys repeat data families. `DASHBOARD_SUMMARY_REUSE_PLAN.md` and layout-data work are prior context, not automatic authority.
- **Problem:** duplicate work, endpoint coupling and unclear freshness increase perceived loading and inconsistent snapshots.
- **Proposal:** first measure server spans/cold and warm waterfall; then use request-scoped, user-scoped summary reuse and a typed partial-data/freshness envelope. Do not cache across users or change money formulas.
- **Benefit:** fewer duplicate queries, healthy sections render independently, one coherent calculation timestamp.
- **Risk:** cache leakage or stale mutation readback if user/snapshot key design is wrong.
- **Existing data:** no record migration; verify per-user isolation.
- **APIs:** additive partial/freshness metadata or new endpoint must be versioned/approved; old consumers retain their contract until migrated.
- **Supabase:** same queries/RPC initially; no RLS changes. Query/index work only after evidence.
- **Migration:** none for an initial request-scoped cache; API adapter rollout required if envelope changes.
- **Difficulty / priority:** medium-high / P1 after S03 and S01.
- **Core fallback:** independent existing reads, source-local errors, honest unknown freshness.

### O02. Monetary presentation, parsing and FX provenance contract

- **Current:** multiple formatters/parsers, PEN/USD transaction schema, custom account currencies, fallback rates3.7/3.75 in different paths, JS numbers and database numeric fields.
- **Problem:** display ambiguity, missing data treated as zero and conversion bases hard to explain.
- **Proposal:** a typed money domain boundary carrying original amount/currency and an optional booked/presentation conversion with source/effective date/fallback flag; a canonical parser with explicit separator rules. Audit precision before considering decimal/minor-unit storage changes; such a migration is not bundled into this proposal.
- **Benefit:** reliable figures across tables, forms, exports and charts; errors stay distinct from zero.
- **Risk:** changing rounding or parse behavior can change submitted/stored money. Compatibility adapters and fixture parity are essential.
- **Existing data:** preserve every original amount/rate; missing provenance remains unknown, never backfilled from today's market.
- **APIs:** additive metadata; supported-currency expansion is a separate contract decision.
- **Supabase:** optional provenance columns and constraints only after audit; no blanket enum-to-text or numeric migration now.
- **Migration:** staged additive columns if needed, nullable for legacy records, no mass recalculation.
- **Difficulty / priority:** high / P1. Display-only MoneyText from§11 is independent and can precede domain changes.
- **Core fallback:** existing verified calculations, native values primary, explicit unavailable provenance.

### O03. Reconciled net worth and historical position

- **Current:** `net_worth_pen` aggregates selected accounts; assets, loan/card debt and obligations live in other tables; true monthly account/wealth snapshots are absent.
- **Problem:** “net worth” lacks a complete consistent model; combining cash and asset registers may double count an investment; curves cannot be reconstructed honestly from two balances.
- **Proposal:** define an asset/liability inclusion registry and linkage rules before implementing a new net-worth metric. Separately design dated position snapshots with explicit valuation basis and immutable source references.
- **Benefit:** a defensible wealth dashboard and real change explanations.
- **Risk:** double counting, historic FX ambiguity, missing liabilities, valuation assumptions.
- **Existing data:** no destructive backfill; legacy values remain labeled, start snapshots prospectively unless historical reconstruction is independently validated.
- **APIs:** new versioned position/snapshot response with reconciliation breakdown; do not silently replace `patrimonio_neto` semantics.
- **Supabase:** possible snapshot and inclusion/linkage tables, user-scoped RLS, carefully indexed dates.
- **Migration:** additive; reconciliation report reviewed before enabling metric; no overwrite of balances.
- **Difficulty / priority:** high / P2 strategic.
- **Core fallback:** separate native accounts/assets/debt facts; no combined wealth hero or history chart.

### O04. Explicit recurrence schedules and defensible scenarios

- **Current:** reusable transaction templates have creation dates; projection repeats by that day, hardcodes horizon “confidence” and includes billing-cycle amounts as PEN.
- **Problem:** template creation date is not payment schedule; no calibrated probability; future obligations may overlap or have unsupported currency semantics.
- **Proposal:** separate reusable template from optional recurring schedule (frequency, anchor date, end, exceptions, currency, expected/confirmed flag). Forecast only from explicit events; distinguish expected receipts from firm obligations; de-duplicate linked cycles/payments. No automatic payments or execution engine unless separately requested.
- **Benefit:** a transparent scenario editor with traceable events and accurate date/currency semantics.
- **Risk:** double-counting debt repayments, treating receivables as guaranteed income, accidental transaction generation.
- **Existing data:** old templates stay unscheduled until owner/user explicitly supplies schedule; do not infer from `created_at`.
- **APIs:** new schedule endpoints and projection version; remove misleading confidence field only with migration/consumer plan.
- **Supabase:** additive schedule/events data, RLS, no writes to financial transactions without explicit confirmation.
- **Migration:** opt-in association; legacy forecast kept clearly labeled/off by default until cutover.
- **Difficulty / priority:** high / P2.
- **Core fallback:** manual templates and recorded-date agenda, no forecast hero.

### O05. Shared financial calendar

- **Current:** mixtures of UTC date arithmetic, local `Date`, `toISOString`, month rollover, and Lima accounting FX date.
- **Problem:** near-midnight dates and month-end cycles can disagree between presentation and services.
- **Proposal:** define date-only vs timestamp types, Lima accounting-day boundary, month-end policy (clamp-to-end vs anniversary rules by product), and shared tested helpers.
- **Benefit:** due states, report ranges and budget periods agree.
- **Risk:** retroactively changing periods can move transactions between budget/report buckets.
- **Existing data:** preserve stored dates; no automatic date shift. Reconcile examples before any derived-window change.
- **APIs:** date range semantics documented, potential versioning for changed budget windows.
- **Supabase:** current columns generally suffice; SQL expressions may need alignment after approval.
- **Migration:** no initial data migration; any corrected derived-period association requires separate mapping and rollback record.
- **Difficulty / priority:** medium-high / P1 for confirmed errors, otherwise P2.
- **Core fallback:** display date-only values faithfully and preserve existing calculations while flagging ambiguity.

### O06. Report periods, comparable intervals and provenance

- **Current:** current-month-only summary, monthly label strings without a year in money-flow payload, mixed live/historical conversion basis, legacy inferred previous balance.
- **Problem:** historical filters and percentage comparisons cannot be applied uniformly or honestly.
- **Proposal:** optional period-aware reporting endpoint with exact start/end/as-of timestamps, included status/FX basis, previous matched elapsed interval, ISO bucket keys and explicit completeness flags.
- **Benefit:** trustworthy month comparisons and per-filter summaries without aggregating paginated rows client-side.
- **Risk:** different definitions between old and new summaries may appear as financial discrepancy.
- **Existing data:** read-only calculation project with golden fixtures; retain booked transaction values.
- **APIs:** additive versioned reporting contract; no implied change to existing `/summary`.
- **Supabase:** query/view changes possible; indexes after measured need; no record migration expected.
- **Migration:** parallel report validation before switching consumers, exact parity where scopes match.
- **Difficulty / priority:** medium-high / P1 after S02.
- **Core fallback:** current month with explicit scope, no matched-period deltas/global historical filter.

### O07. Currency for legacy counterparty opening balances

- **Current:** `debtors.initial_debt` / creditor counterpart has no reliable currency contract; G1G excludes ambiguous values from documented currency buckets.
- **Problem:** some opening amounts cannot safely participate in outstanding totals or settlement.
- **Proposal:** add explicit opening-balance currency and provenance, with a user-reviewed reconciliation workflow. Consider a separate opening-entry record rather than a mutable scalar if the ledger model supports it.
- **Benefit:** documented opening balances become explainable and safely settleable.
- **Risk:** guessed currency or wrong sign would corrupt obligations.
- **Existing data:** remain unverified until confirmed; never default all legacy values to PEN.
- **APIs:** explicit opening-entry fields/validation and reconciliation action; current totals stay stable until opt-in.
- **Supabase:** nullable currency/provenance or new opening-entry table; policies/constraints separately reviewed.
- **Migration:** additive, export-before, per-record confirmation, audit trail, reversible association.
- **Difficulty / priority:** high / P1 for affected owners, otherwise P2.
- **Core fallback:** visible separate unverified amount, no blended sum, existing integrity helper preserved.

### O08. Budget series and exact period model consolidation

- **Current:** legacy budgets plus series/period tables and bridges; safe actions currently record/period scoped.
- **Problem:** two representations complicate user explanations and code; series-wide intent lacks a consistent mutation contract.
- **Proposal:** reconcile all records to explicit series/period ownership; support “this period” and “future periods” only after defining overlap, spent history, skipped/closed periods and deletes.
- **Benefit:** recurring planning without ambiguous representative-row edits.
- **Risk:** losing historical spend associations or changing past limits.
- **Existing data:** preserve IDs/bridges and transactions; never remap solely by category/name.
- **APIs:** explicit action-scope contract with affected-period preview and concurrency guard.
- **Supabase:** additive migration/backfill, constraints, later deprecation only after parity audit.
- **Migration:** dry-run mapping, per-series verification, dual-read compatibility, no destructive cleanup during initial rollout.
- **Difficulty / priority:** high / P2.
- **Core fallback:** exact selected record/period scope with clear dates, current helpers/tests.

### O09. Attachment support for currently unsupported modules

- **Current:** active-core transaction/credit attachment integrity exists; legacy asset/obligation/billing-cycle writes are blocked or constrained.
- **Problem:** attachment affordances vary because real association/storage support varies.
- **Proposal:** unify verified association metadata, upload/compensation status and signed read access by entity, extending one module at a time.
- **Benefit:** trustworthy proof/document workflows.
- **Risk:** orphan uploads, cross-user file access, false success and broken legacy references.
- **Existing data:** retain all legacy URLs/markers as unverified where necessary; do not parse/delete them opportunistically.
- **APIs:** new supported endpoints and status fields; preserve active-core contract.
- **Supabase:** metadata/storage policies, entity ownership checks and cleanup jobs require explicit approval.
- **Migration:** additive associations, optional reviewed re-association, no automatic legacy deletion.
- **Difficulty / priority:** medium-high / P2.
- **Core fallback:** disabled unsupported upload with explanation; existing verified document actions remain.

### O10. Bounded large registers

- **Current:** some managers load/render all accounts/counterparties/items; transaction pagination is already present.
- **Problem:** layout polish cannot prevent slowdown for hundreds/thousands of records.
- **Proposal:** measure cardinality and add server pagination/search/indexes per module only where warranted; preserve deterministic sorting and global summary scope. Virtualize only if necessary and accessible.
- **Benefit:** reliable speed and small interactive surfaces.
- **Risk:** filtering only the loaded page, disappearing selection, incorrect totals from partial data.
- **Existing data:** none changed.
- **APIs:** pagination/cursor/count extensions; compatibility adapter for old consumers.
- **Supabase:** indexes based on real query plans, separately reviewed.
- **Migration:** additive indexes if needed, contract rollout; no record changes.
- **Difficulty / priority:** medium / P2 unless benchmark shows blocking performance.
- **Core fallback:** existing pagination where available, avoid per-row charts, measure current large-list behavior honestly.

### O11. Idempotent financial mutations and reconciliation

- **Current:** atomic creation RPC exists; other update/delete/settlement/credit and attachment paths perform multi-step operations and compensation.
- **Problem:** a network timeout can leave the user uncertain whether a write happened. UI double-submit prevention alone is not atomicity or idempotency.
- **Proposal:** audit mutation boundaries with failure injection; introduce request IDs/idempotency and server-side atomic transactions for confirmed vulnerable paths, one domain at a time.
- **Benefit:** safe retry, explainable uncertain states and consistent related records.
- **Risk:** broad rewrite of financial effects can regress balances, settlement order or attachments.
- **Existing data:** no blind repair. Reconcile any detected mismatch using a reviewed report and targeted process.
- **APIs:** explicit request ID/status/result lookup and conflict behavior; versioned as needed.
- **Supabase:** transactional RPC changes and possibly idempotency/audit tables with strict user ownership.
- **Migration:** additive keys/records and compatibility path; original mutation path retained until parity validated.
- **Difficulty / priority:** high / P1 for proven unsafe paths, otherwise P2.
- **Core fallback:** bounded submit UI, unknown-result copy, current reconciliation behavior; never auto-retry a financial write.

## 11. Implementation Handoff for GPT-5.6 Sol

### 11.1 Operating instructions

1. Read repository rules and this plan. Confirm the owner approved V1/V2/V3 below and identify independently approved S/O packages. Do not infer approval of optional backend work.
2. Reconcile baseline against the chosen implementation branch and any newer main commits. Record the exact SHA. Do not overwrite current user changes.
3. Treat the preview as geometry/color/interaction reference, **not production source**. Its fixtures, local state, simulated validation and informational stand-ins must never reach the real app.
4. Each PR contains one operational module or one shared prerequisite. Stability fixes, domain refactors, new features and visual redesign do not share a PR.
5. Keep route paths, public query names, schema, RLS, auth and API shape stable during visual stages. Rename visible labels only as approved here.
6. Preserve existing financial helpers and add presentation adapters around them. If data is insufficient, use the exact unavailable state, not a design invention.
7. Use the locked recipes; do not conduct a new style exploration, invent a new dashboard, add health scores or reintroduce deleted presentation concepts.
8. A new ambiguity discovered in code should be documented with its affected decision and safe existing fallback. Escalate only if implementation would change a protected contract or invalidate the approved outcome.

### 11.2 Shared component targets

Prefer consolidating existing primitives with compatibility props. Suggested new files are concrete intended integration zones, not permission to delete their predecessors.

| Component | Target | Contract |
|---|---|---|
| `MoneyText` | `components/finance/MoneyText.tsx` | `value`, `currency`, `availability`, `direction`, `precision`, optional equivalent/provenance. Formats only; no conversion. |
| `FinancialScope` | `components/finance/FinancialScope.tsx` | scope title, period/asOf, native/report/equivalent basis, exclusions, unavailable source. Clickable information control. |
| `PositionBand` | `components/finance/PositionBand.tsx` | ordered native currency facts and up to2 secondary fact groups; wraps responsively. |
| `RecordTable` / mobile record | evolve `components/finance/data-table.tsx` and existing table primitives | semantic columns, existing sort/selection/pagination, mobile render recipe, detail trigger. |
| `FilterBar`, `FilterDrawer`, `ScopeChips` | `components/finance/filters/*` | draft/apply, current query adapters, saved views kept in owning module. |
| `DetailDrawer` | `components/detail/DetailDrawer.tsx` | open/close, title, focus restoration, scroll retention,520px width, shared direct-route content. |
| `RecordFormDrawer` | evolve `components/ui/RecordModal.tsx` or thin adapter |580px ordinary /960px schedule, mobile full screen, unsaved state and sticky footer. |
| `DataBoundary` | `components/finance/DataBoundary.tsx` | initial/slow/error/empty/filtered/stale/partial/ready from existing data state, no fetching/mutation side effects. |
| `ChartFrame` | `components/charts/ChartFrame.tsx` | title/scope/legend/data alternative/error, actual11px min labels, shared tooltip theme. |
| `MonthlyFlowBars` | migrate MoneyFlowChart | current series mapping, no new formula, single axis. |
| `BudgetProgressRow` | share dashboard and budget list | exact metrics, capped visual fill, uncapped value and excess. |
| `CommitmentList` | `components/finance/CommitmentList.tsx` | verified due date, original amount/currency, type/status, owning link, partial coverage. |
| `CurrencyBucketSummary` | reuse obligation helper/components | one currency bucket per row, unknown outside trusted total. |
| `LinkedRecordList` | `components/detail/LinkedRecordList.tsx` | actual persisted relationships, no new inference by matching description. |

`lib/tokens.ts`, `app/globals.css`, `tailwind.config.ts` and font loading must agree; do not leave two contradictory “sources of truth.” Keep compatibility aliases until the last consumer migration. New globals must be scoped behind a V3 root attribute during development. React server/client boundaries remain intentional: formatter/adapter pure where possible; interactive drawer/tab/filter client; financial service untouched.

### 11.3 Exact recommended sequence

| Stage | Deliverable and project zones | Dependencies / acceptance | Tests and rollback |
|---|---|---|---|
| 0 | Approvals, baseline SHA, safe Preview fixture set, security/stability issue register | Owner V1 decision, S01/S06 status explicit, baseline screens retained | No runtime change; documentation rollback only |
| 1 | Independent prerequisite packages S01–S06 where approved | Keep each concern separate; close gates needed by later modules | Cross-user/long-history/partial-error/inactive-bank tests in safe environment; package-specific revert |
| 2 | V3 fonts, tokens, dark mapping, scoped root opt-in; `globals.css`, Tailwind, `lib/tokens.ts`, layout font import | Final palette/type values from§4; old pages must retain old look until opted in | Sentinel screens in both themes, contrast and no layout shift; remove V3 flag to restore prior theme |
| 3 | MoneyText, FinancialScope, PositionBand, DataBoundary | No money/FX calculation changes; unknown≠zero | Pure presentation fixtures: negatives/zero/unknown/custom/large/multi-currency; revert components/imports |
| 4 | Buttons, inputs, selects, menus, tabs, toast and focus | All states,44px touch, keyboard behavior; compatibility props retained | Component keyboard/form-error/reduced-motion checks; revert adapter usage |
| 5 | Table/filter/detail/form shell primitives and ChartFrame | Exact row/drawer geometry and filter semantics; no module-specific mutation extraction | Focus trapping/return, dirty dismiss, URL filter, overlay collision,320/390/834/1440; rollback primitives independently |
| 6 | Shell/IA: AppShell, Sidebar, Topbar, NavItem, nav constants, quick-create placement | Existing paths/gates preserved; approved label changes; no auth/layout-data refactor | All links/quick-create URLs, desktop rail, mobile bottom nav, sign-out/menu, private mode; opt-in shell rollback |
| 7 | **Accounts visual pilot** | S05 closed; S06 account fixtures; current integrity helpers intact | All6 Portfolio unit suites + create/edit/active/inactive/technical/custom currencies/metadata failures; revert only Portfolio view |
| 8 | Assets module and detail | Shared forms/register stable; status/type helper preserved | Asset status/custom type/unsupported attachments, linked purchase flow; module revert |
| 9 | Movements register, filters, saved views, export, detail drawer | No creation-form rewrite in this PR; existing list params preserved | Saved views, selection/bulk, pagination, direct details, filter URL, export scope; revert register composition |
| 10 | Transaction chooser + create/edit/direct new flow | Stage9 stable; all8 operation fixtures; preserve schemas/orchestrator | All8 create paths, edit with links, settlement limits/currency, attachments, duplicate submit; revert form view only |
| 11 | Budgets list/detail/form + shared progress row | Current period/series scope helpers retained | Period targeting, over-limit,0 limit, foreign currency current conversion parity; module revert |
| 12 | Credits list/detail/card/loan/schedules | Rates/schedule/detail helpers retained; any unavailable native field has explicit state | Dual currency, native mismatch, exact schedule components, documents, create/edit; module revert |
| 13 | Receivables list/person detail/create/collect | No opening-balance migration unless O07 independently approved | Currency buckets, unverified initial amount, partial collect/exact target, overpayment/attachment guards; module revert |
| 14 | Payables list/person detail/create/pay | Receivables visual pattern may be reused, action code not copied blindly | Same domain tests with opposite direction, dispute/partial/paid; module revert |
| 15 | Templates and then Notices in two PRs | No scheduler or resolution-state invention | Template use prefill/edit limits; read vs paid, generator failure, manual notice and bulk behavior; independent reverts |
| 16 | **Dashboard assembly** from already verified components | S02/S03 closed or safe labels; verified native source coverage; modules available for drill-down | All source failures independently, partial/stale, data/chart parity, partial month, custom currencies, no score/forecast claims; dashboard revert |
| 17 | Settings, Catalogs, developer/status, then auth/public styling in separate PRs | No security/auth/API behavior changes; no mixed import refactor | Profile preload, reset cooldown, import/export/rollback in disposable data, permissions/redirects; surface-specific revert |
| 18 | Consumer audit, compatibility cleanup, complete visual regression and release evidence | Every migrated consumer verified; owner visual acceptance; production readiness gate closed | Full relevant suites/build/Preview/device checks; cleanup revert separate from any rollout |

Dashboard is designed first but integrated after its reusable data surfaces are stable. This avoids repeatedly redefining cards, periods and money while the overview is being built. The previous plan's exact stage order is intentionally superseded by this one after approval.

### 11.4 Rollout and rollback

Use a frontend-only V3 root/feature switch initially scoped to development/Preview. It must not alter auth or expose data. Separate shell flag from module flags so an unapproved module does not receive accidental final styles. Keep old component signatures and aliases during migration. Avoid two fetching components mounted hidden at once; choose the active renderer, do not duplicate mutations or subscriptions.

For every PR record: changed files, visual purpose, protected functions untouched, exact prerequisite IDs, screenshots with fixture/version/viewport/theme, test evidence and gaps, last known-good commit, one-command revert target. Deploy only to an approved non-production Preview after owner authority; local screenshots are not deployment evidence. Merge/release approval remains separate.

Rollback trigger: financial-value mismatch, lost existing action, incorrect currency/date, inaccessible control, infinite loading, hidden partial failure or route/auth regression. First disable/revert the affected visual module or PR; do not mix rollback with a new design. Because visual stages contain no database migrations, rollback is code-only. Optional structural packages require their own migration/rollback plans and must never depend on reverting a UI snapshot to repair data.

### 11.5 Things Sol must not reinterpret

- Light-default/fully supported dark, blue action role, Manrope and numeric precision.
- Native currency separation, accounts-versus-cash and debt-versus-credit distinctions.
- No financial health score/radar, unqualified net-worth hero, wealth sparkline or combined available-cash-plus-credit metric.
- No global date/currency filter implying unsupported recalculation.
- Exact bottom navigation, sidebar route order, existing paths and8 operation identities.
- Drawers/row density/form section sequence and mobile record transformation.
- No missing-value-to-zero, invented schedule, invented date, sample data in real modules, inferred attachment success or read→resolved relabel.
- Optional O items remain separate. A visually attractive chart does not justify new finance logic.

## 12. Acceptance and QA contract

### 12.1 Financial golden fixtures

Before each integration stage, capture API/source values for a deterministic synthetic dataset and compare before/after render from the same values. Golden cases include PEN/USD/custom currencies; negative/zero/large balances; inactive and technical accounts; income/expense/transfer; credit consumption/payment; debt creation/partial settlement; mixed-currency contacts with unverified opening balance; dual-currency card; exact loan schedule components; budget series with adjacent periods; asset custom type and3 statuses; attachments AVAILABLE/UNVERIFIED/legacy; dates at month end and around Lima midnight.

Pass conditions: no stored-value or formula result changes; every original amount and relationship survives; transfers excluded from income/expense under existing rules; currency buckets never collapse; no unsupported financial assertion; selected record/period mutation target unchanged. Intentional label/chart removal is permitted only as approved by this V3 plan and recorded in the before/after change list. Existing baseline rules that forbid all visible changes do not override this explicit new design scope.

### 12.2 Visual and responsive matrix

Required integration captures:320×800,390×844,430×932,768×1024,834×1112,1024×768,1280×800,1440×900,1440×1080,1920×1080; both themes for primary flows. 200% browser zoom at1440 and text expansion+30%. Do not substitute a scaled desktop screenshot for responsive mobile.

Inspect: no page overflow, no clipped monetary values, no sticky footer covering error/focused input, no tooltip/menu clipping, labels remain readable, tab/selection active semantics, standard icon stroke and token usage, no duplicate CTA/FAB, calendar-date correctness, identical money in all sizes, minimum44px touch controls. At reduced motion all nonessential movement disappears. Main sections are visually distinct through spacing/dividers, not random card shells.

Screenshot acceptance tolerances: same fixture/route/state/theme/font; principal boundaries within±4px at approved widths, spacing/token values exact, chart/amount alignment visually consistent, no unauthorized hierarchy or additional KPI. Do not use per-pixel screenshot thresholds across operating-system font renderers as financial correctness evidence. Automated snapshots protect regressions on a fixed browser image; owner reviews intentional changes.

### 12.3 State matrix per route

For each operational module run: initial load; slow read2s; timeout10s; unauthorized response; primary fetch failure; auxiliary options failure; true empty; filtered empty; ready; refresh failure with stale data; unavailable currency metadata; blocked action; submit busy; submit validation error; uncertain write; retry/reconciliation. If a state is not meaningful, record why rather than mark it passed.

Dashboard special: fail each source independently, verify siblings; a failed read cannot generate zero facts or a positive health assertion. Test partial current month, no income, negative result, missing months, >N monthly history, no budgets and no due dates. Test cross-currency position with a custom code and incomplete metadata.

### 12.4 Functional and accessibility acceptance

Keep current unauthenticated redirect/API tests. Authenticated E2E requires a disposable non-production Supabase/user, never the owner's real finances. Update the management selector mismatch before claiming it passes. Re-run relevant existing suites per stage, then full unit+type/lint/build and authenticated smoke at release. Verify browser back/direct URLs/query quick-create still work.

Keyboard-only: navigate shell, open/create/cancel a record, apply/reset filters, select a table row, inspect chart data, edit via drawer, handle dirty dismissal, and return focus. Check screen-reader announcements and semantic tables; focus stays visible and unobscured. Contrast target is WCAG2.2AA: normal text4.5:1, large text3:1, essential UI states3:1. The internal touch target44px exceeds the WCAG2.2AA24px minimum; do not claim44px is the AA minimum. Verify actual combinations in both themes.

References for these narrow accessibility requirements: [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). This is an engineering target, not a claim that the prototype or current app has a full accessibility certification.

### 12.5 Performance acceptance

Measure before/after on the same Preview fixture/device/network. Goals: navigation shell response≤100ms, local filter feedback≤100ms for100 rows, synthetic loading geometry visible≤200ms, no avoidable layout shifts (targetCLS≤.1), no new blocking dashboard dependency. Record network count/server timings rather than hiding them with skeletons. Production runtime targets require measured p75 evidence; this mission does not claim they are achieved.

Keep heavy chart code out of modules that do not use it; mount analysis only when entered, with clear loading states. Do not preload every full module blindly. Reuse font assets and prevent external font waterfalls. No new JS library solely for a simple chart, focus ring or animation. A cold dashboard read still depends on backend correctness; O01 is a separate optimization, not a promised result of CSS.

## 13. Visual deliverables and review procedure

Artifacts under `docs/redesign-v3/`:

- `preview/index.html`, `design.css`, `app.js`: isolated navigable high-fidelity proposal; original Spanish UI, synthetic data only.
- `preview/fonts/*`: local Manrope files and license, deterministic offline typography.
- `preview/serve.mjs`: static server bound to127.0.0.1, serving only the preview directory, with `connect-src 'none'`.
- `preview/verify.mjs`: local Playwright visual/interaction checks; imports no application auth/config and calls no production APIs.
- `screenshots/`: standalone readable captures covering desktop/tablet/mobile, light/dark, transactions, accounts, budgets, credits, forms, detail, loading, partial error and empty.
- `README.md`: launch instructions and limitations; `QA_REPORT.md`: executed evidence and open verification gaps.

Run `node docs/redesign-v3/preview/serve.mjs`, then open `http://127.0.0.1:4173/`. It also works by opening `index.html` directly in a browser with local sibling files. Navigation stays in hash URLs. Theme and state controls live in a clearly separated proposal bar and are **not** production UI. No publish/deployment was performed.

Suggested review: Inicio desktop → tablet834 → mobile390; compare dark; Movements→inspect a row→edit→cancel with changes→save simulation; use search and USD filter for no-results; Accounts→opening/current detail; Budgets→exceeded period; Credits→schedule; switch dashboard to partial-error and first-use. The prototype is intentionally a design simulator: saves do not mutate real or durable synthetic data, and summary values remain fixed. Some secondary module actions open scope explanations; they are not claimed as completed production features.

### 13.1 Coherent sample fixture

As-of September21,2026. Account PEN:18,640 +7,200 +1,000 =26,840; USD3,200 separately. September report sample is entirely PEN: Income9,600 +2,880 =12,480; Expense2,480 +1,800 +1,080 +860 +640 +500 =7,360; Result5,120. Internal transfers600 and1,000 are excluded from that result.4 budgets: limit5,450, linked spending4,380, remaining1,070; Transporte800 limit/860 spend/60 over. Card debt4,800PEN and180USD; illustrative line-equivalent debt at3.8 is5,484/15,500=35.38%, shown35.4%. That sample FX is not a real rate recommendation. Loan installment500 capital+150 interest+20 insurance+10 other=680. Assets35,000+3,500=38,500PEN.

Totals describe the fixture scope, not necessarily the page's search subset. Charts/history outside September are synthetic monthly aggregates, not extracted real transactions. The fixture makes no claim that current balances can be derived solely from the12 displayed September records; balances also reflect prior records/opening positions.

## 14. Approval decisions and completion

| Approval | What the owner approves | What it does not authorize |
|---|---|---|
| **V1 Product and visual direction** |§3–9: navigation/labels, hierarchy, palette/type, components, forms, responsive, dark, chart changes and safe semantic labeling | Backend/financial changes, migrations, security changes, production rollout |
| **V2 Mark** | The simple F/register mark displayed in the preview, if preferred | Does not invalidate existing deployed logo assets until a specific brand asset PR; if declined, keep current mark while using V1 |
| **V3 Implementation sequence** |§11–12: staged module work, QA gates and rollback | Does not automatically merge or deploy PRs |
| **S01–S06** | Each explicitly authorized investigation/fix with its bounded scope | Unrelated changes to auth/RLS/business logic |
| **O01–O11** | Individual structural investment; each gets a concrete separate specification/approval before mutation | No bundled schema/API authority from liking the design |

This design mission is complete when the master plan, visible artifacts, repository-grounded findings, optional-change register, operational handoff and QA evidence are delivered. Production implementation has not started. Do not treat this document's existence as owner approval or completion of Gate1.

## 15. Owner summary (Spanish)

FinTrack pasaría de mostrar muchos indicadores al mismo nivel a explicar tres cosas: tus saldos por moneda, el resultado del período y los compromisos que debes revisar. La identidad sería clara y sobria, con azul para actuar, números alineados, tablas fáciles de recorrer y formularios que aparecen sin perder el contexto.

Conservaría registros, relaciones, rutas, cálculos, autenticación y las protecciones financieras recientes. Quitaría del inicio el radar de salud, las metas no configuradas y las proyecciones que parecen más seguras de lo que permiten los datos. Detecté oportunidades reales en reportes, fechas, monedas, patrimonio y recurrencias, además de verificaciones pendientes de seguridad y estabilidad.

Debes aprobar la dirección visual/producto, el símbolo si lo deseas y el orden de implementación. Los cambios estructurales se aprueban por separado. Después Sol podrá implementar componentes y módulos siguiendo medidas, colores, reglas financieras, comportamientos y pruebas definidos aquí, sin tener que volver a diseñar el producto.
