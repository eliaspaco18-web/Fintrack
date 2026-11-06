import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { getNavBadgesFromClient } from '@/lib/server/nav-badges'

type Result = { count: number | null; error: { message: string } | null }

class CountQuery implements PromiseLike<Result> {
  filters: Array<[string, unknown]> = []
  selection = ''
  constructor(readonly table: string, private readonly results: Record<string, Result>) {}
  select(selection: string) { this.selection = selection; return this }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this }
  lt(column: string, value: unknown) { this.filters.push([column, value]); return this }
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.results[this.table] ?? { count: 0, error: null })
      .then(onfulfilled ?? undefined, onrejected ?? undefined)
  }
}

class CountClient {
  queries: CountQuery[] = []
  constructor(private readonly results: Record<string, Result>) {}
  from(table: string) {
    const query = new CountQuery(table, this.results)
    this.queries.push(query)
    return query
  }
}

function asClient(client: CountClient) {
  return client as unknown as SupabaseClient<Database>
}

test('navigation counts scope overdue installments through the owning loan and preserve verified counts', async () => {
  const client = new CountClient({
    installments: { count: 2, error: null },
    accounts_receivable: { count: 1, error: null },
    accounts_payable: { count: 3, error: null },
  })

  const badges = await getNavBadgesFromClient(asClient(client), 'user-a')

  expect(badges).toEqual({ credits: 2, receivables: 1, payables: 3, alerts: 6 })
  const installmentQuery = client.queries.find(query => query.table === 'installments')!
  expect(installmentQuery.selection).toContain('loan:loans!inner(user_id)')
  expect(installmentQuery.filters).toContainEqual(['loan.user_id', 'user-a'])
  expect(installmentQuery.filters).not.toContainEqual(['user_id', 'user-a'])
  expect(client.queries).toHaveLength(3)
  for (const query of client.queries.filter(query => query.table !== 'installments')) {
    expect(query.filters).toContainEqual(['user_id', 'user-a'])
  }
})

test('navigation count database failures are errors, not zero badges', async () => {
  const client = new CountClient({
    installments: { count: null, error: { message: 'missing relation permission' } },
    accounts_receivable: { count: 0, error: null },
    accounts_payable: { count: 0, error: null },
  })

  await expect(getNavBadgesFromClient(asClient(client), 'user-a'))
    .rejects.toThrow('Could not load overdue installments: missing relation permission')
})

test('navigation does not treat an unverifiable exact count as zero', async () => {
  const client = new CountClient({
    installments: { count: 0, error: null },
    accounts_receivable: { count: null, error: null },
    accounts_payable: { count: 0, error: null },
  })

  await expect(getNavBadgesFromClient(asClient(client), 'user-a'))
    .rejects.toThrow('Could not verify urgent receivables count')
})

test('V2 and V3 shells expose a navigation-count failure instead of silently presenting empty badges', () => {
  for (const path of [
    'components/layout/AppShell.tsx',
    'components/layout/legacy/AppShell.tsx',
  ]) {
    const shell = readFileSync(resolve(process.cwd(), path), 'utf8')
    expect(shell).toContain('error: navBadgesError')
    expect(shell).toContain('No se pudieron verificar los indicadores de navegación')
  }
})
