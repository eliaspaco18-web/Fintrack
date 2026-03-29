// =============================================================================
// app/api/dashboard/route.ts
// GET /api/dashboard — summary completo del dashboard en una sola llamada
// =============================================================================

import { createClient }        from '@/lib/supabase.server'
import { DashboardService }    from '@/modules/dashboard/dashboard.service'
import {
  fromResult,
  apiUnauthorized,
  getSessionUserId,
}                              from '@/lib/api/response'

export async function GET() {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const service = new DashboardService(supabase)
  const result  = await service.getSummary(userId)
  return fromResult(result)
}

// =============================================================================
// app/actions/dashboard.actions.ts
// Server Actions para el dashboard — usados en Server Components directamente,
// sin necesidad de pasar por HTTP.
// =============================================================================

// ──────────────────────────────────────────────────────────────────────────────
// NOTA DE ARQUITECTURA: Server Actions vs API Routes para el dashboard
//
// Los Server Components de Next.js pueden llamar Server Actions directamente,
// lo que significa CERO latencia de red para la carga inicial de la página.
// Por eso las Server Actions son la opción preferida para el dashboard.
//
// La API Route GET /api/dashboard se mantiene para:
//  - Refresh del cliente (SWR/React Query) sin full page reload
//  - Acceso desde herramientas externas o scripts de automatización
// ──────────────────────────────────────────────────────────────────────────────
