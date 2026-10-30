# FinTrack V3 Round 07: Stage 4D anchored menu and selection exit

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This is a shared, UI-only primitive package. It does **not** replace module menus or certify any authenticated operation.

## Implemented

- `components/ui/AnchoredActionMenu.tsx` provides a menu of caller-supplied **real actions**; the primitive owns no mutation, success announcement, cache update or record capability matrix. It supports stable action IDs, optional detail/icon, disabled and destructive presentation. It never turns a disabled item into an operation.
- The trigger supports pointer and keyboard open. The menu uses menu/menuitem semantics, skips disabled items with ArrowUp/Down, accepts Home/End, closes Escape before parent overlay, returns focus to the trigger, and makes Tab/Shift+Tab continue relative to the trigger rather than from the portal's DOM tail. Pointer selection calls the supplied callback once; the caller still owns confirmation and verified outcome.
- Positioning projects the origin from the trigger and clamps the panel to the visual viewport, flipping above when the available room below is insufficient. A menu in a dialog is portaled into that dialog's accessibility tree. Pointer opening uses the approved 160 ms dock; pointer closing keeps the layer for the 110 ms exit, while keyboard/reduced-motion closing is immediate. Rapid reopening invalidates old cleanup timers. Styling uses the V3 14 px menu radius, neutral surfaces and 44 px mobile targets.
- The existing `AppSelect` received its specified 110 ms pointer exit and generation-guarded rapid reopening without changing controlled value/ID semantics. Keyboard and reduced-motion exits remain immediate. The V3 token scope no longer paints its canvas onto every nested portal root; full-page canvas painting stays with explicit body/shell ownership, allowing selectors and action menus to use the approved surface token in dark mode.

## Evidence and limits

- Isolated menu tests cover keyboard traversal, disabled actions, Escape/Tab focus, dialog ownership, viewport flip/clamp, exact callbacks, interruptible exit and reduced motion. The additional selector test covers the 110 ms exit, stale timer cancellation and immediate keyboard/reduced exit.
- Synthetic captures: `stage4-action-menu-light.png` and `stage4-action-menu-dark.png`. These show the standalone menu after entrance/theme color transitions settle, not a product route or authenticated action. The light menu is white; the dark menu uses graphite `#202327`, not the canvas color.
- Production build passed (67 pages); full unit suite passed (164/164); lint passed; `git diff --check` passed. Unauthenticated local E2E passed (16) with 29 skips and an unavailable loopback-only Supabase placeholder. These runs did not perform a real write. The independent `npm run typecheck` still reports only the two pre-existing TS2614 test-import errors recorded in Stage 0; the new menu/selector code adds no TypeScript error. Build pass is not a clean typecheck.
- A transformed/scrolling real workbench, Safari and short landscape visual viewport, full screen-reader behavior, active-modal menu stacking and ownership, and multiple rapid menu/selector interleavings still require integration QA. Stage 4H subsequently implemented the pointer-only selected-text settle in isolation. The menu is not wired into existing Topbar, QuickActions or record action handlers until their authorized stages.

## Risk and rollback

The new action menu is unused by production routes, so it has no financial side effects. The selector exit is a shared behavior change; actual authenticated form interactions remain an S06 gate. Roll back by removing `AnchoredActionMenu.tsx`, its focused test/captures and CSS rules, and reverting only the Stage 4D selector exit changes. Retain Stage 2 foundation tokens and earlier Stage 4 packages unless those independently fail. No data rollback applies.
