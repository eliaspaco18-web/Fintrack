# Stage 6a catalog pilot: readiness and S06 gate

Base SHA: `499c70fa446b8152120314e9279145176a6ed655`, branch `codex/redisenio-total`. This is a read-only source audit and gate record. **No Stage 6a catalog handler, form, API or data was changed in this checkpoint.** Stage 6a is the next ordered handoff package after the implemented, opt-in Stage 6 shell.

## Existing contract inventory

| Owner | Current capabilities to retain | Stage 6a verification needed |
|---|---|---|
| `components/management/CategoriesManager.tsx` | Create/edit/delete by real category ID; name, income/expense scope, color, icon picker and optional uploaded icon; search and scope filter; protected system/linked-key category guard; linked-transaction deletion rejection. There is no category activate/deactivate action. | Preserve all fields and uploaded-icon path; exact ID on edit/delete; rejection keeps the draft; confirmed result updates the owner row; brief Round 07 acknowledgement only after server confirmation. |
| `components/management/BankEntitiesManager.tsx` | Create/edit/delete and activate/deactivate by real entity ID; name, short name, code, country, color, icon/upload, status; search/state filter and `new=bank` deep link. Server may synchronize linked account institution labels on rename and reject deletion with linked records. | Preserve real state/relationship behavior and all fields; no blanket system lock; confirmed state changes update the row and preserve links; errors/unknown outcomes do not claim success. |
| `app/api/categories/*`, `app/api/bank-entities/*` | Existing Zod, authorization, user scoping, duplicate and protected-record checks, success/error payloads and 204 deletes. | Presentation integration only. Do not alter API, RLS, schema, auth, linked-account side effects or notification persistence as part of this visual package. |

The current catalog managers call their existing API handlers and refresh the list before showing an ephemeral toast. Their `loadCategories`/`loadEntities` helpers catch refresh failure internally; a confirmed mutation can therefore be followed by a stale list. Stage 6a must distinguish “write confirmed, refresh stale” from “write rejected” without blindly retrying a write. A transport failure after sending a mutation can also leave the write outcome unknown; the design requires retaining the draft/record identity and no automatic resubmission. These are integration acceptance cases, not evidence that either has occurred in production.

## Gate and safe next action

Stage 6a acceptance explicitly includes authenticated create/edit/delete and entity activation/deactivation. No approved disposable Preview/Supabase target or dedicated QA user is available in this session. The existing authenticated harness intentionally fails closed without the owner-provided values described in `AUTHENTICATED_QA_SETUP.md`; local synthetic mocks are not a substitute. Thus Stage 6a is **not implemented or certified** here. Do not opt these managers into the new workbench/feedback action adapter, declare the row update correct, run writes against production, or advance to the Accounts pilot merely because an unauthenticated screenshot looks right.

To resume, provide an isolated Vercel Preview connected only to disposable Supabase, its exact QA/production host and project-ref allow/deny values, a dedicated QA user through runtime secrets, and a confirmed reset procedure. First run the guarded smoke and focused catalog create/edit/delete/state tests, then the stage-specific focus/draft/unknown-result and visual matrix. Recheck the actual API outcome semantics before enabling the pilot. If a confirmed write cannot be reconciled safely after a failed refresh, stop at that integration point for the separate O11 decision; do not invent an endpoint or retry policy.

## Risk and rollback

There is no Stage 6a code change to roll back. Keep `NEXT_PUBLIC_FINTRACK_V3_SHELL` unset for the legacy shell while this gate is open. The Stage 6 rollout itself can be disabled by the switch; its detailed code-only rollback is in `STAGE_06_ROLLOUT_SWITCH.md`. No database rollback or production-data testing is part of this checkpoint.
