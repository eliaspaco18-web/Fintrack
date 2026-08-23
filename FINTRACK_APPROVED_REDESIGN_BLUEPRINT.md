# FinTrack Approved Redesign Blueprint

**Status:** Approved visual direction; implementation not started

**Approved on:** 2026-08-22

**Prepared for:** FinTrack product, design, and engineering

**Current branch at preparation:** `codex/premium-product-redesign`

**Language of this technical document:** English, as required by `AGENTS.md`

## 1. Executive decision

FinTrack will adopt one coherent product language across the full application, based on two owner-approved sources:

1. The Portfolio reference interface in `fintrack-portfolio-reference-design.html`.
2. Logo proposal 12, **FT Ligature**, in `fintrack-logo-redesign-proposals-v2.html`.

The Portfolio reference is the visual and interaction pilot, not a page to copy mechanically. Its essential qualities are now the approved system:

- restrained teal-led financial identity;
- light, spacious, data-dense surfaces;
- compact but readable hierarchy;
- a persistent left module sidebar;
- a route-aware topbar;
- analytical panels with clear titles and actions;
- tabular financial numerals;
- direct transition from overview to analysis to action;
- soft, meaningful motion;
- desktop, tablet, mobile, light, and dark parity.

The transformation is not a recoloring exercise. It includes:

- brand identity and asset migration;
- design tokens and typography;
- application shell and navigation;
- information architecture;
- financial data visualization grammar;
- module content hierarchy;
- tables, filters, forms, details, modals, drawers, and states;
- responsive behavior;
- accessibility and motion;
- content-integrity corrections where current UI representations are misleading;
- phased implementation with financial parity and rollback gates.

This blueprint supersedes the visual direction in `REDESIGN_MASTER_PLAN.md` and `REDESIGN_VISUAL_BASELINE.md`. Their stability, QA, security, and financial-integrity requirements remain in force.

## 2. Authority and source hierarchy

When sources disagree, implementation must follow this order:

1. Production financial rules, authenticated user data, API contracts, permissions, and calculations.
2. `AGENTS.md`, `CODEX_RULES.md`, and `QA_CHECKLIST.md`.
3. This approved blueprint.
4. The approved Portfolio HTML and FT Ligature visual source.
5. Existing shared components and legacy visual documentation.

The attached HTML files are visual references, not executable product specifications. Their mock amounts, labels, and decorative behavior must never become production logic.

## 3. Scope, constraints, and protected invariants

### 3.1 In scope

- Dashboard
- Portfolio
- Transactions
- Credits
- Budgets
- Assets
- Receivables
- Payables
- Recurring templates
- Alerts
- Settings
- Admin and developer surfaces
- Authentication, public, maintenance, error, and status surfaces
- Sidebar, topbar, page shell, responsive navigation
- Shared controls, tables, cards/panels, forms, modals, drawers, detail pages, charts, and application states
- Logo, favicon, app icons, wordmark, and product identity surfaces

### 3.2 Explicitly out of scope without a separately approved change

- Supabase schema or migration changes
- RLS policies
- authentication or middleware behavior
- API contract changes
- persistence behavior
- environment files
- routes, route semantics, permissions, or navigation behavior
- balance, exchange-rate, portfolio, credit, asset, receivable, payable, budget, projection, score, or report calculations
- artificial intelligence advice or untraceable financial recommendations
- fabricated historical data, probabilistic ranges, goals, schedules, or connected-bank state

### 3.3 Functional invariants

Every existing supported action must remain functional or be visibly disabled with a reason:

- create;
- edit;
- delete;
- import;
- export;
- filtering;
- sorting;
- pagination;
- saved views;
- activation/deactivation;
- bulk actions;
- authentication;
- navigation;
- attachments where a real endpoint exists;
- record relationships and drill-downs.

No visual PR may silently change money, dates, status meanings, currency conversions, inclusion in net worth, or report participation.

## 4. Product model for the redesigned app

### 4.1 The four levels of financial understanding

Every module should organize content in the same progression:

1. **Position** — What is true now?
2. **Movement** — What changed and why?
3. **Commitment** — What is due, expected, or constrained?
4. **Action** — What can the user safely do next?

This progression replaces disconnected card collections. A page may not need every level, but it must never reverse the hierarchy by placing secondary controls above the financial answer.

### 4.2 The four information layers

Each screen uses a consistent layer model:

- **Overview:** three to five high-confidence facts.
- **Analysis:** charts or comparisons that explain those facts.
- **Register:** searchable, sortable records and their status.
- **Detail/action:** inspect, create, edit, export, or resolve.

### 4.3 Financial state taxonomy

FinTrack must visibly distinguish data certainty. Color alone is insufficient.

| State | Meaning | Visual treatment | Permitted examples |
|---|---|---|---|
| Recorded | Persisted event or current calculated value | solid line/fill, filled circle, deep teal/ink | transactions, current balances, paid/collected amounts |
| Scheduled | Persisted obligation with a real stored date | amber, outlined diamond, explicit date label | payable due date, installment, billing cycle, receivable due date |
| Modeled | Derived future scenario based on stated assumptions | blue-gray dotted line, open circle, `Projection` label | 30/60/90-day projection |
| Unknown | Required source is absent or failed | neutral hatch/dash, explicit unavailable message | missing historical series, failed secondary endpoint |

Rules:

- Never label a modeled recurring contribution as scheduled.
- Never use `is_read` as a synonym for resolved.
- Never display a generated interpolation as observed history.
- Never combine currencies into one total unless an existing, verified exchange-rate contract performs the conversion.
- Every projection must disclose its horizon, input families, and that it is modeled.
- Every complex chart requires a text/list alternative and an exact-value tooltip.

## 5. Current-product audit summary

### 5.1 Technical foundation

The current application uses:

- Next.js 14.2;
- React 18.3;
- Tailwind CSS 3.4;
- Recharts 3.8;
- SWR;
- React Hook Form and Zod;
- Supabase;
- custom SVG and existing UI primitives.

No new UI, icon, chart, or motion library is required for Phase 1. Adding one requires a separate dependency and bundle review.

### 5.2 Existing reusable foundations

The redesign should evolve, not bypass, these shared layers:

- `components/finance/primitives.tsx`
- `components/finance/data-table.tsx`
- `components/finance/ledger-module.tsx`
- `components/forms/primitives.tsx`
- `components/detail/primitives.tsx`
- `components/settings/primitives.tsx`
- `components/ui/Button.tsx`
- `components/ui/ActionIconButton.tsx`
- `components/ui/AppSelect.tsx`
- `components/ui/NumericInput.tsx`
- `components/ui/CurrencyDisplay.tsx`
- `components/ui/RecordModal.tsx`
- `components/ui/ViewToggle.tsx`
- `components/ui/CreateModuleButton.tsx`
- `components/ui/ProgressBar.tsx`
- `components/ui/states.tsx`
- `components/ui/skeletons.tsx`

### 5.3 Current fragmentation

The current CSS and component layer has accumulated multiple token families and local styling decisions:

- `app/globals.css` is more than 3,600 lines;
- `--ft-*`, `--c-*`, and `--color-*` variables coexist;
- hundreds of arbitrary radii and direct semantic colors are present;
- several major components are too large for safe visual iteration;
- dashboard information is spread across six tabs with repeated summaries;
- module-specific forms and panels do not yet share one visual contract.

The redesign must first establish semantic tokens and component contracts, then migrate one module per pull request. A global CSS rewrite before compatibility aliases exist is prohibited.

### 5.4 Stability gate before visual rollout

Per the repository priority, redesign work begins only after critical loading, Portfolio loading, visible action, infinite-loading, and Supabase error-handling checks in `QA_CHECKLIST.md` pass. A visual change must not hide an unresolved product defect.

## 6. Approved brand identity: FT Ligature

### 6.1 Brand concept

FT Ligature joins the `F` and `T` into one proprietary mark. The crossing green stroke represents connected financial movement; the gold node represents the point where information becomes a decision. It is typographic rather than dependent on a generic chart, wallet, bank, or coin metaphor.

### 6.2 Canonical construction

The following geometry is the approved master mark and must be recreated as repository-owned SVG assets before implementation:

```svg
<svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
  <path d="M15 66V25c0-7 5-12 12-12h38"
        stroke="#086D6D" stroke-width="11" stroke-linecap="round" />
  <path d="M16 42h32"
        stroke="#2BA77D" stroke-width="11" stroke-linecap="round" />
  <path d="M50 28v38"
        stroke="#086D6D" stroke-width="11" stroke-linecap="round" />
  <path d="M37 28h28"
        stroke="#086D6D" stroke-width="11" stroke-linecap="round" />
  <circle cx="50" cy="42" r="6" fill="#D7B66F" />
</svg>
```

### 6.3 Required lockups

| Asset | Use | Requirement |
|---|---|---|
| Primary horizontal | sidebar expanded, auth, public pages, email | mark + `FinTrack` in Manrope 800 |
| Compact mark | collapsed sidebar, mobile header, favicon | FT ligature only |
| App icon | PWA/home screen | mark centered on deep-teal rounded square |
| Monochrome light | dark surfaces, one-color print | warm white or single ink |
| Monochrome dark | light one-color contexts | deep teal or ink |
| Fallback monogram | very small or constrained output | `FT` in Manrope 800 inside a circle or square |

### 6.4 Brand color roles

- Deep teal `#086D6D`: structural FT strokes and primary product identity.
- Flow green `#2BA77D`: crossing connection stroke.
- Decision gold `#D7B66F`: the single node only.
- Ink `#0D2224`: wordmark.
- Warm white `#F1F6F5`: dark-surface logo stroke.
- Dark icon surface `#07585B` or approved dark surface token.

Gold is a brand accent, current-point marker, or restrained warning-adjacent accent. It is not the primary button color and must not be applied to every chart.

### 6.5 Geometry, clear space, and minimum size

- Master view box: `80 × 80`.
- Clear space: at least `12` view-box units around the mark; for the horizontal lockup, use the node diameter as the minimum external clear space.
- Minimum digital compact mark: `20px`; below `24px`, use a simplified optical version with the node no smaller than `3px` rendered.
- Minimum horizontal lockup height: `28px`.
- Sidebar expanded target: mark `30px`, wordmark approximately `19–20px`.
- App icon safe zone: the mark must occupy no more than 68% of the icon canvas.

### 6.6 Prohibited brand usage

- no rotation, skew, 3D treatment, bevel, glow, or drop-shadow on the mark;
- no independent movement of the gold node in product UI;
- no recoloring the three structural roles with category colors;
- no placing the full wordmark inside small controls;
- no stretching the view box;
- no use of the previous chart-mark PNG once migration is complete.

### 6.7 Brand migration surfaces

- `components/layout/Brand.tsx`
- `components/layout/Sidebar.tsx`
- root metadata and icons in `app/layout.tsx`
- `public/brand/*.svg`, favicons, manifest/PWA icons where present
- login and registration
- landing and maintenance pages
- email templates
- transaction/export PDF headers
- admin and developer environments
- empty-state brand moments only where meaningful

## 7. Design tokens

### 7.1 Token architecture

`--ft-*` becomes the canonical semantic namespace. Existing `--c-*` and `--color-*` tokens remain compatibility aliases until every consumer is migrated. Aliases are removed only after repository-wide visual regression and route QA.

Token layers:

1. primitive palette;
2. semantic surface/text/border/action/status tokens;
3. component tokens;
4. chart tokens;
5. motion and layout tokens.

Components must consume semantic tokens, never primitive color names such as `teal-600` or direct hex values.

### 7.2 Approved light primitives

| Token | Hex fallback | OKLCH target | Role |
|---|---:|---:|---|
| `--ft-ink-900` | `#0D2224` | `oklch(0.2356 0.0272 203.60)` | primary text |
| `--ft-ink-600` | `#667679` | `oklch(0.5537 0.0196 210.21)` | secondary text |
| `--ft-ink-400` | `#91A09F` | `oklch(0.6936 0.0171 191.91)` | metadata/disabled text |
| `--ft-canvas` | `#F7F9F8` | `oklch(0.9803 0.0025 165.08)` | application background |
| `--ft-surface` | `#FEFFFF` | near-white, green-tinted | primary surfaces |
| `--ft-surface-subtle` | `#FBFCFC` | `oklch(0.9903 0.0011 197.14)` | table heads/quiet groups |
| `--ft-border` | `#E3E9E7` | `oklch(0.9289 0.0069 174.37)` | default divider |
| `--ft-border-strong` | `#D6E0DD` | `oklch(0.8982 0.0115 176.28)` | controls/selected edges |
| `--ft-primary` | `#086D6D` | `oklch(0.4851 0.0809 194.82)` | primary action |
| `--ft-primary-hover` | `#07585B` | `oklch(0.4191 0.0691 198.99)` | primary hover/press |
| `--ft-primary-bright` | `#0B8581` | `oklch(0.5578 0.0941 191.03)` | active navigation accent |
| `--ft-primary-soft` | `#E4F5EF` | `oklch(0.9559 0.0196 172.79)` | selected/quiet state |
| `--ft-flow` | `#2BA77D` | approximately `oklch(0.65 0.13 165)` | income/positive flow when semantically valid |
| `--ft-gold` | `#D7B66F` | `oklch(0.7898 0.0976 85.31)` | brand node/current marker |
| `--ft-success` | `#149567` | `oklch(0.5941 0.1256 162.04)` | successful state |
| `--ft-danger` | `#E45D52` | `oklch(0.6492 0.1704 27.44)` | destructive/overdue |
| `--ft-warning` | `#E28732` | `oklch(0.7066 0.1463 59.11)` | approaching limit/due |
| `--ft-info` | `#2E79C8` | `oklch(0.5697 0.1423 252.70)` | modeled/informational |

The approved HTML uses pure white surfaces. Production should use a barely tinted near-white (`#FEFFFF` or contrast-tested equivalent) to reduce glare while preserving the approved appearance.

#### Light semantic mapping

| Semantic token | Light value | Intended consumers |
|---|---:|---|
| `--ft-text-strong` | `var(--ft-ink-900)` | headings, values, high-emphasis labels |
| `--ft-text-muted` | `var(--ft-ink-600)` | descriptions, secondary metadata |
| `--ft-text-subtle` | `var(--ft-ink-400)` | captions, disabled metadata after contrast test |
| `--ft-surface` | `#FEFFFF` | panels, menus, drawers, modals |
| `--ft-surface-muted` | `#FBFCFC` | table headers, grouped form zones |
| `--ft-surface-hover` | `#F1F6F4` | row/panel hover |
| `--ft-surface-selected` | `var(--ft-primary-soft)` | selected tabs/rows/filters |
| `--ft-control-bg` | `#FEFFFF` | inputs, selects, secondary buttons |
| `--ft-control-disabled` | `#F0F3F2` | disabled control surface |
| `--ft-border` | `#E3E9E7` | ordinary boundary |
| `--ft-border-strong` | `#D6E0DD` | controls and selected boundary |
| `--ft-focus-ring-color` | `#0B8581` | keyboard focus |
| `--ft-overlay` | `rgba(7, 31, 32, .34)` | modal/drawer backdrop |
| `--ft-positive` | `#149567` | factual positive outcome |
| `--ft-negative` | `#E45D52` | factual negative/destructive outcome |
| `--ft-due` | `#E28732` | due/approaching threshold |
| `--ft-modeled` | `#2E79C8` | projection and modeled series |

#### Financial chart palette

The chart palette is semantic first and categorical second.

| Role | Color | Line/marker treatment |
|---|---:|---|
| Recorded primary | `#086D6D` | solid, filled circle |
| Recorded positive/inflow | `#149567` | solid, upward/plus label |
| Recorded expense/outflow | `#E45D52` | solid, downward/minus label |
| Scheduled/due | `#D3A55F` | solid or short dash, outlined diamond |
| Modeled/projection | `#2E79C8` | dotted, open circle |
| Comparison prior period | `#91A09F` | thin neutral line/bar |
| Neutral remainder | `#D6E0DD` | low-emphasis track |

Categorical sequence, used only when categories—not status—are encoded:

1. `#086D6D`
2. `#28A37B`
3. `#70B9AA`
4. `#D3A55F`
5. `#2E79C8`
6. `#8A7DB5`

If a user-configured category color fails contrast, preserve it as a small identity swatch and use a contrast-safe label/outline. Do not replace status colors with the categorical sequence.

### 7.3 Derived dark theme

Dark mode is a tonal translation, not color inversion.

| Semantic token | Dark target |
|---|---:|
| `--ft-canvas` | `#081C1E` / `oklch(0.2109 0.0261 204.06)` |
| `--ft-surface` | `#0D2628` / `oklch(0.2499 0.0310 202.38)` |
| `--ft-surface-raised` | `#123033` / `oklch(0.2878 0.0359 204.13)` |
| `--ft-surface-hover` | `#17383A` / `oklch(0.3170 0.0386 200.68)` |
| `--ft-text-primary` | `#F1F6F5` / `oklch(0.9691 0.0055 183.03)` |
| `--ft-text-secondary` | `#A5B7B4` / `oklch(0.7647 0.0203 184.74)` |
| `--ft-text-faint` | `#7E9592` / `oklch(0.6510 0.0265 186.93)` |
| `--ft-border` | `#24413F` |
| `--ft-border-strong` | `#345350` |
| `--ft-primary` | `#43C6B0` / `oklch(0.7499 0.1174 179.52)` |
| `--ft-primary-hover` | `#65D0AE` / `oklch(0.7846 0.1117 170.09)` |
| `--ft-gold` | `#D9B46A` |
| `--ft-danger` | `#F07A6E` |
| `--ft-info` | `#70A9E8` |

All dark values are implementation candidates and must pass WCAG contrast testing in their actual component context before being locked.

### 7.4 Typography

#### Font families

- Product/UI: **Manrope**, weights 400, 500, 600, 700, 800.
- Financial numerals/code-like identifiers: **DM Mono**, weights 400 and 500.
- System fallback: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Mono fallback: `ui-monospace, "SFMono-Regular", Consolas, monospace`.

Fonts must be delivered with `next/font/google` or approved self-hosted files. Do not use client-side `@import`.

#### Production type scale

| Role | Size / line height | Weight | Family |
|---|---|---:|---|
| Display financial | `30/36px` desktop, `26/32px` mobile | 500 | DM Mono |
| Page title | `28/34px` desktop, `24/30px` mobile | 700 | Manrope |
| Topbar route title | `22/28px` | 700 | Manrope |
| Section title | `18/24px` | 700 | Manrope |
| Panel title | `15/20px` | 700 | Manrope |
| KPI value | `20–24/28px` | 500 | DM Mono |
| Body | `14/21px` | 400–500 | Manrope |
| Table body | `13/20px` | 500 | Manrope; amounts DM Mono |
| Control label | `13/18px` | 600 | Manrope |
| Data label | `12/16px` | 600 | Manrope |
| Caption/meta | `11/16px` | 500–600 | Manrope |

Rules:

- Use `font-variant-numeric: tabular-nums` for money, percentages, dates, and chart axes.
- DM Mono is for values, not entire paragraphs or navigation.
- Do not reproduce the mockup's smallest text literally; production body text must remain readable.
- Full monetary values use the existing formatter. Abbreviations are allowed on axes only; tooltips and tables show exact values.
- Negative signs, currency symbol, thousands separators, and decimal policy must remain consistent with existing contracts.

### 7.5 Spacing, geometry, depth, and layering

#### Spacing scale

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64px`

#### Radius scale

- controls: `8px`;
- KPI/stat surfaces: `12px`;
- analytical panels: `14px`;
- dialogs/drawers: `16px`;
- large branded surfaces: `18px`;
- pills only for statuses, segmented controls, and compact tags.

#### Shadows

- default panel: `0 1px 2px rgba(13,42,41,.035), 0 8px 22px rgba(13,42,41,.05)`;
- raised/overlay: slightly stronger but diffuse, never black or theatrical;
- hover must rely primarily on border/surface/translation, not a dramatic shadow jump.

#### Z-index contract

| Layer | Value |
|---|---:|
| base content | 0 |
| sticky table/header | 10 |
| topbar/sidebar | 30 |
| dropdown/popover | 50 |
| drawer backdrop | 70 |
| drawer | 80 |
| modal backdrop | 90 |
| modal | 100 |
| toast | 120 |
| emergency/system banner | 140 |

## 8. Application shell and responsive grid

### 8.1 Desktop shell

- Expanded sidebar: `218px`.
- Collapsed sidebar: `68–72px`.
- Topbar: `74px`.
- Content maximum width: `1540px`.
- Main content padding: `21px 26px 38px`.
- Analytical grid: `12` columns with `12px` gutters.
- Page header aligns to the first analytical column, never to an arbitrary inner card.
- Sidebar and topbar are stable; the main document owns vertical scrolling.

### 8.2 Compact desktop and tablet

- At approximately `1180px`, expanded sidebar contracts to `190px` if labels remain legible.
- Between `1024px` and `1180px`, use 8-column content where it improves panel width.
- Between `820px` and `1023px`, default to collapsed sidebar or a narrow rail according to current layout state; content uses 8 columns.
- Do not scale the entire interface. Reflow panels and preserve readable type.

### 8.3 Mobile

- Below `820px`, sidebar becomes an off-canvas drawer with width `min(268px, 86vw)`.
- Mobile topbar: `66px`.
- Page padding: `16px`, reducing to `12px` only below `360px`.
- Content uses one column; paired compact metrics may use two columns at `≥390px`.
- Primary create action remains reachable in the header or a labeled bottom/FAB action, never duplicated three times.
- Tables become purpose-designed financial record cards or a horizontal table only when comparison is the primary task.
- Drawers become full-screen sheets/pages when width is insufficient.

### 8.4 Sidebar information architecture

Routes and permissions remain unchanged. Visual grouping may clarify the model:

- **Overview:** Dashboard
- **Operation:** Portfolio, Movimientos, Recurrentes
- **Planning:** Presupuestos, Créditos
- **Position:** Activos, Por cobrar, Por pagar
- **Control:** Alertas
- **System:** Configuración; gated Admin and Developer links

Sidebar rules:

- active row uses deep-to-bright teal surface with a restrained transition;
- desktop navigation row target height: `42px`; touch target: at least `44px`;
- icons use one coherent 18–20px stroke system;
- badges show actionable count only, not decorative activity;
- collapsed state exposes accessible tooltips and keeps badges legible;
- optional financial summary at the bottom may show consolidated balance and a small real sparkline only when the data is already loaded;
- the summary never blocks shell rendering and is hidden in collapsed/mobile states;
- no unused shortcuts, promotional modules, or decorative controls.

### 8.5 Topbar

The topbar is route-aware:

- left: mobile navigation trigger when needed, route title, optional short description on wide desktop;
- right: only controls that affect the current route, primary route action, notification access, theme/profile menu;
- a date selector appears only where the content contract truly accepts that period;
- a global-looking filter must not control only some panels;
- do not duplicate the same create action in topbar, page header, and floating control;
- profile and notification controls remain keyboard accessible and visibly focused.

## 9. Shared component contracts

### 9.1 Page anatomy

Every module follows this vertical order:

1. route-aware topbar;
2. page header with title, one-line purpose, and primary action;
3. optional contextual status/risk strip;
4. three to five overview facts;
5. one or two explanatory analytical panels;
6. register toolbar and records;
7. detail drawer/page or modal when invoked.

The order may adapt to a module's job, but analytics must not displace the register in transaction-heavy modules.

### 9.2 Panels, not card collections

- A panel exists only when it groups one coherent question.
- Avoid cards inside cards.
- Use dividers, quiet surface zones, and grid alignment before adding another container.
- Standard panel padding: `18–20px` desktop and `16px` mobile.
- Standard panel header: title left; period, legend, or one secondary action right.
- Panel actions must be text links for navigation and icon buttons only for universally understood operations.

### 9.3 KPI/stat strip

- Three to five values maximum above the fold.
- Each stat contains label, exact value, one contextual comparison/status, and optional single-purpose icon.
- Do not use a hero metric that consumes most of the screen.
- Trends require a valid comparison period and must name it.
- Credit availability must never be presented as cash or net worth.

### 9.4 Buttons and action priority

- Primary: filled teal; one per context.
- Secondary: white/tinted surface with strong border.
- Tertiary: text or quiet icon action.
- Destructive: danger treatment only after intent is clear.
- Desktop control height: `40px`; touch height: at least `44px`.
- Icon-only controls require tooltip and accessible name.
- Loading preserves width and communicates progress; disabled explains why when non-obvious.

### 9.5 Fields and forms

- Labels remain outside fields; placeholders are examples, not labels.
- Numeric fields use existing parsing, precision, and validation utilities.
- Money fields show currency explicitly and preserve native amount plus exchange-rate semantics.
- Group fields into `Identity`, `Financial terms`, `Dates`, `Relationships`, and `Notes/attachments` only where applicable.
- Optional sections use progressive disclosure.
- Inline validation appears adjacent to the field; form-level API errors appear at top and receive focus.
- Dirty-state close confirmation is required for long forms.
- Save success closes or updates predictably; no silent success.

### 9.6 Tables and registers

- Header height approximately `36px`; body row `64–76px` depending on secondary metadata.
- Names and statuses left; dates consistently aligned; numerical values right.
- Amount columns use DM Mono and tabular numerals.
- Search and high-frequency filters remain visible; advanced filters live in a disclosure/popover.
- Sort state is visible and announced.
- Pagination and page size preserve existing behavior.
- Saved views remain available in Transactions.
- Row actions are always reachable; destructive actions require confirmation.
- Mobile record cards retain the same actions and financial meaning as desktop rows.

### 9.7 Modals, drawers, and details

- Modal: finite create/edit task; width based on form complexity.
- Drawer: inspect or edit without losing list context; target desktop width `380–440px`.
- Detail page: complex entity history, schedules, ledgers, or deep relationships.
- Desktop drawer becomes overlay sheet/full page on tablet/mobile.
- Focus trap, Escape behavior, return focus, scroll lock, and accessible title are mandatory.
- Financial context remains visible in a sticky summary only when it helps prevent editing the wrong record.

### 9.8 Status components

- Status badges use text + icon/dot + color.
- Do not use green for neutral `active` if it competes with income semantics; a teal neutral-active treatment is preferred.
- Overdue and destructive are danger; approaching due/limit is warning; completed is success; modeled is info.
- `Read` and `resolved` are distinct concepts.

### 9.9 Empty, loading, error, and stale states

Every data surface has:

- first-run empty state with one clear create/import action;
- filtered empty state with `Clear filters`;
- loading skeleton matching final geometry;
- recoverable error with retry;
- partial error that preserves healthy panels;
- stale/refresh state when applicable;
- permission/disabled explanation when action is unavailable.

Loading must not show zero as if it were real data. A secondary endpoint failure must not blank the whole page.

### 9.10 Chart grammar

Every chart includes:

- a question-led title;
- period and unit;
- compact legend;
- exact tooltip;
- visible axes or an explicitly labeled scale where meaningful;
- semantic series styles from the financial state taxonomy;
- loading, empty, error, and low-data behavior;
- text/table alternative;
- source or calculation disclosure when modeled.

Constraints:

- maximum four simultaneous series in ordinary charts;
- aggregate truthful minor categories into `Other` only when exact drill-down remains available;
- no 3D, perspective, glowing, animated particles, or decorative gauges;
- no Sankey until the data can trace actual source-to-destination flow without inference;
- no probabilistic band unless the API returns a valid range;
- category colors may identify categories, but status colors retain semantic priority;
- crosshair, hover emphasis, and linked selection may coordinate panels without changing data.

## 10. Dashboard: approved product direction

### 10.1 Primary job

The Dashboard must answer, in this order:

1. What is my current financial position?
2. How did this period perform?
3. Where did money enter and leave?
4. What obligations or collections need attention next?
5. What does the existing model indicate for the next 30, 60, or 90 days?

The first three seconds should reveal four things without reading a paragraph: consolidated position, monthly result, direction of cash flow, and the nearest documented exception.

### 10.2 Existing trustworthy data that may be reused

Current dashboard contracts already expose:

- consolidated balance in PEN and USD;
- monthly balance variation and comparison;
- monthly income, expense, and result;
- pending alert count;
- net worth in PEN and USD;
- account count and own liquidity;
- credit limit, used, available, and utilization summaries;
- asset count/value;
- receivable/payable counts and pending values;
- monthly money flow for 1–24 months;
- daily accumulated income/expense and net flow for `5D`, `1M`, `3M`, `6M`, and `1A`;
- account balances;
- income/expense category breakdown;
- top debtors/creditors;
- documented upcoming installments, card cycles, and payables;
- 30/60/90-day projection events from recurring templates, receivables, payables, installments, and billing cycles;
- current calculated financial-health dimensions.

All existing calculations are protected. The redesign only changes hierarchy and presentation.

### 10.3 Critical semantic restrictions

- The projection endpoint models active recurring templates as monthly using `created_at` day because frequency, next run, start date, and end date do not exist. These entries must be labeled **modeled**, never scheduled.
- `saldos-dia` represents accumulated transaction flow from zero with transfers excluded. It is not an account-balance history and must not be labeled as one.
- Receivable/payable module totals are currently unsafe across currencies. Dashboard use must follow the existing verified PEN-equivalent contracts only after their semantics pass the stabilization gate.
- The existing health score may be shown as a calculated indicator with its dimensions, not as official advice, a credit score, or a guarantee.
- No AI insight copy should appear unless every statement is traceable to visible values and a deterministic rule.

### 10.4 Desktop composition

The approved dashboard uses a `12`-column grid and remains content-rich without repeating a generic card matrix.

#### Header

- Title: `Dashboard` or a brief greeting plus `Financial overview`.
- Context: `Current month`, last successful refresh, and preferred currency where applicable.
- Primary action: `New transaction`.
- Secondary route action: filter/period only when it applies to the visible panels.
- Compact critical strip below the header: overdue count, over-budget count, or data-source warning. Healthy state is quiet and does not consume a large panel.

#### Row 1: executive position

Four compact stats:

1. Current own liquidity/consolidated balance, preserving currency separation.
2. Monthly income.
3. Monthly expense.
4. Monthly result.

Net worth receives an explanatory visual rather than being treated as a fifth interchangeable stat. Credit available is never added to liquidity or net worth.

#### Row 2: dominant cash-flow reading

- **7 columns — Income, expense, and monthly result:** grouped or mirrored bars for income/expense plus one result line. This uses the existing money-flow series and explains performance over time.
- **5 columns — Next financial events:** a chronological agenda of documented installments, card cycles, payables, and receivables. Each row contains date, type, native amount/currency, status, and destination route. Modeled recurring events are placed in a separately labeled projection subsection, not mixed with scheduled obligations.

#### Row 3: composition and pressure

- **4 columns — Expense composition:** treemap when categories have enough spread; otherwise ranked horizontal bars. It answers where money went.
- **4 columns — Net-worth composition:** current assets, own liquidity, and verified liabilities/obligations using the existing report semantics. A segmented bar or compact bridge is preferred over a decorative donut when comparison matters.
- **4 columns — Budget and credit pressure:** two factual bullet-chart groups: budget utilization and card utilization. Labels use `used`, `remaining`, `over limit`, or `due`; never an invented risk score.

#### Row 4: outlook and account position

- **7 columns — 30/60/90-day modeled outlook:** current point, documented dated events, and modeled contributions use the certainty grammar. The chart may show three horizon markers, not a fake probability cone.
- **5 columns — Liquidity distribution:** current balances by account/entity with exact values, percentage of current total, and drill-down to Portfolio.

#### Row 5: supporting operations

- Recent meaningful activity, maximum 6–8 rows, linked to Transactions.
- Compact alert inbox, maximum 5 items, linked to Alerts.
- No text-heavy insight card. A deterministic observation may appear as a single sentence directly adjacent to the chart that supports it.

### 10.5 Coordination between visualizations

- Hovering a month in cash flow may highlight the same period in category composition when both use compatible data.
- Selecting a projection horizon changes only the projection panel and its event list.
- Selecting PEN or USD changes only panels whose contract supports native separation; a control must never imply global conversion when it is local.
- Clicking a category, account, budget, credit, or event routes to the existing module/filter context without changing navigation behavior.
- Tooltips show exact values and the state label `Recorded`, `Scheduled`, or `Modeled`.

### 10.6 Density control

- Above the fold: four stats, one dominant graph, one agenda, one compact risk strip.
- No more than three chart types compete in one viewport.
- Secondary panels use restrained surfaces and lighter titles.
- Long lists expose `View all`; no inner scrollbars inside normal dashboard panels.
- Minor categories can be grouped into `Other` only with exact drill-down.
- Descriptions stay one line; chart titles ask or answer a financial question.

### 10.7 Tablet and mobile

#### Tablet

- 8-column grid.
- Stats become two by two.
- Cash-flow visual spans all 8 columns.
- Agenda and composition panels use 4 columns each.
- Projection spans all 8 columns with the event list below it.
- Sidebar uses compact rail or drawer according to viewport and saved state.

#### Mobile

1. Current liquidity and monthly result.
2. Nearest overdue/due event or calm-state message.
3. Compact cash-flow chart with 3–6 periods and a segmented period selector.
4. Chronological event list.
5. Swipe/snap analytical summaries for category, budget, credit, and net worth; every card remains independently understandable.
6. Projection as a simple stepped path plus event list, not a dense multi-series graph.
7. Recent activity.

Mobile charts must provide `View data` and exact rows. Financial values must not be shrunk below readable size to preserve a desktop composition.

### 10.8 Low-data, no-data, and error behavior

- No transactions: explain that flow and category analysis require recorded movements; provide `New transaction`.
- Accounts but no movements: show current account position and suppress trend claims.
- One period: show the exact period as a bar/point and state that a trend needs more periods.
- No dated commitments: replace agenda with a calm empty state, not zero-valued fake events.
- Projection unavailable: preserve recorded/scheduled panels and show a local retry.
- Partial endpoint failure: preserve all healthy panels.
- First-run: use a guided sequence tied to real actions—create account, add first movement, optionally add a budget—without inventing balances.

### 10.9 Existing tab behavior

The current Dashboard has Overview, Transactions, Budgets, Credits, Cash Due, and Wealth tabs. Phase 1 must not silently delete those views. The approved strategy is:

- make Overview the rich executive center described above;
- retain deeper tabs as analysis/drill-down until owner-approved consolidation and route analytics confirm a safe simplification;
- migrate their charts to the shared grammar;
- remove duplication only after equivalent access is demonstrated.

### 10.10 Probable files

- `components/dashboard/DashboardWorkspace.tsx`
- `components/dashboard/DashboardTabs.tsx`
- `components/dashboard/DashboardHeader.tsx`
- `components/dashboard/KpiCards.tsx`
- `components/dashboard/MoneyFlowChart.tsx`
- `components/dashboard/CashFlowProjectionWidget.tsx`
- `components/dashboard/OverviewRiskStrip.tsx`
- `components/dashboard/VencimientosWidget.tsx`
- `components/dashboard/EgresosCategoriasWidget.tsx`
- `components/dashboard/PatrimonioComposicionWidget.tsx`
- `components/dashboard/SaldosBancariosWidget.tsx`
- `components/dashboard/FinancialHealthScore.tsx`
- `components/dashboard/chartTheme.ts`
- `components/dashboard/primitives.tsx`
- `lib/dashboard/types.ts`
- read-only API files only if a separately approved data contract is required

## 11. Portfolio: approved pilot module

### 11.1 Primary job

Portfolio answers: **Where is my money held, in which currency and entity, and which accounts are included in my financial position?**

### 11.2 Existing data and protected behavior

Existing account fields:

- name;
- institution and bank entity;
- type;
- currency;
- current balance;
- initial balance and initial balance date;
- icon and color;
- inclusion in net worth;
- active state;
- notes and timestamps.

Protected behavior:

- create, edit, activate/deactivate, delete restrictions;
- opening-balance validation;
- bank-entity fallback;
- URL-triggered create;
- search, filters, list/card view;
- `CREDIT_CARD` technical accounts remain zero-balance and excluded from net worth;
- currency and net-worth semantics remain unchanged.

### 11.3 Corrected approved structure

#### Overview strip

1. Current PEN balance.
2. Current USD balance.
3. Active operating account count.
4. Count included in net worth plus identified entities.

These are current-position facts, not an invented trend.

#### Dominant panel

The approved mockup shows `Evolution of consolidated balance`. The current implementation generates six points by interpolating between initial and current balance. That is not historical observation. The production pilot must use one of these truthful variants:

- **Phase 1 preferred:** `Current position by account`, a sorted horizontal lollipop/bar plot showing each current balance in its native currency, with PEN/USD switch or separated groups.
- **Alternative:** `Opening position vs current position`, a dumbbell comparison labeled explicitly with opening date and current date.
- **Future:** real balance history only after a separately approved historical data/API contract.

The `/api/dashboard/saldos-dia` series must not be substituted because it represents transaction flow from zero, not account balance history.

#### Supporting panels

- Composition by account type: current native-currency share, separated by currency.
- Distribution by entity: current amount and percentage for a selected currency.
- Currency position: PEN and USD displayed as parallel totals, never raw-summed.

#### Account register

- Persistent title and total count.
- Quick filters: all, active, inactive, technical.
- Search by account, bank, type, or currency.
- Currency and type filters.
- List/card view switch.
- Columns: account identity, institution/type, native balance, inclusion in net worth, state, actions.
- Technical-card explanation remains visible but quiet.
- Create/edit drawer preserves the approved design and every current field/validation.

### 11.4 Responsive behavior

- Desktop: 7/5 analytical split; 8/4 register/supporting split.
- Tablet: dominant current-position panel full width; type and entity distribution side by side; register full width.
- Mobile: PEN/USD selector, current total, account list, compact type composition, filter sheet, create full-screen form.
- Sidebar must never appear visually larger than Portfolio content. The `218px` shell width, production type scale, and `1540px` content maximum are the approved proportion contract.

### 11.5 Probable files

- `components/management/PortfolioManager.tsx`
- `app/(dashboard)/portfolio/page.tsx`
- `components/finance/*`
- shared chart primitives introduced by the redesign
- account APIs only for a separately approved historical contract

### 11.6 Risk and acceptance

Risk is medium because the visual source contains a misleading historical curve. Acceptance requires removing that implication, preserving every current account action, retaining technical-account semantics, and showing currency-separated values.

## 12. Transactions

### 12.1 Primary job

Transactions answers: **What movement occurred, when, from/to which account, in which currency, and how does it affect reports?**

The register—not an overview card wall—is the protagonist.

### 12.2 Existing content and behavior

Persisted transaction content includes:

- income, expense, and transfer type;
- subtype;
- amount and currency;
- PEN-equivalent amount and exchange rate;
- transaction date;
- source and destination accounts;
- category;
- sender and recipient;
- payment method;
- debtor, creditor, budget, and budget-period relationships;
- recurring template relationship;
- description and notes;
- attachment;
- `affects_reports`;
- created/updated timestamps.

Protected behaviors include create/edit/delete, imports, exports to supported formats, quick presets, filters, sorting, pagination `20/50/100`, saved views, local table preferences, bulk delete, original/equivalent value, report participation, and responsive list/table behavior.

### 12.3 Approved structure

#### Header and summary

- Primary action: `New transaction`.
- Compact period summary only when it is derived from the same active filter contract.
- Do not calculate a filtered grand total from only the visible page.

#### Command bar

Row 1:

- search;
- date range;
- type;
- account;
- category;
- `More filters`;
- saved view selector.

Row 2 appears only when relevant:

- active filter chips;
- sort;
- result count;
- page size;
- view density;
- import/export.

Bulk action bar appears only after selection.

#### Desktop ledger

- Date/time context.
- Description and relationship context.
- Type/category.
- Source/destination account.
- Original amount/currency.
- PEN equivalent and exchange rate only when relevant.
- Report-participation state.
- Row actions.

Income/expense color is secondary to sign, label, and direction icon. Transfers must not visually imply income or expense.

#### Inspection

- Desktop: `380–400px` detail drawer retaining list context.
- Tablet: overlay drawer.
- Mobile: record detail sheet/page.
- Show provenance, relationships, original amount, conversion, report participation, attachment, timestamps, and valid actions.

### 12.4 States and responsive behavior

- General empty: `Record first transaction` and optionally `Import`.
- Filtered empty: show active filters and `Clear filters`.
- Import/export errors remain local and actionable.
- Mobile cards lead with date, description, signed native amount, type, and account; secondary metadata expands.
- Create/edit remains a full structured financial form, not a compressed modal on small screens.

### 12.5 Probable files

- `components/transactions/TransactionsWorkspace.tsx`
- `components/tables/TransactionTable.tsx`
- `components/forms/TransactionForm/index.tsx`
- `components/forms/TransactionForm/FormFields.tsx`
- `components/forms/TransactionForm/sections/ModuleSections.tsx`
- `components/forms/TransactionEditModal.tsx`
- `components/detail/TransactionDetailClient.tsx`
- `components/finance/data-table.tsx`
- `app/(dashboard)/transactions/*`

Risk is medium-high because this module has the largest interaction surface. The list redesign and create/edit form redesign must be separate PRs.

## 13. Credits

### 13.1 Primary job

Credits answers different questions by product type:

- Card: How much capacity is used and when is the next cycle/payment?
- Loan: How much of the obligation is paid, what is the next installment, and what remains?
- Line: How much is used and available without loan terminology?

### 13.2 Existing content

Credit records contain product type, native currency, limit/used values, PEN/USD limit and used values, initial used amounts, available amount, interest rate, closing/payment days, linked account, bank, status, notes, and links to transactions. Related loan/installment and billing-cycle data include principal, schedule, component amounts, dates, paid values, statements, and statuses.

Creating a bank loan creates the disbursement transaction, credit record, loan record, and installment schedule. Creating a card may create a technical account excluded from net worth. These workflows are protected.

### 13.3 Required stabilization before redesign

- Send the required exchange rate for USD bank loans.
- Persist principal, interest, insurance, and other schedule charges exactly as entered.
- Stop folding insurance into interest or dropping other charges.
- Correct credit detail availability and native-currency presentation.
- Remove or replace raw mixed-currency aggregate utilization.

### 13.4 Approved structure

#### Overview

- Currency-safe capacity summaries, separately for PEN and USD.
- Counts by Cards, Loans, and Lines.
- Avoid a combined utilization percentage across raw currencies.

#### Analysis

- **8 columns:** per-card/line used-versus-available bullet bars with explicit currency, limit, and next payment.
- **4 columns:** next documented obligations, separating card statements and loan installments.
- Loans use installment progress and next obligation, not `available limit`.

#### Register and detail

- Segmented Cards / Loans / Lines registry.
- Card row: issuer, current cycle, used, available, payment day.
- Loan row: original principal, installment progress, next installment, overdue amount.
- Line row: used/available and movements.
- Type-specific details; no one generic credit detail layout.

### 13.5 Responsive and states

- Mobile begins with currency selector and nearest obligation.
- Product summaries use horizontal snap only when each card remains fully readable.
- Loan schedule becomes a vertical timeline/table.
- `High use` may use a factual percentage threshold label, not a risk claim.
- No historical utilization chart until a real history contract exists.

### 13.6 Probable files and risk

- `components/credits/CreditsWorkspace.tsx`
- `components/credits/CreditsListPanel.tsx`
- `components/credits/CreditCardForm.tsx`
- `components/credits/BankLoanForm.tsx`
- `components/credits/CreditCardScheduleModal.tsx`
- `components/credits/BankLoanScheduleModal.tsx`
- `components/detail/ModuleDetails.tsx`
- `lib/credits/display-type.ts`
- credit routes in a separate stabilization PR only

Risk is high before data fixes and medium afterward.

## 14. Budgets

### 14.1 Primary job

Budgets answers: **How much was allocated, how much was used in this valid period, and which factual exceptions require review?**

### 14.2 Existing content and calculations

Budget content includes name, description, expense category, amount, currency, weekly/monthly/quarterly/yearly period, dates, active state, notes, series, explicit periods, spent, remaining, progress, and over-limit state. Current spending includes linked expense transactions and existing exchange-rate/fallback behavior. Those calculations and period-continuity rules are protected.

Legacy `budgets` rows coexist with `budget_series` and `budget_periods`. The redesign must not collapse them or imply broader action scope.

### 14.3 Required decision before grouped actions

The current manager visually groups legacy rows as a series, but edit/delete may mutate only the representative row. Copy and action placement must remain record-scoped until series-wide behavior is explicitly approved.

### 14.4 Approved structure

- Currency-separated allocation and spending summary.
- **8 columns:** budget execution map using horizontal bullet charts: spent segment, remaining segment, 100% boundary, category, exact currency.
- **4 columns:** factual exceptions: over limit, at least 80% used, no movement, or period ending soon.
- Category composition panel only when enriched metrics are available.
- Series/Periods registry toggle, filters, list, contextual action menu.
- Detail drawer/modal: period navigator, exact budget-versus-spent, remaining, linked transactions, correct record-scoped edit.

`80% used` is factual. `At risk` is not permitted unless a validated risk model exists.

### 14.5 Responsive, files, and risk

- Mobile: current-period summary, exceptions, stacked bullet charts, period history secondary.
- `components/management/BudgetsManager.tsx`
- `components/management/BudgetDetail.tsx`
- `lib/budgets/budget-metrics.ts`
- `lib/budgets/budget-periods.ts`
- budget routes only in a separate semantics/data PR

Risk is medium-high due to dual data models and action scope.

## 15. Assets

### 15.1 Primary job

Assets answers: **What do I own, what was its recorded purchase value, what is its current stored value, and what is its factual status?**

### 15.2 Existing content and behavior

Assets contain name, custom and legacy type, purchase date/value, current value, currency, vendor/recipient, notes, attachment, serial number, location, depreciation rate, status, and origin transaction. Creation uses an eligible account, inherits currency, creates an expense transaction, creates the linked asset, and rolls back if asset creation fails.

### 15.3 Required stabilization

- Replace the nonexistent `INACTIVE` filter with truthful `ACTIVE`, `SOLD`, and `DEPRECIATED` behavior.
- Stop collapsing sold and depreciated.
- Implement or clearly disable the missing attachment route.
- Join/display custom asset type correctly in detail.

### 15.4 Approved structure

- Current value in PEN and USD separately.
- Active count and factual sold/depreciated exceptions.
- **7 columns:** purchase-versus-current dumbbell/variance plot, separated by currency or explicitly converted mode.
- **5 columns:** composition by custom asset type using donut or treemap based on category count.
- Registry: identity/type, purchase value, current value, variance, purchase date, status, actions.
- Detail: original-currency comparison, provenance, metadata, attachment, origin transaction.

No historical valuation line is permitted because no valuation-history source exists.

### 15.5 Responsive, files, and risk

- Mobile: selected-currency current value, composition, concise asset cards, disclosure metadata.
- `components/assets/AssetsWorkspace.tsx`
- `components/assets/AssetsListPanel.tsx`
- `components/assets/AssetsForm.tsx`
- `components/detail/ModuleDetails.tsx`
- `app/(dashboard)/assets/*`

Risk is low-medium after stabilization and makes Assets a useful early module pilot after Portfolio.

## 16. Receivables / Por cobrar

### 16.1 Primary job

Receivables answers: **Who owes me, which documented amounts remain open, in which currency, and when are they due?**

### 16.2 Existing content and behavior

Receivable records include debtor, concept, native amount/currency, collected amount/date, issue/due dates, notes, attachment, status, and origin transaction. Debtors include name, relationship, active state, and an initial debt with no currency field.

Creation makes an expense transaction from the selected source account. A credit-card source follows the existing credit-consumption rules. Collection uses the existing `receivable_collect` operation, creates an income settlement, and updates collected amount/status. These directions and links are protected.

### 16.3 Blocking financial issue

Current debtor APIs sum raw PEN and USD values, add a currency-undefined `initial_debt`, and the UI formats the result as PEN. No redesigned consolidated receivable total may ship until the product/data decision is approved.

Safe Phase 1 visualizations can use individual documented receivable rows, separated by native currency, and explicitly exclude ambiguous initial debt from currency totals.

### 16.4 Approved structure

- PEN and USD summaries side by side or behind an explicit local currency selector.
- **8 columns:** maturity ladder of documented lines—overdue, next 7 days, next 30 days, later.
- **4 columns:** counterparty concentration bars, separated by currency.
- Primary operational register uses individual receivables; counterparty grouping is an alternate view.
- Columns: debtor, concept, original amount/currency, collected, remaining, due date, status, source.
- Direct `Register collection` action launches the existing settlement flow.
- Counterparty drawer order: open receivable lines, recovery progress, transaction ledger.
- `WRITTEN_OFF`, partial, overdue, and collected remain distinct.

### 16.5 Responsive, files, and risk

- Mobile: overdue and next-due facts, chronological queue, debtor/currency filter, settlement action.
- `components/receivables/ReceivablesManager.tsx`
- `components/receivables/DebtorForm.tsx`
- `components/receivables/ReceivableForm.tsx`
- `components/receivables/DebtorDetail.tsx`
- `components/detail/ModuleDetails.tsx`
- related TransactionForm settlement sections
- debtor/receivable routes only in a separate approved correctness PR

Risk is high until currency and attachment semantics are resolved.

## 17. Payables / Por pagar

### 17.1 Primary job

Payables answers: **Whom do I owe, which documented obligations remain, in which currency, and when must they be paid?**

### 17.2 Existing content and behavior

Payable records include creditor, concept, native amount/currency, paid amount/date, issue/due dates, notes, attachment, status, and origin transaction. Creditors include name, relationship, active state, and currency-undefined initial debt.

Creation excludes credit-card source accounts and creates an income transaction representing received funds/debt. Payment uses `payable_pay`, creates an expense settlement, and updates paid amount/status. These semantics are protected.

### 17.3 Blocking financial issue

The same raw mixed-currency and initial-debt issue exists here. A single `Total payable PEN` hero is prohibited until the semantics are repaired and approved.

### 17.4 Approved structure

- Native-currency summaries.
- **8 columns:** liquidity-pressure maturity ladder—overdue, next 7 days, next 30 days, later—separated by currency.
- **4 columns:** creditor concentration and factual exception list.
- Individual obligations are the primary register; creditor grouping is alternate.
- Columns: creditor, concept, original amount/currency, paid, remaining, due date, status, source.
- Direct `Register payment` action launches the existing settlement flow.
- Creditor drawer order: open obligations, payment progress, transaction ledger.
- `DISPUTED`, partial, overdue, and paid remain distinct.

### 17.5 Responsive, files, and risk

- Mobile: overdue/next-due facts, chronological queue, currency selector, contextual payment action.
- `components/payables/PayablesWorkspace.tsx`
- `components/payables/CreditorForm.tsx`
- `components/payables/PayableForm.tsx`
- `components/payables/CreditorDetail.tsx`
- `components/detail/ModuleDetails.tsx`
- related TransactionForm settlement sections
- creditor/payable routes only in a separate approved correctness PR

Risk is high until currency and attachment semantics are resolved. Receivables and Payables may share primitives, but each ships in a separate PR because their transaction directions are opposite.

## 18. Recurring templates

### 18.1 Primary job

The current module is a reusable template library, not a scheduler. It answers: **Which repeatable financial records can I use to prefill a new operation?**

The sidebar description should be changed from `automatic movements` to a truthful equivalent such as `Reusable templates for frequent movements` unless scheduling capabilities are separately built.

### 18.2 Existing content and behavior

Templates contain:

- name;
- income, expense, transfer, receivable, or payable type;
- subtype;
- amount and currency;
- category and budget;
- source/destination account;
- debtor or creditor;
- sender, recipient, payment method;
- description and notes;
- active state.

Existing actions include search, type/account filters, list/card view, create, edit, delete, activate/deactivate, and `Use template` to prefill TransactionForm.

### 18.3 Approved structure

- Compact counts: active templates, inactive templates, and count by operation type. No monetary forecast total.
- Primary register grouped or filtered by operation type.
- Row/card: template identity, amount/currency, source/destination/category context, active state, `Use template`, and overflow actions.
- A small relationship map may show source → operation → destination for transfers only; other types use a simple directional marker.
- No calendar, next-run date, frequency, or upcoming-event claim because those fields do not exist.
- Create/edit form uses the same sections and conditional field logic as TransactionForm where possible.

### 18.4 Responsive, files, and risk

- Mobile prioritizes `Use template`; configuration metadata expands on demand.
- `components/recurring/RecurringWorkspace.tsx`
- `components/recurring/RecurringForm.tsx`
- `app/(dashboard)/recurring/page.tsx`
- recurring API contracts remain unchanged

Risk is low-medium if scheduler implications are removed.

## 19. Alerts

### 19.1 Primary job

Alerts is a factual financial attention inbox. It answers: **Which documented conditions require review, and which have I already read?**

### 19.2 Existing content and behavior

Current alerts support:

- severity, module, read state, search, and filters;
- read/unread, mark all read;
- delete one/delete read;
- refresh/generate;
- manual notification creation;
- linked route/source record;
- generation from installments, card cycles, overdue payables, budget usage/overage, old receivables, and unused recurring templates.

`is_read` means read, not resolved. Manual alerts are notifications, not automated rules.

### 19.3 Approved structure

- Summary strip: overdue/critical count, due-soon count, unread count, last generation time where available.
- Primary inbox grouped by `Overdue`, `Due soon`, and `Informational`, then by date.
- Each item shows factual trigger, native amount/currency if present, relevant date, module/source, read state, and direct link.
- Filters remain compact and persistent.
- Read state uses typography/surface weight, not a fake resolved checkmark.
- Dismiss/delete remains different from read.
- Empty state distinguishes `No alerts generated` from `No results for filters` and `All caught up`.
- No recommendation copy that cannot cite a deterministic generator condition.

### 19.4 Responsive, files, and risk

- Mobile uses an inbox list and bottom-sheet filters; direct destination remains one tap away.
- `components/alerts/AlertsWorkspace.tsx`
- `components/alerts/AlertsCenter.tsx`
- `components/alerts/AlertFilters.tsx`
- `components/alerts/AlertCard.tsx`
- `components/alerts/AlertSummaryBar.tsx`
- `lib/alerts/alert-generator.ts`
- `lib/dashboard/alerts.ts`

Risk is medium because language must not elevate a generator condition into advice or resolution state.

## 20. Settings

### 20.1 Primary job

Settings answers: **How is my account, security, financial display, notification preference, and data access configured?**

### 20.2 Existing sections

- Profile
- Security
- Preferences
- Notifications/alerts
- Accounts
- Import/export/data
- Support

Current behavior and API contracts for profile, avatar, password, notifications, export, and support remain protected.

### 20.3 Approved structure

- Desktop two-column settings shell: `230–250px` local settings navigation and one readable content column with maximum width `760–860px`.
- Local navigation groups: Account, Preferences, Data, Help.
- Route/app sidebar remains visible; local settings navigation is visually secondary and must not look like a second global sidebar.
- Section titles and descriptions appear once; avoid a card around every input.
- Use quiet section dividers and grouped form surfaces.
- Sensitive actions occupy a clearly separated danger zone.
- Save feedback is explicit and local; unsaved navigation is protected.
- Appearance preview uses actual light/dark tokens.
- Account/data wording must not imply live bank connectivity if the product only manages local account records.

### 20.4 Responsive and files

- Tablet: local navigation becomes tabs or a compact rail.
- Mobile: settings index first, then full-width section page; sticky save bar only when necessary.
- `components/settings/SettingsSidebar.tsx`
- `components/settings/config.tsx`
- all `components/settings/*Panel.tsx`
- `components/settings/primitives.tsx`
- `app/(dashboard)/settings/page.tsx`

Risk is low-medium; security and export flows require focused regression testing.

## 21. Admin, developer, status, auth, and public surfaces

### 21.1 Admin

Admin manages categories, currencies, bank entities, asset types, budgets/credits legacy management where applicable, and icon studio capabilities.

- Preserve role gating and every catalog action.
- Apply the same register, form, modal, state, and token contracts.
- Keep admin density higher than consumer modules but maintain readable typography.
- Show environment/permission context explicitly.
- Do not expose developer-only controls through visual regrouping.

Probable files: `components/management/AdminWorkspace.tsx`, catalog managers, `app/(dashboard)/admin/*`.

### 21.2 Developer and module-status surfaces

- Preserve feature gating.
- Use the same brand/tokens but a clearly identified developer environment banner.
- Status views use factual service/module states and recovery instructions.
- No internal technical control should appear in ordinary user navigation.

### 21.3 Authentication

- Use FT Ligature horizontal lockup.
- Keep one primary task per page.
- Form width `380–440px` with strong error and password guidance.
- Decorative showcase must not delay form interaction or harm reduced-motion users.
- Maintain all authentication behavior, redirect, and security semantics.

### 21.4 Landing, maintenance, not-found, and global error

- Adopt brand, Manrope, approved color system, and surface language.
- Maintenance and global error emphasize status, next action, and support path.
- Landing claims must reflect real product capabilities; no connected-bank, AI-advice, or automatic-scheduling claim unless implemented.
- Global states do not reveal internal errors or sensitive data.

## 22. Detail-page system

### 22.1 Standard anatomy

1. Breadcrumb/back action preserving existing navigation.
2. Entity identity, factual status, and primary amount in original currency.
3. Three to five contextual facts.
4. One type-specific explanation visual.
5. Related records/ledger/schedule.
6. Provenance and metadata.
7. Contextual edit/delete/settlement actions.

### 22.2 Type-specific requirements

- Transaction: original amount, equivalent, exchange rate, accounts, category, report inclusion, attachment.
- Credit card: capacity and billing cycles.
- Loan: principal and installment schedule.
- Asset: purchase/current comparison and provenance.
- Receivable: original amount, collected/pending, due state, settlements.
- Payable: original amount, paid/pending, due state, settlements.
- Budget: period boundary, execution, linked expenses.

A generic `ModuleDetails` shell may remain shared, but its financial content must be selected by type and cannot format every amount as PEN.

## 23. Financial formatting and content rules

### 23.1 Currency

- Original contractual currency is always primary on records and details.
- Converted PEN equivalent is secondary and labeled `Equivalent in PEN` or `Eq. PEN`.
- Never display a converted value with the original-currency label.
- PEN and USD totals remain separate unless an existing endpoint explicitly returns a verified converted aggregate.
- Credit capacity, account balance, asset value, receivable, payable, and transaction amount preserve their own semantics; visually similar values are not automatically additive.
- The existing `formatCurrency`, `CurrencyDisplay`, and exchange-rate contracts remain the implementation source of truth.
- Chart axes may use `k`/`M`; tooltips, summaries, tables, exports, and accessible alternatives show exact values.

### 23.2 Numbers

- Use tabular numerals for amounts, rates, percentages, counts, dates, and identifiers.
- Right-align comparable numeric table columns.
- Preserve the precision required by the current financial contract.
- Percentages should normally use one decimal when the source supports it; never invent precision.
- Zero is shown only after successful data resolution. Loading is a skeleton, not `0`.
- Negative values include a visible minus sign; do not depend only on red.
- No animated count-up for money because intermediate values are false readings.

### 23.3 Dates and periods

- User-facing compact date: localized `22 Aug 2026` equivalent in Spanish locale.
- Form inputs retain valid date control behavior and stored ISO semantics.
- Relative labels such as `in 2 days` accompany, not replace, the exact date.
- Period comparisons name both periods.
- `Current month` must reflect the actual selected/report period, not the browser month if the endpoint uses another range.

### 23.4 Product copy

- Spanish UI copy is direct, factual, and brief.
- Titles answer a question: `Where your money is held`, `Next obligations`, `Budget used`.
- Avoid praise, anxiety, or financial advice.
- Avoid `healthy`, `risky`, `safe`, `optimal`, or `recommended` unless backed by an approved model and explained.
- Prefer `80% used` to `At risk`.
- Prefer `Read`/`Unread` to `Resolved` when only `is_read` exists.
- Prefer `Reusable template` to `Automatic movement` when scheduling data does not exist.
- Error copy states what failed, what remains safe, and what the user can do.

## 24. Iconography and visual assets

- Base icon grid: `24 × 24` view box.
- Normal product size: `18–20px`; compact metadata: `16px`; empty-state illustration: up to `40px`.
- Stroke: `1.75px`, round cap/join, coherent optical weight.
- Filled icons are limited to status emphasis or branded app icon.
- Module icon meaning stays stable across sidebar, headers, empty states, and links.
- Do not mix emoji, multiple icon families, and arbitrary Unicode symbols.
- Bank/category/user-selected icons preserve their configured identity within accessible contrast containers.
- Decorative imagery is not required for core financial modules.

Probable shared files:

- `components/layout/LayoutIcons.tsx`
- `components/ui/FinancialIcon.tsx`
- `lib/constants/visual-options.ts`
- `public/brand/*`

## 25. Motion system

### 25.1 Principles

Motion communicates continuity, hierarchy, and state. It does not simulate financial activity or make a static value seem live.

### 25.2 Tokens

| Token | Duration | Use |
|---|---:|---|
| `--ft-duration-instant` | `100ms` | press/focus response |
| `--ft-duration-fast` | `140ms` | hover, tooltip, icon state |
| `--ft-duration-base` | `220ms` | menu, popover, filter state, modal fade |
| `--ft-duration-layout` | `320ms` | sidebar width, drawer, responsive reflow |
| `--ft-duration-data` | `420ms` | chart path/bar/ring reveal after resolved data |
| `--ft-ease-out` | `cubic-bezier(.25,1,.5,1)` | ordinary entry/exit |
| `--ft-ease-expo` | `cubic-bezier(.16,1,.3,1)` | larger layout transitions |

### 25.3 Approved motion

- Sidebar expand/collapse: width plus label opacity, `320ms`; content must not jump after completion.
- Mobile drawer: backdrop fade and `16px` translate, `220–320ms`.
- Modal/drawer: short opacity/translate; never spring or bounce for financial forms.
- Panel hover: `translateY(-1px)` or at most `-2px`, border/surface emphasis, `140ms`.
- Row hover/focus: background/border only; amount does not move independently.
- Filter changes: crossfade skeleton/rows locally, preserving toolbar position.
- Chart load: line draw, bar scale from baseline, ring sweep, or opacity reveal once per resolved dataset, `320–420ms`.
- Linked chart hover: immediate emphasis under `140ms`.
- Toast: enter/exit only; no bouncing.
- Skeleton: subtle low-contrast shimmer; static fallback under reduced motion.

### 25.4 Prohibited motion

- monetary count-up;
- continuously pulsing balances;
- looping chart animation;
- parallax in authenticated financial modules;
- gold logo node traveling along charts;
- animation that delays access to actions or data;
- stagger longer than `30ms` per item or more than five visible items;
- height animation from/to `auto` without a measured, stable implementation;
- motion as the sole indicator of state.

### 25.5 Reduced motion

`prefers-reduced-motion: reduce` must:

- reduce all transitions to near-instant state changes;
- remove chart drawing and skeleton shimmer;
- keep opacity changes minimal;
- preserve focus and state indicators;
- never remove content.

## 26. Accessibility and inclusive data visualization

### 26.1 Baseline

- WCAG 2.2 AA contrast for text, controls, focus, and meaningful chart marks.
- Keyboard access to every action, filter, row action, modal, drawer, popover, and tab.
- Visible focus ring of at least `2px`, with sufficient offset and contrast.
- Minimum touch target `44 × 44px`.
- Logical DOM/focus order follows visible hierarchy.
- Page title uses one `h1`; panels use ordered headings.
- Dynamic loading/error/success messages use appropriate live regions without excessive announcements.

### 26.2 Charts

- A concise accessible name states the question, period, and unit.
- A hidden or visible table/list exposes the data points.
- Legends use text plus line/pattern/shape, not color alone.
- Recorded/scheduled/modeled are represented by both pattern and marker.
- Hover content is also reachable by keyboard/focus where interaction is essential.
- Category labels remain legible and do not rely solely on tiny slices.
- Donuts should aggregate or switch to bars when slices become unreadable.

### 26.3 Tables and forms

- Table header relationships and sort state are programmatic.
- Mobile cards retain explicit field labels where column context disappears.
- Errors connect to fields through `aria-describedby`.
- Required and optional state is explicit.
- Dialog title/description and initial focus are programmatic.
- Destructive confirmation names the record and consequence.

### 26.4 Localization and resilience

- Layout supports long Spanish labels without clipping.
- Text may grow to 200% without losing actions or data.
- Amount containers handle large values and negative values.
- Empty/error copy remains meaningful offline or after partial API failure.

## 27. Frontend architecture for the transformation

### 27.1 Migration strategy

The implementation is a compatibility migration, not a big-bang replacement.

1. Lock semantic tokens and aliases.
2. Add approved fonts and brand assets.
3. Upgrade shared primitives behind stable props.
4. Migrate shell.
5. Migrate one module at a time.
6. Remove compatibility CSS only when the last consumer is verified.

Existing behavior-heavy components should be separated into orchestration, presentational sections, and form/detail primitives before or during their own module PR—not in an unrelated global refactor.

### 27.2 Proposed shared structure

New files are suggestions to be confirmed during implementation:

```text
components/
  charts/
    FinancialChartFrame.tsx
    FinancialChartLegend.tsx
    FinancialChartTooltip.tsx
    FinancialChartStates.tsx
    FinancialDataTable.tsx
    RecordedScheduledProjectedKey.tsx
  finance/
    primitives.tsx
    data-table.tsx
    ledger-module.tsx
  layout/
    AppShell.tsx
    Sidebar.tsx
    Topbar.tsx
    Brand.tsx
  ui/
    existing shared control files
lib/
  design/
    chart-colors.ts
    motion.ts
    format-presentation.ts
public/
  brand/
    fintrack-ligature.svg
    fintrack-ligature-mono-light.svg
    fintrack-ligature-mono-dark.svg
    fintrack-wordmark.svg
    fintrack-app-icon.svg
```

Do not create parallel `V2` components for the full application. Use a temporary feature flag only if a module needs controlled comparison; remove it when that module is accepted.

### 27.3 CSS and Tailwind

- Keep `app/globals.css` as the imported root while extracting logically grouped token/component sections only when it reduces risk.
- Update `tailwind.config.ts` to map semantic utilities to canonical `--ft-*` tokens.
- Preserve compatibility utility names until consumers migrate.
- Replace arbitrary direct values during the owning component's PR, not with an uncontrolled repository-wide search/replace.
- Avoid broad selectors that restyle unrelated authenticated/public pages.
- Theme values live in `[data-theme="light"]` and `[data-theme="dark"]` semantic contracts.

### 27.4 Fonts

- Configure Manrope and DM Mono in `app/layout.tsx` with CSS variables.
- Map Tailwind `font-body`, `font-sans`, `font-display`, and `font-mono` deliberately.
- Load only required weights.
- Verify no layout shift in sidebar, tables, KPI values, and forms.
- Update email/PDF fallbacks separately because web fonts may not render there.

### 27.5 Chart implementation

- Continue using Recharts and custom SVG for Phase 1.
- Centralize axis, grid, tooltip, legend, state styles, number formatting, and responsive behavior.
- Keep data transformation outside presentational chart components.
- Every transform has unit tests or snapshot fixtures using anonymized deterministic sample data.
- No chart computes a new financial result differently from an existing endpoint/helper.
- A chart may reshape rows for display, but may not reinterpret currency or status.

### 27.6 State and request behavior

- Preserve SWR keys, mutations, cache invalidation, and request contracts unless a separately approved fix requires change.
- Replace page-wide `Promise.all` failure coupling with independently recoverable panels only in a dedicated reliability change.
- Use existing fetch timeout/error utilities.
- Avoid duplicate requests introduced by desktop/mobile duplicate markup.
- Hidden responsive views must not independently fetch the same data.

### 27.7 Feature flags and rollback

Preferred rollback is one PR/revert per layer or module. If a runtime flag is necessary:

- use the existing app-control mechanism;
- default to legacy until QA acceptance;
- ensure both branches consume the same financial data/functions;
- remove the flag after stabilization to avoid permanent dual maintenance.

## 28. Stabilization blockers before visual implementation

These are separate correctness or product-decision tasks. They must not be hidden inside redesign PRs.

| ID | Blocker | Why it matters | Safe resolution path | Redesign modules blocked |
|---|---|---|---|---|
| S1 | Receivable/payable aggregates raw-sum PEN and USD; `initial_debt` has no currency | premium totals/charts would be financially misleading | approve currency contract or show only documented rows separated by currency; schema change requires explicit approval | Receivables, Payables, related Dashboard totals |
| S2 | USD bank-loan create omits required exchange rate | creation fails | focused form/API-contract fix with regression test | Credits |
| S3 | Loan schedule drops `other_charges` and misstores insurance | entered schedule is not preserved | exact field mapping fix and schedule parity test | Credits |
| S4 | Asset/receivable/payable attachment controls target missing routes | UI implies unsupported success | implement separately with approval or disable with explanation | Assets, Receivables, Payables |
| S5 | Asset `INACTIVE` filter does not match real statuses; custom type detail falls back to `OTHER` | records disappear or are mislabeled | use real enum statuses and join custom type in detail | Assets |
| S6 | Credit detail trusts nullable/stale availability and formats native amounts as PEN | value/currency can be wrong | derive with the established list logic and preserve native currency | Credits |
| S7 | Budget grouped-series edit/delete affects one representative row | action scope is misleading | owner/product decision and explicit record/series wording | Budgets |
| S8 | Portfolio trend is interpolated rather than historical | graph implies observations that do not exist | replace with current-position/opening-vs-current view; history requires future contract | Portfolio |

No database or API contract change listed here is authorized by this blueprint. Each requires the approval and workflow specified in repository rules.

## 29. Exact implementation order

### 29.1 Delivery rules for every implementation PR

- One coherent concern or one module per PR.
- No database, business-logic, and visual redesign changes in the same PR.
- Record before/after screenshots at desktop, tablet, and mobile in light and dark mode.
- Record files modified, purpose, risks, test evidence, and rollback.
- Run financial parity checks before visual review.
- Test loading, partial error, empty, filtered empty, success, and permission/action states.
- Verify every visible action.
- Do not remove compatibility tokens or legacy components until all consumers are migrated.
- Do not use mock data in authenticated production UI.

### 29.2 Gate A — production stability and content integrity

These changes precede visual implementation and remain independent from it.

| Order | Focus | Probable files | Acceptance gate | Risk / rollback |
|---:|---|---|---|---|
| A1 | Complete repository Phase 1 QA | `QA_CHECKLIST.md`, affected production files only after issue approval | no critical module load/infinite loading/action defects | issue-specific revert |
| A2 | USD loan exchange-rate submission | `components/credits/BankLoanForm.tsx`, credit validation tests | PEN and USD creation pass; values unchanged after reload | high financial; focused revert |
| A3 | Exact loan schedule field persistence | loan form, schedule modal, credits route/service/test files | principal, interest, insurance, other charges, total round-trip exactly | high financial; focused revert |
| A4 | Attachment behavior | asset/receivable/payable forms and separately approved routes or disabled-state copy | no control implies a successful upload when unsupported | medium; route or UI revert |
| A5 | Asset statuses and custom type detail | `AssetsListPanel.tsx`, detail query/component, tests | active/sold/depreciated filters and custom label correct | medium; focused revert |
| A6 | Credit detail amount semantics | `components/detail/ModuleDetails.tsx`, shared display helper/tests | native currency correct; availability matches established list logic | high; focused revert |
| A7 | Budget series action-scope decision | product decision plus budget UI/API only after approval | labels and mutation scope are identical and tested | high; retain record-scoped legacy path |
| A8 | Receivable/payable currency decision | product/data decision; no implied schema authority | approved safe display contract or approved separate data project | high; keep currency-separated documented rows |
| A9 | Portfolio historical-content correction | `PortfolioManager.tsx` only as a separate integrity change | interpolated series no longer labeled/displayed as history | medium; revert to legacy UI only if warning remains explicit |

Visual rollout cannot pass its module gate while that module's blocking A-task remains unresolved.

### 29.3 Gate B — approved source and baseline capture

**Branch suggestion:** `codex/redesign-approved-baseline`

**Risk:** low; documentation/visual evidence only.

Actions:

- Treat this blueprint as the implementation source of truth.
- Capture the approved Portfolio reference at `1600`, `1280`, `1024`, `768`, `430`, and `390px` widths.
- Capture current production routes at the same widths in both themes.
- Record existing supported actions, keyboard path, and state screenshots.
- Archive exact FT Ligature source geometry in the brand implementation PR, not as a screenshot.

Acceptance:

- all authenticated routes have a baseline;
- approved visual proportions are measurable;
- current behavior inventory is signed off;
- no application code changes.

Rollback: delete documentation-only artifacts if rejected; no runtime impact.

### 29.4 Stage 1 — brand system

**Branch suggestion:** `codex/redesign-brand-ft-ligature`

**Risk:** low-medium.

Probable files:

- `components/layout/Brand.tsx`
- `public/brand/*`
- `app/layout.tsx`
- auth/public/email/export brand consumers discovered by `rg`

Actions:

- create canonical SVG, monochrome variants, horizontal wordmark, favicon/app-icon exports;
- implement accessible wordmark/mark modes in `Brand`;
- replace old PNG references without changing layout behavior;
- update metadata/theme colors only after light/dark assets are verified;
- verify email/PDF-safe fallbacks separately.

Acceptance:

- logo 12 geometry and color roles match this document;
- compact mark remains legible at 20–24px;
- no stretched or clipped lockup;
- light/dark and print/fallback variants work;
- no route or functional behavior changes.

Rollback: restore previous Brand asset references; new SVG files are additive until acceptance.

### 29.5 Stage 2 — fonts, tokens, and compatibility aliases

**Branch suggestion:** `codex/redesign-foundations`

**Risk:** medium because it affects every route.

Probable files:

- `app/layout.tsx`
- `app/globals.css`
- `tailwind.config.ts`
- `lib/tokens.ts`
- visual token tests/docs if present

Actions:

- load Manrope and DM Mono through Next font delivery;
- install light/dark semantic tokens from Section 7;
- point legacy `--c-*`, `--color-*`, and compatibility Tailwind names to equivalent semantics;
- install spacing, radius, elevation, z-index, and motion variables;
- do not restyle modules deliberately in this PR beyond unavoidable font/token mapping;
- validate contrast and layout shift across every route.

Acceptance:

- no missing variables;
- no flash of wrong theme;
- no clipped navigation, values, or forms;
- existing pages remain usable;
- all semantic contrast combinations pass agreed AA checks;
- production bundle loads only required font weights.

Rollback: revert font/token mapping while aliases preserve existing consumers.

### 29.6 Stage 3 — shared controls, states, and chart grammar

Split this stage into three PRs to keep reviewable scope.

#### Stage 3A: controls and surfaces

**Branch:** `codex/redesign-ui-primitives`

Files:

- shared UI controls;
- `components/finance/primitives.tsx`;
- `components/forms/primitives.tsx`;
- `components/detail/primitives.tsx`;
- `components/settings/primitives.tsx`.

Acceptance:

- buttons, inputs, selects, badges, panels, menus, tabs, progress, and focus states match the token contract;
- props and behavior remain backward compatible;
- touch, keyboard, loading, disabled, and destructive states pass.

#### Stage 3B: loading/error/empty system

**Branch:** `codex/redesign-data-states`

Files:

- `components/ui/states.tsx`;
- `components/ui/skeletons.tsx`;
- `components/system/AppStateScreen.tsx`;
- shared error/empty consumers only where required for compatibility.

Acceptance:

- first-use and filtered empty are distinct;
- retry works;
- skeleton geometry does not shift final layouts;
- secondary failure remains local.

#### Stage 3C: charts and motion

**Branch:** `codex/redesign-chart-system`

Files:

- proposed `components/charts/*`;
- `components/dashboard/chartTheme.ts`;
- `lib/charts/*`;
- `app/globals.css` motion section.

Acceptance:

- common frame/legend/tooltip/table alternative exists;
- certainty taxonomy is reusable;
- Recharts/custom SVG remain the rendering foundation;
- reduced-motion parity passes;
- no financial computation is duplicated or changed.

Rollback for each PR: revert the owning shared layer; compatibility props and tokens keep legacy modules operational.

### 29.7 Stage 4 — application shell

**Branch suggestion:** `codex/redesign-shell`

**Risk:** medium-high because every authenticated route uses it.

Probable files:

- `components/layout/AppShell.tsx`
- `components/layout/Sidebar.tsx`
- `components/layout/NavItem.tsx`
- `components/layout/Topbar.tsx`
- `components/layout/LayoutIcons.tsx`
- `components/layout/QuickActionsFAB.tsx`
- `lib/hooks/useLayout.tsx`
- `lib/constants/nav.ts`
- `app/(dashboard)/layout.tsx`

Actions:

- implement 218px expanded, 68–72px collapsed, 74px topbar, and responsive drawer contract;
- add visual route grouping without changing route order/permissions;
- make topbar controls route-aware;
- remove duplicate create actions;
- retain gated Admin/Developer behavior;
- revise Recurring description truthfully;
- make optional sidebar balance summary non-blocking and hide it in compact/mobile states.

Acceptance:

- every current route remains reachable;
- active state and nested routes are correct;
- keyboard and screen-reader navigation pass;
- sidebar/content proportions match the approved Portfolio source;
- resize produces no overlap, scale transform, or content loss;
- no duplicate network request from responsive rendering.

Rollback: revert shell PR; module content remains compatible with foundational tokens.

### 29.8 Stage 5 — overlays, forms, registers, and details

This stage upgrades shared interaction patterns before module pages.

| PR | Scope | Key files | Acceptance |
|---|---|---|---|
| 5A | Data register | `components/finance/data-table.tsx`, table primitives, shared toolbar | sort/filter/pagination/actions/keyboard/mobile parity |
| 5B | Modal and drawer | `RecordModal`, overlay portal, confirm/detail drawer primitives | focus, escape, scroll lock, return focus, dirty-state behavior |
| 5C | Form anatomy | form primitives and common controls | errors, numeric/currency fields, optional groups, touch/mobile |
| 5D | Detail anatomy | detail primitives and type switch contract | original currency first, provenance, type-specific sections |

Risk is medium. Each PR rolls back independently to the compatible prior primitive.

### 29.9 Stage 6 — Portfolio visual pilot

**Branch:** `codex/redesign-portfolio`

**Risk:** medium.

Entry requirements:

- A9 passed;
- shared foundations/shell/register/form/detail contracts passed;
- every existing Portfolio action has an automated or manual parity case.

Implementation:

- apply Section 11 exactly;
- use current-position/opening-vs-current visualization, not fabricated history;
- integrate the approved drawer and account register;
- demonstrate desktop/tablet/mobile, light/dark, full/low/empty/error datasets.

Acceptance:

- owner visual approval;
- all account operations and validation pass;
- PEN/USD and technical-account semantics pass;
- no app-wide regressions;
- performance budget and accessibility pass.

Rollback: revert Portfolio page/component PR; shared approved system remains.

### 29.10 Stage 7 — Dashboard

**Branch:** `codex/redesign-dashboard`

**Risk:** high because it composes many endpoints.

Implementation order inside the PR:

1. Header and risk strip.
2. Four executive facts.
3. Cash-flow visual.
4. Documented event agenda.
5. Category/net-worth/budget-credit analysis.
6. Projection with certainty key.
7. Account distribution and supporting lists.
8. Existing deeper tabs using the shared chart grammar.
9. Independent states and responsive reflow.

Acceptance:

- values match current endpoint fixtures exactly;
- no mixed-currency or false-history claim;
- recorded/scheduled/modeled are unambiguous;
- partial endpoint failure preserves healthy content;
- Overview is understandable in three seconds in owner review;
- deeper tabs and links remain reachable;
- mobile priority matches Section 10.7.

Rollback: keep a short-lived app-control flag or revert the Dashboard PR only; no endpoint change is bundled.

### 29.11 Stage 8 — Transactions register

**Branch:** `codex/redesign-transactions-register`

**Risk:** medium-high.

- Redesign only list/toolbar/inspection surfaces.
- Preserve create/edit form implementation.
- Test every filter combination, saved views, pagination size, sort, bulk delete, import/export, detail, and mobile cards.
- Confirm totals do not derive from the visible page.

Rollback: revert the Transactions workspace/table PR.

### 29.12 Stage 9 — Transaction create/edit/detail

**Branch:** `codex/redesign-transaction-form`

**Risk:** high.

- Split the oversized form into presentational sections without changing orchestrator/business behavior.
- Preserve every operation type, conditional relation, numeric rule, exchange-rate rule, report flag, nested record modal, attachment, and validation.
- Migrate edit modal and transaction detail.
- Test all operation matrices, including transfers, receivable collection, payable payment, credit/asset-linked operations, and recurring-prefill path.

Rollback: revert form/detail PR while the redesigned register remains compatible.

### 29.13 Stage 10 — Assets

**Branch:** `codex/redesign-assets`

**Entry:** A4 and A5 passed.

**Risk:** low-medium.

- Implement Section 15.
- Verify asset transaction rollback and original currency.
- No historical value chart.
- Test active/sold/depreciated, custom types, attachment state, list/card, form/detail.

Rollback: module-only revert.

### 29.14 Stage 11 — Budgets

**Branch:** `codex/redesign-budgets`

**Entry:** A7 passed.

**Risk:** medium-high.

- Implement bullet execution map, exceptions, registry, and period detail.
- Preserve legacy/new model distinction, formula, fallback, continuity, and transaction links.
- Test PEN/USD, every period type, over-limit, no-movement, series/period actions.

Rollback: module-only revert; no data migration bundled.

### 29.15 Stage 12 — Credits

**Branch:** `codex/redesign-credits`

**Entry:** A2, A3, and A6 passed.

**Risk:** high.

- Implement separate Cards, Loans, and Lines structures.
- Preserve technical accounts, disbursement transaction, cycles, installments, and delete rollback.
- Test PEN/USD, new/edit/status/delete, card cycles, loan schedules, detail, partial and overdue installments.

Rollback: module-only visual revert; stabilization fixes remain.

### 29.16 Stage 13 — Receivables

**Branch:** `codex/redesign-receivables`

**Entry:** A4 and A8 passed or approved documented-lines-only contract.

**Risk:** high.

- Implement maturity ladder, currency separation, line-first register, collection action, and debtor drawer.
- Test ordinary and credit-card sources, partial/collected/written-off/overdue, recurrence, links, attachment state, and settlement direction.

Rollback: module-only revert; no aggregate contract change bundled.

### 29.17 Stage 14 — Payables

**Branch:** `codex/redesign-payables`

**Entry:** A4 and A8 passed or approved documented-lines-only contract.

**Risk:** high.

- Reuse accepted structural primitives from Receivables but keep separate semantics and implementation review.
- Test non-card source, partial/paid/disputed/overdue, recurrence, links, attachment state, and payment direction.

Rollback: module-only revert.

### 29.18 Stage 15 — Recurring templates

**Branch:** `codex/redesign-recurring`

**Risk:** low-medium.

- Implement Section 18 without schedule/calendar implications.
- Test every template type, filters, list/card, create/edit/delete/toggle, and prefill action.

Rollback: module-only revert.

### 29.19 Stage 16 — Alerts

**Branch:** `codex/redesign-alerts`

**Risk:** medium.

- Implement factual inbox and state language.
- Test generators, refresh, filters, read/unread, mark all read, delete one/read, manual notification, links, and badges.
- Ensure read is not shown as resolved.

Rollback: module-only revert.

### 29.20 Stage 17 — Settings

**Branch:** `codex/redesign-settings`

**Risk:** medium.

- Implement local settings navigation and grouped forms.
- Test profile/avatar, theme/preferences, security/password, notifications, accounts wording, import/export/data, support, dirty state, and mobile navigation.

Rollback: settings-only revert.

### 29.21 Stage 18 — Admin, developer, and module status

Ship as separate PRs despite the shared stage:

- `codex/redesign-admin`
- `codex/redesign-developer`
- `codex/redesign-module-status`

Preserve role/feature gating, catalog behavior, environment clarity, and every action. Risk is medium for Admin and low for status presentation. Roll back independently.

### 29.22 Stage 19 — Auth and public/system surfaces

Separate PRs:

- `codex/redesign-auth`
- `codex/redesign-public-system`

Migrate login/register, landing, maintenance, not-found, global error, and release surfaces. Test security/redirects first, then visual acceptance. Rollback is route-group specific.

### 29.23 Stage 20 — compatibility cleanup

**Branch:** `codex/redesign-cleanup`

**Risk:** medium-high and last only.

Actions:

- inventory remaining `--c-*`, `--color-*`, direct hex, arbitrary radius, and legacy-font consumers;
- remove unused visual components only after `rg`, build, route QA, and owner acceptance;
- remove temporary flags;
- reduce `globals.css` duplication without changing output;
- update final design documentation and screenshot baseline.

Acceptance:

- zero unmapped legacy token consumers;
- no dead parallel V2 system;
- production build, automated tests, and full QA checklist pass;
- performance and accessibility are at least baseline-equivalent;
- owner signs off the complete app.

Rollback: cleanup reverts independently; never delete compatibility paths until the last migrated release is stable.

## 30. QA and acceptance system

### 30.1 Required test dimensions for every route

| Dimension | Required coverage |
|---|---|
| Data | no data, one record, typical data, large data, large amount, negative value, PEN, USD, mixed currencies |
| Request | initial loading, refresh, success, timeout, 4xx, 5xx, partial endpoint failure, stale data |
| Interaction | mouse, keyboard, touch, focus return, browser back/forward, deep link, refresh |
| Record state | active, inactive/closed where valid, overdue, partial, completed, disputed/written-off where valid |
| Viewport | 1600, 1440, 1280, 1180, 1024, 834/820, 768, 430, 390, 360, 320px |
| Theme | light, dark, system preference bootstrap |
| Text | Spanish labels, long names, long institutions, large values, 200% zoom |
| Motion | normal, reduced motion |
| Permission | ordinary user, gated/admin/developer where applicable |

### 30.2 Financial parity suite

For every visual PR:

1. Capture API fixture/response for deterministic anonymized data.
2. Capture all visible current values before the change.
3. Compare the redesigned values against the same formatter/calculation path.
4. Verify original amount, equivalent, exchange rate, sign, date, and status.
5. Verify create/edit/delete and linked-record side effects.
6. Reload and compare persisted values.
7. Verify export/import or schedule output where applicable.
8. Record any display-only grouping and prove its members reconcile to source rows.

No screenshot approval can override a financial parity failure.

### 30.3 Functional route matrix

At minimum:

- Dashboard: every tab, period/horizon, chart alternative, alert/event link, partial error.
- Portfolio: account CRUD, status, technical account, filters, views, net-worth inclusion, drawer.
- Transactions: all operations, filters, sort, pagination, saved views, bulk, import/export, detail.
- Credits: card/loan/line CRUD, cycles, schedules, statuses, attachments, original currency.
- Budgets: create/continue/edit/delete scope, series/period views, linked transactions.
- Assets: create/edit/status/delete, transaction rollback, type, attachment, detail.
- Receivables: debtor/account CRUD, card-source path, collection, recurrence, statuses, detail.
- Payables: creditor/account CRUD, payment, recurrence, statuses, detail.
- Recurring: all template types, toggle, use/prefill.
- Alerts: generation, filter, read, delete, destination link.
- Settings: every panel, save, security, export, preferences, support.
- Admin/developer: gating and every visible catalog/tool action.
- Auth/system: login, register, reset, redirect, maintenance/error recovery.

### 30.4 Visual review checklist

- Sidebar/content proportions match the approved reference.
- Manrope and DM Mono roles are correct.
- Page header aligns to the 12-column grid.
- No nested card stack is visually unnecessary.
- At most one primary action per context.
- Panels have one coherent question.
- Original currency is visually primary.
- Real/scheduled/modeled state is visible without color.
- Dark mode preserves hierarchy and does not glow.
- Dense tables remain readable and actions remain reachable.
- Mobile reflows content; it does not scale desktop.
- Skeletons match final geometry.
- Empty/error states do not resemble valid zero data.
- Logo 12 is rendered from vector assets, not a screenshot.

### 30.5 Accessibility checks

- automated accessibility scan on each changed route;
- manual keyboard traversal;
- focus visibility and order;
- screen-reader names for controls and charts;
- modal/drawer focus lifecycle;
- chart table/list alternative;
- non-color state distinction;
- 200% zoom and reflow;
- reduced-motion behavior;
- touch targets.

### 30.6 Performance checks

- no additional request duplication;
- no page-wide blocking for optional panels;
- no unbounded chart data rendering;
- no heavy new dependency without approval;
- chart calculations memoized where necessary;
- table pagination/virtualization behavior remains appropriate;
- font loading does not cause visible layout shift;
- production build and bundle comparison recorded.

Recommended non-regression targets:

- Core Web Vitals remain in the `good` threshold where measured: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1;
- route API call count does not increase without a documented reason;
- no visible action lacks working, loading, success, error, and disabled behavior;
- no chart lacks an accessible data alternative;
- no financial parity mismatch is accepted.

## 31. Risk register

| Risk | Likelihood | Impact | Mitigation | Rollback trigger |
|---|---|---|---|---|
| Global token change breaks legacy route | medium | high | aliases, foundation-only PR, all-route screenshots | unreadable/unstyled route |
| Font metrics clip dense tables/sidebar | medium | medium | Next font, measured type scale, viewport QA | overflow/action loss |
| Visual grouping changes financial meaning | medium | critical | parity suite, state taxonomy, original currency first | any value/status reinterpretation |
| Mixed currencies are aggregated | high in current debt modules | critical | separate currencies/documented rows, block hero totals | any raw PEN+USD sum |
| Dashboard overwhelms or repeats data | medium | high | hierarchy/density rules, owner 3-second test | key position/result not immediately clear |
| Too many charts slow route | medium | medium-high | existing Recharts, lazy optional panels, data limits, request audit | meaningful performance regression |
| Mobile loses actions or comparison | medium | high | purpose-built cards/sheets, action matrix | behavior inaccessible on mobile |
| Dark mode becomes neon/low contrast | medium | medium | tonal dark system and contrast audit | AA failure or hierarchy loss |
| Motion implies live financial change | low-medium | high | no count-up/pulse/loop, reduced motion | value appears to change falsely |
| Large behavior components are refactored globally | medium | high | one owning module, preserve orchestrator, separate PRs | unrelated regression |
| Legacy and new budget models are conflated | high | high | action-scope decision and explicit UI | wrong record/series mutation |
| Owner-approved style drifts during later modules | medium | high | canonical tokens, baseline screenshots, module acceptance checklist | inconsistent shell/type/panels |
| Long dual-design period creates maintenance cost | medium | medium | exact order, short-lived flags, cleanup gate | permanent duplicate system |

## 32. Data and backend opportunities explicitly deferred

These capabilities do not currently exist as trustworthy production data. They may be considered only as separate product/data projects:

1. True historical account/Portfolio balance snapshots.
2. Historical asset valuations.
3. Historical credit utilization snapshots.
4. A unified module-wide credit obligations endpoint.
5. Recurring frequency, interval, start/end, next-run, and scheduled-day fields.
6. Currency for debtor/creditor initial debt and currency-safe aggregates.
7. Server-side maturity aggregation for large receivable/payable datasets.
8. A statistically valid projection range.
9. User goals and goal progress.
10. Connected-bank state and synchronization.
11. Invoice-specific semantics.
12. Traceable insight/recommendation rules and explanations.
13. Automated market valuation, appreciation, or depreciation.
14. Predictive collection/payment probability.
15. Credit or financial-health scoring beyond current protected formulas.

Until approved and implemented, the UI must omit these claims or show a precise unavailable state. Mockup/sample data must never be converted into production derivations.

## 33. Locked decisions and decisions still requiring approval

### 33.1 Locked by the owner

- Portfolio reference language is the base for the full app.
- Logo 12 FT Ligature is the new brand direction.
- Left module sidebar remains the primary navigation structure.
- Manrope and DM Mono are the approved reference type direction.
- Teal-centered light financial surface system is the base identity.
- Dashboard is the primary visual/product focal point.
- The transformation includes financial content hierarchy, not only style.
- The app must be coherent across all modules and responsive states.

### 33.2 Implementation validation decisions

These do not change the approved direction but must be validated during the stated stage:

- final dark-theme numeric values after contrast testing;
- exact optical adjustment of FT Ligature at favicon size;
- whether compact desktop uses a 190px sidebar or collapses to the icon rail at each breakpoint;
- whether the optional sidebar balance summary meets performance and information-density goals;
- whether Dashboard deeper tabs are consolidated after the redesigned Overview proves equivalent access.

### 33.3 Product/data decisions requiring explicit owner approval

- currency semantics for debtor/creditor initial debt;
- budget grouped-series edit/delete scope;
- attachment endpoint/product strategy;
- historical account-balance storage/API;
- any new schema, RLS, auth, API contract, persistence, or calculation;
- any predictive or recommendation capability.

## 34. Definition of done for the complete transformation

The redesign is complete only when:

- FT Ligature is consistently deployed to every relevant product surface;
- approved light/dark tokens, Manrope, and DM Mono are canonical;
- authenticated shell matches the approved proportion and navigation contract;
- all listed modules use the shared page, panel, register, form, overlay, detail, state, chart, and motion systems;
- Dashboard delivers the approved executive hierarchy and certainty taxonomy;
- Portfolio contains no false historical presentation;
- every module presents original currency correctly;
- protected calculations and business behavior pass parity testing;
- all actions work or are clearly disabled;
- loading, error, empty, filtered empty, success, and partial-failure states exist;
- desktop, tablet, and mobile are intentionally designed;
- light and dark mode pass visual/accessibility review;
- WCAG 2.2 AA baseline is met;
- no critical performance regression exists;
- no mock data, invented score, invented schedule, or invented insight exists in production;
- compatibility aliases/flags are removed only after all consumers migrate;
- `QA_CHECKLIST.md` and production readiness gates pass;
- owner signs off the full application, not only the Portfolio pilot.

## 35. Standard handoff template for each implementation PR

Every future PR description should contain:

```text
Scope
- One foundation or one module.

Approved source
- FINTRACK_APPROVED_REDESIGN_BLUEPRINT.md sections used.

Files modified
- Exact list.

Behavior preserved
- Create/edit/delete/import/export/filter/sort/pagination/etc. as applicable.

Financial parity
- Values, currency, exchange rate, status, dates, linked effects checked.

States tested
- Loading, empty, filtered empty, error, partial error, success, disabled.

Responsive/theme evidence
- Desktop, tablet, mobile; light and dark screenshots.

Accessibility
- Keyboard, focus, labels, contrast, chart alternative, reduced motion.

Risks
- Module-specific risks and mitigations.

Rollback
- Exact PR/revert or feature-flag path.

Out of scope
- Explicitly list data/backend/product changes not bundled.
```

## 36. First implementation milestone

The first implementation milestone is not a screen redesign. It is a verified foundation release containing:

1. all applicable Gate A stability fixes;
2. FT Ligature assets and Brand component;
3. Manrope/DM Mono delivery;
4. semantic light/dark tokens and compatibility aliases;
5. shared controls/states/chart grammar/motion;
6. approved shell proportions and navigation;
7. no intentional change to financial logic or module behavior.

The first owner-facing module milestone is Portfolio, using current-position visuals rather than interpolated history. The second is the Dashboard, using only established contracts and the recorded/scheduled/modeled taxonomy.

## 37. Simple Spanish summary for the owner

El nuevo diseño aprobado tiene dos bases: el estilo visual del Portafolio y el logo 12, FT Ligature. La transformación se hará por capas: primero se corrigen problemas actuales que podrían mostrar datos financieros de forma equivocada; luego se implementan logo, tipografías, colores, componentes, animaciones y navegación; después se rediseña Portafolio como módulo piloto, seguido del Dashboard y finalmente cada módulo por separado.

El Dashboard mostrará primero la posición actual, el resultado del mes, el flujo de dinero y los próximos compromisos. Los gráficos usarán datos reales existentes y distinguirán claramente lo registrado, lo programado y lo proyectado. Portafolio no mostrará como historial una curva que hoy es solo una interpolación. Los montos conservarán su moneda original y no se sumarán PEN y USD sin una conversión aprobada.

El plan protege todos los cálculos, rutas, permisos, Supabase, autenticación y comportamiento actual. Cada módulo tendrá pruebas financieras, estados de carga/error/vacío, versiones desktop/tablet/móvil, modo claro/oscuro, accesibilidad y una forma de volver atrás sin afectar los demás módulos.
