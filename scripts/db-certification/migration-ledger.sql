-- Read-only ledger inventory. Run only against a verified isolated clone.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_pretty(jsonb_build_object(
  'database', current_database(),
  'captured_at', transaction_timestamp(),
  'migration_rows', coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.version), '[]'::jsonb)
))
FROM supabase_migrations.schema_migrations AS m;
ROLLBACK;
