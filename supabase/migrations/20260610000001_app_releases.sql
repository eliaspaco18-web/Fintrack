CREATE TABLE IF NOT EXISTS public.app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  series text NOT NULL,
  build_number integer NOT NULL CHECK (build_number > 0),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 140),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 2 AND 500),
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  commit_sha text NULL,
  deployed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  email_sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT app_releases_highlights_is_array CHECK (jsonb_typeof(highlights) = 'array')
);

CREATE TABLE IF NOT EXISTS public.app_release_user_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.app_releases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_sent_at timestamptz NULL,
  in_app_seen_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT app_release_user_state_unique UNIQUE (release_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_releases_deployed_at
  ON public.app_releases (deployed_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_release_user_state_user
  ON public.app_release_user_state (user_id, in_app_seen_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_release_user_state_release
  ON public.app_release_user_state (release_id, email_sent_at);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'fn_set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_app_releases_updated_at ON public.app_releases;
    CREATE TRIGGER trg_app_releases_updated_at
      BEFORE UPDATE ON public.app_releases
      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

    DROP TRIGGER IF EXISTS trg_app_release_user_state_updated_at ON public.app_release_user_state;
    CREATE TRIGGER trg_app_release_user_state_updated_at
      BEFORE UPDATE ON public.app_release_user_state
      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
  END IF;
END $$;

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_release_user_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_releases: select authenticated" ON public.app_releases;
CREATE POLICY "app_releases: select authenticated"
  ON public.app_releases
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "app_release_user_state: select own" ON public.app_release_user_state;
CREATE POLICY "app_release_user_state: select own"
  ON public.app_release_user_state
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "app_release_user_state: update own" ON public.app_release_user_state;
CREATE POLICY "app_release_user_state: update own"
  ON public.app_release_user_state
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.app_releases TO authenticated;
GRANT SELECT, UPDATE ON public.app_release_user_state TO authenticated;
