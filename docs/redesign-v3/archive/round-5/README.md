# FinTrack V3 — Round05 Refinement Review

**Refinement ready for owner review, not production implementation.** This round preserves the teal/green identity, FT Ligature Concept12, route hierarchy and connected-dashboard architecture. It refines neutral light material, controlled teal accents, natural credit presentation, searchable selection and contextual action feedback. All records are synthetic, fixed at September21,2026.

The [master plan](../../FINTRACK_REDESIGN_V3_MASTER_PLAN.md) is the source of truth. The updated [Sol handoff](../../FINTRACK_REDESIGN_V3_SOL_HANDOFF.md) specifies integration phases, files, lifecycle, tests and stop conditions. Neither document authorizes production changes by itself.

## Open and try the result

- [Interactive product preview](http://127.0.0.1:4173/#dashboard)
- [Action demonstration](http://127.0.0.1:4173/#admin): create/edit/activate/deactivate/delete independent local categories; no financial data is changed.
- [Motion and surfaces workshop](http://127.0.0.1:4173/motion.html): real speed, slow inspection, reduced motion, light/dark and interactive scenes.
- [FT Ligature identity board](http://127.0.0.1:4173/brand.html): preserved identity, not another logo exploration.
- Local entries: [product HTML](preview/index.html), [motion workshop](preview/motion.html).

Start the isolated server from repository root if it is not already running:

```sh
node docs/redesign-v3/preview/serve.mjs
```

Only127.0.0.1:4173 and the preview directory are served. Next.js, app environment, credentials, financial APIs, authentication and Supabase are not loaded. CSP denies connections and form submissions; fonts/assets are local. The workshop's same-origin iframe requires this HTTP server. The28px review toolbar, workshop and loading-resolution control are not product UI.

## Before → after → why

| Before (round04) | After (round05) | Why |
|---|---|---|
| Green-tinted surfaces, borders and text | White and cool-neutral gray, graphite type, restrained deep teal | Brand accents regain purpose; less pervasive color |
| Credit scale selector2/12/40 | All products, normal search/type/status/page controls | Review actual available products, not a demonstration mode |
| Different short/long selection controls | Same searchable selection pattern with context, keyboard and explicit commit | No interaction switch when a list grows |
| Save closes into a toast | Pending control, contextual confirmation and updated local row | Result is visible where the user works |
| Most mutations only explained | Independent in-memory catalog with true create/edit/state/delete, restrictions and failures | Approve interaction by using it |
| Extended credit fixture disconnected from Inicio | Twelve-product fixture,2 featured credits,5/11 registered agenda items | Consistent scope across the preview |

Retained: all real financial concepts, original currency, exact cents, current-month versus position scope, existing8 operations, dark mode, main region order, recent records and tablet composition. No forecasts, AI advice, new metrics or backend dependencies were added. This round deliberately does not restart product direction.

## Suggested review sequence

1. Compare [Inicio light](http://127.0.0.1:4173/#dashboard) and [graphite dark](http://127.0.0.1:4173/?theme=dark#dashboard). Most surfaces are neutral; brand/action/financial semantics retain color.
2. Open [Créditos](http://127.0.0.1:4173/#credits):12 products across two pages, closed state visible, search, type and searchable status. No scale simulator. Inspect the selected loan and its exact installment.
3. Register an expense, open Categoría and type `educacion`. Try no results, arrows/Enter, Escape, account metadata and currency. Searching never commits a field value.
4. Submit a financial form: the scoped receipt explicitly says figures remain fixed. It does not pretend to persist financial data.
5. Open [Catálogos / action demonstration](http://127.0.0.1:4173/#admin). Create a category, edit it, deactivate/activate it, then delete it. Watch the row, focus and local receipt. Try deleting Educación continua (linked) and inspect Ajustes del sistema (protected).
6. Set `Respuesta de prueba` in the review bar to Error or Sin confirmar before submitting a category. Confirm draft retention and blocked repeat when the result is unknown. This is harness behavior, never a production feature.
7. Open workshop scenes09/10 for selectors and actions; repeat with reduced motion and at mobile/tablet widths. Physical touch/keyboard/assistive-tech validation remains an implementation gate.
8. Recheck preserved sidebar/logo collapse, quick Registrar, dense signed ledger, charts, budgets, partial-error and loading states.

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
| [25 Complete agenda](screenshots/25-thirty-day-agenda.png) | Eleven dated commitments, native currency |
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

| [36 Scalable credits](screenshots/36-credits-scalable-register.png) |Natural12-product scope, compact register and pagination |
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

| [47 Natural credits](screenshots/47-credits-neutral-all-products.png) | All products, neutral material, no scale control |
| [48 Category combobox](screenshots/48-searchable-category-select.png) | Search/selection, bounded19-option list |
| [49 No search matches](screenshots/49-select-no-results.png) | Helpful empty state without inventing a new category |
| [50 Contextual save receipt](screenshots/50-contextual-save-receipt.png) | Exact input and explicit simulation scope |
| [51 Created record](screenshots/51-created-row-and-receipt.png) | Updated list, local receipt and focus |
| [52 Deactivated record](screenshots/52-deactivated-context.png) | Historical row retained |
| [53 Linked deletion blocked](screenshots/53-linked-deletion-blocked.png) | Guarded action with useful alternative |
| [54 Rejected save](screenshots/54-action-error-preserves-draft.png) | Inline error, draft retained |
| [55 Unknown result](screenshots/55-unknown-write-result.png) | No blind resubmission |
| [56 Dark selection](screenshots/56-select-graphite-dark.png) | Neutral layered graphite |
| [57 Mobile selection](screenshots/57-mobile-searchable-select.png) | Searchable selection surface,48px options |
| [58 Mobile catalog](screenshots/58-mobile-action-register.png) | Compact category rows and actions |
| [59 Mobile confirmation](screenshots/59-mobile-save-feedback.png) | Record-level feedback in the working context |

## Compare without losing the predecessor

The complete immediate predecessor is preserved in [archive/round-4/](archive/round-4/), including master, handoff, prototype, QA and46 captures. Compare [previous Inicio](archive/round-4/screenshots/01-dashboard-desktop-light.png), [previous Credits](archive/round-4/screenshots/36-credits-scalable-register.png), and [previous form](archive/round-4/screenshots/06-transaction-edit-form.png). Earlier rounds1–3 remain intact.

Archives are evidence, not alternate implementation specifications. Do not mix their obsolete geometry/tokens into the current handoff.

## Verification, limits and risk

[QA_REPORT.md](QA_REPORT.md) records **89 general +33 motion/refinement +60 shell/register +51 round05 checks**,59 captures,0 browser errors/attempted external requests, and117 existing financial unit tests passed. Reports: [verification.json](screenshots/verification.json), [motion-verification.json](screenshots/motion-verification.json), [evolution-verification.json](screenshots/evolution-verification.json), [precision-verification.json](screenshots/precision-verification.json).

Financial saving is a simulation, not persistence. Only desktop navigation preference persists locally; no financial record is stored. There is no visible scale selector;2/40 stress datasets are internal QA hooks. The default12-product scope is coherent with Inicio and its registered agenda. Category records mutate only in a separate in-memory action demonstration and reset on reload. Some secondary actions explain scope instead of pretending to have a backend. Global functions, simplified validators, name-based fixture lookup, hidden-fixture skeleton geometry and render-all state handling must not be copied into production. Actual fields, validators, routes, source availability, financial links and API contracts prevail. Real browser/device/screen-reader and authenticated financial E2E remain implementation obligations; this is not accessibility or release certification.

The implementation risks are overlay lifecycle/focus/dirty continuity, source-context truthfulness and responsive density. No new structural package was introduced. Existing S01–S06 and O01–O12 remain independently gated, including read-triggered legacy obligation repair. No real API was called to render this proposal.

## Files, approval and rollback

Changed in round05: master, handoff, preview index/tokens/bootstrap/credit presentation/agenda fixtures, new precision CSS/JS/verifier, extended motion workshop, updated regression assertions, README/QA and59 captures. Added a complete round04 archive. PRODUCT and production source were not modified. No commit, push or deployment.

Approve the refinement's visual/interaction behavior, then authorize Sol's scoped implementation phases. Approval to implement is not approval to deploy or migrate data.

Rollback is a reviewed restoration of proposal files from round04. Do not reset the repository or touch unrelated work; no database rollback is needed.
