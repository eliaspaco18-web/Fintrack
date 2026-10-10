# FinTrack V3 Round 07: Stage 6D route reveal foundation

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`, branch `codex/redisenio-total`. This is a shell-only transition and focus package. No route, query parameter, dirty guard, API, service, authentication or financial value is changed.

## Implemented

- The prior keyed whole-page `page-transition-enter` animation is no longer mounted by `AppShell`. A new `useV3RouteReveal` observes **committed pathname changes**, not route requests. It never delays content commit or coordinates data loading.
- Native same-origin links supply exact pointer/keyboard intent; the Registrar menu supplies the same source and target pathname before its existing `router.push`. Same-path query/filter/pagination updates do not replay route motion. Initial render, keyboard activation, reduced motion and back/forward commit without animation. History navigation leaves the main scroll position untouched; new module navigation resets the app's existing main scroll container.
- Pointer navigation animates the current module heading at 0ms / 160ms / Y3, a marked summary at 24ms / 180ms / Y5 and marked work regions together at 48ms / 180ms / Y6, opacity .35→1 with the approved out curve (maximum 228ms). Modules opt in through `data-ft-route-heading` and `data-ft-route-group="summary|work"` when their stage migrates. Until then, the shell uses the topbar heading plus a single 48ms work-region fallback; it does **not** guess which existing financial widget is the summary. Financial numbers are never interpolated.
- In-flight animations cancel on a newer route, unmount or a mid-transition reduced-motion change. Route heading focus and the concise live announcement are independent of animation promises. If a closing modal temporarily inerts the shell, focus waits for inert release and then lands on the current heading, rather than being lost behind the modal. The app's main scroll container remains the single owner.

## Evidence and limits

Rollout correction: route reveal is active only in the explicit local-development/Preview V3 shell; the legacy shell remains the default. See `STAGE_06_ROLLOUT_SWITCH.md`. The package counts below are checkpoint counts, superseded by final rollout verification.

- A browser-driven component test checks the exact 0/24/48 and 160/180/180 plan, keyboard/history/reduced bypass, and route announcement. Existing dirty/busy navigation logic is not replaced. `tests/unit/v3-app-select-interaction.spec.ts` moved its exit assertion ahead of a later 120ms text-settle assertion; this only removes a race in the existing Stage 4 timing test, with no component behavior change.
- Current QA: lint and production build pass; full unit 190 passed; local unauthenticated E2E 35 passed / 29 skipped. Typecheck still reports only the two registered pre-existing TS2614 named `describe` test-import errors. No authenticated write or real user data was used. Shell material screenshots remain in the Stage 6B/6C reports; the motion plan has timed browser evidence, not a claim of authenticated route capture.
- **Not certified complete:** actual module DOM groups, route A→B→C under slow/partial sources, dirty-form guard, modal-close focus order and back/forward scroll restoration require authenticated read-only integration checks as relevant modules are migrated. S06 is still required for any authenticated write-path certification. Stage 6a catalog pilot is next; its create/edit/delete acceptance cannot be certified before S06.

## Files, risk and rollback

Changed here: `lib/ui/use-v3-route-reveal.ts`, `components/layout/AppShell.tsx`, `Topbar.tsx`, `QuickActionsFAB.tsx`, `components/ui/AnchoredActionMenu.tsx`, `tests/unit/v3-route-reveal.spec.ts`, timing assertion order in `tests/unit/v3-app-select-interaction.spec.ts`, this report and the operational handoff note. Existing route destinations and mutation handlers remain untouched.

Risk: an unmarked module temporarily receives the two-level fallback, not its final three-region reveal. A modal exiting during navigation could expose a browser-specific focus race; the hook explicitly waits for inert release but has not been proven in an authenticated product route. A code-only rollback removes the route hook and its AppShell binding, restores the prior route wrapper presentation, and removes only this test/report; keep Stage 6B/6C and all owner work. No database rollback applies.
