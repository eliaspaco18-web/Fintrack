import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import type { TransactionListParams } from '@/lib/contracts/ui.contracts'

export interface TransactionTypeCounts {
  all: number
  income: number
  expense: number
  transfer: number
}

type CountsFetcher = (url: string) => Promise<Response>

export async function fetchTransactionTypeCounts(
  scopeKey: string,
  request: CountsFetcher = url => fetchWithTimeout(url),
): Promise<TransactionTypeCounts> {
  const scope = JSON.parse(scopeKey) as Partial<TransactionListParams>
  const query = new URLSearchParams()
  Object.entries(scope).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(name, String(value))
  })

  const response = await request(`/api/transactions/type-counts?${query.toString()}`)
  const payload = await response.json()
  const counts = payload?.data
  const valid = ['all', 'income', 'expense', 'transfer'].every(key =>
    Number.isInteger(counts?.[key]) && counts[key] >= 0,
  )
  if (!response.ok || payload?.ok !== true || !valid) {
    throw new Error('TRANSACTION_COUNT_UNAVAILABLE')
  }
  return counts as TransactionTypeCounts
}
