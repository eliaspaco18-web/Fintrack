import type { CurrencyCode } from '@/types/database.types'

export type BudgetPeriodSummaryRow = {
  amount: number
  spent_amount: number
  remaining_amount: number
  budget: { currency: CurrencyCode }
}

export type BudgetCurrencySummary = {
  currency: CurrencyCode
  assigned: number
  spent: number
  available: number
}

export type BudgetStatusItem = { is_active: boolean }

export type BudgetStatusCounts = {
  active: number
  inactive: number
  total: number
}

/** Count the records represented by the current view, without changing filter semantics. */
export function countBudgetStatuses(items: readonly BudgetStatusItem[]): BudgetStatusCounts {
  const active = items.reduce((count, item) => count + (item.is_active ? 1 : 0), 0)
  return { active, inactive: items.length - active, total: items.length }
}

/** Keep rows from a previous request out of the newly selected month while it loads. */
export function budgetRowsForSelectedMonth<T>(
  rows: T[],
  loadedMonth: string | null,
  selectedMonth: string,
): T[] {
  return loadedMonth === selectedMonth ? rows : []
}

/** Aggregate each budget currency independently; never imply a converted total. */
export function summarizeBudgetCurrencies(
  rows: BudgetPeriodSummaryRow[],
): BudgetCurrencySummary[] {
  const summaries = new Map<string, BudgetCurrencySummary>()

  for (const row of rows) {
    const currency = String(row.budget.currency)
    const summary = summaries.get(currency) ?? {
      currency: row.budget.currency,
      assigned: 0,
      spent: 0,
      available: 0,
    }
    summary.assigned += Number(row.amount ?? 0)
    summary.spent += Number(row.spent_amount ?? 0)
    // Keep negative availability visible when the budget is exceeded.
    summary.available += Number(row.remaining_amount ?? 0)
    summaries.set(currency, summary)
  }

  return [...summaries.values()].sort((left, right) =>
    String(left.currency).localeCompare(String(right.currency)),
  )
}

/** Display-only formatter that preserves non-PEN/USD currency codes. */
export function formatBudgetCurrency(amount: number, currency: CurrencyCode): string {
  const code = String(currency)
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount))
  } catch {
    return `${code} ${new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount))}`
  }
}

export function clampBudgetProgress(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
}

export function displayBudgetProgress(value: number): string {
  return `${Number.isFinite(value) ? value : 0}%`
}
