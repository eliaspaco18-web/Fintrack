// =============================================================================
// app/api/exchange-rate/route.ts
// GET /api/exchange-rate
// Retorna el tipo de cambio USD->PEN para el usuario autenticado.
// ?refresh=1 intenta actualizar desde el proveedor externo antes de responder.
// =============================================================================

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { resolveUsdPenExchangeRate } from '@/lib/server/exchange-rate'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const refresh = req.nextUrl.searchParams.get('refresh') === '1'
  const snapshot = await resolveUsdPenExchangeRate({ refresh })

  return apiOk(snapshot)
}

