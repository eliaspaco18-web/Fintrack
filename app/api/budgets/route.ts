// =============================================================================
// app/api/budgets/route.ts
// GET  /api/budgets   — lista presupuestos con avance del período actual
// POST /api/budgets   — crea presupuesto
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import {
  buildBudgetMetrics as computeBudgetMetrics,
  resolveBudgetWindow,
  resolveBudgetWindowAtDate,
} from '@/lib/budgets/budget-metrics'
import { createAppNotification } from '@/lib/server/app-notifications'
import {
  apiCreated,
  apiError,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'
import type { BudgetPeriod, CurrencyCode } from '@/types/database.types'

const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
const zCurrency = z.enum(['PEN', 'USD'])
const zBudgetPeriod = z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'])

const zCreateBudgetSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  amount: z.number().positive(),
  currency: zCurrency.default('PEN'),
  period_type: zBudgetPeriod.default('MONTHLY'),
  start_date: zDate,
  end_date: zDate.nullable().optional(),
  is_active: z.boolean().default(true),
  notes: z.string().trim().max(500).nullable().optional(),
}).superRefine((payload, ctx) => {
  if (payload.end_date && payload.end_date < payload.start_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_date'],
      message: 'La fecha fin debe ser mayor o igual a la fecha inicio',
    })
  }
})

type BudgetCategoryRef = {
  id: string
  name: string
  scope: 'INCOME' | 'EXPENSE'
  icon: string
  color: string
} | null

type BudgetRow = {
  id: string
  series_id: string
  name: string
  description: string | null
  amount: number
  currency: CurrencyCode
  period_type: BudgetPeriod
  start_date: string
  end_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  category_id: string | null
  category?: BudgetCategoryRef
}

type ExpenseTxRow = {
  id: string
  amount: number
  currency: CurrencyCode
  exchange_rate: number | null
  budget_id: string | null
  transaction_date: string
}

type BudgetMetrics = {
  period_start: string
  period_end: string
  spent_amount: number
  remaining_amount: number
  progress_percent: number
  over_limit: boolean
}

function buildBudgetMetrics(
  budget: BudgetRow,
  transactions: ExpenseTxRow[],
): BudgetMetrics {
  return computeBudgetMetrics(budget, transactions)
}

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

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === 'true'
  const status = req.nextUrl.searchParams.get('status')?.toUpperCase()
  // Soporte directo para ?is_active=true/false (usado por TransactionForm y otros clientes)
  const isActiveParam = req.nextUrl.searchParams.get('is_active')
  const search = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const currency = req.nextUrl.searchParams.get('currency') as CurrencyCode | null
  const periodType = req.nextUrl.searchParams.get('period_type') as BudgetPeriod | null
  const categoryId = req.nextUrl.searchParams.get('category_id')
  const transactionDate = req.nextUrl.searchParams.get('transaction_date')

  if (transactionDate && !zDate.safeParse(transactionDate).success) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'transaction_date debe tener formato YYYY-MM-DD',
    })
  }

  let query = supabase
    .from('budgets')
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
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })

  // ?is_active toma precedencia sobre include_inactive/status si se especifica
  if (isActiveParam === 'true') {
    query = query.eq('is_active', true)
  } else if (isActiveParam === 'false') {
    query = query.eq('is_active', false)
  } else {
    // Comportamiento legacy: si no se pasa is_active, usar include_inactive/status
    if (!includeInactive) query = query.eq('is_active', true)
    if (status === 'ACTIVE') query = query.eq('is_active', true)
    if (status === 'INACTIVE') query = query.eq('is_active', false)
  }
  if (currency === 'PEN' || currency === 'USD') query = query.eq('currency', currency)
  if (periodType && ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'].includes(periodType)) query = query.eq('period_type', periodType)
  if (categoryId) query = query.eq('category_id', categoryId)

  const { data, error } = await query

  if (error) {
    return apiError({ code: 'DATABASE_ERROR', message: error.message })
  }

  let budgets = (data ?? []) as BudgetRow[]

  if (search.length >= 2) {
    budgets = budgets.filter(item => {
      const categoryName = item.category?.name?.toLowerCase() ?? ''
      return (
        item.name.toLowerCase().includes(search) ||
        categoryName.includes(search) ||
        (item.notes ?? '').toLowerCase().includes(search)
      )
    })
  }

  if (transactionDate) {
    budgets = budgets.filter(budget => resolveBudgetWindowAtDate(budget, transactionDate) !== null)
  }

  if (budgets.length === 0) {
    return apiOk([])
  }

  const windows = budgets.map(budget => resolveBudgetWindow(budget))
  const minDate = windows
    .map(window => window.start)
    .sort()[0]
  const maxDate = windows
    .map(window => window.end)
    .sort()
    .at(-1)

  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .select('id, amount, currency, exchange_rate, budget_id, transaction_date')
    .eq('user_id', userId)
    .eq('type', 'EXPENSE')
    .gte('transaction_date', minDate)
    .lte('transaction_date', maxDate)

  if (txError) {
    return apiError({ code: 'DATABASE_ERROR', message: txError.message })
  }

  const transactions = (txData ?? []) as ExpenseTxRow[]

  const enriched = budgets.map(budget => {
    const metrics = buildBudgetMetrics(budget, transactions)
    return {
      ...budget,
      ...metrics,
    }
  })

  return apiOk(enriched)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zCreateBudgetSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const payload = parsed.data

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
    .insert({
      user_id: userId,
      series_id: crypto.randomUUID(),
      name: payload.name,
      description: payload.description ?? null,
      category_id: payload.category_id ?? null,
      amount: payload.amount,
      currency: payload.currency,
      period_type: payload.period_type,
      start_date: payload.start_date,
      end_date: payload.end_date ?? null,
      is_active: payload.is_active,
      notes: payload.notes ?? null,
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

  if (error || !data) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: error?.message ?? 'No se pudo crear el presupuesto',
    })
  }

  await createAppNotification(supabase, {
    userId,
    category: 'BUDGET',
    event: 'BUDGET_CREATED',
    title: 'Presupuesto creado',
    message: `${data.name} quedó registrado correctamente.`,
    href: '/budgets',
    context: {
      budget_id: data.id,
      budget_name: data.name,
      budget_amount: data.amount,
      budget_currency: data.currency,
    },
  })

  return apiCreated(data)
}
