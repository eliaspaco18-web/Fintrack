import { createClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized, fromResult, getSessionUserId } from '@/lib/api/response'
import { measureServerOperation } from '@/lib/server/observability'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import type {
  CashFlowProjectionEvent,
  CashFlowProjectionPoint,
  CashFlowProjectionResponse,
  ProjectionHorizon,
} from '@/lib/dashboard/types'

const DAY_IN_MS = 86_400_000
const HORIZON_DAYS = 90

type Currency = 'PEN' | 'USD'

function startOfTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function occurrenceDateForMonth(baseDay: number, year: number, monthIndex: number): string {
  const day = Math.min(baseDay, daysInMonth(year, monthIndex))
  return toIsoDate(new Date(Date.UTC(year, monthIndex, day)))
}

function horizonForDay(dayIndex: number): ProjectionHorizon {
  if (dayIndex <= 30) return '30D'
  if (dayIndex <= 60) return '60D'
  return '90D'
}

function confidenceForDay(dayIndex: number): number {
  if (dayIndex <= 30) return 1
  if (dayIndex <= 60) return 0.8
  return 0.6
}

function normalizeCurrency(currency: string): Currency {
  return currency === 'USD' ? 'USD' : 'PEN'
}

function toPenAmount(amount: number, currency: string, exchangeRate: number): number {
  return normalizeCurrency(currency) === 'USD' ? amount * exchangeRate : amount
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function pushEvent(map: Map<string, CashFlowProjectionEvent[]>, event: CashFlowProjectionEvent) {
  const events = map.get(event.date) ?? []
  events.push(event)
  map.set(event.date, events)
}

export async function GET() {
  return measureServerOperation('api.dashboard.projection', async () => {
    const supabase = createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) return apiUnauthorized()

    const service = new DashboardService(supabase)
    const summaryResult = await service.getSummary(userId, { includeDailyFlow: false })
    if (!summaryResult.ok) return fromResult(summaryResult)

    const summary = summaryResult.data
    const exchangeRate = summary.meta.exchangeRateUsdPen
    const currentBalance = summary.accounts.reduce((sum, account) => sum + account.balancePen, 0)

    const today = startOfTodayUtc()
    const horizonEnd = addDays(today, HORIZON_DAYS)
    const todayIso = toIsoDate(today)
    const horizonEndIso = toIsoDate(horizonEnd)

    const [
      recurringResult,
      receivablesResult,
      payablesResult,
      installmentsResult,
      activeCardsResult,
    ] = await Promise.all([
      supabase
        .from('recurring_transactions')
        .select('id, name, type, sub_type, amount, currency, created_at, is_active')
        .eq('user_id', userId)
        .eq('is_active', true),
      supabase
        .from('accounts_receivable')
        .select('id, debtor_name, concept, amount, collected_amount, currency, due_date, status')
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIAL'])
        .not('due_date', 'is', null)
        .gte('due_date', todayIso)
        .lte('due_date', horizonEndIso),
      supabase
        .from('accounts_payable')
        .select('id, creditor_name, concept, amount, paid_amount, currency, due_date, status')
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIAL'])
        .not('due_date', 'is', null)
        .gte('due_date', todayIso)
        .lte('due_date', horizonEndIso),
      supabase
        .from('installments')
        .select('id, due_date, installment_number, total_amount, status, loan:loans!inner(user_id, creditor_name, name, currency)')
        .eq('loan.user_id', userId)
        .neq('status', 'PAID')
        .gte('due_date', todayIso)
        .lte('due_date', horizonEndIso),
      supabase
        .from('credits')
        .select('id, name')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .eq('credit_type', 'CREDIT_CARD'),
    ])

    if (recurringResult.error) return apiError({ code: 'DATABASE_ERROR', message: recurringResult.error.message })
    if (receivablesResult.error) return apiError({ code: 'DATABASE_ERROR', message: receivablesResult.error.message })
    if (payablesResult.error) return apiError({ code: 'DATABASE_ERROR', message: payablesResult.error.message })
    if (installmentsResult.error) return apiError({ code: 'DATABASE_ERROR', message: installmentsResult.error.message })
    if (activeCardsResult.error) return apiError({ code: 'DATABASE_ERROR', message: activeCardsResult.error.message })

    const eventsByDate = new Map<string, CashFlowProjectionEvent[]>()
    let recurringMonthlyExpense = 0
    let recurringMonthlyIncome = 0

    for (const row of recurringResult.data ?? []) {
      if (row.type !== 'INCOME' && row.type !== 'EXPENSE') continue

      const amount = Number(row.amount ?? 0)
      const amountPen = toPenAmount(amount, row.currency, exchangeRate)
      const currency = normalizeCurrency(row.currency)

      if (row.type === 'INCOME') recurringMonthlyIncome += amountPen
      if (row.type === 'EXPENSE') recurringMonthlyExpense += amountPen

      const createdAt = new Date(row.created_at)
      const baseDay = Number.isFinite(createdAt.getUTCDate()) ? createdAt.getUTCDate() : today.getUTCDate()

      for (let offset = 0; offset <= 3; offset++) {
        const monthBase = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1))
        const date = occurrenceDateForMonth(baseDay, monthBase.getUTCFullYear(), monthBase.getUTCMonth())
        if (date < todayIso || date > horizonEndIso) continue

        pushEvent(eventsByDate, {
          id: `recurring-${row.id}-${date}`,
          label: row.name,
          amount,
          amountPen: roundMoney(amountPen),
          currency,
          date,
          type: row.type === 'INCOME' ? 'recurring_income' : 'recurring_expense',
        })
      }
    }

    for (const row of receivablesResult.data ?? []) {
      if (!row.due_date) continue
      const pending = Math.max(0, Number(row.amount ?? 0) - Number(row.collected_amount ?? 0))
      if (pending <= 0) continue

      pushEvent(eventsByDate, {
        id: `receivable-${row.id}`,
        label: row.concept?.trim() || row.debtor_name || 'Cuenta por cobrar',
        amount: pending,
        amountPen: roundMoney(toPenAmount(pending, row.currency, exchangeRate)),
        currency: normalizeCurrency(row.currency),
        date: row.due_date,
        type: 'receivable',
      })
    }

    for (const row of payablesResult.data ?? []) {
      if (!row.due_date) continue
      const pending = Math.max(0, Number(row.amount ?? 0) - Number(row.paid_amount ?? 0))
      if (pending <= 0) continue

      pushEvent(eventsByDate, {
        id: `payable-${row.id}`,
        label: row.concept?.trim() || row.creditor_name || 'Cuenta por pagar',
        amount: pending,
        amountPen: roundMoney(toPenAmount(pending, row.currency, exchangeRate)),
        currency: normalizeCurrency(row.currency),
        date: row.due_date,
        type: 'payable',
      })
    }

    for (const row of installmentsResult.data ?? []) {
      const loan = Array.isArray(row.loan) ? row.loan[0] : row.loan
      const currency = normalizeCurrency(loan?.currency ?? 'PEN')
      const amount = Number(row.total_amount ?? 0)
      if (amount <= 0) continue

      pushEvent(eventsByDate, {
        id: `installment-${row.id}`,
        label: `${loan?.name || loan?.creditor_name || 'Crédito'} · cuota ${row.installment_number}`,
        amount,
        amountPen: roundMoney(toPenAmount(amount, currency, exchangeRate)),
        currency,
        date: row.due_date,
        type: 'installment',
      })
    }

    const cardIds = (activeCardsResult.data ?? []).map((card) => card.id)
    if (cardIds.length > 0) {
      const cardNames = new Map((activeCardsResult.data ?? []).map((card) => [card.id, card.name]))
      const { data: cycles, error: cyclesError } = await supabase
        .from('billing_cycles')
        .select('id, credit_id, payment_date, total_to_pay')
        .in('credit_id', cardIds)
        .gte('payment_date', todayIso)
        .lte('payment_date', horizonEndIso)

      if (cyclesError) return apiError({ code: 'DATABASE_ERROR', message: cyclesError.message })

      for (const cycle of cycles ?? []) {
        const amount = Number(cycle.total_to_pay ?? 0)
        if (amount <= 0) continue

        pushEvent(eventsByDate, {
          id: `billing-cycle-${cycle.id}`,
          label: cardNames.get(cycle.credit_id) ?? 'Tarjeta de crédito',
          amount,
          amountPen: roundMoney(amount),
          currency: 'PEN',
          date: cycle.payment_date,
          type: 'billing_cycle',
        })
      }
    }

    let projectedBalance = currentBalance
    const projectionPoints: CashFlowProjectionPoint[] = []

    for (let dayIndex = 0; dayIndex <= HORIZON_DAYS; dayIndex++) {
      const date = toIsoDate(addDays(today, dayIndex))
      const events = eventsByDate.get(date) ?? []
      const inflows = events
        .filter((event) => event.type === 'recurring_income' || event.type === 'receivable')
        .reduce((sum, event) => sum + event.amountPen, 0)
      const outflows = events
        .filter((event) => event.type !== 'recurring_income' && event.type !== 'receivable')
        .reduce((sum, event) => sum + event.amountPen, 0)

      projectedBalance += inflows - outflows

      projectionPoints.push({
        date,
        horizon: horizonForDay(dayIndex),
        projectedBalance: roundMoney(projectedBalance),
        inflows: roundMoney(inflows),
        outflows: roundMoney(outflows),
        confidence: confidenceForDay(dayIndex),
        events,
      })
    }

    const payload: CashFlowProjectionResponse = {
      currentBalance: roundMoney(currentBalance),
      recurringMonthlyExpense: roundMoney(recurringMonthlyExpense),
      recurringMonthlyIncome: roundMoney(recurringMonthlyIncome),
      projectionPoints,
    }

    return apiOk(payload)
  }, { warnAtMs: 700 })
}
