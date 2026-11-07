import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import * as ts from 'typescript'
import { consumeDashboardOverviewStream } from '@/lib/dashboard/overview-stream'

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

const mockPath = (relative: string) => nodeRequire.resolve(join(process.cwd(), relative))
const originalModules = new Map<string, NodeModule | undefined>()
function installMock(relative: string, exports: Record<string, unknown>) {
  const id = mockPath(relative)
  originalModules.set(id, nodeRequire.cache[id])
  nodeRequire.cache[id] = { id, filename: id, loaded: true, children: [], paths: [], exports } as unknown as NodeModule
}

const receivedUserIds: string[] = []
const fakeSummary = { ingresos_mes: 500, egresos_mes: 200, resultado_mensual: 300 }
const fakeSidebar = { egresos_categoria: [{ name: 'Hogar', monto: 200 }] }
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

installMock('lib/supabase.server.ts', { createClient: async () => ({}) })
installMock('lib/api/response.ts', {
  apiUnauthorized: () => new Response(JSON.stringify({ ok: false }), { status: 401 }),
  fromResult: () => new Response(JSON.stringify({ ok: false }), { status: 500 }),
  getSessionUserId: async () => 'owner-a',
})
installMock('lib/dashboard/summary-payload.ts', {
  buildDashboardSummaryPayload: async (_client: unknown, userId: string) => {
    receivedUserIds.push(userId)
    return { ok: true, data: fakeSummary }
  },
})
installMock('lib/dashboard/sidebar-response.ts', {
  buildDashboardSidebarResponse: async (_client: unknown, userId: string) => {
    receivedUserIds.push(userId)
    await wait(170)
    return Response.json({ ok: true, data: fakeSidebar })
  },
})
installMock('lib/server/observability.ts', { measureServerOperation: async (_name: string, work: () => Promise<unknown>) => work() })
installMock('modules/dashboard/dashboard.service.ts', {
  DashboardService: class {
    constructor(_client: unknown) {}
    async getSummary(userId: string) {
      receivedUserIds.push(userId)
      return { ok: true, data: { accounts: [], meta: {} } }
    }
  },
})

const routePath = mockPath('app/api/dashboard/overview/route.ts')
delete nodeRequire.cache[routePath]
const route = nodeRequire(routePath) as { GET: (request: Request) => Promise<Response> }

test('authenticated overview route streams the headline figures before the slow sidebar response', async () => {
  try {
    receivedUserIds.length = 0
    const startedAt = performance.now()
    const response = await route.GET(new Request('http://localhost/api/dashboard/overview?period=2026-11'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/x-ndjson')
    const arrivals: Array<{ source: string; at: number; data: unknown }> = []
    await consumeDashboardOverviewStream(response, event => {
      arrivals.push({ source: event.source, at: performance.now() - startedAt, data: event.data })
    })

    const summary = arrivals.find(event => event.source === 'summary')!
    const sidebar = arrivals.find(event => event.source === 'sidebar')!
    expect(summary.data).toEqual(fakeSummary)
    expect(sidebar.data).toEqual(fakeSidebar)
    expect(summary.at).toBeLessThan(sidebar.at - 70)
    expect(receivedUserIds).toEqual(['owner-a', 'owner-a', 'owner-a'])
  } finally {
    for (const [id, original] of originalModules) {
      if (original) nodeRequire.cache[id] = original
      else delete nodeRequire.cache[id]
    }
    delete nodeRequire.cache[routePath]
    Module._resolveFilename = originalResolveFilename
    Module._extensions['.ts'] = originalTsExtension
  }
})
