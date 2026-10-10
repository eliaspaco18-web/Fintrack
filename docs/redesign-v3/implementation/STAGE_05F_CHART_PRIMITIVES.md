# FinTrack V3 Round 07: Stage 5F read-only chart primitives

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This is a **presentation-only chart foundation**. Dashboard data fetching, financial formulas, chart-library dependencies and productive routes are unchanged.

## Implemented and preserved

- `ChartFrame` makes title, exact interval, unit and a factual short summary visible; `Ver datos` toggles a caller-supplied semantic exact-value table. It composes the existing `DataBoundary` for source-local initial/slow/error/empty/stale/partial/ready states, retaining the chart heading and retry context on failure. It never fetches or fabricates a zero series.
- `MonthlyFlowBars` renders paired income (solid semantic green) and expense (neutral outlined) magnitudes from supplied numbers on a zero-inclusive axis with 3–4 readable ticks. Missing values are gaps; all-zero series has only an honest baseline. Negative supplied values extend below zero. The selected-month wash, bracket, chart-local result and tooltip never mutate the surrounding summary. Hover/focus inspect; tap/click/Enter pin; Escape/outside hides the tooltip without clearing the pin. Arrow keys move among available visible groups. Mobile and narrow layouts show three groups; `MonthlyFlowDataTable` retains all six supplied months. No numeric bar transition or synthetic historical date is introduced.
- `CategoryRanking` retains caller-provided real category IDs and exact target links, distinguishing an actual category named `Otros` from an aggregated Others action. Only relative bar length is derived from the largest valid supplied amount; shares and formatted values are not recomputed.
- `BudgetProgressRow` shows supplied spent/limit/uncapped percentage/remaining or excess, with a six-pixel fill capped at the end tick. Invalid/unavailable denominator state has a reason and no fabricated fill or percent. Only track geometry is derived; the existing budget metric owns the financial calculation and exact period target.

## Evidence and limits

- Browser-driven component cases verify exact chart scope/table toggle/isolated error, category IDs versus aggregation, 107.5% budget with a 100% visual fill, monthly lens pin/hover/keyboard, missing/partial months, mobile three-group plot plus six-row table, and zero/negative domain behavior. Synthetic light/dark/mobile flow captures are `stage5-flow-*.png`. Visual inspection corrected axis/bar overlap and right-edge clipping before this report.
- These components are **not connected** to `/api/dashboard/*`. S02's localized month identity and source parity are not silently repaired here. A later Stage 16 adapter must preserve actual server values, prove scope/period identity and choose the documented non-link fallback when identity remains unverified. Category share and budget percentage must come from their owning existing helpers, not from these view components.
- Production build and lint pass. Full unit: 182 passed. Loopback-only unauthenticated E2E: 29 passed/29 skipped. Typecheck still reports only the two registered pre-existing TS2614 named `describe` test-import errors. `git diff --check` passes. No authenticated write or real financial data was used.

## Risk and rollback

An integration could pass a localized month as a verified date, use a paginated category subset as a full ranking, or pass a new formula for budget percentages. These are stage-specific stop conditions, not permissions granted by these primitives. Roll back the four new chart files, scoped CSS, synthetic tests/captures and this report; no source/API/schema/finance rollback applies.
