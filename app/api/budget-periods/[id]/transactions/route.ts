// =============================================================================
// app/api/budget-periods/[id]/transactions/route.ts
// GET /api/budget-periods/:id/transactions
//   — lista movimientos asociados al periodo presupuestal explicito
// =============================================================================

import { createClient } from '@/lib/supabase.server'
import {
  apiError,
  apiOk,
  apiUnauthorized,
  getSessionUserId,
} from '@/lib/api/response'

interface Params {
  params: { id: string }
}

type BudgetPeriodRef = {
  id: string
  legacy_budget_id: string | null
  period_start: string
  period_end: string
  budget: { user_id: string } | { user_id: string }[] | null
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
  budget_period_id: string | null
  portfolio: { name: string } | { name: string }[] | null
}

function pickSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function GET(_req: Request, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: period, error: periodError } = await supabase
    .from('budget_periods')
    .select(`
      id,
      legacy_budget_id,
      period_start,
      period_end,
      budget:budget_series(user_id)
    `)
    .eq('id', params.id)
    .single()

  const periodRef = period as BudgetPeriodRef | null
  const budget = pickSingle(periodRef?.budget)
  if (periodError || !periodRef || !budget || budget.user_id !== userId) {
    return apiError({ code: 'NOT_FOUND', message: 'Periodo presupuestal no encontrado' })
  }

  let query = supabase
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
      budget_period_id,
      portfolio:accounts!transactions_source_account_id_fkey(name)
    `)
    .eq('user_id', userId)
    .eq('type', 'EXPENSE')
    .gte('transaction_date', periodRef.period_start)
    .lte('transaction_date', periodRef.period_end)
    .order('transaction_date', { ascending: false })

  const orParts = [`budget_period_id.eq.${periodRef.id}`]
  if (periodRef.legacy_budget_id) {
    orParts.push(`budget_id.eq.${periodRef.legacy_budget_id}`)
  }
  query = query.or(orParts.join(','))

  const { data, error } = await query
  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  const rows = ((data ?? []) as BudgetTransactionRow[]).map(tx => ({
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
