-- =============================================================================
-- MIGRATION 004: VISTAS Y FUNCIONES PARA DASHBOARD
-- Queries optimizadas para el DashboardService.
-- Todas las vistas usan security_invoker = true para heredar RLS del usuario.
-- =============================================================================

-- =============================================================================
-- VISTA: v_account_balances
-- Saldos de todas las cuentas del usuario con equivalente en PEN.
-- Usada por el widget de patrimonio neto del dashboard.
-- =============================================================================

CREATE OR REPLACE VIEW v_account_balances WITH (security_invoker = true) AS
SELECT
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.currency,
  a.balance,
  a.color,
  a.icon,
  a.institution,
  a.include_in_net_worth,
  a.is_active,
  CASE
    WHEN a.currency = 'PEN' THEN a.balance
    ELSE a.balance * COALESCE(fn_latest_exchange_rate(a.currency, 'PEN'), 1)
  END AS balance_pen
FROM accounts a
WHERE a.is_active = true;

-- =============================================================================
-- VISTA: v_monthly_cash_flow
-- Flujo mensual de ingresos y egresos por los últimos 12 meses.
-- Excluye transferencias (affects_reports = true filtra automáticamente).
-- Usada por el gráfico de barras del dashboard.
-- =============================================================================

CREATE OR REPLACE VIEW v_monthly_cash_flow WITH (security_invoker = true) AS
SELECT
  user_id,
  date_trunc('month', transaction_date)::date                            AS month,
  to_char(date_trunc('month', transaction_date), 'Mon YYYY') AS month_label,
  COALESCE(SUM(amount_pen) FILTER (WHERE type = 'INCOME'),  0)           AS income_pen,
  COALESCE(SUM(amount_pen) FILTER (WHERE type = 'EXPENSE'), 0)           AS expense_pen,
  COALESCE(SUM(amount_pen) FILTER (WHERE type = 'INCOME'),  0)
    - COALESCE(SUM(amount_pen) FILTER (WHERE type = 'EXPENSE'), 0)       AS net_pen,
  COUNT(*) FILTER (WHERE type = 'INCOME')                                AS income_count,
  COUNT(*) FILTER (WHERE type = 'EXPENSE')                               AS expense_count
FROM transactions
WHERE affects_reports = true
  AND transaction_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
GROUP BY user_id, date_trunc('month', transaction_date)
ORDER BY month DESC;

-- =============================================================================
-- VISTA: v_expense_by_category
-- Egresos del mes actual agrupados por categoría.
-- Usada por el gráfico de dona del dashboard.
-- =============================================================================

CREATE OR REPLACE VIEW v_expense_by_category WITH (security_invoker = true) AS
SELECT
  t.user_id,
  t.category_id,
  c.name                                  AS category_name,
  c.icon                                  AS category_icon,
  c.color                                 AS category_color,
  SUM(t.amount_pen)                       AS total_pen,
  COUNT(*)                                AS transaction_count,
  ROUND(
    SUM(t.amount_pen) * 100.0
    / NULLIF(SUM(SUM(t.amount_pen)) OVER (PARTITION BY t.user_id), 0),
    2
  )                                       AS percentage
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.type = 'EXPENSE'
  AND t.affects_reports = true
  AND date_trunc('month', t.transaction_date) = date_trunc('month', CURRENT_DATE)
GROUP BY t.user_id, t.category_id, c.name, c.icon, c.color;

-- =============================================================================
-- VISTA: v_credit_summary
-- Resumen de créditos activos con uso y disponibilidad.
-- =============================================================================

CREATE OR REPLACE VIEW v_credit_summary WITH (security_invoker = true) AS
SELECT
  c.user_id,
  c.id,
  c.name,
  c.credit_type,
  c.currency,
  c.credit_limit,
  c.used_amount,
  c.available_amount,
  c.interest_rate,
  c.closing_day,
  c.payment_day,
  ROUND(c.used_amount * 100.0 / NULLIF(c.credit_limit, 0), 2) AS utilization_pct,
  -- Próxima fecha de corte (estimación simple)
  CASE
    WHEN c.closing_day IS NOT NULL THEN
      CASE
        WHEN EXTRACT(DAY FROM CURRENT_DATE) < c.closing_day
        THEN make_date(
          EXTRACT(YEAR  FROM CURRENT_DATE)::int,
          EXTRACT(MONTH FROM CURRENT_DATE)::int,
          c.closing_day
        )
        ELSE make_date(
          EXTRACT(YEAR  FROM CURRENT_DATE + INTERVAL '1 month')::int,
          EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '1 month')::int,
          c.closing_day
        )
      END
  END AS next_closing_date
FROM credits c
WHERE c.status = 'ACTIVE';

-- =============================================================================
-- VISTA: v_upcoming_installments
-- Cuotas de préstamos con vencimiento en los próximos 30 días.
-- Usada por el widget de alertas del dashboard.
-- =============================================================================

CREATE OR REPLACE VIEW v_upcoming_installments WITH (security_invoker = true) AS
SELECT
  i.id,
  i.loan_id,
  i.installment_number,
  i.total_amount,
  i.due_date,
  i.status,
  l.user_id,
  l.creditor_name,
  l.currency,
  l.total_installments,
  l.paid_installments,
  (i.due_date - CURRENT_DATE)           AS days_until_due,
  CASE
    WHEN i.due_date < CURRENT_DATE       THEN 'OVERDUE'
    WHEN i.due_date <= CURRENT_DATE + 7  THEN 'DUE_SOON'
    ELSE                                      'UPCOMING'
  END                                   AS urgency
FROM installments i
JOIN loans l ON l.id = i.loan_id
WHERE i.status IN ('PENDING', 'PARTIAL')
  AND i.due_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY i.due_date ASC;

-- =============================================================================
-- VISTA: v_receivables_summary
-- Cuentas por cobrar pendientes con días de vencimiento.
-- =============================================================================

CREATE OR REPLACE VIEW v_receivables_summary WITH (security_invoker = true) AS
SELECT
  ar.id,
  ar.user_id,
  ar.debtor_name,
  ar.amount,
  ar.collected_amount,
  ar.amount - ar.collected_amount                 AS pending_amount,
  ar.currency,
  ar.due_date,
  ar.status,
  ar.concept,
  CASE
    WHEN ar.due_date IS NULL                       THEN NULL
    WHEN ar.due_date < CURRENT_DATE               THEN 'OVERDUE'
    WHEN ar.due_date <= CURRENT_DATE + 7          THEN 'DUE_SOON'
    ELSE                                               'UPCOMING'
  END                                             AS urgency,
  ar.due_date - CURRENT_DATE                      AS days_until_due
FROM accounts_receivable ar
WHERE ar.status IN ('PENDING', 'PARTIAL')
ORDER BY ar.due_date ASC NULLS LAST;

-- =============================================================================
-- VISTA: v_payables_summary
-- Cuentas por pagar pendientes con días de vencimiento.
-- =============================================================================

CREATE OR REPLACE VIEW v_payables_summary WITH (security_invoker = true) AS
SELECT
  ap.id,
  ap.user_id,
  ap.creditor_name,
  ap.amount,
  ap.paid_amount,
  ap.amount - ap.paid_amount                      AS pending_amount,
  ap.currency,
  ap.due_date,
  ap.status,
  ap.concept,
  CASE
    WHEN ap.due_date IS NULL                       THEN NULL
    WHEN ap.due_date < CURRENT_DATE               THEN 'OVERDUE'
    WHEN ap.due_date <= CURRENT_DATE + 7          THEN 'DUE_SOON'
    ELSE                                               'UPCOMING'
  END                                             AS urgency,
  ap.due_date - CURRENT_DATE                      AS days_until_due
FROM accounts_payable ap
WHERE ap.status IN ('PENDING', 'PARTIAL')
ORDER BY ap.due_date ASC NULLS LAST;

-- =============================================================================
-- FUNCIÓN: fn_dashboard_summary
-- Agrega todos los KPIs del dashboard en una sola llamada RPC.
-- Retorna JSONB para evitar múltiples round-trips desde el cliente.
-- Se ejecuta en ~1 query en lugar de 7-8 queries separadas.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_dashboard_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result        jsonb;
  v_current_month date  := date_trunc('month', CURRENT_DATE)::date;
  v_exchange_rate numeric := COALESCE(fn_latest_exchange_rate('USD', 'PEN'), 3.7);
BEGIN
  SELECT jsonb_build_object(

    -- ── Patrimonio neto ───────────────────────────────────────────────────────
    'net_worth_pen', (
      SELECT COALESCE(SUM(
        CASE WHEN currency = 'PEN' THEN balance
             ELSE balance * v_exchange_rate
        END
      ), 0)
      FROM accounts
      WHERE user_id = p_user_id
        AND is_active = true
        AND include_in_net_worth = true
    ),

    -- ── Mes actual ────────────────────────────────────────────────────────────
    'current_month', jsonb_build_object(
      'income_pen',  COALESCE((
        SELECT SUM(amount_pen)
        FROM transactions
        WHERE user_id = p_user_id
          AND type = 'INCOME'
          AND affects_reports = true
          AND date_trunc('month', transaction_date) = v_current_month
      ), 0),
      'expense_pen', COALESCE((
        SELECT SUM(amount_pen)
        FROM transactions
        WHERE user_id = p_user_id
          AND type = 'EXPENSE'
          AND affects_reports = true
          AND date_trunc('month', transaction_date) = v_current_month
      ), 0)
    ),

    -- ── Cuentas activas ───────────────────────────────────────────────────────
'accounts', (
  SELECT jsonb_agg(jsonb_build_object(
    'id',          id,
    'name',        name,
    'type',        type,
    'currency',    currency,
    'balance',     balance,
    'balance_pen', CASE WHEN currency = 'PEN' THEN balance
                        ELSE balance * v_exchange_rate END,
    'color',       color,
    'icon',        icon
  ) ORDER BY
    CASE WHEN currency = 'PEN' THEN balance
         ELSE balance * v_exchange_rate END DESC
  )
  FROM accounts
  WHERE user_id = p_user_id AND is_active = true
),

    -- ── Flujo de los últimos 6 meses ──────────────────────────────────────────
    'cash_flow_6m', (
      SELECT jsonb_agg(jsonb_build_object(
        'month',       month,
        'month_label', month_label,
        'income_pen',  income_pen,
        'expense_pen', expense_pen,
        'net_pen',     net_pen
      ) ORDER BY month ASC)
      FROM v_monthly_cash_flow
      WHERE user_id = p_user_id
        AND month >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
    ),

    -- ── Top categorías de egreso del mes ──────────────────────────────────────
    'top_expense_categories', (
      SELECT jsonb_agg(jsonb_build_object(
        'category_id',    category_id,
        'category_name',  category_name,
        'category_color', category_color,
        'category_icon',  category_icon,
        'total_pen',      total_pen,
        'percentage',     percentage
      ) ORDER BY total_pen DESC)
      FROM v_expense_by_category
      WHERE user_id = p_user_id
      LIMIT 5
    ),

    -- ── Créditos activos ──────────────────────────────────────────────────────
    'credits', (
      SELECT jsonb_agg(jsonb_build_object(
        'id',              id,
        'name',            name,
        'credit_type',     credit_type,
        'currency',        currency,
        'credit_limit',    credit_limit,
        'used_amount',     used_amount,
        'available_amount', available_amount,
        'utilization_pct', utilization_pct,
        'next_closing_date', next_closing_date
      ))
      FROM v_credit_summary
      WHERE user_id = p_user_id
    ),

    -- ── Cuotas próximas (30 días) ─────────────────────────────────────────────
    'upcoming_installments', (
      SELECT jsonb_agg(jsonb_build_object(
        'id',               id,
        'creditor_name',    creditor_name,
        'total_amount',     total_amount,
        'currency',         currency,
        'due_date',         due_date,
        'days_until_due',   days_until_due,
        'urgency',          urgency,
        'installment_number', installment_number,
        'total_installments', total_installments
      ) ORDER BY due_date ASC)
      FROM v_upcoming_installments
      WHERE user_id = p_user_id
      LIMIT 10
    ),

    -- ── Cuentas por cobrar pendientes ─────────────────────────────────────────
    'receivables', (
      SELECT jsonb_build_object(
        'total_pending_pen', COALESCE(SUM(
          CASE WHEN currency = 'PEN' THEN pending_amount
               ELSE pending_amount * v_exchange_rate END
        ), 0),
        'count', COUNT(*),
        'items', jsonb_agg(jsonb_build_object(
          'id',             id,
          'debtor_name',    debtor_name,
          'pending_amount', pending_amount,
          'currency',       currency,
          'due_date',       due_date,
          'urgency',        urgency
        ) ORDER BY due_date ASC NULLS LAST)
      )
      FROM v_receivables_summary
      WHERE user_id = p_user_id
    ),

    -- ── Cuentas por pagar pendientes ──────────────────────────────────────────
    'payables', (
      SELECT jsonb_build_object(
        'total_pending_pen', COALESCE(SUM(
          CASE WHEN currency = 'PEN' THEN pending_amount
               ELSE pending_amount * v_exchange_rate END
        ), 0),
        'count', COUNT(*),
        'items', jsonb_agg(jsonb_build_object(
          'id',             id,
          'creditor_name',  creditor_name,
          'pending_amount', pending_amount,
          'currency',       currency,
          'due_date',       due_date,
          'urgency',        urgency
        ) ORDER BY due_date ASC NULLS LAST)
      )
      FROM v_payables_summary
      WHERE user_id = p_user_id
    ),

    -- ── Activos ───────────────────────────────────────────────────────────────
    'assets', (
      SELECT jsonb_build_object(
        'total_value_pen', COALESCE(SUM(
          CASE WHEN currency = 'PEN' THEN current_value
               ELSE current_value * v_exchange_rate END
        ), 0),
        'count', COUNT(*),
        'by_type', (
          SELECT jsonb_agg(jsonb_build_object(
            'asset_type',    asset_type,
            'total_pen',     SUM(CASE WHEN currency = 'PEN' THEN current_value
                                      ELSE current_value * v_exchange_rate END),
            'count',         COUNT(*)
          ))
          FROM assets
          WHERE user_id = p_user_id AND status = 'ACTIVE'
          GROUP BY asset_type
        )
      )
      FROM assets
      WHERE user_id = p_user_id AND status = 'ACTIVE'
    ),

    -- ── Meta: tipo de cambio y fecha del cálculo ──────────────────────────────
    'meta', jsonb_build_object(
      'exchange_rate_usd_pen', v_exchange_rate,
      'calculated_at',         now(),
      'current_month',         to_char(CURRENT_DATE, 'Mon YYYY')
    )

  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Solo usuarios autenticados
REVOKE ALL ON FUNCTION fn_dashboard_summary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_dashboard_summary TO authenticated;

-- =============================================================================
-- ÍNDICES ADICIONALES para soportar las vistas de dashboard
-- =============================================================================

-- Flujo mensual — índice parcial compatible
CREATE INDEX IF NOT EXISTS idx_tx_user_date_reportable
  ON transactions (user_id, transaction_date)
  WHERE affects_reports = true;

-- Activos por usuario y estado (para el sum del dashboard)
CREATE INDEX IF NOT EXISTS idx_assets_user_status_value
  ON assets (user_id, status, current_value, currency);

-- Cuotas próximas — filtra por due_date + status frecuentemente
CREATE INDEX IF NOT EXISTS idx_installments_upcoming
  ON installments (due_date, status)
  WHERE status IN ('PENDING', 'PARTIAL') AND due_date IS NOT NULL;

-- Receivables/Payables por usuario y estado (muy frecuente en dashboard)
CREATE INDEX IF NOT EXISTS idx_ar_user_pending_due
  ON accounts_receivable (user_id, due_date)
  WHERE status IN ('PENDING', 'PARTIAL');

CREATE INDEX IF NOT EXISTS idx_ap_user_pending_due
  ON accounts_payable (user_id, due_date)
  WHERE status IN ('PENDING', 'PARTIAL');
