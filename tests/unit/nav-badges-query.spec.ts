import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { getNavBadgesFromClient, type BadgeQueryObservation } from '@/lib/server/nav-badges'

type Result = { count: number | null; error: { message: string } | null }
type QueryFixture = {
  result?: Result
  delayMs?: number
  waitForAbort?: boolean
}

class CountQuery implements PromiseLike<Result> {
  filters: Array<[string, unknown]> = []
  selection = ''
  countOptions: { count?: string; head?: boolean } | undefined
  signal: AbortSignal | undefined

  constructor(readonly table: string, private readonly fixture: QueryFixture) {}

  select(selection: string, options?: { count?: string; head?: boolean }) {
    this.selection = selection
    this.countOptions = options
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value])
    return this
  }

  lt(column: string, value: unknown) {
    this.filters.push([column, value])
    return this
  }

  abortSignal(signal: AbortSignal) {
    this.signal = signal
    return this
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const result = this.fixture.result ?? { count: 0, error: null }
    const request = new Promise<Result>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId)
        this.signal?.removeEventListener('abort', onAbort)
      }
      const onAbort = () => {
        cleanup()
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      }

      if (this.signal?.aborted) {
        onAbort()
        return
      }
      this.signal?.addEventListener('abort', onAbort, { once: true })

      if (this.fixture.waitForAbort) return
      if (this.fixture.delayMs) {
        timeoutId = setTimeout(() => {
          cleanup()
          resolve(result)
        }, this.fixture.delayMs)
      } else {
        cleanup()
        resolve(result)
      }
    })

    return request.then(onfulfilled ?? undefined, onrejected ?? undefined)
  }
}

class CountClient {
  queries: CountQuery[] = []
  constructor(private readonly fixtures: Record<string, QueryFixture> = {}) {}

  from(table: string) {
    const query = new CountQuery(table, this.fixtures[table] ?? {})
    this.queries.push(query)
    return query
  }
}

function asClient(client: CountClient) {
  return client as unknown as SupabaseClient<Database>
}

test('all three verified counts preserve their filters, exact semantics, and one request each', async () => {
  const client = new CountClient({
    installments: { result: { count: 2, error: null } },
    accounts_receivable: { result: { count: 1, error: null } },
    accounts_payable: { result: { count: 3, error: null } },
  })
  const observations: BadgeQueryObservation[] = []

  const badges = await getNavBadgesFromClient(asClient(client), 'user-a', {
    onQueryObservation: observation => observations.push(observation),
  })

  expect(badges).toEqual({ credits: 2, receivables: 1, payables: 3, alerts: 6 })
  expect(client.queries.map(query => query.table).sort()).toEqual([
    'accounts_payable', 'accounts_receivable', 'installments',
  ])
  expect(client.queries).toHaveLength(3)

  const installmentQuery = client.queries.find(query => query.table === 'installments')!
  expect(installmentQuery.selection).toContain('loan:loans!inner(user_id)')
  expect(installmentQuery.filters).toContainEqual(['loan.user_id', 'user-a'])
  expect(installmentQuery.filters).toContainEqual(['status', 'OVERDUE'])
  expect(installmentQuery.filters).not.toContainEqual(['user_id', 'user-a'])

  for (const query of client.queries.filter(query => query.table !== 'installments')) {
    expect(query.countOptions).toEqual({ count: 'exact', head: true })
    expect(query.filters).toContainEqual(['user_id', 'user-a'])
    expect(query.filters).toContainEqual(['status', 'PENDING'])
    expect(query.filters.some(([column]) => column === 'due_date')).toBe(true)
  }
  expect(client.queries.every(query => query.signal instanceof AbortSignal)).toBe(true)
  expect(observations).toHaveLength(3)
  expect(observations.every(observation => observation.outcome === 'verified')).toBe(true)
})

test('a query timeout is attributed without exposing user or financial values and cancels siblings', async () => {
  const client = new CountClient({
    installments: { waitForAbort: true },
    accounts_receivable: { waitForAbort: true },
    accounts_payable: { waitForAbort: true },
  })
  const observations: BadgeQueryObservation[] = []

  await expect(getNavBadgesFromClient(asClient(client), 'user-private', {
    timeoutMs: 15,
    onQueryObservation: observation => observations.push(observation),
  })).rejects.toThrow(/Could not verify/)

  expect(client.queries).toHaveLength(3)
  expect(client.queries.every(query => query.signal?.aborted)).toBe(true)
  expect(observations.some(observation => observation.outcome === 'timeout')).toBe(true)
  expect(observations.every(observation => !JSON.stringify(observation).includes('user-private'))).toBe(true)
  expect(observations.map(observation => observation.query).sort()).toEqual([
    'overdue_installments', 'payables', 'receivables',
  ])
})

test('Supabase errors and null exact counts fail closed instead of producing zero badges', async () => {
  const dbError = new CountClient({
    installments: { result: { count: null, error: { message: 'sensitive database detail' } } },
  })
  const errorObservations: BadgeQueryObservation[] = []
  const thrown = await getNavBadgesFromClient(asClient(dbError), 'user-a', {
    onQueryObservation: observation => errorObservations.push(observation),
  }).catch(error => error as Error)

  expect(thrown.message).toContain('overdue_installments')
  expect(thrown.message).not.toContain('sensitive database detail')
  expect(errorObservations.find(observation => observation.query === 'overdue_installments')?.outcome)
    .toBe('supabase_error')

  const nullCount = new CountClient({
    installments: { result: { count: 0, error: null } },
    accounts_receivable: { result: { count: null, error: null } },
    accounts_payable: { result: { count: 0, error: null } },
  })
  const nullObservations: BadgeQueryObservation[] = []
  await expect(getNavBadgesFromClient(asClient(nullCount), 'user-a', {
    onQueryObservation: observation => nullObservations.push(observation),
  })).rejects.toThrow('Could not verify receivables navigation count')
  expect(nullObservations.find(observation => observation.query === 'receivables')?.outcome)
    .toBe('unverified_count')
})

test('temporary failures can recover on a fresh verified read without carrying another user’s counts', async () => {
  const failed = new CountClient({
    accounts_payable: { result: { count: null, error: { message: 'temporary failure' } } },
  })
  await expect(getNavBadgesFromClient(asClient(failed), 'user-a')).rejects.toThrow()

  const recovered = new CountClient({
    installments: { result: { count: 0, error: null } },
    accounts_receivable: { result: { count: 4, error: null } },
    accounts_payable: { result: { count: 1, error: null } },
  })
  const badges = await getNavBadgesFromClient(asClient(recovered), 'user-b')

  expect(badges).toEqual({ credits: undefined, receivables: 4, payables: 1, alerts: 5 })
  expect(recovered.queries).toHaveLength(3)
  expect(recovered.queries.every(query => query.filters.some(([, value]) => value === 'user-b'))).toBe(true)
  expect(recovered.queries.every(query => !query.filters.some(([, value]) => value === 'user-a'))).toBe(true)
})
