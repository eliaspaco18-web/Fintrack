# FinTrack V3 Round07: Feedback Evidence and QA

Updated: September24,2026 (America/Lima). Baseline: 4fdbe715f1a887ff59fc64868bf2da06c2d0cdae; branch codex/redisenio-total. Reports retain their actual UTC execution timestamps.

## Outcome and boundary

Ready for owner design review, not production implementation or release certification. Scope is only temporal feedback position, surface, motion and remaining-time display. Identity, palette, shell, modules, operational capabilities and financial fixtures remain. No production components, API, auth, financial logic, Supabase or real data changed. Complete round06 proposal archived before editing in archive/round-6; earlier archives1–5 preserved.

## Verification

| Suite | Passed | Evidence |
|---|---|---|
| General prototype |89 | verification.json |
| Motion and workbenches |33 | motion-verification.json |
| Shell/register |60 | evolution-verification.json |
| Selection/catalog |51 | precision-verification.json |
| Operational actions |79 | actions-verification.json |
| New feedback placement/timing |44 | feedback-verification.json |
| Total prototype assertions |356 | All six reports have failure:null and no browser exceptions/external requests |
| Existing financial helper unit suite |117 in945ms | Existing Playwright unit configuration; no authenticated writes |
| Current gallery |78 PNGs |01–69 include three65 variants;70–76 are round07 close-ups |
| Tracked production diff |Empty | Proposal artifacts only; no commit/push/deployment |

Reports live in [screenshots](screenshots/). Counts include geometry/capture checks, not independent user studies. Passing these is not financial-release or accessibility certification. Build/authenticated E2E/lint/typecheck were not run because this round does not change production source or dependencies. Unit runner emitted non-failing color-environment warnings.

## Actually verified this round

- Desktop acknowledgement right edge is24px from viewport; max width388px; top is12px below module heading/actions (y177 in1440px fixture including review bar). Module primary remains accessible. Mobile/tablet16px gutters;320/390/768/834/1024/1440 fit without horizontal overflow.
- Entry keyframes230ms, upper-right12/−6px and.985 scale; exit150ms toward8/−4px and.99 scale. Immediate dismissal interrupts entry without leaving an orphan panel. Drawer close does not cancel the lifetime animation.
- The2px line decreases proportionally to remaining lifetime. Hover freezes it; focus continues the pause after pointer leave. Resume consumes remainder rather than restarting. Auto-dismiss matches that clock.
- Hidden-reason pause is tested through the clock's controlled pause interface. Actual browser tab-background scheduling is NOT certified by this test.
- Success/info4200ms, warning6200ms, error8200ms. Two desktop/one mobile; queued items receive their own full lifetime. Timer label is aria-hidden and not a progressbar/live countdown.
- Reduced motion has zero running animations including the timer; discrete textual lifetime remains and self-dismisses. Runtime preference change retains remaining time. Keyboard acknowledgement is immediate. Resize keeps the visible count and clock.
- Real local category create/edit/delete and entity activate/deactivate still work. Confirmed financial forms remain explicitly simulated, close without a success screen, and keep fixed snapshot values. Error retains its draft and persistent inline cause; unknown results still block blind resubmit.
- Modal error feedback remains inside its accessibility subtree, below header, without replacing the form. No generic Undo, large result panel, permanent success strip or legacy bottom toast.
- Inherited source-audited module actions, template/counterparty currency context,48px movement rows, FT shell, charts and searchable selections remain passing.

## Visual review

Inspected actual captures60 (create),70 (upper right),73 (dark mobile),75 (error inside workbench), plus prior operational views retained by regression suites. Current70–76 gallery and workshop scene10 show real prototype behavior, not image mockups.

| Before | After | Why |
|---|---|---|
| Bottom-centered420px panel | Upper-right388px below module actions | Close to operational context; Create and Registrar remain accessible |
| No visible lifetime | Quiet2px line and approximate seconds | Predictable dismissal |
| Pause only internal | Frozen line and En pausa | Interaction state is legible |
| Lower-origin entrance |230ms upper-right entry and150ms retreat | Coherent spatial behavior |
| Colored side rule | State glyph + lifetime line | Less redundant decoration |
| Drawer canceled all descendant animation | Feedback animation ownership excluded from drawer cancellation | Clock remains continuous during success handoff |

Impeccable and Emil informed restrained hierarchy, origin-aware bounded motion, interruption and accessible timing. No new style direction was introduced.

## Limits and integration risks

The prototype is a local simulator. Financial snapshots stay fixed; category and independent catalog records live only in memory and reset on reload. Abbreviated forms do not replace production field contracts. No real service was called. Review toolbar, forced responses, fake transport, demo controls and global function overrides must not ship.

Not executed: physical keyboard/virtual-keyboard viewport, real Safari/Firefox top-layer behavior, VoiceOver/NVDA announcements,200% zoom, background-tab scheduling, exhaustive burst/focus/resize interleaving, real backend partial writes and authenticated mutations. Short-height/focused-field collision is explicitly a handoff integration gate. No claim of comprehensive accessibility compliance.

Preserve round06 audit findings: AlertsWorkspace mark-all-read currently misrepresents partial failure locally, and useToast success may persist activity by default. Those are separate stability/persistence concerns, not permission to change them here. Existing S01–S06/O01–O12 gates remain; do not invoke read-triggered debtor-link repair for prototype reconciliation.

Critical future risks: two clocks drifting; drawer cancellation killing the progress line; duplicate persisted notifications; a timed-only essential action; timer restarting on render/resize; inaccessible modal portal; misleading Undo or optimistic financial success. Master6.6 and handoff4.7 define the required safeguards.

## Reproduce and review

Start only if the local server is absent:

    node docs/redesign-v3/preview/serve.mjs

Open [the action preview](http://127.0.0.1:4173/#admin) or [motion workshop](http://127.0.0.1:4173/motion.html), scene10. Create/edit/delete a category; use Entidades for activate/deactivate. Hover/focus to pause. Use marked review controls for warning/error/bursts. No fake Undo is provided.

Run each local suite separately:

    node docs/redesign-v3/preview/verify.mjs
    node docs/redesign-v3/preview/verify-motion.mjs
    node docs/redesign-v3/preview/verify-evolution.mjs
    node docs/redesign-v3/preview/verify-precision.mjs
    node docs/redesign-v3/preview/verify-actions.mjs
    node docs/redesign-v3/preview/verify-feedback.mjs
    ./node_modules/.bin/playwright test --config=playwright.unit.config.ts

The static server binds127.0.0.1 and serves the proposal directory only. Local fonts/assets, CSP connect-src none; no app environment, authentication or production connection. Settle helpers intentionally exclude the lifetime animation, which the dedicated feedback suite tests rather than prematurely finishing.

## Files, reasons and rollback

- Root master: round07 authority/history and final6.6 geometry/timing/secondary-action policy.
- Root Sol handoff: updated geometry plus exact4.7 renderer/position/clock/motion/test packet.
- Preview actions.css/actions.js: upper-right surface, single remaining-time clock, lifetime line, pause presentation, reduced-motion text and interruption handling.
- Preview refinement.js: narrow feedback-animation ownership exclusion from drawer cancellation. No other workbench redesign.
- Preview index.html/motion.html/motion.js: round07 labels and scene10 demonstration.
- Five inherited preview verifier settle helpers; new verify-feedback.mjs; action suite adds the handoff-clock regression.
- README/QA,78 current captures and six reports; full archive/round-6 comparison snapshot.

Risk is isolated to proposal behavior and future interpretation; production is untouched. Restore only affected proposal files from archive/round-6 if the owner requests rollback, preserving newer/unrelated edits. No database rollback or repository reset. No material user data was deleted. Design approval is not deployment authorization.
