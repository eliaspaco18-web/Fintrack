-- =============================================================================
-- MIGRATION 005: system_key en categorías del sistema
-- Añade una columna system_key a categories para identificar semánticamente
-- las categorías del sistema sin depender del nombre visible.
--
-- Reglas:
--   - system_key solo existe en categorías del sistema (is_system = true)
--   - Categorías de usuario siempre tienen system_key = NULL
--   - Los valores son snake_case estables — nunca se renombran
--   - system_key no es un enum en BD: nuevas claves no requieren migración
-- =============================================================================

-- ── 1. COLUMNA ────────────────────────────────────────────────────────────────

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS system_key text;

-- Índice parcial — solo filas con system_key (las del sistema)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_system_key
  ON categories (system_key)
  WHERE system_key IS NOT NULL;

-- Constraint: categorías de usuario no pueden tener system_key
ALTER TABLE categories
  ADD CONSTRAINT categories_system_key_only_system CHECK (
    (is_system = true)  OR
    (is_system = false AND system_key IS NULL)
  );

-- ── 2. ACTUALIZAR SEED DE CATEGORÍAS DEL SISTEMA ─────────────────────────────
-- Solo las categorías que activan módulos derivados necesitan system_key.
-- Las demás pueden tenerlo para completitud, pero no es obligatorio.

UPDATE categories SET system_key = 'income_salary'      WHERE name = 'Sueldo'            AND is_system = true;
UPDATE categories SET system_key = 'income_freelance'   WHERE name = 'Freelance'          AND is_system = true;
UPDATE categories SET system_key = 'income_investment'  WHERE name = 'Inversiones'        AND is_system = true;
UPDATE categories SET system_key = 'income_rental'      WHERE name = 'Alquileres'         AND is_system = true;
UPDATE categories SET system_key = 'income_receivable'  WHERE name = 'Cuenta por cobrar'  AND is_system = true;
UPDATE categories SET system_key = 'income_other'       WHERE name = 'Otros ingresos'     AND is_system = true;

UPDATE categories SET system_key = 'expense_food'       WHERE name = 'Alimentación'       AND is_system = true;
UPDATE categories SET system_key = 'expense_transport'  WHERE name = 'Transporte'         AND is_system = true;
UPDATE categories SET system_key = 'expense_housing'    WHERE name = 'Vivienda'           AND is_system = true;
UPDATE categories SET system_key = 'expense_health'     WHERE name = 'Salud'              AND is_system = true;
UPDATE categories SET system_key = 'expense_education'  WHERE name = 'Educación'          AND is_system = true;
UPDATE categories SET system_key = 'expense_leisure'    WHERE name = 'Entretenimiento'    AND is_system = true;
UPDATE categories SET system_key = 'expense_asset'      WHERE name = 'Activo'             AND is_system = true;
UPDATE categories SET system_key = 'expense_credit'     WHERE name = 'Crédito / Préstamo' AND is_system = true;
UPDATE categories SET system_key = 'expense_payable'    WHERE name = 'Cuenta por pagar'   AND is_system = true;
UPDATE categories SET system_key = 'expense_other'      WHERE name = 'Otros gastos'       AND is_system = true;
