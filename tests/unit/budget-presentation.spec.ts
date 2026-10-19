import { expect, test } from '@playwright/test'
import {
  budgetRowsForSelectedMonth,
  clampBudgetProgress,
  countBudgetStatuses,
  displayBudgetProgress,
  formatBudgetCurrency,
  summarizeBudgetCurrencies,
} from '@/lib/budgets/presentation'

test('budget summaries retain separate currencies and negative over-limit availability', () => {
  const summary = summarizeBudgetCurrencies([
    { amount: 100, spent_amount: 120, remaining_amount: -20, budget: { currency: 'PEN' } },
    { amount: 80, spent_amount: 25, remaining_amount: 55, budget: { currency: 'USD' } },
    { amount: 30, spent_amount: 10, remaining_amount: 20, budget: { currency: 'EUR' } },
  ])

  expect(summary.map(item => item.currency)).toEqual(['EUR', 'PEN', 'USD'])
  expect(summary.find(item => item.currency === 'PEN')).toMatchObject({
    assigned: 100,
    spent: 120,
    available: -20,
  })
  expect(summary.reduce((sum, item) => sum + item.assigned, 0)).toBe(210)
})

test('budget currency formatter preserves arbitrary currency codes', () => {
  expect(formatBudgetCurrency(25, 'PEN')).toContain('25.00')
  expect(formatBudgetCurrency(25, 'USD')).toContain('25.00')
  expect(formatBudgetCurrency(25, 'EUR')).toContain('25.00')
})

test('budget progress labels remain uncapped while only the visual track is clamped', () => {
  expect(displayBudgetProgress(137.5)).toBe('137.5%')
  expect(clampBudgetProgress(137.5)).toBe(100)
  expect(clampBudgetProgress(-8)).toBe(0)
})

test('a month switch never exposes rows from the previously loaded month', () => {
  const previousMonthRows = [{ id: 'legacy-august-row', month: '2026-08' }]

  expect(budgetRowsForSelectedMonth(previousMonthRows, '2026-08', '2026-09')).toEqual([])
  expect(budgetRowsForSelectedMonth(previousMonthRows, '2026-08', '2026-08')).toEqual(previousMonthRows)
})

test('status counts follow the records represented by the selected workspace view', () => {
  const series = [
    { is_active: true },
    { is_active: false },
    { is_active: true },
  ]
  const displayedMonthRows = [
    { budget: { is_active: false } },
    { budget: { is_active: false } },
  ]

  expect(countBudgetStatuses(series)).toEqual({ active: 2, inactive: 1, total: 3 })
  expect(countBudgetStatuses(displayedMonthRows.map(row => row.budget))).toEqual({ active: 0, inactive: 2, total: 2 })
})
