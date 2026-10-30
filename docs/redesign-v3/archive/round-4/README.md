# FinTrack V3 — Round04 Refinement Review

**Refinement ready for owner review, not production implementation.** This round preserves the teal/green identity, FT Ligature Concept12, route hierarchy and connected-dashboard architecture. It refines credit scale, movement density, neutral dark surfaces, shell behavior and quick creation. All records are synthetic, fixed at September21,2026.

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

| Before — round03 | After — round04 | Why |
|---|---|---|
| Two large credit product cards | Compact register, search/type/status filters, pagination and selected-product workbench | Efficient with2,12 or40 records |
| Large side note in Budgets | Exception band above full-width table | More room for financial comparison |
| Green dark surfaces | Neutral charcoal/graphite with teal accents | Premium dark without losing FinTrack |
| Taller two-line ledger rows, expense neutral |48–49px desktop rows; green income/red expense/neutral transfer | More visible records and clearer direction |
| Breakpoint-dependent rail | Persistent208↔68 desktop control and modal tablet labels | Adapt workspace while keeping FT stationary |
| Instant module replacement | Three-level pointer reveal, total228ms; keyboard/reduced immediate | Context change is legible without waiting |
| Center mobile Registrar and page actions | Persistent bottom-right Registrar with reserved mobile dock slot | Accessible after scrolling, never over mobile amounts |
| Loan mislabeled remaining principal in preview | Original principal, remaining unavailable | Correct meaning, no calculation change |

Retained: all real financial concepts, original currency, exact cents, current-month versus position scope, existing8 operations, dark mode, main region order, recent records and tablet composition. No forecasts, AI advice, new metrics or backend dependencies were added. This round deliberately does not restart product direction.

## Suggested review sequence

1. Open [Créditos](http://127.0.0.1:4173/#credits). The default12-product sample is explicitly separate from Inicio. Change sample to2 and40; filter loans/lines/closed, search, paginate.
2. Inspect Préstamo personal, then its recorded installment. Confirm original capital10,800 and installment680 with500/150/20/10 components; no inferred remaining principal.
3. Collapse/expand via the control before the breadcrumb. FT stays in place; desktop preference survives reload. At834px, expansion shows labels over the workspace; Escape closes.
4. Open Movimientos, compare all three amount directions and density. Open/edit a row; the workbench and dirty-dismiss protection remain.
5. Toggle dark in the review bar; inspect Inicio and ledger. The canvas is graphite, teal remains purposeful.
6. Navigate modules, repeat by keyboard/reduced motion. Use workshop scenes06–08 for shell, module transition and quick action.
7. Open bottom-right Registrar. Try expense, income and transfer; inspect contextual create in Cuentas/Presupuestos/Créditos. On mobile it occupies its own dock slot.
8. Recheck preserved flow tooltip/pinning, result→category→records,7/30-day agenda, budget exception, load/error/empty and rounded forms.


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

| [36 Scalable credits](screenshots/36-credits-scalable-register.png) |12-product isolated scope, compact register and pagination |
| [37 Loan workbench](screenshots/37-loan-contextual-workbench.png) | Selected loan, original principal, installment components |
| [38 Compact shell](screenshots/38-sidebar-compact-identity.png) |68px rail, stationary FT and active destination |
| [39 Graphite Inicio](screenshots/39-dashboard-graphite-dark.png) | Neutral dark, preserved composition |
| [40 Dense dark ledger](screenshots/40-dense-ledger-graphite.png) | Direction colors and48–49px rows |
| [41 Contextual Registrar](screenshots/41-contextual-quick-actions.png) |8 operations + module action |
| [42 Tablet credits](screenshots/42-credits-tablet.png) | Working register beside rail |
| [43 Expanded tablet nav](screenshots/43-tablet-navigation-expanded.png) | Modal labels, no narrowing |
| [44 Mobile credits](screenshots/44-credits-mobile.png) | Rich rows, filters and pagination |
| [45 Mobile Registrar](screenshots/45-mobile-quick-actions.png) | Menu above reserved right-hand dock slot |
| [46 Mobile ledger](screenshots/46-mobile-ledger-dense.png) | Dense signed amounts, unobstructed reading |

## Compare without losing the predecessor

The complete immediate predecessor is preserved in [archive/round-3/](archive/round-3/), including master, handoff, prototype, QA and35 captures. Compare [previous Credits](archive/round-3/screenshots/09-credits-desktop-light.png), [previous dark mode](archive/round-3/screenshots/11-transactions-dark.png) and [previous mobile ledger](archive/round-3/screenshots/14-transactions-mobile.png). Earlier rounds1/2 remain intact.

Archives are evidence, not alternate implementation specifications. Do not mix their obsolete geometry/tokens into the current handoff.

## Verification, limits and risk

[QA_REPORT.md](QA_REPORT.md) records **89 general +33 motion/refinement +60 round04 checks**,46 captures,0 browser errors/attempted external requests, and117 existing financial unit tests passed. Reports: [verification.json](screenshots/verification.json), [motion-verification.json](screenshots/motion-verification.json), [evolution-verification.json](screenshots/evolution-verification.json).

Financial saving is a simulation, not persistence. Only desktop navigation preference persists locally; no financial record is stored. The2/12/40 credit selector is review-only and does not change Inicio totals. Some secondary actions explain scope instead of pretending to have a backend. Global functions, simplified validators, name-based fixture lookup, hidden-fixture skeleton geometry and render-all state handling must not be copied into production. Actual fields, validators, routes, source availability, financial links and API contracts prevail. Real browser/device/screen-reader and authenticated financial E2E remain implementation obligations; this is not accessibility or release certification.

The implementation risks are overlay lifecycle/focus/dirty continuity, source-context truthfulness and responsive density. No new structural package was introduced. Existing S01–S06 and O01–O12 remain independently gated, including read-triggered legacy obligation repair. No real API was called to render this proposal.

## Files, approval and rollback

Changed in round04: master, handoff, preview index/dark tokens/bootstrap, new evolution CSS/JS/verifier, motion workshop scenes, README/QA and refreshed46 captures. Added a complete round03 archive. PRODUCT and production source were not modified. No commit, push or deployment.

Approve the refinement's visual/interaction behavior, then authorize Sol's scoped implementation phases. Approval to implement is not approval to deploy or migrate data.

Rollback is a reviewed restoration of proposal files from round03. Do not reset the repository or touch unrelated work; no database rollback is needed.
