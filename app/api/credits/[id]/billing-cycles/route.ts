// =============================================================================
// app/api/credits/[id]/billing-cycles/route.ts
// POST /api/credits/:id/billing-cycles — crea un ciclo de facturación
// GET  /api/credits/:id/billing-cycles — lista ciclos del crédito
// PRD v3 — Módulo 4: Tarjeta de Crédito → Ciclos de Facturación
//
// Campos PRD:
//   billing_month, billing_year, consumption_from, consumption_to,
//   payment_date, total_to_pay, statement_url
//   Restricción: no duplicar Mes+Año para el mismo crédito
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import {
  BILLING_CYCLE_YEAR_START,
  getBillingCycleMaxYear,
  isBillingCycleYearInRange,
} from '@/lib/credits/billing-cycle-years'
import {
  apiCreated,
  apiError,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'

export const dynamic = 'force-dynamic'

const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')

const zBillingCycleSchema = z.object({
  billing_month: z.number().int().min(1).max(12),
  billing_year: z.number().int().min(BILLING_CYCLE_YEAR_START),
  consumption_from: zDate,
  consumption_to: zDate,
  payment_date: zDate,
  total_to_pay: z.number().min(0).default(0),
  notes: z.string().trim().max(500).optional().nullable(),
})

const zBillingCyclesReplaceSchema = z.object({
  cycles: z.array(zBillingCycleSchema).max(120),
})

type CardMovement = {
  id: string
  type: string
  description: string
  amount: number
  currency: string
  transaction_date: string
  payment_method: string | null
  source_account_id: string | null
  destination_account_id: string | null
}

function toMoney(value: unknown): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0
}

function summarizeCycle(params: {
  cycle: { consumption_from: string; consumption_to: string }
  movements: CardMovement[]
  accountId: string | null
  initialPen: number
  initialUsd: number
  includeInitial: boolean
}) {
  const periodMovements = params.movements.filter(movement => (
    movement.transaction_date >= params.cycle.consumption_from &&
    movement.transaction_date <= params.cycle.consumption_to
  ))
  const consumptions = periodMovements.filter(movement => (
    movement.type === 'EXPENSE' &&
    movement.source_account_id === params.accountId
  ))
  const payments = periodMovements.filter(movement => (
    movement.type === 'EXPENSE' &&
    movement.destination_account_id === params.accountId
  ))

  const sumByCurrency = (items: CardMovement[], currency: 'PEN' | 'USD') =>
    toMoney(items.reduce((sum, item) => sum + (item.currency === currency ? Number(item.amount ?? 0) : 0), 0))

  const consumptionPen = sumByCurrency(consumptions, 'PEN')
  const consumptionUsd = sumByCurrency(consumptions, 'USD')
  const paymentPen = sumByCurrency(payments, 'PEN')
  const paymentUsd = sumByCurrency(payments, 'USD')
  const initialPen = params.includeInitial ? params.initialPen : 0
  const initialUsd = params.includeInitial ? params.initialUsd : 0

  return {
    initial_pen: initialPen,
    initial_usd: initialUsd,
    consumption_pen: consumptionPen,
    consumption_usd: consumptionUsd,
    payment_pen: paymentPen,
    payment_usd: paymentUsd,
    total_pen: toMoney(initialPen + consumptionPen - paymentPen),
    total_usd: toMoney(initialUsd + consumptionUsd - paymentUsd),
    movement_count: periodMovements.length,
    consumptions,
    payments,
    movements: periodMovements,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: credit, error: creditError } = await supabase
    .from('credits')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (creditError || !credit) {
    return apiError({ code: 'NOT_FOUND', message: 'Crédito no encontrado' })
  }

  const { data, error } = await supabase
    .from('billing_cycles')
    .select('*')
    .eq('credit_id', params.id)
    .order('consumption_from', { ascending: true })

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })

  const cycles = data ?? []
  const accountId = credit.account_id as string | null
  const movementsResult = accountId
    ? await supabase
      .from('transactions')
      .select('id, type, description, amount, currency, transaction_date, payment_method, source_account_id, destination_account_id')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .or(`source_account_id.eq.${accountId},destination_account_id.eq.${accountId}`)
      .order('transaction_date', { ascending: false })
    : { data: [] as CardMovement[], error: null }

  if (movementsResult.error) {
    return apiError({ code: 'DATABASE_ERROR', message: movementsResult.error.message })
  }

  const movements = (movementsResult.data ?? []) as CardMovement[]
  const initialPen = toMoney((credit as Record<string, unknown>).initial_used_amount_pen ?? (credit as Record<string, unknown>).used_amount_pen)
  const initialUsd = toMoney((credit as Record<string, unknown>).initial_used_amount_usd ?? (credit as Record<string, unknown>).used_amount_usd)

  const enriched = cycles.map((cycle, index) => {
    const summary = summarizeCycle({
      cycle,
      movements,
      accountId,
      initialPen,
      initialUsd,
      includeInitial: index === 0,
    })

    return {
      ...cycle,
      total_to_pay: summary.total_pen,
      total_to_pay_pen: summary.total_pen,
      total_to_pay_usd: summary.total_usd,
      movement_summary: summary,
      can_delete: summary.movement_count === 0,
    }
  }).sort((a, b) => {
    const yearDiff = Number(b.billing_year) - Number(a.billing_year)
    if (yearDiff !== 0) return yearDiff
    return Number(b.billing_month) - Number(a.billing_month)
  })

  return apiOk(enriched)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  // Verificar que el crédito pertenece al usuario y es tipo CREDIT_CARD
  const { data: credit, error: creditError } = await supabase
    .from('credits')
    .select('id, credit_type')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (creditError || !credit) {
    return apiError({ code: 'NOT_FOUND', message: 'Crédito no encontrado' })
  }

  if (credit.credit_type !== 'CREDIT_CARD') {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Los ciclos de facturación solo aplican a tarjetas de crédito',
    })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zBillingCycleSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const { billing_month, billing_year, consumption_from, consumption_to, payment_date, total_to_pay, notes } = parsed.data
  if (!isBillingCycleYearInRange(billing_year)) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: `El año de facturación debe estar entre ${BILLING_CYCLE_YEAR_START} y ${getBillingCycleMaxYear()}.`,
    })
  }

  // Validar no duplicar Mes+Año para el mismo crédito
  const { data: existing } = await supabase
    .from('billing_cycles')
    .select('id')
    .eq('credit_id', params.id)
    .eq('billing_month', billing_month)
    .eq('billing_year', billing_year)
    .maybeSingle()

  if (existing) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: `Ya existe un ciclo para el mes ${billing_month}/${billing_year} en esta tarjeta`,
    })
  }

  const { data, error } = await supabase
    .from('billing_cycles')
    .insert({
      credit_id: params.id,
      billing_month,
      billing_year,
      consumption_from,
      consumption_to,
      payment_date,
      total_to_pay,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    return apiError({ code: 'DATABASE_ERROR', message: error?.message ?? 'No se pudo crear el ciclo' })
  }

  return apiCreated(data)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: credit, error: creditError } = await supabase
    .from('credits')
    .select('id, credit_type')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (creditError || !credit) {
    return apiError({ code: 'NOT_FOUND', message: 'Crédito no encontrado' })
  }

  if (credit.credit_type !== 'CREDIT_CARD') {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Los ciclos de facturación solo aplican a tarjetas de crédito',
    })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zBillingCyclesReplaceSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const seen = new Set<string>()
  for (const cycle of parsed.data.cycles) {
    if (!isBillingCycleYearInRange(cycle.billing_year)) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: `El año de facturación debe estar entre ${BILLING_CYCLE_YEAR_START} y ${getBillingCycleMaxYear()}.`,
      })
    }

    const key = `${cycle.billing_year}-${cycle.billing_month}`
    if (seen.has(key)) {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: `Hay ciclos duplicados para ${cycle.billing_month}/${cycle.billing_year}.`,
      })
    }
    seen.add(key)
  }

  const { error: deleteError } = await supabase
    .from('billing_cycles')
    .delete()
    .eq('credit_id', params.id)

  if (deleteError) return apiError({ code: 'DATABASE_ERROR', message: deleteError.message })

  if (parsed.data.cycles.length === 0) return apiOk([])

  const { data, error } = await supabase
    .from('billing_cycles')
    .insert(parsed.data.cycles.map(cycle => ({
      credit_id: params.id,
      billing_month: cycle.billing_month,
      billing_year: cycle.billing_year,
      consumption_from: cycle.consumption_from,
      consumption_to: cycle.consumption_to,
      payment_date: cycle.payment_date,
      total_to_pay: cycle.total_to_pay,
      notes: cycle.notes ?? null,
    })))
    .select()

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(data ?? [])
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // params.id aquí es el credit_id — se necesitaría un route distinto para el cycle id
  // Por diseño PRD, se elimina al eliminar el crédito completo
  return apiError({ code: 'METHOD_NOT_ALLOWED', message: 'Elimina el ciclo desde el detalle del crédito' })
}
