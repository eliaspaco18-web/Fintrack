# Gate 1A — Stability and Evidence Report

**Project:** FinTrack  
**Branch:** `codex/premium-product-redesign`  
**Date:** 2026-08-22  
**Scope:** Diagnostic evidence only; no visual, brand, product, data, API, schema, auth, or business-logic implementation  
**Decision:** **NOT SAFE TO BEGIN VISUAL TRANSFORMATION**

## 1. Executive decision

The compile-time baseline is healthy, the public/auth boundary passed the safe automated checks that were available, and the current Portfolio initial read path has explicit timeouts, a visible retry, and distinct primary-error versus ordinary empty rendering in its nominal path.

Gate 1A cannot be closed yet. There is no dedicated authenticated test user or verified non-production target, so authenticated runtime behavior could not be certified without risking real data. Static review also found several production-integrity blockers, including Portfolio edit paths that can relabel or zero balances, a dependency guard that can fail open when its Supabase count queries fail, synthetic Portfolio history presented as monthly observation, and the financial-content blockers already recorded in the approved blueprint.

Accordingly:

- automated baseline: **PASS**;
- unauthenticated route/API boundary: **PASS for the tested subset**;
- authenticated Portfolio evidence: **BLOCKED**;
- Portfolio static state/action review: **PARTIAL, with confirmed failures**;
- full-app financial-content safety: **FAIL / requires focused work packages**;
- brand and visual implementation: **NOT AUTHORIZED and not started**.

## 2. Governing material reviewed

The following files were read completely before Gate 1A work began:

- `AGENTS.md`
- `CODEX_RULES.md`
- `QA_CHECKLIST.md`
- `FINTRACK_APPROVED_REDESIGN_BLUEPRINT.md`
- `FINTRACK_REDESIGN_APPROVAL_ROADMAP.md`

The optional mandatory-document names were also checked. No `BUG_AUDIT.md`, `IMPLEMENTATION_PLAN.md`, or `MISSING_DECISIONS.md` exists at this time.

The stop condition in the roadmap remains in force: work stops at the stability report, and no brand or visual implementation begins without owner approval.

## 3. Guardrails followed

- No visual redesign was implemented.
- No brand, logo, token, font, shell, sidebar, topbar, Dashboard, or Portfolio design code was changed.
- No calculations, balances, formulas, exchange rates, projections, budgets, valuations, schedules, or financial semantics were changed.
- No Supabase schema, migration, RLS, auth, middleware, API contract, persistence, route, permission, or environment file was changed.
- No production or user record was created, edited, deactivated, or deleted.
- No secrets or environment values were printed. Only the presence or absence of required E2E variable names was checked.
- No `git add`, stage, commit, or push was performed.

This report is the only new file produced by Gate 1A.

## 4. Evidence method and confidence levels

This report distinguishes evidence explicitly:

| Evidence label | Meaning |
|---|---|
| `RUNTIME PASS` | Executed and observed successfully in this Gate 1A run |
| `STATIC PASS` | A coherent code path exists, but authenticated runtime behavior is not certified |
| `STATIC FAIL` | Source inspection proves a contradictory, unsafe, or incomplete path |
| `BLOCKED` | Safe execution requires a dedicated non-production environment, credentials, seed data, or an approved mutation |
| `DEFERRED` | Intentionally outside Gate 1A and safe to leave unchanged while visual work remains blocked |

Static inspection must not be interpreted as authenticated QA approval.

## 5. Automated and route evidence

### 5.1 Commands

| Check | Result | Duration | Evidence |
|---|---:|---:|---|
| `npm run lint` | PASS | 1.82 s | No ESLint warnings or errors |
| `npm run typecheck` | PASS | 1.14 s | `tsc --noEmit`, no errors |
| `./node_modules/.bin/tsc --noEmit --incremental false` | PASS | 6.10 s | Reproducible TypeScript check required by `QA_CHECKLIST.md` |
| `npm run build` | PASS | 15.56 s | Compile, type, lint, and 66 generated pages passed |
| `npm run test:e2e:list` | PASS | 0.46 s | 41 tests discovered across 8 files |
| Safe unauthenticated E2E subset | PASS | 7.72 s | 11 of 11 tests passed |

The E2E subset was:

```text
npm run test:e2e -- tests/e2e/login-ui.spec.ts tests/e2e/auth-redirect.spec.ts tests/e2e/api-auth.spec.ts --grep "login page|redirects unauthenticated|returns JSON 401"
```

The first Playwright attempt could not bind `127.0.0.1:3100` inside the restricted sandbox (`EPERM`). Re-running the same non-mutating command with permission to start the local test server passed. This was an execution-environment restriction, not a FinTrack failure.

### 5.2 Runtime route and screen evidence

| Surface | Result | Evidence |
|---|---|---|
| Public `/` | RUNTIME PASS | Local landing page rendered in the in-app browser |
| `/login` | RUNTIME PASS | Email, password, submit, and registration controls were present |
| `/portfolio` while signed out | RUNTIME PASS | Redirected to `/login?next=%2Fportfolio` |
| `/dashboard`, `/transactions`, `/portfolio`, `/admin` signed out | RUNTIME PASS | Protected-route E2E redirects passed |
| Browser console on the observed login redirect | RUNTIME PASS | No warning or error entry was observed |
| Protected JSON APIs signed out | RUNTIME PASS | `401 / UNAUTHORIZED` passed for Dashboard summary/modules/sidebar, accounts, profile, and transactions |

Direct API navigation through the in-app browser was blocked by the browser client, but the Playwright request-context checks verified the protected JSON responses.

### 5.3 Build size evidence

| Route | Route size | First Load JS |
|---|---:|---:|
| `/portfolio` | 15.8 kB | 137 kB |
| `/transactions` | 17.6 kB | 210 kB |
| `/admin` | 15.6 kB | 195 kB |
| `/dashboard` | 141 kB | 254 kB |

Dashboard is the heaviest observed route. This is not a build failure, but cold/warm timings and a network waterfall are still required before its loading behavior can be certified.

Non-blocking build/test warnings:

- Webpack reported caching a serialized string of approximately 140 KiB during the test server run.
- npm reported that an update is available.

Neither warning affected the executed checks.

## 6. Why authenticated QA was not executed

The following variables are absent from the process environment:

```text
E2E_USER_EMAIL
E2E_USER_PASSWORD
E2E_BASE_URL
E2E_EXPECT_PRODUCTION_GATES
```

The in-app browser also had no authenticated FinTrack session. No credential was requested, inferred, or extracted.

More importantly, the authenticated suites are mutating. They create Portfolio accounts, bank entities, categories, budgets, credits, assets, debtors, creditors, receivables, payables, transactions, alerts, and saved views. Cleanup is not complete or deterministic for all paths. Supplying credentials alone would therefore be unsafe until the target is confirmed as a disposable non-production environment.

The following remain `BLOCKED`:

- authenticated smoke across current modules;
- real Portfolio initial load and data correctness;
- create, edit, deactivate, reactivate, and delete behavior;
- blocked destructive actions against linked records;
- retry after forced primary failure;
- bank/currency partial failure in a real session;
- response over ten seconds;
- authenticated empty, populated, stale, and large-data behavior;
- custom active currencies in a real account;
- RLS, index, migration, RPC, and live Supabase performance checks;
- cold/warm timings and network waterfall in Preview.

The current authenticated Portfolio helper is also stale: `tests/e2e/authenticated-management.spec.ts` tries to fill `portfolio-institution-input`, which the current form no longer exposes. Even after credentials are provided, that helper must be corrected in a separately reviewed test-harness package before it can provide reliable evidence.

## 7. Portfolio state matrix

| State | Result | Evidence and conclusion |
|---|---|---|
| Route mounts | STATIC PASS | `app/(dashboard)/portfolio/page.tsx:15-20` renders `PortfolioManager` without server preload blocking the route |
| Initial accounts and banks timeout | STATIC PASS | `PortfolioManager.tsx:150-165,593-625` uses an aborting 10-second client timeout and clears loading in `finally` |
| Initial currencies timeout | STATIC PASS, caveat | `PortfolioManager.tsx:167-185,627-647` bounds the UI wait; the underlying Server Action is not cancelled |
| Initial skeleton resolves after read failure | STATIC PASS | Account loading always clears in `finally`; the blocking error suppresses the ordinary empty panel |
| Primary accounts failure | STATIC PASS, incomplete presentation | Error banner and retry appear; the empty CTA is suppressed. However, summary KPIs render zero while loading/error is unresolved |
| Bank failure + populated accounts | STATIC PASS, degraded | Accounts remain visible and a banner appears; bank-dependent editing remains enabled even when it cannot validate/save |
| Bank/currency failure + successfully empty accounts | STATIC FAIL | Shared `error` plus `accounts.length === 0` classifies a secondary failure as blocking and hides a valid first-run empty/create state (`PortfolioManager.tsx:1093,1270`) |
| Retry | STATIC PASS, race risk | Reloads accounts, banks, and currencies (`649-651`), but the retry button has no dedicated busy guard and permits concurrent retries |
| True empty | STATIC PASS | Distinct empty copy and create CTA exist when no error is present (`1270-1301`) |
| Filtered empty | STATIC PASS | Distinct copy and a complete clear-filter action exist (`1273-1295`) |
| Populated list | STATIC PASS | List renderer and row actions exist (`1302-1445`) |
| Populated card view | STATIC PASS | Card renderer and actions exist (`1447-1573`) |
| Stale data after failed refresh | STATIC PARTIAL | Existing accounts are retained, but the surface does not identify them as stale |
| Large data | BLOCKED / risk confirmed | API is unbounded and the UI renders every row/card; card view creates an interactive SVG per account. No pagination, virtualization, or test fixture exists |
| Infinite initial read | STATIC PASS | Mitigated for all three initial dependencies by bounded UI waits |
| Infinite save/action | STATIC FAIL | Create/edit/deactivate/reactivate/delete use plain `fetch`; `saving` or `rowActionId` can remain set indefinitely on a stalled request (`943-1064`) |

### Loading-content integrity issue

The four Portfolio KPIs are rendered from the initial empty arrays before account loading resolves. For up to the timeout window, and after a primary failure, the page can communicate zero PEN, zero USD, zero operating accounts, and zero net-worth accounts as if those were resolved values. The list body shows a skeleton, but the financial summary does not. This is a `High risk` content-state defect, not a redesign request.

## 8. Portfolio visible-action matrix

| Action | Static path | Runtime status |
|---|---|---|
| `/portfolio?new=portfolio` | Opens create modal once; query is removed on close/save | BLOCKED authenticated |
| Topbar `Nuevo portafolio` | Uses the same `new=portfolio` contract | BLOCKED authenticated |
| Page and empty-state create CTAs | Both call `openCreateModal` | BLOCKED authenticated |
| Search | Matches account, bank, type, and currency | BLOCKED authenticated |
| Active/inactive presets | Direct status filters | BLOCKED authenticated |
| Technical control | Includes technical accounts rather than showing only technical accounts | Product meaning needs confirmation |
| Currency/type/bank filters | Implemented client-side | BLOCKED authenticated |
| List/card toggle | Both render paths exist | BLOCKED authenticated |
| Create without bank | Client/API allow `bank_entity_id: null` | BLOCKED authenticated |
| Create with bank | Client and server validate active owned bank | BLOCKED authenticated |
| Edit | Handler, form, PATCH, and reload exist | STATIC FAIL for identity and some bank states; see findings |
| Deactivate | Confirmation and PATCH exist | STATIC FAIL-open dependency guard; runtime BLOCKED |
| Reactivate | Handler and PATCH exist | BLOCKED authenticated; no dedicated current E2E case |
| Delete | Confirmation and DELETE exist | STATIC FAIL-open dependency guard; linked-record case untested |
| Technical-account link | Navigates to `/credits` | BLOCKED authenticated |
| Modal cancel/close/Escape/overlay | Shared modal implements these behaviors and restores focus | BLOCKED authenticated |
| Destructive confirmation | Shared dialog supplies focus trap, Escape, loading, and focus return | BLOCKED authenticated |

No obviously dead Portfolio control was found by static wiring review. That does not certify the actions because the most important operations require authenticated runtime evidence.

## 9. Prioritized findings

### 9.1 Critical blocker

#### C-01 — No safe authenticated evidence target

There is no verified disposable Preview/test Supabase target, dedicated E2E user, or deterministic cleanup contract. Gate 1A cannot certify authenticated behavior without these prerequisites.

Evidence: `tests/e2e/helpers/auth.ts:8-15`, authenticated-suite skip guards, mutating helpers in `tests/e2e/authenticated-management.spec.ts`, and absent E2E variable names.

#### C-02 — Portfolio edit can relabel balances by changing currency

The edit form leaves currency mutable. PATCH accepts the new currency but does not convert the current balance or migrate linked records. An amount represented as PEN can therefore be displayed as the same numeric amount in USD or another currency after an ordinary edit.

Evidence: `PortfolioManager.tsx:836-852,915-928,1675-1690`; `app/api/accounts/[id]/route.ts:39-55,146-164,209-213`.

This is a financial identity/integrity defect. The report does not infer the correct migration rule. Safe default: prevent ordinary identity changes until a separately approved conversion/migration contract exists.

#### C-03 — Portfolio edit can zero a balance by changing type to `CREDIT_CARD`

Changing an existing account type to `CREDIT_CARD` is allowed. Client payload sets its opening balance to zero, and the API forces `initial_balance`, `balance`, and net-worth inclusion to zero/false. It does not first establish that the account is safe to convert.

Evidence: `PortfolioManager.tsx:808-823,836-852,915-928,1615-1625`; `app/api/accounts/[id]/route.ts:164,209-219`.

The reverse semantic conversion is also insufficiently guarded. This can alter financial position and must not be hidden inside redesign work.

#### C-04 — Portfolio dependency guard can fail open

`getAccountBlockers` reads transaction and credit counts but discards both Supabase errors. A failed count becomes `null`, then zero. Deactivation can proceed; deletion can be attempted and is left to whatever database constraint behavior exists.

Evidence: `app/api/accounts/[id]/route.ts:93-112,198-205,328-343`.

The safe behavior for a financial destructive action is fail-closed with a controlled error and no mutation.

#### C-05 — Portfolio presents synthetic observations as six months of balance history

The chart interpolates six points between opening and current balance using easing, labels each point as a month, exposes an accessibility label describing six months of balance, and displays it on account cards.

Evidence: `PortfolioManager.tsx:295-329,404-427,483-540,1518-1520`.

This confirms approved-blueprint blocker S8. It must become a truthful current/opening comparison before the Portfolio visual pilot. True history requires a future data contract.

#### C-06 — Custom Portfolio currencies can be formatted as USD

`CurrencyCode` is an open string and Portfolio loads custom active currencies, but shared `formatCurrency` selects PEN only when the code is exactly `PEN` and otherwise selects USD.

Evidence: `types/database.types.ts:2286`; `lib/contracts/ui.contracts.ts:191-195`; `PortfolioManager.tsx:750-770` and its amount call sites.

This can label EUR, GBP, or another configured currency as USD. A separate cross-module formatting audit is required before changing the shared formatter.

#### C-07 — Known full-app financial-content blockers remain confirmed

The approved blueprint's financial blockers are still present where inspected:

- USD bank-loan UI omits required `exchange_rate`, while the API rejects USD without it.
- Manual loan schedule omits `other_charges`; API folds insurance into interest instead of preserving schedule components.
- Receivable/payable headline aggregates mix document currencies and currencyless `initial_debt`, then present totals as PEN.

Evidence: `components/credits/BankLoanForm.tsx:319-350`; `app/api/credits/route.ts:47-70,122-127,469-485`; debtor/creditor routes and corresponding module summary code.

These block the affected visual modules and related Dashboard headlines.

### 9.2 High risk

- **H-01 — Unbounded Portfolio mutations.** Plain `fetch` can leave create/edit/deactivate/reactivate/delete indefinitely busy.
- **H-02 — Secondary failure is incorrectly blocking for an empty Portfolio.** Error provenance is not separated by accounts, banks, and currencies.
- **H-03 — Edit with an inactive or unavailable bank can become unsaveable.** The select loads active banks only, and local validation rejects the existing ID when it is missing.
- **H-04 — Missing attachment endpoints.** Asset uploads call `/api/assets/[id]/attachment`; receivable/payable uploads call `/api/attachments/upload`; neither route exists. Some callers ignore the failed upload.
- **H-05 — Asset state/type semantics.** Visible `INACTIVE` filtering does not match `ACTIVE | SOLD | DEPRECIATED`, and the detail view reads the legacy enum instead of the custom type relation.
- **H-06 — Credit detail amount semantics.** Nullable/stale availability and preferred-currency formatting do not consistently follow the safer list logic or native currency.
- **H-07 — Dashboard partial failure coupling.** Critical seed requests use `Promise.all`; one failure can remove both healthy critical sources. Refresh error visibility is incomplete.
- **H-08 — Raw database errors can reach the client.** Multiple API paths forward PostgREST/Supabase messages into the canonical API response and visible banner.
- **H-09 — RLS/permission failures can be masked as missing bank feature.** `42501`, RLS, and permission messages can cause bank GET to return a successful empty array.

### 9.3 Medium risk

- **M-01 — Shared Portfolio error state mixes load, validation, and mutation errors.** A form error can appear as a page banner whose `Reintentar` action reloads data rather than retrying the failed operation. Closing the modal does not reliably clear provenance.
- **M-02 — Retry permits concurrent request races.** Each click launches accounts, banks, and currencies again without a dedicated busy guard.
- **M-03 — Post-mutation reload failure can still be followed by a success toast/close.** `loadAccounts` absorbs its error, so callers cannot distinguish successful mutation plus failed refresh.
- **M-04 — Remove-bank inconsistency.** Clearing bank ID can retain the previous institution label.
- **M-05 — Large-data behavior is unbounded and untested.** No limit/pagination/virtualization exists, and each card builds an SVG.
- **M-06 — Authenticated Portfolio test helper is stale and the suite lacks complete cleanup.** It cannot yet serve as reliable evidence.
- **M-07 — Topbar quick-create menu dismissal is incomplete.** Static review found route-change closure but not complete outside-click/Escape behavior.
- **M-08 — Dashboard bundle/loading performance lacks measured cold/warm evidence.** The route is the largest build output among the reviewed main routes.

### 9.4 Low risk

- Some Portfolio form selects do not receive the same programmatic label association as native inputs.
- Row icon actions are 36 by 36 px, below the preferred 44 by 44 px touch target.
- Account POST/PATCH response relation shape can be null even after storing the bank ID; the current manager masks it by reloading accounts.
- Webpack cache serialization and npm update notices are non-blocking.

### 9.5 Product decision needed

- Are `currency` and `type` immutable after account creation, or immutable only after the account has linked records? Safe interim recommendation: immutable in ordinary edit until an explicit migration flow is approved.
- Should the Portfolio `Técnicas` control be an exclusive filter or an inclusion toggle?
- Should recurring templates also block account deactivation, not only transactions and credits?
- What is the approved currency contract for debtor/creditor `initial_debt`?
- Should unsupported attachments be visibly disabled now or implemented as a separately approved backend project?
- Does a Budget action apply to one visible period/record or the complete recurring series?
- When banks fail but accounts successfully resolve empty, should users be allowed to create without a bank? Current optional-bank contracts indicate yes.

### 9.6 Deferred safe

- Brand, logo asset integration, visual tokens, fonts, shell, sidebar, topbar, Dashboard redesign, and module redesign.
- True historical Portfolio snapshots and any new history API/data contract.
- New projection/recommendation logic.
- Portfolio repository refactor; it is not required to correct the focused defects.
- Pagination/virtualization implementation until cardinality is measured; the test scenario itself is not deferred.
- npm upgrade and speculative bundle optimization until performance evidence is captured.

## 10. Approved-blueprint blocker register

The canonical S1-S8 IDs below retain the meaning defined in `FINTRACK_APPROVED_REDESIGN_BLUEPRINT.md`.

| ID | Status | Classification | Gate impact |
|---|---|---|---|
| S1 — mixed-currency receivable/payable totals and currencyless initial debt | Confirmed | Critical blocker + Product decision needed | Blocks Receivables, Payables, and related Dashboard totals |
| S2 — USD bank-loan form omits exchange rate | Confirmed | Critical blocker | Blocks safe USD loan creation and Credits visual gate |
| S3 — loan schedule component loss | Confirmed | Critical blocker | Blocks Credits visual gate and schedule trust |
| S4 — unsupported attachment controls | Confirmed | High risk + Product decision needed | Blocks Assets, Receivables, and Payables interaction parity |
| S5 — Asset status/custom type mismatch | Confirmed | High risk | Blocks Assets visual gate |
| S6 — Credit detail availability/currency semantics | Confirmed | High risk | Blocks Credit detail visual gate |
| S7 — Budget series action scope | Confirmed | High risk + Product decision needed | Blocks Budget mutation presentation redesign |
| S8 — synthetic Portfolio history | Confirmed | Critical blocker for Portfolio content | Blocks Portfolio visual pilot |

No schema, API, or behavior change is authorized by this register.

## 11. Defects versus product decisions

### Defects that do not require inventing product semantics

- Dependency-query errors must not be interpreted as zero linked records.
- A stalled mutation must resolve to a controlled error rather than permanent busy state.
- Primary and secondary load errors need distinct provenance.
- Raw permission/database details must not be presented as ordinary user copy.
- Unsupported uploads must not imply success.
- Synthetic data must not be labeled as observed history.

### Decisions that require owner approval before implementation

- Account currency/type identity and any migration path.
- Debtor/creditor initial-debt currency contract.
- Budget record-versus-series action scope.
- Attachment disable-versus-backend strategy.
- True Portfolio history capability.
- Whether technical Portfolio filtering is exclusive or additive.

## 12. Recommended work-package order

Every item below must remain a separate concern. No item authorizes visual implementation.

### Evidence prerequisite E0 — isolated authenticated QA target

1. Confirm a non-production Preview deployment and Supabase clone/project.
2. Create a disposable E2E user.
3. Configure E2E variables outside the repository.
4. Define deterministic seed and cleanup for empty, populated, linked, inactive-bank, custom-currency, and large-data states.
5. Repair the stale Portfolio helper in test code.
6. Run smoke first, then non-destructive Portfolio state evidence, then isolated mutation cases.

### G1B-P01 — Portfolio account identity integrity guard

Prevent ordinary account editing from changing `currency` or crossing the technical/operating `type` boundary until a separate migration contract is approved. Enforce the same rule in UI and API, including direct PATCH. Preserve every existing balance and linked record.

### G1B-P02 — Portfolio destructive-action dependency guard, fail closed

Make transaction/credit count failures return a controlled error and prevent PATCH deactivation or DELETE. Add tests for links, zero links, transaction-query error, and credit-query error.

### G1B-P03 — Portfolio custom-currency display correctness

Audit shared formatting consumers, then display supported ISO currency correctly and unknown codes explicitly without defaulting to USD. This must be cross-module-safe and separately approved because the helper is shared.

### G1B-P04 — Portfolio request/error resilience

Separate accounts/banks/currencies/form/action errors; add bounded mutations; add a busy retry; preserve a valid empty state during secondary failures; prevent success presentation when post-mutation reload fails.

### G1B-P05 — Truthful Portfolio position visual

Remove the implication of observed monthly history. Use existing opening/current facts only. Do not create a history backend or alter financial calculations.

### G1C onward — existing financial-integrity packages

1. USD loan exchange-rate submission.
2. Exact loan schedule component persistence.
3. Receivable/payable currency decision and safe presentation.
4. Attachment strategy.
5. Asset status and custom type detail.
6. Credit detail currency and availability semantics.
7. Dashboard partial-error and refresh behavior.
8. Budget record/series decision.
9. API error sanitization by module, not as a broad mixed refactor.

After each package, repeat focused authenticated evidence in the isolated target. Only after all critical affected-module blockers are closed should the owner receive a new `Safe to begin visual transformation` decision.

## 13. What can advance now, and what must not

### Can advance without visual risk

- Provisioning the isolated Preview/test harness.
- Test-only seed/cleanup design.
- Read-only performance and network measurements.
- Focused correction proposals and before/after acceptance cases.
- Owner decisions for currency identity, initial debt, attachments, and Budget scope.

### Must not advance yet

- Brand asset implementation.
- Design tokens or font loading.
- Sidebar/topbar/shell transformation.
- Dashboard visual transformation.
- Portfolio visual pilot.
- Shared presentational-component redesign.
- Premium headline charts based on the known ambiguous or synthetic values.

## 14. First recommended code work package

**Recommendation:** `G1B-P01 — Portfolio account identity integrity guard`.

Why first:

- it protects existing balances from an ordinary edit path;
- it prevents silent financial relabeling and zeroing;
- it is more urgent than visual or loading polish;
- it can be tightly scoped to Portfolio UI/API validation and focused tests;
- it does not require a schema, RLS, auth, route, calculation, or visual change;
- rollback is a focused revert of the guard and its tests.

The evidence prerequisite E0 should be prepared before executing its authenticated acceptance tests.

### Recommended prompt

> Before doing anything, read and follow AGENTS.md, CODEX_RULES.md, QA_CHECKLIST.md, FINTRACK_APPROVED_REDESIGN_BLUEPRINT.md, FINTRACK_REDESIGN_APPROVAL_ROADMAP.md, and GATE_1A_STABILITY_EVIDENCE_REPORT.md. Execute only work package G1B-P01: Portfolio account identity integrity guard. Do not implement brand, visual redesign, tokens, fonts, shell, Dashboard, or shared visual changes. Preserve all balances, calculations, records, routes, API read contracts, Supabase schema/RLS, auth, middleware, persistence, and environment files. Prevent an ordinary existing-account edit from changing currency or crossing between an operating account type and CREDIT_CARD until a separately approved migration flow exists. Enforce the same rule in the Portfolio UI and the direct PATCH API so bypassing the UI cannot relabel or zero balances. Return a controlled, non-sensitive validation/business-rule error and leave the account unchanged. Add focused tests for: unchanged identity edits, attempted PEN-to-USD/custom-currency change, operating-to-CREDIT_CARD change, CREDIT_CARD-to-operating change, and direct PATCH attempts. Do not mix the fail-open dependency-count fix or any other Gate 1 finding into this package. Run lint, typecheck, build, and safe focused tests. Report files modified, reason, risks, test evidence, and rollback. Do not use git add, stage, commit, or push. Stop after the report and request owner approval for the next package.

## 15. Rollback expectations

Gate 1A changed no application code. The report can be removed without affecting runtime behavior.

For future work packages:

- use one focused revert per package;
- do not combine visual and correctness changes;
- retain the current successful behavior outside the corrected guard;
- capture before/after tests and authenticated evidence;
- never use a production user as an E2E cleanup target.

## 16. Repository state at report preparation

Before adding this report, Git showed only the two pre-existing untracked governing documents:

```text
## codex/premium-product-redesign
?? FINTRACK_APPROVED_REDESIGN_BLUEPRINT.md
?? FINTRACK_REDESIGN_APPROVAL_ROADMAP.md
```

`git diff --name-only` was empty. Final Git evidence after report creation is recorded in the owner-facing handoff.

## 17. Final Gate 1A recommendation

> **NOT SAFE TO BEGIN VISUAL TRANSFORMATION.**

The codebase builds cleanly and the current initial Portfolio read path is materially safer than an infinite skeleton, but authenticated evidence is unavailable and confirmed integrity defects could make a premium interface present wrong or synthetic information more convincingly. Complete E0, authorize and execute the focused Gate 1 correctness packages, then repeat the safety review. No brand or visual implementation should begin before the owner approves that later Gate 1 report.
