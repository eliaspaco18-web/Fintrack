// =============================================================================
// app/api/budget-periods/route.ts
// GET /api/budget-periods?period=YYYY-MM
//   — vista transversal de periodos presupuestales del mes seleccionado
// =============================================================================

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import {
  apiError,
  apiOk,
  apiUnauthorized,
  getSessionUserId,
} from '@/lib/api/response'
import {
  buildBudgetPeriodMetrics,
  monthRange,
  type BudgetPeriodMetricTransaction,
} from '@/lib/budgets/budget-periods'
import type { BudgetPeriod, CurrencyCode } from '@/types/database.types'

type BudgetPeriodRow = {
  id: string
  budget_id: string
  legacy_budget_id: string | null
  period_start: string
  period_end: string
  amount: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  budget: {
    id: string
    name: string
    description: string | null
    category_id: string | null
    currency: CurrencyCode
    period_type: BudgetPeriod
    is_active: boolean
    category?: {
      id: string
      name: string
      scope: 'INCOME' | 'EXPENSE'
      icon: string
      color: string
    } | null
  } | null
}

function pickSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const period = req.nextUrl.searchParams.get('period')
  const range = period ? monthRange(period) : null

  if (!period || !range) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'period debe tener formato YYYY-MM',
    })
  }

  const { data, error } = await supabase
    .from('budget_periods')
    .select(`
      id,
      budget_id,
      legacy_budget_id,
      period_start,
      period_end,
      amount,
      status,
      notes,
      created_at,
      updated_at,
      budget:budget_series(
        id,
        name,
        description,
        category_id,
        currency,
        period_type,
        is_active,
        category:categories(id,name,scope,icon,color)
      )
    `)
    .lte('period_start', range.end)
    .gte('period_end', range.start)
    .order('period_start', { ascending: true })

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  const periods = ((data ?? []) as BudgetPeriodRow[])
    .map(periodRow => ({
      ...periodRow,
      budget: pickSingle(periodRow.budget),
    }))
    .filter(periodRow => periodRow.budget)

  if (periods.length === 0) return apiOk([])

  const periodIds = periods.map(item => item.id)
  const legacyBudgetIds = periods
    .map(item => item.legacy_budget_id)
    .filter((id): id is string => Boolean(id))

  let txQuery = supabase
    .from('transactions')
    .select('amount, currency, exchange_rate, budget_id, budget_period_id, transaction_date')
    .eq('user_id', userId)
    .eq('type', 'EXPENSE')
    .gte('transaction_date', range.start)
    .lte('transaction_date', range.end)

  const orParts = [`budget_period_id.in.(${periodIds.join(',')})`]
  if (legacyBudgetIds.length > 0) {
    orParts.push(`budget_id.in.(${legacyBudgetIds.join(',')})`)
  }
  txQuery = txQuery.or(orParts.join(','))

  const { data: txData, error: txError } = await txQuery
  if (txError) return apiError({ code: 'DATABASE_ERROR', message: txError.message })

  const transactions = (txData ?? []) as BudgetPeriodMetricTransaction[]
  const enriched = periods.map(periodRow => {
    const budget = periodRow.budget!
    const metrics = buildBudgetPeriodMetrics(
      { currency: budget.currency },
      periodRow,
      transactions,
    )

    return {
      ...periodRow,
      budget,
      ...metrics,
    }
  })

  return apiOk(enriched)
}
