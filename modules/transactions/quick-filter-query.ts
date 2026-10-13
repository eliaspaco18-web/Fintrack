import { QuickFilterParams, type QuickFilter, type TransactionListParams } from '@/lib/contracts/ui.contracts'

type QuickFilterParamPatch = Pick<TransactionListParams, 'type' | 'date_from' | 'date_to'>

export interface QuickFilterDateOverrides {
  dateFrom: string
  dateTo: string
}

/**
 * Return every quick-filter key, including undefined values, so a previous
 * type/date constraint is cleared when the selected preset no longer uses it.
 * Explicit date picker values continue to override preset dates.
 */
export function getQuickFilterParamPatch(
  filter: QuickFilter,
  dateFrom?: string,
  dateTo?: string,
): QuickFilterParamPatch {
  const preset = QuickFilterParams[filter]
  return {
    type: preset.type,
    date_from: dateFrom || preset.date_from,
    date_to: dateTo || preset.date_to,
  }
}

/** Keep URL dates as manual controls only when they differ from the preset. */
export function getQuickFilterDateOverrides(
  filter: QuickFilter,
  dateFrom?: string,
  dateTo?: string,
): QuickFilterDateOverrides {
  const preset = QuickFilterParams[filter]
  return {
    dateFrom: dateFrom && dateFrom !== preset.date_from ? dateFrom : '',
    dateTo: dateTo && dateTo !== preset.date_to ? dateTo : '',
  }
}

export function mergeTransactionListParams(
  previous: TransactionListParams,
  next: Partial<TransactionListParams>,
): TransactionListParams {
  return {
    ...previous,
    ...next,
    page: 'page' in next ? (next.page ?? 1) : 1,
  }
}

export function buildTransactionListUrl(params: TransactionListParams): string {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const search = query.toString()
  return search ? `/api/transactions?${search}` : '/api/transactions'
}
