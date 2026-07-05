import { createClient } from '@/lib/supabase.server'
import {
  apiError,
  apiOk,
  apiUnauthorized,
  fromResult,
  getSessionUserId,
} from '@/lib/api/response'
import { buildBudgetPeriodMetrics, monthRange, type BudgetPeriodMetricTransaction } from '@/lib/budgets/budget-periods'
import { isCriticalDashboardUrgency, sortDashboardAlerts } from '@/lib/dashboard/alerts'
import type { DashboardAlertItem, DashboardAlertsResponse } from '@/lib/dashboard/types'
import { measureServerOperation } from '@/lib/server/observability'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import type { BudgetPeriod, CurrencyCode } from '@/types/database.types'

type BudgetPeriodAlertRow = {
  id: string
  legacy_budget_id: string | null
  period_start: string
  period_end: string
  amount: number
  status: string
  budget: {
    id: string
    name: string
    currency: CurrencyCode
    period_type: BudgetPeriod
    is_active: boolean
  } | Array<{
    id: string
    name: string
    currency: CurrencyCode
    period_type: BudgetPeriod
    is_active: boolean
  }> | null
}

type BudgetAlertBudget = NonNullable<Exclude<BudgetPeriodAlertRow['budget'], unknown[]>>

type NormalizedBudgetPeriodAlertRow = Omit<BudgetPeriodAlertRow, 'budget'> & {
  budget: BudgetAlertBudget
}

function pickSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeCurrency(currency: string): 'PEN' | 'USD' {
  return currency === 'USD' ? 'USD' : 'PEN'
}

function toPenAmount(amount: number, currency: string, exchangeRate: number): number {
  return normalizeCurrency(currency) === 'USD' ? amount * exchangeRate : amount
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

export async function GET() {
  return measureServerOperation('api.dashboard.alerts', async () => {
    const supabase = createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) return apiUnauthorized()

    const service = new DashboardService(supabase)
    const summaryResult = await service.getSummary(userId, { includeDailyFlow: false })
    if (!summaryResult.ok) return fromResult(summaryResult)

    const summary = summaryResult.data
    const exchangeRate = summary.meta.exchangeRateUsdPen
    const alerts: DashboardAlertItem[] = []

    for (const installment of summary.upcomingInstallments) {
      if (!isCriticalDashboardUrgency(installment.urgency)) continue

      const currency = normalizeCurrency(installment.currency)
      const amount = Number(installment.totalAmount ?? 0)

      alerts.push({
        id: `installment-${installment.id}`,
        type: 'installment',
        label: `Cuota ${installment.installmentNumber}/${installment.totalInstallments} - ${installment.creditorName}`,
        amount,
        amountPen: roundMoney(toPenAmount(amount, currency, exchangeRate)),
        currency,
        dueDate: installment.dueDate,
        urgency: installment.urgency,
        href: '/credits',
      })
    }

    for (const receivable of summary.receivables.items) {
      if (!isCriticalDashboardUrgency(receivable.urgency)) continue

      const currency = normalizeCurrency(receivable.currency)
      const amount = Number(receivable.pendingAmount ?? 0)

      alerts.push({
        id: `receivable-${receivable.id}`,
        type: 'receivable',
        label: receivable.debtorName,
        amount,
        amountPen: roundMoney(toPenAmount(amount, currency, exchangeRate)),
        currency,
        dueDate: receivable.dueDate,
        urgency: receivable.urgency,
        href: '/receivables',
      })
    }

    for (const payable of summary.payables.items) {
      if (!isCriticalDashboardUrgency(payable.urgency)) continue

      const currency = normalizeCurrency(payable.currency)
      const amount = Number(payable.pendingAmount ?? 0)

      alerts.push({
        id: `payable-${payable.id}`,
        type: 'payable',
        label: payable.creditorName,
        amount,
        amountPen: roundMoney(toPenAmount(amount, currency, exchangeRate)),
        currency,
        dueDate: payable.dueDate,
        urgency: payable.urgency,
        href: '/payables',
      })
    }

    const range = monthRange(currentMonthKey())
    if (!range) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'No se pudo resolver el periodo actual',
      })
    }

    const { data: periodsData, error: periodsError } = await supabase
      .from('budget_periods')
      .select(`
        id,
        legacy_budget_id,
        period_start,
        period_end,
        amount,
        status,
        budget:budget_series!inner(id,name,currency,period_type,is_active,user_id)
      `)
      .lte('period_start', range.end)
      .gte('period_end', range.start)
      .in('status', ['ACTIVE', 'PLANNED'])
      .eq('budget.user_id', userId)
      .eq('budget.is_active', true)

    if (periodsError) {
      return apiError({ code: 'DATABASE_ERROR', message: periodsError.message })
    }

    const periods: NormalizedBudgetPeriodAlertRow[] = ((periodsData ?? []) as BudgetPeriodAlertRow[])
      .map((period) => ({ ...period, budget: pickSingle(period.budget) }))
      .filter((period): period is NormalizedBudgetPeriodAlertRow => Boolean(period.budget))

    if (periods.length > 0) {
      const periodIds = periods.map((period) => period.id)
      const legacyBudgetIds = periods
        .map((period) => period.legacy_budget_id)
        .filter((id): id is string => Boolean(id))

      let transactionsQuery = supabase
        .from('transactions')
        .select('amount, currency, exchange_rate, budget_id, budget_period_id, transaction_date')
        .eq('user_id', userId)
        .eq('type', 'EXPENSE')
        .gte('transaction_date', range.start)
        .lte('transaction_date', range.end)

      const orParts = [`budget_period_id.in.(${periodIds.join(',')})`]
      if (legacyBudgetIds.length > 0) {
        orParts.push(`budget_id.in.(${legacyBudgetIds.join(',')})`)
      }
      transactionsQuery = transactionsQuery.or(orParts.join(','))

      const { data: transactionsData, error: transactionsError } = await transactionsQuery
      if (transactionsError) {
        return apiError({ code: 'DATABASE_ERROR', message: transactionsError.message })
      }

      const transactions = (transactionsData ?? []) as BudgetPeriodMetricTransaction[]

      for (const period of periods) {
        const metrics = buildBudgetPeriodMetrics(
          { currency: period.budget.currency },
          period,
          transactions,
        )

        if (!metrics.over_limit) continue

        const overflow = Math.max(0, metrics.spent_amount - Number(period.amount ?? 0))
        const currency = normalizeCurrency(period.budget.currency)

        alerts.push({
          id: `budget-${period.id}`,
          type: 'budget_exceeded',
          label: `${period.budget.name} excedió ${metrics.progress_percent.toFixed(0)}%`,
          amount: roundMoney(overflow),
          amountPen: roundMoney(toPenAmount(overflow, currency, exchangeRate)),
          currency,
          dueDate: period.period_end,
          urgency: 'OVERDUE',
          href: '/budgets',
        })
      }
    }

    const sortedAlerts = sortDashboardAlerts(alerts)
    const payload: DashboardAlertsResponse = {
      criticalCount: sortedAlerts.length,
      totalAmountPen: roundMoney(sortedAlerts.reduce((sum, alert) => sum + alert.amountPen, 0)),
      alerts: sortedAlerts,
    }

    return apiOk(payload)
  }, { warnAtMs: 500 })
}
