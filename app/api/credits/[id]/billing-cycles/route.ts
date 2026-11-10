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
import { randomUUID } from 'node:crypto'
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
import {
  ATTACHMENT_DELETE_BLOCKED_MESSAGE,
  ATTACHMENT_UPDATE_BLOCKED_MESSAGE,
  ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE,
  ATTACHMENT_VERIFICATION_FAILED_MESSAGE,
  hasUnsupportedAttachmentWrite,
} from '@/modules/attachments/attachment-integrity'
import { getBillingCyclesSubmissionIssue } from '@/modules/credits/billing-cycle-integrity'
import { readBoundedJsonBody } from '@/lib/api/read-bounded-json-body'

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

const zBillingCycleSaveSchema = zBillingCycleSchema.extend({ id: z.string().uuid().optional() })

const zBillingCyclesSaveSchema = z.object({
  cycles: z.array(zBillingCycleSaveSchema).max(120),
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
  movement_kind?: 'CONSUMPTION' | 'PAYMENT'
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
  const periodMovements = params.movements
    .filter(movement => (
      movement.transaction_date >= params.cycle.consumption_from &&
      movement.transaction_date <= params.cycle.consumption_to
    ))
    .map(movement => ({
      ...movement,
      movement_kind: movement.destination_account_id === params.accountId ? 'PAYMENT' : 'CONSUMPTION',
    } satisfies CardMovement))
  const consumptions = periodMovements.filter(movement => movement.movement_kind === 'CONSUMPTION')
  const payments = periodMovements.filter(movement => movement.movement_kind === 'PAYMENT')

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

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
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
      .in('type', ['EXPENSE', 'TRANSFER'])
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
      can_delete: summary.movement_count === 0 && !Boolean(cycle.statement_url?.trim()),
    }
  }).sort((a, b) => {
    const yearDiff = Number(b.billing_year) - Number(a.billing_year)
    if (yearDiff !== 0) return yearDiff
    return Number(b.billing_month) - Number(a.billing_month)
  })

  return apiOk(enriched)
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
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

  const bodyResult = await readBoundedJsonBody(req)
  if (!bodyResult.ok && bodyResult.reason === 'too_large') {
    return apiError({ code: 'PAYLOAD_TOO_LARGE', message: 'La solicitud supera el tamaño máximo permitido' })
  }
  if (!bodyResult.ok) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }
  const body = bodyResult.value

  if (hasUnsupportedAttachmentWrite(body, ['statement_url', 'statement_file', 'attachment'])) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE,
    })
  }

  const parsed = zBillingCycleSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const { billing_month, billing_year, consumption_from, consumption_to, payment_date, total_to_pay, notes } = parsed.data
  const cycleIssue = getBillingCyclesSubmissionIssue([parsed.data])
  if (cycleIssue) {
    return apiError({ code: 'VALIDATION_ERROR', message: cycleIssue })
  }

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

type PersistedBillingCycle = {
  id: string
  credit_id: string
  billing_month: number
  billing_year: number
  consumption_from: string
  consumption_to: string
  payment_date: string
  total_to_pay: number | string | null
  statement_url: string | null
  notes: string | null
}

type BillingCycleMutationInput = z.infer<typeof zBillingCycleSaveSchema>

function hasChangedPeriodIdentity(existing: PersistedBillingCycle, next: BillingCycleMutationInput) {
  return existing.billing_month !== next.billing_month
    || existing.billing_year !== next.billing_year
    || existing.consumption_from !== next.consumption_from
    || existing.consumption_to !== next.consumption_to
}

function hasChangedSchedule(existing: PersistedBillingCycle, next: BillingCycleMutationInput) {
  return hasChangedPeriodIdentity(existing, next) || existing.payment_date !== next.payment_date
}

function movementMatchesCycleRange(movement: { transaction_date: string }, cycle: Pick<PersistedBillingCycle, 'consumption_from' | 'consumption_to'>) {
  return movement.transaction_date >= cycle.consumption_from && movement.transaction_date <= cycle.consumption_to
}

async function hasLinkedMovementForChangedCycle(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  accountId: string | null
  existing: PersistedBillingCycle
  next?: BillingCycleMutationInput
}): Promise<{ ok: true; hasMovement: boolean } | { ok: false }> {
  const { supabase, userId, accountId, existing, next } = params
  if (!accountId) return { ok: true, hasMovement: false }

  const proposedRange = next ?? existing
  const from = existing.consumption_from < proposedRange.consumption_from
    ? existing.consumption_from
    : proposedRange.consumption_from
  const to = existing.consumption_to > proposedRange.consumption_to
    ? existing.consumption_to
    : proposedRange.consumption_to
  const pageSize = 500

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, transaction_date')
      .eq('user_id', userId)
      .in('type', ['EXPENSE', 'TRANSFER'])
      .or(`source_account_id.eq.${accountId},destination_account_id.eq.${accountId}`)
      .gte('transaction_date', from)
      .lte('transaction_date', to)
      .order('transaction_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error || !data) return { ok: false }
    if (data.some(movement => movementMatchesCycleRange(movement, existing)
      || (next && movementMatchesCycleRange(movement, next)))) {
      return { ok: true, hasMovement: true }
    }
    if (data.length < pageSize) return { ok: true, hasMovement: false }
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: credit, error: creditError } = await supabase
    .from('credits')
    .select('id, credit_type, account_id')
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

  const bodyResult = await readBoundedJsonBody(req)
  if (!bodyResult.ok && bodyResult.reason === 'too_large') {
    return apiError({ code: 'PAYLOAD_TOO_LARGE', message: 'La solicitud supera el tamaño máximo permitido' })
  }
  if (!bodyResult.ok) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }
  const body = bodyResult.value

  if (hasUnsupportedAttachmentWrite(body, ['statement_url', 'statement_file', 'attachment'])) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE,
    })
  }

  const parsed = zBillingCyclesSaveSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const cycleIssue = getBillingCyclesSubmissionIssue(parsed.data.cycles)
  if (cycleIssue) {
    return apiError({ code: 'VALIDATION_ERROR', message: cycleIssue })
  }

  const seenPeriods = new Set<string>()
  const seenIds = new Set<string>()
  for (const cycle of parsed.data.cycles) {
    if (!isBillingCycleYearInRange(cycle.billing_year)) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: `El año de facturación debe estar entre ${BILLING_CYCLE_YEAR_START} y ${getBillingCycleMaxYear()}.`,
      })
    }

    const key = `${cycle.billing_year}-${cycle.billing_month}`
    if (seenPeriods.has(key)) {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: `Hay ciclos duplicados para ${cycle.billing_month}/${cycle.billing_year}.`,
      })
    }
    seenPeriods.add(key)

    if (cycle.id) {
      if (seenIds.has(cycle.id)) {
        return apiError({ code: 'VALIDATION_ERROR', message: 'La lista contiene identificadores de ciclo duplicados.' })
      }
      seenIds.add(cycle.id)
    }
  }

  const existingResult = await supabase
    .from('billing_cycles')
    .select('id, credit_id, billing_month, billing_year, consumption_from, consumption_to, payment_date, total_to_pay, statement_url, notes')
    .eq('credit_id', params.id)
    .order('consumption_from', { ascending: true })

  if (existingResult.error || !existingResult.data) {
    return apiError({ code: 'BUSINESS_RULE_ERROR', message: ATTACHMENT_VERIFICATION_FAILED_MESSAGE })
  }

  const existingCycles = existingResult.data as PersistedBillingCycle[]
  const existingById = new Map(existingCycles.map(cycle => [cycle.id, cycle]))
  const submittedExistingById = new Map<string, BillingCycleMutationInput>()
  const updates: Array<{ existing: PersistedBillingCycle; next: BillingCycleMutationInput }> = []
  const newCycles: BillingCycleMutationInput[] = []

  for (const cycle of parsed.data.cycles) {
    const existing = cycle.id ? existingById.get(cycle.id) : undefined
    if (!existing) {
      newCycles.push(cycle)
      continue
    }

    submittedExistingById.set(existing.id, cycle)
    if (hasChangedSchedule(existing, cycle)) {
      if (existing.statement_url?.trim()) {
        return apiError({ code: 'BUSINESS_RULE_ERROR', message: ATTACHMENT_UPDATE_BLOCKED_MESSAGE })
      }
      updates.push({ existing, next: cycle })
    }
  }

  const removedCycles = existingCycles.filter(cycle => !submittedExistingById.has(cycle.id))
  if (removedCycles.some(cycle => cycle.statement_url?.trim())) {
    return apiError({ code: 'BUSINESS_RULE_ERROR', message: ATTACHMENT_DELETE_BLOCKED_MESSAGE })
  }

  const upsertRows: Array<{
    id: string
    credit_id: string
    billing_month: number
    billing_year: number
    consumption_from: string
    consumption_to: string
    payment_date: string
    total_to_pay?: number
    notes?: string | null
  }> = [
    ...updates.map(({ existing, next }) => ({
      id: existing.id,
      credit_id: params.id,
      billing_month: next.billing_month,
      billing_year: next.billing_year,
      consumption_from: next.consumption_from,
      consumption_to: next.consumption_to,
      payment_date: next.payment_date,
      // Omit statement_url, notes, and total_to_pay so the database retains
      // their verified values (including attachments and financial history).
    })),
    ...newCycles.map(cycle => ({
      id: randomUUID(),
      credit_id: params.id,
      billing_month: cycle.billing_month,
      billing_year: cycle.billing_year,
      consumption_from: cycle.consumption_from,
      consumption_to: cycle.consumption_to,
      payment_date: cycle.payment_date,
      total_to_pay: cycle.total_to_pay,
      notes: cycle.notes ?? null,
    })),
  ]

  if (removedCycles.length > 0 && upsertRows.length > 0) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Guarda primero los cambios o ciclos nuevos y elimina los periodos en una operación separada. No se realizaron cambios.',
    })
  }

  const movementSensitiveChanges: Array<{ existing: PersistedBillingCycle; next?: BillingCycleMutationInput }> = [
    ...removedCycles.map(existing => ({ existing })),
    ...updates.filter(({ existing, next }) => hasChangedPeriodIdentity(existing, next)),
  ]
  for (const change of movementSensitiveChanges) {
    const result = await hasLinkedMovementForChangedCycle({
      supabase,
      userId,
      accountId: credit.account_id as string | null,
      existing: change.existing,
      next: change.next,
    })
    if (!result.ok) {
      return apiError({ code: 'DATABASE_ERROR', message: 'No se pudo verificar si el ciclo tiene movimientos asociados. No se realizaron cambios.' })
    }
    if (result.hasMovement) {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: 'No se puede cambiar o eliminar un ciclo que tiene movimientos asociados.',
      })
    }
  }

  if (removedCycles.length > 1) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Elimina un ciclo por vez para verificar su integridad antes de cada cambio. No se realizaron cambios.',
    })
  }

  if (removedCycles.length === 1) {
    const { data, error } = await supabase
      .from('billing_cycles')
      .delete()
      .eq('credit_id', params.id)
      .eq('id', removedCycles[0]!.id)
      .is('statement_url', null)
      .select('id')

    if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
    if (!data || data.length !== 1) {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: 'El ciclo cambió o conserva un estado de cuenta. Actualiza la lista; no se eliminó.',
      })
    }
  }

  if (upsertRows.length === 0) return apiOk(existingCycles.filter(cycle => !removedCycles.some(removed => removed.id === cycle.id)))

  const { data, error } = await supabase
    .from('billing_cycles')
    .upsert(upsertRows, { onConflict: 'id' })
    .select('id, credit_id, billing_month, billing_year, consumption_from, consumption_to, payment_date, total_to_pay, statement_url, notes')

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(data ?? [])
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  // params.id aquí es el credit_id — se necesitaría un route distinto para el cycle id
  // Por diseño PRD, se elimina al eliminar el crédito completo
  return apiError({ code: 'METHOD_NOT_ALLOWED', message: 'Elimina el ciclo desde el detalle del crédito' })
}
