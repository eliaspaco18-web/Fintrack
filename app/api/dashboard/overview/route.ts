import { createClient } from '@/lib/supabase.server'
import { apiOk, apiUnauthorized, fromResult, getSessionUserId } from '@/lib/api/response'
import { buildDashboardSummaryPayload } from '@/lib/dashboard/summary-payload'
import { buildDashboardSidebarResponse } from '@/lib/dashboard/sidebar-response'
import { measureServerOperation } from '@/lib/server/observability'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import type { DashboardSidebar, DashboardSummary } from '@/lib/dashboard/types'

type SourceError = { code: string; message: string; detail?: string }
type DashboardOverviewPayload = {
  summary: { data: DashboardSummary | null; error: SourceError | null }
  sidebar: { data: DashboardSidebar | null; error: SourceError | null }
}

export async function GET(req: Request) {
  return measureServerOperation('api.dashboard.overview', async () => {
    const supabase = await createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) return apiUnauthorized()

    const service = new DashboardService(supabase)
    const result = await service.getSummary(userId, { includeDailyFlow: false })
    if (!result.ok) return fromResult(result)

    const period = new URL(req.url).searchParams.get('period')
    const [summaryResult, sidebarResponse] = await Promise.all([
      buildDashboardSummaryPayload(supabase, userId, result.data),
      buildDashboardSidebarResponse(supabase, userId, result.data, period),
    ])
    const sidebarJson = await sidebarResponse.json() as {
      ok: boolean
      data?: DashboardSidebar
      error?: SourceError
    }

    const payload: DashboardOverviewPayload = {
      summary: summaryResult.ok
        ? { data: summaryResult.data, error: null }
        : { data: null, error: summaryResult.error },
      sidebar: sidebarJson.ok && sidebarJson.data
        ? { data: sidebarJson.data, error: null }
        : {
            data: null,
            error: sidebarJson.error ?? {
              code: 'DATABASE_ERROR',
              message: 'Could not load dashboard sidebar data',
            },
          },
    }

    return apiOk(payload)
  }, { warnAtMs: 650 })
}
