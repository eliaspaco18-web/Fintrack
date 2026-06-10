-- =============================================================================
-- MIGRATION: BANK ENTITIES + APP NOTIFICATIONS
-- - Crea entidades bancarias por usuario
-- - Vincula accounts -> bank_entities
-- - Crea notificaciones internas de actividad
-- - Habilita RLS y políticas
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: bank_entities
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_entities (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  short_name  text,
  code        text,
  country     text        NOT NULL DEFAULT 'PE',
  color       text        NOT NULL DEFAULT '#0ea5e9',
  icon        text        NOT NULL DEFAULT 'bank',
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bank_entities_name_length       CHECK (char_length(name) BETWEEN 2 AND 120),
  CONSTRAINT bank_entities_short_name_length CHECK (short_name IS NULL OR char_length(short_name) BETWEEN 2 AND 40),
  CONSTRAINT bank_entities_code_length       CHECK (code IS NULL OR char_length(code) BETWEEN 2 AND 20),
  CONSTRAINT bank_entities_country_length    CHECK (char_length(country) BETWEEN 2 AND 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_entities_user_name_unique
  ON bank_entities (user_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_bank_entities_user_active
  ON bank_entities (user_id, is_active, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'fn_set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_bank_entities_updated_at ON bank_entities;
    CREATE TRIGGER trg_bank_entities_updated_at
      BEFORE UPDATE ON bank_entities
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RELACIÓN: accounts -> bank_entities
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS bank_entity_id uuid REFERENCES bank_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_bank_entity_id
  ON accounts (bank_entity_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA: app_notifications
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category   text        NOT NULL DEFAULT 'SYSTEM',
  event      text        NOT NULL,
  title      text        NOT NULL,
  message    text,
  href       text,
  context    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz,

  CONSTRAINT app_notifications_category_length CHECK (char_length(category) BETWEEN 2 AND 40),
  CONSTRAINT app_notifications_event_length    CHECK (char_length(event) BETWEEN 2 AND 60),
  CONSTRAINT app_notifications_title_length    CHECK (char_length(title) BETWEEN 2 AND 140)
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
  ON app_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_unread
  ON app_notifications (user_id, is_read, created_at DESC)
  WHERE is_read = false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'fn_set_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_app_notifications_updated_at ON app_notifications;
    CREATE TRIGGER trg_app_notifications_updated_at
      BEFORE UPDATE ON app_notifications
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS + POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE bank_entities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_notifications  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_entities: select own" ON bank_entities;
CREATE POLICY "bank_entities: select own"
  ON bank_entities FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bank_entities: insert own" ON bank_entities;
CREATE POLICY "bank_entities: insert own"
  ON bank_entities FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bank_entities: update own" ON bank_entities;
CREATE POLICY "bank_entities: update own"
  ON bank_entities FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bank_entities: delete own" ON bank_entities;
CREATE POLICY "bank_entities: delete own"
  ON bank_entities FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "app_notifications: select own" ON app_notifications;
CREATE POLICY "app_notifications: select own"
  ON app_notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "app_notifications: insert own" ON app_notifications;
CREATE POLICY "app_notifications: insert own"
  ON app_notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "app_notifications: update own" ON app_notifications;
CREATE POLICY "app_notifications: update own"
  ON app_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "app_notifications: delete own" ON app_notifications;
CREATE POLICY "app_notifications: delete own"
  ON app_notifications FOR DELETE
  USING (user_id = auth.uid());
