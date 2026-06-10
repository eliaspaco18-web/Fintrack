// =============================================================================
// app/api/budgets/[id]/transactions/route.ts
// GET /api/budgets/:id/transactions
//   — lista transacciones de tipo EXPENSE vinculadas a un presupuesto
//     en el rango de fechas del período especificado
// =============================================================================

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import {
  apiError,
  apiOk,
  apiUnauthorized,
  getSessionUserId,
} from '@/lib/api/response'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface Params {
  params: { id: string }
}

type BudgetTransactionRow = {
  id: string
  description: string | null
  amount: number
  currency: string
  exchange_rate: number | null
  transaction_date: string
  recipient: string | null
  budget_id: string | null
  portfolio: { name: string } | { name: string }[] | null
}

function pickSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { id: budgetId } = params

  // Verificar que el presupuesto pertenece al usuario
  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('id, currency')
    .eq('id', budgetId)
    .eq('user_id', userId)
    .single()

  if (budgetError || !budget) {
    return apiError({ code: 'NOT_FOUND', message: 'Presupuesto no encontrado' })
  }

  // Período del query (obligatorio para drill-down)
  const periodStart = req.nextUrl.searchParams.get('period_start') ?? ''
  const periodEnd   = req.nextUrl.searchParams.get('period_end')   ?? ''

  if (!ISO_DATE.test(periodStart) || !ISO_DATE.test(periodEnd)) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Se requieren los parámetros period_start y period_end en formato YYYY-MM-DD',
    })
  }

  // Query base: egresos en el rango del período
  const query = supabase
    .from('transactions')
    .select(`
      id,
      description,
      amount,
      currency,
      exchange_rate,
      transaction_date,
      recipient,
      budget_id,
      portfolio:accounts!transactions_source_account_id_fkey(name)
    `)
    .eq('user_id', userId)
    .eq('type', 'EXPENSE')
    .eq('budget_id', budgetId)
    .gte('transaction_date', periodStart)
    .lte('transaction_date', periodEnd)
    .order('transaction_date', { ascending: false })

  const { data, error } = await query

  if (error) {
    return apiError({ code: 'DATABASE_ERROR', message: error.message })
  }

  const rows = ((data ?? []) as BudgetTransactionRow[])
    .map(tx => ({
      id: tx.id,
      date: tx.transaction_date,
      portfolio: pickSingle(tx.portfolio)?.name ?? null,
      recipient: tx.recipient,
      description: tx.description,
      amount: tx.amount,
      currency: tx.currency,
      exchange_rate: tx.exchange_rate,
    }))

  return apiOk(rows)
}
