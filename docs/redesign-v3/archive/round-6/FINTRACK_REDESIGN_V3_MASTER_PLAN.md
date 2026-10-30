# FinTrack V3: Product and Design Master Plan

**Round 06 — source-audited operational actions and brief animated confirmation. Design refinement awaiting owner approval; not authorization to implement or release.**

Prepared September 21–23, 2026. Repository baseline: `4fdbe715f1a887ff59fc64868bf2da06c2d0cdae`, branch `codex/redisenio-total`. The branch was created from local `main`; the earlier Git inspection showed local `main` behind the known remote by three commits. No fetch, merge, or production access was performed. Reconcile the approved implementation base before starting work.

This is the implementation source of truth for GPT-5.6 Sol **after approval**. Existing redesign documents remain intact and historical. The current brief refines the established direction; it does not reopen identity, route hierarchy or the main dashboard architecture. Round06 corrects action feedback and audits operational capabilities; round05 material, selections and credit direction remain. It does not authorize production code, database, API, auth or calculation changes. Repository stability requirements remain release gates; they do not prevent this isolated design study.

Round06 supersedes round05's persistent receipt/result-screen behavior and unsupported category-state demo. Sections6.6–6.7 are authoritative for actions and feedback. The complete round05 predecessor is preserved in `docs/redesign-v3/archive/round-5/`. Earlier archives1–4 remain intact. Round05 palette, round04 shell/density, round03 workbenches/charts and the FT12 identity remain unless explicitly refined here. `FINTRACK_REDESIGN_V3_SOL_HANDOFF.md` is the execution companion; `PRODUCT.md` is strategic context. Production financial contracts prevail over abbreviated simulator forms. Ask about a contradiction rather than redesigning it.

## 1. Decision and intended product

FinTrack should be a **clear personal financial record that connects position, movement and commitments**. Its advantage is understanding relationships: a purchase changes a balance, may create an asset, may use credit, and may consume a budget. The interface should make those relationships inspectable without requiring the user to understand database tables.

The refined direction is **Connected Financial Clarity**: a complete financial workspace with an inspectable chain from position to explanation to records to action. A person opens FinTrack at a desk to review a month, or on a phone after a purchase to record what happened. The interface feels calm, precise, legible and capable, not sparse. Light is the default because sustained comparison of rows and forms is the dominant workflow; dark is an equally specified preference for evening use. Neither theme changes the financial meaning of color.

The signature consists of:

1. A horizontal position band separating native currencies instead of a giant, ambiguously consolidated wealth number.
2. A record-oriented navigation hierarchy and a compact, date-led commitments list.
3. A consistent distinction between stock (today's position), flow (a dated interval), and commitment (an obligation).
4. An inspectable trail from summary to filtered records to linked detail to action.
5. Recognizable teal for action, green for income amounts, red for expense amounts, neutral for transfers; charts retain neutral outlined expenses rather than becoming a red dashboard. Dark surfaces are graphite, not green. The FT Ligature and restrained gold node connect product and identity.
6. Different visual structures for different jobs: one position band, one integrated monthly report, date-led commitments, dense record rows and compact budget/credit controls. Not twelve interchangeable cards.

Avoid a trading terminal, gamified financial score, bank connection claims, gradients, floating decorative cards, red expense-row backgrounds, charts that imply fabricated history, and a second navigation system inside the dashboard that duplicates every module.

### 1.1 Alternatives considered

| Direction | Strength | Why it was not selected |
|---|---|---|
| Merely recolor round 01 or copy the former Portfolio layout | Preserves recognizable identity | Color alone does not resolve sparse context, missing recent activity or wasteful tablet composition. Retain the identity family, redesign the hierarchy. |
| Wealth-first dashboard with a prominent net-worth curve | Immediate emotional reward; attractive long-term narrative | The repository does not establish a complete reconciled net-worth model or real wealth snapshots. The visual promise would exceed the data. |
| Activity-first ledger with no overview | Excellent speed for frequent recorders | Makes obligations, budgets and the current multi-currency position harder to discover. |
| **Connected position + monthly explanation + operational follow-through** | Understandable with current concepts; supports review, recording and exception handling | Selected. Adds existing useful facts without adding unsupported financial claims. Some correctness/availability gates remain independent. |

### 1.2 What success looks like

In a five-person usability review using synthetic data, at least four participants should, without explanation: identify PEN and USD balances separately within 10 seconds; distinguish a transfer from an expense; find the next recorded payment and its detail within two navigation actions; register a simple expense without opening an unrelated module; explain that a read notification is not a paid debt. These are acceptance targets, not research already performed.

Also test a two-step question: “Why is the monthly result S/ 5,120.00?” The participant must open its explanation and reach Alimentación's underlying records without restarting a search. Success is useful comprehension, not the number of widgets above the fold.

### 1.3 Critical review of round 01

| Round 01 | Refined direction | Why the change is better |
|---|---|---|
| Blue action identity and a generic F mark | Teal/green mineral neutrals; Concept 12 FT Ligature; restrained gold node | The blue had no compelling product advantage. The selected identity is recognizably FinTrack without copying a bank aesthetic. |
| Large position block with assets/card debt secondary | Compact position band: native accounts, documented receivables and payables | Connects today's records to what is still owed. Assets remain in their module; debt is explicit in a separate credit region. |
| Flow chart and a disconnected spending panel | One monthly report containing exact totals, flow and income/expense category ranking | The chart explains the numbers immediately; no extra equal-weight panel for the same interval. |
| No recent register on Inicio | Five latest movements with date, account, category, original amount and direct detail | Makes checking and correcting work possible immediately after opening FinTrack. |
| Three upcoming commitments with little exploration | Four desktop/two mobile, 7/30-day scope, complete interval drawer, native amount and exact source | More operational value, while avoiding an unsupported universal calendar or automatic payments. |
| Income categories relegated to another screen | Income/expense switch in the same analytical region | Uses an existing reliable dimension without adding a second chart card. |
| Secondary card debt but no concise credit context | Card native debt, line utilization and loan principal kept visibly separate | Useful debt review without equating credit capacity with own money. |
| Generic new-movement first action | Direct desktop/tablet expense entry plus the complete operation menu | One fewer step for a common task; preserves all eight real operations. Historical round02 decision: mobile center Registrar. Round04 replaces it with the right-hand creation slot specified in§3.1. |
| Tablet mostly stacks wide content | Full-width report; agenda and budgets side by side; full-width recent register and compact credit region | Uses a tablet as a larger work surface, not an enlarged phone. |
| 64 px ledger rows, 224 px sidebar, oversized whitespace | 56 px two-line rows, 208 px sidebar, 56 px topbar, independent desktop columns | More useful records and fewer artificial holes; primary values remain readable. |
| Result is mostly a number | Result explanation → category → filtered register, with removable scope | The summary becomes an entry into investigation, not a dead end. |

Preserved: native currency honesty, single-overview navigation, Manrope, clean dividers, drawers, progressive forms, dark-mode parity, no unqualified wealth or financial-health promise. The previous tablet design was not wrong because it scrolled; it was weak because content relationships did not exploit available width. Round 02 is denser in useful information, not necessarily shorter in total page height.

### 1.4 Reference interpretation and deliberate exclusions

The supplied image is useful for its simultaneous overview and working detail, meaningful variation in region size, date-led obligations, compact indicators and connections between categories and totals. Apply those principles to actual FinTrack data. Do not copy its four equal KPI cards, Sankey, treemap, savings goals, projected balance/confidence band, subscription detection, bank synchronization, AI insights, invented trends or feature labels. Their presence in a reference does not establish data or capabilities here.

The logo proposal HTML is an asset source, not authority over the owner's selection. Its recommendation of another concept does not override **Concept 12**. Preserve the essential FT paths; refine application, optical sizes and theme treatment rather than running another logo search.

### 1.5 Round03: elevate the established direction, do not reinvent it

The financial questions, FT12 artwork, teal/green palette, native-currency rules, navigation, dashboard region order and source contracts remain locked. This round improves the **quality of interpretation and transition**: a selected month explains itself, a record carries its meaning into its workbench, and editing does not discard the surrounding context. No new metric, endpoint, financial feature or structural opportunity is required by this refinement.

| Before — round02 | After — round03 | Why |
|---|---|---|
| Paired bars with an undifferentiated default-chart treatment | Solid income / outlined neutral expense; quiet grid; selected-month wash, delta bracket, anchored readout and exact-value tooltip | Financial flow becomes inspectable without introducing a different chart or decorative series. |
| Small category bars, share less consistently visible | Ordered ranking, exact amount plus share on every row,4px inlaid track, larger touch enclosure | Scan rank, magnitude and contribution together; retain summary→records action. |
| Multiple incidental radii and square edge-attached drawers | Explicit6/10/14/18/24px system, optical8px inset,16px mobile region adaptation | Surfaces feel related across lists, forms, menus and contextual work. |
|520px detail changes into580px edit | One580px detached workbench for detail/filter/ordinary form | Stable spatial context; the content changes, not the containing frame. |
| Amount, generic facts, two footer actions | Source breadcrumb, read/edit mode, financial summary, account/classification relationship, Detail/Context tabs, visible-order navigation and guarded back action | More useful context rather than more empty panel area or invented advice. |
| Instant/general overlay behavior | Context docking: frame, veil and content use coordinated but different timing; anchored menus; interrupted exits remain safe | The motion describes hierarchy and origin instead of applying one transition everywhere. |
| Screenshots explain static states only | Live motion workshop with real/slow/reduced controls and dedicated interaction QA | Owner can evaluate the actual transition, not approve prose about it. |

Explicitly rejected: Sankey or streams implying new accounting relationships, smooth curves through monthly aggregates, gradient-filled area decoration, bar-growth/count-up, chart animation on every hover, floating financial cards, background-page scaling, glass blur, spring overshoot and theatrical route choreography. Round04 allows the bounded three-level reveal in§4.4. More expressive does not mean more charts. More motion does not mean movement on every action. The refinement does not reopen round02's optional backend register or silently approve any S/O package.


### 1.6 Round04 decision — make the established workspace scale

| Before — round03 | After — round04 | Why |
|---|---|---|
| Credit preview relies on two large product cards and no shared Planning summary | Three-part summary + compact filtered/paginated register + selected-product workbench, even for two records | Scales to many cards, loans and lines without multiplying large containers |
| Budget exception occupies a third of the page | Compact exception band above a full-width register | Keeps the factual action visible and gives amount/progress columns more room |
| Dark surfaces visibly green | Soft-black/graphite canvas and charcoal surfaces; teal reserved for actions/selection | Preserves FinTrack without bathing every surface in green |
| Movements repeats type under every description |48px desktop rows,56px tablet, compact rich mobile rows; amount encodes income/expense/transfer | More visible records, less redundant text; direction readable at a glance |
| Rail mostly a breakpoint behavior | User-controlled208↔68 desktop, temporary labeled tablet overlay, stationary FT mark | More workspace without losing identity or orientation |
| Module replacement immediate | At most228ms, three-level pointer reveal; keyboard/reduced immediate | Clarifies context change without waiting for an exit or staging every row |
| Creation relies on page actions and a center mobile action | Compact persistent bottom-right Registrar; dedicated mobile dock slot; all8 operations plus relevant module creation | Accessible after scrolling, not a floating obstruction over financial amounts |
| Preview calls a loan amount “Capital pendiente” | “Capital original” from the verified presentation contract; unavailable remaining principal stays unavailable | Correct meaning without changing financial math or data |

Scope remains design-only. No new backend change is necessary or approved. Skills constrained this refinement toward denser product patterns, bounded motion and interruptible focus-safe surfaces. The owner's explicit request for a restrained route transition takes precedence over the skill's default avoidance of page animation; the result is the specified short reveal, not page choreography. No new logo exploration or dashboard data source was introduced.


### 1.7 Round05 decision: precision over pervasive brand color

| Before (round04) | After (round05) | Why |
|---|---|---|
| Green-tinted canvas, surfaces, borders and secondary text | White surfaces, cool-neutral gray canvas/insets, graphite text and restrained deep teal | Identity becomes a meaningful accent instead of a color cast over every object |
| Visible 2/12/40 credit scale selector and a separate extended fixture | All 12 available products by default; normal search/type/state/page controls; coherent recorded agenda | Users review their products, not a demonstration mode |
| Native select for short lists, search only above a threshold | One searchable selection vocabulary for every option count, with metadata and explicit commit | No new interaction to learn when a list grows |
| Save closes into a generic toast | Historical round05: persistent receipt; **withdrawn by round06 §6.6** | Owner clarified that confirmation must be brief and self-dismissing |
| Action outcomes mostly described | Historical round05 local demo; round06 corrects unsupported category state and adds actual module actions | Source audit, not the previous prototype, determines capabilities |

Keep the original FT12 geometry and brand asset colors. Deep teal UI primary is now #155E59; the logo retains #086D6D structure, #2BA77D flow and #D7B66F gold. Logo identity need not be copied onto every control or background. No new architecture, chart family, financial metric or backend feature is introduced.

### 1.8 Round06: operate, acknowledge, continue

| Before | After | Why |
|---|---|---|
| Successful save replaces drawer content with a large result screen | Close on confirmed success; a4200ms floating acknowledgement appears and retires automatically | Preserves flow without another dismissal step |
| Persistent success band above list | Updated record + brief notification; error cause remains inline | Success is lightweight; unresolved work remains discoverable |
| Different or missing record actions by module | Audited module primary, visible record action, consistent More menu and exact per-module capabilities | Operational clarity without inventing duplicate/archive/delete behavior |
| Categories demo included activate/deactivate | Categories create/edit/delete; state demo uses Entidades | Matches real handlers rather than copying a previous design mistake |
| Asset deactivation ambiguous | `Marcar como vendido` names ACTIVE→SOLD; no sale proceeds implied | Honest existing behavior without changing financial logic |
| Bursts overwrite generic toasts |2 desktop/1 mobile, FIFO, hover/focus/hidden pause and contextual persistent errors | Handles rapid work without losing errors or stealing focus |

Impeccable and Emil Design Engineering informed the restrained action hierarchy, anchored surfaces, bounded motion and accessible timing. Frontend Design guided the live HTML integration. They did not change identity or authorize production changes.

## 2. Research basis and limits

This proposal is grounded in source inspection of the actual repository, not an authenticated production walkthrough. No live database schema, RLS deployment, user records, balances, bank accounts or production settings were inspected or changed. Static findings below identify code behavior or risks; they do not certify the currently deployed environment.

Reviewed areas: App Router routes/layouts; shell/navigation/theme providers; operational workspaces, forms and register components; dashboard widgets and services; schemas and transaction orchestration; account/credit/obligation integrity helpers; budget metrics; SQL migrations, views, triggers and RPCs; auth middleware and callback boundaries; import/export and attachment paths; error and timeout helpers; tests; global CSS, Tailwind and token modules; installed skill catalog; previous redesign and stability documents.

Earlier material used as context: `REDESIGN_MASTER_PLAN.md`, `REDESIGN_VISUAL_BASELINE.md`, `DASHBOARD_RESTRUCTURE_PROPOSAL.md`, `FINTRACK_APPROVED_REDESIGN_BLUEPRINT.md`, `FINTRACK_REDESIGN_APPROVAL_ROADMAP.md`, `GATE_1A_STABILITY_EVIDENCE_REPORT.md`, `GATE_1_STABILITY_CLOSURE_REPORT.md`, `QA_CHECKLIST.md`, and the targeted loading/preload plans. Round 02 additionally examined the complete first V3 plan/prototype, the owner's attached image and `/Users/eliaspaco/Downloads/fintrack-logo-redesign-proposals-v2.html`, including the actual Concept 12 SVG. The earlier blueprint also specifies FT12; this supports continuity but does not replace a fresh evaluation.

The applied skills are `impeccable` (product register, clarity, cohesive surfaces and states), `frontend-design` (a coherent high-fidelity prototype), and, in rounds03–04, `emil-design-eng` (purposeful motion, anchored origins, interruption and immediate keyboard interaction). Their influence is constrained to these artifacts, not production changes. `ui-ux-design-pro` was assessed but its preset generation was not applied. Installed brand-library styles were not blended. Image-generation and image-to-code workflows were not selected: readable financial numbers, real responsive layout and testable interactions benefit more from HTML/CSS/SVG here. The user's extensive strategic brief and repository research provide the product context; no separate skill onboarding interview is required to exercise the explicitly delegated design judgment.

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
| F15 | Large `full-form` modal preset reaches 1680px; transaction operations/inline creation have many parallel sections | Registration competes with the underlying workspace and increases scanning distance | 580px main form drawer, 960px maximum for schedule-heavy forms, near-full-height mobile with8px gutters |
| F16 | Multiple small type scales (10–11px), many color roles, local shadows/radii and several fonts | Visual prominence follows widget construction rather than financial importance | One type family, simpler surfaces, 12–14px routine text, specified data hierarchy |
| F17 | Historical synthetic Portfolio charts and earlier currency/schedule/attachment blockers were already addressed by G1B–G1G | Repeating old diagnoses would waste work and risk reversing fixes | Explicitly preserve current helpers and tests; do not reopen closed packages |
| F18 | `GET /api/debtors` calls `repairLegacyReceivableLinks`; `GET /api/receivables` does so when `debtor_id` is supplied. `lib/server/receivable-link-repair.ts` can insert missing receivables and update links during a read | Mounting a seemingly harmless new dashboard query can change financial records | No such calls during this study. Dashboard uses unfiltered document reads without debtor_id; never adds contact repair reads. Explicit repair workflow is optional O12, separately approved. |

The critical security finding is a source-level risk, not a claim of confirmed access to another user's records. Sol must not test it with real user IDs or alter policies as part of the redesign.

## 3. Locked design decisions for approval

Approving the visual proposal approves these product presentation changes, not optional structural items:

| Decision | Exact choice |
|---|---|
| Primary navigation | Inicio, Movimientos, Cuentas; then planning and position modules in the order below |
| Terminology | Dashboard → Inicio; Portafolio → Cuentas; Recurrentes → Plantillas; Alertas → Avisos; Administración → Catálogos |
| Routes | Keep existing pathnames, IDs, query-driven creation contracts and permissions |
| Dashboard | Connected monthly report, position/pending band, agenda, budgets, five recent records and separate credit context; no duplicated module tabs |
| Wealth and credit | No unqualified net-worth hero and no cash + credit “available” total |
| Money | Native currency first, exact decimals, explicit approximation/provenance for an existing conversion |
| Charts | Grouped monthly bars, ranked category bars, budget bullet rows; remove score and decorative history |
| Tables | Movements48px desktop /56px tablet; ordinary two-line registers56px minimum; credit68px rich rows with bounded pagination. Exact right-aligned money; existing alternate card views remain secondary, never the default for small datasets. |
| Forms | Progressive sections, 580px drawer for ordinary operations; long schedule form is a dedicated 960px surface |
| Theme | Light default, first-class dark; preference compatibility retained |
| Typeface | Manrope, one family, tabular numerals for money; no monospaced UI-wide money treatment |
| Accent | Deep teal action/selection, green income/success, white/gray material; gold reserved for identity and explicit warning semantics |
| Branding | Concept 12 FT Ligature, exact geometry and applications below. No alternative mark. Final asset applications are included in the approval review. |

### 3.1 Navigation and shell

Desktop (width ≥1200): expanded208px / compact68px persistent sidebar, 56px topbar, content padding28px horizontally/24px top, content maximum1560px including padding, centered when wider. At ≥1600 horizontal padding becomes40px. A1440px viewport leaves1232px beside the sidebar and1176px inside content paddings. The28px prototype review bar is not production UI and is excluded from implementation shell geometry.

Sidebar groups, exact order:

- **Tu día a día:** Inicio `/dashboard`; Movimientos `/transactions`; Cuentas `/portfolio`.
- **Planificación:** Presupuestos `/budgets`; Créditos `/credits`; Por cobrar `/receivables`; Por pagar `/payables`.
- **Registro y activos:** Activos `/assets`; Plantillas `/recurring`.
- Footer: Avisos `/alerts`; Catálogos `/admin`; Configuración `/settings`; profile/sign-out menu. Developer routes remain visible only under existing environment gating, after Catálogos.

Group labels are organizational aids, not extra routes. Do not fuse receivable/payable datasets. The group **Registro y activos** deliberately avoids implying that reusable templates are wealth. Do not create a new route for a group heading.

Topbar: navigation expansion control and current route breadcrumb left; last successful retrieval context where actually known, privacy, unread notice control and profile right. No global currency switch, universal search or exchange-rate ticker. Keep module-specific named primary actions and Inicio direct-expense shortcut. The persistent bottom-right Registrar opens existing operations; it is not a second dashboard or shortcut to settings. Exact adaptive-shell and quick-action contracts are in§3.3.

Tablet768–1199: default68px icon rail with44px hit areas and accessible names; labels via focus/hover tooltip. Expansion temporarily overlays a208px labeled navigation surface, with backdrop/inert background/focus containment; it does not narrow the content. Content padding22px. Full-width report with plot/categories side by side; then agenda and budgets in equal columns; full-width recent records; credit strip below. Do not revert to the round01 horizontal commitment tiles or desktop narrow-chart arrangement. No page-wide horizontal scrolling.

Mobile<768: no rail;52px topbar with27px FT mark, no second hamburger;16px page padding. Bottom destination navigation: Inicio, Movimientos, Cuentas, Más; an independent Registrar button occupies a reserved right-hand slot, not an active destination. This replaces the center Registrar. The68px-high dock reserves76px on the right; button56×56, right12px, bottom6px + safe-area. Reserve104px main bottom padding. Más opens full navigation in the shared workbench and returns focus. Mobile ignores desktop preference without overwriting it. Contextual header actions may create a credit/budget/account; do not add a second generic mobile Registrar.

Keep a single active scroll container in production (`AppShell` main) and restore expected per-route scroll. The static prototype uses document scrolling to keep it independent; do not copy that implementation detail into the app. Skip link lands on the real main. Topbar and fixed bottom navigation must not hide keyboard focus or error messages.

### 3.2 FT Ligature identity system

Canonical full mark:80×80 viewBox,11-unit stroke, round caps/joins. F path `M15 66V25c0-7 5-12 12-12h38`; green crossbar `M16 42h32`; T path `M50 28v38M37 28h28`; gold node centered50,42 with radius6. Preserve these paths, their overlap and open counterspace. Do not replace them with font glyphs or add an arrow/chart.

Light structure `#086D6D`, flow `#2BA77D`, node `#D7B66F`. Dark structure `#ECF4F0`, flow `#73C6A3`, same gold. Logo green is an asset color, not a small-text success token. Gold is not a blanket KPI, button or navigation accent.

At24px and above use the full mark. For16/20px use the supplied optical mono mark:32×32 viewBox,4-unit stroke, path `M6 27V10a4 4 0 0 1 4-4h16M6 17h14M20 12v15M15 12h11`; omit the gold dot rather than rendering an illegible speck. Monochrome uses one currentColor stroke, no separate dot. Do not add a container behind the ordinary sidebar mark.

Sidebar mark32px at x18px,12px gap, wordmark `FinTrack` Manrope700/21px, tracking−.7px. The mark keeps the same coordinates and dimensions across expansion. Minimum external clearspace is one full-mark stroke (11/80 of rendered width). On the compact desktop/tablet rail use the same32px mark alone; mobile27px mark with the current section, not a second full lockup. App icon128px with28px corner radius, deep teal `#104B47`, full mark placed14,14 at100×100; optical artwork occupies approximately60% of the icon. No gradient, texture or ambient shadow. PWA/store size exports are later packaging, not a new design.

Canonical review assets: `docs/redesign-v3/preview/brand/ft-ligature.svg`, `ft-ligature-dark.svg`, `ft-ligature-mono.svg`, `ft-favicon.svg`, `ft-app-icon.svg`. `brand.html` shows light/dark lockups,16–64px optical use, mono and app icon. Product favicon uses the optical asset. Sol may optimize/minify these vectors, not redraw their geometry.


### 3.3 Adaptive shell and quick creation — round04 exact contract

**Desktop ≥1200.** Expanded208px / compact68px. Default expanded; preserve an existing saved preference. The36px toggle sits before the breadcrumb, has `aria-controls` and `aria-expanded`, and is named `Contraer navegación` / `Expandir navegación`. Keep focus on it when toggling. No route change or new data read. Each rail destination remains a real link with its full accessible name and `aria-current="page"`; group headings become quiet separators, not blank large gaps. Profile/avatar and notices remain reachable with full names. Rail tooltip appears after300ms pointer dwell, immediate on keyboard focus or when moving between tooltip targets within800ms; Escape, blur, pointer leave and scroll dismiss. Tooltip never takes focus.

**Identity continuity.** Keep one FT mark32×32 at x18px, with exactly the same screen coordinate and full glyph throughout the transition. Its adjacent wordmark fades/translates−6px in100ms when closing; opening text resolves over150ms after55ms. Do not morph F/T paths, rotate the mark, animate its gold dot, clone an interactive logo or move it into an unrelated corner. The brand is the stationary anchor while the surrounding navigation changes. This is more purposeful than a decorative logo transformation.

**Layout motion.** Apply the final sidebar width and page layout once. Animate only the flat sidebar background scaleX1↔68/208, origin left,240ms `dock`. Use measured FLIP translation for workspace x displacement, never scale its typography/charts. Real links/mark do not stretch. An inert, aria-hidden departing-label layer may finish its100ms exit; remove it on completion/interruption. Capture current computed poses before cancellation; reversing quickly must continue from the visible state, not restart from the previous target. No width/margin/grid-column tween. A ResizeObserver may remeasure chart geometry after layout; no refetch triggered by collapse.

**Tablet768–1199.** Default compact68px independently of desktop preference. Toggle opens208px labels over the workspace, not in place of another140px of content. Keep the logo coordinate stable and the rail destinations in the same order. Scrim covers workspace; navigation has labeled dialog/modal semantics,44px close/links, contained focus, background inert and scroll lock. Escape, outside activation and choosing a route close it; dismissal restores the expansion trigger, route choice moves focus to the new module heading. Closing or crossing breakpoint releases inert/scroll lock exactly once. Tablet open state is temporary, not persisted and does not alter desktop preference. At short viewport heights the nav body scrolls, with reachable close and profile controls; focus cannot be clipped.

**Persistence.** Production reuses the existing LayoutProvider preference/key rather than introducing a second competing setting. The prototype's isolated key is `fintrack.preview.v3.sidebar`, with `compact|expanded` only. Storage failure falls back to memory, never blocks navigation. No record, amount, search query or user identity goes into this preference. Avoid hydration flashes by honoring the current provider's mount strategy; do not add cookies or alter auth.

**Route transition.** One committed module at a time. On pointer route change: heading at0ms (160ms/Y3), summary at24ms (180ms/Y5), remaining working regions together at48ms (180ms/Y6); opacity.35→1 and `out`. Total228ms, not an additional delay after data arrives. Shell stays mounted; new heading receives focus and route announcement. No exit wait, hidden interactive old page, per-row stagger or amount interpolation. Initial load and same-page filter/pagination do not replay it. Slow data shows an honest region skeleton; when ready, use the140ms boundary resolve, not a second full-page reveal. Rapid route changes cancel old effects. Keyboard/reduced motion commits immediately. Existing dirty/busy navigation guards run first. Back/forward preserves existing route-state/scroll restoration; do not force a fresh page animation on history restore.

**Persistent Registrar.**

- Desktop52×52, radius18, right24/bottom24; tablet52×52, right20/bottom20. One plus icon21px and accessible `Registrar`; pointer/focus label appears beside it, not a permanently wide pill over amount columns. It remains at the same location while scrolling; no hide-on-scroll or idle pulsing.
- Mobile56×56, radius18, right12/bottom6 + safe-area, in its own right-hand dock slot. Four destination items occupy the remaining width; no center Registrar and no floating button over the record list. At320px preserve the four readable labels and44px minimum touch targets. Bottom dock reserves safe-area height and cannot cover the last focused field/record; main clearance104px. The button is visually raised within this utility slot, not a fifth selected destination.
- Intro is one200ms/60ms-delay settle at shell session start; not on module changes, reload of data or scrolling. HoverY−2px/140ms only with fine pointer; pressed scale.97; plus rotates45°/180ms while open. No glow, bounce, gold pulse, sound or repeated invitation. Keyboard/reduced preference disables motion.
- Menu opens upward where space allows; collision clamp12px, desktop width300px, mobile width `min(340px,100vw - 32px)`; viewport-bounded scrolling for short screens. First group: Egreso, Ingreso, Transferencia interna. Second: Prestar dinero, Registrar cobro, Dinero recibido a devolver, Registrar pago, Comprar un activo. Third only on Cuentas/Presupuestos/Créditos: Añadir cuenta / Crear presupuesto / Añadir crédito. Preserve each existing operation identity and target-selection step. “Registrar pago” is payable settlement, not a generic automatic card payment.
- Arrow keys/Home/End operate the menu; Enter activates; Escape restores Registrar focus; Tab exits and dismisses. Pointer opening need not move focus, keyboard opening focuses first item. Origin uses the actual button center and collision-resolved side,160ms enter/110ms exit. Close on navigation or source scroll, but not while scrolling the menu itself.
- Opening a financial workbench or tablet navigation makes the button unavailable behind the modal; it returns after dismissal. Never layer an active FAB above a dirty form or over its sticky footer. No new keyboard shortcut that conflicts with data entry.
- Preserve current theme/profile/currency preference actions in their existing settings/profile contexts during implementation. The production FAB currently mixes those utilities with links; replacing its content must not delete the underlying functionality. Round04's Registrar is an operation launcher, not a global currency switch or a second module navigator.
- Named page actions remain contextual: `Añadir crédito` is not equivalent to recording an expense. Inicio keeps its direct-expense shortcut; Movements may keep the desktop “Nuevo movimiento” entry using the same chooser. Mobile has one generic Registrar; other mobile header buttons must expose a specific accessible creation name, never an unlabeled plus.

## 4. Visual system

These values are normative. The preview uses short local names; production maps them to `--ft-*`. Hex values are the reproducible sRGB reference. Additional tints should be derived in OKLCH, not invented per component. Do not replace source colors on user bank/category icons; keep them localized and bounded.

### 4.1 Color tokens

| Token / role | Light | Dark |
|---|---|---|
| `--ft-canvas` | `#F5F6F7` | `#17191C` |
| `--ft-surface` | `#FFFFFF` | `#202327` |
| `--ft-surface-muted` | `#F0F2F4` | `#292D31` |
| `--ft-surface-hover` | `#E9EDEF` | `#30353A` |
| `--ft-text-strong` | `#242A30` | `#EDF0F2` |
| `--ft-text-muted` | `#59636D` | `#B7BFC5` |
| `--ft-text-subtle` | `#65707B` | `#A7AFB6` |
| `--ft-border` decorative division | `#DCE1E5` | `#393F45` |
| `--ft-control-border` essential input boundary | `#89949D` | `#747F88` |
| `--ft-primary` | `#155E59` | `#8AD1BF` |
| `--ft-primary-hover` | `#104B47` | `#AFE4D2` |
| `--ft-primary-soft` | `#E8F1EE` | `#293633` |
| `--ft-text-on-primary` | `#FFFFFF` | `#14352E` |
| `--ft-success` / recorded incoming flow | `#2B7356` | `#95D6AD` |
| `--ft-success-soft` | `#E8F2E9` | `#283A30` |
| `--ft-danger` | `#AD4545` | `#F2A09B` |
| `--ft-danger-soft` | `#F9EEEE` | `#402E30` |
| `--ft-warning` | `#7C601F` | `#E5C781` |
| `--ft-warning-soft` | `#F6EFDC` | `#3C3528` |
| `--ft-chart-expense` | `#74828C` | `#A8B4BB` |
| `--ft-overlay` | `rgba(25,30,36,.28)` | `rgba(10,12,15,.66)` |

**Allocation, not recoloring everything.** Aim for roughly90% neutral material in ordinary UI: canvas, tables, topbar, sidebar, form fields, summary surfaces, menus and workbench. Teal/green should occupy approximately5–8% outside data-dependent chart marks, not a measured pixel quota. Use primary for the main CTA, interactive links, focus and selected icon/check; income/success retains its separate semantic green. Selected navigation uses neutral muted fill, strong neutral text and teal icon. Row hover is neutral. Result inset is neutral gray, not a green card. Credit utilization is neutral slate; budget progress stays teal because it is an active planning comparison. Do not tint every icon, summary number or divider. Large dark surfaces stay #17191C/#202327/#292D31. Dark selected soft is #293633 and confined to small selection/state roles, never the whole shell. White is deliberate here, following the owner's preference rather than a rule requiring branded tint in every neutral.

Teal means action/selection, not “good finances.” Green means an incoming financial direction or confirmed success, not a high score. Movement amounts use income=success green, expense=danger red, transfer=text-strong neutral; keep income + and expense − plus type semantics, so hue is supplementary. This is directional encoding, not a claim that every expense is bad. Never tint an entire ordinary expense row red. Dashboard totals/charts remain neutral for expenditure; red elsewhere signals exceeded/overdue/error/destructive or explicit negative-result semantics. Pair status color with a label/icon; never rely on hue alone. Selected surfaces use both tint and selected semantics. Chart bars use different positions/labels plus a data alternative. No per-module rainbow; warm gold is an identity detail, while warning text uses its tested darker/lighter semantic pair.

### 4.2 Typography

Self-host Manrope Latin/Spanish subset, weights400/600/700. Load through the app's font mechanism in the foundation stage, retaining a system fallback. Three local TTFs are bundled only for offline review; production should generate optimized WOFF2/subsets. Verify OFL license stays with redistribution.

| Role | Desktop / tablet | Mobile | Weight / tracking |
|---|---|---|---|
| Page title | 26/34px | 24/32px; Inicio23/31px | 700 / −.8px (−.7 mobile) |
| Position amount | 26/34px desktop;22/28px tablet | 23/30px;21px below360 | 600 / −.8px |
| Module summary amount | 24/32px | 22/30px | 600 / −.7px |
| Monthly report amount | 21/28px desktop;24px tablet | 16/24px (14 below360) | 600 / −.5px |
| Section heading | 16/23px | 16/23px | 700 / −.3px |
| Form/dialog title | 20/28px | 19/28px | 700 |
| Standard body | 14/22px | 14/22px | 400 |
| Form label / data row | 12/18px / 13–14px primary row values | 12/18px; 13px money | 600 labels / 400 values |
| Supporting text | 12/18px | 11–12/18px | 400 |
| Input | 14/22px | **16/24px** | 400, avoids iOS input zoom |
| Chart ticks / compact metadata | 11/16px minimum | 11/16px minimum | 400 |
| Sidebar group | 9/16px uppercase | not on bottom navigation | 700 / 1.05px; nonessential categorization only |

Use `font-variant-numeric: tabular-nums lining-nums` for money, dates, percentages and counters. Currency prefixes may be smaller on position amounts but must remain adjacent and readable. Do not shrink a large amount until it fits: allow two currency blocks to stack; use responsive layout. Do not truncate money with ellipsis. Critical values must stay legible at 200% zoom. Body paragraphs max72ch.

The final preview includes a shared legibility calibration for chart/metadata labels. The minimum chart size above is measured at rendered size, not SVG viewBox size; a scaled chart must not shrink labels below11px. Nonessential group labels may use9px, redundant currency/recorded-scope captions10px, and the clearly separated proposal toolbar10px. Essential status, amount and action labels must not rely on those exceptions. Do not reduce all body text to make the dashboard fit.

### 4.3 Geometry and elevation

Spacing scale:4,8,12,16,20,24,28,32,36,40,48,64px. Shared optical gaps:7px field label;18px form rows and desktop dashboard columns;9px logo gap. Field gaps18px vertical/16px horizontal; form section gap28px. Independent dashboard stacks gap16px; tablet grid gap16px. Major sections24px. Panel heading padding18px top/20px horizontal (monthly report16px top); drawer content22px vertical/24px horizontal,18px horizontal mobile.

Use these semantic radii consistently; do not select a radius independently per module:

| Token | Value | Application |
|---|---|---|
| `radius-badge` |6px | Badges, read/edit tag, compact transaction direction marker |
| `radius-control` |10px | Buttons, inputs including amount/currency, search, selects, date tiles, navigation items, operation choices, category row hover enclosure |
| `radius-inset` |8px | Optical inner segment/menu item/row inside a larger surface; never an alternative outer-panel token |
| `radius-menu` |14px | Popovers, dropdown shell, tooltip, effect/equation inset |
| `radius-surface` |18px desktop/tablet;16px mobile | Financial regions, position band, registers, ordinary panels, budget/credit containers |
| `radius-workspace` |24px at every width | Detached detail/form/filter workbench and confirmations; all four corners retained |

Shared split buttons are a single10px outer shape with square **internal seams**. Table corners belong to its outer register, not each cell. Avatar/dots remain circular because their role is a point/person, not an interchangeable surface. A borderless layout group is not a square card. Page edges and dividers are structural, not an exception that permits square dialogs. No extra card around each fact inside a workbench.

Borders1px. Neutral elevation roles: contact `0 1px 3px rgb(24 30 36 / .04)`; menu `0 3px 8px rgb(24 30 36 / .06), 0 16px 44px rgb(24 30 36 / .12)`; workspace `0 0 0 1px rgb(24 30 36 / .04), 0 8px 24px rgb(24 30 36 / .09), 0 28px 72px rgb(24 30 36 / .16)`. Dark: contact `0 1px 0 rgb(255 255 255 / .025)`; menu `0 4px 12px rgb(0 0 0 / .24), 0 20px 48px rgb(0 0 0 / .32)`; workspace `0 0 0 1px rgb(255 255 255 / .04), 0 12px 32px rgb(0 0 0 / .28), 0 30px 80px rgb(0 0 0 / .40)`. No ambient shadow on each row. Essential controls retain their contrast-tested boundary.

Inset tone is `#F3F4F6` light / `#25292D` dark for footers, selected-month wash, rail tracks and contextual recesses. Expense fill is `#E5EAED` / `#394148`; boundary retains `--expense`. Explicit colors avoid inconsistent interpolation. Gold remains a brand node or warning semantic, never an extra chart series.

Z layers: base0, sticky30, navigation40, page popover60, backdrop80, dialog100, toast120, dialog-owned popover130, skip link140. Dialog-owned popover stays within the accessible modal subtree while painting above it; native top-layer ordering or equivalent portal ownership must preserve this. Never put a tooltip beneath its active drawer.

### 4.4 Motion, focus and icons

**Signature: contextual docking.** A working surface settles into the right-hand workspace, while its background and content settle separately. Related read/edit views stay inside that same frame. Anchored objects emerge from the actual invoking control. Financial values and keyboard actions do not animate. Pointer module changes use the brief three-level reveal below, not a delayed page replacement. This is not permission to add decorative transitions.

Named curves: `dock=cubic-bezier(.32,.72,0,1)`, `out=cubic-bezier(.22,1,.36,1)`, `shift=cubic-bezier(.77,0,.175,1)`. Use only transform/opacity for spatial transitions. No animated width, height, top/left, expensive shadow/blur, spring, overshoot or bounce. The mobile near-full-height workbench keeps the same right-edge origin; do not invent a different swipe gesture. Swipe-to-dismiss is not specified or required.

| Interaction | Enter/change | Exit | Origin / intent |
|---|---|---|---|
| Workbench frame |260ms `dock`: translateX48px→0, scale.985→1, opacity.82→1 |160ms `out`: current transform→translateX24px scale.992, current opacity→0 | Right center; modest travel, not a580px fly-in |
| Workbench content |180ms `out`,36ms delay: translateY8px→0, opacity.65→1 | Carried with frame | Header immediately legible; content follows without section-by-section stagger |
| Background veil |160ms opacity0→1 |140ms opacity1→0 | Light actual color `rgb(25 30 36 / .28)`; dark `rgb(10 12 15 / .56)`. Page itself never moves/scales/blurs |
| Read→edit / related detail |180ms `out`: incoming body translateX12px→0, opacity.55→1 | Replace body in stable frame | No second dialog, no frame-size tween, no delayed controls. Back reverses logical navigation; same short settling treatment |
| Confirmation |220ms `dock`: translateY14px scale.975 opacity.82→rest |160ms `out`: translateY9px scale.985 opacity0 | Center-bottom of dialog; mobile auto-height bottom sheet |
| Anchored popover/menu |160ms `dock`: translateY−4px when below trigger (+4px above), scale.97, opacity.6→rest |110ms `out`: translateY−3px scale.985 opacity0 | X origin projects the trigger center, clamped to surface; Y follows collision-resolved side |
| Chart tooltip |110ms `out`: translateY3px opacity0→rest | Immediate hide | Fixed small offset; pointer movement changes exact content, never interpolates values or axes |
| Segmented selection |180ms `shift`, measured FLIP translation/scale of inner highlight | None | Only highlight travels; labels/numbers remain stable |
| Record detail tab |160ms `out`: translateX8px opacity.55→rest | Immediate replacement | Summary/header/footer stay still |
| Press / hover |110ms `out`, scale.975 for buttons (.985 operation choice); hover color140ms | Returns to1 on release | Pointer only; no row lifts or expanding shadows |
| Action acknowledgement |210ms `dock`: Y8/scale.985/opacity.55→rest; glyph140ms delayed45 |130ms `out`: Y4/scale.99/opacity0 |16px radius; displayed4200/6200/8200ms; full ownership/queue/pause contract6.6 |
| Skeleton→confirmed content |140ms `out`: translateY4px opacity.3→rest | Skeleton replaced in same region | No looping shimmer; no synthetic zero/count-up |
| Filters and financial data refresh | Immediate committed state | None | No row-by-row or numeric animation; independent segmented highlight may move |
| Pointer module navigation | Heading0ms/160ms/Y3; summary24ms/180ms/Y5; work region48ms/180ms/Y6. All opacity.35→1, `out` | No exit wait | Commit content immediately; maximum228ms. Three groups, never one delay per row |
| Sidebar shell |240ms `dock`; flat backdrop scaleX208↔68; layout committed once and workspace translated with FLIP | Labels fade/translate−6px in100ms; opening labels150ms after55ms | Logo stays at32px/x18. No text, chart or page scale; interruption reads current pose |
| Quick Registrar | One200ms Y8/scale.96/opacity0 entrance after60ms at session start | No recurring pulse | HoverY−2px140ms, press scale.97; plus rotates45°180ms on open. Keyboard/reduced immediate |

**Lifecycle contract.** Model `closed → opening → open → closing → closed`; keep the modal mounted, focus-contained and background inert through closing. Snapshot computed transform/opacity before canceling an in-flight animation. A monotonically newer transition invalidates older completion callbacks. Closing during enter starts from the rendered pose; reopening during exit must not be closed by the old promise. Never clear a form or unlock background scrolling until the current close actually completes. Body changes inside an already-open frame cancel only obsolete content motion, not the saved draft. A dirty dismiss/back/route attempt stops first for explicit discard; animation does not imply confirmation.

**Reduced/keyboard motion.** `prefers-reduced-motion: reduce`, an explicit reduced-motion setting, and keyboard-initiated actions resolve immediately with identical final content/focus semantics. No transform, delayed opacity, scrolling animation or stagger. If preference changes mid-transition, finish to the correct end state and release resources once. The review workshop's slow mode multiplies durations/delays by3 for inspection only; it must never ship. No library solely for these transitions is justified.

Focus:2px solid primary, offset3px, never clipped. Preserve native button/link roles. Dialog uses trapped focus, `aria-modal`, accessible title, Escape, return to trigger; unsaved form requires explicit discard. Nested create uses an in-drawer subview with a back control, not a second stacked modal.

Iconography: consistent24px viewBox,1.6px stroke, rounded caps;20px navigation,16px inline actions,14px metadata. Use the existing repo-native icon source or a single approved library only if required; adding a library is not a design requirement. No emoji as account/category default. Bank/user-provided art stays at32px with neutral fallback initials.

### 4.5 Workbench anatomy and state continuity

All ordinary detail, filter and create/edit views share a580px frame. Desktop/tablet:12px from top/right/bottom, height `calc(100dvh - 24px)`. The **preview only** adds28px above it for the review bar, so its top is40px and height `calc(100dvh - 52px)`. Never copy those28px into production. Mobile<768:8px all around, width/height minus16px,24px corners. Confirmations:480px max desktop,24px corners, auto-height bottom sheet8px inset mobile; long body scrolls. Complex schedule forms retain960px max, same24px surface grammar.

Header:20px24px padding desktop (16px18px mobile), source breadcrumb11px, close32px desktop/44px touch,14px gap to title22/29px (20/27 mobile), description12/18px, small read/edit/review tag at right. Previous/next belongs in the breadcrumb row and traverses only the current visible ordering; disable at ends. Mobile closes/navigation44px with real spacing; at320px reduce redundant breadcrumb text, not target size. Focus initial heading for inspection; form first invalid field after submit. Keep screen-reader announcement concise.

Body:22px24px desktop,20px18px mobile, independent scrolling,24px section separation. Transaction read view: original amount34/44px (30/40 mobile); type/status; account→classification relationship; Detail/Financial context tabs; two-column facts (one below360); explanatory context only from the actual record. Detail facts include date, currency, report participation, description and actual attachment association, not fabricated processing/reconciliation status. Context explains original money, report meaning and existing links. This is deterministic product copy, not AI advice. Summary never disappears merely because the context tab changes.

Footer: separated inset surface,1px top boundary,13px24px16px padding desktop; safe-area-aware mobile,44px actions. One status/provenance line10/16px, then actions. Read: secondary More containing destructive action, primary Edit. Edit: Cancel / Save; return-to-record in header; pending/draft/error states tied to actual existing state. Busy action holds width; uncertain outcome remains an uncertainty. Never say “saved” solely because an animation finishes. Footer stays in the frame's flex flow, outside the scrolling body, and never covers the last field/error.

Read→edit retains record ID, native currency, type, category, real date and existing links. Back preserves source filters/scroll; dirty back requires explicit discard or keep editing. Nested account/category/contact creation uses the same workbench as a subview with a retained parent draft, not stacked modals. Deletion replaces the frame with a confirmation only after actual linked-record checks; cancel returns to the source record in production. The simulator demonstrates the decision surface but does not execute real checks or delete financial records; the independent catalog supports local disposable deletion only. Ownership, focus trapping, inert background, contextual menu layering and busy/dirty state are shared contracts, not per-module inventions.

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

One primary action per screen region. Primary36px desktop/44px touch, horizontal padding12px, radius10px,12px semibold. Secondary neutral border/surface. Ghost for navigation to more detail. Compact desktop buttons30px; touch44px. Destructive reserved for confirmations, not normal expense creation. Icon-only36px desktop/44px touch with accessible name. Preserve loading width, disable double submission, show `Guardando…`; a timeout on a write is `No pudimos confirmar el resultado`, not proof of failure or permission to blindly retry. Inicio primary opens expense directly; its split-menu retains all eight operations. Other modules keep their own named creation action.

Inputs44px desktop/touch; amount64px with28px tabular amount; textarea88px minimum. Permanent label above, help below, optional explicitly labeled, required according to actual schema. Validate on blur and submit, not on every keystroke. Error border plus text and `aria-describedby`; submit focuses first invalid field and summary where needed. Invalid reference-data load disables only dependent fields/actions, retaining entered text and existing associations.

**FinTrack Select, one selection component.** Extend the existing `components/ui/AppSelect.tsx`, not a second competing primitive. Every single-value dropdown uses the same trigger and searchable panel, even for2 options. Segmented2–3 choice controls already visible on the page remain segmented controls, not dropdowns. Action menus remain action menus, not searchable lists. Native dates, OS file dialogs and the review toolbar are outside this selector contract.

- Trigger:44px minimum,10px radius,1px control-border, white/graphite surface, permanent label,13px semibold selected text and14px neutral chevron. Toolbar compact variant38px desktop/44px touch. Preserve full selected label in accessible text; ellipsis is visual only. A currency trigger stays compact beside the amount. No label-only focus outline; ring2px/offset3px.
- Panel desktop/tablet:320–400px width, at least trigger width where it fits,12px viewport margins,14px radius. Anchor gap8px, prefer below, flip above when needed. Header12px/700, search40px, visible options max240px scroll,44px minimum row; metadata11px/16px. A label + native currency/status/hint sits on two lines; do not mix balances into option names or invent currency conversion.
- Mobile<768: bottom-anchored selection surface inside the active modal ownership tree,8px gutters,18px radius, max available visual viewport height; search44px/16px text, option48px minimum, options max280px. Reposition with the virtual keyboard/visualViewport so search and active row remain visible. No second route or full-screen form reset. Do not add a second dark veil when it belongs to a drawer.
- Opening leaves query empty and scrolls to the current selection; selected check persists even as active keyboard highlight moves. The selected value changes **only** on click/tap/Enter. Searching, hovering, closing, loading and choosing no result never modify the field.
- Search matches normalized case/accent-insensitive label plus allowed metadata (account currency, entity, masked suffix). Do not search secrets/full account numbers. 1–8 options show all;9–100 use bounded scroll. Above100 use the existing paged/search data contract, optional virtualization after profiling; do not download an unlimited list or add a server endpoint without separate approval. If the available source is partial, say so. Do not label only cached results as exhaustive.
- Search input is an editable `combobox`, `aria-autocomplete=list`, `aria-expanded`, `aria-controls` and active descendant. Options use listbox/option roles and `aria-selected`; accessible dialog label comes from the field. ArrowUp/Down moves enabled options; Enter commits; Escape closes this layer first and restores trigger. Tab closes without selection and continues in document order. Home/End on an empty query can select first/last active option; while typing preserve normal caret behavior. Never swallow IME composition. Pointer and keyboard do not create two simultaneous active selections.
- Prior inactive association stays visible with historical status. Disabled options have a reason and cannot commit; a missing currently selected ID displays its preserved reference, not the first returned choice. Loading skeleton belongs to the options area, not the whole form. Failed load keeps prior value and offers scoped retry. True empty differs from no match; both retain a usable search/close path. No automatic category/contact creation on a no-match query. Existing nested-create action remains explicit and retains the parent draft.
- Selection commits with immediate check/value and a120ms text settle (Y2/opacity.5→rest), pointer only. Announce `Seleccionado: [label]` politely, not a success toast. Panel160ms `dock`, Y4/scale.985/opacity.65→rest;110ms exit Y−3/scale.985/opacity0, with origin projected from the invoking trigger. Keyboard/reduced is immediate. Rapid close/reopen must remove stale layers/IDs; at most one active selector; no delayed callback closes a newer one.
- In filters, selection edits the draft only until Apply. In forms it marks a change only when the value commits, not when the search text changes. Required labels/error/help links and existing validators remain intact. Never clear dependent historical IDs without an explicit, valid user change.

Numeric input: preserve the existing parser until separately approved. The approved visual contract shows the parsed amount on blur and warns on ambiguous separators instead of guessing silently. For new presentation tests use `1,250.50`, `1250.50`, empty, zero, negative, `1.250,50`, `1,234`, and8-digit amounts. Negative permitted only in fields whose schema permits it (e.g. initial balance); operation amount remains positive with direction determined by operation type.

### 6.2 Filters and tabs

Search left, frequently used type tabs above, advanced filters in a right drawer (desktop580px/mobile near-full-height with8px gutters). Filters: date range, account, category, type, currency, sorting, page size where supported. Draft filter edits commit on Apply; Cancel leaves old results. Active chips contain explicit labels and individual remove actions; Clear resets all including query/page. Changing a filter resets page1 and clears cross-page selection unless the existing contract explicitly provides it.

Preserve `TransactionListParams`, URL spelling (`account_id`, `date_from`, etc.), saved-view local persistence and backend sorting behavior. A saved view is not a new backend feature. State chips are not tabs; tabs change a coherent view and use tab semantics only for same-page panels. Route links remain links with `aria-current`. Preserve existing list/card toggle in overflow/view options, list default; do not remove its code before migration evidence.

### 6.3 Register/table

Desktop Movements row48px minimum (48px measured in the current reference),34px header target; tablet row56px and44px controls. Other two-line registers56px minimum, single-line catalog48px, ordinary header38px. Credit rows68px desktop and content-driven touch rows around80–84px. Movements cell16px horizontal/6px vertical,32px primary description target desktop; hide the redundant type subtitle only on desktop/tablet, retain type as a labeled directional icon and in detail. Other register cells14px horizontal/10px vertical;12px horizontal at narrow tablet. Primary text13px, secondary11px/16px, amount14px; final amount right aligned. Rows grow for text expansion rather than clipping. A semantic `<table>` for tabular data, header associations and announced sort direction. Tabular digits across all rows. Date/status/amount never available only on hover. Keep selection checkbox32px interaction wrapper desktop/44px touch. Entire row may support pointer inspection, but contains a proper primary button/link for keyboard use and avoids nested interactive elements.

Transactions column order: selection36, Movement flexible minimum220, Account160, Category144, Date112, Original amount160, Actions106 desktop /44 tablet. Hide Category below1200 and move into row subtitle; hide Account below960 and include it in detail/subtitle. At <768 use record rows with description+exact amount first, date/category second, account/action third. No sideways scrolling for the ordinary register. Schedule tables with many indispensable numeric components may scroll horizontally inside a labeled region, never the whole page.

Single-row action menu: inspect, edit, delete, and module-specific actions. Detail opens580px drawer, preserves scroll/filter/selection; Escape returns focus to the exact trigger. Direct detail routes still work and use the same detail component. Desktop next/previous respects current visible ordering; never skips into another user or page without a deliberate fetch. Bulk toolbar appears only with selection; no checkboxes on charts. Preserve current bulk-delete confirmations and partial-result handling; export stays a module-toolbar operation with its existing format, period, exercise and portfolio scope. The current export handler does not accept selected transaction IDs or arbitrary register filters: never label it Exportar selección or imply ledger selection changes its scope.

### 6.4 Forms and overlays

Simple operations use580px drawer, sticky header, independently scrollable body and content-sized sticky actions (minimum92px including a one-line status). Mobile near-full-height `calc(100dvh - 16px)`,8px gutters,24px corners, safe areas and scroll-padding for keyboard/footer. Main sequence: amount+currency → account → date+category → description → module-specific required fields → optional details → effect summary. Two columns only for short paired fields; meaningful descriptions span full width.

Operation chooser contains eight understandable actions mapped to current `OperationType`; no new API operation. Preserve the distinguishing debt creation/settlement pathways. New nested account/category/contact creation is a subview of the same drawer, retains parent draft, back control, and returns newly created selection only after confirmation. It does not reset the transaction. Complex bank-loan/schedule forms use a960px max dialog on desktop and near-full-height multi-section view with8px gutters and24px corners on touch. Preview demonstrates the main operation form; exact per-module form recipes are below.

Confirmation:480px max, object name, currency, amount/date where relevant, known consequences, cancel-first keyboard order. No vague “Are you sure?” alone. Typed confirmation only for current account deletion/security contracts requiring it, not every financial record. No success page or persistent receipt band. Confirmed list/detail update + brief animated acknowledgement follows6.6.

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

Action feedback follows6.6 exclusively: content-centered420px max,16px radius,2 desktop/1 mobile, auto-dismiss4200/6200/8200ms, paused on hover/focus/hidden. Inline errors remain persistent; do not create an additional legacy bottom-right stack. Preserve existing release announcements and persisted activity semantics.


### 6.6 Confirmed action protocol (round06 — supersedes the round05 result/receipt)

**Decision:** successful work returns to the working context and produces a short-lived floating acknowledgement. Never replace a form/drawer with a success screen, never require `Volver al trabajo`, and never leave a persistent success band above the list. The changed record is durable evidence; the acknowledgement is deliberately ephemeral. Pre-action destructive confirmation remains a separate decision surface.

State model: `draft → validating → submitting → confirmed | rejected | unknown`. Existing mutations, validation, cache ownership and financial calculations remain authoritative. Confirm only after a verified response; never optimistically alter money or infer settlement from a UI transition. A successful write followed by failed refresh is **saved + stale view**, not failed write and not permission to submit again.

| Action/state | Visible behavior | Context and focus |
|---|---|---|
| Open create/edit | Existing260ms workbench, selected record/context, searchable associations, named submit | No change to original fields, IDs, relation or validation contracts |
| Validate | Inline field error, focus first invalid field. One warning summary if useful, not one toast per invalid field | Preserve draft. No success check, shaking or red full-screen overlay |
| Submit | Immediate duplicate-submit guard, measured button width, action-specific pending label, aria-busy; disable only conflicting controls | Await real response; no minimum520ms delay in production. Pending close cannot silently cancel an already-sent write |
| Confirm create | Close form160ms and emit acknowledgement in the same response cycle. Insert returned ID through existing list/cache flow; row enters220ms Y−6/opacity.4→rest if actually visible | Preserve sort/filter/page. Never pin an out-of-order row. If outside filters: say `Creado · No coincide con los filtros actuales`, do not reset filters. Restore trigger or visible new row; never move focus into notification |
| Confirm edit | Same close/acknowledge; return to exact updated row or retained read detail. Thin1px teal row outline holds1400ms then fades240ms | Preserve scroll, filter, selection and relations. No financial count-up or whole-page reload reveal |
| Confirm delete | Before request:480px max/24px radius, exact name and supported consequences, `Conservar` first and focused. After success: immediate acknowledgement, row X12/opacity→0 in160ms; survivors translate220ms | Focus next surviving row, then previous row, then header action. No generic undo for permanent deletion. Do not delete dependent records implicitly |
| Confirm state | Change verified status immediately, retain row/history, brief outline. If active-only filter excludes it, remove visibly and say `Desactivado · Oculto por el filtro Activos` | Credits ACTIVE/CLOSED, assets ACTIVE/SOLD, and is_active catalogs are different domains. No category activation, archive or duplication invented by this design |
| Cancel clean |160ms close, invoking focus restored | No success toast or record update |
| Cancel dirty | Persistent inline warning, `Seguir editando` initially focused, explicit discard | No destructive modal stack. Continue keeps draft; discard does not claim a saved value |
| Rejected | Short error acknowledgement + persistent inline cause/retry context; no drawer close | Preserve draft/row; focus error summary or invalid field, not the toast. Re-enable retry only when safe |
| Unknown result | Warning acknowledgement + persistent `No pudimos confirmar el resultado` block, preserve draft/IDs, block blind resend | Use only existing safe reconciliation. If unavailable, stop and consult for O11; never invent idempotency or rollback |
| Bulk partial | `8 eliminados · 2 pendientes`, warning rather than all-success; retained failure details in selection/confirmation region | Remove only verified successes; failed IDs stay selected. Do not manufacture exact success counts |

#### Feedback surface and timing

- One shared feedback service: evolve `lib/toast/toast.tsx`, do not install a parallel provider. Existing callers remain compatible. Display policy must not change notification persistence: existing `toast.success` may POST activity by default; preserve each caller's `persist` semantics and do not send a second event for the new animation.
- Width420px max, viewport gutters16px,16px radius, neutral white/graphite surface and1px neutral border. Padding14px desktop/12px mobile;30px semantic glyph well/10px radius;16px symbol. Title13px/20px semibold, detail12px/18px. At most concise title + two short contextual lines. Preserve record name and original currency; avoid sensitive full identifiers. No giant amount or celebratory illustration. Preview adds a small `Simulación` line for unchanged financial fixtures; production never displays that line.
- Quiet2px leading semantic rule and colored glyph, not a green/red background over the whole panel. Success uses check/positive; error uses error/info glyph + error wording/red; warning uses warning wording/amber. Shape and text carry meaning without color.
- Desktop/tablet: centered within available content width,24px above viewport bottom, leaving bottom-right Registrar free. Mobile: one panel,16px side gutters,88px above bottom edge plus safe-area inset. No veil, no page reflow. A form that remains open owns the feedback portal inside its accessible modal subtree,12px above sticky footer; reposition on visualViewport change. Do not let the toast cover the currently focused field—scroll that field within the existing body when needed. Closing a successful drawer transfers the same notification to shell positioning without re-announcing/restarting it.
- Success/info4200ms; warning6200ms; error8200ms. Time starts only when displayed, not while queued. Error/validation/unknown explanations persist **in context**, so important information is never lost with the temporary panel. No essential action exclusively inside a timed notification. No countdown/progress-bar distraction.
- Entry210ms `dock`: Y8px/scale.985/opacity.55→rest. Glyph140ms `out`, delay45ms: Y2px/scale.9/opacity.4→rest. Exit130ms `out`: Y4px/scale.99/opacity→0. Bottom-origin micro-settle communicates completion; no bounce, scale0 or full-page motion. Do not wait for the glyph animation before closing the successful form.
- Pause remaining lifetime on hover, focus-within, pointer hold and hidden document. Resume remaining time, not a new full lifetime. Close control32px desktop/44px touch with accessible name. Focusing a panel prevents automatic dismissal. Escape dismisses only a **focused** notification; otherwise existing selector/drawer Escape ownership wins.
- Maximum2 visible desktop/tablet,1 mobile. FIFO queue; never overwrite a different action's error. Identical event key+title+detail may refresh its own lifetime, but different outcomes on the same record are separate. Queued messages receive their full visible lifetime. A bulk operation emits **one** aggregate message from its confirmed result, not one per row. Coalesce application event producers before they can enqueue an unbounded stream; do not silently evict errors. No permanent activity-center feature added.
- Announce once on display: polite status for success/info/warning; assertive error only for action failure, not each keystroke. Announcer belongs to current modal subtree if applicable. Never autofocus a toast. A purely informational toast has close only; any future useful record link must be supplemental to persistent record access, not the only way to find the result.
- Keyboard-triggered and reduced-motion responses have identical state/focus/timers but no spatial/opacity animation. Use static pending text for reduced motion. Auto-dismiss is retained and pause rules still apply. User timing extensions and assistive-tech behavior must be tested at integration.

**Simulator boundary.** Category create/edit/delete and independent entity/currency/type state examples use disposable in-memory records. Categories have no activate/deactivate control: that was an inaccurate round05 demonstration, now withdrawn. State changes can be tried in Catálogos → Entidades. Financial forms close with clearly labeled simulated acknowledgement; they do not mutate fixed balances/reports. New abbreviated operational forms illustrate hierarchy/action flow, not the complete production field contract. Existing fields, colors/icons/uploads, type-specific schedules and validations must survive implementation. The review response selector and520ms transport are harness-only; local reconciliation knows no real write occurred and must never be copied into production.

### 6.7 Operational action system and verified capability matrix (round06)

One filled primary per module header; visible low-emphasis record action plus a consistently named More menu. Detail/name is an independent semantic button/link, never a whole row containing nested clickable controls. Row actions stop navigation propagation. Menus use roving keyboard focus, Home/End/arrows/Enter, Escape return and collision-aware placement. Accessible name is `Acciones de {record}`. Never rely on hover to reveal actions. Deletion is last, separated and red in its menu; ordinary edit/state actions are neutral. No extra colored icon for every action.

Desktop≥1200: primary36px high; row button30px and More30px target with visible focus. Ledger actions column106px; no taller48–49px row solely for buttons. Tablet768–1199: primary/targets44px; preserve date/amount; credit row uses More44px in reserved actions column, with Edit first in menu, instead of squeezing two controls. Desktop credit actions column10%, tablet8%; do not hide the entire action cell. Mobile: header primary44px with readable module-specific short label; wrap below heading if needed; row footer has direct action + More44px, never horizontal page scroll. Scroll does not remove access to Registrar; it complements, not replaces, module actions. In read drawer, primary is context-specific work (Edit/Use/Register payment where supported), secondary More; sticky footer preserves exact target. Edit mode has Cancel + named Save, no Delete beside a submit.

| Module / primary | Visible per record | Secondary menu / bulk | Real source and constraints |
|---|---|---|---|
| Movimientos: `Nuevo movimiento` | Name→detail; `Editar` | Detail, Edit, Delete. Selection toolbar: `Limpiar selección` + `Eliminar selección`. Export is separate in the module toolbar, preserving its existing format/period/exercise/portfolio dialog; no selected-row export. Saved views keep save/overwrite/remove as toolbar view operations, not record duplication | `TransactionsWorkspace.tsx` create/export; `TransactionTable.tsx` edit, remove, bulkRemove, partial failures; `TransactionEditModal.tsx`. All8 operation types and attachment behavior preserved. No duplicate/archive/state action |
| Cuentas: `Añadir cuenta` | Name→detail; `Editar` | Detail, Edit, Deactivate/Reactivate, Delete; no bulk | `PortfolioManager.tsx` handleSubmit/startEdit/deactivate/reactivate/deleteAccount. Technical accounts, active bank requirements, balance/currency/type restrictions and request uncertainty unchanged |
| Presupuestos: `Crear presupuesto` | Name→period detail; `Editar período` | Detail/linked transactions; `Nuevo período` only active; Edit this period; Activate/Deactivate; Delete. No bulk, no series-wide delete invented | `BudgetsManager.tsx` openNewPeriod/startEdit/toggleActive/confirmDelete, `BudgetDetail.tsx`. Target exact period/series ID; continuation calculates dates through existing logic, not prototype dates |
| Créditos: `Añadir crédito` | Name→detail; `Editar` desktop; More tablet | Detail, type-specific Edit, Deactivate/Activate, Delete; schedule/cycle inspection in detail. No generic `Pagar crédito` action invented | `CreditsWorkspace.tsx` type selector; `CreditsListPanel.tsx` openEditModal/handleSaveEdit/handleCardEditSuccess/handleToggleStatus/handleDelete. Card uses existing card form; noncard edit payload name+notes. ACTIVE/CLOSED does not settle debt. Card schedule add/update/remove cycle controls remain in existing editing context, not a new loan-payment engine |
| Por cobrar: `Registrar cuenta por cobrar` | Person→detail; `Registrar cobro` opens existing movement operation for explicit association/review | `Crear deudor` secondary section action. Person More: View, Edit person, Activate/Deactivate person, Delete person. Obligation rows: existing read detail/transaction link, no invented edit/delete obligation | `ReceivablesManager.tsx` debtor actions and ReceivableForm; `DebtorDetail.tsx` create obligation; `TransactionForm` receivable_collect. Never delete contact and silently cascade obligations. Known read-triggered repair gate O12 still applies |
| Por pagar: `Registrar cuenta por pagar` | Person→detail; `Registrar pago` opens existing movement operation | `Crear acreedor` secondary. Person More mirrors supported creditor operations. Obligation remains separate read detail | `PayablesWorkspace.tsx`, `CreditorDetail.tsx`, `PayableForm.tsx`, existing payable_pay operation. Original currency and exact obligation target validated, unknown initial currency excluded |
| Activos: `Registrar activo` | Name→detail; `Editar` | Detail, Edit, `Marcar como vendido` / Reactivate as existing status permits, Delete; no bulk | `AssetsWorkspace.tsx`→AssetsForm, `AssetsListPanel.tsx` edit/status/delete. State PATCH is ACTIVE/SOLD, not a generic archive. State does not record sale proceeds. Asset registration is not automatically the `asset_purchase` movement workflow; keep both existing entry paths distinct |
| Plantillas: `Crear plantilla` | `Usar plantilla` | Use, Edit, Delete; no activation, schedule, duplicate or archive | `RecurringWorkspace.tsx` handleUse/handleEditSuccess/handleCreateSuccess/handleDelete + RecurringForm. Use opens prefilled transaction **creation** for review, not edit of an existing movement and not automatic payment |
| Catálogos / Categorías: `Crear categoría` | `Editar` for eligible records | Edit, Delete only | `CategoriesManager.tsx` handleSubmit/startEdit/removeCategory, protected-category guard. No is_active action exists in this manager; prior round05 proposal is withdrawn. Keep category scope, color, icon/upload and link/server restrictions |
| Catálogos / Entidades: `Crear entidad` | Edit or existing `Personalizar` label for system presentation | Edit/personalize, Activate/Deactivate, Delete | `BankEntitiesManager.tsx` handleSubmit/toggleStatus/removeEntity. Server owns per-user system override/restrictions; do not globally forbid all system entity actions or mutate shared base rows |
| Catálogos / Monedas: `Crear moneda` | Edit only custom currency | Edit, Activate/Deactivate, Delete only non-system | `CurrenciesManager.tsx` handleSubmit/toggleStatus/remove, is_system guards. Keep code/symbol/country/default semantics. Currency UI does not authorize recalculation or migration of transactions |
| Catálogos / Tipos: `Crear tipo de activo` | Edit/customize | Edit/customize, Activate/Deactivate, Delete per current server action | `AssetTypesManager.tsx` startEdit/toggleStatus/remove + admin.actions. System type uses `Personalizar tipo`, not an invented blanket read-only lock. Preserve scoped overrides and restrictions |
| Avisos: `Nuevo aviso` | `Marcar leído` / unread when appropriate; link to source | Per-item read/unread and Delete. Toolbar `Actualizar avisos`, `Marcar todos como leídos`, `Eliminar leídos` (confirm count/scope) | `AlertsWorkspace.tsx` manual create, generate, toggle, delete and existing bulk handlers. Read≠paid/resolved. No edit notification or automatic financial action |
| Configuración: section-specific Save, not a universal Create | Profile save/photo upload/remove; preferences save; notification-rule save; security change password/send reset/end sessions/account delete | Export download; import template/analyze/commit/report and supported import rollback remain in dedicated Data workflow | Existing `ProfileSettingsForm`, `PreferencesPanel`, `NotificationsPanel`, `SecuritySettingsPanel`, `ExportPanel`. No auth mutation redesign, no new restore capability. Import rollback is a verified workflow exception to “no generic undo”, never a transient toast-only destructive action |

**Action availability:** an unsupported capability is absent; a supported but temporarily unavailable action is disabled with a visible reason/tooltipped explanation accessible by keyboard. Protected records expose `Protegido` explanation, not a dead More button. If a restriction can only be learned from existing API response, do not claim certainty beforehand or add an unauthorized validation fetch. Current backend enforcement always wins.

**Source audit follow-ups, separate approval:** `AlertsWorkspace.handleMarkAllRead` increments a successful count but maps every unread item to read even after partial failures. This round does not fix it; Sol must stop for a separately scoped stability change before claiming truthful partial-bulk feedback. `lib/toast/toast.tsx` persists some successes by default and currently drops oldest beyond5; renderer/timer changes must not multiply persistence or silently drop failure notices. Preserve persisted-activity policy while replacing the presentation queue. No migration is required for this visual protocol.

## 7. Chart decisions, one by one

Every chart has a question, data contract, label, failure state and exact-value alternative. No chart is justified merely by the existence of an endpoint. Existing calculation functions remain untouched even when their visualization is removed. “Remove” below means remove from the approved presentation; code deletion comes only after the final consumer audit.

| Current chart or visual | Decision | V3 visualization and destination | Reason / conditions |
|---|---|---|---|
| `FinancialHealthScore` radar and average | **Remove** | Replace with direct position facts and dated commitments on Inicio | Six normalized axes obscure their assumptions, and alert count is not financial discipline. No replacement health score. |
| `DashboardHeader` KPI sparklines and trends | **Replace** | Native-currency position band plus three exact monthly flow values | A sparkline beside “wealth” must not stand for cumulative transaction result or another quantity. |
| `CreditCapacityPanel` / `AvailabilitySplitPanel` | **Remove combined availability** | Compact Inicio credit region and full Créditos detail; native account totals remain separate | Borrowing capacity is not own money. Preserve separate factual numbers only. |
| `MoneyFlowChart` | **Modify and keep** | Paired vertical income/expense bars, shared zero baseline,6 actual monthly buckets by default,3/6/12 control in module analysis | Compare magnitude and surplus without a dual axis. If S02 is not closed, label actual returned period, not recent months. |
| `SaldosDiaChart` | **Rename and modify** | Single straight/step cumulative result line, zero baseline, period controls5D/1M/3M/6M/1A; Movimientos → Análisis | `Resultado acumulado del período`, explicitly not bank balance. Preserve computed series and real date gaps. No average-balance narrative. |
| `EgresosCategoriasWidget` | **Keep and integrate** | Ranked horizontal bars inside monthly report, top6; if >6 categories show top5 + Otros; exact value and share | Explains the monthly total in the same region. No rainbow; Others opens full ranking, never a fabricated category ID. |
| Income-category breakdown from sidebar | **Promote without adding a panel** | Egresos/Ingresos switch reuses the same monthly ranking; full version also in Movements analysis | Existing income composition becomes discoverable without increasing chart count. |
| `SavingsRateTrendChart` gauge, goal line and sparkline | **Replace** | Small current result/income fact in monthly footer and explanation; historical ratio line only in Movements analysis, no goal band | Removes invented20% personal target. Missing/zero-income month is a gap, not zero. Never call it investment return or available cash. |
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

All charts: title, unit, exact interval, full-value keyboard-accessible tooltip, accessible short summary and `Ver datos` table. Flow bars20 viewBox units wide (rendered width varies), paired6 units apart; the interactive month group, not the thin bar, is the pointer target. Below600px show3 buckets and the full6-month data table. At600px and above allow3/6; if actual group targets cannot reach44px on a touch layout, keep3 and the table. Inicio supports3/6;12 belongs to module analysis. Tooltip persists on tap and closes with Escape/outside tap. Hover is not required to know current totals. Mobile hides the analytical plot/ranking initially, not the exact monthly facts; see§8.

Missing history is a gap/empty state, never a filled zero or generated curve. Chart error keeps the section title/scope and retry; healthy adjacent sections remain. Rendering must not wait for an unrelated chart's fetch. No new plotting library is required.

### 7.1 Round03 chart craft contract

Keep the chart decisions in the inventory above. Distinction comes from FinTrack's encoding and inspection, not from substituting a more spectacular chart family. Each important Inicio visualization has a specific job:

| Visualization | Financial question | Locked treatment / interaction |
|---|---|---|
| Monthly paired flow | How much entered and left in each recorded month? | Shared zero baseline; solid green income, neutral outlined expense; a selected-month inspection lens and exact difference readout. No cumulative or predictive curve. |
| Category ranking | Which categories explain this period's total? | Ordered01–06, exact value/share,4px track normalized to the largest category. Entire row drills into existing scoped records. Shares use the full selected-type total, not the largest item. |
| Budget progress | Which allocation is exhausted or near its recorded limit? |6px track, terminal limit tick, rounded fill capped at track end, uncapped numeric percentage and exact excess/remaining. Red only for actual excess. |
| Credit utilization | How much of this particular verified line is used? |5px horizontal track/end tick; native debt remains separate from line-base equivalent. No ring, combined cross-currency percentage or cash label. |

**Flow construction.** The illustrative viewBox is560×232: zero at y192,15000 at y33;3 additional rules at5000/10000/15000; x43–556 plot extent. These fixed maxima are fixture geometry only: production chooses3–4 readable ticks from actual signed values and includes zero, never clips amounts above15000 or coerces unavailable values to zero. Negative provided amounts extend below zero with explicit signs. Bar pair width20+6+20 units, top-only4-unit corner rounding; no rounded bottom gap that distorts the zero origin. Grid uses1px line,2/5 dash rhythm, solid.8px baseline. Selected month's wash has10-unit corners and excludes the axis label. Month label becomes teal semibold, with20×2-unit anchor beneath; current incomplete month keeps its asterisk independently of selection. Chart text is≥11px **after scaling**; hit groups≥44px on touch. Money units/period are outside the plot so they do not obscure bars.

Inspection lens: initial selected/pinned bucket is the latest available month; current September fixture is explicitly partial1–21. Hover/focus changes wash, label and **chart-local** result readout only. Thin1.3px bracket joins that month's income/expense heights; it adds no third numeric series or projected value. Tooltip230px desktop/224px narrow,14px radius, real period/status, exact original report amounts and result. Click/tap/Enter pins the reading; moving away restores the pinned reading, hides tooltip. Escape/outside tap hides tooltip without clearing pin. Arrow keys move among month groups, Home/End may be supported but must not create a new date identity; tab order uses one active group. Never trigger financial writes, change the summary facts or implicitly filter all dashboard regions from a hover. The whole-period monthly totals stay September even when the chart inspects August. Table alternative remains available and keyboard accessible.

The preview's tiny tooltip emergence is the only plot transition. Bars, axes, money strings and selected geometry do not animate between financial values. No gradient, area, hatch suggesting uncertainty, point particles, decorative gold,3D, zoom-on-hover or truncated magnitude axis. Missing point means a gap/unavailable row. All months zero: honest zero rule and exact table, not a fake visible column. Partial-month comparison is explicitly partial; no inferred percentage improvement against full months.

Category rows are39px minimum desktop,44px touch (46px in mobile preview). Label/value11px desktop,12px mobile; share10px desktop/11px mobile; index10px secondary. Row track4px with3px end rounding, bounded hover/focus area10px radius, quiet inset rail. The 8px internal optical radius of segments is not a new card radius. Keep the column divider on wide screens and a spacing transition on narrow. Avoid oversized category cards and icon collections. Long names wrap where needed; money never truncates. Top5+aggregated Others behavior and real-ID safeguards remain unchanged.

Budget/credit terminal tick shows the known limit, not a confidence interval or forecast. Over-limit label remains107.5% in the fixture while fill stops at100%; don't hide the60PEN excess. Preserve unavailable denominator/rate behavior from the financial contract. These treatments are presentation-only over existing verified metrics.

## 8. Dashboard specification

### 8.1 Job, allocation and hierarchy

Inicio is a **working overview of recorded finances**, not a report builder or predictive score. Its questions and allocation are locked:

| Question | Region | Why it belongs here / what stays elsewhere |
|---|---|---|
| What balances are recorded today? | Native account position, PEN/USD/other verified codes | Not liquid cash or net worth; full account maintenance remains in Cuentas |
| What is still owed to me or by me? | Two compact documented-pending facts, separate currencies | Never net the two sides or include currencyless opening balances |
| What happened this month, and why? | Integrated monthly report: exact totals, paired history, category ranking, result explanation | Advanced cumulative/ratio history stays in Movements analysis |
| What should I review now? | Up to two factual attention links | Actual overdue/exceeded/unverified records, not AI advice or a notification score |
| What recorded commitments are coming? | Date-led agenda, 7/30 days | Not a forecast, payment scheduler or guarantee of collection |
| Which budget needs attention? | Three ordered budget rows and same-currency remaining | Full period/series management stays in Presupuestos |
| What did I last record? | Five latest movements | Full searching/export/pagination stays in Movimientos |
| How is my credit positioned? | Compact card debt/utilization and loan principal | Full schedules/rates/documents stay in Créditos; credit is never cash |

Assets stay in navigation and their module; they do not occupy the opening position band because registered asset value is less immediately actionable than current pending documents. No goals, recurring-charge detection, projection, financial-health score, AI recommendation, bank sync claim or invented month-on-month delta.

### 8.2 Exact desktop composition

Header: `Tu panorama financiero`, current calendar date; `Mes actual: septiembre` scope disclosure, direct `Registrar egreso` plus adjoining menu for all eight real operations. No large greeting, inspirational paragraph or extra metric row.

1. **Position band**, full width, surface/border/radius18,16px vertical/22px horizontal padding. Grid1.75fr/1fr/1fr,24px gaps. Accounts at left: label and account-count drilldown, then native amounts. Documented receivables/payables at right with vertical dividers. PEN primary and USD adjacent/secondary; additional verified currencies wrap as rows with visible codes. Do not hide them in a tooltip or silently convert them.
2. **Attention line**, compact links,18px below. Maximum two facts, severity order: overdue recorded obligation → exceeded budget → unverified amount metadata. If more, append a factual count leading to the responsible existing module/list, not a new alert engine. Do not count a read notification as a resolved financial issue. No attention records: omit the line and gap; do not insert congratulatory filler.
3. **Two independent vertical columns**: left1.85fr, right1fr minimum320px,18px gap;16px vertical gaps within each. Left: monthly report then recent register. Right: agenda then budgets then credits. Do not use a shared row grid that pushes recent records below the taller neighbor or stretches a short panel into blank space.
4. Quiet final scope note,11px: balances are current, report is dated, pending and credit retain their own meaning.

At1440×1080 the synthetic geometry (including the28px review-only toolbar) is position x236/y181/w1176/h118; report x236/y353/w752/h527; agenda x1006/y353/w406/h343; recent x236/y896/w752; budgets x1006/y712/w406. These are review landmarks, not fixed content heights. In production subtract the review toolbar from y coordinates. The first viewport contains complete monthly analysis, four commitments, budget attention and the start of recent records. Credit can be below the fold. Do not shrink text to force every module into900px height. At1280 allow the position's secondary currencies to stack; at1920 cap content width.

**Monthly report internals.** Heading `Así va septiembre`, subtitle `Del 1 al 21 · PEN de reporte`. Three linked facts, not cards: income, expenses, result; a divider before result. Two analytical columns beneath: paired monthly bars left, category ranking right, with a vertical divider. Plot starts at zero,6 months by default, partial current month clearly marked;3/6 control and exact-value table. Ranking uses one Egresos/Ingresos switch, six rows maximum: if six or fewer, all; otherwise top5 and an aggregated Otros row opening the full ranking. An actual category named Otros retains its real category ID and is not confused with an aggregation. Values are exact; relative bar length uses largest category, percentages use all current-type report amounts. Show exact amount and share on every ranked row at all breakpoints; ordinal numbers and4px inlaid tracks keep the ranking scannable without a second chart. No rainbow or icon for each category.

Footer: `Sin transferencias internas` and `41.0% de los ingresos queda como resultado`, linked to formula. If income is zero/unavailable show `Sin base para el porcentaje`, not0%. Negative result remains signed; do not paint all normal expenses red. This ratio is not a target, yield or balance.

**Recent register.** Five records ordered by transaction date descending with the existing tie-breaker. Columns: date45px, description/category flexible, account minimum100px, original amount112px, chevron12px;56px minimum rows. At1280 omit the separate account column and include account in detail. All five rows include transfers; no aggregate derived from the page. Footer offers Registrar ingreso, Transferir entre cuentas, Otras operaciones. `Ver todos` opens the unfiltered register; row opens its exact existing detail. Main desktop expense action remains visually dominant.

**Agenda.** Four rows maximum, date tile/day/month, counterparty or instrument, source/type, exact original amount, directional label and detail affordance. Heading contains 7/30-day segmented control. Footer states total in the selected interval and `No son pagos automáticos`; open interval drawer for all records. Sort verified overdue open records first (in an explicitly labeled overdue subgroup), then due date ascending, stable source-type/ID tie-breaker. Today's date through today+7 or today+30 inclusive is displayed explicitly; overdue records are additional and separately counted. The fixture has none overdue. No-date documents remain in their owning module, never assigned an invented due date. Deduplicate by source type + persisted record ID, not by amount/date/title. Don't show both a notification and its underlying commitment.

**Budgets.** Up to three current-period rows: exceeded first, then utilization descending, name tie-break. Label/spent/limit/uncapped percentage/remaining or excess;6px track with a terminal limit tick and fill capped100%. Include zero-limit row with `Sin límite válido`, no fabricated percent. Footer groups remaining by native/verified report basis; never mix currencies. Fixture's four PEN limits total5,450, spent4,380, remaining1,070. This is remaining budget allocation, not free cash.

**Credit region.** Show at most two active cards, ordered next verified due date then name, each with original PEN/USD debt and verified line-base utilization; if more, show count/link to Créditos. Then a distinct bank-loan principal summary grouped by native currency, not mixed into card debt. Fixture has one card and one loan. The line-base percent must open source detail showing basis/limit/equivalent uncertainty. No card? Use the same region for actual loan principal if present. No credits/loans? Omit region rather than an oversized acquisition card. Nothing in this region is summed into account position.

### 8.3 Tablet and mobile are intentional layouts

Tablet768–1199:68px rail;22px page padding. Position remains three columns, with account currency rows stacked within the first column. The monthly report spans both columns and retains side-by-side plot/ranking. Next row has agenda and budgets in equal columns, then full-width recent register, then credit as a horizontal strip. At834px there is no three-tile commitment carousel. At1024 landscape the same semantic layout remains, with greater horizontal breathing room. Text expansion may increase panel height; do not align panels through fixed heights.

Mobile<768:16px padding,52px topbar and one bottom navigation. Order: header → native account amounts and pending two-column band → factual attention → exact monthly facts → agenda → budgets → recent records → credit. Within the monthly report, `Ver flujo y categorías` is collapsed initially; expansion shows flow then category ranking. Keep this preference for the current route visit, not as a new server preference. Resize to tablet/desktop always reveals analysis; resize back to mobile retains the user's explicit choice. Essential income/expense/result are never collapsed.

Mobile agenda shows two rows and a `Ver los N` action; the drawer contains the entire interval. Do not silently show only two as if the interval were complete. Category and recent rows are full-width touch entries; account moves to detail when needed. Native account amounts remain23px (21px below360); monthly facts16px (14px below360), exact cents retained. Extremely large amounts stack blocks rather than clip or use K/M. Below600px the chart shows3 months and the full6-month data alternative remains available. Credit comes last, never inserted above the immediate review/recording task.

### 8.4 Data contract and read safety

| Block | Existing source / presentation mapping | Guard, scope and fallback |
|---|---|---|
| Account position | `/api/accounts?include_inactive=true`; `modules/portfolio/currency-display.ts`, group verified balances by currency | Active, non-CREDIT_CARD accounts. Preserve helper semantics; not RPC balancePen, not guaranteed liquid cash. Read failure → unavailable, not zero |
| Documented pending | Unfiltered `GET /api/receivables` **without debtor_id**, and `GET /api/payables`; existing `summarizeObligationCurrencies` | Pass only PENDING/PARTIAL documents for the opening open-pending scope; collected_amount/paid_amount map to settledAmount. The helper does NOT filter using isOpen. Label exclusions: closed/written-off/disputed and initial balances. Disputes remain explicitly discoverable in module, not silently settled. Unknown/custom unsupported currency outside verified totals |
| Monthly facts | Existing `/api/dashboard/summary` current-month report fields/formula | PEN report basis, current month only. Preserve calculation; explain provenance limitations. S01/S03 gates. No totals from recent five records |
| Monthly bars | `/api/dashboard/money-flow?months=6&mode=mensual` | S02 recent-window defect. API localized month strings omit year/ISO key: never infer year for a deep link. If reliable period identity unavailable, display actual supplied labels with provenance warning and disable historical record link; O06 for richer period contract |
| Category ranking/explanation | `/api/dashboard/sidebar?period=YYYY-MM`: normalized category_id/name/monto/pct for incomes and expenses from report amounts | Retain IDs, labels and report inclusion. Verify scope parity with summary; don't silently reconcile mismatches with fabricated category. If divergent, show section-local unavailable explanation and log review evidence |
| Budgets | `/api/budget-periods?period=YYYY-MM`, existing `lib/budgets/budget-metrics.ts` and period scope helpers | Keep current linked-transaction calculation and conversion behavior. Exact period target, not whole series or all category transactions |
| Due documents | The same unfiltered receivable/payable documents, with original currency, existing status/settlement helper and due_date | No new contact read just to obtain totals. Scope current documented open records. No-date excluded from agenda, still in pending. Unknown amount/currency → unavailable label; never defaultPEN |
| Due credit/loan | Verified owning credit/cycle/installment records already supported by module read paths; `/api/dashboard/alerts` may identify a source | Alerts alone are incomplete and may normalize unknown currency toPEN; sidebar cycles lack currency. Join only verified owning-record identity/currency. Do not infer one card currency for a dual-currency cycle. If verification unavailable, show source link with amount unavailable and `Agenda parcial`; ask before adding an API |
| Recent movements | Existing `/api/transactions?sort_by=transaction_date&sort_dir=desc&page=1&per_page=5` | Complete record IDs/original amount/currency/type/accounts. This page is NEVER a summary source. Report linked-record inclusion follows existing module semantics |
| Credit context | Existing `/api/credits`, `modules/credits/credit-detail-presentation.ts` and schedule helpers | Native debt versus line-base equivalent distinguished, loans separate. Unknown rate/line → percent unavailable, not0 |
| Attention | Already loaded budgets/dated documents/unverified metadata | At most two factual conditions, no new scoring/generator endpoint; initial balance count deduplicates joined counterparty IDs, no GET debtors repair call |

**Read purity is a requirement.** Never introduce `GET /api/debtors` or a debtor-filtered receivable call as an incidental dashboard dependency: these paths invoke legacy writes (F18). Do not mount a hidden old workspace to reuse its data. Unfiltered document routes are unpaginated in the inspected code; Supabase server row limits can still truncate large collections. Before displaying a complete-total label, prove coverage in the implementation fixture/current contract. If completeness is unknown, label `Registros consultados · cobertura no verificada`, keep original rows inspectable and stop for O01/O10 authorization before claiming an all-record total. Do not issue direct browser Supabase reads or repair records to fill a dashboard.

These mappings select, group and label existing results only. They are not authorization for new FX, balance, status, calendar or settlement calculations. Preserve documented scope explicitly even when a broader existing legacy total has different semantics. No independent “financial engine” in components. Query orchestration must share already-needed results, avoid per-row fetch fan-out and retain independent source states. O01 is an optimization decision, not a prerequisite to invent a new aggregate API.

### 8.5 Summary → explanation → records → action

| Trigger | Exact result and retained context |
|---|---|
| Native balance/count |580px account peek: original account amount/currency/status; account detail; link to Cuentas. No converted wealth number |
| Por cobrar / Por pagar | Existing module with open documented scope visibly stated; preserve owning contact/document identity |
| Monthly income / expense | Movements, type INCOME/EXPENSE, date_from first day and date_to current calendar day, page1; no forced native PEN filter because report base may include USD records |
| Monthly result/info/ratio |580px explanation: result, exact equation, income then expense category rows, report basis/exclusions, ratio definition. Unknown income denominator → unavailable ratio |
| Category row | Movements using category_id, report type, date_from/date_to and page1; retained chip removable individually. Clear category keeps type/date. If report participation cannot be reproduced by existing list filter, visibly say `Registros de la categoría; participación en reportes en el detalle`; never claim raw list sum equals report |
| Aggregated Otros | Full ranking in same drawer, each real category separately linked; never send an artificial ID |
| Month bar | Exact tooltip and data view. Only add date-filter link after ISO period identity is verified; localized month name alone is insufficient |
| Agenda row | Exact source preview/detail; original amount/date/status; explicit secondary register-collection/payment action using existing target identity. Never automatically pay on click |
| Budget row | Exact budget period detail; scope controls preserved; linked movements and existing edit entry |
| Recent record | Exact detail drawer, then edit with existing orchestration; close restores list scroll and filters |
| Credit row/utilization | Existing card/loan detail/schedule with currency basis; no new payment calculator |

Filters use current API spelling and enum values, not prototype English slugs: `type=EXPENSE`, `category_id=<persisted-id>`, `date_from=YYYY-MM-DD`, `date_to=YYYY-MM-DD`, `page=1`. The HTML fixture deliberately uses category names/hash routes; it is not an integration example.

No global historical dashboard filter: summary is current-month-only. Header month control explains stock versus flow and directs to supported dated analysis. Agenda7/30 changes only agenda. Category switch changes only ranking. Chart3/6 changes only historical plot. No default comparison against a complete previous month. Matched comparisons require a verified existing contract or O06.

### 8.6 Availability, scope and interaction states

No accounts and no movements: concise account-first onboarding, then first record. Accounts but no movement: real balances remain; monthly region empty with record action. No budgets: compact explanation/action. No due records: `No hay vencimientos registrados en este intervalo`, never `No tienes deudas`. No credits: omit credit region. A failed source must never trigger one of these healthy empty states.

Each source owns initial/slow/error/stale/partial state. Failed agenda keeps report, pending and recent available. Failed summary keeps verified accounts and records. A period/category mismatch disables the disputed explanation, not the entire app. Stale sources show their actual last success separately; do not attach one new timestamp to old siblings. Partially verified agenda says which source is unavailable and never reports complete coverage. Notices count is not a prerequisite to reading balances.

Privacy masks numbers in body, tooltip, drawer, chart data alternative and accessible names; do not imply browser privacy while exposing values to assistive technology. Desktop reading/focus order follows the independent columns: header → position → attention → report → recent → agenda → budgets → credit. Tablet/mobile reading/focus order follows their visual sequence: header → position → attention → report → agenda → budgets → recent → credit. Render one responsive presentation, not hidden duplicates; hold query ownership and selected interaction state above responsive wrappers so switching layout cannot repeat reads or lose a draft. Do not copy the simulator's CSS-only region reordering as a certified accessibility implementation. On mobile analysis disclosure announces expansion, restores focus, and never scrolls users unexpectedly. Production must use logical region headings/landmarks rather than the simulator's render-all state reset.

## 9. Screen-by-screen operational specifications

The following recipes plus shared components are normative even where the interactive preview covers only a subset of controls. A visual screenshot cannot remove a field/action that the recipe or current contract requires.

### 9.1 Movements `/transactions`

**Job:** find, inspect, correct or register an event. **Primary region:** the record list, not an analytical dashboard above it.

Structure: title+new movement; one summary strip for the current report period (Income, Expense, Result, base explicitly labeled); type tabs All/Income/Expense/Transfers; search, Filters, Saved views, Export; active scope chips; register; pagination. Summary must say whether it is whole-period or filtered. Do not recalculate a period summary from only the current page; if the API lacks filtered aggregate, keep period summary labeled `Resumen del mes, no cambia con filtros` or hide it for arbitrary ranges.

Default sort transaction date descending, stable tie-break as existing backend; page size20 with existing supported options. Filter dates are inclusive per contract; no client timezone shift. Preserve quick filters, advanced filters, sort, pagination, saved-view create/select/delete, selection, bulk delete and export. No group-by feature unless already supported; optional client grouping must not change server page semantics.

Analysis is a secondary in-page `Análisis` view or collapsible section after the register toolbar, entered deliberately. Exact charts: monthly paired bars, cumulative period result, category ranking and optional result/income ratio. Do not keep dashboard module-tabs just to house these charts. A new UI query parameter may persist view state without changing route/API contracts; choose `view=analysis`, default register, ignore unknown values safely.

Desktop detail:580px drawer with original amount, type, date, accounts, category, report participation, actual linked modules, attachment association status; edit/delete actions in footer; open full detail link. Direct `/transactions/[id]` has breadcrumb, original amount and same facts, then linked objects and notes/documents. Two-column details ≥960 (2fr/1fr), one column otherwise. Preserve fetching and attachment restrictions.

Mobile: record row with exact amount and direction, description, date/category, account; details in the near-full-height rounded workbench; full selection mode reachable from “Seleccionar” overflow and 44px hit targets. Pagination remains available. Search and filters do not disappear. Empty/filter-empty/error/stale contracts from§6.5 apply; financial summary must not show0 while loading.

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

Structure: period selector using supported period endpoints; per-currency Assigned/Spent/Remaining summaries; period/status/currency/search controls; `Este período`, `Excedidos`, `Otros períodos`; a full-width register with one compact exception band directly above it, at every width. On desktop the band is a horizontal context + action row; mobile stacks its text and full-width action. It replaces the old2fr/1fr note column so financial columns gain usable room. Only show this band for a factual exception; no generic advice card.

Row: name/category, complete period dates, spent, limit, percentage, remaining, status, exact-period detail. Use progress track plus numeric overage, not two separate charts. Sort default active period then exceeded descending by overage ratio, then name; allow existing user sort/filter where implemented. Category spending and budget-linked spending must remain distinct.

Create fields: name, description, category, currency, amount, frequency, start/end, active state and any current period/series controls. Preserve current validation, including overlaps and periods. Edit title `Editar este período`; confirmation names exact dates/ID; series-wide edits absent without O08. Detail: spend/limit/remaining, linked transactions and pagination, period metadata, record-scoped actions. Legacy rows use current `budget-action-scope` verification.

Mobile: name and percentage row; progress; spent/limit; remaining and dates below; link to exact detail. Never clip107.5% to100% text. No budget/no period/filtered empty are different states. Deleted period does not appear successfully removed until server confirmation and cache reconciliation.

Files: BudgetsManager, BudgetDetail, `BudgetVarianceBars`, `PresupuestosMesWidget`, `lib/budgets/*`, `modules/budgets/budget-action-scope.ts`, existing budget/series/period routes. Preserve all calculation and action-scope tests.

### 9.5 Credits `/credits`, `/credits/[id]`

**Job:** understand actual debt, upcoming dues and record-backed repayment context.

Structure: title and named Add credit action; position-scope explanation (not a historical-month filter); three-part Planning summary; Todos/Tarjetas/Préstamos/Líneas filter; search + active/closed/all filter; compact register; pagination. **List is default at every count**, including one or two products. Existing card view may remain a secondary View option, never automatically selected. Next commitments are row/detail facts, not an extra grid. Detailed dimensions, availability rules and default ordering are in§9.5.1. Card data: issuer/name/status; PEN debt and USD debt separated; line limit and its base; verified line-base utilization; available credit explicitly labeled; cycle close and payment date; cycle/document actions. No debt-total ring that merges card and bank-loan semantics.

Loan data: lender/name, native currency, original principal, verified principal outstanding when supplied, next installment/date, status, detail. Missing principal field shows `No disponible`, not inferred from total installments. Do not present “available” on a loan as credit limit minus principal unless current type-specific helper says it is valid.

Card form: issuer→name→line currency/limit→initial PEN debt→initial USD debt→closing/payment day→existing optional details/documents. Loan form: lender→disbursement account→name→currency/principal→positive FX if USD→installment count→disbursement/first-due dates→description→schedule. Schedule preserves installment number, date, capital, interest, insurance, other charges, total and status. Header summarizes sums of these actual supplied columns; no redistribution of total across missing components. Documents keep AVAILABLE/UNVERIFIED distinction and current supported routes.

Detail sections: summary; next commitment; card cycles or loan schedule; linked account/transactions; documents; notes. At≥960 schedule displays table with sticky first label column and numeric alignment; touch allows labeled internal horizontal region plus row detail. Disabled actions explain missing required verified schedule/rate data. Unknown currency mismatch is visible, not corrected by label.

Files: CreditsWorkspace, CreditsListPanel, CreditCardForm, BankLoanForm, CreditCardScheduleModal, BankLoanScheduleModal, CreditsManager, credit branches of ModuleDetails, `modules/credits/*`. Existing rate, schedule, detail and attachment unit tests mandatory.


### 9.5.1 Natural scalable credit register — round05 locked layout

**Summary shared with Planning.** Use the same unboxed, bottom-divided three-part summary geometry as Presupuestos, not credit-specific mini cards. Grid1.25fr/1fr/.9fr,24px gap,24px values desktop;22px tablet; mobile two amount columns plus one full-width count line. Fields: (1) active card debt by native currency, (2) original loan principal by verified native currency, (3) active product count and line count. No combined total across those three concepts. Source unknown/partial values disclose coverage; a sum from only the visible eight rows is forbidden. Search/type/status controls filter the register, not the active-product summary; label that scope. Production supports other native currencies as extra labeled lines; the PEN-only loan demonstration is not an implementation limitation.

**Type and evidence.** The current `lib/credits/display-type.ts` distinguishes CARD/LOAN/LINE while raw `credit_type` alone does not. Reuse it and `modules/credits/credit-detail-presentation.ts`; the latter uses verified loan evidence and labels its amount `capital original`. It cannot prove remaining principal from that value. Unknown product/evidence remains a visible “Información no verificada” row with existing allowed detail/retry, never silently classified as a loan, omitted or counted as zero. Unknown-source groups keep a separate count/coverage note; do not contaminate verified summaries.

**Rows and columns.** Default list for every record count, no automatic card-layout threshold. Desktop register18px radius, five columns: Product26%; amount and meaning23%; line/schedule21%; recorded due20%; actions10%.36px header;68px minimum rich row (content grows, money never ellipsizes); cell16px horizontal/10px vertical. Name12px semibold, secondary10px/16px, native principal/debt13px tabular. Compact32×36 outlined product glyph, not a large issuer tile. Each row provides a real named inspection button; row click may be a convenience, never the only keyboard path.

- Card: issuer/name + masked suffix; original debt buckets; verified line utilization with68×4px track and exact one-decimal percentage; next recorded cycle payment/date. The utilization track is not repayment progress. Equivalent basis/FX disclosed in detail; no new conversion.
- Loan: lender/name; original principal and currency; recorded installment index/total only when available; next exact installment/date. No repayment progress graphic or synthesized remaining principal. Preserve capital/interest/insurance/other breakdown inside the workbench.
- Line: original available amount explicitly called “Disponible de la línea”; limit separately; no own-cash implication. No future due claim without a dated record.
- No recorded due → `Sin vencimiento registrado`, not “al día”; no verified schedule → `Sin cronograma verificado`, not a calculated guess. Closed rows remain inspectable in Cerrados, with actual stored state and zero/unknown distinction.

**Controls and scale.** Todos/Tarjetas/Préstamos/Líneas are filter buttons with selected semantics and stable counts. Search name, issuer and supported masked suffix; state Todos los estados(default)/Activos/Cerrados. Reuse existing currency/issuer filters in the filter menu; the prototype demonstrates the core subset, not removal authority. Reset page1 on any filter change. Production default page size20, retain existing supported page-size options; the review fixture deliberately uses8 to expose pagination without a very long screenshot. Preserve current server ordering and any existing sort control; do not add unsupported backend sorting. No infinite product-card wall and no virtualization for a tiny two-record list. If the source is an already verified complete array, local pagination is presentation-only; otherwise preserve existing server pagination/coverage or request O10. Do not aggregate all-credit totals from a capped response.

**Responsive.** Tablet uses full working width beside the68px rail; omit redundant glyph, retain a44px More cell (8% of width) and named44px inspection control; direct Edit is inside More to protect financial columns; amount/native secondary currency stacks, due amount/date stacks. Rows typically80–84px for touch, never compressed to desktop48px. Mobile replaces the wide table with rich rows: name/type left, exact amount/meaning right, due amount/date below,44px detail action; minimum92px for the two-line record, grows for dual currency/long names. Do not mount a second fetching table; use one responsive presentation owner. Keep pagination and search visible and retain selected filters when dismissing detail.

**Detail and actions.** Use the established580px workbench. Header product name/type/lender/state; summary amount explicitly labeled; native secondary currency separate; key facts; recorded next commitment and its actual components; existing cycles/schedule/documents/linked transactions/notes/actions. Closing returns to the exact row and scroll. Full existing edit/payment/schedule routes remain operable; the isolated preview intentionally provides read/review flows for added fixtures and does not process payments. A card payment cannot be reused as a hard-coded1200 expense for a loan: carry the exact product + cycle/installment target into the existing owning workflow. Unknown schedule/rate/document data keeps the existing guarded state.

**One natural product register.** No `Revisar escala`, sample-size selector, giant scope banner or user-facing fixture switch. Default exposes every available product, including closed records labeled as such. The fixed review set contains12 products:6 cards (one closed),4 loans,2 lines. Active summary remains PEN10,370 + USD800 card debt; PEN57,300 original loan principal;11 active. Page8 in this preview demonstrates pagination; the real contract remains existing pagination/default20. QA can call a review-only hook for2/40 stress fixtures; it is not reachable from product controls and must not ship. Normal Inicio identifies2 featured products out of12 and its agenda includes all recorded dates from the same fixture. Do not make featured amounts look like whole-portfolio totals.

### 9.6 Receivables `/receivables`, `/receivables/[id]`

**Job:** know who owes what, in which currency, and record a collection against the right obligation.

Native-currency pending summaries; unknown initial-balance notice with affected record count; search and status filter; Persons list as existing mental model, each row contains a currency stack rather than one consolidated amount. Status labels Pending/Partial/Collected/Written off retain meaning. Counterparty activation is separate from settlement state.

When arriving from Inicio's open-pending summary, retain its PENDING/PARTIAL documented scope and explain excluded initial/closed records. The existing all-document person detail still shows its own labeled total/collected/pending history; it is not silently rewritten to match a differently scoped dashboard number. Do not refactor read-triggered legacy repair in this visual stage (F18/O12).

Person detail580px drawer / direct route: name/contact metadata; separate currency buckets of documented total/collected/pending; preserved unverified initial balance; dated obligations; transaction ledger with signed incoming/outgoing meaning; create obligation, collect, edit person and permitted deactivate/delete. One currency per progress bar. Do not cancel positive PEN with negative USD. Unknown records cannot produce a “settled” badge.

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

Rows: name, operation type, description, source/destination/category, original amount/currency, `Usar`, edit/delete. `Usar` keeps the existing `/transactions/new` prefill contract; opens reviewable form, no immediate write. Create fields retain type/accounts/category/counterparty/name/amount/currency/description/notes. Existing edit restrictions may limit changes to name/description/notes; show locked financial fields rather than enabling unsupported changes.

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

`/admin`: personal `Catálogos`, unchanged permissions. Categories, Banks, Currencies and Asset types retain their own fields and capabilities in6.7. Categories do not have activation; system currencies are protected; system entities/types may support per-user personalization through existing contracts. Do not apply one generic system lock or menu to every catalog. Searchable rows, semantic type/origin metadata, visible Edit and More; touch44px. Mobile tabs scroll, record content does not. Preserve code/symbol/name, category scope/system key, colors/icons/uploads and all server restrictions.

`/developer`, `/developer/bank-icons`, `/developer/control-center`, `/admin/icon-studio`: preserve current environment gate and redirects. Functional tools use same type/control vocabulary, dense tables/preview grid as appropriate. Clearly label local/developer environment. No new live controls or production-config mutation authority.

`/module-status/[moduleKey]`, `/maintenance`, not-found and global-error: one title, useful explanation, allowed retry/back/home action, and existing authenticated/system redirect behavior. Do not render navigation to disabled modules as live actions. Maintenance should not promise recovery time without provided data.

### 9.13 Authentication and public entry

This remains within visual scope only. `/login` and `/register`: neutral canvas, constrained420px form, wordmark, title, email/password/confirmation according to actual form, submission errors at field/form, password visibility accessible, sign-up/reset links. Optional product illustration must be real approved UI, not fake financial growth. Desktop one form column plus quiet explanatory panel only if it adds understanding; mobile form first and no carousel before fields. Preserve callback, recovery, redirect and session code byte-for-byte in visual stages.

Public `/`: coherent typography and palette, concise description of tracking money, debts and plans; true current capabilities; primary enter/sign-in and current registration flow. Do not promise live bank connections, investment performance, automated payments or certified financial advice. No landing-page conversion redesign is required to approve the operational app direction; extend brand tokens after core app acceptance.

### 9.14 Universal detail anatomy

Breadcrumb/back preserving source context; object name/status; native amount and meaning; dated facts; linked records; documents with verified association state; notes; permitted actions. A record that no longer exists shows specific not-found, not an empty healthy detail. Server load error is retryable without suggesting record deletion. Direct-load detail pages must remain functional when opened from a saved URL and signed-in session. Mobile detail is a full page/sheet with one clear return action and footer spacing.

## 10. Structural opportunities, independently approvable

None of these proposals is authorized by visual approval. “Optional” means independently scoped, not that correctness/security issues may be ignored. S01–S06 below are prerequisites or verification packages; O01–O12 are optional product/architecture investments. The core visual design has a safe fallback for each optional item.

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

### O12. Make legacy receivable repair an explicit workflow

- **Current:** `GET /api/debtors` always calls `repairLegacyReceivableLinks`; `GET /api/receivables` with debtor_id can call it. The helper inserts missing receivable rows and relinks legacy debtor/transaction associations, including name-based matching.
- **Problem:** reading a new overview can become an unexpected write; repeated/retried reads and query preloading no longer have ordinary read-only semantics. Matching by name also deserves independent integrity review.
- **Proposal:** a separately authorized, idempotent repair command with dry-run report, exact candidate IDs, explicit confirmation, audit trail and post-repair reconciliation. Make ordinary GET paths read-only after consumer compatibility review. Do not silently disable existing repair behavior inside a visual PR.
- **Benefit:** predictable reads, safer dashboard/preload reuse and inspectable legacy correction.
- **Risk:** contacts that currently depend on implicit repair may appear incomplete until explicit repair runs; mistaken linking may alter financial relationships. Repeated repair must not duplicate documents.
- **Existing data:** preserve all current records/IDs; generate a before/after association report for affected candidates. No automatic bulk backfill or fuzzy relinking on dashboard visit.
- **APIs:** move side effect behind an explicit command; retain GET response shape where feasible and document compatibility/change in repair timing.
- **Supabase:** same financial tables initially; optional audit/idempotency store only with separate schema/RLS approval. No broad policy relaxation.
- **Migration:** behavior cutover and opt-in candidate repair, with recorded created IDs/old links and a reviewed compensating rollback. Reverting frontend alone cannot reverse a completed repair.
- **Difficulty / priority:** medium-high / P1 before expanding any repair-dependent read; not required to approve the visual design.
- **Core fallback:** use existing unfiltered document reads without debtor_id for Inicio, show verified scope/completeness and never trigger contact repair as a new dependency. Existing module behavior remains untouched until this package is approved.

## 11. Implementation Handoff for GPT-5.6 Sol

Use `FINTRACK_REDESIGN_V3_SOL_HANDOFF.md` for the operational phase packets, exact integration files, preview checkpoints and stop conditions. The sequence below is canonical and is mirrored there; do not re-order it by implementing the dashboard directly from static HTML.

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
| `DetailDrawer` | `components/detail/DetailDrawer.tsx` | open/close, title, focus restoration, scroll retention,580px width, shared direct-route content. |
| `RecordFormDrawer` | evolve `components/ui/RecordModal.tsx` or thin adapter |580px ordinary /960px schedule, mobile8px gutters/24px corners, unsaved state and sticky footer. |
| `DataBoundary` | `components/finance/DataBoundary.tsx` | initial/slow/error/empty/filtered/stale/partial/ready from existing data state, no fetching/mutation side effects. |
| `ChartFrame` | `components/charts/ChartFrame.tsx` | title/scope/legend/data alternative/error, actual11px min labels, shared tooltip theme. |
| `MonthlyFlowBars` | migrate MoneyFlowChart | current series mapping, no new formula, single axis. |
| `BudgetProgressRow` | share dashboard and budget list | exact metrics, capped visual fill, uncapped value and excess. |
| `CommitmentList` | `components/finance/CommitmentList.tsx` | verified due date, original amount/currency, type/status, owning link, partial coverage. |
| `CurrencyBucketSummary` | reuse obligation helper/components | one currency bucket per row, unknown outside trusted total. |
| `LinkedRecordList` | `components/detail/LinkedRecordList.tsx` | actual persisted relationships, no new inference by matching description. |
| `MonthlyReport` / `CategoryRanking` | `components/dashboard/v3/MonthlyReport.tsx`, `CategoryRanking.tsx` | summary + historical bars + current category selector, independently available; no aggregate from paginated recent rows |
| `ResultExplanation` | `components/dashboard/v3/ResultExplanation.tsx` | equation, named scope, category IDs and drilldown; no new savings formula or claim |
| `RecentMovementList` | `components/dashboard/v3/RecentMovementList.tsx` |5 source records, exact native direction/amount, existing detail action, no duplicated mutation handler |
| `CreditOverview` / `AttentionLine` | `components/dashboard/v3/CreditOverview.tsx`, `AttentionLine.tsx` | separate card/loan semantics; factual exceptions, no score/AI or new notification generator |

`lib/tokens.ts`, `app/globals.css`, `tailwind.config.ts` and font loading must agree; do not leave two contradictory “sources of truth.” Keep compatibility aliases until the last consumer migration. New globals must be scoped behind a V3 root attribute during development. React server/client boundaries remain intentional: formatter/adapter pure where possible; interactive drawer/tab/filter client; financial service untouched.

### 11.3 Exact recommended sequence

| Stage | Deliverable and project zones | Dependencies / acceptance | Tests and rollback |
|---|---|---|---|
| 0 | Approvals, baseline SHA, safe Preview fixture set, security/stability issue register | Owner V1 decision, S01/S06 status explicit, baseline screens retained | No runtime change; documentation rollback only |
| 1 | Independent prerequisite packages S01–S06 where approved | Keep each concern separate; close gates needed by later modules | Cross-user/long-history/partial-error/inactive-bank tests in safe environment; package-specific revert |
| 2 | V3 fonts, tokens, dark mapping, scoped root opt-in; `globals.css`, Tailwind, `lib/tokens.ts`, layout font import | Final palette/type values from§4; old pages must retain old look until opted in | Sentinel screens in both themes, contrast and no layout shift; remove V3 flag to restore prior theme |
| 3 | MoneyText, FinancialScope, PositionBand, DataBoundary | No money/FX calculation changes; unknown≠zero | Pure presentation fixtures: negatives/zero/unknown/custom/large/multi-currency; revert components/imports |
| 4 | Buttons, inputs, selects, menus, tabs, toast and focus | All states,44px touch, anchored menus and master4.4 motion policy; compatibility props retained | Component keyboard/form-error/reduced-motion checks; revert adapter usage |
| 5 | Table/filter/detail/form shell primitives and ChartFrame | Exact580px stable workbench and filter semantics; guarded back and cancel-safe lifecycle; no module-specific mutation extraction | Focus trapping/return, dirty dismiss/back, interrupted exits, immediate keyboard/reduced, URL filter, overlay collision,320/390/834/1440; rollback primitives independently |
| 6 | Shell/IA: AppShell, Sidebar, Topbar, NavItem, nav constants, quick-create placement | Existing paths/gates preserved; approved label changes; no auth/layout-data refactor | All links/quick-create URLs, desktop rail, mobile bottom nav, sign-out/menu, private mode; opt-in shell rollback |
| 6a | **Catalog action-protocol pilot** | Master6.6–6.7/handoff4.6; category create/edit/delete, entity state; existing contracts and fields | Draft/error/unknown, ephemeral queue/focus, restrictions; revert presentation adapter only |
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

- Light-default/fully supported dark, teal action role, FT Ligature geometry, restrained gold, Manrope and numeric precision.
- Native currency separation, accounts-versus-cash and debt-versus-credit distinctions.
- No financial health score/radar, unqualified net-worth hero, wealth sparkline or combined available-cash-plus-credit metric.
- No global date/currency filter implying unsupported recalculation.
- Exact bottom navigation, sidebar route order, existing paths and8 operation identities.
- Drawers/row density/form section sequence and mobile record transformation.
- Integrated monthly explanation/ranking, five recent records, independent desktop columns, paired tablet agenda/budgets and mobile progressive analysis.
- Read-only dashboard sources: no incidental legacy repair GET, hidden workspace mount or aggregate inferred from a truncated document list.
- No missing-value-to-zero, invented schedule, invented date, sample data in real modules, inferred attachment success or read→resolved relabel.
- Optional O items remain separate. A visually attractive chart does not justify new finance logic.

## 12. Acceptance and QA contract

### 12.1 Financial golden fixtures

Before each integration stage, capture API/source values for a deterministic synthetic dataset and compare before/after render from the same values. Golden cases include PEN/USD/custom currencies; negative/zero/large balances; inactive and technical accounts; income/expense/transfer; credit consumption/payment; debt creation/partial settlement; mixed-currency contacts with unverified opening balance; dual-currency card; exact loan schedule components; budget series with adjacent periods; asset custom type and3 statuses; attachments AVAILABLE/UNVERIFIED/legacy; dates at month end and around Lima midnight.

Pass conditions: no stored-value or formula result changes; every original amount and relationship survives; transfers excluded from income/expense under existing rules; currency buckets never collapse; no unsupported financial assertion; selected record/period mutation target unchanged. Intentional label/chart removal is permitted only as approved by this V3 plan and recorded in the before/after change list. Existing baseline rules that forbid all visible changes do not override this explicit new design scope.

### 12.2 Visual and responsive matrix

Required integration captures:320×800,390×844,430×932,768×1024,834×1112,1024×768,1280×800,1440×900,1440×1080,1920×1080; both themes for primary flows. 200% browser zoom at1440 and text expansion+30%. Do not substitute a scaled desktop screenshot for responsive mobile.

Inspect: no page overflow, no clipped monetary values, no sticky footer covering error/focused input, no tooltip/menu clipping, labels remain readable, tab/selection active semantics, standard icon stroke and token usage, no duplicate generic mobile Registrar, FAB never obscures mobile record amounts, calendar-date correctness, identical money in all sizes, minimum44px touch controls. At reduced motion all nonessential movement disappears. Main sections are visually distinct through spacing/dividers, not random card shells.

Screenshot acceptance tolerances: same fixture/route/state/theme/font; principal boundaries within±4px at approved widths, spacing/token values exact, chart/amount alignment visually consistent, no unauthorized hierarchy or additional KPI. Do not use per-pixel screenshot thresholds across operating-system font renderers as financial correctness evidence. Automated snapshots protect regressions on a fixed browser image; owner reviews intentional changes.

### 12.3 State matrix per route

For each operational module run: initial load; slow read2s; timeout10s; unauthorized response; primary fetch failure; auxiliary options failure; true empty; filtered empty; ready; refresh failure with stale data; unavailable currency metadata; blocked action; submit busy; submit validation error; uncertain write; retry/reconciliation. If a state is not meaningful, record why rather than mark it passed.

Dashboard special: fail each source independently, verify siblings; a failed read cannot generate zero facts or a positive health assertion. Test partial current month, no income, negative result, missing months, >N monthly history, no budgets and no due dates. Test cross-currency position with a custom code and incomplete metadata. Test summary→explanation→category→record→edit with period/type/category retained; actual category named Otros versus aggregated Others; recent five versus whole-period totals;7/30 days, overdue and no-date commitments; card cycle with unknown currency; disjoint source IDs; server row truncation; no read-triggered repair calls. Mobile analysis starts collapsed but totals stay visible, tablet analysis remains expanded.

### 12.4 Functional and accessibility acceptance

Keep current unauthenticated redirect/API tests. Authenticated E2E requires a disposable non-production Supabase/user, never the owner's real finances. Update the management selector mismatch before claiming it passes. Re-run relevant existing suites per stage, then full unit+type/lint/build and authenticated smoke at release. Verify browser back/direct URLs/query quick-create still work.

Keyboard-only: navigate shell, open/create/cancel a record, apply/reset filters, select a table row, inspect chart data, edit via drawer, handle dirty dismissal, and return focus. Check screen-reader announcements and semantic tables; focus stays visible and unobscured. Contrast target is WCAG2.2AA: normal text4.5:1, large text3:1, essential UI states3:1. The internal touch target44px exceeds the WCAG2.2AA24px minimum; do not claim44px is the AA minimum. Verify actual combinations in both themes.

References for these narrow accessibility requirements: [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). This is an engineering target, not a claim that the prototype or current app has a full accessibility certification.

### 12.5 Performance acceptance

Measure before/after on the same Preview fixture/device/network. Goals: navigation shell response≤100ms, local filter feedback≤100ms for100 rows, synthetic loading geometry visible≤200ms, no avoidable layout shifts (targetCLS≤.1), no new blocking dashboard dependency. Record network count/server timings rather than hiding them with skeletons. Production runtime targets require measured p75 evidence; this mission does not claim they are achieved.

Keep heavy chart code out of modules that do not use it; mount analysis only when entered, with clear loading states. Do not preload every full module blindly. Reuse font assets and prevent external font waterfalls. No new JS library solely for a simple chart, focus ring or animation. A cold dashboard read still depends on backend correctness; O01 is a separate optimization, not a promised result of CSS.

## 13. Visual deliverables and review procedure

Artifacts under `docs/redesign-v3/`:

- `preview/index.html`, `design.css`, `app.js`, `dashboard.js`: refined isolated navigable high-fidelity proposal; original Spanish UI, synthetic data only.
- `preview/refinement.css`, `refinement.js`: round03 surface/visualization treatment, contextual workbench, anchored menu and cancel-safe motion reference. Isolated prototype overrides, not production integration architecture.
- `preview/evolution.css`, `evolution.js`: round04 isolated shell, neutral dark insets, dense ledger, scalable credit fixture and contextual quick action. UI preference only is persisted; financial fixtures are not.
- `preview/precision.css`, `precision.js`: neutral material/searchable controls; round06 callbacks close forms into transient feedback.
- `preview/actions.css`, `actions.js`, `verify-actions.mjs`: audited row/header actions, brief feedback, catalog state examples and dedicated QA. They are isolated review wiring, not production architecture.
- `archive/round-5/`: complete predecessor before this round, including59 captures.
- `preview/verify-precision.mjs`: dedicated round05 selection/action/fixture checks and captures47–59.
- `preview/verify-evolution.mjs`: dedicated shell/register regression assertions and captures36–46; machine-readable evidence in `screenshots/evolution-verification.json`.
- `preview/motion.html`, `motion.css`, `motion.js`: same-origin live workshop with real/slow/reduced motion; review-only controls. Requires the local HTTP server.
- `preview/verify-motion.mjs`:33 dedicated interaction/lifecycle/geometry checks; evidence in `screenshots/motion-verification.json`.
- `preview/brand.html`, `brand.css`, `brand/*.svg`: FT12 identity applications, optical sizing, light/dark, mono and app icon.
- `preview/fonts/*`: local Manrope files and license, deterministic offline typography.
- `preview/serve.mjs`: static server bound to127.0.0.1, serving only the preview directory, with `connect-src 'none'`.
- `preview/verify.mjs`: local Playwright visual/interaction checks; imports no application auth/config and calls no production APIs.
- `screenshots/`: standalone readable captures covering desktop/tablet/mobile, light/dark, transactions, accounts, budgets, credits, forms, detail, loading, partial error and empty.
- `README.md`: launch instructions and limitations; `QA_REPORT.md`: executed evidence and open verification gaps.
- `archive/round-4/`: earlier round04 predecessor, including master/handoff, preview, QA and46 captures.
- `archive/round-3/`: earlier predecessor, including master/handoff, preview, QA and35 captures. Historical comparison and design-only rollback.
- `archive/round-2/`: complete pre-refinement plan, handoff, prototype and28 captures. Historical comparison/rollback only.
- `archive/round-1/`: preserved blue V3 plan, full preview and20 prior captures. Historical only; never mix its tokens/layout into the refined implementation.

Run `node docs/redesign-v3/preview/serve.mjs`, then open `http://127.0.0.1:4173/`. It also works by opening `index.html` directly in a browser with local sibling files. Navigation stays in hash URLs. Theme and state controls live in a clearly separated proposal bar and are **not** production UI. No publish/deployment was performed.

Suggested current review: Catálogos → create/edit/delete a category; Entidades → deactivate/activate; try error/unknown response and the clearly marked feedback review controls. Confirm no success screen, no persistent success band, auto-dismiss, hover/focus pause and FIFO bursts. Then inspect Movimientos/Cuentas/Presupuestos/Créditos/Por cobrar/Por pagar/Activos/Plantillas/Avisos header, row and detail actions, including44px tablet/mobile controls. Captures60–69 (with separate65 module views) show this round. Other refreshed captures retain visual regressions. Live `motion.html` scene10 and the preview are necessary to evaluate timing. Financial fixtures stay fixed with explicit simulation labels; catalogs change in memory only. Abbreviated secondary forms are not authority to remove production fields or validations.

### 13.1 Coherent sample fixture

As-of September21,2026. Account PEN:18,640 +7,200 +1,000 =26,840; USD3,200 separately. September report sample is entirely PEN: Income9,600 +2,880 =12,480; Expense2,480 +1,800 +1,080 +860 +640 +500 =7,360; Result5,120. Internal transfers600 and1,000 are excluded from that result.4 budgets: limit5,450, linked spending4,380, remaining1,070; Transporte800 limit/860 spend/60 over. Featured Andino card debt4,800PEN and180USD (not the12-product aggregate); illustrative line-equivalent debt at3.8 is5,484/15,500=35.38%, shown35.4%. That sample FX is not a real rate recommendation. Loan original principal10,800 is not an asserted remaining balance. Its next installment500 capital+150 interest+20 insurance+10 other=680. Assets35,000+3,500=38,500PEN.

Totals describe the fixture scope, not necessarily the page's search subset. Charts/history outside September are synthetic monthly aggregates, not extracted real transactions. The fixture makes no claim that current balances can be derived solely from the12 displayed September records; balances also reflect prior records/opening positions.

Round02 additions use that same fixture: receivables2,850PEN +400USD; payables3,100PEN +250USD, never netted. Five commitments within21–28September: Andino card1,200PEN on23rd, collection850PEN on25th, Costa card460PEN and payable1,100PEN on26th, loan680PEN on28th. The30-day drawer has11: additionally studies loan1,120PEN on30September, Viajes card180USD on2October, home loan780PEN on3October, Familiar card510PEN on5October,400USD collection and250USD payment on10October. Dates are explicit fixture fields; the7-day interval excludes30September. This reconciles the natural12-product register without recalculating fixed account balances or monthly flow. Unscheduled documents remain in pending totals but not agenda. One ambiguous opening balance stays outside verified totals. Result/income=5,120/12,480=41.0256%, displayed41.0%. Income category toggle uses9,600 salary and2,880 independent work, not new synthetic income added to the total.

## 14. Approval decisions and completion

| Approval | What the owner approves | What it does not authorize |
|---|---|---|
| **V1 Product and visual direction** |§3–9: navigation/labels, hierarchy, palette/type, components, forms, responsive, dark, chart changes and safe semantic labeling | Backend/financial changes, migrations, security changes, production rollout |
| **V2 Identity applications** | FT Ligature Concept12 as supplied; specified geometry, palette, light/dark lockups, optical small mark, app icon and favicon | No new logo exploration or automatic replacement of deployed assets before a scoped implementation PR |
| **V3 Implementation sequence** |§11–12: staged module work, QA gates and rollback | Does not automatically merge or deploy PRs |
| **S01–S06** | Each explicitly authorized investigation/fix with its bounded scope | Unrelated changes to auth/RLS/business logic |
| **O01–O12** | Individual structural investment; each gets a concrete separate specification/approval before mutation | No bundled schema/API authority from liking the design |

This design mission is complete when the master plan, visible artifacts, repository-grounded findings, optional-change register, operational handoff and QA evidence are delivered. Production implementation has not started. Do not treat this document's existence as owner approval or completion of Gate1.

## 15. Owner decision summary

Round06 preserves identity, color, shell, chart language and the established financial hierarchy. It corrects successful-action feedback into a brief animated acknowledgement that disappears automatically and makes supported operations visible throughout the modules. Categories no longer promise state changes; asset state and contact-versus-obligation actions are explicit. No production implementation or financial-data changes were made.

The key improvement is the path from result to explanation, category records and action, not more cards. Tablet uses paired working regions; mobile prioritizes exact facts and commitments with expandable analysis. Existing records, relationships, routes, calculations, auth and financial protections remain. Unsupported scores, targets and projections stay out. Newly identified read-triggered link repair must be handled separately, never added as an incidental dashboard dependency.

The owner should approve the refined direction, FT12 applications and execution plan. Structural opportunities require individual approval. After explicit approval, Sol can implement in phases using this master and the operational handoff, with geometry, contracts, visual references, tests and stop conditions already defined. This design round neither changes production nor authorizes implementation by itself. The delivery message provides the owner's concise Spanish summary.
