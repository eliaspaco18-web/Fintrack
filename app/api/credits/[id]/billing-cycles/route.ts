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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  // Verificar que el crédito pertenece al usuario
  const { data: credit, error: creditError } = await supabase
    .from('credits')
    .select('id')
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
    .order('billing_year', { ascending: false })
    .order('billing_month', { ascending: false })

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(data ?? [])
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
