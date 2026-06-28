// =============================================================================
// app/actions/transaction.actions.ts
// Server Actions para operaciones transaccionales.
//
// CUÁNDO USAR Server Actions vs API Routes — ver explicación al final del módulo.
// Estos actions se llaman desde Client Components con formularios y desde
// Server Components para mutaciones directas.
// =============================================================================

'use server'

import { revalidatePath }             from 'next/cache'
import { createClient }               from '@/lib/supabase.server'
import { z }                          from 'zod'
import { TransactionService }         from '@/modules/transactions/transaction.service'
import {
  zCreateTransactionSchema,
  zUpdateTransactionSchema,
}                                     from '@/lib/schemas/transaction.schemas'
import { CategoryKeys }               from '@/lib/constants/category-keys'
import { type Result, Errors }        from '@/modules/shared/result.types'
import type { CreateTransactionResult } from '@/modules/transactions/transaction.service.types'
import type { Transaction }           from '@/types/database.types'
import { sendTransactionNotificationEmail } from '@/lib/email/send-transaction-email'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const zSettlementSchema = z.object({
  id: z.string().trim().min(1).max(120),
  source_account_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.enum(['PEN', 'USD']),
  exchange_rate: z.number().positive().optional(),
  description: z.string().trim().min(1).max(255),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).optional(),
})

type ReceivableSettlementTarget =
  | { kind: 'receivable'; receivableId: string }
  | { kind: 'debtor_total'; debtorId: string; currency: 'PEN' | 'USD' }

type PayableSettlementTarget =
  | { kind: 'payable'; payableId: string }
  | { kind: 'creditor_total'; creditorId: string; currency: 'PEN' | 'USD' }

type ReceivableSettlementRow = {
  id: string
  debtor_id: string | null
  debtor_name: string
  concept: string | null
  amount: number
  collected_amount: number
  collected_date: string | null
  currency: 'PEN' | 'USD'
  status: 'PENDING' | 'PARTIAL' | 'COLLECTED' | 'WRITTEN_OFF'
  issue_date: string
  due_date: string | null
}

type PayableSettlementRow = {
  id: string
  creditor_id: string | null
  creditor_name: string
  concept: string | null
  amount: number
  paid_amount: number
  paid_date: string | null
  currency: 'PEN' | 'USD'
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'DISPUTED'
  issue_date: string
  due_date: string | null
}

type RecurringInsertPayload = {
  user_id: string
  name: string
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  sub_type: 'ASSET_PURCHASE' | 'RECEIVABLE_LENDING' | 'PAYABLE_PAYMENT' | null
  source_account_id: string
  destination_account_id: string | null
  category_id: string | null
  budget_id: string | null
  debtor_id: string | null
  creditor_id: string | null
  amount: number
  currency: 'PEN' | 'USD'
  description: string | null
  payment_method: 'DEBIT' | 'CREDIT' | null
  recipient: string | null
  sender: string | null
  notes: string | null
  is_active: boolean
}

// ─── HELPER INTERNO ───────────────────────────────────────────────────────────

async function getServiceAndUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { service: null, userId: null, supabase }
  }

  return {
    service: new TransactionService(supabase),
    userId:  user.id,
    supabase,
  }
}

async function resolveUserCategoryIdBySystemKey(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  systemKey: string,
): Promise<Result<string>> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, is_system, user_id')
    .eq('system_key', systemKey)
    .or(`user_id.eq.${userId},is_system.eq.true`)
    .order('is_system', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) return Errors.database(error.message)
  if (!data?.id) return Errors.notFound('Categoría por defecto')
  return { ok: true, data: data.id }
}

function resolveAutomaticCategorySystemKey(
  input: z.infer<typeof zCreateTransactionSchema>,
): string | null {
  if (input.type === 'EXPENSE' && input.receivable) {
    return CategoryKeys.EXPENSE_RECEIVABLE_ISSUE
  }

  if (input.type === 'INCOME' && input.payable) {
    return CategoryKeys.INCOME_PAYABLE_ISSUE
  }

  return null
}

function parseReceivableSettlementTarget(rawId: string): ReceivableSettlementTarget | null {
  const id = rawId.trim()
  if (UUID_REGEX.test(id)) {
    return { kind: 'receivable', receivableId: id }
  }

  const match = /^debtor:([0-9a-f-]{36}):(PEN|USD)$/i.exec(id)
  if (!match) return null
  const debtorId = match[1]
  const currency = match[2]
  if (!debtorId || !currency) return null

  return {
    kind: 'debtor_total',
    debtorId,
    currency: currency.toUpperCase() as 'PEN' | 'USD',
  }
}

function parsePayableSettlementTarget(rawId: string): PayableSettlementTarget | null {
  const id = rawId.trim()
  if (UUID_REGEX.test(id)) {
    return { kind: 'payable', payableId: id }
  }

  const match = /^creditor:([0-9a-f-]{36}):(PEN|USD)$/i.exec(id)
  if (!match) return null
  const creditorId = match[1]
  const currency = match[2]
  if (!creditorId || !currency) return null

  return {
    kind: 'creditor_total',
    creditorId,
    currency: currency.toUpperCase() as 'PEN' | 'USD',
  }
}

function buildReceivableCollectionPlan(
  receivables: ReceivableSettlementRow[],
  amountToCollect: number,
  transactionDate: string,
) {
  let remaining = amountToCollect
  const plan: Array<{
    row: ReceivableSettlementRow
    nextCollectedAmount: number
    nextCollectedDate: string | null
    nextStatus: ReceivableSettlementRow['status']
  }> = []

  for (const row of receivables) {
    if (remaining <= 0) break

    const pendingAmount = Math.max(0, Number(row.amount) - Number(row.collected_amount))
    if (pendingAmount <= 0) continue

    const appliedAmount = Math.min(remaining, pendingAmount)
    const nextCollectedAmount = Math.round((Number(row.collected_amount) + appliedAmount) * 100) / 100
    const isFullyCollected = nextCollectedAmount >= Number(row.amount)

    plan.push({
      row,
      nextCollectedAmount,
      nextCollectedDate: isFullyCollected ? transactionDate : row.collected_date,
      nextStatus: isFullyCollected ? 'COLLECTED' : 'PARTIAL',
    })

    remaining = Math.round((remaining - appliedAmount) * 100) / 100
  }

  return {
    plan,
    remaining,
  }
}

function buildPayablePaymentPlan(
  payables: PayableSettlementRow[],
  amountToPay: number,
  transactionDate: string,
) {
  let remaining = amountToPay
  const plan: Array<{
    row: PayableSettlementRow
    nextPaidAmount: number
    nextPaidDate: string | null
    nextStatus: PayableSettlementRow['status']
  }> = []

  for (const row of payables) {
    if (remaining <= 0) break

    const pendingAmount = Math.max(0, Number(row.amount) - Number(row.paid_amount))
    if (pendingAmount <= 0) continue

    const appliedAmount = Math.min(remaining, pendingAmount)
    const nextPaidAmount = Math.round((Number(row.paid_amount) + appliedAmount) * 100) / 100
    const isFullyPaid = nextPaidAmount >= Number(row.amount)

    plan.push({
      row,
      nextPaidAmount,
      nextPaidDate: isFullyPaid ? transactionDate : row.paid_date,
      nextStatus: isFullyPaid ? 'PAID' : 'PARTIAL',
    })

    remaining = Math.round((remaining - appliedAmount) * 100) / 100
  }

  return {
    plan,
    remaining,
  }
}

// ─── CREAR TRANSACCIÓN ────────────────────────────────────────────────────────

/**
 * Crea una transacción y sus módulos derivados.
 * Usado desde el formulario principal de transacciones.
 *
 * Acepta FormData (desde <form>) o un objeto plano (desde código).
 */
export async function createTransactionAction(
  input: unknown
): Promise<Result<CreateTransactionResult>> {
  const { service, userId, supabase } = await getServiceAndUser()
  if (!service || !userId) return Errors.unauthorized()

  const parsed = zCreateTransactionSchema.safeParse(input)
  if (!parsed.success) {
    return Errors.validation(
      'Datos de transacción inválidos',
      parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' | ')
    )
  }

  const transactionInput = { ...parsed.data }
  if (!transactionInput.category_id) {
    const automaticCategorySystemKey = resolveAutomaticCategorySystemKey(transactionInput)
    if (automaticCategorySystemKey) {
      const categoryResult = await resolveUserCategoryIdBySystemKey(
        supabase,
        userId,
        automaticCategorySystemKey,
      )

      if (!categoryResult.ok) return categoryResult
      transactionInput.category_id = categoryResult.data
    }
  }

  const result = await service.createTransaction(userId, transactionInput)

  if (result.ok) {
    if (transactionInput.is_recurring && transactionInput.recurring_name?.trim()) {
      const subType =
        transactionInput.type === 'EXPENSE' && transactionInput.receivable
          ? 'RECEIVABLE_LENDING'
          : transactionInput.type === 'INCOME' && transactionInput.payable
            ? 'PAYABLE_PAYMENT'
            : null

      const recurringPayload: RecurringInsertPayload = {
        user_id: userId,
        name: transactionInput.recurring_name.trim(),
        type: transactionInput.type,
        sub_type: subType,
        source_account_id: transactionInput.source_account_id,
        destination_account_id:
          transactionInput.type === 'TRANSFER' ? transactionInput.destination_account_id : null,
        category_id: transactionInput.category_id ?? null,
        budget_id: transactionInput.type === 'EXPENSE' ? transactionInput.budget_id ?? null : null,
        debtor_id: transactionInput.type === 'EXPENSE' ? transactionInput.receivable?.debtor_id ?? null : null,
        creditor_id: transactionInput.type === 'INCOME' ? transactionInput.payable?.creditor_id ?? null : null,
        amount: Number(transactionInput.amount),
        currency: transactionInput.currency,
        description: result.data.transaction.description?.trim() || null,
        payment_method: transactionInput.type === 'EXPENSE' ? transactionInput.payment_method ?? null : null,
        recipient: 'recipient' in transactionInput ? transactionInput.recipient?.trim() || null : null,
        sender: 'sender' in transactionInput ? transactionInput.sender?.trim() || null : null,
        notes: transactionInput.notes?.trim() || null,
        is_active: true,
      }

      const { data: recurringData, error: recurringError } = await supabase
        .from('recurring_transactions')
        .insert(recurringPayload)
        .select('id, name')
        .single()

      if (recurringError) {
        result.data.recurring_template = {
          created: false,
          warning: recurringError.message,
          name: recurringPayload.name,
        }
      } else {
        result.data.recurring_template = {
          created: true,
          id: recurringData.id,
          name: recurringData.name,
        }
        revalidatePath('/recurring')
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/budgets')
    revalidatePath('/credits')
    // Revalidar módulos que pudieran haberse creado
    if (result.data.asset)      revalidatePath('/assets')
    if (result.data.receivable) revalidatePath('/receivables')
    if (result.data.payable)    revalidatePath('/payables')

    // Enviar email de notificación (non-blocking — no bloquea la respuesta)
    const tx = result.data.transaction
    sendTransactionNotificationEmail({
      userId:               userId,
      transactionId:        tx.id,
      type:                 tx.type as 'INCOME' | 'EXPENSE' | 'TRANSFER',
      amount:               Number(tx.amount),
      currency:             tx.currency as 'PEN' | 'USD',
      exchangeRate:         Number(tx.exchange_rate) !== 1 ? Number(tx.exchange_rate) : undefined,
      description:          tx.description,
      transactionDate:      tx.transaction_date,
      sourceAccountId:      tx.source_account_id,
      destinationAccountId: tx.destination_account_id ?? null,
      categoryId:           tx.category_id ?? null,
      notes:                tx.notes ?? null,
    }).catch(err => console.error('[createTransactionAction] email error:', err))

  }

  return result
}

export async function collectReceivableAction(
  input: unknown
): Promise<Result<CreateTransactionResult>> {
  const { service, userId, supabase } = await getServiceAndUser()
  if (!service || !userId) return Errors.unauthorized()

  const parsed = zSettlementSchema.safeParse(input)
  if (!parsed.success) {
    return Errors.validation(
      'Datos de cobro inválidos',
      parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' | ')
    )
  }

  const payload = parsed.data
  const target = parseReceivableSettlementTarget(payload.id)
  if (!target) {
    return Errors.validation('La cuenta por cobrar seleccionada no es válida.')
  }

  const receivablesQuery = supabase
    .from('accounts_receivable')
    .select('id, debtor_id, debtor_name, concept, amount, collected_amount, collected_date, currency, status, issue_date, due_date')
    .eq('user_id', userId)
    .in('status', ['PENDING', 'PARTIAL'])

  const receivablesResponse = target.kind === 'receivable'
    ? await receivablesQuery
      .eq('id', target.receivableId)
      .limit(1)
    : await receivablesQuery
      .eq('debtor_id', target.debtorId)
      .eq('currency', target.currency)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('issue_date', { ascending: true })

  const receivableRows = (receivablesResponse.data ?? []) as ReceivableSettlementRow[]
  if (receivablesResponse.error || receivableRows.length === 0) {
    return Errors.notFound('Cuenta por cobrar')
  }

  const normalizedRows = target.kind === 'receivable'
    ? receivableRows
    : [...receivableRows].sort((a, b) => {
      const byDue = (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31')
      if (byDue !== 0) return byDue
      return a.issue_date.localeCompare(b.issue_date)
    })
  const firstReceivable = normalizedRows[0]
  if (!firstReceivable) {
    return Errors.notFound('Cuenta por cobrar')
  }

  const settlementCurrency = target.kind === 'receivable'
    ? firstReceivable.currency
    : target.currency

  if (settlementCurrency !== payload.currency) {
    return Errors.validation('La moneda del cobro no coincide con la cuenta por cobrar.')
  }

  const totalPendingAmount = normalizedRows.reduce((sum, row) => (
    sum + Math.max(0, Number(row.amount) - Number(row.collected_amount))
  ), 0)

  if (payload.amount > totalPendingAmount) {
    return Errors.validation(
      'El cobro supera el saldo pendiente',
      `Saldo pendiente: ${totalPendingAmount.toFixed(2)} ${settlementCurrency}`
    )
  }

  const debtorName = firstReceivable.debtor_name ?? 'Deudor'

  const categoryResult = await resolveUserCategoryIdBySystemKey(
    supabase,
    userId,
    CategoryKeys.INCOME_RECEIVABLE_COLLECTION,
  )
  if (!categoryResult.ok) return categoryResult

  const result = await service.createTransaction(userId, {
    type: 'INCOME',
    source_account_id: payload.source_account_id,
    amount: payload.amount,
    currency: payload.currency,
    exchange_rate: payload.currency === 'USD' ? payload.exchange_rate : undefined,
    description: payload.description,
    transaction_date: payload.transaction_date,
    category_id: categoryResult.data,
    notes: payload.notes?.trim() || undefined,
    sender: debtorName,
  })

  if (!result.ok) return result

  const { error: transactionPatchError } = await supabase
    .from('transactions')
    .update({ debtor_id: firstReceivable.debtor_id })
    .eq('id', result.data.transaction.id)
    .eq('user_id', userId)

  if (transactionPatchError) {
    await service.deleteTransaction(userId, result.data.transaction.id, { force: true })
    return Errors.database(transactionPatchError.message)
  }

  const collectionPlan = buildReceivableCollectionPlan(
    normalizedRows,
    payload.amount,
    payload.transaction_date,
  )

  if (collectionPlan.remaining > 0) {
    await service.deleteTransaction(userId, result.data.transaction.id, { force: true })
    return Errors.businessRule(
      'No se pudo distribuir el cobro sobre las cuentas pendientes.',
      'Vuelve a abrir el formulario para refrescar los saldos.'
    )
  }

  const appliedUpdates: Array<{
    id: string
    original: Pick<ReceivableSettlementRow, 'collected_amount' | 'collected_date' | 'status'>
  }> = []

  try {
    for (const item of collectionPlan.plan) {
      const { error: updateError } = await supabase
        .from('accounts_receivable')
        .update({
          collected_amount: item.nextCollectedAmount,
          collected_date: item.nextCollectedDate,
          status: item.nextStatus,
        })
        .eq('id', item.row.id)
        .eq('user_id', userId)

      if (updateError) throw updateError

      appliedUpdates.push({
        id: item.row.id,
        original: {
          collected_amount: item.row.collected_amount,
          collected_date: item.row.collected_date,
          status: item.row.status,
        },
      })
    }
  } catch (caught) {
    await Promise.all(appliedUpdates.map(async applied => {
      await supabase
        .from('accounts_receivable')
        .update(applied.original)
        .eq('id', applied.id)
        .eq('user_id', userId)
    }))
    await service.deleteTransaction(userId, result.data.transaction.id, { force: true })
    const message = caught instanceof Error ? caught.message : 'No se pudo actualizar la cuenta por cobrar'
    return Errors.database(message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/receivables')
  return result
}

export async function payPayableAction(
  input: unknown
): Promise<Result<CreateTransactionResult>> {
  const { service, userId, supabase } = await getServiceAndUser()
  if (!service || !userId) return Errors.unauthorized()

  const parsed = zSettlementSchema.safeParse(input)
  if (!parsed.success) {
    return Errors.validation(
      'Datos de pago inválidos',
      parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' | ')
    )
  }

  const payload = parsed.data
  const target = parsePayableSettlementTarget(payload.id)
  if (!target) {
    return Errors.validation('La cuenta por pagar seleccionada no es válida.')
  }

  const payablesQuery = supabase
    .from('accounts_payable')
    .select('id, creditor_id, creditor_name, concept, amount, paid_amount, paid_date, currency, status, issue_date, due_date')
    .eq('user_id', userId)
    .in('status', ['PENDING', 'PARTIAL'])

  const payablesResponse = target.kind === 'payable'
    ? await payablesQuery
      .eq('id', target.payableId)
      .limit(1)
    : await payablesQuery
      .eq('creditor_id', target.creditorId)
      .eq('currency', target.currency)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('issue_date', { ascending: true })

  const payableRows = (payablesResponse.data ?? []) as PayableSettlementRow[]
  if (payablesResponse.error || payableRows.length === 0) {
    return Errors.notFound('Cuenta por pagar')
  }

  const normalizedRows = target.kind === 'payable'
    ? payableRows
    : [...payableRows].sort((a, b) => {
      const byDue = (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31')
      if (byDue !== 0) return byDue
      return a.issue_date.localeCompare(b.issue_date)
    })
  const firstPayable = normalizedRows[0]
  if (!firstPayable) {
    return Errors.notFound('Cuenta por pagar')
  }

  const settlementCurrency = target.kind === 'payable'
    ? firstPayable.currency
    : target.currency

  if (settlementCurrency !== payload.currency) {
    return Errors.validation('La moneda del pago no coincide con la cuenta por pagar.')
  }

  const totalPendingAmount = normalizedRows.reduce((sum, row) => (
    sum + Math.max(0, Number(row.amount) - Number(row.paid_amount))
  ), 0)

  if (payload.amount > totalPendingAmount) {
    return Errors.validation(
      'El pago supera el saldo pendiente',
      `Saldo pendiente: ${totalPendingAmount.toFixed(2)} ${settlementCurrency}`
    )
  }

  const creditorName = firstPayable.creditor_name ?? 'Acreedor'

  const categoryResult = await resolveUserCategoryIdBySystemKey(
    supabase,
    userId,
    CategoryKeys.EXPENSE_PAYABLE_PAYMENT,
  )
  if (!categoryResult.ok) return categoryResult

  const result = await service.createTransaction(userId, {
    type: 'EXPENSE',
    source_account_id: payload.source_account_id,
    amount: payload.amount,
    currency: payload.currency,
    exchange_rate: payload.currency === 'USD' ? payload.exchange_rate : undefined,
    description: payload.description,
    transaction_date: payload.transaction_date,
    category_id: categoryResult.data,
    notes: payload.notes?.trim() || undefined,
    recipient: creditorName,
  })

  if (!result.ok) return result

  const { error: transactionPatchError } = await supabase
    .from('transactions')
    .update({ creditor_id: firstPayable.creditor_id })
    .eq('id', result.data.transaction.id)
    .eq('user_id', userId)

  if (transactionPatchError) {
    await service.deleteTransaction(userId, result.data.transaction.id, { force: true })
    return Errors.database(transactionPatchError.message)
  }

  const paymentPlan = buildPayablePaymentPlan(
    normalizedRows,
    payload.amount,
    payload.transaction_date,
  )

  if (paymentPlan.remaining > 0) {
    await service.deleteTransaction(userId, result.data.transaction.id, { force: true })
    return Errors.businessRule(
      'No se pudo distribuir el pago sobre las cuentas pendientes.',
      'Vuelve a abrir el formulario para refrescar los saldos.'
    )
  }

  const appliedUpdates: Array<{
    id: string
    original: Pick<PayableSettlementRow, 'paid_amount' | 'paid_date' | 'status'>
  }> = []

  try {
    for (const item of paymentPlan.plan) {
      const { error: updateError } = await supabase
        .from('accounts_payable')
        .update({
          paid_amount: item.nextPaidAmount,
          paid_date: item.nextPaidDate,
          status: item.nextStatus,
        })
        .eq('id', item.row.id)
        .eq('user_id', userId)

      if (updateError) throw updateError

      appliedUpdates.push({
        id: item.row.id,
        original: {
          paid_amount: item.row.paid_amount,
          paid_date: item.row.paid_date,
          status: item.row.status,
        },
      })
    }
  } catch (caught) {
    await Promise.all(appliedUpdates.map(async applied => {
      await supabase
        .from('accounts_payable')
        .update(applied.original)
        .eq('id', applied.id)
        .eq('user_id', userId)
    }))
    await service.deleteTransaction(userId, result.data.transaction.id, { force: true })
    const message = caught instanceof Error ? caught.message : 'No se pudo actualizar la cuenta por pagar'
    return Errors.database(message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/payables')
  return result
}

// ─── ACTUALIZAR TRANSACCIÓN ───────────────────────────────────────────────────

export async function updateTransactionAction(
  id:    string,
  input: unknown
): Promise<Result<Transaction>> {
  const { service, userId } = await getServiceAndUser()
  if (!service || !userId) return Errors.unauthorized()

  const parsed = zUpdateTransactionSchema.safeParse(input)
  if (!parsed.success) {
    return Errors.validation(
      'Datos de actualización inválidos',
      parsed.error.issues.map(i => i.message).join(' | ')
    )
  }

  const result = await service.updateTransaction(userId, { id, ...parsed.data })

  if (result.ok) {
    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath(`/transactions/${id}`)
  }

  return result
}

// ─── ELIMINAR TRANSACCIÓN ─────────────────────────────────────────────────────

export async function deleteTransactionAction(
  id:    string,
  force = false
): Promise<Result<{ deleted: true; modules_unlinked: string[] }>> {
  const { service, userId } = await getServiceAndUser()
  if (!service || !userId) return Errors.unauthorized()

  const result = await service.deleteTransaction(userId, id, { force })

  if (result.ok) {
    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/assets')
    revalidatePath('/credits')
    revalidatePath('/receivables')
    revalidatePath('/payables')
  }

  return result
}

export async function deleteTransactionsBulkAction(
  ids: string[],
  force = false,
): Promise<Result<{
  deleted_ids: string[]
  deleted_count: number
  failed: Array<{ id: string; message: string; detail?: string }>
}>> {
  const { service, userId } = await getServiceAndUser()
  if (!service || !userId) return Errors.unauthorized()

  const parsed = z.array(z.string().uuid()).min(1).max(100).safeParse(ids)
  if (!parsed.success) {
    return Errors.validation(
      'Selección inválida',
      parsed.error.issues.map(issue => issue.message).join(' | ')
    )
  }

  const deletedIds: string[] = []
  const failed: Array<{ id: string; message: string; detail?: string }> = []

  for (const id of parsed.data) {
    const result = await service.deleteTransaction(userId, id, { force })
    if (result.ok) {
      deletedIds.push(id)
      continue
    }

    failed.push({
      id,
      message: result.error.message,
      detail: result.error.detail,
    })
  }

  if (deletedIds.length > 0) {
    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/assets')
    revalidatePath('/credits')
    revalidatePath('/receivables')
    revalidatePath('/payables')
  }

  if (deletedIds.length === 0) {
    return Errors.businessRule(
      'No se pudieron eliminar las transacciones seleccionadas.',
      failed.map(item => `${item.id}: ${item.detail ?? item.message}`).join(' | ')
    )
  }

  return {
    ok: true,
    data: {
      deleted_ids: deletedIds,
      deleted_count: deletedIds.length,
      failed,
    },
  }
}
