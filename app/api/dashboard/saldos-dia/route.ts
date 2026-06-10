// =============================================================================
// app/api/dashboard/saldos-dia/route.ts
// GET /api/dashboard/saldos-dia?period=1M
// Fase 11.1: serie diaria por período con acumulados de ingresos y egresos.
// =============================================================================

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import { apiOk, apiUnauthorized, fromResult, getSessionUserId } from '@/lib/api/response'
import type { SaldoDiaPeriod, SaldoDiaPoint } from '@/lib/dashboard/types'

const PERIOD_DAYS: Record<SaldoDiaPeriod, number> = {
  '5D': 5,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1A': 365,
}

function normalizePeriod(raw: string | null): SaldoDiaPeriod {
  if (raw === '5D' || raw === '1M' || raw === '3M' || raw === '6M' || raw === '1A') {
    return raw
  }
  return '1M'
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const period = normalizePeriod(req.nextUrl.searchParams.get('period'))
  const days = PERIOD_DAYS[period]

  const service = new DashboardService(supabase)
  const result = await service.getDailyFlow(userId, days)
  if (!result.ok) return fromResult(result)

  let ingresosAcumulados = 0
  let egresosAcumulados = 0

  const points: SaldoDiaPoint[] = result.data.map((point) => {
    ingresosAcumulados += point.incomePen
    egresosAcumulados += point.expensePen
    return {
      date: point.date,
      saldo: point.balancePen,
      ingresos_acumulados: ingresosAcumulados,
      egresos_acumulados: egresosAcumulados,
    }
  })

  return apiOk({
    period,
    points,
    totals: {
      ingresos: ingresosAcumulados,
      egresos: egresosAcumulados,
    },
  })
}
