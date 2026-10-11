import { expect, test } from '@playwright/test'
import { categoryBreakdown } from '@/lib/dashboard/category-breakdown'

test('Dashboard category API retains all categories and reconciles to the report total', () => {
  const categories = new Map(Array.from({ length: 7 }, (_, index) => [
    `category-${index}`,
    { name: `Category ${index}`, color: '#145b51' },
  ] as const))
  const transactions = Array.from({ length: 7 }, (_, index) => ({
    category_id: `category-${index}`,
    amount_pen: (index + 1) * 10,
    type: 'EXPENSE' as const,
  }))
  transactions.push({ category_id: 'category-0', amount_pen: 5, type: 'EXPENSE' })

  const result = categoryBreakdown(transactions, categories)

  expect(result.expense).toHaveLength(7)
  expect(result.expense.reduce((total, row) => total + row.monto, 0)).toBe(285)
  expect(result.expense.map((row) => row.category_id)).toEqual([
    'category-6', 'category-5', 'category-4', 'category-3', 'category-2', 'category-1', 'category-0',
  ])
  expect(result.income).toEqual([])
})
