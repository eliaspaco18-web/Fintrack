# FinTrack V3 Round 07: Stage 4E form-control material

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This package styles existing controls **only inside a V3 opt-in region**. It does not replace fields, validators, numeric parsing, form payloads or submit handlers. Stage 4 and authenticated write certification remain open.

## Implemented

- V3-scoped `input.field-base` and `textarea.field-base` use the approved 44 px minimum control height, 10 px radius, neutral white/graphite surface, 13 px text and tabular digits. Existing amount inputs use 64 px minimum and 28 px tabular text; textareas remain at least 88 px. The existing `NumericInput` parser and blur/storage behavior were not touched.
- Focus uses a 2 px visible ring, invalid fields retain a separate danger border/ring, and disabled fields remain readable without lowering the entire control to 55% opacity. The stronger dark selectors intentionally override the legacy `.field-base` dark surface-muted rule **only** in V3. No styling leaks into routes that have not opted into V3.
- Synthetic light/dark input captures are `stage4-fields-light.png` and `stage4-fields-dark.png`. The fixture includes ordinary, amount, textarea, invalid and disabled fields. It is not an abbreviated production form or proof of a real validation/submission flow.

## Verification and limits

- Production build passed (67 pages), lint passed, full unit suite passed (164/164), and local unauthenticated E2E passed (18), with 29 authenticated/environment-specific cases skipped. Supabase was overridden to an unavailable loopback-only placeholder; no real data write occurred. The two new local browser checks assert both-theme surface color, control geometry, invalid border, preserved `aria-describedby`, disabled/readable state and keyboard focus ring.
- Independent `npm run typecheck` still fails only on the two pre-existing TS2614 test imports in `tests/unit/billing-cycle-integrity.spec.ts` and `tests/unit/credit-card-transfer-policy.spec.ts`. Build, lint, unit and E2E pass are not reported as a clean typecheck.
- Real forms can have custom classes/attachments/conditional fields. Stage 5 and module pilots must verify every existing field, blur/submission validation, error summary, first-invalid-field focus, responsive keyboard/200% zoom and dark contrast in context. This style package is not S06 authenticated write evidence. Do not simplify real forms to match the synthetic fixture.

## Risk and rollback

The main risk is a V3 form-specific selector with still-higher specificity retaining a legacy surface; inspect it when its module migrates. Revert only the Stage 4E CSS rules, the synthetic `v3-form-controls.spec.ts` test and its two captures if the material must be withdrawn. No financial data or schema rollback applies.
