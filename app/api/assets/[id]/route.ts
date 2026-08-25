// =============================================================================
// app/api/assets/[id]/route.ts
// PRD v3 — Módulo 5: Activos
// GET:    obtener activo por ID
// PATCH:  actualizar datos / cambiar estado (ACTIVE ↔ SOLD)
// DELETE: eliminar activo y su transacción egreso vinculada
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'
import {
  ATTACHMENT_DELETE_BLOCKED_MESSAGE,
  ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE,
  hasStoredAttachmentReference,
  hasTransactionAttachmentReference,
  hasUnsupportedAttachmentWrite,
} from '@/modules/attachments/attachment-integrity'

type Ctx = { params: { id: string } }
const ASSET_STATUSES = new Set(['ACTIVE', 'SOLD', 'DEPRECIATED'] as const)

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data, error } = await supabase
    .from('assets')
    .select('*, asset_type_info:asset_types(id, name, color, icon)')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (error || !data) return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Activo no encontrado' } }, { status: 404 })
  return NextResponse.json({ ok: true, data })
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: { code: 'INVALID_JSON' } }, { status: 400 }) }

  if (hasUnsupportedAttachmentWrite(body)) {
    return NextResponse.json(
      { ok: false, error: { code: 'BUSINESS_RULE_ERROR', message: ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE } },
      { status: 422 },
    )
  }

  // Verificar propiedad
  const { data: existing, error: fetchErr } = await supabase
    .from('assets')
    .select('id, user_id')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()
  if (fetchErr || !existing) return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 })

  // Campos actualizables
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.status === 'string') {
    const normalizedStatus = body.status === 'INACTIVE' ? 'SOLD' : body.status
    if (!ASSET_STATUSES.has(normalizedStatus as 'ACTIVE' | 'SOLD' | 'DEPRECIATED')) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Estado de activo inválido' } },
        { status: 422 }
      )
    }
    patch.status = normalizedStatus
  }
  if (typeof body.name === 'string')          patch.name          = body.name.trim()
  if (typeof body.current_value === 'number') patch.current_value = body.current_value
  if (typeof body.notes === 'string')         patch.notes         = body.notes.trim() || null
  if (typeof body.recipient === 'string')     patch.recipient     = body.recipient.trim() || null

  const { data, error } = await supabase
    .from('assets')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  // Obtener activo para conseguir el transaction_id
  const { data: asset, error: fetchErr } = await supabase
    .from('assets')
    .select('id, transaction_id, user_id, attachment_url')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !asset) return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Activo no encontrado' } }, { status: 404 })

  if (hasStoredAttachmentReference(asset.attachment_url)) {
    return NextResponse.json(
      { ok: false, error: { code: 'BUSINESS_RULE_ERROR', message: ATTACHMENT_DELETE_BLOCKED_MESSAGE } },
      { status: 422 },
    )
  }

  if (asset.transaction_id) {
    const { data: linkedTransaction, error: linkedTransactionError } = await supabase
      .from('transactions')
      .select('attachment_url, notes')
      .eq('id', asset.transaction_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (linkedTransactionError) {
      return NextResponse.json(
        { ok: false, error: { code: 'DATABASE_ERROR', message: 'No se pudo verificar el adjunto del movimiento vinculado.' } },
        { status: 500 },
      )
    }

    if (
      hasStoredAttachmentReference(linkedTransaction?.attachment_url)
      || hasTransactionAttachmentReference(linkedTransaction?.notes)
    ) {
      return NextResponse.json(
        { ok: false, error: { code: 'BUSINESS_RULE_ERROR', message: ATTACHMENT_DELETE_BLOCKED_MESSAGE } },
        { status: 422 },
      )
    }
  }

  // PRD: "Elimina el activo Y su transacción (egreso)"
  // Eliminar primero el activo (FK → transaction), luego la transacción
  const { error: deleteAssetErr } = await supabase
    .from('assets')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (deleteAssetErr) {
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: deleteAssetErr.message } },
      { status: 500 }
    )
  }

  // Eliminar la transacción vinculada si existe
  if (asset.transaction_id) {
    await supabase.from('transactions').delete().eq('id', asset.transaction_id).eq('user_id', userId)
  }

  return new NextResponse(null, { status: 204 })
}
