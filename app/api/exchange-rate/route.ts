// =============================================================================
// app/api/exchange-rate/route.ts
// GET /api/exchange-rate
// Retorna el tipo de cambio USD->PEN para el usuario autenticado.
// Soporta dos modos:
//   - accounting (default): tasa diaria contable para registros/importaciones
//   - live: comportamiento legado/raw para futuras vistas en vivo
// =============================================================================

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import {
  resolveAccountingUsdPenExchangeRate,
  resolveLiveUsdPenExchangeRate,
} from '@/lib/server/exchange-rate'
import { measureServerOperation } from '@/lib/server/observability'

export async function GET(req: NextRequest) {
  return measureServerOperation('api.exchange-rate', async () => {
    const supabase = createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) return apiUnauthorized()

    const mode = req.nextUrl.searchParams.get('mode') === 'live' ? 'live' : 'accounting'
    const refresh = req.nextUrl.searchParams.get('refresh') === '1'
    const ensure = req.nextUrl.searchParams.get('ensure') === '1'
    const date = req.nextUrl.searchParams.get('date')

    const snapshot = mode === 'live'
      ? await resolveLiveUsdPenExchangeRate({ forceRefresh: refresh })
      : await resolveAccountingUsdPenExchangeRate({
          date,
          ensureForToday: ensure || !date,
          allowPrior: true,
        })

    return apiOk(snapshot)
  }, {
    warnAtMs: 500,
    meta: {
      mode: req.nextUrl.searchParams.get('mode') === 'live' ? 'live' : 'accounting',
      refresh: req.nextUrl.searchParams.get('refresh') === '1',
    },
  })
}
