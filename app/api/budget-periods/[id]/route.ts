// =============================================================================
// app/api/budget-periods/[id]/route.ts
// PATCH /api/budget-periods/:id
//   — actualiza importe, estado o notas de un periodo presupuestal
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import {
  apiError,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'

interface Params {
  params: { id: string }
}

const zUpdateBudgetPeriodSchema = z.object({
  amount: z.number().positive().optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'CLOSED', 'SKIPPED']).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine(payload => Object.keys(payload).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar.',
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zUpdateBudgetPeriodSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const { data: period, error: periodError } = await supabase
    .from('budget_periods')
    .select('id, budget:budget_series(id,user_id)')
    .eq('id', params.id)
    .single()

  const budget = Array.isArray(period?.budget) ? period?.budget[0] : period?.budget
  if (periodError || !period || !budget || budget.user_id !== userId) {
    return apiError({ code: 'NOT_FOUND', message: 'Periodo presupuestal no encontrado' })
  }

  const payload = parsed.data
  const patch: Record<string, unknown> = {}
  if (typeof payload.amount === 'number') patch.amount = payload.amount
  if (payload.status) patch.status = payload.status
  if ('notes' in payload) patch.notes = payload.notes ?? null

  const { data, error } = await supabase
    .from('budget_periods')
    .update(patch)
    .eq('id', params.id)
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

  if (error || !data) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: error?.message ?? 'No se pudo actualizar el periodo presupuestal',
    })
  }

  return apiOk(data)
}
