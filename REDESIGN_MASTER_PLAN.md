# FinTrack Premium Redesign Master Plan

Status: source-of-truth planning document

Scope: protected FinTrack product experience (`app/(dashboard)`)

Prepared from: repository audit on 2026-08-06

Implementation status: not started by this document

## 1. Executive summary

FinTrack does not need a generic visual replacement. It already has a recognizable foundation: warm neutral surfaces, a restrained teal primary color, a strong brand mark, tabular financial values, useful list/card views, and mature workflows for transactions, portfolios, credits, assets, budgets, receivables, payables, recurring transactions, alerts, administration, and settings.

The main problem is fragmentation. The product currently presents several generations of UI at once:

- a newer shared system in `components/finance`, `components/forms`, `components/ui/Button.tsx`, `AppSelect.tsx`, and `RecordModal.tsx`;
- older table, detail, state, card, and modal systems that remain active beside it;
- dashboard-specific visual primitives that form a third system;
- settings-specific primitives and a large settings token layer;
- more than one token namespace and many component-local colors, radii, shadows, loaders, filters, and empty states.

This fragmentation makes the app feel more crowded and less coherent than its underlying product deserves. The repeated outer-card/inner-card pattern, numerous arbitrary radii, small uppercase labels, dense filter rows, inconsistent modal/drawer behavior, and mixed light/dark styling produce a “slow-feeling” experience even when data performance is acceptable.

The redesign direction should therefore be a **calm financial operating desk**: precise, warm, restrained, data-led, and premium through hierarchy rather than decoration. It should evolve the existing warm-neutral/teal identity, not replace it with a fashionable blue/purple SaaS aesthetic. Large amounts and decisions should be visually dominant; containers, accents, and motion should recede.

Implementation must be progressive. First freeze the foundations and canonical component contracts, then redesign the shell and common states, and only then migrate one module per pull request. Business logic, routes, API contracts, calculations, Supabase, authentication, and persistence remain unchanged. The intentionally paused B3.4 `dashboard.layout-data` performance work is explicitly out of scope.

## 2. Scope and non-negotiable guardrails

### In scope for the redesign program

- visual hierarchy, layout, spacing, typography, responsive behavior, and motion;
- shared presentational components and tokens;
- accessible states for loading, empty, error, success, disabled, and pending behavior;
- visual consistency across tables, cards, tabs, filters, buttons, forms, modals, drawers, charts, and detail pages;
- clearer user-facing copy where it does not change domain meaning or behavior;
- screenshot-based visual acceptance in local development and Vercel Preview.

### Out of scope unless separately approved

- API contracts, financial calculations, formulas, exchange-rate behavior, or dashboard metrics;
- Supabase schema, RLS, migrations, queries, persistence, or generated database types;
- authentication, middleware, login, sessions, redirects, permissions, or Vercel configuration;
- route or navigation information architecture changes;
- removing existing functionality, fields, views, filters, or actions;
- introducing a UI, icon, animation, chart, or form library;
- B3.4 `dashboard.layout-data` or other performance/data-loading architecture work;
- broad refactoring of large stateful components during visual migration.

Every redesign PR must remain a redesign PR. It must not combine bug fixing, feature work, data refactoring, or business-logic cleanup.

## 3. Audit basis

This plan is derived from inspection of the real application, including:

- `app/(dashboard)/layout.tsx` and all 22 protected page routes beneath `app/(dashboard)`;
- the authenticated shell in `components/layout`;
- the dashboard workspace, tabs, charts, cards, and widgets in `components/dashboard`;
- `components/management/PortfolioManager.tsx`;
- transaction workspace, table, selector, edit flow, and the 3,000+ line conditional transaction form;
- shared form, finance, table, detail, UI, accessibility, skeleton, and state primitives;
- credits, assets, budgets, receivables, payables, recurring, alerts, admin, settings, module-status, and developer tools;
- `app/globals.css`, which is approximately 3,500 lines, and `tailwind.config.ts`;
- current light/dark tokens, responsive grids, loading fallbacks, empty states, error banners, tabs, modal and drawer implementations, filters, and button patterns.

Repository evidence that affects the plan:

- The primary stack is Next.js 14, React 18, Tailwind CSS 3, Recharts, SWR, React Hook Form, and Zod. There is no installed general-purpose UI component library.
- The stylesheet contains three live token namespaces: canonical `--ft-*`, compatibility `--c-*`, and legacy `--color-*`. Source references are roughly 1,797, 2,371, and 128 respectively, so aliases cannot be removed in one step.
- There are roughly 243 hard-coded Tailwind semantic color references and 367 arbitrary rounded-radius utilities in `app` and `components`.
- No protected route has a route-level `loading.tsx` or route-level error boundary. Loading and error behavior is handled by the shared layout or individual workspaces, with inconsistent fidelity.
- `components/finance/data-table.tsx` and `components/tables/primitives.tsx` overlap substantially and are sometimes used together in the same module.
- `RecordModal` is a strong portal/focus-trap foundation, but bespoke modal implementations remain in budget detail, saved views, release announcements, and some schedule/detail flows.
- `ScreenHero`, `CardView`, `AlertsCenter`, `KpiCards`, and `FirstRunOnboarding` appear to be legacy or currently unreferenced candidates. They must not be deleted until an explicit usage/build audit proves they are safe to retire.

## 4. Current UI diagnosis

### 4.1 Overall visual and UX state

FinTrack is functionally rich and more mature than its visual coherence suggests. Most core modules expose the right financial concepts, states, and controls, but the presentation varies by generation and module. The app often looks like several competent products assembled together rather than one intentional system.

The current warm neutral background and teal accent already communicate trust better than a saturated fintech palette. The problem is not the color premise. It is the number of parallel component rules layered on top of it.

### 4.2 Patterns that are good and should be preserved

1. **Existing product identity.** Keep the FinTrack brand mark, warm ivory/near-black themes, restrained teal action color, and the existing Plus Jakarta Sans/Geist/Geist Mono type family unless a separate brand decision is approved.
2. **Financial number treatment.** Keep tabular numerals, mono treatment where useful, explicit currency codes, positive/negative semantics, and the clear separation of balances, obligations, and available amounts.
3. **Operational information architecture.** Preserve the current routes, sidebar groups, dashboard tab model, module responsibilities, list/card modes, saved filters, and quick-create operations.
4. **Resilient data behavior.** Preserve stale-data error banners, retries, preload warnings, loading/empty/error/success branches, and the separation of technical credit-card accounts from portfolio net worth.
5. **Newer shared primitives.** `PageLayout`, `RegisterModule`, `ModuleHeader`, `StatGrid`, `ControlsBar`, `DataTable`, `DataToolbar`, `Button`, `AppSelect`, `RecordModal`, `ConfirmDialog`, `DetailDrawer`, and form primitives are the strongest starting points.
6. **Form accessibility.** Keep label/error relationships, `aria-describedby`, validation summaries, touch-size intent, sticky form actions, and keyboard behavior.
7. **Dashboard product model.** Keep the current overview and domain tabs, financial-health concepts, cash-flow projection, risk prioritization, category/budget/credit/savings/net-worth views, and chart data contracts.
8. **Admin catalog abstraction.** `CatalogAdminLayout`, catalog tables, identity cells, and shared manager structure are cohesive and should be visually migrated rather than rebuilt.
9. **Responsive module patterns.** The move from dense list/table layouts to cards or stacked rows at small widths is appropriate for the product.
10. **Explicit pending states.** Settings support panels that say “Próximamente” or “Pendiente” are better than active-looking controls that do nothing and establish the correct product rule.

### 4.3 Inconsistent, crowded, fragile, slow-feeling, or weak patterns

#### System fragmentation

- `--ft-*`, `--c-*`, and `--color-*` are all active. Component authors can solve the same visual problem three ways.
- Tailwind config values and CSS variables overlap but do not always match exactly, including primary hover colors.
- Dashboard, settings, detail pages, finance modules, and legacy UI each define their own surface and spacing logic.
- Button classes coexist with the shared `Button` component; table and empty-state systems are duplicated; progress bars have multiple implementations.

#### Container overload

- `PremiumCard` deliberately renders an outer bordered surface and an inner bordered surface. Many dashboard widgets then add more metric cards inside it.
- Credits, assets, recurring records, budget cards, and portfolio cards frequently use a padded outer shell plus an inner card.
- Forms group most sections in bordered rounded panels, then place preview cards or metric cards inside those panels.
- The visual result is too many boxes of similar weight. It increases scanning time and makes primary actions and financial totals less distinctive.

#### Density without clear priority

- Transactions place quick filters, free-text search, account/category/date/sort/per-page controls, saved views, reset actions, bulk actions, and the table in consecutive toolbars.
- Portfolio combines four stats, multiple presets, search, bank/currency/type/status filters, view mode, and dense record cards.
- Dashboard widgets compete through similar card weight, tiny labels, multiple accent colors, and many independent controls.
- Debtor and creditor records combine progress, three metrics, status, and four actions in a compact row/card.

#### Inconsistent hierarchy and typography

- Some modules rely on the topbar title, while others render a module `h1`; `ModuleHeader` can be full, content-only, or hidden without a consistent route rule.
- Small uppercase labels and 10–12px text appear often in high-value financial contexts.
- Radius values span tokenized and arbitrary values such as 14, 18, 20, 22, and 24px, so hierarchy is expressed through shape variation rather than meaning.
- Large values are sometimes trapped inside small cards while low-value descriptive labels receive similar weight.

#### State inconsistency

- There is no route-level loading/error strategy for protected pages.
- Layout fallback, module skeletons, generic state components, dashboard states, and bespoke `animate-pulse` blocks do not consistently match final geometry.
- Empty states exist in both finance and UI systems.
- Error banners use both semantic tokens and hard-coded colors.
- Some screens show stable stale data plus an error, which is good, but the presentation is not standardized.

#### Modal, drawer, menu, and overlay inconsistency

- `RecordModal` has solid portal, escape, and focus-trap behavior, but not every overlay uses it.
- Budget detail, saved views, release announcements, and schedule/detail flows use different widths, headers, backdrops, footer behavior, and nested-card density.
- `AppSelect` has useful keyboard handling but is positioned inside its container rather than portaled, making it vulnerable to clipping in overflow contexts.
- Topbar menus are visually and behaviorally separate from select/action menus; outside-click and escape behavior must be verified and standardized.
- The floating quick-actions menu duplicates topbar/sidebar actions and can compete with content, especially on mobile.

#### Light/dark parity risk

- Newer components use semantic tokens, but older detail components contain hard-coded `text-white`, `border-white`, and fixed red/amber/blue utilities.
- Some warning text is tuned for a dark surface and has weak light-theme contrast.
- A visual redesign cannot be considered complete until each migrated screen passes both themes rather than treating dark mode as a later skin.

#### Slow-feeling interaction

- Repeated nested surfaces, shimmer variants, many independent widgets, animated card entry/hover effects, and the floating action ping create perceived busyness.
- Generic skeletons do not always preserve the final screen geometry, causing layout shifts.
- Remote Google font `@import` calls add avoidable font-display risk; changing delivery should be evaluated as a separate foundation task, not mixed into module redesign.
- This plan does not reopen actual data-performance work, especially B3.4.

#### Product-facing implementation language

- Some recurring and alert modal copy exposes internal implementation or validation language.
- Alerts includes a manual-alert composition that appears to demonstrate future persistence rather than a completed product action.
- Copy can be corrected safely only when behavior stays identical. If an action is not persisted, it must be explicitly disabled/pending or receive owner-approved functionality in a separate feature task.

### 4.4 Current architecture by experience

| Experience | Current strengths | Main redesign need |
| --- | --- | --- |
| Shell | Responsive sidebar/drawer, active route, brand, contextual title, quick create | Reduce action duplication, align dimensions/tokens, improve menu behavior and small-screen content clearance |
| Dashboard | Strong financial concepts, tabs, charts, risk prioritization | Remove nested-card competition; create consistent chart/metric/widget grammar |
| Portfolio | Rich filters, list/card views, technical-account handling, retry states | Simplify control hierarchy and record density without touching account logic |
| Transactions | Powerful table, selection, saved views, export, resilient preload, operation selector | Progressive filter disclosure, one table system, consistent overlays; form later due to risk |
| Credits and assets | Shared registry pattern, useful stats, list/card modes, specialized forms | Standardize records and forms while preserving schedule/account behavior |
| Budgets | Correct series/period model and detailed progress | Explain the dual model visually; replace bespoke detail overlay after modal foundations |
| Receivables/payables | Good mirrored mental model and shared ledger foundation | Reduce metric/action crowding; standardize list, drawer, and forms one module at a time |
| Recurring | Clear use/edit/delete workflow | Reduce form density and remove internal-language copy |
| Alerts | Useful risk inbox with priority and module context | Strengthen risk hierarchy and resolve the manual-alert pending/real behavior distinction |
| Details | Important financial read-only context | Establish one responsive detail template and fix theme inconsistency |
| Admin | Cohesive catalog abstraction | Inherit foundations; lower priority than daily financial tasks |
| Settings | Broad coverage and thoughtful pending labels | Reconcile its parallel component system; preserve all security/persistence behavior |
| Developer/status | Correctly gated developer routes and a reusable public state screen | Migrate last; do not alter gates, redirects, or status behavior |

## 5. Target visual direction: the calm financial operating desk

The target is a premium private-finance workspace, derived from what FinTrack already is:

- **Warm, not sterile.** Retain the warm ivory light canvas and warm near-black dark canvas.
- **Precise, not decorative.** Use typography, alignment, and whitespace as the primary hierarchy. Borders and shadows support grouping but do not define every element.
- **Financially literate.** Amounts, dates, status, risk, and progress are visually consistent across modules. Positive/negative meaning is never conveyed by color alone.
- **Editorial at the page level, compact at the data level.** Page titles and summaries have breathing room; tables and operational controls remain efficient.
- **Teal is an action signal.** Reserve primary teal for selected navigation, main actions, focus, and a small number of key data highlights. Semantic status colors stay tied to meaning.
- **Depth is scarce.** Most content sits directly on the canvas or one primary surface. Raised surfaces are reserved for overlays, selected records, or high-priority summaries.
- **Motion confirms.** Use quick fade/translate/opacity transitions for state changes. Avoid decorative bounce, persistent pulse, and simultaneous widget entrance effects.
- **Charts belong to the same system.** Grid, axes, legend, tooltip, empty/loading/error, range selection, and semantic palette become shared rules.

This direction intentionally avoids gradients as a default, glassmorphism, neon accents, gratuitous illustrations, and a card for every value. It does not require a new library.

## 6. Design principles

1. **Financial clarity before decoration.** The balance, obligation, risk, or next action must be clear within one scan.
2. **One hierarchy per screen.** Each route has one title context, one primary action, one primary data region, and a controlled secondary layer.
3. **One surface is usually enough.** Use spacing, dividers, alignment, and background tone before adding nested cards.
4. **Meaning owns color.** Teal means selection/action; red danger; amber warning; green success; blue information. Neutral is the default.
5. **Numbers align.** Monetary values use tabular numerals, stable currency placement, consistent decimals, and right alignment in tabular contexts.
6. **States preserve geometry.** Skeletons mirror final layouts; errors retain retry context; empty states explain the next valid action.
7. **Power through progressive disclosure.** Keep all filters and actions, but show common controls first and advanced controls on demand.
8. **Keyboard and touch are first-class.** Visible focus, logical tab order, escape/outside-click behavior, 44px touch targets where appropriate, and usable 200% zoom are acceptance criteria.
9. **Light and dark ship together.** No migrated component is complete with one theme only.
10. **Progressive migration, stable contracts.** Presentational adapters may bridge old and new components; business props and behavior stay unchanged until every consumer is migrated.
11. **One module per PR.** Shared foundations, shell, and shared detail/table templates get their own prerequisite PRs; operational modules are never bundled together.
12. **Premium means less friction.** Fewer competing borders, labels, colors, and animations should make the existing functionality feel faster and safer.

## 7. Proposed design tokens and foundations

The values below are the proposed foundation contract. The palette starts from current FinTrack values to avoid an invented rebrand. Exact contrast must be verified before the foundation PR is accepted.

### 7.1 Token namespace strategy

- `--ft-*` becomes the only authoring namespace for new and migrated work.
- `--c-*` and `--color-*` remain compatibility aliases during migration.
- Do not bulk-replace or remove aliases in the same PR as a screen redesign.
- Tailwind semantic utilities should resolve to `--ft-*` values rather than duplicate fixed hex values.
- Remove compatibility aliases only in a later cleanup PR after `rg`, build, and visual verification prove no consumers remain.

### 7.2 Color roles

| Role | Light proposal | Dark proposal | Use |
| --- | --- | --- | --- |
| Canvas | existing `#FAFAF7` | existing `#161615` | App background |
| Surface | existing `#FFFFFF` | existing `#1E1E1C` | Primary panels and overlays |
| Surface muted | existing `#F4F3EF` | existing `#262624` | Secondary grouping, controls |
| Surface hover | existing `#ECEAE4` | existing `#2F2F2C` | Hover/selected neutral state |
| Text strong | existing `#191917` | existing `#EDEDEC` | Titles, values, primary copy |
| Text muted | existing `#6F6B63` | existing `#A1A19E` | Secondary copy |
| Text subtle | existing `#7F7A71` | existing `#8A8A86` | Metadata only; contrast must be tested |
| Border | existing `#E4E2DD` | existing 8% white | Default separation |
| Border strong | existing `#CAC7BF` | existing 14% white | Interactive/selected separation |
| Primary | existing `#0D6B5E` | existing `#2DD4A8` | Primary action, selection, focus |
| Primary hover | existing `#09584E` | existing `#5EEDCA` | Hover/active action |
| Success | semantic token | semantic token | Completed/healthy only |
| Warning | semantic token | semantic token | Attention/due soon only |
| Danger | semantic token | semantic token | Destructive/overdue/error only |
| Info | semantic token | semantic token | Neutral system information |

Rules:

- A financial gain is not automatically “success,” and an expense is not automatically “danger.” Direction and risk must remain separate concepts.
- Status badges pair color with a label and, where necessary, an icon.
- Charts use a documented series palette with contrast and non-color differentiation for essential comparisons.
- `text-white`, fixed Tailwind semantic shades, and opacity-derived text are prohibited in migrated components unless the background contract explicitly requires them.

### 7.3 Typography

Keep the current families:

- Plus Jakarta Sans: page identity and selected display moments only;
- Geist: navigation, body, controls, labels, and tables;
- Geist Mono: financial values where column stability or technical precision helps.

Proposed role scale:

| Role | Size / line-height | Weight | Notes |
| --- | --- | --- | --- |
| Page title | 28/34 desktop, 24/30 mobile | 700 | One per route context |
| Section title | 20/26 | 650–700 | Major screen regions |
| Panel title | 16/22 | 600 | Cards, drawers, modals |
| Body | 15/22 | 400 | Preserve current readable base |
| UI/control | 14/20 | 500–600 | Buttons, inputs, filters |
| Secondary | 13/18 | 400–500 | Metadata and descriptions |
| Caption | 12/16 | 500–600 | Minimum recurring label size |
| Financial hero | 32–40/1.1 | 600–700 | Only top-level totals |
| Financial standard | 14–24/1.2 | 500–650 | Tabular/mono where useful |

Avoid routine 10px labels and excessive uppercase. Use sentence case; uppercase is reserved for genuinely compact categorical metadata.

### 7.4 Spacing, radius, and layout

- Base spacing grid: 4px.
- Core steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Control radius: 8px.
- Standard surface radius: 12px.
- Major panel/drawer radius: 16px.
- Modal radius: 20px maximum.
- Pills: 999px only for badges, segmented controls, and compact filters.
- Avoid component-local 14/18/22/24px radius invention.
- Standard content width: 1,320px for operational modules; 1,440px only for dense tables/dashboard canvases.
- Standard page gutters: 16px mobile, 24px tablet, 32px desktop.
- Sidebar/topbar values must match their implementation. Resolve the current 60px token versus 56px rendered topbar mismatch in the shell PR.

### 7.5 Elevation and borders

- Canvas content: no shadow.
- Standard surface: 1px semantic border; optional 1px ambient shadow.
- Floating menu/popover: medium shadow and clear border.
- Modal/drawer: strong overlay elevation.
- Do not stack two elevated surfaces solely for decoration.
- Dividers and whitespace should replace many inner cards.

### 7.6 Motion

| Token | Proposed duration | Use |
| --- | --- | --- |
| Instant | 80–100ms | Press feedback |
| Fast | 120ms | Hover, focus, icon/color transitions |
| Base | 180ms | Menus, tabs, disclosure |
| Slow | 240–300ms | Modal/drawer entry only |

- Keep the current ease-out family.
- Limit movement to 4–8px for UI transitions.
- Remove decorative bounce and persistent ping from normal product use.
- Do not animate monetary values in a way that delays comprehension.
- Honor `prefers-reduced-motion` for every new component.

### 7.7 Interaction, density, and z-index foundations

- Define standard control heights: 36px compact, 40px standard, 44px touch/form.
- Define comfortable and compact table density through component props, not local padding overrides.
- Define one z-index scale for sticky header, dropdown, drawer, overlay, modal, toast, and tooltip.
- Portaled popovers/selects must handle viewport collision, overlay stacking, and focus return.
- Define a single focus-ring token with accessible contrast in both themes.
- Use the existing accessible base of `RecordModal` and form primitives rather than rewriting it.

### 7.8 Font delivery decision

The current CSS uses remote Google Font `@import` statements. A later foundation PR may replace them with a Next.js/self-hosted delivery mechanism for more stable rendering. This is safe only if it preserves the approved families and weights. Any font-family or brand-typography change requires owner approval.

## 8. Component system plan

### 8.1 Canonical layers

The system should have four clear layers:

1. **Tokens:** color, type, spacing, radius, elevation, motion, layout, density, and z-index.
2. **Primitives:** button, icon button, link action, badge, input, select, checkbox, segmented control, tooltip, popover, divider, skeleton, and spinner.
3. **Composites:** modal, confirm dialog, drawer, filter bar, data table, stat group, chart frame, form section, state panel, and record actions.
4. **Patterns:** authenticated shell, module page, registry/list page, detail page, create/edit flow, dashboard widget, and settings panel.

Module components should consume patterns and composites. They should not define new primitive rules.

### 8.2 Standardization order

1. Tokens, focus, typography, motion, and density.
2. `Button`, `CreateModuleButton`, icon actions, badges, and status tones.
3. Inputs, numeric inputs, search, `AppSelect`, date fields, file upload, help/error text.
4. Base surface, divider, stat, and amount components.
5. `RecordModal`, `ConfirmDialog`, `DetailDrawer`, menus, tooltips, and overlay rules.
6. Page layout, module header, tabs, stat grid, controls/filter bar, and view toggle.
7. One data table system with responsive record-list/card patterns and pagination.
8. Loading, skeleton, empty, error, offline, permission, disabled, and pending states.
9. Chart frame, header, range control, legend, axes, tooltip, and state contract.
10. Form section, optional disclosure, summary, preview, and sticky action patterns.

### 8.3 Decisions for existing primitives

| Existing area | Decision |
| --- | --- |
| `components/finance/primitives.tsx` | Use as the main module/page foundation; refine contracts without changing consumer behavior |
| `components/finance/data-table.tsx` | Use as the destination table system |
| `components/tables/primitives.tsx` | Keep as a compatibility layer; migrate consumers incrementally, then retire only after proof |
| `components/ui/Button.tsx` | Make canonical for button visuals and states |
| `.btn-primary` / `.btn-secondary` CSS | Compatibility only; no new usage |
| `ActionIconButton` | Preserve accessible labels; later replace label-derived icon inference with an explicit icon contract in a dedicated safe refactor |
| `AppSelect` | Preserve keyboard behavior; add standard sizing, portal/collision behavior, and validation integration |
| `RecordModal` | Canonical modal; add body-scroll, close-button size, responsive height, and consistent footer rules |
| `ModalOverlayPortal` and bespoke overlays | Migrate case by case after canonical modal variants cover real requirements |
| `components/forms/primitives.tsx` | Canonical form structure; reduce visual nesting, not validation behavior |
| `components/ui/states.tsx` and finance empty states | Converge on one state family with contextual variants |
| `components/ui/skeletons.tsx` | Keep shared building blocks; create geometry-specific module skeletons from them |
| `PremiumCard` | Replace with one-level widget/surface grammar; preserve widget behavior and data |
| settings primitives | Adapt to global tokens; keep settings-specific composites where the behavior is genuinely unique |
| detail primitives | Replace visual contract early with a responsive canonical detail template |
| unused legacy candidates | Mark as deprecation candidates only; do not delete without import/build verification |

### 8.4 Required component states

Every canonical interactive component must document and visually cover:

- default, hover, active, focus-visible, disabled, loading, and destructive where relevant;
- light and dark themes;
- keyboard and touch operation;
- short and long labels;
- icon-only accessible naming;
- validation error and help text for inputs;
- viewport collision and scrolling for menus/overlays;
- reduced motion.

Every data pattern must cover:

- initial loading;
- slow loading without infinite spinner;
- empty data;
- filtered empty data;
- recoverable error;
- stale data plus warning;
- populated/success;
- long names, large amounts, negative values, and multiple currencies.

## 9. Screen-by-screen redesign plan

### 9.1 Authenticated shell

Preserve routes, navigation groups, active-state logic, mobile drawer, user context, theme behavior, quick-create destinations, release gating, and status badges.

Redesign:

- establish one shell canvas rather than a panel-within-shell feeling;
- align sidebar and topbar dimensions with shared tokens;
- make route title/breadcrumb behavior consistent;
- reduce duplicate theme/profile/new actions across topbar, sidebar, and floating menu;
- improve small-laptop and mobile clearance so fixed controls never obscure content;
- standardize dropdown focus, escape, outside click, placement, and touch targets;
- add/verify skip-to-content and stable focus after drawer navigation;
- make release and product-update experiences use canonical overlay/banner patterns.

Owner decision: whether the floating quick-actions control remains, becomes mobile-only, or is removed after its actions are available elsewhere. No action may disappear without that decision.

### 9.2 Dashboard

Preserve all current metrics, calculations, API calls, tab behavior, chart data, filters, and risk logic. Do not include B3.4.

Redesign:

- replace `PremiumCard` nesting with a flat widget grammar;
- define three visual weights: overview/hero metric, standard analytical widget, compact operational list;
- create consistent widget headers, range controls, legends, tooltips, loading, empty, and error states;
- reduce simultaneous color and reserve semantic color for decision-relevant conditions;
- clarify the first scan: current position, near-term movement, risks, then analysis;
- preserve the current dashboard tabs to control density;
- ensure charts remain legible at 375px, 768px, small laptop, and wide desktop widths.

The dashboard should be redesigned after foundations and at least one operational table and registry screen. That prevents dashboard-only aesthetics from defining primitives that fail in real forms/tables.

### 9.3 Portfolio

Preserve technical-account exclusion, currencies, exchange-rate presentation, filters, search, active/inactive behavior, list/card modes, trend data, create/edit/delete actions, custom currency handling, URL create trigger, and retry behavior.

Redesign:

- create one dominant portfolio/net-worth summary and demote secondary stats;
- divide common filters from advanced filters without removing either;
- make list and card modes share the same information priority;
- simplify account cards by using dividers and aligned rows instead of nested metric cards;
- standardize bank identity, currency, balance, credit relationship, trend, and actions;
- simplify form section surfaces while retaining every field and conditional behavior.

Do not split or refactor the 1,900+ line manager as part of the visual PR. A later code-health task can do that after parity is proven.

### 9.4 Transactions list and export

Preserve selection, bulk actions, saved views, search, account/category/date/sort/per-page filters, list data, pagination, row actions, export formats, preload warnings, and query behavior.

Redesign:

- establish the canonical dense table pattern here;
- show high-frequency filters first and move advanced filters into a clear disclosure/popover;
- consolidate multiple toolbar rows while keeping all controls reachable;
- standardize transaction type/module/status badges and amount alignment;
- move saved-view and export overlays to canonical modal patterns;
- make warning/error states work in both themes;
- provide a deliberate responsive record list rather than squeezing a desktop table.

### 9.5 Transaction creation and editing

Preserve the operation selector mental model, every field, default, validation, conditional module section, nested account/category creation, calculations, and submit payload.

Redesign in separate PRs from the transaction list:

- operation selector first: clearer high-frequency operations and progressive disclosure of module-specific operations;
- form frame second: consistent title, progress/context, sections, summaries, and sticky actions;
- individual conditional sections only after frame parity is proven;
- nested creation modals adopt canonical form/overlay patterns without changing orchestration.

This is a high-risk visual area because the main form is 3,000+ lines and has many conditional branches. Screenshot and E2E coverage must include every operation type.

### 9.6 Detail pages

Apply one responsive detail pattern to transaction, credit, asset, receivable, and payable details:

- back/context navigation;
- identity/status header;
- primary financial summary;
- grouped facts using aligned definition rows;
- related schedule/ledger/history region;
- consistent edit/delete/record actions;
- mobile single-column layout and desktop optional summary rail.

Do this early because current detail primitives contain dark-specific hard-coded styles and affect multiple modules. Preserve all actions and fetching behavior.

### 9.7 Credits

Preserve card/loan distinction, schedules, technical accounts, reconciliation explanation, filters, list/card modes, linked portfolio behavior, all calculations, and forms.

Redesign:

- make credit type, institution, balance/debt, limit/principal, due date, and status scan in a stable order;
- reduce outer/inner card nesting;
- treat the technical-account explanation as an educational callout rather than another dashboard;
- standardize schedule tables and schedule modals;
- redesign credit-card and bank-loan forms in separate safe batches if required by review size.

### 9.8 Assets

Preserve asset types, valuation behavior, currencies, images/files, filters, list/card modes, actions, and forms.

Redesign:

- reuse the portfolio/credit registry grammar;
- emphasize current value, asset identity/type, change/context, and status;
- remove preview-card nesting from forms;
- standardize upload and image states through the shared file component.

### 9.9 Budgets

Preserve budget series, periods, status/progress calculations, categories, filters, actions, and every detail behavior.

Redesign:

- explain the difference between recurring budget definition and individual period through labels and hierarchy;
- standardize progress visualization and thresholds;
- replace the bespoke budget detail overlay with a supported canonical large modal/drawer variant;
- simplify metric grids and schedule/period tables;
- keep budget cards neutral until warning/over-limit meaning requires color.

Budgets should follow the basic registry patterns because its two-level model and large detail overlay make it more complex.

### 9.10 Receivables

Preserve debtor/receivable creation, issue/collect actions, progress, currencies, statuses, filters, detail drawer, and ledger behavior.

Redesign:

- create a clean counterparty row/card with total, collected, outstanding, due/risk, and next action;
- reduce the three-mini-card pattern;
- standardize the debtor detail summary plus ledger table;
- keep issue and collect visually distinct but equally understandable;
- migrate forms to the shared form grammar.

### 9.11 Payables

Apply the same visual grammar as receivables while preserving creditor/payable semantics, issue/pay actions, progress, filters, detail drawer, and ledger behavior.

Receivables and payables may share prerequisite components but must ship in separate module PRs, per repository rules.

### 9.12 Recurring transactions

Preserve template creation, edit, use, delete, filters, list/card modes, and scheduling/template behavior.

Redesign:

- emphasize next use/action, cadence/template identity, amount, and account/category context;
- reduce card nesting and form surface count;
- make “Use” the clear primary record action without hiding edit/delete;
- replace internal implementation-language copy with accurate user-facing copy that does not promise new persistence or behavior.

### 9.13 Alerts

Preserve priority, read/status state, module context, timestamps, navigation actions, filters, and current data behavior.

Redesign:

- treat Alerts as a risk inbox, with urgency and next action more important than decoration;
- standardize unread, priority, due, resolved, loading, empty, and error states;
- use one semantic rail/badge system and reduce competing color blocks;
- clarify the manual-alert control: if it is non-persistent or demonstrative, mark it disabled/pending; making it functional requires a separate owner-approved feature task.

### 9.14 Admin catalogs

Preserve admin access, tab structure, catalog CRUD, forms, confirmation, identities, and icon behavior.

Redesign after daily workflows:

- keep the shared catalog abstraction;
- adopt canonical table, toolbar, modal, form, empty/error, and status patterns;
- ensure high-density catalog editing remains efficient rather than visually expansive.

### 9.15 Settings

Preserve profile, preferences, notifications, security, accounts, export, support, theme/currency behavior, and all auth/persistence rules.

Redesign late:

- map settings-specific tokens to the global system;
- keep local navigation responsive but align it with standard tabs/navigation behavior;
- reduce panel/subsection/metric card nesting;
- standardize settings rows, toggles, inputs, badges, feedback, and destructive actions;
- keep “Próximamente/Pendiente” treatments explicit;
- handle security and export/import screens as high-risk review surfaces.

### 9.16 Module-status and developer tools

- Preserve module-status redirects, status mapping, gates, and `AppStateScreen` behavior.
- Preserve `DEVELOPER_TOOLS_ENABLED` checks and developer-only navigation behavior.
- Migrate these screens after production user flows so they inherit the final primitives.
- Do not change visibility, redirects, release controls, or developer capabilities as part of redesign.

## 10. Phase order and rationale

### Phase 0 — Visual baseline and acceptance contract

Capture representative screenshots and state fixtures before code changes. Define the route/state/viewport matrix and approve the visual direction using real FinTrack data. No product code change is required to create the baseline.

### Phase 1 — Tokens and global foundations

Canonicalize new authoring on `--ft-*`; align Tailwind with CSS variables; define typography, spacing, radius, elevation, motion, density, focus, and z-index. Keep aliases.

Why first: every later PR otherwise invents local values and reproduces the current fragmentation.

### Phase 2 — Canonical primitives and states

Standardize actions, fields, selects, overlays, state components, skeleton building blocks, module layout, filters, and table compatibility.

Why second: shell and screen redesigns need stable accessible contracts.

### Phase 3 — Authenticated shell

Redesign sidebar, topbar, mobile drawer, brand treatment, quick-create presentation, announcement modal, and update banner without changing navigation or auth behavior.

Why third: the shell frames every screenshot and exposes the new system at all viewports.

### Phase 4 — Shared detail template

Create and migrate the common detail pattern, then apply it one route family at a time if the PR would otherwise be too broad.

Why early: detail pages have the clearest light/dark inconsistency and establish reusable financial fact/schedule/action patterns.

### Phase 5 — Transactions list

Migrate the highest-frequency operational table, filters, saved views, export, states, and responsive layout.

Why first among modules: it stress-tests density, actions, selection, overlays, filters, and responsive data presentation.

### Phase 6 — Portfolio

Migrate the main account/net-worth registry and its form presentation without refactoring business logic.

Why second: portfolio is foundational to how users interpret the rest of FinTrack and stress-tests registry, filters, identity, currencies, and forms.

### Phase 7 — Dashboard

Redesign all dashboard tabs and widgets using the proven foundations. Explicitly exclude B3.4 and data/calculation changes.

Why here: the visual summary should be composed from patterns already proven in real operational screens rather than becoming a separate design system again.

### Phase 8 — Alerts

Migrate the risk inbox and resolve visual/pending-state clarity.

Why here: alerts are decision-sensitive and reuse states, filters, status, and actions without the form risk of later modules.

### Phase 9 — Registry modules, one PR each

Recommended order: Credits, Assets, Budgets, Receivables, Payables, Recurring.

Why this order: credits/assets reuse portfolio registry patterns; budgets adds a two-level model; receivables/payables add shared ledgers and multi-action records; recurring then inherits mature list/form patterns.

### Phase 10 — Transaction create/edit flows

Migrate operation selector, main form frame, conditional sections, and nested creation overlays through multiple narrow PRs if needed.

Why later: this is the most branch-heavy and regression-sensitive UI in the app.

### Phase 11 — Admin and settings

Migrate catalog administration, then settings panels and sensitive export/security surfaces.

Why later: these are lower-frequency or behavior-sensitive and should inherit a stable system.

### Phase 12 — Developer/status surfaces and legacy cleanup

Migrate internal/status screens. Only then remove proven-unused components, compatibility CSS, and table/state adapters in dedicated cleanup PRs.

## 11. Safe implementation batches and likely files

The lists below identify likely scope, not authorization to change every file. Each PR must narrow the list after an import/usage audit.

| Batch | Safe visual scope | Likely files |
| --- | --- | --- |
| 0. Baseline | Screenshot matrix and acceptance notes | Documentation/tests only; no product code required |
| 1. Tokens | Semantic token definitions, type/spacing/radius/motion/elevation/z-index, compatibility aliases | `app/globals.css`, `tailwind.config.ts`; possibly `app/layout.tsx` only for approved font delivery |
| 2A. Actions/fields | Button, icon action, create action, select/input/focus/validation presentation | `components/ui/Button.tsx`, `ActionIconButton.tsx`, `CreateModuleButton.tsx`, `AppSelect.tsx`, `NumericInput.tsx`, `CountrySelect.tsx`, `FileUpload.tsx`, `components/forms/primitives.tsx`, `app/globals.css` |
| 2B. Overlays | Canonical modal/drawer/confirm/menu/tooltip visuals and behavior-preserving adapters | `components/ui/RecordModal.tsx`, `ModalOverlayPortal.tsx`, `components/finance/primitives.tsx`, `components/ui/accessibility.tsx`, `app/globals.css` |
| 2C. States | Shared skeleton, loading, empty, error, offline, disabled/pending visual contracts | `components/ui/states.tsx`, `components/ui/skeletons.tsx`, `components/finance/primitives.tsx`, `components/finance/data-table.tsx`, `app/error.tsx`, `app/not-found.tsx` |
| 2D. Data patterns | Table, toolbar, pagination, filters, record actions, view toggle; legacy adapter retained | `components/finance/data-table.tsx`, `components/tables/primitives.tsx`, `components/ui/ViewToggle.tsx`, `components/ui/ProgressBar.tsx` |
| 3. Shell | Layout surfaces, navigation presentation, menus, mobile drawer, announcements | `app/(dashboard)/layout.tsx`, `components/layout/AppShell.tsx`, `Sidebar.tsx`, `NavItem.tsx`, `Topbar.tsx`, `QuickActionsFAB.tsx`, `Brand.tsx`, `ProductUpdatesBanner.tsx`, `ReleaseAnnouncementGate.tsx`, `LayoutIcons.tsx`, `app/globals.css` |
| 4. Detail foundation | Shared detail template and theme-safe fact/action/schedule presentation; migrate each module detail in a separate follow-up PR | Foundation: `components/detail/primitives.tsx`; per-module PRs: the applicable parts of `ModuleDetails.tsx` or `TransactionDetailClient.tsx` plus one of `app/(dashboard)/transactions/[id]/page.tsx`, `credits/[id]/page.tsx`, `assets/[id]/page.tsx`, `receivables/[id]/page.tsx`, or `payables/[id]/page.tsx` |
| 5. Transactions list | Header, toolbars, filters, rows, selection, pagination, export/saved-view overlays, responsive records | `app/(dashboard)/transactions/page.tsx`, `components/transactions/TransactionsWorkspace.tsx`, transaction table components under `components/tables`, relevant export/modal components |
| 6. Portfolio | Registry summary, filters, list/cards, state presentation, modal form layout | `app/(dashboard)/portfolio/page.tsx`, `components/management/PortfolioManager.tsx` and shared presentational dependencies only |
| 7. Dashboard | Workspace/tabs/widget grammar/chart presentation/states | `app/(dashboard)/dashboard/page.tsx`, all active files in `components/dashboard`, `app/globals.css` only if a missing shared token is approved |
| 8. Alerts | Risk list, filters, status/actions, states, modal pending clarity | `app/(dashboard)/alerts/page.tsx`, `components/alerts/AlertsWorkspace.tsx`, `AlertBadge.tsx`, `AlertCard.tsx`, `AlertFilters.tsx`, `AlertSummaryBar.tsx` |
| 9A. Credits | Registry and specialized forms/schedules | `app/(dashboard)/credits/page.tsx`, `components/credits/*`; detail route only if not completed in batch 4 |
| 9B. Assets | Registry, form, file/image states | `app/(dashboard)/assets/page.tsx`, `components/assets/*`; detail route only if not completed in batch 4 |
| 9C. Budgets | Series/period registry, progress, form, detail overlay | `app/(dashboard)/budgets/page.tsx`, `components/management/BudgetsManager.tsx`, `BudgetDetail.tsx` |
| 9D. Receivables | Counterparty registry, ledger detail, forms | `app/(dashboard)/receivables/page.tsx`, `components/receivables/*`, `components/finance/ledger-module.tsx` only through backward-compatible presentation props |
| 9E. Payables | Counterparty registry, ledger detail, forms | `app/(dashboard)/payables/page.tsx`, `components/payables/*`, `components/finance/ledger-module.tsx` only through backward-compatible presentation props |
| 9F. Recurring | Template registry, form, actions, user-facing copy | `app/(dashboard)/recurring/page.tsx`, `components/recurring/*` |
| 10A. Transaction selector | Operation-type hierarchy and responsive selector | `app/(dashboard)/transactions/new/page.tsx`, `components/transactions/OperationTypeSelector.tsx` |
| 10B+. Transaction form | Form frame, then conditional sections and nested modals in narrow PRs | `components/forms/TransactionForm/index.tsx`, `FormFields.tsx`, `TypeSelector.tsx`, `SubmitButton.tsx`, `sections/ModuleSections.tsx`, `NestedRecordCreationModals.tsx`, `TransactionEditModal.tsx` |
| 11A. Admin | Catalog layout/table/forms/modals | `app/(dashboard)/admin/page.tsx`, `components/management/AdminWorkspace.tsx`, `catalog.tsx`, `BankEntitiesManager.tsx`, `CurrenciesManager.tsx`, `CategoriesManager.tsx`, `AssetTypesManager.tsx` |
| 11B. Settings | Navigation, panels, rows, toggles, forms, feedback | `app/(dashboard)/settings/page.tsx`, `components/settings/*`, settings-related sections in `app/globals.css` |
| 12A. Status/developer | App state screen and gated internal tools, visual-only | `app/(dashboard)/module-status/[moduleKey]/page.tsx`, `components/system/AppStateScreen.tsx`, `app/(dashboard)/developer/**`, `components/developer/*`, `components/management/BankIconStudio.tsx` |
| 12B. Cleanup | Remove proven-unused components/aliases/adapters | Candidates include `ScreenHero.tsx`, `CardView.tsx`, inactive dashboard/alert components, compatibility CSS/table primitives; exact list requires proof and a dedicated PR |

## 12. Progressive implementation protocol

1. Start every phase with an import/consumer map and before screenshots.
2. Define or extend a canonical component only when at least one real FinTrack screen validates the need.
3. Preserve the old prop/API contract or add a backward-compatible adapter.
4. Migrate one screen/module without deleting the old component.
5. Exercise all state branches and compare screenshots in both themes and target viewports.
6. Run functional regression checks appropriate to the module even though the intended change is visual.
7. Merge only after Vercel Preview approval.
8. Repeat for the next module.
9. Delete compatibility code only after all consumers are migrated and a separate cleanup diff proves no behavioral change.

This avoids a big-bang rewrite and provides a simple rollback unit: the most recent module or foundation PR.

Progressive delivery does not mean incremental polishing of the old style. Once a scope enters migration, that complete scope must adopt the approved final visual language and all required states before it is considered done.

## 13. Safe changes versus owner approval

### Safe within an explicitly approved redesign PR

- tokenized color, spacing, radius, shadow, typography, and responsive layout changes;
- semantic markup, focus visibility, touch-target, and contrast improvements;
- changing nested visual surfaces into dividers/spacing while retaining the same information and actions;
- moving an existing component to the canonical presentational wrapper while retaining its props and state behavior;
- skeleton geometry, empty/error presentation, and clearer retry affordances;
- responsive reflow that preserves every field, control, and action;
- user-facing copy fixes that remove internal language without changing domain meaning or promising functionality;
- maintaining compatibility aliases/adapters during migration.

### Requires explicit owner approval

- a new UI, icon, motion, chart, or form library;
- a different font family, logo, brand mark, primary brand color, or fundamental theme direction;
- navigation groups, route names, redirects, page availability, default destination, or removing the floating action control/actions;
- removing list/card modes, filters, saved views, table columns, form fields, actions, charts, or dashboard metrics;
- changing domain terminology where meaning may change, including “portfolio/account,” credit terminology, budget series/periods, or receivable/payable semantics;
- changing form sequence, defaults, conditional visibility, validation, calculations, submit payload, or persistence;
- making the manual-alert flow persistent or changing any pending feature into a real feature;
- B3.4, data-fetching behavior, cache strategy, API contract, dashboard calculation, financial formula, or exchange-rate behavior;
- Supabase schema/RLS/migrations/data persistence;
- authentication, middleware, sessions, permissions, login, redirects, release gates, developer gates, or Vercel configuration;
- export/import behavior, security settings behavior, analytics/tracking, or destructive-action policy;
- deleting legacy files without a proven consumer audit.

## 14. Work that should wait

- B3.4 `dashboard.layout-data` and any broader performance/data-loading redesign.
- Business-logic decomposition of `PortfolioManager`, `BudgetsManager`, `DashboardHeader`, or `TransactionForm`; do this later as separate refactoring work after visual parity.
- Route-level architecture or navigation restructuring.
- A new component library. The current stack can support the proposed system.
- New charts, metrics, insights, alerts persistence, saved-view capabilities, onboarding features, or dashboard calculations.
- Removal of unused-looking components and compatibility token/table layers until migration and build evidence is complete.
- Admin/developer polish before core daily user flows.
- Security/export/import UX behavior changes.
- Motion flourish and marketing-style effects until clarity, accessibility, and state coverage are complete.

## 15. Risks and rollback plan

| Risk | Mitigation | Rollback |
| --- | --- | --- |
| Global token change causes wide visual regressions | Keep aliases, change tokens narrowly, screenshot representative routes in both themes | Revert the token PR; aliases keep old consumers intact |
| Shared component change alters many modules | Preserve props and defaults; add opt-in visual variants during migration | Disable/revert the new variant without changing consumers |
| Large stateful component receives accidental logic changes | Keep module PR visual-only; review event handlers, data hooks, payloads, and calculations as protected lines | Revert the module PR; no data migration is involved |
| Light/dark contrast breaks in legacy descendants | Test both themes and remove hard-coded color only within migrated scope | Revert screen styles or restore previous token alias |
| Table/filter simplification hides power features | Use progressive disclosure, not removal; verify every current control in an interaction checklist | Restore previous toolbar composition |
| Modal migration changes focus/scroll/submit behavior | Contract tests and keyboard QA for each modal variant | Switch that consumer back to the existing overlay wrapper |
| Responsive redesign hides actions or causes overflow | Test long values/labels at target widths and 200% zoom | Revert responsive wrapper while retaining desktop styles |
| Dashboard redesign changes perceived meaning | Freeze values, labels, ordering rationale, and chart series before styling; owner visual review | Revert dashboard-only PR; B3.4 remains untouched |
| Legacy cleanup removes a hidden consumer | Separate cleanup PR with `rg`, typecheck, build, and route smoke coverage | Revert cleanup PR independently |
| Font delivery causes layout shift | Compare metrics and screenshots; do it separately from typography redesign | Restore current imports/fallback stack |

General rollback rule: every phase and every module is a separate reversible PR. No redesign batch includes schema/data migrations, so rollback is code-only. Do not delete compatibility layers in the same PR that introduces their replacement.

## 16. Local visual QA checklist per PR

### Scope and baseline

- [ ] Confirm the diff contains only the approved redesign batch.
- [ ] Confirm no API, calculation, Supabase, auth, middleware, redirect, or Vercel files changed.
- [ ] Capture before/after screenshots using equivalent data and state.
- [ ] Confirm no current action, field, filter, view, table column, or route disappeared.

### Viewports

- [ ] 375px mobile portrait.
- [ ] 768px tablet portrait.
- [ ] 1024px small laptop/tablet landscape, especially shell and toolbar crowding.
- [ ] 1280px desktop.
- [ ] 1440px or wider for dashboard/table max-width behavior.
- [ ] Browser zoom at 200% without lost content or two-dimensional scrolling for ordinary screens.

### Themes and content stress

- [ ] Light theme.
- [ ] Dark theme.
- [ ] Long account, bank, category, counterparty, and budget names.
- [ ] Large, negative, zero, and decimal financial values.
- [ ] PEN, USD, and available custom currency presentation.
- [ ] Long translated/user-facing labels do not overlap even though repository copy remains Spanish.
- [ ] Semantic color is supported by text/icon/position rather than color alone.

### States

- [ ] Initial loading resembles final geometry.
- [ ] Slow loading remains bounded and understandable.
- [ ] Empty state explains the next valid action.
- [ ] Filtered empty state offers reset/recovery.
- [ ] Recoverable error has a visible retry.
- [ ] Stale data plus warning remains usable.
- [ ] Success/populated state.
- [ ] Disabled and permissioned actions are visually distinct and explain why when needed.
- [ ] Pending/unimplemented actions are clearly disabled or labeled pending.
- [ ] No infinite loading state.

### Interaction and accessibility

- [ ] Complete the main flow by keyboard only.
- [ ] Focus order matches visual order and focus-visible is never clipped.
- [ ] Escape closes menus/modals/drawers when appropriate and returns focus to the trigger.
- [ ] Outside click behavior is consistent and does not discard unsaved work unexpectedly.
- [ ] Modal/drawer background does not scroll; internal content and sticky actions remain reachable.
- [ ] Touch targets are at least 44px where touch use is expected.
- [ ] Icon-only controls have accessible names and tooltips where useful.
- [ ] Labels, help text, and errors are programmatically associated with inputs.
- [ ] Tabs and segmented controls expose correct selected state and keyboard behavior.
- [ ] Reduced-motion mode removes non-essential movement.
- [ ] Contrast meets WCAG AA for text, controls, focus, and status information.

### Layout and component quality

- [ ] No dropdown, tooltip, badge, amount, chart label, or action menu is clipped.
- [ ] Sticky topbar, headers, footers, and fixed controls do not obscure content.
- [ ] Tables align numbers and currencies consistently.
- [ ] Mobile record layouts preserve every essential table field/action.
- [ ] Chart axes, legend, tooltip, range controls, and empty/loading/error states are legible.
- [ ] No unnecessary card-inside-card hierarchy was added.
- [ ] Radius, spacing, typography, and status treatments use approved tokens.
- [ ] Console has no new warnings/errors during the primary flow.

### Functional regression proportional to the screen

- [ ] Every visible button/action works or is clearly disabled/pending.
- [ ] Create, edit, delete/confirm, retry, filter, reset, pagination, and view-toggle flows retain behavior.
- [ ] Forms retain validation, defaults, conditional fields, submit payload, and cancel/unsaved behavior.
- [ ] Financial values before and after the redesign are identical for the same data.
- [ ] Existing Playwright coverage for the affected flow still passes.

## 17. Vercel Preview checklist

- [ ] Preview deployment builds successfully with the existing Node/Next configuration.
- [ ] Diff and deployment contain no environment, Supabase, auth, middleware, redirect, or Vercel configuration changes.
- [ ] Test with an authenticated non-admin user using representative data.
- [ ] Test an authenticated admin where the batch affects admin-only surfaces.
- [ ] Verify protected-route redirects and session continuity are unchanged.
- [ ] Verify direct navigation and refresh on every affected route/detail route.
- [ ] Verify light/dark theme persistence and first render without a damaging theme flash.
- [ ] Verify cold and warm navigation so loading geometry and stale-data warnings are visible.
- [ ] Simulate slow network and a recoverable request failure without changing the backend.
- [ ] Recheck 375, 768, 1024, 1280, and 1440+ widths in the deployed environment.
- [ ] Verify keyboard, focus return, modal scroll lock, and touch interaction on at least one real mobile device or device browser.
- [ ] Check current Chrome, Safari/WebKit, and Firefox for the affected high-value flow.
- [ ] Confirm remote fonts/assets/icons load without visible layout breakage.
- [ ] Confirm charts render after client hydration and do not overflow.
- [ ] Confirm no new console errors, hydration warnings, failed asset requests, or unexpected network calls.
- [ ] Compare approved before/after screenshots and document intentional differences.
- [ ] Product owner approves the Preview before merging each module PR.
- [ ] Production verification plan and the exact PR revert path are written before merge.

## 18. Completion criteria for the redesign program

The premium redesign is complete only when:

- every protected production route uses the canonical foundations;
- all visible actions work or are explicitly disabled, permissioned, or pending;
- every module has consistent loading, slow, empty, filtered-empty, error, stale, and success behavior where applicable;
- light and dark modes pass the visual QA matrix;
- core flows remain functionally identical and financial results are unchanged;
- no module depends on a private visual subsystem without a documented reason;
- compatibility tokens/components are either still intentionally bridged or removed in proven-safe cleanup PRs;
- local and Vercel Preview checklists are complete for every module;
- the owner approves the new visual language using the real app, not isolated mockups.

## 19. Resumen simple en español

FinTrack ya tiene una buena base: colores cálidos, verde teal, información financiera útil y muchas funciones completas. El problema principal no es que falte diseño, sino que hoy existen varios estilos y componentes diferentes dentro de la misma aplicación. Por eso algunas pantallas se sienten llenas, con demasiadas tarjetas, filtros, bordes y estilos que no siempre coinciden.

La propuesta es convertir FinTrack en una experiencia financiera premium, tranquila y precisa. Se mantendrán las funciones, rutas, cálculos, datos, seguridad y lógica actuales. Primero se definirá un solo sistema visual; después se mejorarán los componentes comunes y la navegación; finalmente se rediseñará un módulo por cada PR para reducir riesgos.

El orden recomendado es: fundamentos visuales, componentes comunes, navegación, detalles, transacciones, portafolio, dashboard, alertas y luego los demás módulos. Los formularios más complejos se dejarán para una etapa posterior porque tienen más riesgo. No se propone instalar una nueva librería ni cambiar Supabase, autenticación, fórmulas financieras o configuración de Vercel sin aprobación explícita.

Cada avance deberá revisarse en modo claro y oscuro, celular, tablet y escritorio, incluyendo carga, errores, estados vacíos y todos los botones. Si un cambio visual causa un problema, se podrá revertir solamente ese PR sin tocar datos ni cálculos.
