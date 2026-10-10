# FinTrack V3 — Round07 Feedback Refinement

**Ready for owner design review, not production implementation.** This round preserves identity, palette, shell, dashboard and round06 actions. It moves acknowledgements to the upper right, refines entry/exit and adds a synchronized, pausable lifetime indicator. All data is synthetic, as of September21,2026.

The [master plan](../../FINTRACK_REDESIGN_V3_MASTER_PLAN.md) is the source of truth. The updated [Sol handoff](../../FINTRACK_REDESIGN_V3_SOL_HANDOFF.md) specifies integration phases, files, lifecycle, tests and stop conditions. Neither document authorizes production changes by itself.

## Open and try the result

- [Interactive product preview](http://127.0.0.1:4173/#dashboard)
- [Action demonstration](http://127.0.0.1:4173/#admin): create/edit/delete categories; activate/deactivate in Entidades. Brief confirmations, error/unknown and burst review. No financial data changes.
- [Motion and surfaces workshop](http://127.0.0.1:4173/motion.html): real speed, slow inspection, reduced motion, light/dark and interactive scenes.
- [FT Ligature identity board](http://127.0.0.1:4173/brand.html): preserved identity, not another logo exploration.
- Local entries: [product HTML](preview/index.html), [motion workshop](preview/motion.html).

Start the isolated server from repository root if it is not already running:

```sh
node docs/redesign-v3/preview/serve.mjs
```

Only127.0.0.1:4173 and the preview directory are served. Next.js, app environment, credentials, financial APIs, authentication and Supabase are not loaded. CSP denies connections and form submissions; fonts/assets are local. The workshop's same-origin iframe requires this HTTP server. The28px review toolbar, workshop and loading-resolution control are not product UI.

## This round: before → after → why

| Before (round06) | After (round07) | Why |
|---|---|---|
| Bottom-centered420px feedback | Upper-right388px surface below module actions | Near working context, leaving Create and Registrar accessible |
| No remaining-time cue | Thin2px lifetime rule + approximate seconds | Predictable self-dismissal |
| Lower-origin transition |230ms upper-right settle,150ms retreat | Placement and movement share an origin |
| Pauses were invisible | Frozen line and `En pausa` on hover/focus | Clear response without racing a countdown |
| Reduced motion had no time cue | Discrete `Cierra en N s`, no moving line | Same information without continuous animation |

Try Catálogos create/edit/delete, Entidades activate/deactivate, then the marked success/error/warning/burst controls. Workshop scene10 plays an example immediately; slow mode affects transitions, not real lifetime. No generic Undo was invented.

### Retained round06 operational corrections

| Before (round05) | After (round06) | Why |
|---|---|---|
| Large success screen inside drawer | Form closes; small animated acknowledgement disappears by itself | Continue working without an extra step |
| Persistent success band | Updated record +4200ms acknowledgement | Keep confirmation light; preserve real evidence in the list |
| Missing or inconsistent record actions | Visible Edit/Use/Collect/Pay as appropriate + consistent More | Clear operation without a generic menu for every module |
| Category state action in previous demo | Categories edit/delete; Entidades state demo | Follows actual source capabilities |
| Rapid messages overwrite each other |2 visible desktop/1 mobile + FIFO + pause on hover/focus | No lost error and no focus theft |
| Ambiguous asset deactivation | Explicit sold state, without implying sale proceeds | Faithful financial meaning |

Retained: all real financial concepts, original currency, exact cents, current-month versus position scope, existing8 operations, dark mode, main region order, recent records and tablet composition. No forecasts, AI advice, new metrics or backend dependencies were added. This round deliberately does not restart product direction.

## Suggested review sequence

1. Compare [Inicio light](http://127.0.0.1:4173/#dashboard) and [graphite dark](http://127.0.0.1:4173/?theme=dark#dashboard). Most surfaces are neutral; brand/action/financial semantics retain color.
2. Open [Créditos](http://127.0.0.1:4173/#credits):12 products across two pages, closed state visible, search, type and searchable status. No scale simulator. Inspect the selected loan and its exact installment.
3. Register an expense, open Categoría and type `educacion`. Try no results, arrows/Enter, Escape, account metadata and currency. Searching never commits a field value.
4. Submit a financial form: it closes and a compact acknowledgement appears at the upper right with a shrinking lifetime line. Hover/focus freezes line and dismissal. No result screen or persistent strip. Figures remain fixed.
5. Open [Catálogos](http://127.0.0.1:4173/#admin): create/edit/delete a category; Entidades → deactivate/activate. Hover/focus pauses the confirmation. Try linked Educación continua and protected Ajustes del sistema. The marked review controls demonstrate success/error/warning and bursts.
6. Set `Respuesta de prueba` in the review bar to Error or Sin confirmar before submitting a category. Confirm draft retention and blocked repeat when the result is unknown. This is harness behavior, never a production feature.
7. Open workshop scenes09/10 for selectors and actions; repeat with reduced motion and at mobile/tablet widths. Physical touch/keyboard/assistive-tech validation remains an implementation gate.
8. Inspect header, row and detail actions in Movimientos, Cuentas, Presupuestos, Créditos, Por cobrar, Por pagar, Activos, Plantillas and Avisos. Try selected-row deletion in Movimientos. Recheck sidebar/logo, quick Registrar and retained charts.

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
| [50 Brief save confirmation](screenshots/50-contextual-save-receipt.png) | Exact input, no result screen, explicit simulation |
| [51 Created record](screenshots/51-created-row-and-receipt.png) | Updated list, transient acknowledgement, restored focus |
| [52 Entity deactivated](screenshots/52-deactivated-context.png) | Supported entity state; no category activation |
| [53 Linked deletion blocked](screenshots/53-linked-deletion-blocked.png) | Guarded action; no unsupported deactivate alternative |
| [54 Rejected save](screenshots/54-action-error-preserves-draft.png) | Inline error, draft retained |
| [55 Unknown result](screenshots/55-unknown-write-result.png) | No blind resubmission |
| [56 Dark selection](screenshots/56-select-graphite-dark.png) | Neutral layered graphite |
| [57 Mobile selection](screenshots/57-mobile-searchable-select.png) | Searchable selection surface,48px options |
| [58 Mobile catalog](screenshots/58-mobile-action-register.png) | Compact category rows and actions |
| [59 Mobile confirmation](screenshots/59-mobile-save-feedback.png) | Record-level feedback in the working context |

| [60 Created category](screenshots/60-create-ephemeral-feedback.png) | Brief acknowledgement integrated with register |
| [61 Deleted category](screenshots/61-delete-ephemeral-feedback.png) | Real local row removal, no false undo |
| [62 State update](screenshots/62-entity-state-confirmation.png) | Entidades supported state action |
| [63 Rapid operations](screenshots/63-feedback-burst.png) | Two visible, remaining queued |
| [64 Saved movement](screenshots/64-movement-save-feedback.png) | Close form and return to work |
| [65 Movements actions](screenshots/65-actions-transactions.png) | Direct Edit and More,48px desktop rows |
| [65 Credit actions](screenshots/65-actions-credits.png) | Compact scalable action column |
| [65 Receivables actions](screenshots/65-actions-receivables.png) | Person management distinct from obligation/collection |
| [66 Error](screenshots/66-error-inline-and-transient.png) | Transient notice + persistent inline cause |
| [67 Mobile dark feedback](screenshots/67-mobile-feedback-dark.png) | One notice above dock |
| [68 Tablet dark actions](screenshots/68-tablet-credit-actions-dark.png) |44px More menu, no hidden actions column |
| [69 State confirmation](screenshots/69-mobile-destructive-context.png) | Explicit sold state before action |

## Current round07 close-ups

| Capture | Purpose |
|---|---|
| [70 Upper-right light](screenshots/70-feedback-top-right-light.png) | Working-context position and live lifetime line |
| [71 Paused](screenshots/71-feedback-paused.png) | Frozen timer and visible pause |
| [72 Warning dark](screenshots/72-feedback-warning-dark-ready.png) | Graphite surface, amber state |
| [73 Mobile dark](screenshots/73-feedback-mobile-dark.png) | Upper placement, primary action accessible |
| [74 Tablet dark](screenshots/74-feedback-tablet-dark.png) | Trailing alignment and controlled density |
| [75 Error in workbench](screenshots/75-feedback-error-workbench.png) | Header/footer protected, draft and inline cause retained |
| [76 Reduced motion](screenshots/76-feedback-reduced-motion.png) | Textual lifetime without moving line |

## Compare without losing the predecessor

The complete previous version is in [archive/round-6/](archive/round-6/), including master, handoff, preview, QA and71 captures. Compare its [bottom feedback](archive/round-6/screenshots/60-create-ephemeral-feedback.png) with current capture60 or70. Earlier rounds1–5 remain intact.

Archives are evidence, not alternate implementation specifications. Do not mix their obsolete geometry/tokens into the current handoff.

## Verification, limits and risk

[QA_REPORT.md](QA_REPORT.md): **356 prototype assertions passed** (89 general +33 motion +60 shell/register +51 selection +79 actions +44 feedback-placement/timing),78 captures,0 browser exceptions/external requests,117 existing unit tests passed. Reports: [general](screenshots/verification.json), [motion](screenshots/motion-verification.json), [shell](screenshots/evolution-verification.json), [selection](screenshots/precision-verification.json), [actions](screenshots/actions-verification.json), [feedback](screenshots/feedback-verification.json).

Financial saving is a simulation, not persistence. Only desktop navigation preference persists locally; no financial record is stored. There is no visible scale selector;2/40 stress datasets are internal QA hooks. The default12-product scope is coherent with Inicio and its registered agenda. Category records mutate only in a separate in-memory action demonstration and reset on reload. Some secondary actions explain scope instead of pretending to have a backend. Global functions, simplified validators, name-based fixture lookup, hidden-fixture skeleton geometry and render-all state handling must not be copied into production. Actual fields, validators, routes, source availability, financial links and API contracts prevail. Real browser/device/screen-reader and authenticated financial E2E remain implementation obligations; this is not accessibility or release certification.

The implementation risks are overlay lifecycle/focus/dirty continuity, source-context truthfulness and responsive density. No new structural package was introduced. Existing S01–S06 and O01–O12 remain independently gated, including read-triggered legacy obligation repair. No real API was called to render this proposal.

## Files, approval and rollback

Changed this round: root master/handoff; preview actions CSS/JS, narrow feedback-animation ownership exclusion in refinement.js, review version labels and workshop scene10; test settle helpers and new feedback verifier; README/QA and78 captures/6 reports. Complete round06 archive added first. PRODUCT and production source were not modified. No commit, push or deployment.

Approve the refinement's visual/interaction behavior, then authorize Sol's scoped implementation phases. Approval to implement is not approval to deploy or migrate data.

Rollback is a reviewed restoration of proposal files from round06. Do not reset the repository or touch unrelated work; no database rollback is needed.
