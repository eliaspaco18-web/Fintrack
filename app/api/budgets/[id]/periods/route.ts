// =============================================================================
// app/api/budgets/[id]/periods/route.ts
// POST /api/budgets/:id/periods
//   — crea el siguiente período continuo dentro de la misma serie
// =============================================================================

import { createClient } from '@/lib/supabase.server'
import {
  apiCreated,
  apiError,
  apiUnauthorized,
  getSessionUserId,
} from '@/lib/api/response'
import type { BudgetPeriod } from '@/types/database.types'

interface Params {
  params: { id: string }
}

type BudgetSeriesRow = {
  id: string
  series_id: string
  name: string
  description: string | null
  category_id: string | null
  amount: number
  currency: string
  period_type: BudgetPeriod
  start_date: string
  end_date: string | null
  is_active: boolean
  notes: string | null
}

function parseISODate(date: string): Date {
  return new Date(`${date}T12:00:00Z`)
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function addPeriod(date: Date, period: BudgetPeriod): Date {
  const next = new Date(date)
  if (period === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + 7)
    return next
  }

  if (period === 'MONTHLY') {
    next.setUTCMonth(next.getUTCMonth() + 1)
    return next
  }

  if (period === 'QUARTERLY') {
    next.setUTCMonth(next.getUTCMonth() + 3)
    return next
  }

  next.setUTCFullYear(next.getUTCFullYear() + 1)
  return next
}

function calcEndDate(startDate: string, period: BudgetPeriod): string {
  const cycleStart = parseISODate(startDate)
  const cycleNext = addPeriod(cycleStart, period)
  return toISODate(addDays(cycleNext, -1))
}

function resolveEffectiveEndDate(budget: BudgetSeriesRow): string {
  return budget.end_date ?? calcEndDate(budget.start_date, budget.period_type)
}

export async function POST(_req: Request, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: sourceBudget, error: sourceError } = await supabase
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
      notes
    `)
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (sourceError || !sourceBudget) {
    return apiError({ code: 'NOT_FOUND', message: 'Presupuesto no encontrado' })
  }

  if (!sourceBudget.is_active) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Solo puedes continuar una serie desde un presupuesto activo.',
    })
  }

  const { data: seriesBudgets, error: seriesError } = await supabase
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
      notes
    `)
    .eq('user_id', userId)
    .eq('series_id', sourceBudget.series_id)

  if (seriesError) {
    return apiError({ code: 'DATABASE_ERROR', message: seriesError.message })
  }

  const latestBudget = ((seriesBudgets ?? []) as BudgetSeriesRow[])
    .sort((left, right) => resolveEffectiveEndDate(left).localeCompare(resolveEffectiveEndDate(right)))
    .at(-1)

  if (!latestBudget) {
    return apiError({
      code: 'NOT_FOUND',
      message: 'No se encontró una serie válida para continuar.',
    })
  }

  const lastEndDate = resolveEffectiveEndDate(latestBudget)
  const nextStartDate = toISODate(addDays(parseISODate(lastEndDate), 1))
  const nextEndDate = calcEndDate(nextStartDate, sourceBudget.period_type)

  const { data: insertedBudget, error: insertError } = await supabase
    .from('budgets')
    .insert({
      user_id: userId,
      series_id: sourceBudget.series_id,
      name: sourceBudget.name,
      description: sourceBudget.description,
      category_id: sourceBudget.category_id,
      amount: sourceBudget.amount,
      currency: sourceBudget.currency,
      period_type: sourceBudget.period_type,
      start_date: nextStartDate,
      end_date: nextEndDate,
      is_active: true,
      notes: sourceBudget.notes,
    })
    .select(`
      id,
      series_id,
      name,
      description,
      amount,
      currency,
      period_type,
      start_date,
      end_date,
      is_active,
      notes,
      created_at,
      updated_at,
      category_id,
      category:categories(id,name,scope,icon,color)
    `)
    .single()

  if (insertError || !insertedBudget) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: insertError?.message ?? 'No se pudo crear el siguiente período',
    })
  }

  return apiCreated(insertedBudget)
}
