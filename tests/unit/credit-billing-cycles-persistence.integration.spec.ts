import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import * as ts from 'typescript'
import { NextRequest } from 'next/server'

type Row = Record<string, any>
type Database = { credits: Row[]; billing_cycles: Row[]; transactions: Row[] }
type QueryLog = { table: keyof Database; operation: string; filters: Array<[string, unknown]>; payload?: Row[]; options?: unknown }

const nodeRequire = createRequire(__filename)
const Module = nodeRequire('node:module') as typeof import('node:module') & {
  _resolveFilename: (...args: any[]) => string
  _extensions: Record<string, (module: NodeModule, filename: string) => void>
}
const originalResolveFilename = Module._resolveFilename
const originalTsExtension = Module._extensions['.ts']!
Module._extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  ;(module as NodeModule & { _compile(code: string, filename: string): void })._compile(output, filename)
}
Module._resolveFilename = function (request, parent, isMain, options) {
  const resolved = request.startsWith('@/') ? join(process.cwd(), request.slice(2)) : request
  return originalResolveFilename.call(this, resolved, parent, isMain, options)
}

const ownerId = 'owner-a'
const creditId = 'credit-card-a'
const existingCycleId = '11111111-1111-4111-8111-111111111111'
const secondExistingCycleId = '22222222-2222-4222-8222-222222222222'
const foreignCycleId = '33333333-3333-4333-8333-333333333333'
let database: Database
let queryLog: QueryLog[]
let upsertFailure = false
let upsertFailureAfterRows: number | null = null

function attachedCycle() {
  return {
    id: existingCycleId,
    credit_id: creditId,
    billing_month: 10,
    billing_year: 2026,
    consumption_from: '2026-10-01',
    consumption_to: '2026-10-31',
    payment_date: '2026-11-10',
    total_to_pay: 425.5,
    notes: 'Notas preservadas',
    statement_url: 'credits/card-a/cycles/october.pdf',
  }
}

function createDatabase() {
  return {
    credits: [
      { id: creditId, user_id: ownerId, credit_type: 'CREDIT_CARD', account_id: null },
      { id: 'credit-card-b', user_id: 'owner-b', credit_type: 'CREDIT_CARD', account_id: null },
    ],
    billing_cycles: [attachedCycle(), {
      id: foreignCycleId,
      credit_id: 'credit-card-b', billing_month: 12, billing_year: 2026,
      consumption_from: '2026-12-01', consumption_to: '2026-12-31', payment_date: '2027-01-10',
      total_to_pay: 900, notes: null, statement_url: null,
    }],
    transactions: [] as Row[],
  }
}

function matches(
  row: Row,
  query: QueryLog,
  isFilters: Array<[string, unknown]>,
  inFilters: Array<[string, unknown[]]>,
  dateFilters: Array<[string, string]>,
  accountFilter: string | null,
) {
  return query.filters.every(([column, value]) => row[column] === value)
    && isFilters.every(([column, value]) => row[column] === value)
    && inFilters.every(([column, values]) => values.includes(row[column]))
    && dateFilters.every(([operator, value]) => operator === 'gte'
      ? String(row.transaction_date ?? '') >= value
      : String(row.transaction_date ?? '') <= value)
    && (!accountFilter || row.source_account_id === accountFilter || row.destination_account_id === accountFilter)
}

function createMockClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: ownerId } } }) },
    from(table: keyof Database) {
      const query: QueryLog = { table, operation: 'select', filters: [] }
      queryLog.push(query)
      const isFilters: Array<[string, unknown]> = []
      const inFilters: Array<[string, unknown[]]> = []
      const dateFilters: Array<[string, string]> = []
      let accountFilter: string | null = null
      let range: [number, number] | null = null
      let returnRows = false
      let mutationRows: Row[] | null = null
      const builder: any = {
        select: () => { returnRows = true; return builder },
        eq: (column: string, value: unknown) => { query.filters.push([column, value]); return builder },
        is: (column: string, value: unknown) => { isFilters.push([column, value]); return builder },
        in: (column: string, values: unknown[]) => { inFilters.push([column, values]); return builder },
        gte: (column: string, value: string) => { dateFilters.push(['gte', value]); return builder },
        lte: (column: string, value: string) => { dateFilters.push(['lte', value]); return builder },
        or: (value: string) => {
          accountFilter = /source_account_id\.eq\.([^,]+),destination_account_id\.eq\.([^,]+)/.exec(value)?.[1] ?? null
          return builder
        },
        order: () => builder,
        range: async (from: number, to: number) => {
          range = [from, to]
          return execute()
        },
        maybeSingle: async () => {
          const result = execute()
          return { data: (result.data ?? [])[0] ?? null, error: result.error }
        },
        single: async () => {
          const result = execute()
          return { data: (result.data ?? [])[0] ?? null, error: result.error }
        },
        upsert: (rows: Row[], options: unknown) => { query.operation = 'upsert'; query.payload = rows; query.options = options; return builder },
        delete: () => { query.operation = 'delete'; return builder },
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
      }
      function execute() {
        const rows = database[table]
        if (query.operation === 'upsert') {
          if (upsertFailure) return { data: null, error: new Error('synthetic upsert failure') }
          const payload = query.payload ?? []
          const options = query.options as { defaultToNull?: boolean } | undefined
          const defaultToNull = options?.defaultToNull ?? true
          const columns = [...new Set(payload.flatMap(incoming => Object.keys(incoming)))]
          const defaultFor = (column: string) => column === 'total_to_pay' ? 0 : null
          // postgrest-js builds one columns set for this bulk request.
          // Missing keys resolve to null or DEFAULT according to Prefer, and
          // merge-duplicates writes EXCLUDED values on conflicts. Do not
          // spread the existing row to simulate preservation.
          const normalizedPayload = payload.map(incoming => Object.fromEntries(columns.map(column => [
            column,
            Object.hasOwn(incoming, column) ? incoming[column] : defaultToNull ? null : defaultFor(column),
          ])))
          const stagedRows = structuredClone(rows)
          const stagedMutations: Row[] = []
          for (const incoming of normalizedPayload) {
            const index = stagedRows.findIndex(row => row.id === incoming.id)
            if (index >= 0) {
              if (stagedRows[index]?.credit_id !== incoming.credit_id) return { data: null, error: new Error('cross-credit upsert rejected') }
              stagedRows[index] = { ...stagedRows[index], ...incoming }
              stagedMutations.push(stagedRows[index]!)
            } else {
              const duplicate = stagedRows.some(row => row.credit_id === incoming.credit_id
                && row.billing_month === incoming.billing_month
                && row.billing_year === incoming.billing_year)
              if (duplicate) return { data: null, error: new Error('duplicate billing period') }
              const created = { ...incoming }
              stagedRows.push(created)
              stagedMutations.push(created)
            }
            if (upsertFailureAfterRows === stagedMutations.length) {
              return { data: null, error: new Error('synthetic mid-statement upsert failure') }
            }
          }
          // PostgREST executes this bulk upsert as one SQL statement.
          database[table] = stagedRows
          mutationRows = stagedMutations
        } else if (query.operation === 'delete') {
          const selected = rows.filter(row => matches(row, query, isFilters, inFilters, dateFilters, accountFilter))
          mutationRows = selected
          const ids = new Set(selected.map(row => row.id))
          database[table] = rows.filter(row => !ids.has(row.id))
        }
        let selected = mutationRows ?? database[table].filter(row => matches(row, query, isFilters, inFilters, dateFilters, accountFilter))
        if (range) selected = selected.slice(range[0], range[1] + 1)
        return { data: returnRows || query.operation === 'select' ? selected : null, error: null }
      }
      return builder
    },
  }
}

const supabasePath = nodeRequire.resolve(join(process.cwd(), 'lib/supabase.server.ts'))
const originalSupabaseModule = nodeRequire.cache[supabasePath]
nodeRequire.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  children: [],
  paths: [],
  exports: { createClient: async () => createMockClient() },
} as unknown as NodeModule

const routePath = nodeRequire.resolve(join(process.cwd(), 'app/api/credits/[id]/billing-cycles/route.ts'))
delete nodeRequire.cache[routePath]
const route = nodeRequire(routePath) as { PUT: (request: NextRequest, props: { params: Promise<{ id: string }> }) => Promise<Response> }

function cycle(month: number, options: Partial<Row> = {}) {
  const monthString = String(month).padStart(2, '0')
  const endDate = `2026-${monthString}-${new Date(Date.UTC(2026, month, 0)).getUTCDate()}`
  return {
    billing_month: month,
    billing_year: 2026,
    consumption_from: `2026-${monthString}-01`,
    consumption_to: endDate,
    payment_date: month === 12 ? '2027-01-10' : `2026-${String(month + 1).padStart(2, '0')}-10`,
    total_to_pay: 0,
    ...options,
  }
}

async function putCycles(cycles: Row[]) {
  return route.PUT(new NextRequest(`http://localhost/api/credits/${creditId}/billing-cycles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cycles }),
  }), { params: Promise.resolve({ id: creditId }) })
}

test.beforeEach(() => {
  database = createDatabase()
  queryLog = []
  upsertFailure = false
  upsertFailureAfterRows = null
})

test('PUT adds a new period while preserving the existing cycle id, attachment, amount, notes, and other user data', async () => {
  const before = structuredClone(database.billing_cycles[0])
  const response = await putCycles([
    cycle(10, { id: existingCycleId }),
    cycle(11),
  ])

  expect(response.status).toBe(200)
  const body = await response.json() as { ok: boolean; data: Row[] }
  expect(body.ok).toBe(true)
  expect(database.billing_cycles.find(row => row.id === existingCycleId)).toEqual(before)
  const created = database.billing_cycles.find(row => row.credit_id === creditId && row.billing_month === 11)
  expect(created).toMatchObject({ billing_month: 11, billing_year: 2026, consumption_from: '2026-11-01', consumption_to: '2026-11-30', total_to_pay: 0 })
  expect(created?.id).toBeTruthy()
  expect(database.billing_cycles.find(row => row.credit_id === 'credit-card-b')).toMatchObject({ total_to_pay: 900 })
  expect(queryLog.filter(query => query.operation === 'upsert')).toHaveLength(1)
  expect(queryLog.some(query => query.operation === 'delete')).toBe(false)
  const upsert = queryLog.find(query => query.operation === 'upsert')
  expect(upsert?.options).toMatchObject({ onConflict: 'id', defaultToNull: false })
  expect(upsert?.payload).toHaveLength(1)
  expect(upsert?.payload?.every(row => Object.hasOwn(row, 'statement_url')
    && Object.hasOwn(row, 'total_to_pay') && Object.hasOwn(row, 'notes'))).toBe(true)
})

test('editing an existing cycle and adding another preserves history and attached-cycle references in the same save', async () => {
  database.billing_cycles.push({
    id: secondExistingCycleId, credit_id: creditId, billing_month: 9, billing_year: 2026,
    consumption_from: '2026-09-01', consumption_to: '2026-09-30', payment_date: '2026-10-10',
    total_to_pay: 88.25, notes: 'Nota del ciclo anterior', statement_url: null,
  })
  const attachedBefore = structuredClone(database.billing_cycles.find(row => row.id === existingCycleId))
  const editedBefore = structuredClone(database.billing_cycles.find(row => row.id === secondExistingCycleId))
  const response = await putCycles([
    cycle(10, { id: existingCycleId }),
    cycle(9, { id: secondExistingCycleId, payment_date: '2026-10-12' }),
    cycle(11),
  ])

  expect(response.status).toBe(200)
  expect(database.billing_cycles.find(row => row.id === existingCycleId)).toEqual(attachedBefore)
  expect(database.billing_cycles.find(row => row.id === secondExistingCycleId)).toEqual({
    ...editedBefore,
    payment_date: '2026-10-12',
  })
  expect(database.billing_cycles.find(row => row.credit_id === creditId && row.billing_month === 11)).toMatchObject({
    total_to_pay: 0, statement_url: null, notes: null,
  })
  const upsert = queryLog.find(query => query.operation === 'upsert')
  expect(upsert?.payload).toHaveLength(2)
  expect(upsert?.payload?.map(row => Object.keys(row).sort())[0])
    .toEqual(upsert?.payload?.map(row => Object.keys(row).sort())[1])
})

test('a failed bulk upsert leaves every persisted cycle unchanged', async () => {
  const before = structuredClone(database.billing_cycles)
  upsertFailure = true
  const response = await putCycles([cycle(10, { id: existingCycleId }), cycle(11)])

  expect(response.status).toBe(500)
  expect(database.billing_cycles).toEqual(before)
  expect(queryLog.some(query => query.operation === 'delete')).toBe(false)
})

test('a persistence failure after staging one row leaves the entire batch unchanged', async () => {
  database.billing_cycles[0]!.statement_url = null
  const before = structuredClone(database.billing_cycles)
  upsertFailureAfterRows = 1
  const response = await putCycles([
    cycle(10, { id: existingCycleId, payment_date: '2026-11-12' }),
    cycle(11),
  ])

  expect(response.status).toBe(500)
  expect(database.billing_cycles).toEqual(before)
  expect(queryLog.filter(query => query.operation === 'upsert')).toHaveLength(1)
})

test('unknown persisted ids are rejected without creating or editing any cycle', async () => {
  const before = structuredClone(database.billing_cycles)
  const response = await putCycles([
    cycle(10, { id: existingCycleId }),
    cycle(11, { id: '44444444-4444-4444-8444-444444444444' }),
  ])

  expect(response.status).toBe(404)
  expect(database.billing_cycles).toEqual(before)
  expect(queryLog.some(query => query.operation === 'upsert' || query.operation === 'delete')).toBe(false)
})

test('an id belonging to another card is rejected without changing or exposing that cycle', async () => {
  const before = structuredClone(database.billing_cycles)
  const response = await putCycles([
    cycle(10, { id: existingCycleId }),
    cycle(11, { id: foreignCycleId }),
  ])

  expect(response.status).toBe(404)
  expect(database.billing_cycles).toEqual(before)
  expect(queryLog.some(query => query.operation === 'upsert' || query.operation === 'delete')).toBe(false)
})

test('a safe schedule edit updates the existing cycle without changing its id or financial metadata', async () => {
  database.billing_cycles[0]!.statement_url = null
  const before = structuredClone(database.billing_cycles[0])
  const response = await putCycles([cycle(10, { id: existingCycleId, payment_date: '2026-11-12' })])

  expect(response.status).toBe(200)
  expect(database.billing_cycles.find(row => row.id === existingCycleId)).toMatchObject({
    ...before,
    payment_date: '2026-11-12',
    id: existingCycleId,
    total_to_pay: 425.5,
    notes: 'Notas preservadas',
    statement_url: null,
  })
  expect(queryLog.filter(query => query.operation === 'upsert')).toHaveLength(1)
})

test('cycles with a statement cannot be removed through the bulk editor', async () => {
  const before = structuredClone(database.billing_cycles)
  const response = await putCycles([])

  expect(response.status).toBe(422)
  expect(database.billing_cycles).toEqual(before)
})

test('cycles related to movements remain protected from deletion', async () => {
  database.credits[0]!.account_id = 'account-card-a'
  database.billing_cycles[0]!.statement_url = null
  database.transactions = [{
    id: 'movement-a', user_id: ownerId, type: 'EXPENSE', source_account_id: 'account-card-a',
    destination_account_id: null, transaction_date: '2026-10-15',
  }]
  const before = structuredClone(database.billing_cycles)
  const response = await putCycles([])

  expect(response.status).toBe(422)
  expect(database.billing_cycles).toEqual(before)
})

test('safe single-cycle deletion is account-scoped and leaves another user cycle intact', async () => {
  database.billing_cycles[0]!.statement_url = null
  const response = await putCycles([])

  expect(response.status).toBe(200)
  expect(database.billing_cycles.some(row => row.id === existingCycleId)).toBe(false)
  expect(database.billing_cycles.find(row => row.credit_id === 'credit-card-b')).toMatchObject({
    id: '33333333-3333-4333-8333-333333333333',
    total_to_pay: 900,
  })
})

test('a delete cannot be mixed with cycle additions in a request that must remain all-or-none', async () => {
  database.billing_cycles[0]!.statement_url = null
  const before = structuredClone(database.billing_cycles)
  const response = await putCycles([cycle(11)])

  expect(response.status).toBe(422)
  expect(database.billing_cycles).toEqual(before)
  expect(queryLog.some(query => query.operation === 'upsert' || query.operation === 'delete')).toBe(false)
})

test('multiple cycle deletions are rejected before any row is removed', async () => {
  database.billing_cycles[0]!.statement_url = null
  database.billing_cycles.push({
    id: secondExistingCycleId,
    credit_id: creditId,
    billing_month: 11,
    billing_year: 2026,
    consumption_from: '2026-11-01',
    consumption_to: '2026-11-30',
    payment_date: '2026-12-10',
    total_to_pay: 0,
    notes: null,
    statement_url: null,
  })
  const before = structuredClone(database.billing_cycles)
  const response = await putCycles([])

  expect(response.status).toBe(422)
  expect(database.billing_cycles).toEqual(before)
  expect(queryLog.some(query => query.operation === 'delete')).toBe(false)
})

test('movement verification paginates before allowing a cycle range change', async () => {
  database.credits[0]!.account_id = 'account-card-a'
  database.billing_cycles[0]!.statement_url = null
  database.billing_cycles[0]!.billing_month = 1
  database.billing_cycles[0]!.consumption_from = '2026-01-01'
  database.billing_cycles[0]!.consumption_to = '2026-01-31'
  database.billing_cycles[0]!.payment_date = '2026-02-10'
  database.transactions = Array.from({ length: 500 }, (_, index) => ({
    id: `unrelated-${index}`,
    user_id: ownerId,
    type: 'EXPENSE',
    source_account_id: 'account-card-a',
    destination_account_id: null,
    transaction_date: `2026-${String(Math.floor(index / 50) + 2).padStart(2, '0')}-${String(index % 28 + 1).padStart(2, '0')}`,
  }))
  database.transactions.push({
    id: 'movement-on-second-page', user_id: ownerId, type: 'EXPENSE',
    source_account_id: 'account-card-a', destination_account_id: null, transaction_date: '2026-12-10',
  })
  const before = structuredClone(database.billing_cycles)
  const response = await putCycles([cycle(12, {
    id: existingCycleId,
    consumption_from: '2026-12-01',
    consumption_to: '2026-12-31',
    payment_date: '2027-01-10',
  })])

  expect(response.status).toBe(422)
  expect(database.billing_cycles).toEqual(before)
  expect(queryLog.filter(query => query.table === 'transactions').map(query => query.filters.find(([column]) => column === 'user_id'))).toEqual([
    ['user_id', ownerId],
    ['user_id', ownerId],
  ])
})

test.afterAll(() => {
  if (originalSupabaseModule) nodeRequire.cache[supabasePath] = originalSupabaseModule
  else delete nodeRequire.cache[supabasePath]
  delete nodeRequire.cache[routePath]
  Module._resolveFilename = originalResolveFilename
  Module._extensions['.ts'] = originalTsExtension
})
