import { expect, test } from '@playwright/test'
import { getBudgetCategoryFilterOptions } from '@/modules/budgets/category-filter-options'

test('budget category filters use the categories present in the already-loaded budget list', () => {
  expect(getBudgetCategoryFilterOptions([
    { category: { id: 'cat-z', name: 'Transporte' } },
    { category: { id: 'cat-a', name: 'Alimentación' } },
    { category: { id: 'cat-z', name: 'Transporte' } },
    { category: null },
  ])).toEqual([
    { id: 'cat-a', name: 'Alimentación' },
    { id: 'cat-z', name: 'Transporte' },
  ])
})
