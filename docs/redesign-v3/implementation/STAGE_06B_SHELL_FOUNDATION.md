# FinTrack V3 Round 07: Stage 6B shell foundation (partial gate)

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`, branch `codex/redisenio-total`. This package changes shell presentation and client layout state only. It does not modify auth, middleware, finance, Supabase, API contracts, routes, records or production data.

## Implemented

- The existing `sidebar-collapsed` string-boolean preference remains the only desktop collapse setting. Storage denial falls back to in-memory state; tablet (768–1199) always uses a 68px rail and mobile ignores the desktop preference. Tablet expansion is temporary and never persisted.
- Desktop navigation commits to 208px expanded / 68px compact; the 56px topbar and 28px desktop / 22px tablet / 16px mobile content padding use approved geometry. The 32px FT12 mark stays at x18 in the shell. Its exact approved paths/colors are rendered by the shared inline `FTMark`, so shell identity does not depend on a protected static-asset request. The app-icon asset and canonical `#07585B` background are unchanged.
- Display terminology and sidebar grouping follow the approved IA while preserving every existing href, item key and developer gate. The compact avatar now links to the existing profile route instead of being a nonfunctional button.
- The topbar owns the named desktop/tablet expansion control. The tablet labels open as a 208px modal overlay above the unchanged 68px rail; background inert/scroll ownership and focus containment reuse existing V3 infrastructure. Escape, outside activation, close and route choice dismiss it. The branded rail behind the overlay remains at the same x coordinate.
- Rail tooltip uses 300ms pointer dwell, immediate keyboard focus and an 800ms fast transition between destinations. It renders outside the scroll clipping region, dismisses on scroll/Escape/blur/leave and never takes focus.
- Pointer desktop collapse commits layout immediately, scales only a flat sidebar backdrop over 240ms and translates the workspace with a measured FLIP offset. Wordmark closes in 100ms and opens in 150ms after 55ms. Keyboard/reduced-motion changes settle immediately. A rapid reversal uses the current computed workspace translation; a reduced-motion or breakpoint change cancels the pending movement.

## Evidence and current limits

Rollout correction: this V3 shell is now explicitly local-development/Preview-only and opt-in; the previous renderer remains the default. See `STAGE_06_ROLLOUT_SWITCH.md`. The original package counts below are checkpoint counts, superseded by the final verification in that rollout report.

- At this package checkpoint: `npm run lint` pass; `npm run build` pass; full unit 186 passed; local unauthenticated E2E 33 passed / 29 skipped; `git diff --check` pass. Later Stage 6C work increases the repository-wide counts without changing this package's tests. `npm run typecheck` still reports only the two registered pre-existing TS2614 `describe` import errors in `tests/unit/billing-cycle-integrity.spec.ts` and `tests/unit/credit-card-transfer-policy.spec.ts`.
- New tests cover 767/768/1199/1200 breakpoints, preference key/denial, interrupted FLIP math, tooltip timing/focus/scroll and isolated shell material. Geometry screenshots: `stage6-desktop-expanded-light.png`, `stage6-desktop-compact-dark.png`, `stage6-tablet-rail-light.png`, `stage6-tablet-overlay-dark.png`. These are **synthetic material fixtures** on an unauthenticated route, not authenticated screenshots of the productive shell, routing or focus behavior.
- The unauthenticated SVG request for `/brand/v3/ft-ligature.svg` is redirected by the existing middleware to login; this is why shell identity uses the exact inline paths. No middleware exception was added. Public app-icon/fav/PWA retrieval still needs its own safe verification before shipping; this package does not claim it.
- Stage 6B is **not certified complete**: real authenticated tablet focus/route/breakpoint checks and visual comparison on actual module content remain. Stage 6C mobile dock/Registrar and Stage 6D route reveal have not been implemented in this package. S06 still blocks certification of authenticated writes, not this read-only foundation.

## Files, risk and rollback

Changed in this package: `lib/hooks/layout-state.ts`, `lib/hooks/useLayout.tsx`, `lib/constants/nav.ts`, `components/layout/AppShell.tsx`, `Sidebar.tsx`, `FTMark.tsx`, `NavItem.tsx`, `Topbar.tsx`, `app/globals.css`; tests `tests/unit/v3-layout-state.spec.ts`, `v3-rail-tooltip.spec.ts` and `tests/e2e/v3-shell-material.spec.ts`; isolated screenshots and this report. Existing session providers, route targets and data fetches were retained.

Risk: a production authenticated viewport may expose a focus/overlay race or an unexpected shell reflow that synthetic geometry cannot prove. The full unit/E2E suites did not exercise authenticated shell interactions. Do not label this package release-ready. A code-only rollback restores the nine shell/style/state files and removes only the three new tests and this Stage 6B evidence; preserve unrelated Stage 2–5 edits and all user work. No database rollback applies.
