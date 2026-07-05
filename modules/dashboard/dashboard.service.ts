// =============================================================================
// modules/dashboard/dashboard.service.ts
// Agrega datos de todos los módulos en una sola operación.
// Estrategia: una llamada RPC a fn_dashboard_summary() retorna todo el JSONB.
// El servicio TypeScript solo tipifica y enriquece el resultado.
// =============================================================================

import type { SupabaseClient }        from '@supabase/supabase-js'
import type { Database }              from '@/types/database.types'
import { type Result, Errors, ok }    from '@/modules/shared/result.types'
import { DEFAULT_USD_PEN_EXCHANGE_RATE } from '@/lib/constants/currency'
import { resolveLiveUsdPenExchangeRate } from '@/lib/server/exchange-rate'
import type {
  DashboardSummary,
  MonthlyComparison,
  CashFlowPoint,
  DailyFlowPoint,
  ExpenseCategoryItem,
  CreditSummaryItem,
  UpcomingInstallment,
  ReceivablesSummary,
  PayablesSummary,
  AssetsSummary,
  DashboardMeta,
  UrgencyLevel as DashboardUrgency,
}                                     from './dashboard.types'

type DbClient = SupabaseClient<Database>
type DashboardSummaryOptions = {
  includeDailyFlow?: boolean
}

export class DashboardService {
  constructor(private readonly db: DbClient) {}

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  DASHBOARD COMPLETO — una sola llamada RPC                             ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  /**
   * Retorna todos los datos del dashboard en una sola llamada a Postgres.
   * La función fn_dashboard_summary() ejecuta ~8 subqueries en el servidor,
   * evitando 8 round-trips desde el cliente.
   *
   * Uso en Server Component:
   *   const result = await dashboardService.getSummary(userId)
   *   if (!result.ok) { ... }
   *   const { data } = result
   */
  async getSummary(
    userId: string,
    options: DashboardSummaryOptions = {}
  ): Promise<Result<DashboardSummary>> {
    try {
      const includeDailyFlow = options.includeDailyFlow ?? true
      const [{ data, error }, dailyFlowResult] = await Promise.all([
        this.db.rpc('fn_dashboard_summary', {
          p_user_id: userId,
        }),
        includeDailyFlow
          ? this.getDailyFlow(userId, 370)
          : Promise.resolve(ok<DailyFlowPoint[]>([])),
      ])

      if (error) return Errors.database(error.message)
      if (!data)  return Errors.notFound('Dashboard')

      const dailyFlow = dailyFlowResult.ok ? dailyFlowResult.data : []
      return ok(this.mapRpcResult(data as unknown as RawDashboardRpc, dailyFlow))
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  QUERIES MODULARES — para páginas individuales                         ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  /**
   * Solo el flujo mensual — para el gráfico de la página /dashboard sin
   * cargar todo el summary. Útil también para el módulo de reportes.
   */
  async getCashFlow(
    userId: string,
    months = 12
  ): Promise<Result<CashFlowPoint[]>> {
    try {
      const { data, error } = await this.db
        .from('v_monthly_cash_flow')
        .select('month, month_label, income_pen, expense_pen, net_pen')
        .eq('user_id', userId)
        .order('month', { ascending: true })
        .limit(months)

      if (error) return Errors.database(error.message)

      return ok((data ?? []).map(row => ({
        month:       row.month ?? '',
        monthLabel:  row.month_label ?? '',
        incomePen:   Number(row.income_pen),
        expensePen:  Number(row.expense_pen),
        netPen:      Number(row.net_pen),
      })))
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  /**
   * Serie diaria de ingresos/egresos y neto acumulado para gráficas tipo
   * "money flow" (5D / 1M / 3M / 6M / 1Y).
   */
  async getDailyFlow(
    userId: string,
    days = 365
  ): Promise<Result<DailyFlowPoint[]>> {
    try {
      const safeDays = Math.max(7, Math.min(730, Math.trunc(days)))
      const today = new Date()
      const start = new Date(today)
      start.setDate(today.getDate() - (safeDays - 1))

      const startDate = start.toISOString().slice(0, 10)
      const endDate = today.toISOString().slice(0, 10)

      const { data, error } = await this.db
        .from('transactions')
        .select('transaction_date, type, amount_pen')
        .eq('user_id', userId)
        .eq('affects_reports', true)
        .in('type', ['INCOME', 'EXPENSE'])
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true })

      if (error) return Errors.database(error.message)

      const byDate = new Map<string, { incomePen: number; expensePen: number }>()

      for (const row of data ?? []) {
        const date = row.transaction_date
        if (!date) continue

        const current = byDate.get(date) ?? { incomePen: 0, expensePen: 0 }
        const amountPen = Number(row.amount_pen ?? 0)
        if (row.type === 'INCOME') current.incomePen += amountPen
        if (row.type === 'EXPENSE') current.expensePen += amountPen
        byDate.set(date, current)
      }

      const cursor = new Date(start)
      let running = 0
      const series: DailyFlowPoint[] = []

      while (cursor <= today) {
        const date = cursor.toISOString().slice(0, 10)
        const aggregate = byDate.get(date) ?? { incomePen: 0, expensePen: 0 }
        const netPen = aggregate.incomePen - aggregate.expensePen
        running += netPen

        series.push({
          date,
          label: new Date(`${date}T12:00:00`).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: 'short',
          }).replace('.', ''),
          incomePen: aggregate.incomePen,
          expensePen: aggregate.expensePen,
          netPen,
          balancePen: running,
        })

        cursor.setDate(cursor.getDate() + 1)
      }

      return ok(series)
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  /**
   * Comparativa mes actual vs mes anterior.
   * Alimenta los KPI cards con su variación porcentual.
   */
  async getMonthComparison(userId: string): Promise<Result<MonthlyComparison>> {
    try {
      const { data, error } = await this.db
        .from('v_monthly_summary')
        .select('month, total_income_pen, total_expense_pen, net_pen')
        .eq('user_id', userId)
        .order('month', { ascending: false })
        .limit(2)

      if (error) return Errors.database(error.message)

      const rows = data ?? []
      const curr = rows[0]
      const prev = rows[1]

      const pctChange = (current: number, previous: number): number | null => {
        if (!previous) return null
        return Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100
      }

      return ok({
        currentMonth: {
          label:      curr?.month ?? '',
          incomePen:  Number(curr?.total_income_pen  ?? 0),
          expensePen: Number(curr?.total_expense_pen ?? 0),
          netPen:     Number(curr?.net_pen           ?? 0),
        },
        previousMonth: {
          label:      prev?.month ?? '',
          incomePen:  Number(prev?.total_income_pen  ?? 0),
          expensePen: Number(prev?.total_expense_pen ?? 0),
          netPen:     Number(prev?.net_pen           ?? 0),
        },
        changes: {
          incomePctChange:  pctChange(
            Number(curr?.total_income_pen  ?? 0),
            Number(prev?.total_income_pen  ?? 0)
          ),
          expensePctChange: pctChange(
            Number(curr?.total_expense_pen ?? 0),
            Number(prev?.total_expense_pen ?? 0)
          ),
          netPctChange: pctChange(
            Number(curr?.net_pen           ?? 0),
            Number(prev?.net_pen           ?? 0)
          ),
        },
      })
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  /**
   * Patrimonio neto consolidado en PEN y USD.
   * La conversión a USD usa el tipo de cambio más reciente.
   */
  async getNetWorth(userId: string): Promise<Result<{
    netWorthPen: number
    netWorthUsd: number
    exchangeRate: number
  }>> {
    try {
      const exchangeSnapshot = await resolveLiveUsdPenExchangeRate()
      const exchangeRate = exchangeSnapshot.rate ?? DEFAULT_USD_PEN_EXCHANGE_RATE

      const { data: nw } = await this.db
        .from('v_net_worth')
        .select('net_worth_pen')
        .eq('user_id', userId)
        .maybeSingle()

      const netWorthPen = Number(nw?.net_worth_pen ?? 0)

      return ok({
        netWorthPen,
        netWorthUsd:  Math.round((netWorthPen / exchangeRate) * 100) / 100,
        exchangeRate: Number(exchangeRate),
      })
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  /**
   * Egresos por categoría del mes actual.
   * Para el gráfico de dona de la página de análisis.
   */
  async getExpensesByCategory(userId: string): Promise<Result<ExpenseCategoryItem[]>> {
    try {
      const { data, error } = await this.db
        .from('v_expense_by_category')
        .select('*')
        .eq('user_id', userId)
        .order('total_pen', { ascending: false })

      if (error) return Errors.database(error.message)

      return ok((data ?? []).map(row => ({
        categoryId:    row.category_id,
        categoryName:  row.category_name ?? 'Sin categoría',
        categoryIcon:  row.category_icon ?? 'tag',
        categoryColor: row.category_color ?? '#6b7280',
        totalPen:      Number(row.total_pen),
        count:         Number(row.transaction_count),
        percentage:    Number(row.percentage ?? 0),
      })))
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  CONVERSIÓN MULTIMONEDA                                                 ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  /**
   * Convierte un monto de una moneda a otra usando el tipo de cambio más reciente.
   * PEN → USD: divide por exchange_rate (USD/PEN)
   * USD → PEN: multiplica por exchange_rate
   */
  static convertCurrency(
    amount:       number,
    fromCurrency: 'PEN' | 'USD',
    toCurrency:   'PEN' | 'USD',
    exchangeRate: number  // siempre expresado como "1 USD = N PEN"
  ): number {
    if (fromCurrency === toCurrency) return amount

    const result = fromCurrency === 'USD'
      ? amount * exchangeRate          // USD → PEN
      : amount / exchangeRate          // PEN → USD

    return Math.round(result * 100) / 100
  }

  /**
   * Consolida una lista de montos multimoneda en una sola moneda objetivo.
   */
  static consolidate(
    items:          Array<{ amount: number; currency: 'PEN' | 'USD' }>,
    targetCurrency: 'PEN' | 'USD',
    exchangeRate:   number
  ): number {
    return items.reduce((sum, item) => {
      return sum + DashboardService.convertCurrency(
        item.amount,
        item.currency,
        targetCurrency,
        exchangeRate
      )
    }, 0)
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  MAPEO PRIVADO RPC → tipos del servicio                                ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  private mapRpcResult(raw: RawDashboardRpc, dailyFlow: DailyFlowPoint[] = []): DashboardSummary {
    const rate = raw.meta?.exchange_rate_usd_pen ?? DEFAULT_USD_PEN_EXCHANGE_RATE
    const toUrgency = (value: string | null | undefined): DashboardUrgency | null => {
      if (value === 'OVERDUE' || value === 'DUE_SOON' || value === 'UPCOMING') {
        return value
      }
      return null
    }

    return {
      netWorth: {
        pen: raw.net_worth_pen ?? 0,
        usd: Math.round(((raw.net_worth_pen ?? 0) / rate) * 100) / 100,
      },

      currentMonth: {
        incomePen:  raw.current_month?.income_pen  ?? 0,
        expensePen: raw.current_month?.expense_pen ?? 0,
        netPen:    (raw.current_month?.income_pen  ?? 0) - (raw.current_month?.expense_pen ?? 0),
        incomeUsd:  DashboardService.convertCurrency(raw.current_month?.income_pen  ?? 0, 'PEN', 'USD', rate),
        expenseUsd: DashboardService.convertCurrency(raw.current_month?.expense_pen ?? 0, 'PEN', 'USD', rate),
      },

      accounts: (raw.accounts ?? []).map(a => ({
        id:         a.id,
        name:       a.name,
        type:       a.type,
        currency:   a.currency,
        balance:    a.balance,
        balancePen: a.balance_pen,
        balanceUsd: DashboardService.convertCurrency(a.balance_pen, 'PEN', 'USD', rate),
        color:      a.color,
        icon:       a.icon,
      })),

      cashFlow6m: (raw.cash_flow_6m ?? []).map(p => ({
        month:       p.month,
        monthLabel:  p.month_label,
        incomePen:   p.income_pen,
        expensePen:  p.expense_pen,
        netPen:      p.net_pen,
      })),
      dailyFlow,

      topExpenseCategories: (raw.top_expense_categories ?? []).map(c => ({
        categoryId:    c.category_id,
        categoryName:  c.category_name ?? 'Sin categoría',
        categoryIcon:  c.category_icon ?? 'tag',
        categoryColor: c.category_color ?? '#6b7280',
        totalPen:      c.total_pen,
        count:         c.transaction_count ?? c.count ?? 0,
        percentage:    c.percentage,
      })),

      credits: (raw.credits ?? []).map(c => ({
        id:             c.id,
        name:           c.name,
        creditType:     c.credit_type,
        currency:       c.currency,
        creditLimit:    c.credit_limit,
        usedAmount:     c.used_amount,
        availableAmount: c.available_amount,
        utilizationPct: c.utilization_pct,
        nextClosingDate: c.next_closing_date,
      })),

      upcomingInstallments: (raw.upcoming_installments ?? []).map(i => ({
        id:                 i.id,
        creditorName:       i.creditor_name,
        totalAmount:        i.total_amount,
        currency:           i.currency,
        dueDate:            i.due_date,
        daysUntilDue:       i.days_until_due,
        urgency:            toUrgency(i.urgency) ?? 'UPCOMING',
        installmentNumber:  i.installment_number,
        totalInstallments:  i.total_installments,
      })),

      receivables: {
        totalPendingPen: raw.receivables?.total_pending_pen ?? 0,
        totalPendingUsd: DashboardService.convertCurrency(
          raw.receivables?.total_pending_pen ?? 0, 'PEN', 'USD', rate
        ),
        count: raw.receivables?.count ?? 0,
        items: (raw.receivables?.items ?? []).map(r => ({
          id:            r.id,
          debtorName:    r.debtor_name,
          pendingAmount: r.pending_amount,
          currency:      r.currency,
          dueDate:       r.due_date,
          urgency:       toUrgency(r.urgency),
        })),
      },

      payables: {
        totalPendingPen: raw.payables?.total_pending_pen ?? 0,
        totalPendingUsd: DashboardService.convertCurrency(
          raw.payables?.total_pending_pen ?? 0, 'PEN', 'USD', rate
        ),
        count: raw.payables?.count ?? 0,
        items: (raw.payables?.items ?? []).map(p => ({
          id:            p.id,
          creditorName:  p.creditor_name,
          pendingAmount: p.pending_amount,
          currency:      p.currency,
          dueDate:       p.due_date,
          urgency:       toUrgency(p.urgency),
        })),
      },

      assets: {
        totalValuePen: raw.assets?.total_value_pen ?? 0,
        totalValueUsd: DashboardService.convertCurrency(
          raw.assets?.total_value_pen ?? 0, 'PEN', 'USD', rate
        ),
        count:  raw.assets?.count  ?? 0,
        byType: (raw.assets?.by_type ?? []).map((assetType) => ({
          assetType: assetType.asset_type,
          totalPen:  assetType.total_pen,
          count:     assetType.count,
        })),
      },

      meta: {
        exchangeRateUsdPen: rate,
        calculatedAt:       raw.meta?.calculated_at ?? new Date().toISOString(),
        currentMonth:       raw.meta?.current_month ?? '',
      },
    }
  }
}

// ─── SHAPE RAW DEL RPC (interno) ─────────────────────────────────────────────

interface RawDashboardRpc {
  net_worth_pen:           number
  current_month:           { income_pen: number; expense_pen: number }
  accounts:                Array<{ id: string; name: string; type: string; currency: string; balance: number; balance_pen: number; color: string; icon: string }>
  cash_flow_6m:            Array<{ month: string; month_label: string; income_pen: number; expense_pen: number; net_pen: number }>
  top_expense_categories:  Array<{ category_id: string; category_name: string; category_icon: string; category_color: string; total_pen: number; percentage: number; transaction_count?: number; count?: number }>
  credits:                 Array<{ id: string; name: string; credit_type: string; currency: string; credit_limit: number; used_amount: number; available_amount: number; utilization_pct: number; next_closing_date: string | null }>
  upcoming_installments:   Array<{ id: string; creditor_name: string; total_amount: number; currency: string; due_date: string; days_until_due: number; urgency: string; installment_number: number; total_installments: number }>
  receivables:             { total_pending_pen: number; count: number; items: Array<{ id: string; debtor_name: string; pending_amount: number; currency: string; due_date: string | null; urgency: string | null }> }
  payables:                { total_pending_pen: number; count: number; items: Array<{ id: string; creditor_name: string; pending_amount: number; currency: string; due_date: string | null; urgency: string | null }> }
  assets:                  { total_value_pen: number; count: number; by_type: Array<{ asset_type: string; total_pen: number; count: number }> }
  meta:                    { exchange_rate_usd_pen: number; calculated_at: string; current_month: string }
}
