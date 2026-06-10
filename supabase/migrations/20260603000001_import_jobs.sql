-- =============================================================================
-- MIGRATION: import jobs for Excel migration
-- Base tecnica para validar y confirmar importaciones por fases.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.import_jobs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source           text        NOT NULL DEFAULT 'EXCEL',
  status           text        NOT NULL DEFAULT 'DRAFT',
  template_version text        NOT NULL DEFAULT 'excel-v1',
  file_name        text,
  file_url         text,
  file_size_bytes  bigint,
  file_hash        text,
  summary          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  error_count      integer     NOT NULL DEFAULT 0,
  warning_count    integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  committed_at     timestamptz,

  CONSTRAINT import_jobs_source_check CHECK (source IN ('EXCEL')),
  CONSTRAINT import_jobs_status_check CHECK (status IN ('DRAFT', 'VALIDATED', 'COMMITTED', 'FAILED', 'CANCELLED')),
  CONSTRAINT import_jobs_error_count_nonneg CHECK (error_count >= 0),
  CONSTRAINT import_jobs_warning_count_nonneg CHECK (warning_count >= 0),
  CONSTRAINT import_jobs_file_size_nonneg CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  CONSTRAINT import_jobs_file_name_length CHECK (file_name IS NULL OR char_length(file_name) <= 240),
  CONSTRAINT import_jobs_template_version_length CHECK (char_length(template_version) BETWEEN 1 AND 40)
);

CREATE TABLE IF NOT EXISTS public.import_job_rows (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id    uuid        NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sheet_name       text        NOT NULL,
  row_number       integer     NOT NULL,
  row_key          text,
  status           text        NOT NULL DEFAULT 'VALID',
  payload          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  errors           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  warnings         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  target_table     text,
  target_record_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT import_job_rows_status_check CHECK (status IN ('VALID', 'WARNING', 'ERROR', 'IMPORTED', 'SKIPPED')),
  CONSTRAINT import_job_rows_row_number_positive CHECK (row_number >= 1),
  CONSTRAINT import_job_rows_sheet_name_length CHECK (char_length(sheet_name) BETWEEN 1 AND 80),
  CONSTRAINT import_job_rows_row_key_length CHECK (row_key IS NULL OR char_length(row_key) <= 160),
  CONSTRAINT import_job_rows_target_table_length CHECK (target_table IS NULL OR char_length(target_table) <= 80),
  UNIQUE (import_job_id, sheet_name, row_number)
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_user_created
  ON public.import_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_jobs_user_status
  ON public.import_jobs (user_id, status);

CREATE INDEX IF NOT EXISTS idx_import_job_rows_job_status
  ON public.import_job_rows (import_job_id, status);

CREATE INDEX IF NOT EXISTS idx_import_job_rows_user_job
  ON public.import_job_rows (user_id, import_job_id);

CREATE OR REPLACE FUNCTION public.fn_import_job_rows_sync_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_user_id uuid;
BEGIN
  SELECT user_id INTO job_user_id
  FROM public.import_jobs
  WHERE id = NEW.import_job_id;

  IF job_user_id IS NULL THEN
    RAISE EXCEPTION 'import_job_id % does not exist', NEW.import_job_id;
  END IF;

  NEW.user_id = job_user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_import_job_rows_sync_user_id ON public.import_job_rows;
CREATE TRIGGER trg_import_job_rows_sync_user_id
BEFORE INSERT OR UPDATE OF import_job_id, user_id ON public.import_job_rows
FOR EACH ROW EXECUTE FUNCTION public.fn_import_job_rows_sync_user_id();

DROP TRIGGER IF EXISTS trg_import_jobs_updated_at ON public.import_jobs;
CREATE TRIGGER trg_import_jobs_updated_at
BEFORE UPDATE ON public.import_jobs
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_import_job_rows_updated_at ON public.import_job_rows;
CREATE TRIGGER trg_import_job_rows_updated_at
BEFORE UPDATE ON public.import_job_rows
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_jobs: select own" ON public.import_jobs;
CREATE POLICY "import_jobs: select own"
  ON public.import_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "import_jobs: insert own" ON public.import_jobs;
CREATE POLICY "import_jobs: insert own"
  ON public.import_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "import_jobs: update own" ON public.import_jobs;
CREATE POLICY "import_jobs: update own"
  ON public.import_jobs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "import_job_rows: select own" ON public.import_job_rows;
CREATE POLICY "import_job_rows: select own"
  ON public.import_job_rows
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "import_job_rows: insert own" ON public.import_job_rows;
CREATE POLICY "import_job_rows: insert own"
  ON public.import_job_rows
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "import_job_rows: update own" ON public.import_job_rows;
CREATE POLICY "import_job_rows: update own"
  ON public.import_job_rows
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
