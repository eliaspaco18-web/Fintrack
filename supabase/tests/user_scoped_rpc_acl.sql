-- Read-only assertions for the forward RPC-hardening migration.
-- Run only against the dedicated disposable local stack.
\set ON_ERROR_STOP on

DO $$
DECLARE
  dashboard_oid oid := to_regprocedure('public.fn_dashboard_summary(uuid)');
  seed_oid oid := to_regprocedure('public.fn_seed_default_categories(uuid)');
  handler_oid oid := to_regprocedure('public.fn_handle_new_user()');
  dashboard_config text[];
  seed_config text[];
  dashboard_is_definer boolean;
  seed_is_definer boolean;
  handler_is_definer boolean;
  handler_definition text;
BEGIN
  IF dashboard_oid IS NULL OR seed_oid IS NULL OR handler_oid IS NULL THEN
    RAISE EXCEPTION 'Expected RPC or registration function is missing';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'fn_dashboard_summary') <> 1
     OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'fn_seed_default_categories') <> 1 THEN
    RAISE EXCEPTION 'Unexpected overload remains for a user-scoped RPC';
  END IF;

  -- has_function_privilege checks effective ACLs, including PUBLIC inheritance.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    WHERE n.nspname = 'public'
      AND p.proname IN ('fn_dashboard_summary', 'fn_seed_default_categories')
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC still has EXECUTE on a user-scoped RPC';
  END IF;

  IF NOT has_function_privilege('authenticated', dashboard_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must retain dashboard RPC execution';
  END IF;
  IF has_function_privilege('anon', dashboard_oid, 'EXECUTE')
     OR has_function_privilege('service_role', dashboard_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'dashboard RPC must not be executable by anon or service_role';
  END IF;
  IF has_function_privilege('anon', seed_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', seed_oid, 'EXECUTE')
     OR has_function_privilege('service_role', seed_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'category seeder must be private to its owner/trigger path';
  END IF;

  IF has_schema_privilege('anon', 'public', 'CREATE')
     OR has_schema_privilege('authenticated', 'public', 'CREATE')
     OR has_schema_privilege('service_role', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'Untrusted API roles must not CREATE in public';
  END IF;
  IF has_schema_privilege('anon', 'auth', 'CREATE')
     OR has_schema_privilege('authenticated', 'auth', 'CREATE')
     OR has_schema_privilege('service_role', 'auth', 'CREATE') THEN
    RAISE EXCEPTION 'API roles must not CREATE in the Supabase auth schema';
  END IF;

  SELECT prosecdef, proconfig INTO dashboard_is_definer, dashboard_config
  FROM pg_proc WHERE oid = dashboard_oid;
  SELECT prosecdef, proconfig INTO seed_is_definer, seed_config
  FROM pg_proc WHERE oid = seed_oid;
  SELECT prosecdef, pg_get_functiondef(oid) INTO handler_is_definer, handler_definition
  FROM pg_proc WHERE oid = handler_oid;
  IF NOT dashboard_is_definer OR NOT seed_is_definer THEN
    RAISE EXCEPTION 'Both functions must retain SECURITY DEFINER behavior';
  END IF;
  IF NOT coalesce(array_to_string(dashboard_config, ',') LIKE '%search_path=pg_catalog, public, pg_temp%', false)
     OR NOT coalesce(array_to_string(seed_config, ',') LIKE '%search_path=pg_catalog, public, pg_temp%', false) THEN
    RAISE EXCEPTION 'SECURITY DEFINER function search_path is not pinned as expected';
  END IF;

  IF NOT handler_is_definer
     OR position('fn_seed_default_categories' IN handler_definition) = 0 THEN
    RAISE EXCEPTION 'Registration handler must remain SECURITY DEFINER and call the category seeder';
  END IF;
  IF (SELECT proowner FROM pg_proc WHERE oid = seed_oid)
     IS DISTINCT FROM (SELECT proowner FROM pg_proc WHERE oid = handler_oid) THEN
    RAISE EXCEPTION 'Registration trigger owner cannot invoke the private category seeder';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgfoid = handler_oid AND t.tgrelid = 'auth.users'::regclass
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Registration trigger dependency is missing';
  END IF;
END
$$;

SELECT 'PASS: function ACL, SECURITY DEFINER search_path, schema CREATE grants, and auth.users trigger dependency' AS result;
