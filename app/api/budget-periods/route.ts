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

type LegacyBudgetPeriodRow = {
  id: string
  series_id: string
  name: string
  description: string | null
  category_id: string | null
  amount: number
  currency: CurrencyCode
  period_type: BudgetPeriod
  start_date: string
  end_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  category?: {
    id: string
    name: string
    scope: 'INCOME' | 'EXPENSE'
    icon: string
    color: string
  } | null
}

type NormalizedBudgetPeriodRow = BudgetPeriodRow & {
  budget: NonNullable<BudgetPeriodRow['budget']>
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
      budget:budget_series!inner(
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
    .eq('budget.user_id', userId)
    .order('period_start', { ascending: true })

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  const explicitPeriods = ((data ?? []) as BudgetPeriodRow[])
    .map(periodRow => ({
      ...periodRow,
      budget: pickSingle(periodRow.budget),
    }))
    .filter((periodRow): periodRow is NormalizedBudgetPeriodRow => Boolean(periodRow.budget))

  const explicitLegacyIds = new Set(
    explicitPeriods
      .map(periodRow => periodRow.legacy_budget_id)
      .filter((id): id is string => Boolean(id))
  )

  const { data: legacyData, error: legacyError } = await supabase
    .from('budgets')
    .select(`
      id,
      series_id,
      name,
      description,
      category_id,
      amount,
      currency,
      period_type,
      start_date,
      end_date,
      is_active,
      notes,
      created_at,
      updated_at,
      category:categories(id,name,scope,icon,color)
    `)
    .eq('user_id', userId)
    .lte('start_date', range.end)
    .gte('end_date', range.start)
    .order('start_date', { ascending: true })

  if (legacyError) return apiError({ code: 'DATABASE_ERROR', message: legacyError.message })

  const legacyPeriods: NormalizedBudgetPeriodRow[] = ((legacyData ?? []) as LegacyBudgetPeriodRow[])
    .filter(legacyRow => !explicitLegacyIds.has(legacyRow.id))
    .map(legacyRow => ({
      id: legacyRow.id,
      budget_id: legacyRow.series_id,
      legacy_budget_id: legacyRow.id,
      period_start: legacyRow.start_date,
      period_end: legacyRow.end_date ?? legacyRow.start_date,
      amount: Number(legacyRow.amount ?? 0),
      status: legacyRow.is_active ? 'ACTIVE' : 'CLOSED',
      notes: legacyRow.notes,
      created_at: legacyRow.created_at,
      updated_at: legacyRow.updated_at,
      budget: {
        id: legacyRow.series_id,
        name: legacyRow.name,
        description: legacyRow.description,
        category_id: legacyRow.category_id,
        currency: legacyRow.currency,
        period_type: legacyRow.period_type,
        is_active: legacyRow.is_active,
        category: legacyRow.category ?? null,
      },
    }))

  const periods = [...explicitPeriods, ...legacyPeriods]
    .sort((left, right) => {
      const startCompare = left.period_start.localeCompare(right.period_start)
      if (startCompare !== 0) return startCompare
      return left.budget.name.localeCompare(right.budget.name)
    })

  if (periods.length === 0) return apiOk([])

  const periodIds = explicitPeriods.map(item => item.id)
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

  const orParts: string[] = []
  if (periodIds.length > 0) {
    orParts.push(`budget_period_id.in.(${periodIds.join(',')})`)
  }
  if (legacyBudgetIds.length > 0) {
    orParts.push(`budget_id.in.(${legacyBudgetIds.join(',')})`)
  }

  if (orParts.length > 0) {
    txQuery = txQuery.or(orParts.join(','))
  }

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
