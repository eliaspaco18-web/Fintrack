# RPC security rehearsal

This procedure is for a **new disposable local Supabase stack** only. Do not point it at the existing `supabase_db_fintrack`, OX, a tunnel, or any remote project. The migration has not been applied as part of this change.

## What the forward migration changes

`20261026000001_harden_user_scoped_rpc_permissions.sql` preserves the dashboard RPC signature and body, adding a caller/target equality check. It removes direct and inherited client execution from the category seeder while retaining the existing `auth.users` trigger path. It pins both definer search paths and removes schema `CREATE` from public API roles. A migration precondition checks that the seeder and trigger share an owner and that the auth trigger exists.

## Create a separate rehearsal checkout and Supabase project

1. Create a detached checkout of the committed security branch under a new temporary path. Do not reuse a checkout that has an active Supabase stack:

   ```sh
   git worktree add --detach /private/tmp/fintrack-rpc-security-disposable <SECURITY_COMMIT_SHA>
   ```

2. In that checkout only, edit `supabase/config.toml` to set `project_id = "fintrack-rpc-security-disposable"` and unique ports: API `55321`, database `55322`, Studio `55323`, Inbucket `55324`. Confirm no other local service is bound to these ports before starting the stack.
3. Start Supabase using that checkout as its workdir (first confirm the installed CLI accepts `--workdir` in this position):

   ```sh
   supabase --workdir "$REHEARSAL_DIR" start
   docker ps --format 'table {{.Names}}\t{{.Ports}}'
   docker inspect <dedicated-db-container> --format '{{json .Config.Labels}} {{json .Mounts}} {{json .NetworkSettings.Ports}}'
   ```

   Verify every Supabase container is named/labeled for the dedicated project ID, uses the expected unique ports, and mounts only new volumes. Inspect `docker volume ls` and `docker inspect` to confirm no existing FinTrack or OX volume is selected. A loopback URL alone is not proof against tunnels or port forwarding.
4. Only after independently confirming the new stack identity, initialize its empty database using the repository migration chain:

   ```sh
   supabase --workdir "$REHEARSAL_DIR" db reset --local
   ```

   This destructive command is intended only for the newly created disposable stack. Do not use it against any other project/workdir. Confirm the database port is `55322`, the API port is `55321`, and the migration ledger matches the expected migration set.

The commands that start containers or initialize the disposable database are intentionally not run by this commit. The existing local instance was not contacted.

## Run read-only ACL assertions and existing financial regression

With the disposable database initialized, execute the ACL assertions and the existing atomic-RPC suite against its database URL only:

```sh
psql "$DISPOSABLE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/user_scoped_rpc_acl.sql
psql "$DISPOSABLE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/create_transaction_atomic_security.sql
```

The second script creates synthetic rows inside a transaction and rolls them back. Run it only on the disposable database.

## Run PostgREST authentication tests

Obtain local anon/service-role keys from the disposable stack status output without copying or printing them into logs. Export them only in the current shell, then run:

```sh
export FINTRACK_RPC_SECURITY_TARGET=fintrack-rpc-security-disposable
export SUPABASE_URL=http://127.0.0.1:55321
export SUPABASE_ANON_KEY='<disposable-local-anon-key>'
export SUPABASE_SERVICE_ROLE_KEY='<disposable-local-service-role-key>'
node scripts/db-certification/rpc-security-postgrest.mjs
unset SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
```

The test creates two synthetic Auth users, verifies registration seeding, checks an authenticated user's own dashboard, checks anonymous and cross-user denials, attempts the seeder as anon, user A, and service role, verifies user B's category snapshot remains byte-for-byte unchanged, and deletes the synthetic users in `finally`. The service-role client is used only for Auth fixture creation/cleanup and read-only snapshots, not for the tested RPC calls.

The script fails closed unless the target marker is explicit, keys carry the expected role claims, and the URL is HTTP loopback on port `55321`. Those checks do not defeat a tunnel or proxy; before execution, independently verify the Docker project/volume labels and local Supabase status for the dedicated project.

## Expected outcome

- `fn_dashboard_summary(A)` succeeds for A; anon calls and `A -> B` fail with SQLSTATE `42501`.
- `fn_seed_default_categories(B)` is not executable by anon, A, or service role, and B's rows remain unchanged.
- Creating a synthetic Auth user still causes the registration trigger to seed that user's default categories.
- `create_transaction_atomic` remains executable by authenticated users and passes the existing atomicity/ownership test.
- No request is sent to a remote Supabase endpoint and no existing local database is reset or modified.


## Production impact check (read-only; not performed)

Only after separate authorization to inspect Production, run catalog-only queries using an approved read-only connection. Do not call the RPCs or query financial tables. The following query distinguishes the stored ACL entries (including `PUBLIC`) from effective role privileges and reports owner and security configuration:

```sql
SELECT
  p.oid::regprocedure AS function_signature,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  p.proconfig AS function_settings,
  p.proacl AS stored_acl,
  pg_get_functiondef(p.oid) AS function_definition,
  md5(pg_get_functiondef(p.oid)) AS definition_fingerprint,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_effective_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_effective_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_effective_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('fn_dashboard_summary', 'fn_seed_default_categories');

SELECT
  CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
  p.oid::regprocedure AS function_signature,
  acl.privilege_type,
  acl.is_grantable
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
WHERE n.nspname = 'public'
  AND p.proname IN ('fn_dashboard_summary', 'fn_seed_default_categories');

SELECT
  has_schema_privilege('anon', 'public', 'USAGE') AS anon_public_usage,
  has_schema_privilege('anon', 'public', 'CREATE') AS anon_public_create,
  has_schema_privilege('authenticated', 'public', 'CREATE') AS authenticated_public_create,
  has_schema_privilege('service_role', 'public', 'CREATE') AS service_role_public_create,
  has_schema_privilege('anon', 'auth', 'CREATE') AS anon_auth_create,
  has_schema_privilege('authenticated', 'auth', 'CREATE') AS authenticated_auth_create;

SELECT pg_get_functiondef('public.fn_handle_new_user()'::regprocedure) AS registration_trigger_definition;

SELECT t.tgname, t.tgenabled, t.tgfoid::regprocedure AS handler
FROM pg_trigger t
WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal;
```

Compare `definition_fingerprint`/`pg_get_functiondef` and the applied migration ledger with the exact deployed release. A `true` result for `anon_effective_execute` on the dashboard function, together with the vulnerable pre-migration definition, confirms unauthenticated RPC exposure. A `true` result for anon/authenticated execution on the category seeder confirms a callable mutation path. Preserve the output as metadata only; do not include project credentials or user data. This check does not establish that Production has the vulnerable migration state unless the returned function definition/settings and applied migration ledger are compared to the exact deployed release.
