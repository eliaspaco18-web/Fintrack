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

const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
const zCurrency = z.enum(['PEN', 'USD'])
const zBudgetPeriod = z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'])

const zUpdateBudgetSchema = z.object({
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
  data => Object.keys(data).length > 0,
  { message: 'No hay campos para actualizar' },
)

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

  const parsed = zUpdateBudgetSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const payload = parsed.data

  const { data: current, error: currentError } = await supabase
    .from('budgets')
    .select('id, name, series_id, start_date, end_date')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (currentError || !current) {
    return apiError({ code: 'NOT_FOUND', message: 'Presupuesto no encontrado' })
  }

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

  const { data, error } = await supabase
    .from('budgets')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', userId)
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

  if (error || !data) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: error?.message ?? 'No se pudo actualizar el presupuesto',
    })
  }

  await createAppNotification(supabase, {
    userId,
    category: 'BUDGET',
    event: 'BUDGET_UPDATED',
    title: 'Presupuesto actualizado',
    message: `${data.name} fue actualizado correctamente.`,
    href: '/budgets',
    context: {
      budget_id: data.id,
      budget_name: data.name,
      budget_active: data.is_active,
    },
  })

  return apiOk(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('id, name')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (budgetError || !budget) {
    return apiError({ code: 'NOT_FOUND', message: 'Presupuesto no encontrado' })
  }

  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: error.message,
    })
  }

  await createAppNotification(supabase, {
    userId,
    category: 'BUDGET',
    event: 'BUDGET_DELETED',
    title: 'Presupuesto eliminado',
    message: `${budget.name} fue removido de tu módulo de presupuestos.`,
    href: '/budgets',
    context: {
      budget_id: budget.id,
      budget_name: budget.name,
    },
  })

  return apiNoContent()
}
