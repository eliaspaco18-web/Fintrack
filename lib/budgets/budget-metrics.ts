import type { BudgetPeriod, CurrencyCode } from '@/types/database.types'

export type BudgetWindowSource = {
  start_date: string
  end_date: string | null
  period_type: BudgetPeriod
}

export type BudgetMetricsSource = BudgetWindowSource & {
  id: string
  amount: number
  currency: CurrencyCode
}

export type BudgetMetricTransaction = {
  amount: number
  currency: CurrencyCode
  exchange_rate: number | null
  budget_id: string | null
  transaction_date: string
}

export type BudgetMetrics = {
  period_start: string
  period_end: string
  spent_amount: number
  remaining_amount: number
  progress_percent: number
  over_limit: boolean
}

function parseISODate(date: string): Date {
  return new Date(`${date}T12:00:00Z`)
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function clamp2(value: number): number {
  return Math.round(value * 100) / 100
}

export function addBudgetPeriod(date: Date, period: BudgetPeriod): Date {
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

export function resolveBudgetWindowAtDate(
  budget: BudgetWindowSource,
  anchorDate: string,
): { start: string; end: string } | null {
  const anchor = parseISODate(anchorDate)
  const budgetStart = parseISODate(budget.start_date)
  if (anchor.getTime() < budgetStart.getTime()) return null

  const budgetEnd = budget.end_date ? parseISODate(budget.end_date) : null
  if (budgetEnd && anchor.getTime() > budgetEnd.getTime()) return null

  let cycleStart = budgetStart
  let cycleNext = addBudgetPeriod(cycleStart, budget.period_type)

  while (cycleNext.getTime() <= anchor.getTime()) {
    cycleStart = cycleNext
    cycleNext = addBudgetPeriod(cycleStart, budget.period_type)
  }

  let cycleEnd = addDays(cycleNext, -1)
  if (budgetEnd && cycleEnd.getTime() > budgetEnd.getTime()) {
    cycleEnd = budgetEnd
  }

  if (anchor.getTime() < cycleStart.getTime() || anchor.getTime() > cycleEnd.getTime()) {
    return null
  }

  return {
    start: toISODate(cycleStart),
    end: toISODate(cycleEnd),
  }
}

export function resolveBudgetWindow(
  budget: BudgetWindowSource,
  now = new Date(),
): { start: string; end: string } {
  const today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    12,
    0,
    0,
  ))

  let cycleStart = parseISODate(budget.start_date)
  let cycleNext = addBudgetPeriod(cycleStart, budget.period_type)

  const budgetEnd = budget.end_date ? parseISODate(budget.end_date) : null

  if (budgetEnd && today.getTime() > budgetEnd.getTime()) {
    while (cycleNext.getTime() <= budgetEnd.getTime()) {
      cycleStart = cycleNext
      cycleNext = addBudgetPeriod(cycleStart, budget.period_type)
    }
    const lastEnd = addDays(cycleNext, -1)
    const end = budgetEnd.getTime() < lastEnd.getTime() ? budgetEnd : lastEnd
    return { start: toISODate(cycleStart), end: toISODate(end) }
  }

  while (cycleNext.getTime() <= today.getTime()) {
    cycleStart = cycleNext
    cycleNext = addBudgetPeriod(cycleStart, budget.period_type)
  }

  let cycleEnd = addDays(cycleNext, -1)
  if (budgetEnd && cycleEnd.getTime() > budgetEnd.getTime()) {
    cycleEnd = budgetEnd
  }

  return {
    start: toISODate(cycleStart),
    end: toISODate(cycleEnd),
  }
}

export function convertBudgetAmount(
  amount: number,
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  exchangeRate: number | null,
): number {
  const safeRate = exchangeRate && exchangeRate > 0 ? exchangeRate : 3.7

  if (sourceCurrency === targetCurrency) return amount
  if (sourceCurrency === 'USD' && targetCurrency === 'PEN') return amount * safeRate
  if (sourceCurrency === 'PEN' && targetCurrency === 'USD') return amount / safeRate
  return amount
}

export function buildBudgetMetrics(
  budget: BudgetMetricsSource,
  transactions: BudgetMetricTransaction[],
  windowOverride?: { start: string; end: string },
): BudgetMetrics {
  const window = windowOverride ?? resolveBudgetWindow(budget)
  const startAt = parseISODate(window.start).getTime()
  const endAt = parseISODate(window.end).getTime()

  const spent = transactions.reduce((sum, tx) => {
    const txDate = parseISODate(tx.transaction_date).getTime()
    if (txDate < startAt || txDate > endAt) return sum
    if (tx.budget_id !== budget.id) return sum

    return sum + convertBudgetAmount(
      Number(tx.amount ?? 0),
      tx.currency,
      budget.currency,
      tx.exchange_rate,
    )
  }, 0)

  const total = Number(budget.amount ?? 0)
  const safeSpent = clamp2(spent)
  const remaining = clamp2(total - safeSpent)
  const progress = total > 0 ? clamp2((safeSpent / total) * 100) : 0

  return {
    period_start: window.start,
    period_end: window.end,
    spent_amount: safeSpent,
    remaining_amount: remaining,
    progress_percent: progress,
    over_limit: safeSpent > total,
  }
}
