-- =============================================================================
-- MIGRATION: Add notification_prefs column to profiles
-- Guarda las preferencias de notificación por email como JSONB
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
    "overdueInstallments": true,
    "overdueReceivables":  true,
    "overduePayables":     true,
    "unusualActivity":     true,
    "budgetAlerts":        false,
    "weeklySummary":       false,
    "newTransaction":      false
  }'::jsonb;
