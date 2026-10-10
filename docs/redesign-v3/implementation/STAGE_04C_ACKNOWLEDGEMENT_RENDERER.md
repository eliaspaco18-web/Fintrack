# FinTrack V3 Round 07: Stage 4C acknowledgement renderer

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This is the shared, UI-only renderer package after Stage 4B. It is **implemented but not authenticated-write certified**; Stage 4, modal ownership and action pilots remain open.

## Scope and preserved contracts

- Evolved the **existing** `lib/toast/toast.tsx` provider and renderer rather than mounting a second notification system. Existing `useToast()` helpers remain callable, including `success`, `error`, `warning`, `info`, `promise`, `dismiss` and `clear`. The pre-existing `/api/notifications` success-activity persistence remains; renderer updates do not add a new request or persist on close.
- The provider consumes the pure Stage 4B clock as the sole source of dismissal and the visible lifetime rule. It keeps a FIFO queue, at most two visible acknowledgements at desktop/tablet and one on mobile. Default displayed time is 4200 ms for success/info, 6200 ms for warning and 8200 ms for error. Queued time is free. Hover, focus, pointer hold and document-hidden pause the same monotonic remainder; queued hidden items inherit that pause when promoted. Closing reserves its 150 ms exit slot.
- The acknowledgement host is upper-right, 388 px maximum, with 16 px radius, controlled semantic accent, a 2 px remaining-time line, textual countdown and a separately dismissible button. The CSS uses the approved 230 ms top-right entry, delayed 160 ms glyph and 150 ms exit. Reduced motion removes travel and the decorative line but retains textual time and automatic dismissal. Success remains transient; no form result screen or fake Undo has been introduced.
- Actions and clock state have separate React contexts so 50 ms countdown updates do not rerender `useToast()` consumers. This is a UI optimization, not a new data cache.

## Verification

- Focused Playwright synthetic browser tests: 10 passed across pure clock and actual compiled provider/renderer; cover FIFO, complete queued lifetime, responsive capacity, overlapping pause, hover/focus, hidden queued promotion, reduced motion and dark/light appearance. No backend request or authenticated mutation is used by these tests.
- Synthetic mobile captures: `stage4-toast-light-390.png` and `stage4-toast-dark-390.png`. They show only the isolated feedback surface, not an authenticated application screen. The renderer is visibly upper-right in both themes, without the old bottom stack.
- Production build passed (67 pages); lint passed; full unit suite passed (160/160). Unauthenticated local E2E passed (16) with 29 skips, including the authenticated write cases. Supabase environment variables were overridden to an unavailable `127.0.0.1:54321` placeholder; the expected password-reset error was a refused loopback connection. `git diff --check` passed.
- Independent TypeScript check still fails only on the two pre-existing TS2614 imports in `tests/unit/billing-cycle-integrity.spec.ts` and `tests/unit/credit-card-transfer-policy.spec.ts`. Build/lint/unit pass are separate evidence, **not** a clean typecheck.

## Open integration gates

The current host is anchored below the shell topbar; Stage 5 must connect it to the **visible** module action row and to the accessible modal/workbench subtree. A successful close must transfer the same acknowledgement without restarting time or reannouncing it; errors must stay accessible inside the active form. Focus handoff, short viewport/visualViewport and keyboard collisions, interrupted sibling FLIP, action-specific dedupe keys, inline validation, real mutation outcome ownership and row updates are not certified here. Stage 6a/S06 is required to prove real authenticated create/edit/delete/state actions in a disposable non-production environment. No success claim may be inferred from these synthetic tests.

## Risk and rollback

The renderer changes all existing toast visuals through the shared provider, although the feedback CSS is scoped to its V3 host. A modal may currently obscure an acknowledgement until Stage 5 ownership is integrated. Existing success persistence must not be accidentally duplicated or removed. Roll back this package by reverting `lib/toast/toast.tsx` and the `ft-v3-toast-*` CSS block, then remove the Stage 4B clock and its tests if no consumer remains; do not revert unrelated Stage 2–4A files. No data rollback applies. Do not release this partial package without the remaining focus/modal and S06 gates.
