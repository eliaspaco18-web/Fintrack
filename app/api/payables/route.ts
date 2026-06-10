// =============================================================================
// app/api/payables/route.ts
// PRD v3 — Módulo 8: Cuentas por Pagar — GET (lista) + POST (crear)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { CategoryKeys }              from '@/lib/constants/category-keys'
import { TransactionService }        from '@/modules/transactions/transaction.service'
import { resolveAccountingUsdPenExchangeRate } from '@/lib/server/exchange-rate'
import {
  apiCreated,
  apiError,
  apiUnauthorized,
  fromResult,
  getSessionUserId,
}                                    from '@/lib/api/response'
import type { CreateTransactionResult } from '@/modules/transactions/transaction.service.types'

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

async function resolveUserCategoryIdBySystemKey(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  systemKey: string,
) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, is_system, user_id')
    .eq('system_key', systemKey)
    .or(`user_id.eq.${userId},is_system.eq.true`)
    .order('is_system', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) return { id: null, error }
  return { id: data?.id ?? null, error: null }
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const statusParam   = req.nextUrl.searchParams.get('status')
  const creditorId    = req.nextUrl.searchParams.get('creditor_id')
  const sortParam     = req.nextUrl.searchParams.get('sort') ?? 'desc' // 'asc' | 'desc'

  const allowedStatus = ['PENDING', 'PARTIAL', 'PAID', 'DISPUTED'] as const
  const status = allowedStatus.find(v => v === statusParam)
  if (statusParam && !status) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Parámetro status inválido' } }, { status: 422 })
  }

  let query = supabase
    .from('accounts_payable')
    .select(PAYABLE_SELECT)
    .eq('user_id', userId)

  if (status)     query = query.eq('status', status)
  if (creditorId) query = query.eq('creditor_id', creditorId)

  // Ordenar por monto (mayor a menor o menor a mayor)
  if (sortParam === 'asc') {
    query = query.order('amount', { ascending: true })
  } else {
    query = query.order('amount', { ascending: false })
  }

  const { data, error } = await query
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return NextResponse.json({ ok: true, data: (data ?? []).map(row => normalizePayableRow(row as PayableResponseRow)) })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const body = await req.json().catch(() => null)
  if (!body) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Cuerpo inválido' })
  }

  const creditor_id   = typeof body.creditor_id === 'string'   ? body.creditor_id  : null
  const concept       = typeof body.concept === 'string'       ? body.concept.trim() || null : null
  const amount        = typeof body.amount === 'number'        ? body.amount : Number(body.amount)
  const currency      = body.currency === 'USD' ? 'USD' : 'PEN'
  const issue_date    = typeof body.issue_date === 'string'    ? body.issue_date : new Date().toISOString().slice(0, 10)
  const due_date      = typeof body.due_date === 'string'      ? body.due_date || null : null
  const notes         = typeof body.notes === 'string'         ? body.notes.trim() || null : null
  const attachment_url = typeof body.attachment_url === 'string' ? body.attachment_url || null : null
  const source_account_id = typeof body.source_account_id === 'string' ? body.source_account_id : ''
  const save_recurring = body.save_recurring === true
  const recurring_name = typeof body.recurring_name === 'string' ? body.recurring_name.trim() : ''

  if (!creditor_id) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Selecciona un acreedor válido.' })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'El monto debe ser mayor a 0.' })
  }
  if (!source_account_id) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Selecciona un portafolio.' })
  }
  if (save_recurring && recurring_name.length === 0) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Debes indicar un nombre para guardar la recurrente.',
    })
  }

  const { data: creditor, error: creditorError } = await supabase
    .from('creditors')
    .select('id, name')
    .eq('id', creditor_id)
    .eq('user_id', userId)
    .single()

  if (creditorError || !creditor) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'El acreedor seleccionado no existe o no te pertenece.',
    })
  }

  const { id: payableCategoryId, error: payableCategoryError } =
    await resolveUserCategoryIdBySystemKey(supabase, userId, CategoryKeys.EXPENSE_PAYABLE)

  if (payableCategoryError) {
    return apiError({ code: 'DATABASE_ERROR', message: payableCategoryError.message })
  }

  if (!payableCategoryId) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: 'No se encontró la categoría por defecto para cuentas por pagar.',
    })
  }

  const exchangeSnapshot = await resolveAccountingUsdPenExchangeRate({
    date: issue_date,
    allowPrior: true,
    ensureForToday: true,
  })
  const exchangeRate = exchangeSnapshot.rate

  const service = new TransactionService(supabase)
  const transactionResult = await service.createTransaction(userId, {
    type: 'INCOME',
    source_account_id,
    amount,
    currency,
    exchange_rate: currency === 'USD' ? exchangeRate : undefined,
    description: concept ?? `Pago a ${creditor.name}`,
    transaction_date: issue_date,
    category_id: payableCategoryId,
    notes: notes ?? undefined,
    recipient: creditor.name,
    payable: {
      creditor_id,
      creditor_name: creditor.name,
      due_date: due_date ?? undefined,
      concept: concept ?? undefined,
      notes: notes ?? undefined,
    },
  })

  if (!transactionResult.ok) {
    return fromResult(transactionResult)
  }

  const payableId = transactionResult.data.payable?.id
  if (!payableId) {
    return apiError({
      code: 'ATOMICITY_FAILURE',
      message: 'La operación principal se guardó, pero no se generó la cuenta por pagar vinculada.',
    })
  }

  const { error: payableUpdateError } = await supabase
    .from('accounts_payable')
    .update({
      creditor_id,
      attachment_url,
    })
    .eq('id', payableId)
    .eq('user_id', userId)

  if (payableUpdateError) {
    return apiError({ code: 'DATABASE_ERROR', message: payableUpdateError.message })
  }

  const recurringTemplate = await createRecurringTemplate({
    supabase,
    userId,
    saveRecurring: save_recurring,
    recurringName: recurring_name,
    sourceAccountId: source_account_id,
    creditorId: creditor_id,
    categoryId: payableCategoryId,
    creditorName: creditor.name,
    amount,
    currency,
    description: concept ?? `Pago a ${creditor.name}`,
    notes,
  })

  const { data: createdPayable, error: fetchError } = await supabase
    .from('accounts_payable')
    .select(PAYABLE_SELECT)
    .eq('id', payableId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !createdPayable) {
    return apiCreated({
      payable: {
        ...transactionResult.data.payable,
        creditor_id,
        attachment_url,
      },
      transaction: transactionResult.data.transaction,
      recurring_template: recurringTemplate,
    })
  }

  return apiCreated({
    payable: normalizePayableRow(createdPayable as PayableResponseRow),
    transaction: transactionResult.data.transaction,
    recurring_template: recurringTemplate,
  })
}

async function createRecurringTemplate({
  supabase,
  userId,
  saveRecurring,
  recurringName,
  sourceAccountId,
  creditorId,
  categoryId,
  creditorName,
  amount,
  currency,
  description,
  notes,
}: {
  supabase: ReturnType<typeof createClient>
  userId: string
  saveRecurring: boolean
  recurringName: string
  sourceAccountId: string
  creditorId: string
  categoryId: string
  creditorName: string
  amount: number
  currency: 'PEN' | 'USD'
  description: string
  notes: string | null
}): Promise<CreateTransactionResult['recurring_template']> {
  if (!saveRecurring) return undefined

  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({
      user_id: userId,
      name: recurringName,
      type: 'INCOME',
      sub_type: 'PAYABLE_PAYMENT',
      source_account_id: sourceAccountId,
      category_id: categoryId,
      creditor_id: creditorId,
      amount,
      currency,
      description,
      recipient: creditorName,
      notes,
      is_active: true,
    })
    .select('id, name')
    .single()

  if (error) {
    return {
      created: false,
      name: recurringName,
      warning: error.message,
    }
  }

  return {
    created: true,
    id: data.id,
    name: data.name,
  }
}
