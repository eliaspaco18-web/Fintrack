# FinTrack V3 Round03 — Refinement Evidence and QA

Date: September22,2026. Baseline: `4fdbe715f1a887ff59fc64868bf2da06c2d0cdae`. Branch: `codex/redisenio-total`.

## Outcome and scope

The refined prototype is ready for owner design review, **not production implementation/release certification**. Identity, financial concepts and main architecture are preserved. Round03 adds precise chart inspection, cohesive rounded surfaces, richer workbenches, purpose-specific motion and an interactive motion workshop. The complete round02 is archived before refinement.

| Check | Executed result | Limit |
|---|---|---|
| Existing financial-integrity unit suite | **117 passed**,826ms, fresh round03 run | Focused helpers, not authenticated financial E2E |
| General prototype suite | **89 passed** |73 geometry/interaction/runtime +16 selected contrast checks |
| Dedicated motion/refinement suite | **33 passed** | Pointer/keyboard/reduced, lifecycle interruption, geometry and contextual scope |
| Browser runtime errors | **0** in both final runs | Synthetic Chromium, not all target engines |
| Unexpected external requests | **0** | Test blocks non-local requests; CSP also denies connections |
| Capture gallery | **35 current images** |01–28 regenerated;29–35 new refinement states |
| Production diff | **Empty** | Only proposal documentation/prototype artifacts |
| Authenticated E2E | **Not run** | No disposable authenticated Supabase environment established |
| Application build/lint/typecheck | **Not run** | No application code/config/dependency change |
| Effective DB/RLS/RPC verification | **Not run** | Existing static concerns remain gated; no exploitation |
| Real financial/API/auth operations | **None** | Prototype runs without app configuration or credentials |

General browser run: `2026-09-22T22:08:35.529Z`–`2026-09-22T22:08:43.119Z`.
Motion browser run: `2026-09-22T22:09:27.372Z`–`2026-09-22T22:09:33.276Z`.

Machine-readable assertion records: [verification.json](screenshots/verification.json) and [motion-verification.json](screenshots/motion-verification.json). Both finish with failure=null. Unit output includes non-failing color-environment warnings. No dependencies or runtime settings were changed; production CI still follows the repository's Node20 requirement.

## What was actually exercised

General coverage retained from round02:

- Dashboard, transactions, accounts, budgets and credits at320/375/768/1024/1280/1920 without page overflow.
- Rendered chart labels≥11px; mobile chart hit regions≥44px.
- Search, truthful USD filter-empty, detail→edit→simulated save, dirty mobile dismissal, partial-error retry.
- Result explanation with8 category rows; category→two underlying records; removable chip retains expense filter.
- Mobile analysis disclosure;7/30-day agenda including6 records and original US$400 collection.
- Four original-currency account rows behind the summary; income/expense ranking switch.
- All illustrated FT assets load; direct expense action works; selected contrast roles pass.

New round03 coverage:

- Hover/pin/keyboard month inspection with exact values. Selecting August changes only chart-local reading, not September's summary.
- Roving chart focus, Enter pin, Escape hiding,8-operation anchored menu, viewport containment and focus restoration.
-260ms workbench frame and180ms content with36ms delay verified from actual animation timings.
- Detail/Context content, exact580px frame continuity into edit, dirty Back protection, retained edit value, explicit discard returning to original record.
-24px confirmation geometry; closing during entry then reopening during exit does not allow a stale completion to unmount the new record.
- Keyboard opening/closing immediate; focus returns to exact trigger. OS reduced-motion opens/closes without active transform animation.
- Mobile8px inset/all24px corners,44px close/previous/next targets; panel body and header/footer controls fit at320/375/768/834.
- Loading resolves to exact amounts without count-up; report y353/height527 is identical before/after in document coordinates.
- Motion workshop controls the same isolated UI; reduced mode closes immediately.

No assertion claims that all existing modules' keyboard/financial interactions were covered. Native dialog behavior here is not proof that the production React overlay already satisfies these contracts.

## Visual review and refinements

Inspected actual rendered desktop, tablet, mobile, light/dark, detailed/edited/context workbenches, chart tooltip and workshop captures. Changes were iterated in the browser:

| Before | After | Why |
|---|---|---|
| Mixed square/rounded surfaces | Systematic rounded panel/register/menu/workbench roles | Shared visual ownership |
| Plain bars and hidden share detail | Selected-month lens, outlined expense, exact readout, visible ranked contribution | Better information reading without new financial claims |
|520px read →580px edit | Stable580px contextual workbench | No frame jump while changing task |
| Instant/simple overlay wiring | Coordinated, interruptible frame/content/veil and trigger-origin menus | Motion communicates context and respects immediate keyboard use |
| Neutral color mix rendered with missing hue | Explicit OKLCH green-neutral inset values | Removed unintended pink tint, consistent across themes |
| Oversized category-row spacing during refinement |39px minimum desktop ranking, larger touch adaptation | Recovered useful density without removing exact values |

Current1440px landmarks including the28px review toolbar:

| Region | x / y | Width / height |
|---|---|---|
| Position |236 /181 |1176 /118 |
| Monthly report |236 /353 |751.67 /527 |
| Agenda |1005.67 /353 |406.33 /342.5 |
| Recent register |236 /896 |751.67 /401.5 |
| Budgets |1005.67 /711.5 |406.33 /306.5 |
| Credit |1005.67 /1034 |406.33 /224 |

These are fixture reference measurements, not fixed production content heights. The refined report is taller than round02 because exact category shares and a chart-local reading are visible. Architecture and independent stacks are unchanged; no claim that this round shortens the entire page.

Test-development corrections: an ambiguous confirmation-close selector was narrowed to the header close. A skeleton geometry assertion initially compared viewport coordinates before/after Playwright auto-scrolled to a review-only button; it now compares document coordinates after font readiness, with both measured boxes recorded. Final runs above passed after those corrections. Browser execution followed normal permission approval.

## Contrast and accessibility limits

The16 existing light/dark token pairs remain passing. Body/surface13.20:1 light and12.80:1 dark; secondary/surface5.79:1 and7.83:1; primary-action text6.02:1 and7.57:1; control boundary3.11:1 and4.49:1. Normal text target4.5:1, essential controls3:1. Gold is a brand/warning role, not ordinary chart text.

This is selected-role testing, not exhaustive WCAG certification. Full assistive-technology review,200% zoom, physical touch/keyboard behavior, iOS/Android Safari/Chrome and every secondary action remain required during implementation. The motion workshop supplements, not replaces, production testing.

## Financial and safety boundaries retained

No new source was required. Existing correctness/security gates S01–S06 and independent opportunities O01–O12 remain intact. In particular, debtors and debtor-filtered receivables may write through legacy repair; no such reads were introduced or called. Unknown currency, truncated coverage, unavailable year, uncertain writes and attachment association cannot be hidden by refined UI.

Prototype amounts remain synthetic/fixed. The prototype formatter, fixture IDs/names, hash routing, simplified fields, global function overrides and fake saves are not production contracts. Skeleton demonstration reuses hidden inert fixture geometry; production must use shared geometry or last-success state, not hidden financial data or duplicated fetching trees. No speed/comprehension/user-study claim was measured.

## Reproduction

Start the isolated server if needed:

```sh
node docs/redesign-v3/preview/serve.mjs
```

Then run these independently:

```sh
node docs/redesign-v3/preview/verify.mjs
node docs/redesign-v3/preview/verify-motion.mjs
./node_modules/.bin/playwright test --config=playwright.unit.config.ts
```

The first two write only proposal captures and JSON reports. Browser launch may require normal sandbox approval; do not weaken restrictions or supply credentials. Syntax-check the preview's app/dashboard/refinement/motion scripts and both verifiers after editing.

## Files, risk and rollback

Round03 modified only the master, handoff, preview/documentation/captures and preserved a round02 archive. Production source/API/auth/data/Supabase/config remained untouched. No commit/push/deployment.

Main future risks: unmount/focus/draft errors during interrupted motion; date/currency/context truthfulness; smaller responsive work surfaces. The handoff specifies tests and consultation points for each. Existing financial regression suites remain mandatory.

For a design-only rollback, restore proposal artifacts through a reviewed patch/copy from `archive/round-2/`; no database operation is needed. Never reset/delete the worktree or unrelated files. The master and Sol handoff remain the authority; no screenshot or prototype pass grants release permission.
