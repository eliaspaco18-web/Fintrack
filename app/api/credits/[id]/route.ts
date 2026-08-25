import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import {
  apiError,
  apiNoContent,
  apiOk,
  apiUnauthorized,
  apiZodError,
  getSessionUserId,
} from '@/lib/api/response'
import { getLoanScheduleIntegrity } from '@/modules/credits/loan-schedule-integrity'
import {
  ATTACHMENT_DELETE_BLOCKED_MESSAGE,
  ATTACHMENT_UPDATE_BLOCKED_MESSAGE,
  hasCreditAttachmentReference,
} from '@/modules/attachments/attachment-integrity'

export const dynamic = 'force-dynamic'

type MovementRow = {
  id: string
  description: string
  amount: number
  currency: 'PEN' | 'USD'
  transaction_date: string
  created_at: string
}

type BillingCycle = {
  key: string
  start_date: string
  end_date: string
  due_date: string
  consumption_total: number
  payment_total: number
  balance_due: number
  status: 'PAID' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING'
  consumptions: MovementRow[]
  payments: MovementRow[]
}

const zUpdateCreditSchema = z.object({
  status: z.enum(['ACTIVE', 'CLOSED', 'BLOCKED']).optional(),
  name: z.string().trim().min(2).max(100).optional(),
  bank_entity_id: z.string().uuid().nullable().optional(),
  currency: z.enum(['PEN', 'USD']).optional(),
  credit_limit: z.number().positive().optional(),
  credit_limit_pen: z.number().min(0).optional(),
  credit_limit_usd: z.number().min(0).optional(),
  used_amount: z.number().min(0).optional(),
  used_amount_pen: z.number().min(0).optional(),
  used_amount_usd: z.number().min(0).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'No hay campos para actualizar' },
)

function parseIsoDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  return new Date(Date.UTC(year, month, day, 12, 0, 0))
}

function buildUtcDate(year: number, monthIndex: number, preferredDay: number): Date {
  const lastDayOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const safeDay = Math.max(1, Math.min(preferredDay, lastDayOfMonth))
  return new Date(Date.UTC(year, monthIndex, safeDay, 12, 0, 0))
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function firstPaymentDateAfter(endDate: Date, paymentDay: number): Date {
  let dueDate = buildUtcDate(endDate.getUTCFullYear(), endDate.getUTCMonth(), paymentDay)
  if (dueDate.getTime() <= endDate.getTime()) {
    dueDate = buildUtcDate(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, paymentDay)
  }
  return dueDate
}

function cycleFromConsumptionDate(date: Date, closingDay: number, paymentDay: number) {
  let endDate = buildUtcDate(date.getUTCFullYear(), date.getUTCMonth(), closingDay)
  if (date.getUTCDate() > endDate.getUTCDate()) {
    endDate = buildUtcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, closingDay)
  }
  const previousEnd = buildUtcDate(endDate.getUTCFullYear(), endDate.getUTCMonth() - 1, closingDay)
  const startDate = addDays(previousEnd, 1)
  const dueDate = firstPaymentDateAfter(endDate, paymentDay)

  return { startDate, endDate, dueDate }
}

function cycleFromPaymentDate(date: Date, closingDay: number, paymentDay: number) {
  let dueDate = buildUtcDate(date.getUTCFullYear(), date.getUTCMonth(), paymentDay)
  if (date.getTime() > dueDate.getTime()) {
    dueDate = buildUtcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, paymentDay)
  }

  const sameMonthClosing = buildUtcDate(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), closingDay)
  const endDate = sameMonthClosing.getTime() < dueDate.getTime()
    ? sameMonthClosing
    : buildUtcDate(dueDate.getUTCFullYear(), dueDate.getUTCMonth() - 1, closingDay)
  const previousEnd = buildUtcDate(endDate.getUTCFullYear(), endDate.getUTCMonth() - 1, closingDay)
  const startDate = addDays(previousEnd, 1)

  return { startDate, endDate, dueDate }
}

function buildBillingCycles(
  consumptions: MovementRow[],
  payments: MovementRow[],
  closingDay: number | null,
  paymentDay: number | null
): BillingCycle[] {
  if (!closingDay || !paymentDay) return []

  const cycleMap = new Map<string, BillingCycle>()
  const upsertCycle = (startDate: Date, endDate: Date, dueDate: Date) => {
    const key = toIsoDate(endDate)
    const existing = cycleMap.get(key)
    if (existing) return existing

    const cycle: BillingCycle = {
      key,
      start_date: toIsoDate(startDate),
      end_date: key,
      due_date: toIsoDate(dueDate),
      consumption_total: 0,
      payment_total: 0,
      balance_due: 0,
      status: 'UPCOMING',
      consumptions: [],
      payments: [],
    }
    cycleMap.set(key, cycle)
    return cycle
  }

  consumptions.forEach(item => {
    const movementDate = parseIsoDate(item.transaction_date)
    if (!movementDate) return
    const cycle = cycleFromConsumptionDate(movementDate, closingDay, paymentDay)
    const target = upsertCycle(cycle.startDate, cycle.endDate, cycle.dueDate)
    target.consumptions.push(item)
    target.consumption_total += Number(item.amount ?? 0)
  })

  payments.forEach(item => {
    const movementDate = parseIsoDate(item.transaction_date)
    if (!movementDate) return
    const cycle = cycleFromPaymentDate(movementDate, closingDay, paymentDay)
    const target = upsertCycle(cycle.startDate, cycle.endDate, cycle.dueDate)
    target.payments.push(item)
    target.payment_total += Number(item.amount ?? 0)
  })

  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12, 0, 0))

  const normalized = Array.from(cycleMap.values())
    .map(cycle => {
      const dueDate = parseIsoDate(cycle.due_date)
      const balanceDue = cycle.consumption_total - cycle.payment_total
      let status: BillingCycle['status'] = 'UPCOMING'

      if (balanceDue <= 0) {
        status = 'PAID'
      } else if (dueDate) {
        const diffDays = Math.ceil((dueDate.getTime() - todayUtc.getTime()) / 86_400_000)
        if (diffDays < 0) status = 'OVERDUE'
        else if (diffDays <= 5) status = 'DUE_SOON'
      }

      return {
        ...cycle,
        balance_due: balanceDue,
        status,
        consumptions: [...cycle.consumptions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
        payments: [...cycle.payments].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
      }
    })
    .sort((a, b) => b.end_date.localeCompare(a.end_date))

  return normalized
}

function hasDualCurrencyColumns(credit: Record<string, unknown>): boolean {
  return 'credit_limit_pen' in credit
    && 'credit_limit_usd' in credit
    && 'used_amount_pen' in credit
    && 'used_amount_usd' in credit
}

function hasInitialCurrencyColumns(credit: Record<string, unknown>): boolean {
  return 'initial_used_amount_pen' in credit
    && 'initial_used_amount_usd' in credit
}

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const creditId = context.params.id
  const { data: credit, error: creditError } = await supabase
    .from('credits')
    .select('*')
    .eq('id', creditId)
    .eq('user_id', userId)
    .single()

  if (creditError || !credit) {
    return apiError({ code: 'NOT_FOUND', message: 'Crédito no encontrado' })
  }

  const accountId = credit.account_id
  const isCreditCard = credit.credit_type === 'CREDIT_CARD'

  const loanPromise = isCreditCard
    ? Promise.resolve({ data: null, error: null })
    : supabase
      .from('loans')
      .select('id, total_installments')
      .eq('credit_id', creditId)
      .eq('user_id', userId)
      .maybeSingle()

  const installmentsPromise = isCreditCard
    ? Promise.resolve({ data: [], error: null })
    : supabase
      .from('installments')
      .select('id, installment_number, due_date, principal_amount, interest_amount, insurance_amount, other_charges, total_amount, status, paid_amount, paid_date, loan:loans!inner(credit_id, user_id)')
      .eq('loan.credit_id', creditId)
      .eq('loan.user_id', userId)
      .order('installment_number')

  const consumptionPromise = isCreditCard && accountId
    ? supabase
      .from('transactions')
      .select('id, description, amount, currency, transaction_date, created_at')
      .eq('user_id', userId)
      .in('type', ['EXPENSE', 'TRANSFER'])
      .eq('source_account_id', accountId)
      .order('transaction_date', { ascending: false })
      .limit(20)
    : Promise.resolve({ data: [] as MovementRow[], error: null })

  const paymentPromise = isCreditCard && accountId
    ? supabase
      .from('transactions')
      .select('id, description, amount, currency, transaction_date, created_at')
      .eq('user_id', userId)
      .in('type', ['EXPENSE', 'TRANSFER'])
      .eq('destination_account_id', accountId)
      .order('transaction_date', { ascending: false })
      .limit(20)
    : Promise.resolve({ data: [] as MovementRow[], error: null })

  const [
    { data: loan, error: loanError },
    { data: installments, error: installmentsError },
    { data: consumptions, error: consumptionsError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    loanPromise,
    installmentsPromise,
    consumptionPromise,
    paymentPromise,
  ])

  if (consumptionsError) {
    return apiError({ code: 'DATABASE_ERROR', message: consumptionsError.message })
  }

  if (paymentsError) {
    return apiError({ code: 'DATABASE_ERROR', message: paymentsError.message })
  }

  const safeConsumptions = (consumptions ?? []) as MovementRow[]
  const safePayments = (payments ?? []) as MovementRow[]
  const safeInstallments = installments ?? []
  const loanVerificationFailed = Boolean(loanError)
  const scheduleIntegrity = getLoanScheduleIntegrity({
    requiresSchedule: !isCreditCard && (loanVerificationFailed || Boolean(loan)),
    expectedInstallments: loan?.total_installments ?? null,
    installments: safeInstallments,
    verificationFailed: Boolean(loanError || installmentsError),
  })

  const consumptionTotal = safeConsumptions.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const paymentTotal = safePayments.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const paidInstallments = safeInstallments.filter(item => item.status === 'PAID').length
  const billingCycles = isCreditCard
    ? buildBillingCycles(
      safeConsumptions,
      safePayments,
      Number(credit.closing_day ?? 0) || null,
      Number(credit.payment_day ?? 0) || null
    )
    : []

  return apiOk({
    credit,
    installments: safeInstallments,
    schedule_integrity: {
      status: scheduleIntegrity.status,
      expected_installments: scheduleIntegrity.expectedInstallments,
      actual_installments: scheduleIntegrity.actualInstallments,
      is_complete: scheduleIntegrity.isComplete,
      message: scheduleIntegrity.message,
    },
    movements: {
      consumptions: safeConsumptions,
      payments: safePayments,
      billing_cycles: billingCycles,
    },
    summary: {
      used_amount: Number(credit.used_amount ?? 0),
      available_amount: Number(credit.available_amount ?? 0),
      credit_limit: Number(credit.credit_limit ?? 0),
      consumption_total_detected: consumptionTotal,
      payment_total_detected: paymentTotal,
      paid_installments: paidInstallments,
      total_installments: safeInstallments.length,
    },
  })
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zUpdateCreditSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const creditId = context.params.id
  const { data: credit, error: creditError } = await supabase
    .from('credits')
    .select('*')
    .eq('id', creditId)
    .eq('user_id', userId)
    .single()

  if (creditError || !credit) {
    return apiError({ code: 'NOT_FOUND', message: 'Crédito no encontrado' })
  }

  if (
    parsed.data.notes !== undefined
    && parsed.data.notes !== credit.notes
    && hasCreditAttachmentReference(credit.notes)
  ) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: ATTACHMENT_UPDATE_BLOCKED_MESSAGE,
    })
  }

  if (parsed.data.status && credit.status === parsed.data.status && Object.keys(parsed.data).length === 1) {
    return apiOk(credit)
  }

  if (parsed.data.status === 'ACTIVE' && credit.account_id) {
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, name, is_active')
      .eq('id', credit.account_id)
      .eq('user_id', userId)
      .single()

    if (accountError || !account) {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: 'No se pudo reactivar el crédito porque su cuenta asociada no existe.',
      })
    }

    if (!account.is_active) {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: 'No se puede reactivar el crédito porque la cuenta asociada está inactiva.',
        detail: `Cuenta vinculada: ${account.name}. Actívala en Portafolio y vuelve a intentar.`,
      })
    }
  }

  const updatesCardBalance = parsed.data.credit_limit !== undefined
    || parsed.data.credit_limit_pen !== undefined
    || parsed.data.credit_limit_usd !== undefined
    || parsed.data.used_amount !== undefined
    || parsed.data.used_amount_pen !== undefined
    || parsed.data.used_amount_usd !== undefined
    || parsed.data.currency !== undefined
    || parsed.data.bank_entity_id !== undefined

  if (updatesCardBalance && credit.credit_type !== 'CREDIT_CARD') {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Solo las tarjetas de crédito permiten ajustar emisor, moneda, límite y consumo desde este panel.',
    })
  }

  if (parsed.data.bank_entity_id) {
    const { data: bankEntity, error: bankEntityError } = await supabase
      .from('bank_entities')
      .select('id, is_active')
      .eq('id', parsed.data.bank_entity_id)
      .eq('user_id', userId)
      .single()

    if (bankEntityError || !bankEntity) {
      return apiError({ code: 'NOT_FOUND', message: 'Entidad bancaria no encontrada' })
    }

    if (!bankEntity.is_active) {
      return apiError({ code: 'BUSINESS_RULE_ERROR', message: 'La entidad bancaria seleccionada está inactiva' })
    }
  }

  const creditRow = credit as Record<string, unknown>
  const supportsDualCurrency = hasDualCurrencyColumns(creditRow)
  const supportsInitialCurrency = hasInitialCurrencyColumns(creditRow)
  const nextCurrency = parsed.data.currency ?? (credit.currency as 'PEN' | 'USD')
  const nextLimitPen = parsed.data.credit_limit_pen
    ?? (nextCurrency === 'PEN' && parsed.data.credit_limit !== undefined ? parsed.data.credit_limit : Number(creditRow.credit_limit_pen ?? 0))
  const nextLimitUsd = parsed.data.credit_limit_usd
    ?? (nextCurrency === 'USD' && parsed.data.credit_limit !== undefined ? parsed.data.credit_limit : Number(creditRow.credit_limit_usd ?? 0))
  let nextUsedPen = parsed.data.used_amount_pen
    ?? (nextCurrency === 'PEN' && parsed.data.used_amount !== undefined ? parsed.data.used_amount : Number(creditRow.used_amount_pen ?? 0))
  let nextUsedUsd = parsed.data.used_amount_usd
    ?? (nextCurrency === 'USD' && parsed.data.used_amount !== undefined ? parsed.data.used_amount : Number(creditRow.used_amount_usd ?? 0))
  const nextInitialPen = nextUsedPen
  const nextInitialUsd = nextUsedUsd

  if (credit.credit_type === 'CREDIT_CARD' && supportsInitialCurrency && credit.account_id) {
    const { data: cardMovements, error: cardMovementsError } = await supabase
      .from('transactions')
      .select('amount, currency, payment_method, source_account_id, destination_account_id, type')
      .eq('user_id', userId)
      .in('type', ['EXPENSE', 'TRANSFER'])
      .or(`source_account_id.eq.${credit.account_id},destination_account_id.eq.${credit.account_id}`)

    if (cardMovementsError) {
      return apiError({ code: 'DATABASE_ERROR', message: cardMovementsError.message })
    }

    const movementDelta = (currency: 'PEN' | 'USD') => (cardMovements ?? []).reduce((sum, movement) => {
      if (movement.currency !== currency) return sum
      const amount = Number(movement.amount ?? 0)
      if (movement.source_account_id === credit.account_id) return sum + amount
      if (movement.destination_account_id === credit.account_id) return sum - amount
      return sum
    }, 0)

    nextUsedPen = Math.max(Math.round((nextUsedPen + movementDelta('PEN')) * 100) / 100, 0)
    nextUsedUsd = Math.max(Math.round((nextUsedUsd + movementDelta('USD')) * 100) / 100, 0)
  }

  const nextCreditLimit = nextCurrency === 'PEN' ? nextLimitPen : nextLimitUsd
  const nextUsedAmount = nextCurrency === 'PEN' ? nextUsedPen : nextUsedUsd

  if (credit.credit_type === 'CREDIT_CARD' && nextCreditLimit <= 0) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'La línea de crédito debe ser mayor a 0.',
    })
  }

  if (credit.credit_type === 'CREDIT_CARD' && nextUsedAmount > nextCreditLimit) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'El consumo en la moneda de la línea no puede superar el límite de crédito.',
    })
  }

  if (credit.credit_type !== 'CREDIT_CARD') {
    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select('id, total_installments')
      .eq('credit_id', creditId)
      .eq('user_id', userId)
      .maybeSingle()

    if (loanError) {
      return apiError({
        code: 'BUSINESS_RULE_ERROR',
        message: 'No se pudo verificar el cronograma del crédito. No se realizaron cambios.',
      })
    }

    if (loan) {
      const { data: installments, error: installmentsError } = await supabase
        .from('installments')
        .select('installment_number, due_date, principal_amount, interest_amount, insurance_amount, other_charges, total_amount')
        .eq('loan_id', loan.id)
        .order('installment_number')

      const scheduleIntegrity = getLoanScheduleIntegrity({
        requiresSchedule: true,
        expectedInstallments: loan.total_installments,
        installments: installments ?? [],
        verificationFailed: Boolean(installmentsError),
      })

      if (!scheduleIntegrity.isComplete) {
        return apiError({
          code: 'BUSINESS_RULE_ERROR',
          message: 'El crédito no se actualizó porque su cronograma no pudo verificarse como completo.',
          detail: scheduleIntegrity.message ?? undefined,
        })
      }
    }
  }

  const dualCurrencyUpdate = supportsDualCurrency
    ? {
      currency: nextCurrency,
      credit_limit: nextCreditLimit,
      credit_limit_pen: nextLimitPen,
      credit_limit_usd: nextLimitUsd,
      used_amount: nextUsedAmount,
      used_amount_pen: nextUsedPen,
      used_amount_usd: nextUsedUsd,
      ...(supportsInitialCurrency ? {
        initial_used_amount_pen: nextInitialPen,
        initial_used_amount_usd: nextInitialUsd,
      } : {}),
    }
    : {
      currency: nextCurrency,
      credit_limit: nextCreditLimit,
      used_amount: nextUsedAmount,
    }

  const { data: updated, error: updateError } = await supabase
    .from('credits')
    .update({
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.bank_entity_id !== undefined ? { bank_entity_id: parsed.data.bank_entity_id } : {}),
      ...(credit.credit_type === 'CREDIT_CARD' ? dualCurrencyUpdate : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', creditId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (updateError || !updated) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: updateError?.message ?? 'No se pudo actualizar el crédito',
    })
  }

  return apiOk(updated)
}

export async function DELETE(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const creditId = context.params.id
  const { data: credit, error: creditError } = await supabase
    .from('credits')
    .select('id, name, account_id, transaction_id, credit_type, notes')
    .eq('id', creditId)
    .eq('user_id', userId)
    .single()

  if (creditError || !credit) {
    return apiError({ code: 'NOT_FOUND', message: 'Crédito no encontrado' })
  }

  if (hasCreditAttachmentReference(credit.notes)) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: ATTACHMENT_DELETE_BLOCKED_MESSAGE,
    })
  }

  const { count: billingAttachmentCount, error: billingAttachmentError } = await supabase
    .from('billing_cycles')
    .select('id', { count: 'exact', head: true })
    .eq('credit_id', creditId)
    .not('statement_url', 'is', null)

  if (billingAttachmentError) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: 'No se pudieron verificar los adjuntos del crédito.',
    })
  }

  if ((billingAttachmentCount ?? 0) > 0) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: ATTACHMENT_DELETE_BLOCKED_MESSAGE,
    })
  }

  const [
    { count: loanCount, error: loanError },
    { count: installmentCount, error: installmentError },
    { count: disbursementTxCount, error: disbursementError },
    consumptionResult,
    paymentResult,
  ] = await Promise.all([
    supabase
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('credit_id', creditId),
    supabase
      .from('installments')
      .select('id, loan:loans!inner(credit_id, user_id)', { count: 'exact', head: true })
      .eq('loan.credit_id', creditId)
      .eq('loan.user_id', userId),
    credit.transaction_id
      ? supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('id', credit.transaction_id)
      : Promise.resolve({ count: 0 as number | null, error: null }),
    credit.credit_type === 'CREDIT_CARD' && credit.account_id
      ? supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('type', ['EXPENSE', 'TRANSFER'])
        .eq('source_account_id', credit.account_id)
      : Promise.resolve({ count: 0 as number | null, error: null }),
    credit.credit_type === 'CREDIT_CARD' && credit.account_id
      ? supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('type', ['EXPENSE', 'TRANSFER'])
        .eq('destination_account_id', credit.account_id)
      : Promise.resolve({ count: 0 as number | null, error: null }),
  ])

  if (loanError || installmentError || disbursementError || consumptionResult.error || paymentResult.error) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: loanError?.message
        ?? installmentError?.message
        ?? disbursementError?.message
        ?? consumptionResult.error?.message
        ?? paymentResult.error?.message
        ?? 'No se pudo validar las relaciones del crédito',
    })
  }

  const blockers: string[] = []

  if ((loanCount ?? 0) > 0) {
    blockers.push(`Préstamos vinculados: ${loanCount}`)
  }
  if ((installmentCount ?? 0) > 0) {
    blockers.push(`Cuotas vinculadas: ${installmentCount}`)
  }
  if ((disbursementTxCount ?? 0) > 0) {
    blockers.push(`Transacción de desembolso: ${disbursementTxCount}`)
  }

  const accountTxCount = (consumptionResult.count ?? 0) + (paymentResult.count ?? 0)
  if (accountTxCount > 0) {
    blockers.push(
      `Movimientos de la tarjeta (consumos/pagos): ${accountTxCount}`
      + ` (consumos: ${consumptionResult.count ?? 0}, pagos: ${paymentResult.count ?? 0})`
    )
  }

  if (blockers.length > 0) {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'No se puede eliminar el crédito porque tiene registros relacionados.',
      detail: `Dependencias detectadas -> ${blockers.join(' · ')}.`,
    })
  }

  const { error: deleteError } = await supabase
    .from('credits')
    .delete()
    .eq('id', creditId)
    .eq('user_id', userId)

  if (deleteError) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: deleteError.message,
    })
  }

  return apiNoContent()
}
