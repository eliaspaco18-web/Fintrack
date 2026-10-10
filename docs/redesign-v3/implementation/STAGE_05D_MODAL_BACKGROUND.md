# FinTrack V3 Round 07: Stage 5D modal background ownership

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This is an opt-in accessibility/lifecycle foundation. No existing production modal is migrated.

## Implemented and preserved

- The V3 workbench now retains background `inert` and body scroll lock while its presence adapter is mounted, including the 160 ms exit. The top owned overlay remains interactive; a nested owned overlay inerts the earlier one. A body-child observer covers siblings added while the modal is open. Each pre-existing inert state and prior body overflow value is restored on final release.
- The V3 `FocusTrap` defers return focus to a microtask after modal cleanup and only targets a connected, non-inert trigger. This avoids returning focus into a still-inert background or a newly opened modal. Legacy focus restoration remains synchronous.
- Ownership is presentation-only. It does not change close permission, dirty draft state, financial write handling, routing or any underlying modal consumer.

## Evidence and limits

- A browser-driven unit case verifies sibling inert, nested ownership, dynamically inserted siblings, pre-existing inert restoration and overflow restoration. The Stage 5C focus case verifies heading focus, Shift+Tab and handler-rerender stability. Geometry tests cover desktop/tablet/mobile, but no actual module form is opted in.
- Existing legacy nested modals must not be assumed compatible inside a V3 workbench. The approved pattern uses one workbench with nested subviews; this is not yet integrated. Dialog-owned toast and popover layering, route guards, dirty/busy/uncertain outcomes, and actual authenticated mutations still need their module gates and S06.
- Production build and lint pass. Full unit: 173 passed. Loopback-only unauthenticated E2E: 26 passed/29 skipped. Typecheck still reports only the two registered pre-existing TS2614 named `describe` test-import errors. `git diff --check` passes. All browser tests use synthetic records or loopback-only unauthenticated pages.

## Risk and rollback

The manager is inert unless a V3 workbench opts in. A future owner that conditionally unmounts the whole component, rather than setting `open=false`, bypasses exit ownership; module migration must test this. Roll back `v3-modal-background.ts`, its opt-in effect, deferred V3 focus return, the focused test and this report. No database, API or financial rollback applies.
