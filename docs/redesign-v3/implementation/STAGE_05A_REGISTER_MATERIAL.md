# FinTrack V3 Round 07: Stage 5A register-density foundation

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. This is the first **read-only presentation** package of Stage 5, after the Stage 4 shared-component gate. Stage 5 is not complete.

## Implemented and preserved

- Existing `DataTable` accepts an optional `density` value: `movement`, `standard`, `credit` or `catalog`. Omitting it preserves the current legacy presentation. No row/selection/filter/pagination/action handler, query parameter, API payload, record ID or financial amount is changed.
- In a V3 opt-in region, a semantic table receives a neutral surface, accessible header/body boundaries, minimum row height and content-driven growth. Desktop Movements are at least 48 px with a 34 px header; tablet/touch Movements at least 56 px. Standard two-line rows are at least 56 px, catalog rows 48 px and credit rows 68 px desktop/80 px mobile. The density belongs to the *real module*, not a runtime switch for the user.
- An amount cell is right-aligned and tabular only when the caller marks it `data-ft-amount-cell`. Income, expense and transfer colors apply only when the owning module supplies an explicit `data-ft-amount-direction`; CSS never guesses operation identity from the sign. Neutral row hover and keyboard `focus-within` do not recolor the full table by module.

## Evidence and limits

- Three local synthetic browser cases passed at 1440/834/390 px and verified minimum row geometry, header height, amount alignment and semantic direction colors. Light/dark isolated captures are `stage5-register-light-1440.png` and `stage5-register-dark-1440.png`; these use synthetic records, not production data. At the Stage 5B checkpoint, build and lint pass, unit tests are 168 passed, and local unauthenticated E2E is 26 passed/29 skipped. Typecheck still has only the two registered pre-existing TS2614 test-import errors.
- This package does **not** replace the production Movements table, create a mobile card renderer, change the Credits register, alter pagination, implement saved views or touch selection/export/bulk behavior. Those belong to later module stages and require their own contract tests. A data-rich cell is allowed to grow beyond the minimum height; truncating money to enforce density is prohibited.
- Stage 5 remains open for FilterDrawer/ScopeChips, the 580/960 px workbench frame, modal lifecycle/focus/dirty guards, ChartFrame and real responsive integration. No authenticated write occurred. S06 remains required before certifying any mutation after module integration.

## Risk and rollback

The optional prop and CSS are inert on unopted tables. A future module could mark the wrong movement direction or over-constrain a long cell; that must be caught in its own stage. Roll back by removing the optional `density` prop, V3 register CSS, synthetic test/captures and this report. No data, schema or API rollback applies.
