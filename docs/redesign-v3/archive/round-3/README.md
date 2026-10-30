# FinTrack V3 — Round03 Refinement Review

**Refinement ready for owner review, not production implementation.** This round preserves the teal/green identity, FT Ligature Concept12, navigation and connected-dashboard architecture. All records are synthetic, fixed at September21,2026.

The [master plan](../../FINTRACK_REDESIGN_V3_MASTER_PLAN.md) is the source of truth. The updated [Sol handoff](../../FINTRACK_REDESIGN_V3_SOL_HANDOFF.md) specifies integration phases, files, lifecycle, tests and stop conditions. Neither document authorizes production changes by itself.

## Open and try the result

- [Interactive product preview](http://127.0.0.1:4173/#dashboard)
- [Motion and surfaces workshop](http://127.0.0.1:4173/motion.html): real speed, slow inspection, reduced motion, light/dark and interactive scenes.
- [FT Ligature identity board](http://127.0.0.1:4173/brand.html): preserved identity, not another logo exploration.
- Local entries: [product HTML](preview/index.html), [motion workshop](preview/motion.html).

Start the isolated server from repository root if it is not already running:

```sh
node docs/redesign-v3/preview/serve.mjs
```

Only127.0.0.1:4173 and the preview directory are served. Next.js, app environment, credentials, financial APIs, authentication and Supabase are not loaded. CSP denies connections and form submissions; fonts/assets are local. The workshop's same-origin iframe requires this HTTP server. The28px review toolbar, workshop and loading-resolution control are not product UI.

## Before → after → why

| Before — round02 | After — round03 | Why |
|---|---|---|
| Correct but plain paired bars | Solid/outlined flow, selected-month lens, difference bracket, exact tooltip and pinned result readout | More expressive financial reading without a decorative new chart |
| Small category tracks with less consistent shares | Ordered ranking, exact amount/share, inlaid track and clear hover/touch enclosure | Scan contribution and act on the underlying records |
| Incidental radii and square edge drawers | Shared6/10/14/18/24px surface roles, optical inset/mobile exceptions | One coherent formal language |
|520px detail jumps to580px edit | Stable580px detached workbench | Preserve context and reduce spatial disruption |
| Generic fact panel | Source, amount, relationship, Detail/Context tabs, visible-order navigation, guarded back/edit | More useful work, not extra filler |
| Generic or immediate overlay transitions | Coordinated frame/content/veil, trigger-origin menus, interruptible exits | Motion conveys hierarchy and remains responsive |
| Static design review | Live motion workshop and33 dedicated checks | Evaluate behavior rather than a written promise |

Retained: all real financial concepts, original currency, exact cents, current-month versus position scope, existing8 operations, dark mode, main region order, recent records and tablet composition. No forecasts, AI advice, new metrics or backend dependencies were added. This round deliberately does not restart product direction.

## Suggested review sequence

1. Inicio: hover/focus a month; click to pin; move away; use arrows/Enter/Escape. Inspect August while September summary stays unchanged.
2. Switch category type, inspect exact amount/share, then open category records. Open result explanation and the full agenda.
3. Use the split action's operation menu. Inspect the period-scope popover; it is not a misleading global date filter.
4. Open Supermercado: Detail → Financial context → Edit → Back. Change a value first to test explicit discard/keep editing.
5. Inspect previous/next records, More → Delete confirmation, light/dark and mobile rounded workbench.
6. Open the motion workshop. Compare real speed and slow inspection; enable reduced motion. Keyboard-driven interactions are immediate.
7. Choose Loading, then “Simular carga completada.” This review-only control demonstrates a geometry-preserving transition; no values count up.
8. Review Cuentas, Presupuestos, Créditos, Movimientos, filters, partial error and first use. These retain the prior product structure with the common surface system.

## Current capture gallery

Full-page captures show complete composition. Viewport captures show actual overlay/fixed-navigation behavior.

| Capture | Purpose |
|---|---|
| [01 Desktop light](screenshots/01-dashboard-desktop-light.png) |1440×1080; refined flow/ranking and composition |
| [02 Tablet portrait](screenshots/02-dashboard-tablet-light.png) |834×1112; full report and paired working regions |
| [03 Mobile light](screenshots/03-dashboard-mobile-light.png) |390×844; complete responsive order |
| [04 Movements](screenshots/04-transactions-desktop-light.png) | Dense register, original signed amounts |
| [05 Detail workbench](screenshots/05-transaction-detail-drawer.png) |580px rounded contextual surface |
| [06 Edit form](screenshots/06-transaction-edit-form.png) | Same580px frame, back-to-record and amount-first form |
| [07 Accounts](screenshots/07-accounts-desktop-light.png) | Native currencies and account register |
| [08 Budgets](screenshots/08-budgets-desktop-light.png) | Period and excess interpretation |
| [09 Credits](screenshots/09-credits-desktop-light.png) | Native card debt, loan and line remain distinct |
| [10 Desktop dark](screenshots/10-dashboard-desktop-dark.png) | Complete dark hierarchy |
| [11 Movements dark](screenshots/11-transactions-dark.png) | Dark dense register |
| [12 Partial error](screenshots/12-dashboard-partial-error.png) | Healthy neighbors retained |
| [13 First use](screenshots/13-first-use-mobile.png) | Account-first empty state |
| [14 Mobile movements](screenshots/14-transactions-mobile.png) | Table-to-record adaptation |
| [15 Mobile form](screenshots/15-mobile-create-form.png) |8px gutters,24px corners, safe footer |
| [16 Mobile dark](screenshots/16-dashboard-mobile-dark.png) | Same meaning in dark mode |
| [17 Loading](screenshots/17-loading-desktop.png) | Geometry preserved; no false zero values |
| [18 Obligation warning](screenshots/18-obligations-currency-warning.png) | Unknown opening currency stays outside trusted totals |
| [19 Mobile first viewport](screenshots/19-dashboard-mobile-viewport.png) | Actual390×844 first view |
| [20 Mobile scrolled](screenshots/20-dashboard-mobile-scrolled.png) | Fixed navigation and lower regions |
| [21 FT system](screenshots/21-ft-ligature-system.png) | Preserved Concept12 applications |
| [22 Result explanation](screenshots/22-result-explanation.png) | Exact equation, scope and categories |
| [23 Category → records](screenshots/23-category-to-records.png) | Scoped, removable filter |
| [24 Expanded mobile analysis](screenshots/24-mobile-analysis-expanded.png) |3-month plot,6-month table access, ranking |
| [25 Complete agenda](screenshots/25-thirty-day-agenda.png) | Six dated commitments, native currency |
| [26 Tablet landscape](screenshots/26-dashboard-tablet-landscape.png) |1024×768 |
| [27 Filter workbench](screenshots/27-filter-drawer.png) | Shared frame, draft/apply behavior |
| [28 Account peek](screenshots/28-account-peek.png) | Original-currency drilldown |
| [29 Chart inspection](screenshots/29-flow-inspection-tooltip.png) | Exact tooltip and chart-local reading |
| [30 Anchored operation menu](screenshots/30-anchored-operation-menu.png) | All8 operations from their invoking control |
| [31 Financial context](screenshots/31-contextual-record-workbench.png) | Meaning of the record, not invented advice |
| [32 Confirmation](screenshots/32-rounded-delete-confirmation.png) | Rounded, focused destructive decision |
| [33 Dark workbench](screenshots/33-dark-record-workbench.png) | Depth/surface hierarchy in dark |
| [34 Mobile workbench](screenshots/34-mobile-record-workbench.png) | Read/context/actions with44px controls |
| [35 Motion workshop](screenshots/35-motion-review-workshop.png) | Live review controls; open HTML to assess animation |

## Compare without losing the predecessor

The full immediate predecessor is preserved in [archive/round-2/](archive/round-2/), including master, handoff, prototype and28 captures. Compare [round02 dashboard](archive/round-2/screenshots/01-dashboard-desktop-light.png) and [round02 drawer](archive/round-2/screenshots/05-transaction-detail-drawer.png) with current01/05. The earlier blue concept remains in [archive/round-1/](archive/round-1/).

Archives are evidence, not alternate implementation specifications. Do not mix their obsolete geometry/tokens into the current handoff.

## Verification, limits and risk

[QA_REPORT.md](QA_REPORT.md) records **89 general +33 motion/refinement checks**,35 captures,0 browser errors/attempted external requests, and117 existing financial unit tests passed. Reports: [verification.json](screenshots/verification.json), [motion-verification.json](screenshots/motion-verification.json).

Saving is a simulation, not persistence. Some secondary actions explain scope instead of pretending to have a backend. Global functions, simplified validators, name-based fixture lookup, hidden-fixture skeleton geometry and render-all state handling must not be copied into production. Actual fields, validators, routes, source availability, financial links and API contracts prevail. Real browser/device/screen-reader and authenticated financial E2E remain implementation obligations; this is not accessibility or release certification.

The implementation risks are overlay lifecycle/focus/dirty continuity, source-context truthfulness and responsive density. No new structural package was introduced. Existing S01–S06 and O01–O12 remain independently gated, including read-triggered legacy obligation repair. No real API was called to render this proposal.

## Files, approval and rollback

Changed in round03: master, handoff, current preview entry/dashboard bootstrap/verifier, new refinement CSS/JS and motion workshop/verifier, README/QA and current captures. Added the round02 archive. PRODUCT and production source were not changed in this round; tracked production diff is empty. No commit, push or deployment.

Approve the refinement's visual/interaction behavior, then authorize Sol's scoped implementation phases. Approval to implement is not approval to deploy or migrate data.

Rollback is a reviewed restoration of proposal files from round02. Do not reset the repository or touch unrelated work; no database rollback is needed.
