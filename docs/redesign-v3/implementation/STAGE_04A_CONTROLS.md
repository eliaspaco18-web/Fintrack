# FinTrack V3 Round 07: Stage 4A shared controls

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`, branch `codex/redisenio-total`. This is a bounded **implemented** component package, not completion of Stage 4 and not certification of authenticated writes. The owner clarified that S06 remains a release/write gate but does not prevent safe shared-component work.

## Implemented

- `components/ui/AppSelect.tsx` remains the single selector primitive; existing `options`, stable `value`, `onChange`, metadata, compact, labels and caller props remain accepted. Search is now present at every option count, including existing `searchable={false}` callers. Accent-insensitive label/hint filtering does not commit a field. Enter/click commits an actual option value; hover, query, no-match, loading, error, Escape and Tab do not. A missing selected option retains the controlled ID and shows an explicit prior-selection label rather than silently choosing the first result.
- `useId` replaces the random selector ID. The trigger, nonmodal selection dialog, editable combobox and listbox have rendered ID relationships; the active descendant and selected check are distinct. Escape closes this layer before the parent modal; Tab/Shift+Tab returns to the adjacent form control. Disabled options are not committable. IME composition does not trigger Enter selection. Loading/error/retry/partial-coverage slots are presentation props only; the owning form retains its request and validation logic.
- The selection panel stays in the nearest existing dialog's accessibility subtree, or the document body outside a dialog. Viewport measurement clamps a desktop panel, flips when needed and bottom-anchors a mobile panel to the visual viewport. It does not create a second modal trap or add a selection endpoint. V3 visual material is scoped to `[data-ft-v3]`; the dark trigger override prevents legacy `.field-base` from replacing the approved graphite surface.
- `components/ui/Button.tsx` retains all existing props and variants, exposes stable V3 size hooks, communicates busy state, and makes disabled/loading links non-navigable. V3-only CSS applies the approved control radius, desktop sizes, touch minimums and visible focus; unopted module geometry remains legacy.
- The owner-approved FT12 app icon is staged in `public/brand/v3/ft-app-icon.svg`, exactly matching the preview's geometry and `#07585B` background. The Master Plan and Handoff now identify `#07585B` as canonical; `#104B47` remains the separate primary-hover token. The icon is not activated in app metadata/PWA yet.

No financial parser, calculation, data model, route, API, auth, RLS, Supabase schema, mutation handler or production record was changed. No test logged into an account or performed an authenticated write.

## Verification and visual evidence

- Production build: passed, 67 generated pages.
- Lint: passed.
- Unit suite: **150 passed**, including five isolated Chromium selector interaction cases for commitment/focus/IME guard, prior ID and distinct IDs, loading/error/retry/no-match, dialog ownership/flip, and mobile bounds. The browser harness transpiles the real component into a synthetic page; it is component evidence, **not** authenticated form integration.
- Unauthenticated local E2E with loopback-only dummy Supabase variables: **16 passed, 1 environment-dependent case skipped** across login, redirects, API auth and V3 foundation. The password-reset test's expected generic response logged a refused connection to the loopback placeholder. No real Supabase target was contacted.
- Independent `npm run typecheck`: still fails only the two pre-existing TS2614 test imports in `tests/unit/billing-cycle-integrity.spec.ts` and `tests/unit/credit-card-transfer-policy.spec.ts`. New Stage 4A TypeScript errors encountered during development were corrected. Build/lint/unit pass are reported separately, not represented as a clean typecheck.
- `git diff --check` and exact vector diff pass.
- Synthetic compiled-CSS captures: `stage4-select-light-1440.png`, `stage4-select-dark-1440.png`, `stage4-select-dark-390.png`. They demonstrate the component's surface/search/selection/mobile placement. They are not product-route screenshots or proof of a real mobile keyboard.

## Not yet certified / remaining Stage 4 work

- S06 has no approved disposable Preview/Supabase target or dedicated QA user in this session. **No create/edit/delete/state write is certified.** Existing caller compatibility under actual authenticated forms, historical selections and validated submission remains a required S06 gate before release.
- Physical iOS/Android virtual keyboard, Safari portal clipping, screen-reader announcements, 200% zoom, long option labels, 100+/paged option sources and full runtime reduced-motion integration need targeted QA. Stage 4D subsequently added the 110 ms pointer exit with rapid-reopen cancellation; Stage 4H added the pointer-only 120 ms selected-text settle. Neither isolated change certifies a real form. Do not claim Stage 4 complete.
- Round 07 toast renderer/timer and the anchored action-menu primitive were implemented in later Stage 4 packages; full inputs/tabs/focus integration and Stage 5 form/detail shells remain open. At the close of this Stage 4A package, existing toast persistence and APIs were untouched. The approved preview's abbreviated forms are not a field inventory.
- The selector's always-searchable behavior intentionally changes existing short-list interaction even before route opt-in. This is a compatibility risk; do not ship the branch as a standalone production patch without S06 form regressions. The visual CSS is opt-in but the shared selector behavior is not.

## Rollback

Revert only the Stage 4A edits in `components/ui/AppSelect.tsx`, `components/ui/Button.tsx`, their scoped rules in `app/globals.css`, the focused test and three synthetic captures if this package must be withdrawn. The icon/document correction is independently approved and need not be reverted with the controls. No database or persisted-data rollback is required.
