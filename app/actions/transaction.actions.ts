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
import { type Result, Errors }        from '@/modules/shared/result.types'
import type { CreateTransactionResult } from '@/modules/transactions/transaction.service.types'
import type { Transaction }           from '@/types/database.types'
import { sendTransactionNotificationEmail } from '@/lib/email/send-transaction-email'

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

  const result = await service.createTransaction(userId, parsed.data)

  if (result.ok) {
    if (parsed.data.is_recurring && parsed.data.recurring_name?.trim()) {
      const subType =
        parsed.data.type === 'EXPENSE' && parsed.data.receivable
          ? 'RECEIVABLE_LENDING'
          : parsed.data.type === 'INCOME' && parsed.data.payable
            ? 'PAYABLE_PAYMENT'
            : null

      const recurringPayload: RecurringInsertPayload = {
        user_id: userId,
        name: parsed.data.recurring_name.trim(),
        type: parsed.data.type,
        sub_type: subType,
        source_account_id: parsed.data.source_account_id,
        destination_account_id:
          parsed.data.type === 'TRANSFER' ? parsed.data.destination_account_id : null,
        category_id: parsed.data.category_id ?? null,
        budget_id: parsed.data.type === 'EXPENSE' ? parsed.data.budget_id ?? null : null,
        debtor_id: parsed.data.type === 'EXPENSE' ? parsed.data.receivable?.debtor_id ?? null : null,
        creditor_id: parsed.data.type === 'INCOME' ? parsed.data.payable?.creditor_id ?? null : null,
        amount: Number(parsed.data.amount),
        currency: parsed.data.currency,
        description: result.data.transaction.description?.trim() || null,
        payment_method: parsed.data.type === 'EXPENSE' ? parsed.data.payment_method ?? null : null,
        recipient: 'recipient' in parsed.data ? parsed.data.recipient?.trim() || null : null,
        sender: 'sender' in parsed.data ? parsed.data.sender?.trim() || null : null,
        notes: parsed.data.notes?.trim() || null,
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
    // Revalidar módulos que pudieran haberse creado
    if (result.data.asset)      revalidatePath('/assets')
    if (result.data.credit)     revalidatePath('/credits')
    if (result.data.loan)       revalidatePath('/credits')
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
