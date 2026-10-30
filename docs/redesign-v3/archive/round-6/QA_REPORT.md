# FinTrack V3 Round06 — Evidence and QA

Date: September23,2026 (America/Lima). Baseline `4fdbe715f1a887ff59fc64868bf2da06c2d0cdae`; branch `codex/redisenio-total`. Browser report timestamps are UTC.

## Outcome and scope

Ready for owner design review, not production implementation or release certification. This round corrects operational feedback and exposes source-supported actions. Identity, palette, financial architecture and existing fixtures remain. No production components, financial logic, API, authentication, Supabase or real data changed. The complete previous round was archived in `archive/round-5/` before editing; archives1–4 remain.

| Verification | Result | Boundary |
|---|---|---|
| General prototype suite |89 passed | Responsive/financial presentation,16 selected contrast pairs |
| Motion suite |33 passed | Drawer interruption, focus, charts, keyboard/reduced |
| Shell/register suite |60 passed | FT collapse, credits, density, Registrar, routes |
| Selection/catalog suite |51 passed | Comboboxes, source-correct local mutations, mobile/dark |
| New operational feedback suite |78 passed | Timed acknowledgements, queue, focus, errors,9 module action menus and exact template/counterparty/export scope |
| Total prototype assertions |311 passed | Includes overflow/capture assertions, not311 independent user studies |
| Existing financial helper unit suite |117 passed,885ms | Not authenticated financial E2E |
| Browser exceptions / unexpected external requests |0 /0 in final reports | CSP/test routing disallow non-local connections |
| Current visual gallery |71 PNGs |01–59 regenerated;60–69 includes3 distinct65 module captures |
| Tracked production diff |Empty | New/untracked proposal artifacts only |
| Authenticated E2E/build/lint/typecheck |Not run | No production source/dependency changes; no authorized disposable auth fixture |

Machine-readable reports: [general](screenshots/verification.json), [motion](screenshots/motion-verification.json), [shell/register](screenshots/evolution-verification.json), [selection](screenshots/precision-verification.json), [actions](screenshots/actions-verification.json). All final reports have `failure:null`. Non-failing unit color-environment warnings occurred.

## New behaviors actually verified

- Save returns to the list with a floating acknowledgement; no `.action-result` success panel or `.context-receipt` persistent band. Financial simulation preserves exact entered125.50 and explicitly says no financial data changed.
- Category create inserts one local row; edit targets the same ID; delete removes only that row after cancel-first confirmation. Focus returns to a useful record/action, never the notification.
- Category state action removed after code audit. Entidades supports actual in-memory deactivate/reactivate without duplicating the row. Linked sample category deletion stays blocked; no fake Undo.
- Success self-dismisses after visible lifetime. Hover and keyboard focus pause the timer; moving away resumes; focused Escape dismisses only the notification. Mobile shows one, desktop two; queued error is not overwritten.
- Busy state prevents duplicate submit. Rejected action retains draft and inline explanation; temporary error belongs to the active modal subtree. Unknown response blocks blind retry and uses warning, not success.
- Primary and record-menu actions are present in Movements, Accounts, Budgets, Credits, Receivables, Payables, Assets, Templates and Alerts. Transaction bulk deletion has explicit selected-count confirmation. Asset state names SOLD and says it is not a financial sale.
- Template use opens transaction creation with the original amount/category and matching effect summary. Collection retains the selected person and original USD currency, exposing the required FX input without inventing a rate.
- Selection toolbar contains clear/delete, not unsupported selected-row export. Clear resets checkboxes and returns focus to select-all. Existing module export retains its own format, period, exercise and portfolio scope; selection is not an export filter.
- Tablet credit action menu remains visible; mobile/dark feedback, reduced-motion immediate behavior, auto-dismiss and320/390/768/1024/1440 placement pass.
- Existing ledger density remains48px in the measured desktop fixture. FT logo geometry, shell, chart interpretation, original currencies and natural12-product credit scope remain protected by inherited checks.

## Visual inspection and iteration

Inspected actual generated PNGs: desktop create feedback, credit actions, error inside workbench, dark mobile feedback, tablet dark menu, dense ledger actions and mobile state confirmation.

| Before | After | Why |
|---|---|---|
| Large result screen after save | Auto-close + compact neutral acknowledgement | No extra workflow step |
| Persistent success strip | Brief acknowledgement + changed row | Success stays light; record retains evidence |
| Category demo offered unsupported state | Category edit/delete; state demo in Entidades | Actual source capability wins |
| Credit action column sized only for a chevron |10% desktop actions;8% tablet More cell | Avoid clipped Edit/focus ring and hidden tablet operations |
| Focused toast Escape sampled as pointer motion | Explicit keyboard modality before dismissal | Immediate accessible keyboard behavior |
| Select-all control did not trigger old prototype delegation | Explicit local checkbox handler | Existing bulk action becomes reviewable; no production fix |
| Generic state confirmation title | Asset-specific title and Confirmation mode | State meaning is visible before action |
| Prototype offered Exportar selección | Clear/delete selection; separate module export | Real export handler does not accept selected transaction IDs |

Old test expectations for a success screen were intentionally replaced, not bypassed. The selection suite's state checks now target supported entity behavior instead of an invented category capability. One locator was scoped to the named record because both record name and explicit Edit now correctly exist.

## Source audit findings and limits

Master6.7 is the normative action matrix; handoff4.6 maps implementation order/files/guards. Read-only audit covered owning transaction, account, budget, credit, contact, asset, template, catalog, alert, settings handlers and the existing toast provider.

Two important findings remain separate from redesign implementation:

- `AlertsWorkspace.handleMarkAllRead` counts successful requests but currently marks every unread item read locally. Do not claim truthful partial-bulk feedback until a separately approved stability change addresses this.
- `useToast().success` can persist notification activity by default; a renderer change must preserve each caller's policy and avoid duplicate events. The design does not authorize new activity writes.

Existing S01–S06/O01–O12 gates remain. In particular, do not use debtor GET paths that invoke legacy link repair as a harmless feedback reconciliation read. No real service was called.

## Prototype truth and remaining integration work

Financial snapshots are fixed; the preview does not execute financial writes or rederive balances after a simulated save. Categories and independent entity/currency/type examples are disposable in-memory registers, reset by reload. Abbreviated operational forms illustrate hierarchy/feedback, not the full field contract. Production colors/icons/uploads, type-specific schedules, validation and original service payloads remain mandatory.

Review-only artifacts:520ms fake transport, forced error/unknown selector, success/error/warning/burst controls, internal credit stress fixtures and mock reconciliation. Never ship these or a no-op success handler. Some secondary read/settings paths retain scope explanations; this is not full production functionality.

Global function overrides, native backing selects, hash routes and MutationObservers are simulator wiring, not a React architecture recommendation. Evolve existing owned components and the current toast provider.

Not executed here: real Safari/Firefox top-layer behavior, physical mobile/virtual keyboard, VoiceOver/NVDA,200% zoom, hidden-document timer automation, exhaustive multi-pause/dedupe/resize interleaving, actual backend partial writes, filtered/paginated cache refresh, session/auth outcomes. These remain explicit integration tests in handoff4.6. Local passing assertions are not comprehensive accessibility or financial-correctness certification.

## Reproduce

Serve locally, only if the existing server is absent:

```sh
node docs/redesign-v3/preview/serve.mjs
```

Run separately:

```sh
node docs/redesign-v3/preview/verify.mjs
node docs/redesign-v3/preview/verify-motion.mjs
node docs/redesign-v3/preview/verify-evolution.mjs
node docs/redesign-v3/preview/verify-precision.mjs
node docs/redesign-v3/preview/verify-actions.mjs
./node_modules/.bin/playwright test --config=playwright.unit.config.ts
```

The static server binds127.0.0.1 and serves only the proposal directory. Local assets/fonts, no app environment, CSP connect-src none. Browser launch used normal permission approval. No deployment, production writes or git commit/push.

## Changed files, risk and rollback

- Root `FINTRACK_REDESIGN_V3_MASTER_PLAN.md`: corrected6.6 feedback protocol, new6.7 audited action matrix, reconciled geometry/round history/review references.
- Root `FINTRACK_REDESIGN_V3_SOL_HANDOFF.md`: corrected previous action instructions; new4.6 execution packet, dependencies, stop conditions, tests, persistence safeguards and rollback.
- Preview `index.html`, new `actions.css`/`actions.js`, corrected `precision.js`, workshop `motion.html`/`motion.js`: visible operational controls and ephemeral feedback only.
- Preview tests `verify.mjs`, `verify-precision.mjs`, new `verify-actions.mjs`; regenerated71 PNGs and5 reports; README/this QA; complete round05 archive.

Risk is design interpretation: treating a simulated confirmation or abbreviated form as real functionality; inventing unsupported actions; duplicate persisted notifications; inaccessible modal portals; false partial-bulk success. Master and handoff explicitly prohibit these.

Rollback only current proposal/documentation files from `archive/round-5/` if the owner asks, preserving any newer owner changes. Do not touch production or databases. The archive is comparison evidence, not current implementation authority. Nothing material was deleted.
