# FinTrack V3 — Round 02 Design Review

**Refined direction recommended for approval, not production implementation.** All records, names, balances and dates are synthetic, fixed at September 21, 2026.

The [master plan](../../FINTRACK_REDESIGN_V3_MASTER_PLAN.md) remains the product/design source of truth. The new [Sol handoff](../../FINTRACK_REDESIGN_V3_SOL_HANDOFF.md) translates it into operational phases, existing files, tests and stop conditions. [PRODUCT.md](../../PRODUCT.md) records strategic context without duplicating visual decisions.

## Open the refined product

[Open the interactive preview](http://127.0.0.1:4173/#dashboard) and [FT Ligature identity board](http://127.0.0.1:4173/brand.html) while the local server is running. To start it from the repository root:

```sh
node docs/redesign-v3/preview/serve.mjs
```

The server binds only to127.0.0.1:4173 and serves only the preview directory. It does not start Next.js, import app configuration, read credentials, call financial APIs or connect to Supabase. CSP blocks network connections/form submissions. Fonts and SVG assets are local. Control-C stops the server.

The [local HTML entry](preview/index.html) also works with its sibling files. HTTP is the automated verification mode. The28px review bar and its theme/state controls are not production UI.

## What changed, and why

| First V3 | Round 02 | Product gain |
|---|---|---|
| Blue action color and generic F | Refined teal/green/neutrals and Concept12 FT Ligature | Recognizable FinTrack identity; gold used deliberately |
| Sparse position-led overview | Current balances plus documented pending, connected monthly report and operational context | More financial understanding without a wall of equal KPIs |
| Separate plot and spending panel | One report with exact totals, flow and income/expense category ranking | Explanation stays beside the numbers |
| No recent records on Inicio | Five latest movements, source account and exact original amount | Verify or correct recent work immediately |
| Result as a summary figure | Result explanation → category → filtered records → detail/edit | Natural investigation rather than dashboard dead ends |
| Three shallow commitments |7/30-day scope, four desktop/two mobile rows, complete interval drawer | Clearer next actions with original currencies and source identity |
| Tablet mostly stacked | Full report, paired agenda/budgets, full recent register, credit strip | Uses tablet width purposefully |
|64px rows and oversized chrome |56px rows,208px sidebar,56px topbar, independent desktop columns | Controlled density and less wasted space |

Retained: native-currency honesty, clean hierarchy, Manrope, contextual drawers, progressive forms, meaningful dark mode, no fabricated health/wealth/forecast claims. Reference-image lessons were hierarchy, density and overview-detail relationships—not its Sankey, goals, AI tips, projections or bank sync.

## Suggested review sequence

1. Inicio desktop: identify balances versus pending, read the current-month result, scan upcoming dates and budget excess.
2. Click the result, then Alimentación. The ledger shows the exact two category records; remove its chip without losing the expense type.
3. Return to Inicio: switch income/expense category ranking, inspect chart data, change7/30-day agenda, open the USD commitment.
4. Open the account-count peek; inspect Cuentas, Presupuestos and Créditos. Loan principal, native card debt and line equivalent are distinct.
5. Inspect tablet834/1024 and mobile390. Mobile keeps exact monthly facts visible, reveals analytical charts on request and offers the full agenda beyond its two-row summary.
6. Try Movimientos search, USD filter/no-results, detail→edit, dirty close protection and simulated save. No real or durable records change.
7. Switch light/dark and loading/partial-error/first-use in the review bar.
8. Open the identity board: Concept12 at actual small sizes, mono, sidebar, dark and app icon.

## Capture index

Full-page captures show complete composition; mobile viewport captures19–20 show fixed-navigation behavior at the actual screen size.

| Capture | Size / purpose |
|---|---|
| [01 — Desktop light](screenshots/01-dashboard-desktop-light.png) |1440×1080, connected overview |
| [02 — Tablet portrait](screenshots/02-dashboard-tablet-light.png) |834×1112, purposeful two-column working regions |
| [03 — Mobile light](screenshots/03-dashboard-mobile-light.png) |390×844, complete mobile order |
| [04 — Movements](screenshots/04-transactions-desktop-light.png) |1440×1000,56px register and financial signs |
| [05 — Detail drawer](screenshots/05-transaction-detail-drawer.png) |520px contextual inspection |
| [06 — Edit form](screenshots/06-transaction-edit-form.png) |580px amount-first form |
| [07 — Accounts](screenshots/07-accounts-desktop-light.png) |Native groups and account register |
| [08 — Budgets](screenshots/08-budgets-desktop-light.png) |Exceeded-first ordering and exact period |
| [09 — Credits](screenshots/09-credits-desktop-light.png) |Native card debt versus loan and line |
| [10 — Desktop dark](screenshots/10-dashboard-desktop-dark.png) |Complete dark hierarchy |
| [11 — Movements dark](screenshots/11-transactions-dark.png) |Dense dark register |
| [12 — Partial error](screenshots/12-dashboard-partial-error.png) |Agenda failure, healthy regions preserved |
| [13 — First use](screenshots/13-first-use-mobile.png) |Account-first empty state |
| [14 — Mobile movements](screenshots/14-transactions-mobile.png) |Table-to-record adaptation |
| [15 — Mobile form](screenshots/15-mobile-create-form.png) |Full-screen entry and safe footer |
| [16 — Mobile dark](screenshots/16-dashboard-mobile-dark.png) |Dark responsive composition |
| [17 — Loading](screenshots/17-loading-desktop.png) |Round02 region geometry without fake numbers |
| [18 — Obligation warning](screenshots/18-obligations-currency-warning.png) |Unknown opening balance outside trusted totals |
| [19 — Mobile first viewport](screenshots/19-dashboard-mobile-viewport.png) |390×844 actual above-the-fold composition |
| [20 — Mobile scrolled](screenshots/20-dashboard-mobile-scrolled.png) |Fixed navigation while reviewing lower regions |
| [21 — FT Ligature system](screenshots/21-ft-ligature-system.png) |1200×900, logo geometry/applications |
| [22 — Result explanation](screenshots/22-result-explanation.png) |Equation, categories, ratio and scope |
| [23 — Category → records](screenshots/23-category-to-records.png) |Filtered ledger with removable context |
| [24 — Expanded mobile analysis](screenshots/24-mobile-analysis-expanded.png) |Flow and categories on demand |
| [25 —30-day agenda](screenshots/25-thirty-day-agenda.png) |Six recorded commitments, native currencies |
| [26 — Tablet landscape](screenshots/26-dashboard-tablet-landscape.png) |1024×768 responsive work surface |
| [27 — Filter drawer](screenshots/27-filter-drawer.png) |Draft/apply interaction pattern |
| [28 — Account peek](screenshots/28-account-peek.png) |Four original-currency accounts behind summary |

## Before-state and preservation

The entire first proposal is preserved in [archive/round-1/](archive/round-1/), including its master plan, preview and20 captures. Compare [prior desktop](archive/round-1/screenshots/01-dashboard-desktop-light.png) with [refined desktop](screenshots/01-dashboard-desktop-light.png), and [prior tablet](archive/round-1/screenshots/02-dashboard-tablet-light.png) with [refined tablet](screenshots/02-dashboard-tablet-light.png).

The archive is historical evidence, not an alternate implementation specification. Prior tracked redesign documents were not overwritten.

## Scope, risks and verification

The design remains isolated. Saving validates only a limited synthetic form and displays an explicit simulation message; it does not persist or recompute summaries. Date/name-based fixture data, simplified filter controls, overlay wiring and formatter are not production contracts. Some secondary actions explain their intended scope rather than pretending to have a backend. The real app's existing fields, validators, attachment protections, URLs and actions must remain.

Read [QA_REPORT.md](QA_REPORT.md) and generated [verification.json](screenshots/verification.json):89 automated prototype checks passed,28 captures,0 browser errors/external requests,117 existing unit tests passed. Full authenticated E2E, screen-reader/device testing and a new production build were not performed.

Fresh round02 source inspection found read-triggered legacy receivable repair (F18/O12). The plan forbids introducing those reads as dashboard dependencies. Existing security/stability gates S01–S06 and optional O01–O12 are separate from visual approval. No new financial calculation/API is justified by an attractive region in the prototype.

## Approval and rollback

Approve the refined product/visual direction (V1), FT12 applications (V2) and staged execution/QA (V3). Authorize S/O packages individually. Approval to implement is not approval to deploy.

Modified/added only: the current master, new handoff, strategic PRODUCT context and isolated `docs/redesign-v3/` artifacts. No tracked production file, API, auth, Supabase setting or real data changed. No commit/push/deployment was performed.

For a design-only rollback, stop the local server and restore the current reference from the preserved round01 archive through a reviewed file change. No database rollback exists or is needed. Do not reset the repository or delete unrelated user work.
