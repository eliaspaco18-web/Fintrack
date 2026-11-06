import { createClient } from '@/lib/supabase.server'
import { apiUnauthorized, fromResult, getSessionUserId } from '@/lib/api/response'
import { buildDashboardSummaryPayload } from '@/lib/dashboard/summary-payload'
import { buildDashboardSidebarResponse } from '@/lib/dashboard/sidebar-response'
import { measureServerOperation } from '@/lib/server/observability'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import type { DashboardSidebar, DashboardSummary } from '@/lib/dashboard/types'

type SourceError = { code: string; message: string; detail?: string }
type OverviewEvent =
  | { source: 'summary'; data: DashboardSummary | null; error: SourceError | null }
  | { source: 'sidebar'; data: DashboardSidebar | null; error: SourceError | null }
type SidebarResult = { ok: boolean; data?: DashboardSidebar; error?: SourceError }

const encoder = new TextEncoder()

function streamResponse(run: (send: (event: OverviewEvent) => void) => Promise<void>) {
  let cancelled = false
  const sent = new Set<OverviewEvent['source']>()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: OverviewEvent) => {
        if (cancelled || sent.has(event.source)) return
        sent.add(event.source)
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      void run(send).then(() => {
        if (!cancelled) controller.close()
      }).catch(() => {
        if (!cancelled) {
          const error = { code: 'DATABASE_ERROR', message: 'No se pudo completar la carga de Inicio.' }
          if (!sent.has('summary')) send({ source: 'summary', data: null, error })
          if (!sent.has('sidebar')) send({ source: 'sidebar', data: null, error })
          controller.close()
        }
      })
    },
    cancel() { cancelled = true },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'private, no-store, no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function GET(req: Request) {
  const bootstrap = await measureServerOperation('api.dashboard.overview.bootstrap', async () => {
    const supabase = await createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) return { response: apiUnauthorized() as Response }

    const service = new DashboardService(supabase)
    const summaryResult = await measureServerOperation(
      'api.dashboard.overview.summary_rpc',
      () => service.getSummary(userId, { includeDailyFlow: false }),
      { warnAtMs: 650 },
    )
    if (!summaryResult.ok) return { response: fromResult(summaryResult) as Response }
    return { supabase, userId, serviceSummary: summaryResult.data }
  }, { warnAtMs: 650 })

  if ('response' in bootstrap) return bootstrap.response

  const { supabase, userId, serviceSummary } = bootstrap
  const period = new URL(req.url).searchParams.get('period')
  return streamResponse(async send => {
    await measureServerOperation('api.dashboard.overview.stream', async () => {
      // Sidebar queries can proceed while the summary is mapped. The summary is sent
      // first so the headline figures become useful without waiting for category data.
      const sidebarPromise: Promise<SidebarResult> = measureServerOperation('api.dashboard.overview.sidebar', async () => {
        const response = await buildDashboardSidebarResponse(supabase, userId, serviceSummary, period)
        return await response.json() as SidebarResult
      }, { warnAtMs: 650 }).catch(() => ({
        ok: false,
        data: undefined,
        error: { code: 'DATABASE_ERROR', message: 'Could not load dashboard sidebar data' },
      }))

      const summaryResult = await measureServerOperation(
        'api.dashboard.overview.summary_payload',
        () => buildDashboardSummaryPayload(supabase, userId, serviceSummary),
        { warnAtMs: 650 },
      )
      send(summaryResult.ok
        ? { source: 'summary', data: summaryResult.data, error: null }
        : { source: 'summary', data: null, error: summaryResult.error })

      try {
        const sidebar = await sidebarPromise
        send(sidebar.ok && sidebar.data
          ? { source: 'sidebar', data: sidebar.data, error: null }
          : {
              source: 'sidebar',
              data: null,
              error: sidebar.error ?? { code: 'DATABASE_ERROR', message: 'Could not load dashboard sidebar data' },
            })
      } catch {
        send({ source: 'sidebar', data: null, error: { code: 'DATABASE_ERROR', message: 'Could not load dashboard sidebar data' } })
      }
    }, { warnAtMs: 650 })
  })
}
