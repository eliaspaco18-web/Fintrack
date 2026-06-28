# QA_CHECKLIST.md

## Required Pre-Release Checks

### Automated Checks

- [x] TypeScript passes with `./node_modules/.bin/tsc --noEmit --incremental false`.
- [x] Lint passes with `npm run lint`.
- [x] Production build passes with `npm run build`.
- [x] Unauthenticated protected-route E2E passes for `/dashboard`, `/transactions`, `/portfolio`, and `/admin`.
- [ ] Authenticated E2E smoke passes with a dedicated test user.
- [ ] Release check runs in a preview environment, not directly against production.

### Route And Auth Checks

- [ ] `/` is public and redirects authenticated users to `/dashboard`.
- [ ] `/login` and `/register` redirect authenticated users away.
- [ ] Dashboard routes redirect unauthenticated users to `/login?next=...`.
- [ ] API routes return `401` for unauthenticated users where required.
- [ ] Middleware does not add unnecessary auth overhead to API/static pass-through routes.
- [ ] Auth callback handles verification, recovery, invalid code, and sanitized `next` values.

### Module State Checks

For every visible module (`dashboard`, `portfolio`, `transactions`, `credits`, `budgets`, `assets`, `receivables`, `payables`, `recurring`, `alerts`, `admin`, `settings`):

- [ ] Loading state appears quickly and resolves.
- [ ] Error state shows a useful message and retry path.
- [ ] Empty state is distinct from error state.
- [ ] Success state renders real data correctly.
- [ ] No infinite skeleton/loading state remains after failed requests.
- [ ] Refresh/retry actions work.

### Portfolio Checks

- [ ] `/portfolio` renders existing accounts on first load.
- [ ] Failed account preload shows an explicit error, not only an empty state.
- [ ] `/portfolio?new=portfolio` opens the create modal.
- [ ] Topbar "Nuevo portafolio" opens the create modal.
- [ ] Force `/api/accounts?include_inactive=true` to fail and confirm the portfolio page shows an error banner with retry, not the empty portfolio message.
- [ ] Force `/api/bank-entities?include_inactive=false` to fail and confirm the portfolio page still renders loaded accounts with a visible bank-loading error when account data succeeds.
- [ ] Simulate a slow portfolio API response over 10 seconds and confirm the skeleton resolves into an error state instead of staying infinite.
- [ ] Confirm retry reloads both accounts and bank entities after a portfolio load failure.
- [ ] Create account works with and without bank entity.
- [ ] Edit account preserves/display bank entity after save.
- [ ] Deactivate/delete blocked accounts show business-rule errors.
- [ ] Active/inactive/technical filters work.
- [ ] Custom active user currencies appear in the currency selector.
- [ ] Empty portfolio shows a create action.

### Slow Loading Checks

- [ ] Capture cold and warm load timings for each main module.
- [ ] Record network waterfall for slow modules.
- [ ] Confirm middleware time is not repeated unnecessarily for every API call.
- [ ] Confirm dashboard bootstrap does not duplicate expensive summary queries.
- [ ] Confirm route chunks are preloaded or cached where appropriate.
- [ ] Confirm Supabase queries are not waiting indefinitely.

### Buttons, Links, Menus, Modals, Drawers, And CTAs

- [ ] Sidebar links navigate to live modules or status pages.
- [ ] Topbar quick-create links open their target modal/action.
- [ ] Topbar profile and quick menus close on route change, outside click, and Escape.
- [ ] QuickActionsFAB links/actions work on desktop and mobile.
- [ ] Disabled buttons show disabled state and cannot submit.
- [ ] Delete/deactivate confirmation dialogs cannot double-submit.
- [ ] Modal close buttons, Escape, overlay click, and focus handling work.

### Forms And Validation

- [ ] Transaction form validates required fields and shows API validation details.
- [ ] Portfolio form validates account name, currency, date, and bank entity.
- [ ] Credit card and loan forms handle missing bank/account options.
- [ ] Asset form handles missing account options.
- [ ] Receivable/payable forms handle missing account/debtor/creditor options.
- [ ] Settings security form handles password mismatch, reset, and delete account flow.
- [ ] File uploads reject invalid file type/size and show clear errors.

### Supabase, RLS, And Data Integrity

- [ ] Verify live RLS policies for user-owned tables in a non-production clone or approved production read-only check.
- [ ] Verify `accounts`, `transactions`, `bank_entities`, `user_currencies`, `credits`, `receivables`, `payables`, and `budgets` indexes match current query patterns.
- [ ] Confirm service-role routes validate the authenticated user before bypassing RLS.
- [ ] Confirm dashboard RPC `fn_dashboard_summary` exists and performs acceptably in the live environment.
- [ ] Confirm migrations have been applied consistently in the linked Supabase project.

### Vercel And Deployment

- [ ] Preview deployment builds successfully.
- [ ] Required environment variables exist in Vercel preview and production.
- [ ] Vercel cron `/api/cron/exchange-rate` is protected by `CRON_SECRET`.
- [ ] Release script cannot accidentally target production without approval.
- [ ] Build output route sizes are reviewed before release.

### Accessibility And Responsive Basics

- [ ] Keyboard navigation reaches all primary actions.
- [ ] Focus is visible on buttons, links, menus, and form fields.
- [ ] Menus and modals use appropriate labels and dismissal behavior.
- [ ] Mobile drawer opens, closes, and does not trap page scroll incorrectly.
- [ ] Tables/cards remain readable on mobile.
- [ ] Important icon-only buttons have accessible labels.

### Security Basics For Financial SaaS

- [ ] Security headers remain enabled.
- [ ] Sensitive service-role logic stays server-only.
- [ ] No service-role key is exposed to client bundles.
- [ ] Profile export/delete flows require authenticated session.
- [ ] File upload paths are user-scoped and validated.
- [ ] API error messages are useful but do not leak secrets.
- [ ] Production database changes require explicit owner approval.
