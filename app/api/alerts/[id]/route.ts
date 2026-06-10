// =============================================================================
// app/api/alerts/[id]/route.ts
// PRD v3 — Módulo 9: Alertas — PATCH (marcar leída/no leída) + DELETE (individual)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 }
    )
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json(
      { ok: false, error: { code: 'BAD_REQUEST', message: 'Cuerpo inválido' } },
      { status: 400 }
    )
  }

  const patch: Record<string, unknown> = {}
  if ('is_read' in body) {
    patch.is_read = Boolean(body.is_read)
    patch.read_at = body.is_read ? new Date().toISOString() : null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'No hay campos a actualizar' } },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('app_notifications')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select('id, alert_type, source_module, source_record_id, href, title, message, is_read, created_at, read_at')
    .single()

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 }
    )
  }

  const { error } = await supabase
    .from('app_notifications')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
