// =============================================================================
// app/api/debtors/route.ts
// PRD v3 — Módulo 7: Cuentas por Cobrar — CRUD de Deudores
// GET devuelve deudores con datos agregados de sus cuentas por cobrar.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  // Traer deudores
  const { data: debtors, error: debtorError } = await supabase
    .from('debtors')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (debtorError) return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: debtorError.message } }, { status: 500 })

  // Traer cuentas por cobrar para agregar por deudor
  const { data: receivables, error: arError } = await supabase
    .from('accounts_receivable')
    .select('debtor_id, amount, collected_amount, status')
    .eq('user_id', userId)

  if (arError) return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: arError.message } }, { status: 500 })

  // Agregar datos por deudor
  const aggregated = (debtors ?? []).map(debtor => {
    const related = (receivables ?? []).filter(r => r.debtor_id === debtor.id)
    const total_lent      = related.reduce((s, r) => s + Number(r.amount), 0)
    const total_collected = related.reduce((s, r) => s + Number(r.collected_amount), 0)
    const pending_amount  = total_lent - total_collected
    const progress_pct    = total_lent > 0 ? Math.min(100, (total_collected / total_lent) * 100) : 0
    const all_collected   = related.length > 0 && related.every(r => r.status === 'COLLECTED')
    const count_pending   = related.filter(r => r.status !== 'COLLECTED').length

    return {
      ...debtor,
      total_lent: Math.round(total_lent * 100) / 100,
      total_collected: Math.round(total_collected * 100) / 100,
      pending_amount: Math.round(pending_amount * 100) / 100,
      progress_pct: Math.round(progress_pct * 10) / 10,
      all_collected,
      count_pending,
      receivables_count: related.length,
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
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'El nombre del deudor es obligatorio (mínimo 2 caracteres).' } }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('debtors')
    .insert({ user_id: userId, name, initial_debt, relationship })
    .select()
    .single()

  if (error) {
    const msg = error.message.includes('idx_debtors_user_name')
      ? `Ya existe un deudor con el nombre "${name}".`
      : error.message
    return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: msg } }, { status: 500 })
  }
  return NextResponse.json({ ok: true, data }, { status: 201 })
}
