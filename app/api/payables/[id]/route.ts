// =============================================================================
// app/api/payables/[id]/route.ts
// PRD v3 — Módulo 8: Cuentas por Pagar — GET / PATCH / DELETE por id
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { apiError, apiUnauthorized, getSessionUserId } from '@/lib/api/response'

const PAYABLE_SELECT = `
  *,
  creditor:creditors(id, name, relationship, initial_debt, is_active),
  transaction:transactions(
    id,
    source_account:accounts!transactions_source_account_id_fkey(id, name)
  )
`

type PayableResponseRow = {
  transaction?: {
    id: string
    source_account?: { id: string; name: string } | Array<{ id: string; name: string }> | null
  } | Array<{
    id: string
    source_account?: { id: string; name: string } | Array<{ id: string; name: string }> | null
  }> | null
  [key: string]: unknown
}

function pickSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizePayableRow<T extends PayableResponseRow>(row: T) {
  const transaction = pickSingle(row.transaction)
  const sourceAccount = pickSingle(transaction?.source_account)
  const { transaction: _transaction, ...rest } = row

  return {
    ...rest,
    source_account: sourceAccount,
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data, error } = await supabase
    .from('accounts_payable')
    .select(PAYABLE_SELECT)
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (error) return apiError({ code: 'NOT_FOUND', message: 'Registro no encontrado' })
  return NextResponse.json({ ok: true, data: normalizePayableRow(data as PayableResponseRow) })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const body = await req.json().catch(() => null)
  if (!body) return apiError({ code: 'VALIDATION_ERROR', message: 'Cuerpo inválido' })

  const patch: Record<string, unknown> = {}
  if ('creditor_id'   in body) patch.creditor_id   = body.creditor_id ?? null
  if ('creditor_name' in body) patch.creditor_name = typeof body.creditor_name === 'string' ? body.creditor_name.trim() : body.creditor_name
  if ('concept'       in body) patch.concept       = typeof body.concept === 'string' ? body.concept.trim() || null : null
  if ('amount'        in body) patch.amount        = body.amount
  if ('currency'      in body) patch.currency      = body.currency
  if ('issue_date'    in body) patch.issue_date    = body.issue_date
  if ('due_date'      in body) patch.due_date      = body.due_date ?? null
  if ('notes'         in body) patch.notes         = typeof body.notes === 'string' ? body.notes.trim() || null : null
  if ('status'        in body) patch.status        = body.status
  if ('paid_amount'   in body) patch.paid_amount   = body.paid_amount
  if ('paid_date'     in body) patch.paid_date     = body.paid_date ?? null
  if ('attachment_url' in body) patch.attachment_url = body.attachment_url ?? null

  const { data, error } = await supabase
    .from('accounts_payable')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select(PAYABLE_SELECT)
    .single()

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return NextResponse.json({ ok: true, data: normalizePayableRow(data as PayableResponseRow) })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { error } = await supabase
    .from('accounts_payable')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return new NextResponse(null, { status: 204 })
}
