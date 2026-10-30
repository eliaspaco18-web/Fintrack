import { QuickFilterParams, type QuickFilter, type TransactionListParams } from '@/lib/contracts/ui.contracts'

export type TransactionUrlSyncAction = 'wait' | 'adopt-url' | 'replace-url' | 'stable'

export function buildTransactionSearchQuery(input: {
  currentQuery: string
  activeFilter: QuickFilter
  search: string
  accountId: string
  categoryId: string
  dateFrom: string
  dateTo: string
  sort: string
  sortBy: TransactionListParams['sort_by']
  sortDir: 'asc' | 'desc'
  page: number
  perPage: number
}): string {
  const next = new URLSearchParams(input.currentQuery)
  const preset = QuickFilterParams[input.activeFilter]
  const setOrDelete = (key: string, value: string | undefined) => {
    if (!value) {
      next.delete(key)
      return
    }
    next.set(key, value)
  }

  setOrDelete('qf', input.activeFilter !== 'all' ? input.activeFilter : undefined)
  setOrDelete('search', input.search || undefined)
  setOrDelete('account_id', input.accountId || undefined)
  setOrDelete('category_id', input.categoryId || undefined)
  setOrDelete('type', preset.type)
  setOrDelete('date_from', input.dateFrom || preset.date_from)
  setOrDelete('date_to', input.dateTo || preset.date_to)

  if (input.sort === 'transaction_date-desc') {
    next.delete('sort_by')
    next.delete('sort_dir')
  } else {
    next.set('sort_by', input.sortBy ?? 'transaction_date')
    next.set('sort_dir', input.sortDir)
  }

  setOrDelete('page', input.page > 1 ? String(input.page) : undefined)
  setOrDelete('per_page', input.perPage !== 20 ? String(input.perPage) : undefined)
  return next.toString()
}

export function resolveTransactionUrlSyncAction(input: {
  actualQuery: string
  renderedQuery: string
  desiredQuery: string
  lastSyncedQuery: string
  popStatePending: boolean
}): TransactionUrlSyncAction {
  const { actualQuery, renderedQuery, desiredQuery, lastSyncedQuery, popStatePending } = input

  if (renderedQuery !== actualQuery) return 'wait'
  if (popStatePending || actualQuery !== lastSyncedQuery) {
    return actualQuery === lastSyncedQuery ? 'stable' : 'adopt-url'
  }

  return desiredQuery === actualQuery ? 'stable' : 'replace-url'
}
