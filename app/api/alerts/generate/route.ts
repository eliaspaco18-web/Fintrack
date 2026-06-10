// =============================================================================
// app/api/alerts/generate/route.ts
// PRD v3 — Módulo 9: Alertas — POST /api/alerts/generate
// Ejecuta el generador de alertas on-demand para el usuario autenticado.
// =============================================================================

import { NextResponse }              from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'
import { generateAlertsForUser }     from '@/lib/alerts/alert-generator'

export async function POST() {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 }
    )
  }

  const result = await generateAlertsForUser(supabase, userId)

  // Reportar errores como warning pero responder 200 si al menos corrió
  if (result.errors.length > 0 && result.created === 0 && result.skipped === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code:    'GENERATION_ERROR',
          message: 'El generador encontró errores',
          detail:  result.errors.join(' | '),
        },
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    data: {
      created: result.created,
      skipped: result.skipped,
      warnings: result.errors.length > 0 ? result.errors : undefined,
    },
  })
}
