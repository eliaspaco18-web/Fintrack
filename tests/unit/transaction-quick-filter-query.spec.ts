import { expect, test } from '@playwright/test'
import { QuickFilterParams, type TransactionListParams } from '@/lib/contracts/ui.contracts'
import {
  buildTransactionListUrl,
  getQuickFilterDateOverrides,
  getQuickFilterParamPatch,
  mergeTransactionListParams,
} from '@/modules/transactions/quick-filter-query'

test('All → This month → Expenses → All clears stale API constraints', () => {
  let params: TransactionListParams = { page: 1, per_page: 20 }
  const applyFilter = (filter: 'all' | 'this_month' | 'expense') => {
    params = mergeTransactionListParams(params, getQuickFilterParamPatch(filter))
  }
  const apiParams = () => new URL(buildTransactionListUrl(params), 'https://fintrack.test').searchParams

  applyFilter('all')
  expect(apiParams().get('type')).toBeNull()
  expect(apiParams().get('date_from')).toBeNull()
  expect(apiParams().get('date_to')).toBeNull()

  applyFilter('this_month')
  expect(apiParams().get('type')).toBeNull()
  expect(apiParams().get('date_from')).toMatch(/^\d{4}-\d{2}-01$/)
  expect(apiParams().get('date_to')).toMatch(/^\d{4}-\d{2}-\d{2}$/)

  applyFilter('expense')
  expect(apiParams().get('type')).toBe('EXPENSE')
  expect(apiParams().get('date_from')).toBeNull()
  expect(apiParams().get('date_to')).toBeNull()

  applyFilter('all')
  expect(apiParams().get('type')).toBeNull()
  expect(apiParams().get('date_from')).toBeNull()
  expect(apiParams().get('date_to')).toBeNull()
})

test('explicit dates override quick-filter dates and saved views clear manual dates', () => {
  expect(getQuickFilterParamPatch('this_month', '2026-10-03', '2026-10-09')).toEqual({
    type: undefined,
    date_from: '2026-10-03',
    date_to: '2026-10-09',
  })

  expect(getQuickFilterParamPatch('all')).toEqual({
    type: undefined,
    date_from: undefined,
    date_to: undefined,
  })

  expect(getQuickFilterDateOverrides(
    'this_month',
    QuickFilterParams.this_month.date_from,
    QuickFilterParams.this_month.date_to,
  )).toEqual({
    dateFrom: '',
    dateTo: '',
  })
  expect(getQuickFilterDateOverrides('this_month', '1999-12-01', '1999-12-31')).toEqual({
    dateFrom: '1999-12-01',
    dateTo: '1999-12-31',
  })
})

test('pagination resets to page one when filters change and preserves other params', () => {
  const current: TransactionListParams = {
    page: 4,
    per_page: 50,
    type: 'INCOME',
    account_id: 'account-id',
  }
  const next = mergeTransactionListParams(current, getQuickFilterParamPatch('expense'))
  const query = new URL(buildTransactionListUrl(next), 'https://fintrack.test').searchParams

  expect(query.get('page')).toBe('1')
  expect(query.get('per_page')).toBe('50')
  expect(query.get('type')).toBe('EXPENSE')
  expect(query.get('account_id')).toBe('account-id')
})
