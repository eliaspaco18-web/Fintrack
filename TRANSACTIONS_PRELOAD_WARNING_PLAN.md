# Transactions Preload Warning Plan

## Scope

Phase A2 diagnosis only. This document reviews the current transactions preload behavior and proposes a minimal safe implementation plan for explicit server preload warnings.

No functional code was changed as part of this diagnosis.

Implementation note: Phase A2 was approved after this diagnosis. The implemented fix keeps the fallback render, adds explicit preload warning metadata, surfaces existing Supabase option-query errors to that warning path, and avoids misleading empty account/category copy when the warning is present.

## Summary

The `/transactions` page currently protects the server render from preload failures by using timed server calls and fallback option objects. That keeps the page from crashing, but it also hides important failures from the user. When transaction form options fail to load, the UI receives empty arrays and displays normal empty-state copy such as "No tienes cuentas activas" or "No tienes categorias disponibles", even though the real problem may be a Supabase query failure or server preload timeout.

This is a medium/high stability issue because it can mislead users and can block transaction creation without making the backend failure visible.

## Current Behavior

### Server page

File: `app/(dashboard)/transactions/page.tsx`

- The page authenticates with `supabase.auth.getUser()`.
- It calls `getTransactionFormOptions(user.id)` through `withTimeout(..., 4_000)`.
- It wraps that call in `Promise.allSettled`.
- If the options call rejects or times out, the page uses a full fallback option object with empty arrays for accounts, credit cards, creditors, debtors, pending receivables, pending payables, asset types, and categories.
- It then resolves URL prefill values with `resolveTransactionInitialValues(...)`.
- If initial value resolution rejects or times out, the page silently falls back to `{}`.
- `TransactionsWorkspace` receives only `options` and `initialValues`; it does not receive any preload status or warning.

Evidence:

- `app/(dashboard)/transactions/page.tsx:28-48`
- `app/(dashboard)/transactions/page.tsx:50-57`
- `app/(dashboard)/transactions/page.tsx:60-63`

### Server option loader

File: `lib/server/transaction-form-options.ts`

- `getTransactionFormOptions(userId)` runs eight Supabase queries in `Promise.all`.
- It destructures only `{ data }` from each Supabase response and ignores `{ error }`.
- Supabase query errors normally resolve as `{ data, error }`; they do not automatically throw.
- Because errors are ignored, an individual failed query can become `undefined` data.
- The mapper then uses fallbacks such as `(accounts ?? [])`, `(categories ?? [])`, and similar arrays, converting query failures into empty options.

Evidence:

- `lib/server/transaction-form-options.ts:323-382`
- `lib/server/transaction-form-options.ts:689-704`

### Workspace

File: `components/transactions/TransactionsWorkspace.tsx`

- The workspace receives `options` and `initialValues`.
- It passes `options` directly into `TransactionTable`.
- It passes the same `options` into `TransactionForm` inside the create modal.
- There is no top-level server preload warning prop or banner.

Evidence:

- `components/transactions/TransactionsWorkspace.tsx:126-129`
- `components/transactions/TransactionsWorkspace.tsx:498-499`
- `components/transactions/TransactionsWorkspace.tsx:521-529`

### Transaction form

File: `components/forms/TransactionForm/index.tsx`

- The form stores the incoming `options` as `formOptions`.
- It derives `hasAccounts`, `hasFilteredSourceAccounts`, and `hasVisibleCategories` only from array length.
- If accounts are empty, it shows messages that imply a real empty account state:
  - "No tienes cuentas activas."
  - "No tienes portafolios compatibles para esta operacion."
- If categories are empty, it shows:
  - "No tienes categorias disponibles para este tipo."
- These messages are appropriate for true empty states, but misleading when the arrays are empty because the preload failed.

Evidence:

- `components/forms/TransactionForm/index.tsx:230-233`
- `components/forms/TransactionForm/index.tsx:820-827`
- `components/forms/TransactionForm/index.tsx:1558-1561`
- `components/forms/TransactionForm/index.tsx:1658-1665`
- `components/forms/TransactionForm/index.tsx:2120-2126`

### Transaction table filter options

File: `components/tables/TransactionTable.tsx`

- The table independently loads account/category filter options on the client with `fetchWithTimeout`.
- If either `/api/accounts` or `/api/categories?include_system=false` fails, it clears filter options and shows `DataErrorBanner` with retry.
- This path already has a visible error state and is not the primary Phase A2 issue.

Evidence:

- `components/tables/TransactionTable.tsx:668-691`
- `components/tables/TransactionTable.tsx:937-941`

## Where Errors Are Swallowed

### 1. Full options preload timeout or rejection

File: `app/(dashboard)/transactions/page.tsx`

The server page catches the preload failure with `Promise.allSettled` and converts it into a fallback object:

- `accounts: []`
- `creditCards: []`
- `categories: { income: [], expense: [] }`
- other option arrays empty

No warning or error detail is passed to the client.

Severity: High

### 2. Individual Supabase query errors inside `getTransactionFormOptions`

File: `lib/server/transaction-form-options.ts`

Each Supabase response is destructured as `{ data }`, so query errors are ignored. A failure in accounts, categories, asset types, credits, creditors, debtors, receivables, or payables can become an empty array with no visible warning.

Severity: High

### 3. Initial values preload timeout or rejection

File: `app/(dashboard)/transactions/page.tsx`

`resolveTransactionInitialValues(...)` failure becomes `{}`. This can silently drop URL-driven prefill data from related modules.

Severity: Medium

### 4. Form empty-state copy cannot distinguish true empty from failed preload

File: `components/forms/TransactionForm/index.tsx`

The form bases its empty messages on option array length only. It has no metadata to know if accounts/categories are truly empty or unavailable because preload failed.

Severity: Medium

## User Impact

- Users may see "no accounts" or "no categories" messaging when the real issue is a server/Supabase preload failure.
- Transaction creation can appear blocked by missing setup instead of showing a retryable loading failure.
- URL prefill from credits, payables, receivables, assets, or recurring flows can be dropped silently.
- Support/debugging becomes harder because failures are masked as normal empty states.

## Smallest Safe Fix

The smallest safe implementation should preserve all existing API contracts and keep `/transactions` rendering resiliently.

Recommended approach:

1. Add a local server-only warning result in `app/(dashboard)/transactions/page.tsx`.
   - Keep the fallback options object.
   - Also create a small `preloadWarning` prop when options preload times out or rejects.
   - Create a separate `initialValuesWarning` only if initial value resolution fails.

2. Make `getTransactionFormOptions` throw when critical Supabase option queries return errors.
   - At minimum, treat `accounts` and `categories` errors as critical.
   - Prefer also surfacing errors for `assetTypes`, `credits`, `creditors`, `debtors`, `pendingReceivables`, and `pendingPayables` as warnings or a combined preload warning.
   - Do not change database schema, RLS, or API contracts.

3. Pass warning metadata through `TransactionsWorkspace`.
   - Add a prop such as:
     - `preloadWarning?: { message: string; detail?: string; affectedOptions: string[] }`
   - Render a controlled warning banner near the top of `/transactions` when present.
   - The warning should say options could not be loaded and suggest retrying/reloading, not that the user has no accounts.

4. Pass warning metadata into `TransactionForm`.
   - Add an optional prop such as `optionsLoadWarning`.
   - When warning exists and accounts/categories are empty, show warning copy instead of "No tienes..." empty copy.
   - Keep existing true empty-state messages when no warning exists.

5. Keep `TransactionTable` client filter behavior unchanged.
   - It already uses `fetchWithTimeout`, visible `DataErrorBanner`, and retry.

## Files Proposed For Implementation

Expected files:

- `app/(dashboard)/transactions/page.tsx`
- `components/transactions/TransactionsWorkspace.tsx`
- `components/forms/TransactionForm/index.tsx`
- `lib/server/transaction-form-options.ts`

Possible but avoid unless necessary:

- `lib/contracts/ui.contracts.ts`

Avoid changing API route contracts, database schema, RLS, auth/session logic, middleware, dashboard code, or unrelated modules.

## Owner Approval Required

Implementation approval is required before making code changes because this changes visible transaction UX by surfacing a new warning state.

Approval is not required for schema, RLS, auth, middleware, or API contracts because the recommended fix does not touch those areas.

If implementation discovers that the root cause requires API contract changes, auth changes, middleware changes, Supabase RLS/schema changes, or business behavior changes, stop and request explicit approval before proceeding.

## Risk

Risk level: Low to medium.

Main risks:

- Warning may appear for users who truly have empty accounts/categories if detection is too broad.
- Throwing on previously ignored Supabase errors may route more cases through the fallback warning path.
- Adding warning props to client components touches modal/form rendering and must preserve existing create/edit behavior.
- URL prefill flows must keep working when preload succeeds.

Risk controls:

- Keep the existing fallback options object so `/transactions` still renders.
- Use explicit warning metadata instead of treating empty arrays as errors by default.
- Only replace empty-state copy when a preload warning is present.
- Do not change API responses or database queries beyond checking existing Supabase error values.

## Local Test Plan

1. Start the app locally with `npm run dev`.
2. Log in with a test user that has at least one active account and categories.
3. Open `/transactions`.
4. Confirm normal state:
   - Page renders.
   - Transaction table loads.
   - "Nueva transaccion" opens the modal.
   - Account and category selects show real options.
   - No preload warning appears.
5. Open `/transactions?new=transaction`.
6. Confirm the create modal still opens.
7. Navigate from a related module with prefill params if available.
8. Confirm prefill values still appear when options preload succeeds.
9. Simulate a server preload failure for accounts/categories in a local-only test branch.
10. Reload `/transactions`.
11. Confirm the page still renders, but a warning appears.
12. Confirm the form does not say "No tienes cuentas activas" or "No tienes categorias" when the warning is caused by preload failure.
13. Confirm the retry/reload instruction is visible.
14. Confirm table filter client errors still show the existing `DataErrorBanner`.
15. Run:
    - `npm run lint`
    - `npm run typecheck`
    - `npm run build`
    - available tests

## Vercel Preview Test Plan

1. Deploy the implementation branch to Vercel Preview.
2. Confirm the Vercel build succeeds.
3. Log in on the preview URL.
4. Open `/transactions` directly in a fresh tab.
5. Confirm the page renders without infinite loading.
6. Open the create transaction modal.
7. Confirm account and category options appear for a user with existing setup.
8. Open `/transactions?new=transaction`.
9. Confirm the modal opens automatically.
10. Navigate from related modules that prefill transaction params, if available.
11. Confirm prefill behavior still works.
12. Use browser devtools to check for console runtime errors.
13. If a preview-only failure can be safely simulated, confirm the visible preload warning appears instead of misleading empty setup copy.

## Recommended Implementation Order

1. Add a small `TransactionPreloadWarning` type local to the transactions page/workspace.
2. In `app/(dashboard)/transactions/page.tsx`, preserve fallback options but also set warning metadata when preload or initial value resolution fails.
3. In `lib/server/transaction-form-options.ts`, inspect Supabase response errors and throw a sanitized `Error` when critical option queries fail.
4. In `TransactionsWorkspace`, render a warning banner and pass relevant warning state to `TransactionForm`.
5. In `TransactionForm`, use the warning to replace misleading empty setup copy only when preload actually failed.
6. Run validation and manual tests.

## Do Not Include

- No redesign.
- No broad refactor.
- No database schema changes.
- No Supabase RLS changes.
- No auth/session changes.
- No middleware changes.
- No API contract changes.
- No unrelated module changes.

## Spanish Summary

Hoy la pantalla de Movimientos puede ocultar errores al cargar cuentas o categorias. Si algo falla, la pantalla puede mostrar que "no hay cuentas" o "no hay categorias", aunque en realidad si existen pero no se pudieron cargar. La solucion recomendada es pequena: mantener la pantalla funcionando, pero mostrar una advertencia clara cuando fallan esas cargas, para que el usuario sepa que debe reintentar y no piense que perdio sus datos.
