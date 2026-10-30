# FinTrack V3 — Design Review

This is a high-fidelity, isolated design proposal, not the production application. All names, balances, records and dates are synthetic. The sample is fixed at September 21, 2026.

The implementation source of truth is [FINTRACK_REDESIGN_V3_MASTER_PLAN.md](../../FINTRACK_REDESIGN_V3_MASTER_PLAN.md). The proposal is awaiting owner approval. Earlier redesign documents remain untouched.

## Start with the visual proposal

Open the [interactive preview](http://127.0.0.1:4173/#dashboard) while the local server is running. If it is stopped, run from the repository root:

```sh
node docs/redesign-v3/preview/serve.mjs
```

Then open `http://127.0.0.1:4173/`. Stop that terminal process with Control-C. This does not start Next.js, read environment secrets, import application code or connect to Supabase. The server binds only to localhost and serves only the preview directory. The browser's content security policy prohibits network connections and form submissions. Fonts are included locally with their license.

Opening [preview/index.html](preview/index.html) directly in a browser also provides the design without a running server. HTTP mode is the mode verified by the automated checks.

The chosen direction, **Clarity of Record**, organizes the experience around current position, period movement and recorded commitments. Exact amounts and native currencies take priority over scores or decorative charts. Blue indicates action; ordinary spending is neutral; red is reserved for an exception or explicit deficit.

## Suggested review sequence

1. Review Inicio at desktop, tablet and mobile widths. Identify the independent PEN/USD balances and the difference between today's balances and September's result.
2. Use the moon/sun button in the proposal toolbar to compare light and dark themes.
3. Open Movimientos. Search for `Supermercado`, inspect its detail, edit its description, attempt to close, then continue editing or discard. Save is a simulation.
4. Apply the USD filter. The PEN-only transaction fixture should produce a truthful no-results state, not fabricated records.
5. Review Cuentas and inspect an account's opening versus current balance. Review Presupuestos and its exceeded Transporte period. Review Créditos and the stored installment breakdown.
6. Change the proposal toolbar's Estado to partial failure, first use and loading. These are review controls, not proposed production controls.
7. Review Por cobrar to see separated native currencies and the legacy opening-balance warning.

The additional Assets, Templates, Notices, Settings and Catalogs pages demonstrate the shared visual system. Their detailed production behavior is specified in the master plan; they are not complete application implementations.

## Capture index

All captures are real browser renders of this prototype, not generated illustrations. Full-page screenshots show fixed navigation at its viewport position; use captures 19–20 or the live preview to evaluate actual mobile scrolling.

| Capture | Viewport | Review focus |
|---|---|---|
| [01 — Dashboard desktop light](screenshots/01-dashboard-desktop-light.png) | 1440 × 1080, full page | Shell, position, flow, commitments, spending and budgets |
| [02 — Dashboard tablet light](screenshots/02-dashboard-tablet-light.png) | 834 × 1112, full page | Rail, stacked main analysis and compact commitments |
| [03 — Dashboard mobile light](screenshots/03-dashboard-mobile-light.png) | 390 × 844, full page | Complete mobile content order |
| [04 — Transactions](screenshots/04-transactions-desktop-light.png) | 1440 × 1000, full page | Register, financial signs, filters and density |
| [05 — Record detail](screenshots/05-transaction-detail-drawer.png) | 1440 × 1000 | Context-preserving detail drawer |
| [06 — Edit form](screenshots/06-transaction-edit-form.png) | 1440 × 1000 | Amount-first form, progressive options and effects |
| [07 — Accounts](screenshots/07-accounts-desktop-light.png) | 1440 × 1000, full page | Native currency groups and account register |
| [08 — Budgets](screenshots/08-budgets-desktop-light.png) | 1440 × 1000, full page | Exceeded-first order, exact period and remaining amount |
| [09 — Credits](screenshots/09-credits-desktop-light.png) | 1440 × 1000, full page | Card debt, utilization and loan distinction |
| [10 — Dashboard desktop dark](screenshots/10-dashboard-desktop-dark.png) | 1440 × 1080, full page | Full dark-theme hierarchy |
| [11 — Transactions dark](screenshots/11-transactions-dark.png) | 1440 × 1000, full page | Dark-theme table density and contrast |
| [12 — Partial failure](screenshots/12-dashboard-partial-error.png) | 1440 × 1000, full page | Local failure alongside available data |
| [13 — First use](screenshots/13-first-use-mobile.png) | 390 × 844, full page | Account-first empty state |
| [14 — Mobile transactions](screenshots/14-transactions-mobile.png) | 390 × 844, full page | Table-to-record transformation |
| [15 — Mobile creation form](screenshots/15-mobile-create-form.png) | 390 × 844 | Full-screen form and sticky actions |
| [16 — Dashboard mobile dark](screenshots/16-dashboard-mobile-dark.png) | 390 × 844, full page | Dark responsive layout |
| [17 — Loading](screenshots/17-loading-desktop.png) | 1440 × 1000, full page | Stable skeleton geometry |
| [18 — Obligations warning](screenshots/18-obligations-currency-warning.png) | 1440 × 1000, full page | Native currency buckets and unverifiable opening data |
| [19 — Mobile first viewport](screenshots/19-dashboard-mobile-viewport.png) | 390 × 844 | Real above-the-fold composition and fixed navigation |
| [20 — Mobile after scrolling](screenshots/20-dashboard-mobile-scrolled.png) | 390 × 844 | Lower content with persistent navigation |

## Prototype boundaries

- No production records, tokens, sessions, authentication, APIs or database clients are used.
- Saving validates a limited synthetic form and shows a simulation message; it does not persist a record or recalculate fixed summaries. Reloading returns the same fixture.
- The transaction form shows the eight operation choices, but does not reproduce every real financial validator, relationship, attachment or mutation. Production must retain those from the repository.
- Secondary actions sometimes display an explicit scope explanation. They are not silently presented as working backend features.
- Chart range switches between synthetic aggregates. The header's month disclosure does not imply a global historical dashboard query.
- The prototype's money formatter, date input, in-memory state and dialog wiring are not production financial contracts. The master plan governs the exact integration behavior.
- Bank names and avatar initials are invented. No bank connection is implied. The proposed F/register mark requires its own optional approval.
- Document scrolling in the prototype differs from the existing application shell's main scroll container. Do not copy the isolated page wholesale into product routes.

## Verification and implementation handoff

Read [QA_REPORT.md](QA_REPORT.md) for executed checks, remaining gaps and reproduction instructions. Machine-readable prototype evidence is [verification.json](screenshots/verification.json).

Before implementation, approve the master plan's V1 visual/product direction, V2 optional mark and V3 implementation sequence. Review S01–S06 stability/security gates and O01–O11 structural proposals separately. The visual approval never grants permission to change money, Supabase, APIs, authentication, RLS or existing records.

Sol should follow master-plan sections 11–12: scoped foundations, shared components, module-by-module integration, financial fixtures, visual QA and code-only rollback. This prototype is a reference artifact, not the start of the production rewrite.

## Change scope and rollback

Only the new root master plan and `docs/redesign-v3/` artifacts were added for this mission. No tracked production source or previous design document was changed. No commit, push, migration or deployment was performed.

The design-only rollback is to stop the local server and remove these new proposal artifacts through a normal reviewed change. No database rollback is necessary. Do not use a broad reset or delete unrelated user files.
