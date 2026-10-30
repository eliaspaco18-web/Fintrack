import type { BudgetPeriod, CurrencyCode } from '@/types/database.types'
import { convertBudgetAmount } from '@/lib/budgets/budget-metrics'

export type BudgetPeriodStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED' | 'SKIPPED'

export type BudgetSeriesForPeriod = {
  id: string
  name: string
  currency: CurrencyCode
  period_type: BudgetPeriod
}

export type BudgetPeriodForMetrics = {
  id: string
  legacy_budget_id: string | null
  period_start: string
  period_end: string
  amount: number
}

export type BudgetPeriodMetricTransaction = {
  amount: number
  currency: CurrencyCode
  exchange_rate: number | null
  budget_id: string | null
  budget_period_id: string | null
  transaction_date: string
}

export type BudgetPeriodMetrics = {
  spent_amount: number | null
  remaining_amount: number | null
  progress_percent: number | null
  over_limit: boolean | null
  metrics_complete: boolean
  missing_conversion_count: number
}

function parseISODate(date: string): Date {
  return new Date(`${date}T12:00:00Z`)
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function addBudgetPeriodDate(date: Date, period: BudgetPeriod): Date {
  const next = new Date(date)
  if (period === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + 7)
    return next
  }

  if (period === 'MONTHLY') {
    next.setUTCMonth(next.getUTCMonth() + 1)
    return next
  }

  if (period === 'QUARTERLY') {
    next.setUTCMonth(next.getUTCMonth() + 3)
    return next
  }

  next.setUTCFullYear(next.getUTCFullYear() + 1)
  return next
}

export function calcBudgetPeriodEnd(startDate: string, period: BudgetPeriod): string {
  const start = parseISODate(startDate)
  return toISODate(addDays(addBudgetPeriodDate(start, period), -1))
}

export function nextBudgetPeriodStart(periodEnd: string): string {
  return toISODate(addDays(parseISODate(periodEnd), 1))
}

export function monthRange(period: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}$/.test(period)) return null
  const start = parseISODate(`${period}-01`)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  end.setUTCDate(end.getUTCDate() - 1)
  return { start: toISODate(start), end: toISODate(end) }
}

function clamp2(value: number): number {
  return Math.round(value * 100) / 100
}

export function buildBudgetPeriodMetrics(
  series: Pick<BudgetSeriesForPeriod, 'currency'>,
  period: BudgetPeriodForMetrics,
  transactions: BudgetPeriodMetricTransaction[],
): BudgetPeriodMetrics {
  let spent = 0
  let missingConversionCount = 0
  transactions.forEach(tx => {
    const matchesNew = tx.budget_period_id === period.id
    const matchesLegacy = Boolean(period.legacy_budget_id && tx.budget_id === period.legacy_budget_id)
    if (!matchesNew && !matchesLegacy) return

    const converted = convertBudgetAmount(
      Number(tx.amount ?? 0),
      tx.currency,
      series.currency,
      tx.exchange_rate,
    )
    if (converted === null || !Number.isFinite(converted)) {
      missingConversionCount += 1
      return
    }
    spent += converted
  })

  if (missingConversionCount > 0) {
    return {
      spent_amount: null,
      remaining_amount: null,
      progress_percent: null,
      over_limit: null,
      metrics_complete: false,
      missing_conversion_count: missingConversionCount,
    }
  }

  const amount = Number(period.amount ?? 0)
  const safeSpent = clamp2(spent)
  const remaining = clamp2(amount - safeSpent)
  const progress = amount > 0 ? clamp2((safeSpent / amount) * 100) : 0

  return {
    spent_amount: safeSpent,
    remaining_amount: remaining,
    progress_percent: progress,
    over_limit: safeSpent > amount,
    metrics_complete: true,
    missing_conversion_count: 0,
  }
}
