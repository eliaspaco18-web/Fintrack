# FinTrack V3 Round 07: Stage 4G stable busy button

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This package extends the existing button primitive; it does not dispatch, validate or certify any financial operation.

## Implemented

- `Button` accepts opt-in `stableLoading` and `loadingText` for string-labeled actions. Two grid layers reserve the maximum idle/busy width from the beginning, so the button does not jump after a confirmed submit starts. The visible layer supplies the accessible label; the other is hidden. Loading disables the button and sets `aria-busy`, preserving the current no-double-submit contract. Non-opted callers retain their prior rendering.
- V3 busy buttons retain full semantic contrast instead of inheriting the generic 50% disabled opacity. The operation owner chooses the correct busy verb; the primitive does not assume that every operation is a save. There is no artificial wait, animation-driven success or new network request.
- A synthetic Chromium test measures identical idle/busy widths, checks the `Guardando…` accessible name and disabled/busy state, and proves one click invokes one callback. Light/dark synthetic captures are `stage4-button-busy-light.png` and `stage4-button-busy-dark.png`. The dark capture was visually checked after correcting busy-state contrast.

## Integration and gates

Migrated module buttons should pass `stableLoading` and an operation-specific `loadingText` in their own stages; this stage changes no production form handler. Complex non-text button children still use the compatible legacy rendering, so those cases need per-module width review. Error/unknown outcomes remain owned by the existing action flow and S06. No authenticated write was performed or certified.

Rollback: remove the opt-in props/grid branch, the `ft-v3-button-lock`/busy CSS rules, this test and captures. Existing click handlers, APIs and persisted data need no rollback.
