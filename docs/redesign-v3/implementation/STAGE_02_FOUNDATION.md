# FinTrack V3 Round 07: Stage 2 foundation evidence

Implementation base: `499c70fa446b8152120314e9279145176a6ed655` on `codex/redisenio-total`. Scope: the isolated Stage 2 visual foundation only. Stage 1 structural/stability gates remain separate and open. No product route is opted into V3 yet.

## Changed files and purpose

- `app/globals.css`: approved Round 07 light/graphite tokens, radii, neutral elevation, motion constants and compatibility aliases under **`[data-ft-v3]` only**. Existing `:root` tokens are unchanged.
- `app/layout.tsx`: registers local Manrope 400/600/700 as a Next static asset variable, with no global font-family replacement and no preload. This avoids the existing middleware's redirect for unauthenticated `/public/fonts` URLs without changing auth.
- `lib/tokens.ts`: adds `V3Tokens` references to scoped CSS variables; old exports and consumers remain unchanged.
- `tailwind.config.ts`: adds an opt-in V3 font utility and the approved semantic radius utilities, without remapping existing font/radius classes.
- `public/fonts/v3/*`: exact copies of the three reviewed Manrope TTF files plus their SIL OFL license. The font source files are not fetched from a remote host. Next emits them under its existing static asset path.
- `public/brand/v3/ft-ligature*.svg`, `ft-favicon.svg`, `ft-app-icon.svg`: exact approved FT12 light/dark/mono, optical favicon, and app-icon vectors, copied without geometry changes. The owner resolved the app-icon background to the preview's `#07585B`; none of these assets is wired into existing navigation/metadata yet.
- `tests/e2e/v3-foundation.spec.ts`: local unauthenticated sentinel verifies the opt-in palette/font in both themes and that legacy body styling remains unchanged.

No API, Supabase, RLS, authentication/middleware, financial helper, calculation, schema, route, existing form, production record, or existing module renderer was changed.

## Verification

- `npm run test:unit`: 141 passed after Stage 2.
- `npm run lint`: passed.
- `npm run build`: passed (67 pages).
- Final combined local E2E run (`v3-foundation`, login, redirects and API auth): **16 passed, 1 environment-dependent case skipped**. The two V3 sentinel cases passed in both themes using a local server with placeholder Supabase variables, no login or financial mutation. This is **not** authenticated QA.
- `git diff --check`: passed.
- `npm run typecheck`: still fails with the same two TS2614 `describe` imports in `tests/unit/billing-cycle-integrity.spec.ts` and `tests/unit/credit-card-transfer-policy.spec.ts` recorded before Stage 2. A simultaneous initial run raced Next's generated types while build was running; the sequential rerun reproduced only the two baseline failures. This implementation did not modify those tests.
- Static contrast check for approved pairs against a surface: light normal text14.49:1, muted6.12:1, primary7.56:1, income5.69:1, expense5.65:1 and control boundary3.09:1; dark text13.78:1, muted8.47:1, primary8.98:1, income9.39:1, expense7.72:1 and boundary3.86:1. Actual component combinations need later per-stage checks.

Both-theme sentinel captures use synthetic text and amounts and a test-only DOM attribute, **not** a product route or simulator implementation:

- `stage2-sentinel-light-1440.png`
- `stage2-sentinel-dark-1440.png`
- `stage2-sentinel-light-390.png`
- `stage2-sentinel-dark-390.png`

Unopted `/login` before/after captures are retained next to them. Computed legacy body font/background remain the same in both themes; a raw pixel comparison is not treated as conclusive because the existing page loads remote fonts and can reflow between captures. No protected module visual comparison is claimed without the disposable authenticated target.

## Deliberate holds and differences from the preview

1. **App icon conflict resolved by the owner after Stage 2:** the canonical app-icon background is `#07585B`, matching the reviewed preview. The Master and Handoff now state this explicitly, and the vector is staged unchanged. `#104B47` remains only the separately approved primary-hover token. Product icon activation and PWA/store exports remain later packaging work.
2. Existing middleware redirects unauthenticated requests to ordinary public asset paths, including `/brand/*` and `/fonts/*`. The self-hosted font is bundled by `next/font/local` under `/_next/static` and therefore works without auth changes. The new SVG files are staged, not activated on unauthenticated pages; no middleware or API change is made here.
3. The reviewed TTFs are used directly, each roughly93KB. Optimized WOFF2/subsetting is a later packaging/performance check before release, not a reason to fetch a font from the network or add an unapproved dependency in this scope.
4. The Stage 2 screenshots are token sentinels. They do not claim module geometry or faithful production-dashboard matching. The next stage may consume these scoped variables without activating the full V3 shell.

## Risks and rollback

The main risk is a future component omitting the opt-in attribute and reading old aliases, or opting a broad legacy tree in before its child styles are migrated. Stage ownership must set `data-ft-v3` on only the approved module/shell boundary. A second risk is global font registration adding asset weight; `preload:false` and the absence of a global family switch limit this.

Rollback is code-only: revert the scoped CSS/token/font-registration patch and remove the new unreferenced asset/test files. Do not reset the branch, change middleware, or revert unrelated owner artifacts. No data rollback exists or is needed for this stage.
