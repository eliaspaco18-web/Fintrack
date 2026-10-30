# FinTrack V3 Round 07: Stage 5E filter shell and scope chips

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This is a **presentational opt-in** package. Existing module queries, saved views, pagination, selection and handlers are untouched.

## Implemented and preserved

- `V3FilterDrawer` uses the same detached 580 px workbench, independently scrolling body and fixed action footer. Its caller supplies the actual fields, draft state and Apply/Cancel/Clear callbacks. The component never reads or writes a URL, fetches data, or creates a second filter authority. Apply uses the existing V3 stable-busy button; cancel/veil/Escape are disabled while `applying` is true.
- `V3ScopeChips` renders caller-owned filter IDs/labels, an individual accessible removal button and optional Clear All callback. It never infers a financial scope or resets unrelated filters. Chips use neutral material and 30 px desktop/44 px touch remove targets.
- An internal `RecordModal` close source makes Escape/keyboard close immediate even when the workbench was opened by pointer; pointer veil/close exit retains the approved motion. This is still opt-in and does not change current legacy modal timing.

## Evidence and limits

- Two browser-driven unit cases show that editing, clearing and canceling a draft do not change the applied value, while Apply does; removing one chip leaves the other intact. Three synthetic local-browser material checks pass in light desktop, dark desktop and light mobile, with captured `stage5-filters-*.png`. These tests do not claim the production `TransactionTable` URL adapter is migrated.
- The synthetic filter screenshots show example fields and chips only. Production Stage 9 must preserve all current account/category/date/type/currency/sort/page-size controls, query spelling, saved views, selection clearing and export scope. `V3FilterDrawer` must stay mounted with `open=false` for its exit animation.
- Production build and lint pass. Full unit: 182 passed. Loopback-only unauthenticated E2E: 29 passed/29 skipped. Typecheck still reports only the two registered pre-existing TS2614 named `describe` test-import errors. `git diff --check` passes. No authenticated write, production data or API/schema change occurred.

## Risk and rollback

An owning module could mistakenly commit on field change or Clear, or drop an existing query key. Its integration tests must prove no request/URL change before Apply and exact key preservation afterward. Roll back the two filter components, scoped CSS, focused tests/captures and this report; remove the optional close-source handling if it is not used elsewhere. No data rollback applies.
