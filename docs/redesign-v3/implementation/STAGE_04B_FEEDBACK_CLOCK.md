# FinTrack V3 Round 07: Stage 4B feedback-clock foundation

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. Scope is the pure presentation clock and focused tests only. This package follows Stage 4A; it does **not** replace the existing toast provider/renderer, dispatch any acknowledgement from a real operation, or change notification persistence.

## Implemented

`lib/toast/v3-acknowledgement-clock.ts` models a queued/visible/closing acknowledgement with one monotonic remaining-time value, exact default lifetimes (success/info 4200 ms, warning 6200 ms, error 8200 ms), a 150 ms exit slot, FIFO promotion, desktop/tablet capacity 2, mobile capacity 1, overlapping hover/focus/hold/hidden pause reasons, explicit dismissal, capacity changes that preserve remaining time, and deduplication only for the same keyed variant/title/detail. Different outcomes for one record remain distinct. Queued time is free. A queued item dismissed before display disappears without occupying a visible slot. This helper owns no mutation, API call, financial value, activity persistence, DOM announcement or CSS animation.

`tests/unit/v3-acknowledgement-clock.spec.ts` covers visible versus queued lifetimes, overlapping pause reasons, same-content dedupe versus different outcomes, responsive capacity, exit slot and queued dismissal. The helper will be consumed by the **existing** `lib/toast/toast.tsx` provider in the next bounded package; creating a second provider is prohibited.

## Evidence and limits

- Focused pure unit tests: 5 passed.
- Independent TypeScript check still reports only the two pre-existing TS2614 test imports recorded in Stage 0; the new helper and tests add no TypeScript errors.
- No authenticated write, live toast, timing animation, visual screenshot, screen-reader or modal handoff is claimed by this package. In particular, a passing synthetic clock test cannot certify that an actual create/edit/delete operation succeeded or that the Round 07 renderer behaves correctly.
- S06 remains mandatory for real authenticated operation certification. The supported disposable Preview procedure is documented in `AUTHENTICATED_QA_SETUP.md`; no disposable target or credentials have been supplied in this session, and no production target is permitted.

## Risk and rollback

The main future risk is connecting this clock to an independent CSS timeout, which would create two drifting lifetimes, or altering `toast.success` activity persistence while changing the renderer. The next package must use `remaining` as the single source for both dismissal and its visual line and keep the current persisted-activity behavior. This helper is currently unconsumed; rollback is limited to removing the new helper, its test and this evidence file. No data rollback applies.
