import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import { measureServerOperation } from '@/lib/server/observability'
import { apiUnauthorized, fromResult, getSessionUserId } from '@/lib/api/response'
import { buildDashboardSidebarResponse } from '@/lib/dashboard/sidebar-response'

export async function GET(req: NextRequest) {
  return measureServerOperation('api.dashboard.sidebar', async () => {
    const supabase = await createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) return apiUnauthorized()

    const service = new DashboardService(supabase)
    const result = await service.getSummary(userId, { includeDailyFlow: false })
    if (!result.ok) return fromResult(result)

    return buildDashboardSidebarResponse(
      supabase,
      userId,
      result.data,
      req.nextUrl.searchParams.get('period'),
    )
  }, { warnAtMs: 650 })
}
