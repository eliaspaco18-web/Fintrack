// =============================================================================
// app/api/dashboard/summary/route.ts
// GET /api/dashboard/summary
// Fase 11.1: KPIs consolidados del dashboard en una sola llamada.
// =============================================================================

import { createClient } from '@/lib/supabase.server'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import { buildDashboardSummaryPayload } from '@/lib/dashboard/summary-payload'
import { measureServerOperation } from '@/lib/server/observability'
import {
  apiOk,
  apiUnauthorized,
  fromResult,
  getSessionUserId,
} from '@/lib/api/response'

export async function GET() {
  return measureServerOperation('api.dashboard.summary', async () => {
    const supabase = await createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) return apiUnauthorized()

    const service = new DashboardService(supabase)
    const result = await service.getSummary(userId, { includeDailyFlow: false })
    if (!result.ok) return fromResult(result)

    const payload = await buildDashboardSummaryPayload(supabase, userId, result.data)
    if (!payload.ok) return fromResult(payload)
    return apiOk(payload.data)
  }, { warnAtMs: 500 })
}
