# FinTrack V3 Round04 — Refinement Evidence and QA

Date: September22,2026 (America/Lima). Browser timestamps below are UTC. Baseline: `4fdbe715f1a887ff59fc64868bf2da06c2d0cdae`; branch `codex/redisenio-total`.

## Outcome and scope

Ready for owner **design review**, not production implementation or release certification. Round04 preserves FT12, light identity, dashboard composition, chart inspection and contextual workbenches. It refines Credits scalability, Planning coherence, ledger density/direction, graphite dark surfaces, collapsible shell, route reveal and persistent creation. The complete round03 was archived before edits.

| Check | Executed result | Limit |
|---|---|---|
| Existing financial-integrity unit suite | **117 passed**,885ms | Focused helpers; not authenticated financial E2E |
| General prototype suite | **89 passed** | Includes16 selected light/dark contrast checks |
| Preserved motion/refinement suite | **33 passed** | Drawers, interruption, scope, keyboard/reduced, geometry |
| New round04 suite | **60 passed** | Credit scale, shell/logo, density, FAB, route timing, responsive |
| Total prototype assertions | **182 passed** | Local synthetic Chromium only |
| Runtime errors / unexpected external requests | **0 /0** in all final browser runs | Non-local requests also blocked by test routing and CSP |
| Capture gallery | **46 current PNGs** |01–35 refreshed;36–46 new round04 references |
| Production tracked diff | **Empty** | Documentation and isolated proposal artifacts only |
| Authenticated E2E | **Not run** | No authorized disposable authenticated environment established |
| App build/lint/typecheck | **Not run** | No production code, configuration or dependency change |
| Effective Supabase/RLS/RPC verification | **Not run** | Existing source concerns remain separately gated |
| Real API/auth/financial operations | **None** | Preview has no app environment, credentials or service client |

Final general run: `2026-09-23T03:26:58.445Z`–`2026-09-23T03:27:10.518Z`.
Final motion run: `2026-09-23T03:27:05.824Z`–`2026-09-23T03:27:11.776Z`.
Final round04 run: `2026-09-23T03:27:38.175Z`–`2026-09-23T03:27:44.108Z`.

Assertion records: [general](screenshots/verification.json), [motion](screenshots/motion-verification.json), [round04](screenshots/evolution-verification.json). All report failure=null. Unit execution emitted only non-failing color-environment warnings. No dependencies or runtime configuration changed; production CI continues to require the repository-supported Node20 environment.

## What was exercised in round04

- Default credit scope explicitly identifies the12-product expanded review sample as separate from Inicio.
- Eight rich rows/page, pagination to remaining active products, type filter, search with meaningful no-match/reset, closed-state filter,40-product stress fixture.
- Base sample reconciles card debt4,800PEN +180USD and original loan principal10,800PEN with Inicio. Expanded active card buckets10,370PEN +800USD and original loan principal57,300PEN remain separate.
- Selected loan detail retains exact680 installment and500/150/20/10 components; installment drilldown cannot inherit a card's1,200 payment.
- Desktop collapse208→68 frees workspace, persists reload, keeps FT at exactly x18/y50/32×32 including28px review chrome. Tablet expansion also preserves logo coordinates.
- Rail focus tooltip and Escape dismissal; tablet label surface keeps workspace x68, uses modal/inert semantics, traps focus, restores trigger on Escape. Tablet close44×44.
- Movements12-row desktop reference measures49px, last48.5px including collapsed borders; income/expense/transfer amounts have distinct semantic colors.
- Graphite dark canvas#17191C and surface#202327 verified from computed tokens.
- Registrar includes all8 operation identities and the module-specific budget action; keyboard opens at first item, Escape restores button, transfer opens existing simulator form, modal hides background FAB.
- Mobile uses rich credit rows with44px inspection targets. Registrar occupies a dedicated bottom-dock slot; destination items do not overlap it. Menu remains within viewport.
- Pointer navigation has exactly three timing groups ending228ms; focus moves to the new heading; rapid navigation settles on the last module.
- Reduced and keyboard navigation have no active route animations.
- Forty-credit dark sample has no page overflow at320/375/768/1024/1280/1920.

Preserved general and motion suites still cover source-scope drilldowns, original-currency agenda, truthful filter-empty, edit/save simulation, dirty Back/dismiss, popover keyboard behavior, exact chart inspection without summary changes, workbench interruption,580px frame continuity,24px corners, mobile8px inset and skeleton geometry.

No assertion implies exhaustive keyboard coverage of every secondary module or financial integration. Simulator focus/route behavior is not certification of the production React implementation.

## Visual inspection and corrections

Actual rendered light/dark desktop, tablet and mobile captures were inspected, including expanded/compact shell, credit register/detail, Planning summary, quick menu and dense ledger. Iterations corrected real issues:

| Before inspection | Final adjustment | Why |
|---|---|---|
| Wide desktop FAB pill and mobile floating FAB could cover amounts | Compact52px desktop action; mobile56px reserved dock slot | Creation remains visible without obscuring mobile financial reading |
| Inherited tablet rail CSS squeezed expanded labels/icons | Explicit full-width nav rows and stable brand alignment in tablet overlay | Expansion is a real readable navigation surface, not labels hanging off a narrow rail |
| Collapsed profile avatar shrank under hidden text | Non-shrinking avatar; hidden copy does not squeeze identity | Stable compact geometry |
| Tablet next-payment date ran into amount | Stacked amount/date at tablet width | Exact numbers remain scannable |
| Desktop keyboard route test observed incidental CSS transitions | Keyboard input disables CSS transitions throughout the preview | Immediate keyboard policy applies beyond the route wrapper |
| Labels disappeared immediately during sidebar collapse |100ms inert departing-label layer; persistent real FT mark | Coherent transition without stretching text or duplicating interactive content |
| Touch credit detail/close controls were undersized |44px explicit targets with compact row positioning | Density must not remove comfortable activation |

A first test run read ledger rows before hash navigation committed; the assertion now waits for the actual module and checks a nonzero expected row count. This corrected test timing, not a financial implementation. Final assertions above pass.

## Financial findings and boundaries

Fresh source checks included `CreditsWorkspace`, `CreditsListPanel`, `lib/credits/display-type.ts`, `modules/credits/credit-detail-presentation.ts`, `Sidebar`, `AppShell`, `QuickActionsFAB` and `lib/hooks/useLayout.tsx`.

The loan presenter uses verified original principal, not a generic remaining-balance field. The previous preview label “Capital pendiente” was corrected to “Capital original”; unknown remaining principal stays explicitly unavailable. CARD/LOAN/LINE evidence must be preserved; raw credit type alone cannot safely classify all products.

The deployed shell already has a collapse preference and FAB. The handoff reuses their ownership and `sidebar-collapsed` key rather than creating a competing preference; it repositions existing theme/profile/currency utilities without deleting them. No production files were edited.

Existing S01–S06 and O01–O12 remain independent gates. No read-triggered legacy repair, new query, API contract, migration, financial formula or authentication change was introduced. Expanded credit fixtures are synthetic and module-scoped, never silently added to Inicio.

## Accessibility and unverified limits

Selected16 color pairs pass their4.5:1 text/3:1 control thresholds in the updated themes. This is not exhaustive WCAG certification. Real screen-reader testing,200% browser zoom, physical touch/virtual keyboard, Safari/Firefox, blocked-storage integration, route-history restoration, production dirty-route guards and authenticated financial E2E remain implementation obligations.

Only navigation preference persists locally in the preview. Financial saves are simulations. Some secondary actions explain unsupported scope. The prototype's global overrides, generated fixtures, review-only pagination8, fixed dates, hash routing, duplicate responsive markup and simplified forms must not be copied as production architecture. Use the master/handoff contracts and existing source ownership.

The animated sidebar uses Web Animations on a pseudo-element in the tested Chromium. Production must validate target-browser support; an unanimated correct layout is the temporary compatibility fallback, not permission to scale text or add a dependency. Motion is never required to access content.

## Reproduce

From repository root, start the isolated server if absent:

```sh
node docs/redesign-v3/preview/serve.mjs
```

Run separately:

```sh
node docs/redesign-v3/preview/verify.mjs
node docs/redesign-v3/preview/verify-motion.mjs
node docs/redesign-v3/preview/verify-evolution.mjs
./node_modules/.bin/playwright test --config=playwright.unit.config.ts
```

Browser scripts write proposal PNG/JSON evidence only. Syntax checks passed for changed preview scripts/verifier; tracked `git diff --check` and `git diff --name-only` were empty. Browser launch followed normal permission approval; no restrictions were weakened.

## Files, risk and rollback

Changed: root master/handoff; preview index, dark tokens and bootstrap; new `evolution.css`, `evolution.js`, `verify-evolution.mjs`; live workshop scenes; README/QA; current screenshots/reports. Added complete `archive/round-3/` before edits. PRODUCT and production components/logic/config/API/auth/data/Supabase remained untouched. No commit, push or deployment.

Future implementation risks: summary coverage with paginated credit sources, wrong payment target, lost draft/focus during route/overlay changes, storage/hydration compatibility, small-screen menu collisions. Master3.3/9.5.1 and handoff4.4 specify behavior, acceptance and stop points.

Design rollback: reviewed restoration of proposal files from `archive/round-3/`; preserve unrelated work. Do not reset the repository or run a database operation. Liking this preview does not itself authorize implementation or deployment.
