# FinTrack V3 Round05: Evidence and QA

Date: September23,2026 (America/Lima). Browser reports use UTC. Baseline `4fdbe715f1a887ff59fc64868bf2da06c2d0cdae`; branch `codex/redisenio-total`.

## Outcome and scope

Ready for owner **design review**, not production implementation or release certification. This is an evolution of round04: neutral white/gray material, controlled teal, natural credit register, intelligent selection and contextual action feedback. FT12, shell, density, charts and dashboard architecture are retained. The complete prior round was archived before edits.

| Verification | Result | Boundary |
|---|---|---|
| Existing financial helper unit suite |117 passed,887ms | Not authenticated financial E2E |
| General prototype suite |89 passed | Includes16 selected color contrast pairs |
| Inherited motion suite |33 passed | Workbench geometry, interruption, focus, chart scope, keyboard/reduced |
| Shell/register regression |60 passed | Natural credits, internal40-row stress, rail/logo, density, Registrar, routes |
| New selection/action suite |51 passed | Search, selection, local mutations, error/unknown, mobile/dark |
| Total prototype assertions |233 passed | Local synthetic Chromium, not production certification |
| Browser exceptions / unexpected external requests |0 /0 in final reports | Test routing and CSP block non-local requests |
| Current capture gallery |59 PNGs |01–46 refreshed;47–59 round05 |
| Tracked production diff |Empty | Only isolated proposal/documentation artifacts |
| Authenticated E2E, app build/lint/typecheck |Not run | No production source/dependencies modified; no authorized disposable auth environment |
| Supabase/RLS/RPC/deployed state |Not accessed or verified | Existing safety gates remain independent |
| Physical touch/virtual keyboard, VoiceOver/NVDA, Safari/Firefox,200% zoom |Not executed | Explicit pre-release integration QA obligations |

Machine-readable final evidence includes exact timestamps, every assertion and failure status:
[general](screenshots/verification.json), [motion](screenshots/motion-verification.json), [shell/register](screenshots/evolution-verification.json), [selection/actions](screenshots/precision-verification.json).
All final reports must have `failure:null`. Counts include screenshots' overflow assertions; they are not counts of distinct user-research participants or full test cases. Unit output had non-failing color-environment warnings. Production CI still follows the repository-supported Node20 requirement.

## What this round actually exercises

- Light surface/text/control/semantic contrast and unchanged neutral graphite dark foundations.
- No visible `Revisar escala`, sample-size selection or credit-scope banner;12 natural records, pagination, status selection, typed search and selected-product detail.
- One coherent default credit fixture:12 products/11 active;5 registered dates in7 days and11 in30 days; precise new-loan drilldown. No cross-currency sum and no reinterpretation of original loan capital.
- Short and19-option lists use the same selection component. Opening preserves value and empty query, list scroll is bounded, accent-insensitive typing narrows options, Enter commits and restores focus, no-match does not invent a record.
- Option loading and failure have different states; prior selection remains; scoped retry restores options. Account rows retain native-currency context.
- First Escape closes only the selector, not its parent drawer. Mobile rows≥48px; selection layer fits320/768/1024 widths and respects available viewport in emulation. Real OS keyboard behavior is not inferred from this.
- Financial form submit immediately prevents duplicate submission and displays an exact scoped receipt. The fixed financial snapshot is not mutated.
- Independent synthetic catalog: create inserts a real local row and returns focus; edit changes the intended ID; deactivate preserves the row/history; activate does not duplicate it; permanent delete removes only the confirmed record.
- Linked category deletion is blocked with a deactivate alternative. System categories remain read-only.
- Rejection retains input and rows. Unknown result blocks blind resend; explicit **mock** reconciliation releases retry only because this simulator knows no write happened.
- Dark selector, mobile register/receipt, keyboard/reduced immediate behavior and no attempted external requests.
- The inherited182 assertions still protect module responsiveness, financial drilldown scope, row density, fixed FT during collapse, quick operations, chart inspection, frame continuity and reduced-motion behavior.

## Visual inspection and corrections

Rendered desktop light/dark, credit register, search panel, no-match, catalog success, dark form, mobile selector and mobile receipt were inspected using actual PNGs.

| Before | After | Why |
|---|---|---|
| Green cast across neutral roles | White surface/#F5F6F7 canvas, gray borders/text and neutral recesses | Color signals intent rather than tinting every surface |
| Dark selection wash larger/greener than needed | Small #293633 selection role; unchanged graphite canvas/surface | Preserve brand without a green dark theme |
| Visible scale demo and disconnected credit agenda | Natural12-product list, explicit2-featured label, reconciled recorded commitments | No artificial mode and no misleading portfolio scope |
| Rapid close/reopen could leave two selection IDs during exit | Cancel/remove departing layer before mounting the next; keyboard mode recorded before intercepted key events | One accessible active selection layer, no stale callback/focus target |
| Category form did not participate in older dirty tracking | Explicit draft tracking and committed-selection tracking | Cancel must preserve new input |
| Generic month action on catalog | Removed: catalog has no date-filter scope | Avoid a meaningless global control |
| Pending label could change button width | Preserve measured width during pending state | No action-bar jump |
| Mobile review toolbar wrapped awkwardly | Compact review controls, hidden redundant review title on catalog | Review chrome remains outside product UI |

Test harness corrections included scoping option locators to the actual listbox rather than native review controls, awaiting the new contextual receipt rather than an obsolete auto-close, updating agenda expectations from6 to11, resetting internal stress-fixture filters, and performing fresh navigation when a clean fixture was required. These are test expectation changes, not production bug fixes.

## Prototype truth and implementation gaps

The financial read fixture is fixed and coherent within its declared scope. Current account balances include earlier/opening positions; they are not derived solely from the12 shown September movements. The12 credit products are now the default shared scope; the dashboard only features2, clearly labeled, while its agenda includes every registered commitment in the chosen interval.

The independent catalog uses synthetic IDs/names/link counts and changes in memory only. It is deliberately separate from the dashboard's financial categories; it demonstrates action behavior without creating a shadow accounting engine. Reload resets it. The sample form omits production color/icon/upload controls; no removal is authorized.

The520ms fake transport, response chooser, internal2/40 credit fixtures and local unknown-result resolution are review apparatus only. Main financial saves produce a visibly scoped simulation receipt; they do not update balances, transactions, Supabase or APIs. Production must use existing actual mutation responses, IDs, validation and reconciliation. Do not ship a no-op save.

The HTML relies on global functions, late presentation overrides, native-select backing controls and a MutationObserver. This is an isolated design artifact, not production integration architecture. Extend existing `AppSelect`/modal/form/table ownership as described in the handoff, preserving original operation semantics and fields.

Remaining production obligations include true dirty-route/back guards, scroll restoration, async callback ownership through unmount, filter/page preservation when a returned record is outside the current view, partial bulk outcomes, blocked-storage/hydration, screen-reader announcements, real virtual keyboards and Safari/Firefox layering. Screenshots and local checks are not comprehensive accessibility certification.

## Financial and source safeguards

Read-only source inspection confirmed the current `AppSelect.tsx` props/option model/search threshold, category manager fields/actions/restrictions, and previously documented financial/shell ownership. No production implementation was performed.

Existing S01–S06 and O01–O12 remain independent gates. No schema, RLS, API contract, authentication, financial helper, idempotency or persistence change is bundled here. In particular, visual confirmation must never invoke read-triggered legacy repair or introduce an unapproved write retry.

## Reproduce

Start the isolated server if absent:

```sh
node docs/redesign-v3/preview/serve.mjs
```

Run separately from the repository root:

```sh
node docs/redesign-v3/preview/verify.mjs
node docs/redesign-v3/preview/verify-motion.mjs
node docs/redesign-v3/preview/verify-evolution.mjs
node docs/redesign-v3/preview/verify-precision.mjs
./node_modules/.bin/playwright test --config=playwright.unit.config.ts
```

The static server binds only127.0.0.1 and serves only the proposal directory. Fonts/assets are local, CSP denies connections/form submission, no application environment is loaded. Browser scripts generate local proposal evidence only. Chromium used normal permission approval; no restriction was bypassed. Syntax and tracked-diff checks accompany final verification.

## Files, risks and rollback

Changed: root master/handoff; preview index, design/refinement CSS, dashboard fixture, evolution bootstrap/credit controls; new precision CSS/JS/verifier; live workshop scenes09/10; updated existing preview verifiers; README/QA and59 current captures/reports. Added complete `archive/round-4/` before editing.

Reasons: restrained material, one intelligent selection vocabulary, natural credit browsing, inspectable action outcomes and precise operational handoff. PRODUCT, production source/config/dependencies, APIs/auth/Supabase and real data were untouched. No commit, push or deployment.

Future integration risks: layer/focus ownership, unknown financial writes, constrained reference data, stale callbacks and list changes under active filters. Master6.1/6.6 and handoff4.5 define required responses and stop conditions.

Rollback is a reviewed restoration of **proposal files only** from `archive/round-4/`, preserving unrelated work. Never reset the repository or run a database rollback for this design round. Approval of visual direction does not itself authorize implementation, migration or deployment.
