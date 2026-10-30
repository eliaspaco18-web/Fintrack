# FinTrack V3 Round 07: Stage 4H selection text settle

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This is an isolated presentation completion for the existing `AppSelect` primitive.

On a **pointer** commit that the controlled caller actually reflects in `value`, the selected label settles over 120 ms from Y2/opacity .5. No value or financial number animates; the text is immediately correct. Search, hover, Escape, keyboard Enter, reduced-motion and a rejected controlled update never trigger the settle. A later keyboard/reduced commit cancels any prior pointer-only visual timer. The existing 110 ms pointer exit and immediate keyboard/reduced exit remain unchanged.

The synthetic selector suite verifies the transient class, timer cleanup on rapid reopen and no settle for reduced-motion pointer selection. Real form ID/validation behavior is still an S06 integration gate. Roll back only this pointer-commit ref/state, CSS keyframes and focused assertions; no data or API rollback applies.
