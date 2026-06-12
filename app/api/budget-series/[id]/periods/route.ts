// =============================================================================
// app/api/budget-series/[id]/periods/route.ts
// POST /api/budget-series/:id/periods
//   — crea el siguiente periodo explicito de una serie presupuestal
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import {
  apiCreated,
  apiError,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'
import {
  calcBudgetPeriodEnd,
  nextBudgetPeriodStart,
} from '@/lib/budgets/budget-periods'
import type { BudgetPeriod } from '@/types/database.types'

interface Params {
  params: { id: string }
}

type BudgetSeriesRow = {
  id: string
  user_id: string
  default_amount: number
  period_type: BudgetPeriod
  is_active: boolean
}

type BudgetPeriodRow = {
  id: string
  period_start: string
  period_end: string
}

const zCreatePeriodSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.number().positive().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const parsed = zCreatePeriodSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const { data: series, error: seriesError } = await supabase
    .from('budget_series')
    .select('id, user_id, default_amount, period_type, is_active')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (seriesError || !series) {
    return apiError({ code: 'NOT_FOUND', message: 'Presupuesto no encontrado' })
  }

  const budgetSeries = series as BudgetSeriesRow
  if (!budgetSeries.is_active) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Solo puedes crear periodos en una serie activa.',
    })
  }

  const { data: periodData, error: periodsError } = await supabase
    .from('budget_periods')
    .select('id, period_start, period_end')
    .eq('budget_id', budgetSeries.id)
    .order('period_end', { ascending: false })
    .limit(1)

  if (periodsError) {
    return apiError({ code: 'DATABASE_ERROR', message: periodsError.message })
  }

  const latestPeriod = ((periodData ?? []) as BudgetPeriodRow[])[0] ?? null
  const startDate = parsed.data.period_start ?? (
    latestPeriod
      ? nextBudgetPeriodStart(latestPeriod.period_end)
      : new Date().toISOString().slice(0, 10)
  )
  const endDate = calcBudgetPeriodEnd(startDate, budgetSeries.period_type)

  const { data: inserted, error: insertError } = await supabase
    .from('budget_periods')
    .insert({
      budget_id: budgetSeries.id,
      period_start: startDate,
      period_end: endDate,
      amount: parsed.data.amount ?? budgetSeries.default_amount,
      status: 'ACTIVE',
      notes: parsed.data.notes ?? null,
    })
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
      updated_at
    `)
    .single()

  if (insertError || !inserted) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: insertError?.message ?? 'No se pudo crear el periodo presupuestal',
    })
  }

  return apiCreated(inserted)
}
