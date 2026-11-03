import { expect, test } from '@playwright/test'
import { fetchTransactionTypeCounts } from '@/lib/transactions/transaction-type-counts'
import { TransactionRepository } from '@/modules/transactions/transaction.repository'
import { shouldPreloadTransactionFormOptions } from '@/lib/server/transaction-form-options'

test('type badges use one scoped counts request instead of reloading four list pages', async () => {
  const requested: string[] = []
  const counts = await fetchTransactionTypeCounts(JSON.stringify({
    date_from: '2026-10-01',
    date_to: '2026-10-31',
    search: 'alquiler',
    account_id: '8bb5cb48-5a65-4cb2-98a4-246ea543cbad',
  }), async url => {
    requested.push(url)
    return Response.json({ ok: true, data: { all: 4, income: 1, expense: 2, transfer: 1 } })
  })

  expect(requested).toHaveLength(1)
  expect(requested[0]).toContain('/api/transactions/type-counts?')
  expect(requested[0]).toContain('date_from=2026-10-01')
  expect(requested[0]).toContain('date_to=2026-10-31')
  expect(requested[0]).toContain('account_id=8bb5cb48-5a65-4cb2-98a4-246ea543cbad')
  expect(counts).toEqual({ all: 4, income: 1, expense: 2, transfer: 1 })
})

test('transaction type count repository runs head-only counts scoped to the signed-in user and active filters', async () => {
  const calls: Array<{ table: string; userId?: string; type?: string; filters: Array<[string, unknown]>; head?: boolean; count?: string; selected?: string }> = []
  const db = {
    from: (table: string) => {
      const call: (typeof calls)[number] = { table, filters: [] }
      calls.push(call)
      const query: any = {
        select: (columns: string, options: { head?: boolean; count?: string }) => {
          call.selected = columns
          call.head = options.head
          call.count = options.count
          return query
        },
        eq: (column: string, value: unknown) => {
          if (column === 'user_id') call.userId = String(value)
          else if (column === 'type') call.type = String(value)
          else call.filters.push([column, value])
          return query
        },
        or: (value: string) => { call.filters.push(['or', value]); return query },
        gte: (column: string, value: unknown) => { call.filters.push([column, value]); return query },
        lte: (column: string, value: unknown) => { call.filters.push([column, value]); return query },
        ilike: (column: string, value: unknown) => { call.filters.push([column, value]); return query },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: null, count: call.type === 'INCOME' ? 2 : call.type === 'EXPENSE' ? 3 : call.type === 'TRANSFER' ? 1 : 6, error: null })),
      }
      return query
    },
  }

  const result = await new TransactionRepository(db as never).countByScope('user-42', {
    search: 'renta',
    date_from: '2026-10-01',
    date_to: '2026-10-31',
    category_id: 'category-9',
  })

  expect(result).toEqual({ ok: true, data: { all: 6, income: 2, expense: 3, transfer: 1 } })
  expect(calls).toHaveLength(4)
  expect(calls.every(call => call.table === 'transactions' && call.userId === 'user-42')).toBe(true)
  expect(calls.every(call => call.selected === 'id' && call.head === true && call.count === 'exact')).toBe(true)
  expect(calls.every(call => call.filters.some(([column, value]) => column === 'description' && value === '%renta%') && call.filters.some(([column, value]) => column === 'transaction_date' && value === '2026-10-01') && call.filters.some(([column, value]) => column === 'transaction_date' && value === '2026-10-31'))).toBe(true)
  expect(calls.every(call => call.filters.some(([column, value]) => column === 'category_id' && value === 'category-9'))).toBe(true)
})

test('invalid count responses fail closed rather than showing zero badges', async () => {
  await expect(fetchTransactionTypeCounts('{}', async () => Response.json({ ok: true, data: { all: 0, income: null, expense: 0, transfer: 0 } })))
    .rejects.toThrow('TRANSACTION_COUNT_UNAVAILABLE')
})


test('form reference options are deferred until a create route actually carries prefill values', () => {
  expect(shouldPreloadTransactionFormOptions(undefined)).toBe(false)
  expect(shouldPreloadTransactionFormOptions({ search: 'sueldo', page: '2' })).toBe(false)
  expect(shouldPreloadTransactionFormOptions({ new: 'transaction' })).toBe(false)
  expect(shouldPreloadTransactionFormOptions({ new: 'transaction', type: 'TRANSFER', source_account_id: 'account-1' })).toBe(true)
})
