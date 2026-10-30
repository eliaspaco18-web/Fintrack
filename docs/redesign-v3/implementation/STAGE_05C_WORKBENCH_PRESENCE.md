# FinTrack V3 Round 07: Stage 5C workbench presence adapter

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This is an **opt-in UI lifecycle** package, not a route migration or authenticated write certificate. Stage 5 remains open.

## Implemented and preserved

- `useV3WorkbenchPresence` models closed/opening/open/closing, keeps the frame mounted during the current exit, and uses Web Animations for the approved 260 ms frame enter, 160 ms frame exit, independent 160/140 ms veil and 180 ms body settle after 36 ms. The frame starts 48 px to the right with scale .985; exit travels 24 px and scales .992. There is no number animation or page-scale effect.
- On interruption, the adapter reads the rendered transform/opacity before canceling, carries that pose into the next transition and invalidates obsolete completion. Changing to reduced motion mid-dock finishes the current logical state immediately. Keyboard-origin operations do not wait or animate. `motionSource` defaults to keyboard, so pointer motion requires an explicit caller decision.
- The V3 overlay separates its veil from the frame. `RecordModal` keeps `FocusTrap` active through its closing phase; `FocusTrap` keeps the latest Escape callback without re-initializing focus on a handler rerender. Its optional heading-first focus and Shift+Tab wrap serve inspection; legacy modal callers retain their existing initial-focus default.
- Only V3 opt-in `RecordModal` uses this adapter. All currently routed modal consumers remain unchanged, including their submit/delete handlers, fields, IDs, payloads and close guards.

## Evidence and limits

- Three browser-driven unit cases cover pointer close/reopen interruption, stale exit rejection, keyboard/reduced immediate settlement and a preference switch mid-transition. A separate focus case covers heading focus, Shift+Tab, rerender stability and focus return. The Stage 5B synthetic responsive geometry tests remain the only frame screenshots.
- Production build and lint pass; 172 unit tests pass. Loopback-only unauthenticated E2E remains 26 passed/29 skipped, including the five synthetic workbench geometry cases. Typecheck still reports only the two registered pre-existing TS2614 named `describe` test-import errors. `git diff --check` passes. No S06 write test has been performed; no production data was used.
- Background `inert`/scroll ownership is added separately in Stage 5D. Nested subview draft retention, dirty/busy/unknown-outcome guards, focus and acknowledgement ownership during a real form save, and module-specific create/edit/delete flows remain outside this package. A parent that conditionally removes `RecordModal` cannot receive an exit; future integrations must keep the component mounted and drive its `open` prop. Do not claim Stage 5 or any mutation certified from this primitive test.

## Risk and rollback

The adapter is inert on legacy modals but affects shared `FocusTrap` callback stability, so real nested-dialog and authenticated form regressions remain required. Roll back by removing the opt-in presence hook and its references in `RecordModal`, restoring the prior V3 veil CSS, deleting the two focused unit tests and this report. No data, API, schema or financial logic rollback applies.
