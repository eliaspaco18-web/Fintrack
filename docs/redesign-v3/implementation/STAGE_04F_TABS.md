# FinTrack V3 Round 07: Stage 4F shared tab control

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This is a UI-only tab primitive for same-page panels, not route navigation or a rewrite of the existing dashboard.

## Implemented

- `components/ui/V3Tabs.tsx` takes stable tab IDs and exact caller-owned panel IDs. It exposes tablist/tab semantics, `aria-selected`/`aria-controls`, roving Tab focus, ArrowLeft/Right and Home/End navigation, disabled-tab skipping, and immediate keyboard selection. It does not own panel state, fetch data or remount form drafts.
- The V3-scoped tab material is a quiet bottom boundary and 2 px selected teal rule, with neutral text, visible focus and 44 px mobile target height. It is not a row of large cards, and it does not introduce motion to financial values. Stage 5 owns any approved 160 ms **panel-content** settle; the tab control itself changes immediately for keyboard and reduced-motion use.

## Evidence and limits

- Two isolated Chromium tests pass for exact panel linkage, keyboard/disabled behavior and both-theme mobile material. Synthetic captures: `stage4-tabs-light-390.png`, `stage4-tabs-dark-390.png`. These are control-only screenshots, not module layouts.
- Existing `DashboardTabs` and production routes are not replaced here. The approved dashboard will be assembled in Stage 16; keeping its old six-tab UI temporarily is intentional rather than approval to keep it in V3.
- Real panel content must provide corresponding `role="tabpanel"` and accessible ownership when integrated. Focus return, interrupted drawer motion and preservation of a real record draft are Stage 5/6a checks. No authenticated write or S06 certification is claimed.

## Risk and rollback

The component is currently unconsumed by production routes, so its immediate risk is limited to shared CSS opt-in selectors. Remove `V3Tabs.tsx`, its test and scoped CSS/captures to roll this package back. No data, API or financial logic rollback applies.
