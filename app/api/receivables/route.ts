// =============================================================================
// app/api/receivables/route.ts
// PRD v3 — Módulo 7: Cuentas por Cobrar — GET (lista) + POST (crear)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { CategoryKeys } from '@/lib/constants/category-keys'
import { TransactionService } from '@/modules/transactions/transaction.service'
import { repairLegacyReceivableLinks } from '@/lib/server/receivable-link-repair'
import {
  apiCreated,
  apiError,
  apiUnauthorized,
  fromResult,
  getSessionUserId,
} from '@/lib/api/response'
import type { CreateTransactionResult } from '@/modules/transactions/transaction.service.types'

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
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const statusParam = req.nextUrl.searchParams.get('status')
  const debtorId = req.nextUrl.searchParams.get('debtor_id')
  const sortParam = req.nextUrl.searchParams.get('sort') ?? 'desc'

  const allowedStatus = ['PENDING', 'PARTIAL', 'COLLECTED', 'WRITTEN_OFF'] as const
  const status = allowedStatus.find(value => value === statusParam)
  if (statusParam && !status) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Parámetro status inválido' })
  }

  if (debtorId) {
    const { data: debtor } = await supabase
      .from('debtors')
      .select('id, name')
      .eq('id', debtorId)
      .eq('user_id', userId)
      .maybeSingle()

    if (debtor) {
      await repairLegacyReceivableLinks(supabase, userId, [debtor])
    }
  }

  let query = supabase
    .from('accounts_receivable')
    .select(RECEIVABLE_SELECT)
    .eq('user_id', userId)

  if (status) query = query.eq('status', status)
  if (debtorId) query = query.eq('debtor_id', debtorId)

  query = query.order('amount', { ascending: sortParam === 'asc' })

  const { data, error } = await query
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  return NextResponse.json({
    ok: true,
    data: (data ?? []).map(row => normalizeReceivableRow(row as ReceivableResponseRow)),
  })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const body = await req.json().catch(() => null)
  if (!body) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Cuerpo inválido' })
  }

  const debtorId = typeof body.debtor_id === 'string' ? body.debtor_id : null
  const concept = typeof body.concept === 'string' ? body.concept.trim() || null : null
  const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount)
  const currency = body.currency === 'USD' ? 'USD' : 'PEN'
  const issueDate = typeof body.issue_date === 'string'
    ? body.issue_date
    : new Date().toISOString().slice(0, 10)
  const dueDate = typeof body.due_date === 'string' ? body.due_date || null : null
  const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
  const attachmentUrl = typeof body.attachment_url === 'string' ? body.attachment_url || null : null
  const sourceAccountId = typeof body.source_account_id === 'string' ? body.source_account_id : ''
  const saveRecurring = body.save_recurring === true
  const recurringName = typeof body.recurring_name === 'string' ? body.recurring_name.trim() : ''

  if (!debtorId) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Selecciona un deudor válido.' })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'El monto debe ser mayor a 0.' })
  }
  if (!sourceAccountId) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Selecciona un portafolio.' })
  }
  if (saveRecurring && recurringName.length === 0) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Debes indicar un nombre para guardar la recurrente.',
    })
  }

  const { data: debtor, error: debtorError } = await supabase
    .from('debtors')
    .select('id, name')
    .eq('id', debtorId)
    .eq('user_id', userId)
    .single()

  if (debtorError || !debtor) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'El deudor seleccionado no existe o no te pertenece.',
    })
  }

  const { id: receivableCategoryId, error: receivableCategoryError } =
    await resolveUserCategoryIdBySystemKey(
      supabase,
      userId,
      CategoryKeys.EXPENSE_RECEIVABLE_ISSUE,
    )

  if (receivableCategoryError) {
    return apiError({ code: 'DATABASE_ERROR', message: receivableCategoryError.message })
  }

  if (!receivableCategoryId) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: 'No se encontró la categoría por defecto para cuentas por cobrar.',
    })
  }

  const service = new TransactionService(supabase)
  const transactionResult = await service.createTransaction(userId, {
    type: 'EXPENSE',
    source_account_id: sourceAccountId,
    amount,
    currency,
    description: concept ?? `Prestamo a ${debtor.name}`,
    transaction_date: issueDate,
    category_id: receivableCategoryId,
    notes: notes ?? undefined,
    recipient: debtor.name,
    receivable: {
      debtor_id: debtorId,
      debtor_name: debtor.name,
      due_date: dueDate ?? undefined,
      concept: concept ?? undefined,
      notes: notes ?? undefined,
    },
  })

  if (!transactionResult.ok) {
    return fromResult(transactionResult)
  }

  const receivableId = transactionResult.data.receivable?.id
  if (!receivableId) {
    return apiError({
      code: 'ATOMICITY_FAILURE',
      message: 'La operación principal se guardó, pero no se generó la cuenta por cobrar vinculada.',
    })
  }

  const { error: receivableUpdateError } = await supabase
    .from('accounts_receivable')
    .update({
      debtor_id: debtorId,
      attachment_url: attachmentUrl,
    })
    .eq('id', receivableId)
    .eq('user_id', userId)

  if (receivableUpdateError) {
    return apiError({ code: 'DATABASE_ERROR', message: receivableUpdateError.message })
  }

  const recurringTemplate = await createRecurringTemplate({
    supabase,
    userId,
    saveRecurring,
    recurringName,
    sourceAccountId,
    debtorId,
    categoryId: receivableCategoryId,
    debtorName: debtor.name,
    amount,
    currency,
    description: concept ?? `Prestamo a ${debtor.name}`,
    notes,
  })

  const { data: createdReceivable, error: fetchError } = await supabase
    .from('accounts_receivable')
    .select(RECEIVABLE_SELECT)
    .eq('id', receivableId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !createdReceivable) {
    return apiCreated({
      receivable: {
        ...transactionResult.data.receivable,
        debtor_id: debtorId,
        attachment_url: attachmentUrl,
      },
      transaction: transactionResult.data.transaction,
      recurring_template: recurringTemplate,
    })
  }

  return apiCreated({
    receivable: normalizeReceivableRow(createdReceivable as ReceivableResponseRow),
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
  debtorId,
  categoryId,
  debtorName,
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
  debtorId: string
  categoryId: string
  debtorName: string
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
      type: 'EXPENSE',
      sub_type: 'RECEIVABLE_LENDING',
      source_account_id: sourceAccountId,
      category_id: categoryId,
      debtor_id: debtorId,
      amount,
      currency,
      description,
      recipient: debtorName,
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
