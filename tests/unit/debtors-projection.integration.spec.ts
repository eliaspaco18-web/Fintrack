import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import * as ts from 'typescript'
import { NextRequest } from 'next/server'

type Row = Record<string, any>
type Fixture = { debtors: Row[]; accounts_receivable: Row[]; transactions: Row[] }
type QueryLog = { table: string; filters: Array<[string, string, unknown]>; ranges: Array<[number, number]> }

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

let fixture: Fixture = { debtors: [], accounts_receivable: [], transactions: [] }
let queryLog: QueryLog[] = []
const createClientPath = nodeRequire.resolve(join(process.cwd(), 'lib/supabase.server.ts'))
const originalCreateClient = nodeRequire.cache[createClientPath]
nodeRequire.cache[createClientPath] = {
  id: createClientPath,
  filename: createClientPath,
  loaded: true,
  children: [],
  paths: [],
  exports: {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'owner-a' } } }) },
      from(table: keyof Fixture) {
        const log: QueryLog = { table, filters: [], ranges: [] }
        queryLog.push(log)
        const builder: any = {
          select: () => builder,
          eq: (column: string, value: unknown) => { log.filters.push(['eq', column, value]); return builder },
          not: (column: string, operator: string, value: unknown) => { log.filters.push(['not', `${column}:${operator}`, value]); return builder },
          order: () => builder,
          range: async (from: number, to: number) => {
            log.ranges.push([from, to])
            const rows = fixture[table].filter(row => log.filters.every(([kind, column, value]) => {
              if (kind === 'eq') return row[column] === value
              if (column === 'debtor_id:is') return value === null ? row.debtor_id !== null && row.debtor_id !== undefined : row.debtor_id !== value
              return true
            }))
            return { data: rows.slice(from, to + 1), error: null }
          },
        }
        return builder
      },
    }),
  },
} as unknown as NodeModule

const routePath = nodeRequire.resolve(join(process.cwd(), 'app/api/debtors/route.ts'))
delete nodeRequire.cache[routePath]
const route = nodeRequire(routePath) as { GET: (request: NextRequest) => Promise<Response> }

function debtor(id: string, name: string, user_id = 'owner-a') {
  return { id, name, relationship: null, initial_debt: 0, is_active: true, created_at: '2025-01-01', user_id }
}

function document(id: string, debtor_id: string | null, debtor_name: string, options: Partial<Row> = {}, user_id = 'owner-a') {
  return {
    id, transaction_id: null, debtor_id, debtor_name, amount: 10, collected_amount: 0,
    currency: 'PEN', status: 'PENDING', user_id, ...options,
  }
}

async function getDebtors() {
  const response = await route.GET(new NextRequest('http://localhost/api/debtors'))
  return { response, body: await response.json() as { ok: boolean; data: Row[]; coverage?: Row } }
}

test('debtors projection handles collected plus pending, ambiguous names, >1k pages, and user isolation', async () => {
  try {
    fixture = {
      debtors: [debtor('debtor-a', 'Lucía Núñez'), debtor('debtor-b', 'Alex Rivera'), debtor('debtor-c', ' Alex Rivera ', 'owner-a'), debtor('other-user-debtor', 'Privado', 'owner-b')],
      accounts_receivable: [
        document('collected', 'debtor-a', 'Lucía Núñez', { transaction_id: 'txn-collected', amount: 100, collected_amount: 100, status: 'COLLECTED' }),
        document('ambiguous-orphan', null, 'ALEX RIVERA', { transaction_id: null, amount: 500 }),
        document('other-user-doc', 'other-user-debtor', 'Privado', { amount: 999 }, 'owner-b'),
      ],
      transactions: [
        { id: 'txn-collected', debtor_id: 'debtor-a', type: 'EXPENSE', description: 'Préstamo cobrado', amount: 100, currency: 'PEN', transaction_date: '2026-10-01', notes: null, user_id: 'owner-a' },
        { id: 'txn-pending', debtor_id: 'debtor-a', type: 'EXPENSE', description: 'Préstamo heredado', amount: 75, currency: 'USD', transaction_date: '2026-10-02', notes: null, user_id: 'owner-a' },
        { id: 'txn-other-user', debtor_id: 'other-user-debtor', type: 'EXPENSE', description: 'Privado', amount: 1_000, currency: 'PEN', transaction_date: '2026-10-02', notes: null, user_id: 'owner-b' },
      ],
    }
    queryLog = []
    let result = await getDebtors()
    expect(result.response.status).toBe(200)
    const lucia = result.body.data.find(row => row.id === 'debtor-a')!
    expect(lucia).toMatchObject({ effective_state: 'OPEN', all_collected: false, count_pending: 1, pending_amount: 75 })
    expect(lucia.currency_summaries).toEqual(expect.arrayContaining([
      expect.objectContaining({ currency: 'PEN', total: 100, settled: 100, pending: 0 }),
      expect.objectContaining({ currency: 'USD', total: 75, settled: 0, pending: 75 }),
    ]))
    expect(result.body.data.find(row => row.id === 'debtor-b')?.effective_state).toBe('UNVERIFIED')
    expect(result.body.data.find(row => row.id === 'debtor-c')?.effective_state).toBe('UNVERIFIED')
    expect(result.body.coverage?.ambiguous_legacy_documents).toBe(1)
    expect(result.body.data.some(row => row.id === 'other-user-debtor')).toBe(false)

    fixture = {
      debtors: [debtor('debtor-a', 'Lucía Núñez')],
      accounts_receivable: Array.from({ length: 1_005 }, (_, index) => document(`doc-${String(index).padStart(4, '0')}`, 'debtor-a', 'Lucía Núñez', { amount: 2 })),
      transactions: [],
    }
    queryLog = []
    result = await getDebtors()
    expect(result.response.status).toBe(200)
    expect(result.body.data[0]).toMatchObject({ receivables_count: 1_005, count_pending: 1_005, pending_amount: 2_010 })
    const docReads = queryLog.filter(item => item.table === 'accounts_receivable')
    expect(docReads.flatMap(item => item.ranges)).toEqual([[0, 499], [500, 999], [1_000, 1_499]])
    expect(docReads.every(item => item.filters.some(([kind, column, value]) => kind === 'eq' && column === 'user_id' && value === 'owner-a'))).toBe(true)
  } finally {
    if (originalCreateClient) nodeRequire.cache[createClientPath] = originalCreateClient
    else delete nodeRequire.cache[createClientPath]
    Module._resolveFilename = originalResolveFilename
    Module._extensions['.ts'] = originalTsExtension
  }
})
