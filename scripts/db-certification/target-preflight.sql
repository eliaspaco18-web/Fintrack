-- Read-only identity diagnostics for a verified isolated target.
-- These values supplement, but do not replace, host/listener/marker checks.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_pretty(jsonb_build_object(
  'captured_at', transaction_timestamp(),
  'database', current_database(),
  'database_user', current_user,
  'server_address', inet_server_addr()::text,
  'server_port', inet_server_port(),
  'server_version', current_setting('server_version'),
  'cluster_name', current_setting('cluster_name', true),
  'certification_target_id', current_setting('fintrack.certification_target_id', true),
  'migration_ledger_relation_present', to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
));
ROLLBACK;
