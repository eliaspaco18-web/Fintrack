-- =============================================================================
-- MIGRATION: remove BOTH from category_scope
-- Alinea el schema con PRD v3, donde las categorías solo pueden ser
-- INCOME o EXPENSE.
--
-- Estrategia de backfill:
-- 1. Si la categoría del sistema tiene system_key semántico, usarlo.
-- 2. Si la categoría fue usada solo en ingresos, reclasificar a INCOME.
-- 3. Si la categoría fue usada solo en egresos, reclasificar a EXPENSE.
-- 4. Si es ambigua o nunca se usó, dejarla como EXPENSE por compatibilidad
--    con el default histórico del producto.
-- =============================================================================

WITH category_usage AS (
  SELECT
    c.id,
    bool_or(t.type = 'INCOME') AS used_in_income,
    bool_or(t.type = 'EXPENSE') AS used_in_expense
  FROM categories c
  LEFT JOIN transactions t
    ON t.category_id = c.id
  GROUP BY c.id
)
UPDATE categories c
SET scope = CASE
  WHEN c.scope <> 'BOTH' THEN c.scope
  WHEN c.system_key LIKE 'income_%' THEN 'INCOME'::category_scope
  WHEN c.system_key LIKE 'expense_%' THEN 'EXPENSE'::category_scope
  WHEN u.used_in_income IS TRUE AND coalesce(u.used_in_expense, false) IS FALSE THEN 'INCOME'::category_scope
  WHEN u.used_in_expense IS TRUE AND coalesce(u.used_in_income, false) IS FALSE THEN 'EXPENSE'::category_scope
  ELSE 'EXPENSE'::category_scope
END
FROM category_usage u
WHERE c.id = u.id
  AND c.scope = 'BOTH';

ALTER TABLE categories
  ALTER COLUMN scope DROP DEFAULT;

ALTER TYPE category_scope RENAME TO category_scope_old;

CREATE TYPE category_scope AS ENUM ('INCOME', 'EXPENSE');

ALTER TABLE categories
  ALTER COLUMN scope TYPE category_scope
  USING scope::text::category_scope;

ALTER TABLE categories
  ALTER COLUMN scope SET DEFAULT 'EXPENSE';

DROP TYPE category_scope_old;
