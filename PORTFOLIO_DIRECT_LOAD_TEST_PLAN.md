# PORTFOLIO_DIRECT_LOAD_TEST_PLAN.md

## Scope

This plan verifies the focused Phase A1 portfolio direct-load fix.

The fix is limited to:

- rendering `/portfolio` without server-side account, bank, or currency preload blocking first paint
- loading portfolio accounts and banks through the existing API contracts with `fetchWithTimeout`
- loading portfolio currencies after mount through the existing currency action with a bounded UI timeout
- preserving current UI design, modal behavior, and API response contracts

Out of scope:

- middleware changes
- auth/session changes
- Supabase schema or RLS changes
- API contract changes
- dashboard performance work
- redesign

## Vercel Preview Setup

1. Deploy branch `fix/portfolio-direct-load` to Vercel Preview.
2. Sign in with a test user that has portfolio accounts, bank entities, and active currencies.
3. Open Chrome DevTools.
4. In Network, enable `Disable cache`.
5. Keep Console visible for runtime errors.
6. Record Vercel Function logs for `/portfolio`, `/api/accounts`, and `/api/bank-entities`.

## Direct Load Acceptance Test

1. Open a fresh signed-in browser tab.
2. Directly visit `/portfolio`.
3. Confirm the portfolio module header renders quickly.
4. Confirm client requests fire after mount:
   - `/api/accounts?include_inactive=true`
   - `/api/bank-entities?include_inactive=false`
   - the existing currency server action request
5. Confirm the page reaches one of these states:
   - account list
   - true empty state
   - controlled error banner with retry
6. Confirm it does not remain on the generic layout skeleton indefinitely.
7. Confirm visiting another module first is not required.

## Timeout And Error Tests

### Accounts

1. Block `/api/accounts?include_inactive=true` in DevTools.
2. Hard refresh `/portfolio`.
3. Confirm the account skeleton resolves to a controlled error banner within the timeout window.
4. Confirm the empty portfolio state is not shown as a substitute for the failed accounts request.
5. Unblock the route and click retry.
6. Confirm accounts load.

### Bank Entities

1. Block `/api/bank-entities?include_inactive=false`.
2. Hard refresh `/portfolio`.
3. Confirm accounts can still render if the accounts request succeeds.
4. Confirm a visible bank-loading warning/error appears.
5. Unblock the route and click retry.
6. Confirm bank options and filters recover.

### Currencies

1. Simulate a slow or failed currency action request in Vercel Preview if possible.
2. Confirm the currency filter and form currency select are disabled while currencies load.
3. Confirm a visible currency-loading warning/error appears if the request fails or times out.
4. Confirm retry attempts to load accounts, banks, and currencies again.
5. Confirm fallback PEN/USD options are still available after loading ends.

## Query Modal Regression

1. Visit `/portfolio?new=portfolio` directly.
2. Confirm the create portfolio modal opens.
3. Confirm the submit button is disabled while required portfolio loading is still in progress.
4. After loading finishes, create a test portfolio without a bank entity.
5. Confirm the modal closes and the new account appears.
6. Repeat with a bank entity if available.

## Existing Action Regression

1. Edit an existing portfolio account.
2. Change opening balance and opening date.
3. Save and confirm the list refreshes.
4. Deactivate an account with confirmation.
5. Reactivate the account.
6. Delete a test account with confirmation.
7. Attempt to delete or deactivate an account with dependencies and confirm the business-rule error is visible.

## Filter Regression

1. Test search.
2. Test status presets:
   - all
   - active
   - inactive
   - technical
3. Test currency filter.
4. Test type filter.
5. Test bank filter.
6. Confirm filters do not throw console errors while data is loading.

## Mobile Regression

1. Open `/portfolio` in an iPhone-sized viewport.
2. Confirm the module header, filters, cards/list view, and create modal remain usable.
3. Confirm disabled states are visible while data loads.
4. Confirm no text overlaps controls.

## Pass Criteria

- Direct `/portfolio` visits no longer depend on server account/bank/currency preload.
- The manager mounts and starts bounded client loading.
- Account and bank requests use `fetchWithTimeout`.
- Currency loading is bounded in the UI and failure is visible.
- Loading, error, empty, and success states remain distinct.
- `/portfolio?new=portfolio` still opens the modal.
- Existing create, edit, deactivate, reactivate, delete, filters, and retry behavior still work.
- No new console errors appear.
- API response contracts are unchanged.

## Rollback Check

If the fix causes regressions, revert:

- `app/(dashboard)/portfolio/page.tsx`
- `components/management/PortfolioManager.tsx`
- `PORTFOLIO_DIRECT_LOAD_TEST_PLAN.md`

Rollback should restore the previous server preload path and the previous inline portfolio client timeout behavior.
