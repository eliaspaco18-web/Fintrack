// =============================================================================
// app/api/budgets/[id]/route.ts
// PATCH  /api/budgets/:id  — actualiza presupuesto
// DELETE /api/budgets/:id  — elimina presupuesto
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import { createAppNotification } from '@/lib/server/app-notifications'
import {
  apiError,
  apiNoContent,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'
import {
  BUDGET_SCOPE_CHANGED_ERROR,
  BUDGET_SCOPE_REQUIRED_ERROR,
  BUDGET_SCOPE_VERIFICATION_ERROR,
  checkBudgetRecordActionScope,
  type BudgetRecordActionScope,
} from '@/modules/budgets/budget-action-scope'

const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
const zCurrency = z.enum(['PEN', 'USD'])
const zBudgetPeriod = z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'])
const zBudgetRecordActionScope = z.object({
  kind: z.literal('RECORD'),
  record_id: z.string().uuid(),
  series_id: z.string().uuid(),
  start_date: zDate,
  end_date: zDate.nullable(),
  category_id: z.string().uuid().nullable(),
})

const zUpdateBudgetSchema = z.object({
  action_scope: zBudgetRecordActionScope,
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  amount: z.number().positive().optional(),
  currency: zCurrency.optional(),
  period_type: zBudgetPeriod.optional(),
  start_date: zDate.optional(),
  end_date: zDate.nullable().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine(
  data => Object.keys(data).some(key => key !== 'action_scope'),
  { message: 'No hay campos del periodo para actualizar' },
)

const zDeleteBudgetSchema = z.object({
  action_scope: zBudgetRecordActionScope,
})

async function validateBudgetCategory(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  categoryId: string,
) {
  const { data: category, error } = await supabase
    .from('categories')
    .select('id, name, scope, is_system, user_id')
    .eq('id', categoryId)
    .single()

  if (error || !category) {
    return { ok: false as const, status: 'VALIDATION_ERROR', message: 'La categoría seleccionada no existe.' }
  }

  if (!category.is_system && category.user_id !== userId) {
    return { ok: false as const, status: 'VALIDATION_ERROR', message: 'La categoría seleccionada no te pertenece.' }
  }

  if (category.scope === 'INCOME') {
    return {
      ok: false as const,
      status: 'BUSINESS_RULE_ERROR',
      message: 'Un presupuesto solo puede usar categorías de egreso.',
      detail: `Categoría recibida: ${category.name}.`,
    }
  }

  return { ok: true as const }
}

interface Params {
  params: { id: string }
}

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

  if (!body || typeof body !== 'object' || !Object.prototype.hasOwnProperty.call(body, 'action_scope')) {
    return apiError(BUDGET_SCOPE_REQUIRED_ERROR)
  }

  const parsed = zUpdateBudgetSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const { action_scope: actionScope, ...payload } = parsed.data

  const { data: current, error: currentError } = await supabase
    .from('budgets')
    .select('id, name, series_id, start_date, end_date, category_id')
    .eq('id', params.id)
    .eq('user_id', userId)
    .maybeSingle()

  const scopeCheck = checkBudgetRecordActionScope({
    current,
    expected: actionScope,
    verificationFailed: Boolean(currentError),
  })
  if (scopeCheck.status === 'UNAVAILABLE') return apiError(BUDGET_SCOPE_VERIFICATION_ERROR)
  if (scopeCheck.status === 'NOT_FOUND') {
    return apiError({ code: 'NOT_FOUND', message: 'Presupuesto no encontrado' })
  }
  if (scopeCheck.status === 'CHANGED') return apiError(BUDGET_SCOPE_CHANGED_ERROR)
  if (!current) return apiError(BUDGET_SCOPE_VERIFICATION_ERROR)

  const nextStartDate = payload.start_date ?? current.start_date
  const nextEndDate = payload.end_date === undefined ? current.end_date : payload.end_date
  if (nextEndDate && nextEndDate < nextStartDate) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'La fecha fin debe ser mayor o igual a la fecha inicio.',
      detail: `Rango recibido: ${nextStartDate} → ${nextEndDate}.`,
    })
  }

  if (payload.category_id) {
    const categoryValidation = await validateBudgetCategory(supabase, userId, payload.category_id)
    if (!categoryValidation.ok) {
      return apiError({
        code: categoryValidation.status,
        message: categoryValidation.message,
        detail: categoryValidation.detail,
      })
    }
  }

  let updateQuery = supabase
    .from('budgets')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', userId)

  updateQuery = updateQuery
    .eq('series_id', actionScope.series_id)
    .eq('start_date', actionScope.start_date)

  updateQuery = actionScope.end_date === null
    ? updateQuery.is('end_date', null)
    : updateQuery.eq('end_date', actionScope.end_date)

  updateQuery = actionScope.category_id === null
    ? updateQuery.is('category_id', null)
    : updateQuery.eq('category_id', actionScope.category_id)

  const { data, error } = await updateQuery
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
    .maybeSingle()

  if (error) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: 'No se pudo actualizar el periodo del presupuesto.',
      detail: 'No se aplicaron cambios confirmados. Intenta nuevamente.',
    })
  }

  if (!data) return apiError(BUDGET_SCOPE_CHANGED_ERROR)

  await createAppNotification(supabase, {
    userId,
    category: 'BUDGET',
    event: 'BUDGET_UPDATED',
    title: 'Periodo de presupuesto actualizado',
    message: `Se actualizo solo el periodo ${data.start_date}${data.end_date ? ` a ${data.end_date}` : ''} de ${data.name}.`,
    href: '/budgets',
    context: {
      budget_id: data.id,
      budget_name: data.name,
      budget_active: data.is_active,
    },
  })

  return apiOk(data)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError(BUDGET_SCOPE_REQUIRED_ERROR)
  }

  const parsed = zDeleteBudgetSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const actionScope: BudgetRecordActionScope = parsed.data.action_scope

  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('id, name, series_id, start_date, end_date, category_id')
    .eq('id', params.id)
    .eq('user_id', userId)
    .maybeSingle()

  const scopeCheck = checkBudgetRecordActionScope({
    current: budget,
    expected: actionScope,
    verificationFailed: Boolean(budgetError),
  })
  if (scopeCheck.status === 'UNAVAILABLE') return apiError(BUDGET_SCOPE_VERIFICATION_ERROR)
  if (scopeCheck.status === 'NOT_FOUND') {
    return apiError({ code: 'NOT_FOUND', message: 'Presupuesto no encontrado' })
  }
  if (scopeCheck.status === 'CHANGED') return apiError(BUDGET_SCOPE_CHANGED_ERROR)
  if (!budget) return apiError(BUDGET_SCOPE_VERIFICATION_ERROR)

  let deleteQuery = supabase
    .from('budgets')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  deleteQuery = deleteQuery
    .eq('series_id', actionScope.series_id)
    .eq('start_date', actionScope.start_date)

  deleteQuery = actionScope.end_date === null
    ? deleteQuery.is('end_date', null)
    : deleteQuery.eq('end_date', actionScope.end_date)

  deleteQuery = actionScope.category_id === null
    ? deleteQuery.is('category_id', null)
    : deleteQuery.eq('category_id', actionScope.category_id)

  const { data: deleted, error } = await deleteQuery
    .select('id')
    .maybeSingle()

  if (error) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: 'No se pudo eliminar el periodo del presupuesto.',
      detail: 'No se confirmo la eliminacion. Intenta nuevamente.',
    })
  }

  if (!deleted) return apiError(BUDGET_SCOPE_CHANGED_ERROR)

  await createAppNotification(supabase, {
    userId,
    category: 'BUDGET',
    event: 'BUDGET_DELETED',
    title: 'Periodo de presupuesto eliminado',
    message: `Se elimino solo el periodo ${budget.start_date}${budget.end_date ? ` a ${budget.end_date}` : ''} de ${budget.name}.`,
    href: '/budgets',
    context: {
      budget_id: budget.id,
      budget_name: budget.name,
    },
  })

  return apiNoContent()
}
