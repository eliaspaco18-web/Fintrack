import { expect, test } from '@playwright/test'
import { monthBounds, summarizeMonth } from '@/lib/transactions-month-summary'
import { budgetSummaryForDisplay } from '@/lib/budgets/presentation'

test('month boundaries support leap years and reject invalid periods', () => {
  expect(monthBounds('2024-02')).toEqual({ start: '2024-02-01', end: '2024-02-29' })
  expect(monthBounds('2025-02')?.end).toBe('2025-02-28')
  expect(monthBounds('2025-13')).toBeNull()
})

test('monthly totals distinguish empty, incomplete and transfer records', () => {
  expect(summarizeMonth([])).toEqual({ ingresos_mes: 0, egresos_mes: 0, resultado_mensual: 0 })
  expect(summarizeMonth([{ type: 'INCOME', amount_pen: 120 }, { type: 'EXPENSE', amount_pen: '20' }, { type: 'TRANSFER', amount_pen: 999 }])).toEqual({ ingresos_mes: 120, egresos_mes: 20, resultado_mensual: 100 })
  expect(summarizeMonth([{ type: 'INCOME', amount_pen: null }, { type: 'EXPENSE', amount_pen: 20 }])).toEqual({ ingresos_mes: null, egresos_mes: 20, resultado_mensual: null })
})

test('empty budgets use the selected currency and preserve incomplete results', () => {
  expect(budgetSummaryForDisplay([], 'PEN')[0]).toMatchObject({ currency: 'PEN', assigned: 0, spent: 0, available: 0 })
  expect(budgetSummaryForDisplay([], 'USD')[0]).toMatchObject({ currency: 'USD', assigned: 0, spent: 0, available: 0 })
  expect(budgetSummaryForDisplay([{ amount: 10, spent_amount: null, remaining_amount: null, budget: { currency: 'USD' } }])[0]).toMatchObject({ spent: null, available: null, metrics_complete: false })
})
