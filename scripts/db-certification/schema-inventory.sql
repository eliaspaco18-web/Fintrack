-- Read-only inventory of security and schema objects affected by the migration
-- rehearsal. Run against a verified isolated clone only.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_pretty(jsonb_build_object(
  'captured_at', transaction_timestamp(),
  'database', current_database(),
  'tables_rls', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname,
      'rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity
    ) ORDER BY n.nspname, c.relname), '[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND n.nspname IN ('public', 'auth', 'storage')
  ),
  'policies', (
    SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.schemaname, p.tablename, p.policyname), '[]'::jsonb)
    FROM pg_catalog.pg_policies p
    WHERE p.schemaname IN ('public', 'auth', 'storage')
  ),
  'table_view_grants', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'object', c.relname,
      'grantee', CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END,
      'privilege', acl.privilege_type, 'grantable', acl.is_grantable
    ) ORDER BY n.nspname, c.relname, acl.grantee, acl.privilege_type), '[]'::jsonb)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
    LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
    WHERE c.relkind IN ('r', 'p', 'v', 'm')
      AND n.nspname IN ('public', 'auth', 'storage')
  ),
  'constraints', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname,
      'name', con.conname, 'type', con.contype,
      'validated', con.convalidated,
      'definition', pg_get_constraintdef(con.oid, true)
    ) ORDER BY n.nspname, c.relname, con.conname), '[]'::jsonb)
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'auth', 'storage')
  ),
  'indexes', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname,
      'name', i.relname, 'valid', ix.indisvalid, 'ready', ix.indisready,
      'definition', pg_get_indexdef(i.oid)
    ) ORDER BY n.nspname, c.relname, i.relname), '[]'::jsonb)
    FROM pg_index ix
    JOIN pg_class c ON c.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'auth', 'storage')
  ),
  'triggers', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname,
      'trigger', t.tgname, 'enabled', t.tgenabled,
      'definition', pg_get_triggerdef(t.oid, true)
    ) ORDER BY n.nspname, c.relname, t.tgname), '[]'::jsonb)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname IN ('public', 'auth', 'storage')
  ),
  'views', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'view', c.relname, 'options', c.reloptions,
      'definition', pg_get_viewdef(c.oid, true)
    ) ORDER BY n.nspname, c.relname), '[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('v', 'm') AND n.nspname IN ('public', 'auth', 'storage')
  ),
  'functions', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', p.proname,
      'identity_arguments', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef, 'configuration', p.proconfig,
      'owner', pg_get_userbyid(p.proowner),
      'acl', coalesce(p.proacl::text, 'default'),
      'definition_md5', md5(pg_get_functiondef(p.oid))
    ) ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'auth', 'storage')
      AND p.prokind IN ('f', 'p')
  ),
  'extensions', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('name', e.extname, 'version', e.extversion)
                              ORDER BY e.extname), '[]'::jsonb)
    FROM pg_extension e
  ),
  'migration_ledger_relation_present', to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
  'cron_relation_present', to_regclass('cron.job') IS NOT NULL,
  'storage_attachment_bucket_present', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  )
));
ROLLBACK;
