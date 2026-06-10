// =============================================================================
// app/api/asset-types/route.ts
// PRD v3 — Módulo 5: Activos
// GET: lista tipos de activo activos del usuario (sistema + propios)
// Usado por AssetsForm y AssetsListPanel para poblar el desplegable.
// =============================================================================

import { NextResponse }             from 'next/server'
import { createClient }             from '@/lib/supabase.server'
import { getSessionUserId }         from '@/lib/api/response'
import { AssetTypeRepository }      from '@/modules/admin/asset-type.repository'

export async function GET() {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 }
    )
  }

  const repo   = new AssetTypeRepository(supabase)
  const result = await repo.findAllByUser(userId)

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: result.error.message } },
      { status: 500 }
    )
  }

  // Devolver solo los tipos activos para los desplegables de formularios
  const active = result.data.filter(t => t.is_active)
  return NextResponse.json({ ok: true, data: active })
}
