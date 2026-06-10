// =============================================================================
// app/api/debtors/[id]/route.ts
// PRD v3 — Módulo 7: Cuentas por Cobrar — Debtor GET / PATCH / DELETE
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  const { data, error } = await supabase
    .from('debtors')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (error || !data) return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Deudor no encontrado' } }, { status: 404 })
  return NextResponse.json({ ok: true, data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Cuerpo inválido' } }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (name.length < 2) return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'El nombre debe tener al menos 2 caracteres.' } }, { status: 422 })
    patch.name = name
  }
  if (typeof body.initial_debt === 'number') patch.initial_debt = body.initial_debt
  if ('relationship' in body) patch.relationship = typeof body.relationship === 'string' ? body.relationship.trim() || null : null
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active

  const { data, error } = await supabase
    .from('debtors')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    const msg = error.message.includes('idx_debtors_user_name')
      ? 'Ya existe un deudor con ese nombre.'
      : error.message
    return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: msg } }, { status: 500 })
  }
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  // Verificar que no tenga cuentas por cobrar relacionadas
  const { count, error: countError } = await supabase
    .from('accounts_receivable')
    .select('id', { count: 'exact', head: true })
    .eq('debtor_id', params.id)
    .eq('user_id', userId)

  if (countError) return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: countError.message } }, { status: 500 })
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { ok: false, error: { code: 'CONSTRAINT_ERROR', message: 'No se puede eliminar un deudor con cuentas por cobrar asociadas.' } },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('debtors')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: error.message } }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
