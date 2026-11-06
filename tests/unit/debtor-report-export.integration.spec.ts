import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import * as ts from 'typescript'
import type { ReceivableHistoryDocument } from '../../modules/receivables/debtor-financial-history'
import { buildDebtorFinancialHistory } from '../../modules/receivables/debtor-financial-history'
import { projectLegacyReceivableLinks } from '../../lib/server/receivable-read-model'

const nodeRequire = createRequire(__filename)
const Module = nodeRequire('node:module') as typeof import('node:module') & { _resolveFilename: (...args: any[]) => string; _extensions: Record<string, (module: NodeModule, filename: string) => void> }
const resolveFilename = Module._resolveFilename
const tsExtension = Module._extensions['.ts']

Module._extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  ;(module as NodeModule & { _compile(code: string, filename: string): void })._compile(output, filename)
}
Module._resolveFilename = function (request, parent, isMain, options) {
  const resolved = request.startsWith('@/') ? join(process.cwd(), request.slice(2)) : request
  return resolveFilename.call(this, resolved, parent, isMain, options)
}

const { readAllPages } = nodeRequire(join(process.cwd(), 'modules/receivables/paged-read.ts')) as typeof import('../../modules/receivables/paged-read')
const { buildDebtorReportPdf } = nodeRequire(join(process.cwd(), 'modules/receivables/debtor-report-pdf.ts')) as typeof import('../../modules/receivables/debtor-report-pdf')

test('debtor report reads every page and fails closed when pagination cannot be completed', async () => {
  const calls: Array<[number, number]> = []
  const rows = await readAllPages(async (from, to) => {
    calls.push([from, to])
    const data = Array.from({ length: Math.max(0, Math.min(to - from + 1, 1000 - from)) }, (_, index) => from + index)
    return { data, error: null }
  }, 400, 5)

  expect(rows).toHaveLength(1000)
  expect(calls).toEqual([[0, 399], [400, 799], [800, 1199]])
  await expect(readAllPages(async () => ({ data: [1, 2], error: null }), 2, 2)).rejects.toThrow('no se generó un reporte parcial')
  await expect(readAllPages(async () => ({ data: null, error: new Error('database') }), 2, 2)).rejects.toThrow('historial completo')
})

test('the full-history model includes uniquely matched legacy records once and never guesses ambiguous names', () => {
  const debtors = [{ id: 'debtor-a', name: 'Ficticia Uno' }, { id: 'debtor-b', name: 'Ficticia Uno' }]
  const documents = [
    { id: 'orphan-unique', transaction_id: null, debtor_id: null, debtor_name: 'Ficticia Uno', amount: 40, collected_amount: 0, currency: 'PEN', status: 'PENDING', issue_date: '2026-01-01', concept: 'No debe asignarse' },
  ]
  const ambiguousProjection = projectLegacyReceivableLinks(debtors, documents, [])
  expect(ambiguousProjection.byDebtor.get('debtor-a')).toEqual([])
  expect(ambiguousProjection.byDebtor.get('debtor-b')).toEqual([])
  expect(ambiguousProjection.coverage.ambiguousDebtorIds.size).toBe(2)

  const uniqueProjection = projectLegacyReceivableLinks(
    [{ id: 'debtor-a', name: 'Ficticia Uno' }],
    [{ ...documents[0]!, transaction_id: 'legacy-loan', debtor_id: null, debtor_name: ' FICTICIA UNO ' }],
    [{ id: 'legacy-loan', debtor_id: 'debtor-a', description: 'Préstamo heredado', amount: 40, currency: 'PEN', transaction_date: '2026-01-01', notes: null }],
  )
  const records = uniqueProjection.byDebtor.get('debtor-a') ?? []
  const history = buildDebtorFinancialHistory(records as never, [{
    id: 'legacy-loan', type: 'EXPENSE', amount: 40, currency: 'PEN', description: 'Préstamo heredado', notes: null, transaction_date: '2026-01-01',
  }])
  expect(history).toHaveLength(1)
  expect(history[0]).toMatchObject({ id: 'obligation:orphan-unique', status: 'PENDING', amount: 40 })
})

test('debtor PDF retains a fictional mixed-currency history across multiple pages', async () => {
  const receivables: ReceivableHistoryDocument[] = Array.from({ length: 46 }, (_, index) => ({
    id: `fake-receivable-${index + 1}`,
    transaction_id: null,
    concept: `Documento ficticio ${index + 1} con descripción suficientemente larga para ocupar espacio en el historial`,
    amount: 100 + index,
    collected_amount: 25,
    currency: index % 2 ? 'USD' : 'PEN',
    issue_date: `2025-${String(index % 12 + 1).padStart(2, '0')}-12`,
    status: index % 3 ? 'PARTIAL' : 'PENDING',
    notes: null,
  }))
  receivables.push({
    id: 'fake-receivable-long-note',
    transaction_id: null,
    concept: 'Registro ficticio con observación extensa',
    amount: 0,
    collected_amount: 0,
    currency: 'PEN',
    issue_date: '2026-10-30',
    status: 'COLLECTED',
    notes: `${'nota detallada para probar que el contenido largo no se corta ni se omite. '.repeat(90)}`,
  })
  const transactions = Array.from({ length: 46 }, (_, index) => ({
    id: `fake-payment-${index + 1}`,
    type: 'INCOME' as const,
    amount: 25,
    currency: index % 2 ? 'USD' : 'PEN',
    description: `Abono ficticio ${index + 1}`,
    notes: null,
    transaction_date: `2026-${String(index % 12 + 1).padStart(2, '0')}-15`,
  }))
  const bytes = await buildDebtorReportPdf({
    debtor: { name: 'Ejemplo Ficticio', relationship: 'Datos de demostración', initial_debt: 0 },
    receivables,
    transactions,
    logoSvg: new Uint8Array(readFileSync(join(process.cwd(), 'public/brand/v3/ft-ligature-dark.svg'))),
    fonts: {
      regular: new Uint8Array(readFileSync(join(process.cwd(), 'public/fonts/v3/manrope-regular.ttf'))),
      semibold: new Uint8Array(readFileSync(join(process.cwd(), 'public/fonts/v3/manrope-semibold.ttf'))),
      bold: new Uint8Array(readFileSync(join(process.cwd(), 'public/fonts/v3/manrope-bold.ttf'))),
    },
    generatedAt: new Date('2026-11-03T12:00:00Z'),
  })
  const { PDFDocument } = nodeRequire('pdf-lib') as typeof import('pdf-lib')
  const pdf = await PDFDocument.load(bytes)
  expect(pdf.getTitle()).toContain('Ejemplo Ficticio')
  expect(pdf.getPageCount()).toBeGreaterThan(5)
  expect(bytes.byteLength).toBeGreaterThan(50_000)
})

test('authenticated export scopes the debtor and every history query to the session owner', async () => {
  const queryLog: Array<{ table: string; filters: Array<[string, unknown]>; range?: [number, number] }> = []
  let sessionUser: { id: string } | null = null
  const debtor = { id: 'debtor-owned', name: 'Persona de prueba', relationship: null, initial_debt: 0 }
  let allDebtors = [{ id: 'debtor-owned', name: 'Persona de prueba' }]
  let oneReceivable: Array<Record<string, any>> = [{ id: 'owned-receivable', transaction_id: null, debtor_id: null, debtor_name: 'Persona de prueba', concept: 'Documento heredado ficticio', amount: 120, collected_amount: 20, currency: 'PEN', issue_date: '2026-01-10', status: 'PARTIAL', notes: null, transaction: null }]
  const oneTransaction = [{ id: 'owned-payment', type: 'INCOME', debtor_id: 'debtor-owned', amount: 20, currency: 'PEN', description: 'Cobro ficticio', notes: null, transaction_date: '2026-01-12', source_account: null, category: null }]
  const client = {
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    from(table: string) {
      const query = { table, filters: [] as Array<[string, unknown]>, range: undefined as [number, number] | undefined }
      queryLog.push(query)
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => { query.filters.push([key, value]); return builder },
        in: () => builder,
        order: () => builder,
        range: async (from: number, to: number) => {
          query.range = [from, to]
          const rows = table === 'accounts_receivable' ? oneReceivable : table === 'transactions' ? oneTransaction : allDebtors
          return { data: rows.slice(from, to + 1), error: null }
        },
        maybeSingle: async () => ({ data: table === 'debtors' && query.filters.some(([key, value]) => key === 'id' && value === debtor.id) && query.filters.some(([key, value]) => key === 'user_id' && value === 'owner-1') ? debtor : null, error: null }),
      }
      return builder
    },
  }
  const createClientPath = join(process.cwd(), 'lib/supabase.server.ts')
  const resolvedCreateClient = nodeRequire.resolve(createClientPath)
  nodeRequire.cache[resolvedCreateClient] = {
    id: resolvedCreateClient, filename: resolvedCreateClient, loaded: true, children: [], paths: [], exports: { createClient: async () => client }, parent: null,
  } as unknown as NodeModule
  const route = nodeRequire(join(process.cwd(), 'app/api/debtors/[id]/export/route.ts')) as { GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> }

  const unauthorized = await route.GET(new Request('http://localhost/api/debtors/debtor-owned/export'), { params: Promise.resolve({ id: debtor.id }) })
  expect(unauthorized.status).toBe(401)
  expect(queryLog).toHaveLength(0)

  sessionUser = { id: 'owner-1' }
  const response = await route.GET(new Request('http://localhost/api/debtors/debtor-owned/export'), { params: Promise.resolve({ id: debtor.id }) })
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('application/pdf')
  expect(queryLog).toHaveLength(4)
  for (const query of queryLog) {
    expect(query.filters).toContainEqual(['user_id', 'owner-1'])
  }
  expect(queryLog.filter(item => item.table === 'debtors')).toHaveLength(2)
  expect(queryLog.find(item => item.table === 'debtors' && item.range)?.range).toEqual([0, 499])
  const singleDebtorLookup = queryLog.find(item => item.table === 'debtors' && !item.range)!
  expect(singleDebtorLookup.filters).toContainEqual(['id', debtor.id])
  for (const query of queryLog.filter(item => item.table !== 'debtors')) {
    expect(query.range).toEqual([0, 499])
  }
  expect(queryLog.find(item => item.table === 'transactions')?.filters).toContainEqual(['debtor_id', debtor.id])
  const { PDFDocument } = nodeRequire('pdf-lib') as typeof import('pdf-lib')
  const responsePdf = await PDFDocument.load(await response.arrayBuffer())
  expect(responsePdf.getPageCount()).toBe(1)

  allDebtors = [{ id: debtor.id, name: debtor.name }, { id: 'same-name-debtor', name: debtor.name }]
  oneReceivable = [{ id: 'ambiguous-orphan', transaction_id: null, debtor_id: null, debtor_name: debtor.name, concept: 'Asociación ambigua', amount: 40, collected_amount: 0, currency: 'PEN', issue_date: '2026-01-10', status: 'PENDING', notes: null, transaction: null }]
  queryLog.length = 0
  const incomplete = await route.GET(new Request('http://localhost/api/debtors/debtor-owned/export'), { params: Promise.resolve({ id: debtor.id }) })
  expect(incomplete.status).toBe(409)
  expect(await incomplete.json()).toMatchObject({ ok: false, error: { code: 'INCOMPLETE_HISTORY' } })
})
