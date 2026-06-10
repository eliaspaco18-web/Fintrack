// =============================================================================
// app/api/recurring/[id]/route.ts
// PRD v3 — Módulo 11: Transacciones Recurrentes — GET / PATCH / DELETE por id
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'

// ─── GET /api/recurring/[id] ────────────────────────────────────────────────
export async function GET(
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

  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(`
      *,
      source_account:accounts!recurring_transactions_source_account_id_fkey(
        id, name, currency, type
      ),
      destination_account:accounts!recurring_transactions_destination_account_id_fkey(
        id, name, currency, type
      ),
      category:categories(id, name, color, icon)
    `)
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Registro no encontrado' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ ok: true, data })
}

// ─── PATCH /api/recurring/[id] ──────────────────────────────────────────────
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

  if ('name'                   in body) patch.name                   = typeof body.name === 'string' ? body.name.trim() : body.name
  if ('type'                   in body) patch.type                   = body.type
  if ('sub_type'               in body) patch.sub_type               = body.sub_type ?? null
  if ('source_account_id'      in body) patch.source_account_id      = body.source_account_id ?? null
  if ('destination_account_id' in body) patch.destination_account_id = body.destination_account_id ?? null
  if ('category_id'            in body) patch.category_id            = body.category_id ?? null
  if ('budget_id'              in body) patch.budget_id              = body.budget_id ?? null
  if ('debtor_id'              in body) patch.debtor_id              = body.debtor_id ?? null
  if ('creditor_id'            in body) patch.creditor_id            = body.creditor_id ?? null
  if ('amount'                 in body) patch.amount                 = body.amount
  if ('currency'               in body) patch.currency               = body.currency
  if ('description'            in body) patch.description            = typeof body.description === 'string' ? body.description.trim() || null : null
  if ('payment_method'         in body) patch.payment_method         = body.payment_method ?? null
  if ('recipient'              in body) patch.recipient              = typeof body.recipient === 'string' ? body.recipient.trim() || null : null
  if ('sender'                 in body) patch.sender                 = typeof body.sender === 'string' ? body.sender.trim() || null : null
  if ('notes'                  in body) patch.notes                  = typeof body.notes === 'string' ? body.notes.trim() || null : null
  if ('is_active'              in body) patch.is_active              = body.is_active

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'No se enviaron campos a actualizar.' } },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('recurring_transactions')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: 'DATABASE_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, data })
}

// ─── DELETE /api/recurring/[id] ─────────────────────────────────────────────
// Elimina SOLO la plantilla recurrente. Las transacciones anteriores ligadas
// a ella mantienen su datos (ON DELETE SET NULL en recurring_transaction_id).
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
    .from('recurring_transactions')
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
