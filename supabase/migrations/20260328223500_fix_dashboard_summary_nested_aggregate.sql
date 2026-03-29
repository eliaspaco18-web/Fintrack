-- =============================================================================
-- HOTFIX: fn_dashboard_summary
-- Corrige agregado anidado en assets.by_type:
-- jsonb_agg(jsonb_build_object(... SUM(...), COUNT(...))) no es válido.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_dashboard_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result         jsonb;
  v_current_month  date    := date_trunc('month', CURRENT_DATE)::date;
  v_exchange_rate  numeric := COALESCE(fn_latest_exchange_rate('USD', 'PEN'), 3.7);
BEGIN
  SELECT jsonb_build_object(
    'net_worth_pen', (
      SELECT COALESCE(SUM(
        CASE
          WHEN currency = 'PEN' THEN balance
          ELSE balance * v_exchange_rate
        END
      ), 0)
      FROM accounts
      WHERE user_id = p_user_id
        AND is_active = true
        AND include_in_net_worth = true
    ),

    'current_month', jsonb_build_object(
      'income_pen', COALESCE((
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

    'accounts', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id',          id,
            'name',        name,
            'type',        type,
            'currency',    currency,
            'balance',     balance,
            'balance_pen', CASE
              WHEN currency = 'PEN' THEN balance
              ELSE balance * v_exchange_rate
            END,
            'color',       color,
            'icon',        icon
          )
          ORDER BY
            CASE
              WHEN currency = 'PEN' THEN balance
              ELSE balance * v_exchange_rate
            END DESC
        ),
        '[]'::jsonb
      )
      FROM accounts
      WHERE user_id = p_user_id
        AND is_active = true
    ),

    'cash_flow_6m', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'month',       month,
            'month_label', month_label,
            'income_pen',  income_pen,
            'expense_pen', expense_pen,
            'net_pen',     net_pen
          )
          ORDER BY month ASC
        ),
        '[]'::jsonb
      )
      FROM v_monthly_cash_flow
      WHERE user_id = p_user_id
        AND month >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
    ),

    'top_expense_categories', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'category_id',    category_id,
            'category_name',  category_name,
            'category_color', category_color,
            'category_icon',  category_icon,
            'total_pen',      total_pen,
            'percentage',     percentage
          )
          ORDER BY total_pen DESC
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT *
        FROM v_expense_by_category
        WHERE user_id = p_user_id
        ORDER BY total_pen DESC
        LIMIT 5
      ) top_categories
    ),

    'credits', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id',               id,
            'name',             name,
            'credit_type',      credit_type,
            'currency',         currency,
            'credit_limit',     credit_limit,
            'used_amount',      used_amount,
            'available_amount', available_amount,
            'utilization_pct',  utilization_pct,
            'next_closing_date', next_closing_date
          )
        ),
        '[]'::jsonb
      )
      FROM v_credit_summary
      WHERE user_id = p_user_id
    ),

    'upcoming_installments', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id',                 id,
            'creditor_name',      creditor_name,
            'total_amount',       total_amount,
            'currency',           currency,
            'due_date',           due_date,
            'days_until_due',     days_until_due,
            'urgency',            urgency,
            'installment_number', installment_number,
            'total_installments', total_installments
          )
          ORDER BY due_date ASC
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT *
        FROM v_upcoming_installments
        WHERE user_id = p_user_id
        ORDER BY due_date ASC
        LIMIT 10
      ) installments_limited
    ),

    'receivables', (
      SELECT jsonb_build_object(
        'total_pending_pen', COALESCE(SUM(
          CASE
            WHEN currency = 'PEN' THEN pending_amount
            ELSE pending_amount * v_exchange_rate
          END
        ), 0),
        'count', COUNT(*),
        'items', COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id',             id,
              'debtor_name',    debtor_name,
              'pending_amount', pending_amount,
              'currency',       currency,
              'due_date',       due_date,
              'urgency',        urgency
            )
            ORDER BY due_date ASC NULLS LAST
          ),
          '[]'::jsonb
        )
      )
      FROM v_receivables_summary
      WHERE user_id = p_user_id
    ),

    'payables', (
      SELECT jsonb_build_object(
        'total_pending_pen', COALESCE(SUM(
          CASE
            WHEN currency = 'PEN' THEN pending_amount
            ELSE pending_amount * v_exchange_rate
          END
        ), 0),
        'count', COUNT(*),
        'items', COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id',             id,
              'creditor_name',  creditor_name,
              'pending_amount', pending_amount,
              'currency',       currency,
              'due_date',       due_date,
              'urgency',        urgency
            )
            ORDER BY due_date ASC NULLS LAST
          ),
          '[]'::jsonb
        )
      )
      FROM v_payables_summary
      WHERE user_id = p_user_id
    ),

    'assets', (
      SELECT jsonb_build_object(
        'total_value_pen', COALESCE(SUM(
          CASE
            WHEN currency = 'PEN' THEN current_value
            ELSE current_value * v_exchange_rate
          END
        ), 0),
        'count', COUNT(*),
        'by_type', (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'asset_type', grouped.asset_type,
                'total_pen',  grouped.total_pen,
                'count',      grouped.item_count
              )
              ORDER BY grouped.total_pen DESC
            ),
            '[]'::jsonb
          )
          FROM (
            SELECT
              asset_type,
              SUM(
                CASE
                  WHEN currency = 'PEN' THEN current_value
                  ELSE current_value * v_exchange_rate
                END
              ) AS total_pen,
              COUNT(*) AS item_count
            FROM assets
            WHERE user_id = p_user_id
              AND status = 'ACTIVE'
            GROUP BY asset_type
          ) grouped
        )
      )
      FROM assets
      WHERE user_id = p_user_id
        AND status = 'ACTIVE'
    ),

    'meta', jsonb_build_object(
      'exchange_rate_usd_pen', v_exchange_rate,
      'calculated_at', now(),
      'current_month', to_char(CURRENT_DATE, 'YYYY-MM')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION fn_dashboard_summary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_dashboard_summary TO authenticated;
