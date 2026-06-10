// =============================================================================
// app/api/creditors/route.ts
// PRD v3 — Módulo 8: Cuentas por Pagar — CRUD de Acreedores
// GET devuelve acreedores con datos agregados de sus cuentas por pagar.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  // Traer acreedores
  const { data: creditors, error: creditorError } = await supabase
    .from('creditors')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (creditorError) return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: creditorError.message } }, { status: 500 })

  // Traer cuentas por pagar para agregar por acreedor
  const { data: payables, error: apError } = await supabase
    .from('accounts_payable')
    .select('creditor_id, amount, paid_amount, status')
    .eq('user_id', userId)

  if (apError) return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: apError.message } }, { status: 500 })

  // Agregar datos por acreedor
  const aggregated = (creditors ?? []).map(creditor => {
    const related = (payables ?? []).filter(p => p.creditor_id === creditor.id)
    const total_owed    = related.reduce((s, p) => s + Number(p.amount), 0)
    const total_paid    = related.reduce((s, p) => s + Number(p.paid_amount), 0)
    const pending_amount = total_owed - total_paid
    const progress_pct  = total_owed > 0 ? Math.min(100, (total_paid / total_owed) * 100) : 0
    const all_paid      = related.length > 0 && related.every(p => p.status === 'PAID')
    const count_pending = related.filter(p => p.status !== 'PAID').length

    return {
      ...creditor,
      total_owed:      Math.round(total_owed * 100) / 100,
      total_paid:      Math.round(total_paid * 100) / 100,
      pending_amount:  Math.round(pending_amount * 100) / 100,
      progress_pct:    Math.round(progress_pct * 10) / 10,
      all_paid,
      count_pending,
      payables_count:  related.length,
    }
  })

  return NextResponse.json({ ok: true, data: aggregated })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Cuerpo inválido' } }, { status: 400 })

  const name         = typeof body.name === 'string' ? body.name.trim() : ''
  const initial_debt = typeof body.initial_debt === 'number' ? body.initial_debt : 0
  const relationship = typeof body.relationship === 'string' ? body.relationship.trim() || null : null

  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'El nombre del acreedor es obligatorio (mínimo 2 caracteres).' } }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('creditors')
    .insert({ user_id: userId, name, initial_debt, relationship })
    .select()
    .single()

  if (error) {
    const msg = error.message.includes('idx_creditors_user_name')
      ? `Ya existe un acreedor con el nombre "${name}".`
      : error.message
    return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: msg } }, { status: 500 })
  }
  return NextResponse.json({ ok: true, data }, { status: 201 })
}
