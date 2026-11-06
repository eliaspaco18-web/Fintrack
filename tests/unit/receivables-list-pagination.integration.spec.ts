import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import * as ts from 'typescript'
import { NextRequest } from 'next/server'

type Row = Record<string, any>
type QueryLog = { filters: Array<[string, unknown]>; orders: Array<[string, boolean]>; ranges: Array<[number, number]> }

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

let rows: Row[] = []
let queryLog: QueryLog[] = []
let failAtRange: number | null = null
const supabasePath = nodeRequire.resolve(join(process.cwd(), 'lib/supabase.server.ts'))
const originalSupabaseModule = nodeRequire.cache[supabasePath]
nodeRequire.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  children: [],
  paths: [],
  exports: {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'owner-a' } } }) },
      from(table: string) {
        const log: QueryLog = { filters: [], orders: [], ranges: [] }
        queryLog.push(log)
        const builder: any = {
          select: () => builder,
          eq: (column: string, value: unknown) => { log.filters.push([column, value]); return builder },
          order: (column: string, options: { ascending: boolean }) => { log.orders.push([column, options.ascending]); return builder },
          range: async (from: number, to: number) => {
            log.ranges.push([from, to])
            if (from === failAtRange) return { data: null, error: new Error('synthetic page failure') }
            if (table !== 'accounts_receivable') return { data: [], error: null }
            let selected = rows.filter(row => log.filters.every(([column, value]) => row[column] === value))
            for (const [column, ascending] of [...log.orders].reverse()) {
              selected = selected.sort((left, right) => {
                const comparison = String(left[column] ?? '').localeCompare(String(right[column] ?? ''), undefined, { numeric: true })
                return ascending ? comparison : -comparison
              })
            }
            return { data: selected.slice(from, to + 1), error: null }
          },
        }
        return builder
      },
    }),
  },
} as unknown as NodeModule

const transactionServicePath = nodeRequire.resolve(join(process.cwd(), 'modules/transactions/transaction.service.ts'))
const originalTransactionServiceModule = nodeRequire.cache[transactionServicePath]
nodeRequire.cache[transactionServicePath] = {
  id: transactionServicePath,
  filename: transactionServicePath,
  loaded: true,
  children: [],
  paths: [],
  exports: { TransactionService: class TransactionService {} },
} as unknown as NodeModule

const routePath = nodeRequire.resolve(join(process.cwd(), 'app/api/receivables/route.ts'))
delete nodeRequire.cache[routePath]
const route = nodeRequire(routePath) as { GET: (request: NextRequest) => Promise<Response> }

function fixtureDocument(index: number, userId = 'owner-a') {
  return {
    id: `receivable-${String(index).padStart(4, '0')}`,
    user_id: userId,
    debtor_id: `debtor-${index % 4}`,
    debtor_name: `Deudor ficticio ${index % 4}`,
    concept: `Documento ficticio ${index}`,
    amount: index + 10,
    collected_amount: index % 2 ? 5 : 0,
    currency: index % 2 ? 'USD' : 'PEN',
    issue_date: `${2024 + index % 3}-${String(index % 12 + 1).padStart(2, '0')}-10`,
    due_date: `${2025 + index % 2}-${String(index % 12 + 1).padStart(2, '0')}-20`,
    status: index % 2 ? 'PARTIAL' : 'PENDING',
  }
}

test('general receivables GET returns every user document across PostgREST pages and fails closed on a later-page error', async () => {
  try {
    rows = [
      ...Array.from({ length: 1_205 }, (_, index) => fixtureDocument(index)),
      fixtureDocument(1_206, 'owner-b'),
    ]
    queryLog = []
    failAtRange = null

    const response = await route.GET(new NextRequest('http://localhost/api/receivables'))
    expect(response.status).toBe(200)
    const body = await response.json() as { ok: boolean; data: Row[] }
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(1_205)
    expect(new Set(body.data.map(row => row.issue_date.slice(0, 4))).size).toBe(3)
    expect(body.data.filter(row => row.status === 'PARTIAL' && row.collected_amount > 0)).toHaveLength(602)
    expect(body.data.find(row => row.id === 'receivable-0000')).toMatchObject({ currency: 'PEN', collected_amount: 0, status: 'PENDING' })
    expect(body.data.find(row => row.id === 'receivable-1203')).toMatchObject({ currency: 'USD', collected_amount: 5, status: 'PARTIAL' })
    expect(body.data.some(row => row.id === 'receivable-1206')).toBe(false)
    expect(queryLog.flatMap(query => query.ranges)).toEqual([[0, 499], [500, 999], [1_000, 1_499]])
    expect(queryLog.every(query => query.filters.length > 0)).toBe(true)
    expect(queryLog.every(query => query.filters.some(([column, value]) => column === 'user_id' && value === 'owner-a'))).toBe(true)
    expect(queryLog.every(query => query.orders.some(([column]) => column === 'amount')
      && query.orders.some(([column]) => column === 'id'))).toBe(true)

    queryLog = []
    failAtRange = 500
    const incomplete = await route.GET(new NextRequest('http://localhost/api/receivables'))
    expect(incomplete.status).toBe(500)
    expect(await incomplete.json()).toMatchObject({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'No se pudo cargar la lista completa de cuentas por cobrar. Intenta actualizarla nuevamente.' },
    })
    expect(queryLog.flatMap(query => query.ranges)).toEqual([[0, 499], [500, 999]])
  } finally {
    if (originalSupabaseModule) nodeRequire.cache[supabasePath] = originalSupabaseModule
    else delete nodeRequire.cache[supabasePath]
    if (originalTransactionServiceModule) nodeRequire.cache[transactionServicePath] = originalTransactionServiceModule
    else delete nodeRequire.cache[transactionServicePath]
    delete nodeRequire.cache[routePath]
    Module._resolveFilename = originalResolveFilename
    Module._extensions['.ts'] = originalTsExtension
  }
})
