export type BudgetRecordScopeSource = {
  id: string
  series_id: string
  start_date: string
  end_date: string | null
  category_id: string | null
}

export type BudgetRecordActionScope = {
  kind: 'RECORD'
  record_id: string
  series_id: string
  start_date: string
  end_date: string | null
  category_id: string | null
}

export type BudgetRecordScopeCheck =
  | { status: 'VERIFIED' }
  | { status: 'NOT_FOUND' }
  | { status: 'UNAVAILABLE' }
  | { status: 'CHANGED' }

export const BUDGET_SCOPE_REQUIRED_ERROR = {
  code: 'VALIDATION_ERROR',
  message: 'Debes confirmar el periodo exacto antes de modificarlo.',
  detail: 'No se aplicaron cambios. Recarga Presupuestos e intenta nuevamente.',
} as const

export const BUDGET_SCOPE_VERIFICATION_ERROR = {
  code: 'DATABASE_ERROR',
  message: 'No pudimos verificar el periodo exacto del presupuesto.',
  detail: 'No se aplicaron cambios. Intenta nuevamente.',
} as const

export const BUDGET_SCOPE_CHANGED_ERROR = {
  code: 'BUSINESS_RULE_ERROR',
  message: 'El periodo seleccionado cambio desde que lo abriste.',
  detail: 'No se aplicaron cambios. Recarga Presupuestos y revisa el periodo antes de continuar.',
} as const

export function createBudgetRecordActionScope(
  budget: BudgetRecordScopeSource,
): BudgetRecordActionScope {
  return {
    kind: 'RECORD',
    record_id: budget.id,
    series_id: budget.series_id,
    start_date: budget.start_date,
    end_date: budget.end_date,
    category_id: budget.category_id,
  }
}

export function budgetRecordScopeMatches(
  current: BudgetRecordScopeSource,
  expected: BudgetRecordActionScope,
): boolean {
  return (
    expected.kind === 'RECORD'
    && current.id === expected.record_id
    && current.series_id === expected.series_id
    && current.start_date === expected.start_date
    && current.end_date === expected.end_date
    && current.category_id === expected.category_id
  )
}

export function checkBudgetRecordActionScope(input: {
  current: BudgetRecordScopeSource | null
  expected: BudgetRecordActionScope
  verificationFailed?: boolean
}): BudgetRecordScopeCheck {
  if (input.verificationFailed) return { status: 'UNAVAILABLE' }
  if (!input.current) return { status: 'NOT_FOUND' }
  return budgetRecordScopeMatches(input.current, input.expected)
    ? { status: 'VERIFIED' }
    : { status: 'CHANGED' }
}
