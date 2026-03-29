import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'

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

  const installmentsPromise = supabase
    .from('installments')
    .select('id, installment_number, due_date, principal_amount, interest_amount, total_amount, status, paid_amount, paid_date, loan:loans!inner(credit_id)')
    .eq('loan.credit_id', creditId)
    .order('installment_number')

  const consumptionPromise = accountId
    ? supabase
      .from('transactions')
      .select('id, description, amount, currency, transaction_date, created_at')
      .eq('user_id', userId)
      .eq('type', 'EXPENSE')
      .eq('source_account_id', accountId)
      .order('transaction_date', { ascending: false })
      .limit(20)
    : Promise.resolve({ data: [] as MovementRow[], error: null })

  const paymentPromise = accountId
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
  const billingCycles = buildBillingCycles(
    safeConsumptions,
    safePayments,
    Number(credit.closing_day ?? 0) || null,
    Number(credit.payment_day ?? 0) || null
  )

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
