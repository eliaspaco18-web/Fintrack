# FinTrack V3 Round 07: Stage 5B opt-in workbench geometry

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This is a **presentation-only component gate** within Stage 5, not a completed workbench lifecycle or authenticated operation certificate.

## Implemented and preserved

- `RecordModal` now accepts `presentation="workbench"` and `workbenchKind="ordinary" | "schedule"`. Defaults preserve the existing legacy modal on all current consumers. No production route currently opts in.
- The V3 portal owns its theme scope even though it mounts under `document.body`. The detached frame sits 12 px from desktop/tablet edges with a bounded 580 px ordinary or 960 px schedule width, and 8 px from all mobile edges. All corners remain 24 px. Body scrolls independently; header and footer remain in flex flow. The header uses the approved title scale, and the close target is 32 px desktop/44 px mobile.
- `FocusTrap` accepts optional wrapper class and initial heading ref so an opted-in inspection panel can announce its title first. Shift+Tab from that non-tabbable heading wraps to the last control. Legacy focus selection remains unchanged.
- The opt-in variant disables the old global `dialog-enter` scale animation, which otherwise distorts the detached geometry before the dedicated Stage 5 lifecycle is mounted. It also removes inherited backdrop blur; no new transition is claimed in this package.

## Evidence and limits

- Synthetic Playwright geometry tests pass at 1440, 834, 390 and 320 px. They verify exact insets, width, height, 24 px radius, independent body scroll and visible footer. A separate schedule-width test verifies 960 px. Synthetic desktop/tablet/mobile captures are `stage5-workbench-*.png` and are not screenshots of authenticated production forms.
- `npm run build` and `npm run lint` pass. Unit tests: 168 passed. Loopback-only unauthenticated E2E: 26 passed, 29 skipped. Typecheck reports only the two registered pre-existing TS2614 named `describe` test-import errors. `git diff --check` passes.
- Opening/closing presence, interruptible 260/160 ms motion, inert background, scroll locking, modal-owned acknowledgement transfer, dirty/busy dismissal, related read/edit subviews and production field inventory are **not implemented or certified** here. Do not opt a real write form into this variant until those Stage 5 gates and its module-specific S06 checks are satisfied.

## Risk and rollback

The opt-in frame is inert for all existing modal consumers. The optional `FocusTrap` props extend a shared primitive; focus and nested-dialog regression must be repeated when real modules opt in. Roll back this package by removing the two optional `RecordModal` props/attributes, optional `FocusTrap` props, scoped workbench CSS, synthetic test/captures and this report. There is no data, schema, API or finance rollback.
