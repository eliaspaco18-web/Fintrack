# Isolated RPC security rehearsal

This rehearsal uses one **new disposable local Supabase project** and the same database for baseline and post-migration checks. It does not use the existing `supabase_db_fintrack`, OX, or a remote project. No rehearsal command has been run in this change.

## Backup and static review

The original candidate `00dfa6e6e3819610e8fdafb876a6e38a0abfc325` was bundled before follow-up changes at:

`~/Documents/FinTrackV3-Backup/fintrack-rpc-security-00dfa6e6.bundle`

It passed `git bundle verify` and contains the exact candidate ref and full history.

The migration and SQL test now fail closed if an unexpected overload exists for either user-scoped function. The SQL test checks effective role privileges (`has_function_privilege` / `has_schema_privilege`), which include inherited `PUBLIC` grants, and also inspects stored function ACLs for explicit `PUBLIC EXECUTE`. Exact function identities are used for the intended signatures. No database was queried from the sandbox.

## macOS Terminal procedure

Use a clean Terminal session with Node 24 and Docker running. The Supabase CLI runs from a separate worktree; do not run `supabase link`, `db push`, or any command with `--linked`.

### 1. Create the isolated worktree

```sh
SECURITY_REPO="$HOME/Documents/FinTrackV3-Security"
REHEARSAL_ROOT="/private/tmp/FinTrackV3-RPC-Rehearsal"
APPROVED_SHA="${FINTRACK_RPC_REHEARSAL_SHA:?Set this to the exact reviewed local commit SHA}"
test "$(git -C "$SECURITY_REPO" rev-parse refs/heads/codex/security-dependencies)" = "$APPROVED_SHA" || { echo 'STOP: security branch does not match the reviewed rehearsal SHA'; exit 1; }
mkdir -p "$REHEARSAL_ROOT"
git -C "$SECURITY_REPO" worktree add --detach "$REHEARSAL_ROOT/project" "$APPROVED_SHA"
```

In **that worktree only**, set `project_id = "fintrack-rpc-security-rehearsal"` in `supabase/config.toml`; set API `55321`, database `55322`, database shadow `55320`, Studio `55323`, and Inbucket UI `55324`. Keep analytics and the pooler disabled, leave optional SMTP/POP3 and S3 ports unset/disabled, and do not change the original repository config.

Confirm the selected ports are free immediately before starting. This check was run once in the Codex environment and ports `55320–55329` were free at that time; it does not reserve them and must be repeated in Terminal:

```sh
for p in 55320 55321 55322 55323 55324 55325 55326 55327 55328 55329; do
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "STOP: port $p is already listening"
    lsof -nP -iTCP:"$p" -sTCP:LISTEN
    exit 1
  fi
done
```

The assigned ports are 55320–55324; 55325–55329 are checked as reserve space if the installed CLI config exposes another host port. If any configured service needs a port outside this block, stop and allocate/check another unique port before starting.

### 2. Baseline: run without the corrective migration

The worktree is the approved commit containing the migration. Temporarily move only that migration outside `supabase/migrations` so the first reset reproduces the parent state. The shell trap restores it on success, error, interrupt, or termination:

```sh
cd "$REHEARSAL_ROOT/project"
MIGRATION="$PWD/supabase/migrations/20261026000001_harden_user_scoped_rpc_permissions.sql"
HELD="$REHEARSAL_ROOT/harden-rpc.pending.sql"
test -f "$MIGRATION" && test ! -e "$HELD" || { echo 'STOP: unexpected migration file state'; exit 1; }
restore_migration() { if test -f "$HELD"; then mv "$HELD" "$MIGRATION"; fi; }
trap restore_migration EXIT HUP INT TERM
mv "$MIGRATION" "$HELD"
```

Start the stack, then verify the CLI reports project `fintrack-rpc-security-rehearsal`, API `127.0.0.1:55321`, and DB `127.0.0.1:55322`. Inspect containers, labels, mounts and volumes before resetting. Stop if the expected unique project/container name is absent, if a mount is shared with an existing stack, or if anything points to OX/FinTrack’s existing project. Do not print status output containing local keys:

```sh
supabase start
umask 077
STATUS_ENV="$REHEARSAL_ROOT/local-status.env"
supabase status -o env > "$STATUS_ENV"
chmod 600 "$STATUS_ENV"
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Identify exactly one new database container whose name includes `fintrack-rpc-security-rehearsal`, then inspect it without printing secrets:

```sh
DB_CONTAINER="<exact new database container name>"
docker inspect "$DB_CONTAINER" --format '{{.Name}} {{json .Config.Labels}} {{json .Mounts}} {{json .NetworkSettings.Ports}}'
```

Only after confirming the container name, unique mounts and ports, reset this new local project. The command is deliberately unlinked and targets the current worktree’s local database:

```sh
supabase db reset
```

Do not run this command from any other directory. It rebuilds only this newly created disposable database. Then run the before-phase PostgREST test, using the candidate checkout’s installed Node dependencies and only the local status file’s keys:

```sh
set -a
. "$STATUS_ENV"
set +a
export SUPABASE_URL="$API_URL"
export SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
node --version  # require v24.x
RPC_SECURITY_PHASE=before FINTRACK_RPC_SECURITY_TARGET=fintrack-rpc-security-rehearsal \
  node "$SECURITY_REPO/scripts/db-certification/rpc-security-postgrest.mjs"
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 \
  < "$SECURITY_REPO/supabase/tests/create_transaction_atomic_security.sql"
unset SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY ANON_KEY SERVICE_ROLE_KEY API_URL
rm -f "$STATUS_ENV"
```

The baseline script confirms that a normal authenticated A→B call exposes B’s synthetic account if the vulnerable definition/grant is present. It reports whether anon is also able to call the dashboard in this fresh stack (the repository’s baseline migrations revoke `PUBLIC` for that RPC, so direct anon permission may differ from the reported existing instance). It probes anon and user A category seeding by removing only a category belonging to synthetic user B and checking whether the RPC restores it. It removes both synthetic Auth users in `finally`.

### 3. Apply the forward migration to the same disposable database

Restore the migration and clear the trap. Apply pending local migrations, not a reset; this exercises the actual forward upgrade against the same disposable database:

```sh
restore_migration
trap - EXIT HUP INT TERM
supabase migration up --local
```

If `migration up --local` is unavailable in the installed CLI, stop and inspect `supabase migration up --help`; do not substitute `db push` or a linked command.

Reconfirm the same project/API/DB identity and database container. Refresh the protected local status file, then run the post-phase tests:

```sh
umask 077
STATUS_ENV="$REHEARSAL_ROOT/local-status.env"
supabase status -o env > "$STATUS_ENV"
chmod 600 "$STATUS_ENV"
set -a
. "$STATUS_ENV"
set +a
export SUPABASE_URL="$API_URL"
export SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
RPC_SECURITY_PHASE=after FINTRACK_RPC_SECURITY_TARGET=fintrack-rpc-security-rehearsal \
  node "$SECURITY_REPO/scripts/db-certification/rpc-security-postgrest.mjs"
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 \
  < "$SECURITY_REPO/supabase/tests/user_scoped_rpc_acl.sql"
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 \
  < "$SECURITY_REPO/supabase/tests/create_transaction_atomic_security.sql"
unset SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY ANON_KEY SERVICE_ROLE_KEY API_URL
rm -f "$STATUS_ENV"
```

Expected post-migration results: the owner dashboard works; anonymous, null-ID, cross-user, and service-role dashboard calls fail with `42501`; anon/A/service-role seeder calls fail and B’s post-setup category snapshot stays unchanged; new user registration still seeds categories; ACL assertions pass; the existing atomic financial RPC test confirms successful PEN/USD and derived operations plus rollback after failure. All financial SQL fixtures are wrapped in a transaction and rolled back. The PostgREST test writes only synthetic users, categories and one synthetic account, then deletes the users.

Finally stop only the project from its worktree, retaining its volume for review. Do not destroy volumes until certification is accepted:

```sh
cd "$REHEARSAL_ROOT/project"
supabase stop
```

## Read-only Production impact check (not performed)

Use the catalog query below only after separate authorization and a read-only Production session. It reads function definitions/ACLs and schema privileges only; it does not call the functions or read financial rows. Compare the definition, ACL, overload count and applied migration ledger with the exact deployed release. Never include keys or user data in the report.

```sql
SELECT
  p.oid::regprocedure AS function_signature,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  p.proconfig AS function_settings,
  p.proacl AS stored_acl,
  pg_get_functiondef(p.oid) AS function_definition,
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
