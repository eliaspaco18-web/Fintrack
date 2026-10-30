export type BudgetPeriodApiIdentity = {
  id: string
  legacy_budget_id: string | null
}

export type BudgetPeriodRecordIdentity = {
  id: string
  budget_period_id?: string
  legacy_budget_id?: string
}

export type BudgetPeriodRecord = BudgetPeriodRecordIdentity & {
  period_start: string
  period_end: string
}

export type BudgetPeriodEditTarget =
  | { kind: 'legacy-budget'; budgetId: string }
  | { kind: 'explicit-period'; periodId: string }

/**
 * /api/budget-periods normalizes an inherited legacy budget with
 * id === legacy_budget_id. Explicit period rows have their own id, even when
 * linked to a legacy budget row.
 */
export function resolveBudgetPeriodIdentity(row: BudgetPeriodApiIdentity): BudgetPeriodRecordIdentity {
  const isLegacyBudgetRow = row.legacy_budget_id === row.id

  return {
    id: `budget-period:${row.id}`,
    ...(isLegacyBudgetRow ? {} : { budget_period_id: row.id }),
    legacy_budget_id: isLegacyBudgetRow ? row.id : row.legacy_budget_id ?? undefined,
  }
}

export function resolveBudgetPeriodEditTarget(row: BudgetPeriodApiIdentity): BudgetPeriodEditTarget {
  return row.legacy_budget_id === row.id
    ? { kind: 'legacy-budget', budgetId: row.id }
    : { kind: 'explicit-period', periodId: row.id }
}

export function resolveBudgetPeriodTransactionsUrl(period: BudgetPeriodRecord): string {
  if (period.budget_period_id) {
    return `/api/budget-periods/${encodeURIComponent(period.budget_period_id)}/transactions`
  }

  const legacyBudgetId = period.legacy_budget_id ?? period.id
  const params = new URLSearchParams({
    period_start: period.period_start,
    period_end: period.period_end,
  })
  return `/api/budgets/${encodeURIComponent(legacyBudgetId)}/transactions?${params.toString()}`
}

export function resolveBudgetPeriodAmountUrl(period: BudgetPeriodRecord): string {
  return period.budget_period_id
    ? `/api/budget-periods/${encodeURIComponent(period.budget_period_id)}`
    : `/api/budgets/${encodeURIComponent(period.legacy_budget_id ?? period.id)}`
}

export function mergeBudgetPeriodItems<T extends BudgetPeriodRecord>(
  periods: T[] | undefined,
  selected: T,
): T[] {
  const supplied = periods ?? []
  const selectedLegacyId = selected.legacy_budget_id ?? (!selected.budget_period_id ? selected.id : undefined)
  const next = supplied.filter(period => {
    if (selected.budget_period_id) {
      if (period.budget_period_id === selected.budget_period_id) return false
      if (selectedLegacyId && !period.budget_period_id && (period.legacy_budget_id ?? period.id) === selectedLegacyId) {
        return false
      }
      return period.period_start !== selected.period_start || period.period_end !== selected.period_end
    }

    const periodLegacyId = period.legacy_budget_id ?? (!period.budget_period_id ? period.id : undefined)
    return periodLegacyId !== selectedLegacyId
  })

  return [...next, selected].sort((left, right) => left.period_start.localeCompare(right.period_start))
}
