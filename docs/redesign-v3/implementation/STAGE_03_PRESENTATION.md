# FinTrack V3 Round 07: Stage 3 presentation primitives

Implementation base: `499c70fa446b8152120314e9279145176a6ed655`. Prerequisite: Stage 2 scoped token foundation, without any route opt-in. Stage 1 S packages remain independently gated.

## Scope and contracts

- `lib/finance/v3-money-display.ts`: pure formatting of a **supplied number** and **supplied original currency**. It does not parse input, sum balances, calculate FX, retrieve data, change stored precision, or infer operation type. Missing/invalid/unsafe-large input is unavailable, not zero. Custom/unknown currency code remains explicit. The caller supplies the real direction.
- `components/finance/MoneyText.tsx`: tabular, exact-amount rendering with optional already-verified equivalent and provenance. Income/expense/transfer color is a supplied presentation role; transfer is neutral. The component does not perform conversion.
- `components/finance/FinancialScope.tsx`: visible scope and an information control for basis, supplied period/as-of, exclusions and unavailable sources. No fabricated freshness date.
- `components/finance/PositionBand.tsx`: separate native account, receivable and payable groups. It accepts already-verified amounts in their caller-defined order; it never nets groups or currencies. A partial-source warning can coexist with healthy amounts.
- `components/finance/DataBoundary.tsx`: independently owned initial/slow/ready/empty/filtered/error/stale/partial presentations. The caller supplies the geometry skeleton, state and retry callback. It does not fetch, mutate, turn errors into empty states, or discard prior data on stale/partial reads.

None is currently imported by an operational route. Existing financial helpers, services, forms, Supabase, APIs, auth, and module renderers remain unchanged. Stage 7/16 integrations must use current verified owners and adapt their real data states; these components are not a second finance engine.

## Evidence

- `tests/unit/v3-money-display.spec.ts`: four focused cases covering PEN/USD/custom, separators, precision, zero/negative zero, missing/invalid/unknown currency, large unsafe values, explicit direction and unchanged source object.
- Full unit suite after Stage 3: **145 passed**.
- Lint: passed.
- Production build: passed; routes still use the previous renderer.
- Independent typecheck: the same **pre-existing two TS2614 imports** from Stage 0 remain in unrelated billing-cycle and credit-card-transfer unit files. No new Stage 3 TypeScript error was emitted after a successful build and sequential check. Do not silently call this a clean typecheck.
- `git diff --check`: passed for tracked edits; new files are covered by lint/build and manual review.
- Stage 2 both-theme desktop/mobile sentinel captures remain the token visual evidence. Stage 3's components have no production route consumer and thus no honest authenticated module screenshot or visual acceptance claim yet.

## Risks and next gate

The principal integration risk is passing a partial/capped source as complete or deriving direction from a displayed sign instead of the stored operation. Another risk is relying on `MoneyText` to validate business precision or resolve unknown currency metadata; it explicitly does neither. At 320px and 200% zoom, real-source long amounts and scope popover collision must be measured when a module first consumes these components. Do not infer that a TypeScript build certifies visual/accessibility behavior.

Stage 4 evolves shared selectors, buttons, toast and focus ownership used by existing live modules. Without an approved disposable authenticated QA target (S06), it cannot pass the required consumer regression gate. The baseline independent typecheck also needs a separate, narrowly scoped test-source correction. Do not integrate Stage 4 broadly or activate a V3 route until those gates are resolved. Stage 3 pure components can remain staged safely.

Rollback is code-only: remove these new unconsumed components, formatter and their focused tests; leave old consumers untouched. No data/migration rollback applies.
