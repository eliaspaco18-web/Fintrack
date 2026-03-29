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
import { TransactionService }         from '@/modules/transactions/transaction.service'
import {
  zCreateTransactionSchema,
  zUpdateTransactionSchema,
}                                     from '@/lib/schemas/transaction.schemas'
import { type Result, Errors }        from '@/modules/shared/result.types'
import type { CreateTransactionResult } from '@/modules/transactions/transaction.service.types'
import type { Transaction }           from '@/types/database.types'

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
  const { service, userId } = await getServiceAndUser()
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
    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    // Revalidar módulos que pudieran haberse creado
    if (result.data.asset)      revalidatePath('/assets')
    if (result.data.credit)     revalidatePath('/credits')
    if (result.data.loan)       revalidatePath('/credits')
    if (result.data.receivable) revalidatePath('/receivables')
    if (result.data.payable)    revalidatePath('/payables')
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
