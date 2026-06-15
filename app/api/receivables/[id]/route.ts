// =============================================================================
// app/api/receivables/[id]/route.ts
// PRD v3 — Módulo 7: Cuentas por Cobrar — PATCH / DELETE por id
// =============================================================================

import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { apiError, apiNoContent, getSessionUserId } from '@/lib/api/response'
import { TransactionService } from '@/modules/transactions/transaction.service'

const RECEIVABLE_SELECT = `
  *,
  debtor:debtors(id, name, relationship, initial_debt, is_active),
  transaction:transactions(
    id,
    source_account:accounts!transactions_source_account_id_fkey(id, name)
  )
`

type ReceivableResponseRow = {
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

function normalizeReceivableRow<T extends ReceivableResponseRow>(row: T) {
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
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  const { data, error } = await supabase
    .from('accounts_receivable')
    .select(RECEIVABLE_SELECT)
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (error) return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Registro no encontrado' } }, { status: 404 })
  return NextResponse.json({ ok: true, data: normalizeReceivableRow(data as ReceivableResponseRow) })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Cuerpo inválido' } }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if ('debtor_id'   in body) patch.debtor_id   = body.debtor_id ?? null
  if ('debtor_name' in body) patch.debtor_name = typeof body.debtor_name === 'string' ? body.debtor_name.trim() : body.debtor_name
  if ('concept'     in body) patch.concept     = typeof body.concept === 'string' ? body.concept.trim() || null : null
  if ('amount'      in body) patch.amount      = body.amount
  if ('currency'    in body) patch.currency    = body.currency
  if ('issue_date'  in body) patch.issue_date  = body.issue_date
  if ('due_date'    in body) patch.due_date    = body.due_date ?? null
  if ('notes'       in body) patch.notes       = typeof body.notes === 'string' ? body.notes.trim() || null : null
  if ('status'      in body) patch.status      = body.status
  if ('collected_amount' in body) patch.collected_amount = body.collected_amount
  if ('collected_date'   in body) patch.collected_date   = body.collected_date ?? null
  if ('attachment_url'   in body) patch.attachment_url   = body.attachment_url ?? null

  const { data, error } = await supabase
    .from('accounts_receivable')
    .update(patch)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select(RECEIVABLE_SELECT)
    .single()

  if (error) return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: error.message } }, { status: 500 })
  return NextResponse.json({ ok: true, data: normalizeReceivableRow(data as ReceivableResponseRow) })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  const { data: receivable, error: receivableError } = await supabase
    .from('accounts_receivable')
    .select('id, transaction_id')
    .eq('id', params.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (receivableError) {
    return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: receivableError.message } }, { status: 500 })
  }

  if (!receivable) {
    return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Registro no encontrado' } }, { status: 404 })
  }

  if (receivable.transaction_id) {
    const service = new TransactionService(supabase)
    const result = await service.deleteTransaction(userId, receivable.transaction_id, { force: false })
    if (!result.ok) return apiError(result.error)
  } else {
    const { error } = await supabase
      .from('accounts_receivable')
      .delete()
      .eq('id', params.id)
      .eq('user_id', userId)

    if (error) return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: error.message } }, { status: 500 })
  }

  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/receivables')

  return apiNoContent()
}
