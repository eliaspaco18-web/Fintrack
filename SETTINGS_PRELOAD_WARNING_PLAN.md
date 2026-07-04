# Settings Preload Warning Plan

## Scope

Phase A3 diagnosis only. This document reviews the current `/settings` and configuration-related behavior and proposes a minimal safe implementation plan for explicit preload warnings.

No functional code was changed as part of this diagnosis.

Implementation note: Phase A3 was approved after this diagnosis. The implemented fix keeps fallback rendering, passes explicit profile/account preload warning metadata into the affected settings panels, avoids misleading account empty-state copy when account preload failed, and disables sensitive profile/preference/notification saves while trusted initial data failed to load.

## Summary

The `/settings` page currently keeps the server render resilient by wrapping profile and account queries in `Promise.allSettled` with a 4 second timeout. That prevents a failed profile or account query from crashing the page, but it also converts failures into ordinary-looking defaults:

- failed profile preload becomes a partial profile using the authenticated user's email, no name, no avatar, default currency `PEN`, and dark theme;
- failed account preload becomes an empty account list, zero totals, and `0` active accounts;
- failed notification preferences load keeps hard-coded defaults silently on the client.

This is a medium stability issue because users may see incomplete settings and save fallback values without knowing the real problem was a Supabase preload or API failure.

## Current Behavior

### Server page preload

File: `app/(dashboard)/settings/page.tsx`

- The page authenticates with `supabase.auth.getUser()`.
- Unauthenticated users are redirected to `/login`.
- Authenticated users trigger two server queries in parallel:
  - `profiles.select('*').eq('id', user.id).single()`
  - `accounts.select('*').eq('user_id', user.id).order('name')`
- Both queries are wrapped in `withTimeout(..., 4_000)` and `Promise.allSettled`.
- If the profile query rejects, times out, or returns a Supabase error, `profile` becomes `null`.
- If the account query rejects, times out, or returns a Supabase error, `accounts` becomes `[]`.
- No preload status, warning metadata, retry path, or sanitized failure reason is passed into the settings UI.

Evidence:

- `app/(dashboard)/settings/page.tsx:116-128`
- `app/(dashboard)/settings/page.tsx:140-150`
- `app/(dashboard)/settings/page.tsx:199-208`

### Profile tab

File: `components/settings/ProfileSettingsForm.tsx`

- Receives `initialProfile` and `accountCount` from the server page.
- If `initialProfile.full_name` is missing, it initializes the visible name from the email prefix.
- If `initialProfile.avatar_url` is missing, it shows the fallback initials/avatar state.
- If profile preload failed, the user still sees a normal editable form.
- Saving profile sends `PATCH /api/profile` with `full_name`, `default_currency`, and `avatar_url`.
- The panel does show API save/upload/delete failures with toasts, but it does not know whether the initial server profile was a fallback.

Evidence:

- `components/settings/ProfileSettingsForm.tsx:78-89`
- `components/settings/ProfileSettingsForm.tsx:109-148`
- `components/settings/ProfileSettingsForm.tsx:243-430`

### Preferences tab

File: `components/settings/PreferencesPanel.tsx`

- Receives `initialTheme`, `initialCurrency`, and `initialPrivateMode` from the server page.
- If profile preload failed, the page sends `initialCurrency='PEN'` and `initialTheme='dark'`.
- `initialPrivateMode` is always passed as `false`; the UI labels it as temporary and not saved from this screen.
- Saving preferences first fetches `/api/profile` to recover `full_name`, then sends `PATCH /api/profile` with `full_name` and `default_currency`.
- If the initial currency was a fallback because profile preload failed, the user may save `PEN` as if it were the real current preference.
- The panel handles save errors with toasts, but it does not know the initial profile preload failed.

Evidence:

- `app/(dashboard)/settings/page.tsx:73-80`
- `components/settings/PreferencesPanel.tsx:86-98`
- `components/settings/PreferencesPanel.tsx:104-134`
- `components/settings/PreferencesPanel.tsx:271-277`

### Accounts tab

File: `components/settings/AccountsPanel.tsx`

- Receives `accounts`, `totalPen`, and `totalUsd` from the server page.
- If account preload failed, the page sends `accounts=[]`, `totalPen=0`, and `totalUsd=0`.
- The tab shows `0 registradas`, zero balances, and the empty-state copy "Aun no tienes cuentas registradas".
- That message is valid for a true empty account list, but misleading when accounts failed to load.

Evidence:

- `app/(dashboard)/settings/page.tsx:87-94`
- `app/(dashboard)/settings/page.tsx:131-138`
- `components/settings/AccountsPanel.tsx:43-59`
- `components/settings/AccountsPanel.tsx:91-105`

### Notifications tab

Files:

- `components/settings/NotificationsPanel.tsx`
- `app/api/profile/notifications/route.ts`

Current behavior:

- The panel starts from hard-coded `DEFAULT_PREFS`.
- On mount, it fetches `/api/profile/notifications`.
- If the response is OK, it merges the returned preferences with defaults.
- If the request throws, it catches the error and keeps defaults silently.
- If the response is not OK, it also falls through to `finally` and stops loading without showing an error.
- The save path does show API and network errors with toasts.

Evidence:

- `components/settings/NotificationsPanel.tsx:136-161`
- `components/settings/NotificationsPanel.tsx:170-192`
- `app/api/profile/notifications/route.ts:34-51`
- `app/api/profile/notifications/route.ts:54-76`

### Security tab

File: `components/settings/SecuritySettingsPanel.tsx`

- Receives only `email` from the server page.
- Password change, reset email, global sign-out, and account deletion are action-driven client calls.
- These actions show validation/API/network errors through toasts.
- The main preload issue is only indirect: if profile preload fails and `user.email` is also missing, the email fallback can become `-`, which weakens reset/delete confirmation copy.

Evidence:

- `app/(dashboard)/settings/page.tsx:69-71`
- `components/settings/SecuritySettingsPanel.tsx:177-275`
- `components/settings/SecuritySettingsPanel.tsx:397-459`

### Export/import tab

File: `components/settings/ExportPanel.tsx`

- Export, template download, file analysis, commit, rollback, and report download are action-driven client calls.
- These actions generally show progress, success, warnings, or toast errors.
- `refreshImportJob` returns `null` silently when it cannot refresh a failed import job; this is a secondary long-action diagnostics issue, not the primary Phase A3 preload problem.

Evidence:

- `components/settings/ExportPanel.tsx:285-293`
- `components/settings/ExportPanel.tsx:302-383`
- `components/settings/ExportPanel.tsx:385-438`
- `components/settings/ExportPanel.tsx:481-590`

### Sidebar and support

Files:

- `components/settings/config.tsx`
- `components/settings/SettingsSidebar.tsx`
- `components/settings/SupportPanel.tsx`

Current behavior:

- Settings tab routing is local/static through `getSettingsTabValue`.
- Sidebar links are static `/settings?tab=...` links.
- Support content is static except for mail link buttons and "pending" badges.
- No preload warning is needed for these pieces.

## Where Errors Are Swallowed Or Hidden

### 1. Profile server preload failure

File: `app/(dashboard)/settings/page.tsx`

Failure path:

- `profileResult.status !== 'fulfilled'`
- or `profileResult.value.error` exists

Current fallback:

- `profile = null`
- `email = user.email ?? '-'`
- `full_name = null`
- `avatar_url = null`
- `default_currency = 'PEN'`
- `currentTheme = 'dark'`
- profile header says `Perfil en revision`

Severity: High within settings, because users can edit and save profile/preferences based on fallback data.

### 2. Account server preload failure

File: `app/(dashboard)/settings/page.tsx`

Failure path:

- `accountsResult.status !== 'fulfilled'`
- or `accountsResult.value.error` exists

Current fallback:

- `accounts = []`
- account count becomes `0`
- totals become `S/ 0.00` and `$0.00`
- accounts tab shows the normal empty state

Severity: Medium, because it can misrepresent account inventory and balances.

### 3. Notification preferences client load failure

File: `components/settings/NotificationsPanel.tsx`

Failure path:

- `/api/profile/notifications` throws
- or returns a non-OK response

Current fallback:

- defaults remain active in local state
- loading ends
- no visible warning appears
- the user can change and save defaults

Severity: Medium, because notification preferences can appear loaded when they are only hard-coded defaults.

### 4. Profile save can persist fallback-derived values

Files:

- `components/settings/ProfileSettingsForm.tsx`
- `components/settings/PreferencesPanel.tsx`

Current behavior:

- The profile form can save values initialized from fallback data.
- The preferences form can save the server fallback currency (`PEN`) if the true profile failed to preload.
- The preferences form refetches `/api/profile` for `full_name`, which helps before save, but it does not validate whether the initially displayed currency/theme came from a trusted preload.

Severity: High within settings, because it can turn a hidden read failure into a real write.

## Can Users See Incomplete Settings Without Knowing A Load Failed?

Yes.

Confirmed examples:

- A profile preload failure can look like a profile that is simply incomplete or "in review".
- A default currency preload failure can look like `PEN` is the real configured base currency.
- An account preload failure can look like the user has no accounts and zero balances.
- A notification preference load failure can look like the user has the default alert rules enabled.

These are not infinite loading bugs. They are silent fallback bugs: the UI reaches a success-looking state when the data source may have failed.

## Smallest Safe Fix

The smallest safe implementation should keep `/settings` rendering resilient, avoid API contract changes, and only show warnings when explicit failure metadata exists.

Recommended approach:

1. Add local preload warning metadata in `app/(dashboard)/settings/page.tsx`.
   - Keep existing profile/account fallback data so the page still renders.
   - Create a warning object when profile preload rejects, times out, or returns a Supabase error.
   - Create a warning object when account preload rejects, times out, or returns a Supabase error.
   - Sanitize user-facing messages; do not show raw Supabase details in the UI.

2. Pass warning metadata to the affected settings panels.
   - `ProfileSettingsForm`: receive optional `profilePreloadWarning` and `accountsPreloadWarning`.
   - `PreferencesPanel`: receive optional `profilePreloadWarning`.
   - `AccountsPanel`: receive optional `accountsPreloadWarning`.
   - Keep `SecuritySettingsPanel`, `ExportPanel`, `SupportPanel`, and `SettingsSidebar` unchanged unless the shared warning placement makes a tiny page-level prop cleaner.

3. Show controlled warning UI without redesigning the page.
   - For profile/preferences: warn that account settings could not be fully loaded and recommend refreshing before saving.
   - For accounts: replace misleading empty account copy only when `accountsPreloadWarning` exists.
   - Preserve true empty-state copy when there is no preload warning.

4. Prevent fallback-derived writes where needed.
   - Recommended safest behavior: disable profile save, avatar changes, and base-currency save while `profilePreloadWarning` exists, with copy telling the user to refresh.
   - Alternative lower-friction behavior: allow edits but require an explicit reload warning before saving. This is riskier because it can persist fallback-derived fields.
   - This is a UX behavior decision for the owner before implementation.

5. Add notification preference load warning.
   - Track a local `loadWarning` in `NotificationsPanel` when `/api/profile/notifications` fails or returns non-OK.
   - Keep default prefs as a fallback so the tab renders.
   - Show a warning that alert preferences could not be confirmed.
   - Disable `Guardar alertas` while the initial load failed, unless the owner explicitly approves saving defaults after a failed read.

6. Do not change:
   - database schema;
   - Supabase RLS;
   - auth/session logic;
   - middleware;
   - API response contracts;
   - Vercel environment variables;
   - visual design system.

## Files Proposed For Later Implementation

Expected files:

- `app/(dashboard)/settings/page.tsx`
- `components/settings/ProfileSettingsForm.tsx`
- `components/settings/PreferencesPanel.tsx`
- `components/settings/AccountsPanel.tsx`
- `components/settings/NotificationsPanel.tsx`

Possible but avoid unless it keeps the implementation smaller:

- `components/settings/primitives.tsx` for one small reusable warning row/banner.

Documentation/status file:

- `SETTINGS_PRELOAD_WARNING_PLAN.md`

Avoid changing:

- `app/api/profile/*`
- `app/api/imports/*`
- `middleware.ts`
- Supabase migrations or policies
- shared API contracts
- unrelated dashboard, portfolio, transactions, admin, or module files

## Owner Approval Required

Approval is required before implementation because the recommended fix changes visible settings behavior and may disable saves when trusted profile/preference data failed to load.

Approval is not required for database schema, Supabase RLS, auth, middleware, or API contract changes because this plan does not propose touching those areas.

Stop and request explicit approval if implementation discovers that a real fix requires:

- API contract changes;
- auth/session changes;
- middleware changes;
- Supabase RLS changes;
- database schema or migration changes;
- Vercel environment changes;
- business-rule changes around whether users may save settings after failed preload.

## Risk

Risk level: Low to medium.

Main risks:

- Warning logic could show a warning for a true empty account list if it is based on array length instead of explicit preload failure metadata.
- Disabling profile/preferences saves after a failed profile preload is safer for data integrity but may temporarily block a user who wanted to make a quick edit.
- Keeping saves enabled is less disruptive but risks persisting fallback defaults.
- Notification defaults may currently be intentional as schema-evolution fallback; the implementation must distinguish missing keys from failed reads.
- Adding props across settings panels can touch several UI files, so the PR should stay narrow and avoid redesign.

Risk controls:

- Use explicit warning metadata from failed queries/API calls; never infer failure from empty arrays alone.
- Preserve true empty states when the server query succeeds with no rows.
- Keep the existing fallback render so `/settings` does not crash.
- Sanitize technical errors before showing them.
- Keep API responses and database behavior unchanged.

## Local Test Plan

Run normal-state checks first:

1. Start the app with `npm run dev`.
2. Log in as a test user with a profile and at least one account.
3. Open `/settings`.
4. Confirm the profile tab shows the real name, email, avatar state, and account count.
5. Open `/settings?tab=preferences`.
6. Confirm currency and theme reflect the user's actual settings.
7. Save the base currency and confirm success behavior remains unchanged.
8. Open `/settings?tab=accounts`.
9. Confirm real accounts and totals render.
10. Open `/settings?tab=notifications`.
11. Confirm preferences load, skeletons resolve, toggles work, and save behavior is unchanged.
12. Open `/settings?tab=security` and verify validation/toasts still work for password mismatch and reset email.
13. Open `/settings?tab=export` and verify export/template/import actions still show progress/toasts.

Run failure-state checks in a local-only implementation branch:

1. Simulate profile preload timeout/failure in `app/(dashboard)/settings/page.tsx`.
2. Reload `/settings`.
3. Confirm the page still renders.
4. Confirm a clear warning appears for profile/settings data.
5. Confirm the UI does not imply the fallback profile/default currency is confirmed data.
6. Confirm profile/preferences saves are disabled or otherwise guarded according to the approved decision.
7. Simulate account preload timeout/failure.
8. Open `/settings?tab=accounts`.
9. Confirm the tab shows a load warning instead of "Aun no tienes cuentas registradas".
10. Confirm zero totals are not presented as confirmed balances when preload failed.
11. Simulate `/api/profile/notifications` failure.
12. Open `/settings?tab=notifications`.
13. Confirm defaults may render, but a warning appears and saving defaults is guarded according to the approved decision.
14. Confirm no console runtime errors appear.

Automated checks after implementation:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- available tests relevant to settings/auth routes

## Vercel Preview Test Plan

Normal preview validation:

1. Deploy the future implementation branch to Vercel Preview.
2. Confirm the Vercel build succeeds.
3. Log in on the preview URL.
4. Hard-open `/settings` in a fresh tab.
5. Confirm the page reaches a stable rendered state without infinite loading.
6. Test `/settings?tab=profile`, `/settings?tab=preferences`, `/settings?tab=accounts`, `/settings?tab=notifications`, `/settings?tab=security`, `/settings?tab=export`, and `/settings?tab=support`.
7. Confirm no preload warning appears when profile/accounts/notifications load successfully.
8. Confirm profile save, base-currency save, notification save, reset email, export, template download, and import analysis behavior remain unchanged.
9. Check browser console and network panel for runtime errors.
10. Check Vercel function logs for settings/profile-related errors.

Failure validation:

1. Use a temporary preview-only diagnostic patch, request blocking, or approved test environment condition to force profile preload failure.
2. Open `/settings` and `/settings?tab=preferences`.
3. Confirm a visible warning appears and fallback values are not presented as confirmed data.
4. Force account preload failure.
5. Open `/settings?tab=accounts`.
6. Confirm the accounts tab shows a warning/retry or refresh instruction instead of a true empty account state.
7. Force `/api/profile/notifications` failure.
8. Open `/settings?tab=notifications`.
9. Confirm the warning appears after skeletons resolve and save behavior is guarded.
10. Confirm the app shell/sidebar remains usable and other tabs still render.

## Recommendation

We are ready to implement Phase A3 after owner approval of one behavior decision:

Should profile/preferences/notification saves be disabled when the initial trusted preload fails?

Recommended decision: yes. Disable those saves until refresh/reload confirms current data, because this avoids accidentally saving fallback defaults into a financial SaaS account.

No additional broad diagnosis is needed before a narrow A3 implementation PR.

## Resumen en espanol

La pagina de Configuracion puede mostrar datos por defecto si falla la carga del perfil, cuentas o alertas. Eso puede hacer creer al usuario que todo esta bien, cuando en realidad hubo un problema cargando datos. La solucion recomendada es mostrar avisos claros, mantener la pagina abierta, y bloquear guardados sensibles hasta que los datos reales carguen correctamente.
