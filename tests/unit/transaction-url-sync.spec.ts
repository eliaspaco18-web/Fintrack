import { expect, test } from '@playwright/test'
import type { QuickFilter } from '@/lib/contracts/ui.contracts'
import {
  buildTransactionSearchQuery,
  resolveTransactionUrlSyncAction,
} from '@/modules/transactions/transaction-url-sync'

function simulateQuickFilterReplacements(filters: QuickFilter[]) {
  let actualQuery = ''
  let lastSyncedQuery = ''
  let replaceCount = 0

  for (const filter of filters) {
    const desiredQuery = buildTransactionSearchQuery({
      currentQuery: actualQuery,
      activeFilter: filter,
      search: '',
      accountId: '',
      categoryId: '',
      dateFrom: '',
      dateTo: '',
      sort: 'transaction_date-desc',
      sortBy: 'transaction_date',
      sortDir: 'desc',
      page: 1,
      perPage: 20,
    })
    const action = resolveTransactionUrlSyncAction({
      actualQuery,
      renderedQuery: actualQuery,
      desiredQuery,
      lastSyncedQuery,
      popStatePending: false,
    })

    if (action === 'replace-url') {
      actualQuery = desiredQuery
      lastSyncedQuery = desiredQuery
      replaceCount += 1
    }
  }

  return { actualQuery, lastSyncedQuery, replaceCount }
}

test('rapid Todos → Ingresos → Todos keeps the final user selection stable', () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = simulateQuickFilterReplacements(['all', 'income', 'all'])
    expect(result.actualQuery).toBe('')
    expect(result.lastSyncedQuery).toBe('')
    expect(result.replaceCount).toBe(2)
    expect(resolveTransactionUrlSyncAction({
      actualQuery: result.actualQuery,
      renderedQuery: result.actualQuery,
      desiredQuery: '',
      lastSyncedQuery: result.lastSyncedQuery,
      popStatePending: false,
    })).toBe('stable')
  }
})

test('rapid Egresos and Transferencias transitions settle without redundant URL writes', () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    for (const filters of [
      ['all', 'expense', 'all'],
      ['all', 'transfer', 'all'],
    ] as QuickFilter[][]) {
      const result = simulateQuickFilterReplacements(filters)
      expect(result.actualQuery).toBe('')
      expect(result.replaceCount).toBe(2)
    }
  }
})

test('quick-filter URL updates preserve search, saved-view, and unrelated query state', () => {
  const query = buildTransactionSearchQuery({
    currentQuery: 'search=coffee&saved_view=monthly&new=transaction',
    activeFilter: 'income',
    search: 'coffee',
    accountId: '',
    categoryId: '',
    dateFrom: '',
    dateTo: '',
    sort: 'transaction_date-desc',
    sortBy: 'transaction_date',
    sortDir: 'desc',
    page: 1,
    perPage: 20,
  })
  const params = new URLSearchParams(query)
  expect(params.get('qf')).toBe('income')
  expect(params.get('type')).toBe('INCOME')
  expect(params.get('search')).toBe('coffee')
  expect(params.get('saved_view')).toBe('monthly')
  expect(params.get('new')).toBe('transaction')
})

test('URL sync preserves manual date and advanced filters while retaining pagination', () => {
  const query = buildTransactionSearchQuery({
    currentQuery: 'status=reviewed&saved_view=monthly&tag=planned',
    activeFilter: 'all',
    search: 'coffee',
    accountId: 'account-qa',
    categoryId: 'category-qa',
    dateFrom: '2026-10-03',
    dateTo: '2026-10-09',
    sort: 'amount-asc',
    sortBy: 'amount',
    sortDir: 'asc',
    page: 3,
    perPage: 50,
  })
  const params = new URLSearchParams(query)

  expect(params.get('status')).toBe('reviewed')
  expect(params.get('tag')).toBe('planned')
  expect(params.get('saved_view')).toBe('monthly')
  expect(params.get('search')).toBe('coffee')
  expect(params.get('account_id')).toBe('account-qa')
  expect(params.get('category_id')).toBe('category-qa')
  expect(params.get('date_from')).toBe('2026-10-03')
  expect(params.get('date_to')).toBe('2026-10-09')
  expect(params.get('sort_by')).toBe('amount')
  expect(params.get('sort_dir')).toBe('asc')
  expect(params.get('page')).toBe('3')
  expect(params.get('per_page')).toBe('50')
  expect(params.has('qf')).toBe(false)
  expect(params.has('type')).toBe(false)
})

test('a stale Next searchParams snapshot cannot overwrite the current browser URL', () => {
  expect(resolveTransactionUrlSyncAction({
    actualQuery: '',
    renderedQuery: 'qf=income',
    desiredQuery: 'qf=income',
    lastSyncedQuery: '',
    popStatePending: false,
  })).toBe('wait')
})

test('Back/Forward URL changes are adopted after the rendered query catches up', () => {
  expect(resolveTransactionUrlSyncAction({
    actualQuery: 'qf=income',
    renderedQuery: 'qf=income',
    desiredQuery: '',
    lastSyncedQuery: '',
    popStatePending: true,
  })).toBe('adopt-url')
})
