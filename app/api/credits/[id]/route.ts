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
  credit_limit: z.number().positive().optional(),
  used_amount: z.number().min(0).optional(),
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

  const installmentsPromise = supabase
    .from('installments')
    .select('id, installment_number, due_date, principal_amount, interest_amount, total_amount, status, paid_amount, paid_date, loan:loans!inner(credit_id)')
    .eq('loan.credit_id', creditId)
    .order('installment_number')

  const consumptionPromise = isCreditCard && accountId
    ? supabase
      .from('transactions')
      .select('id, description, amount, currency, transaction_date, created_at')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .eq('source_account_id', accountId)
      .order('transaction_date', { ascending: false })
      .limit(20)
    : Promise.resolve({ data: [] as MovementRow[], error: null })

  const paymentPromise = isCreditCard && accountId
    ? supabase
      .from('transactions')
      .select('id, description, amount, currency, transaction_date, created_at')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .eq('destination_account_id', accountId)
      .order('transaction_date', { ascending: false })
      .limit(20)
    : Promise.resolve({ data: [] as MovementRow[], error: null })

  const [
    { data: installments, error: installmentsError },
    { data: consumptions, error: consumptionsError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    installmentsPromise,
    consumptionPromise,
    paymentPromise,
  ])

  if (installmentsError) {
    return apiError({ code: 'DATABASE_ERROR', message: installmentsError.message })
  }

  if (consumptionsError) {
    return apiError({ code: 'DATABASE_ERROR', message: consumptionsError.message })
  }

  if (paymentsError) {
    return apiError({ code: 'DATABASE_ERROR', message: paymentsError.message })
  }

  const safeConsumptions = (consumptions ?? []) as MovementRow[]
  const safePayments = (payments ?? []) as MovementRow[]
  const safeInstallments = installments ?? []

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
    .select('id, name, status, account_id, credit_type, credit_limit, used_amount')
    .eq('id', creditId)
    .eq('user_id', userId)
    .single()

  if (creditError || !credit) {
    return apiError({ code: 'NOT_FOUND', message: 'Crédito no encontrado' })
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

  if ((parsed.data.credit_limit !== undefined || parsed.data.used_amount !== undefined) && credit.credit_type !== 'CREDIT_CARD') {
    return apiError({
      code: 'BUSINESS_RULE_ERROR',
      message: 'Solo las tarjetas de crédito permiten ajustar límite y consumo desde este panel.',
    })
  }

  const nextCreditLimit = parsed.data.credit_limit ?? Number(credit.credit_limit ?? 0)
  const nextUsedAmount = parsed.data.used_amount ?? Number(credit.used_amount ?? 0)

  if (nextUsedAmount > nextCreditLimit) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'El monto usado no puede superar el límite de crédito.',
    })
  }

  const { data: updated, error: updateError } = await supabase
    .from('credits')
    .update({
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.credit_limit !== undefined ? { credit_limit: parsed.data.credit_limit } : {}),
      ...(parsed.data.used_amount !== undefined ? { used_amount: parsed.data.used_amount } : {}),
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
    .select('id, name, account_id, transaction_id, credit_type')
    .eq('id', creditId)
    .eq('user_id', userId)
    .single()

  if (creditError || !credit) {
    return apiError({ code: 'NOT_FOUND', message: 'Crédito no encontrado' })
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
        .eq('type', 'EXPENSE')
        .eq('source_account_id', credit.account_id)
      : Promise.resolve({ count: 0 as number | null, error: null }),
    credit.credit_type === 'CREDIT_CARD' && credit.account_id
      ? supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'EXPENSE')
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
