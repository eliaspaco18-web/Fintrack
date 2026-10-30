# FinTrack V3 Round 07: Stage 4 shared-UI gate

Implementation base: `499c70fa446b8152120314e9279145176a6ed655`, branch `codex/redisenio-total`. Stage 4 foundation packages 4A–4H are implemented as shared primitives. This is a **component gate**, not an authenticated-operation or release certificate.

## In scope and preserved

- Existing `AppSelect`, `Button` and `useToast` public usage remains compatible. A single selector and a single toast provider serve the app; no new data source, parser, mutation orchestrator, API contract, session handling, RLS or financial calculation was introduced.
- New presentation primitives `AnchoredActionMenu` and `V3Tabs` are not yet wired to production module actions or panels. Form fields retain all owner fields/validators. Existing success-activity persistence occurs once on dispatch, not on timeout/dismissal. Busy-button labels are caller-owned, and `stableLoading` is opt-in.
- Isolated browser tests cover selector search/commit/IDs/IME/portal/overflow/keyboard/mobile/exit/reopen/reduced motion; action-menu keyboard/disabled/flip/dialog ownership; tab keyboard/links/touch; button fixed busy width/disabled/accessible name; acknowledgement FIFO/lifetimes/pause/responsive/reduced motion/persistence; and V3 form geometry/errors/light/dark. Captures live in this implementation directory with `stage4-` names.

## Exit evidence, independently stated

- Production build: passed, 67 pages.
- Lint: passed.
- Full unit suite: **168 passed**.
- Local unauthenticated E2E with unavailable `127.0.0.1:54321` Supabase placeholder: **18 passed, 29 skipped**. No authenticated write executed.
- `git diff --check`: passed.
- Independent `npm run typecheck`: **not clean**; only the two pre-existing TS2614 named-import errors in `tests/unit/billing-cycle-integrity.spec.ts` and `tests/unit/credit-card-transfer-policy.spec.ts` remain. Build success does not erase this debt.

## Remaining gates and Stage 5 entry

S06 still requires a disposable authenticated Preview/Supabase target to certify any real create/edit/delete/activate/deactivate or payment write. Do not substitute the synthetic tests above. Physical mobile keyboard, Safari, 200% zoom, screen-reader focus and transformed/scrolling workbench placement remain production integration checks. The Round 07 feedback host still needs Stage 5 modal subtree/visible-heading anchoring and successful close handoff without reannouncement. Real action menus/panels must receive exact capabilities from their owning modules; Stage 4 does not make unsupported operations available.

Stage 5 may now prepare table/filter/detail/form/chart presentation **without** performing authenticated writes. Its own exit gate still requires real module integration, focus/dirty/unknown outcome checks and S06 where writes are involved. If a real contract contradicts the design, stop only the affected integration and request direction.

Rollback: revert the Stage 4 component/CSS packages individually using their reports. Retain the independently approved Stage 2 FT12/icon correction and Stage 3 pure finance presentation unless those separately fail. No database or persisted-data rollback is involved.
