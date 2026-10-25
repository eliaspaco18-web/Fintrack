import { expect, test } from '@playwright/test'
import { buildBudgetMetrics, convertBudgetAmount } from '@/lib/budgets/budget-metrics'
import { buildBudgetPeriodMetrics } from '@/lib/budgets/budget-periods'
import { formatBudgetCurrency, summarizeBudgetCurrencies } from '@/lib/budgets/presentation'

const budget = {
  id: 'budget-1',
  amount: 1000,
  currency: 'PEN' as const,
  period_type: 'MONTHLY' as const,
  start_date: '2026-10-01',
  end_date: null,
}

test('budget conversion retains same-currency and persisted historical-rate calculations only', () => {
  expect(convertBudgetAmount(20, 'USD', 'PEN', null)).toBeNull()
  expect(convertBudgetAmount(20, 'USD', 'PEN', 3.75)).toBe(75)
  expect(convertBudgetAmount(75, 'PEN', 'USD', 3.75)).toBe(20)
  expect(convertBudgetAmount(75, 'PEN', 'PEN', null)).toBe(75)
})

test('budget metrics mark all dependent values incomplete instead of publishing a partial total', () => {
  const metrics = buildBudgetMetrics(budget, [{
    amount: 20,
    currency: 'USD',
    exchange_rate: null,
    budget_id: budget.id,
    transaction_date: '2026-10-15',
  }], { start: '2026-10-01', end: '2026-10-31' })

  expect(metrics).toMatchObject({
    spent_amount: null,
    remaining_amount: null,
    progress_percent: null,
    over_limit: null,
    metrics_complete: false,
    missing_conversion_count: 1,
  })
  expect(formatBudgetCurrency(metrics.remaining_amount, 'PEN')).toBe('No disponible')
})

test('budget metrics keep verified historical rates and avoid false incompleteness for matching currencies', () => {
  const historical = buildBudgetMetrics(budget, [{
    amount: 20,
    currency: 'USD',
    exchange_rate: 3.75,
    budget_id: budget.id,
    transaction_date: '2026-10-15',
  }], { start: '2026-10-01', end: '2026-10-31' })
  expect(historical).toMatchObject({ spent_amount: 75, remaining_amount: 925, metrics_complete: true, over_limit: false })

  const native = buildBudgetMetrics(budget, [{
    amount: 20,
    currency: 'PEN',
    exchange_rate: null,
    budget_id: budget.id,
    transaction_date: '2026-10-15',
  }], { start: '2026-10-01', end: '2026-10-31' })
  expect(native).toMatchObject({ spent_amount: 20, remaining_amount: 980, metrics_complete: true })
})

test('budget period metrics do not call an incomplete mixed-currency period exceeded', () => {
  const metrics = buildBudgetPeriodMetrics(
    { currency: 'PEN' },
    { id: 'period-1', legacy_budget_id: null, period_start: '2026-10-01', period_end: '2026-10-31', amount: 10 },
    [{ amount: 50, currency: 'USD', exchange_rate: null, budget_id: null, budget_period_id: 'period-1', transaction_date: '2026-10-20' }],
  )
  expect(metrics.over_limit).toBeNull()
  expect(metrics.metrics_complete).toBe(false)
  expect(metrics.spent_amount).toBeNull()
})

test('budget currency summaries avoid a partial spend/availability total for one incomplete row', () => {
  expect(summarizeBudgetCurrencies([
    { amount: 100, spent_amount: 20, remaining_amount: 80, metrics_complete: true, budget: { currency: 'PEN' } },
    { amount: 200, spent_amount: null, remaining_amount: null, metrics_complete: false, budget: { currency: 'PEN' } },
  ])).toEqual([{
    currency: 'PEN', assigned: 300, spent: null, available: null, metrics_complete: false,
  }])
})
