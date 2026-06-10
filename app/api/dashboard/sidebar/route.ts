// =============================================================================
// app/api/dashboard/sidebar/route.ts
// GET /api/dashboard/sidebar
// Fase 11.1: datos del panel derecho del dashboard.
// =============================================================================

import { createClient } from '@/lib/supabase.server'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import { measureServerOperation } from '@/lib/server/observability'
import {
  apiError,
  apiOk,
  apiUnauthorized,
  fromResult,
  getSessionUserId,
} from '@/lib/api/response'
import type {
  DashboardCategoryBreakdownItem,
  DashboardCounterpartyPreview,
  DashboardSidebar,
} from '@/lib/dashboard/types'

const DAY_IN_MS = 86_400_000
const UNCATEGORIZED_LABEL = 'Sin categoría'
const UNCATEGORIZED_COLOR = '#8f8a80'

function toDateUtc(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00Z`)
}

function startOfTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function getDaysUntil(dueDateIso: string, todayUtc: Date): number {
  const due = toDateUtc(dueDateIso)
  return Math.floor((due.getTime() - todayUtc.getTime()) / DAY_IN_MS)
}

function toPenAmount(amount: number, currency: string, exchangeRate: number): number {
  return currency === 'USD'
    ? amount * exchangeRate
    : amount
}

function normalizeCategoryBreakdown(
  rows: Array<{
    category_id: string | null
    name: string
    color: string
    monto: number
  }>
): DashboardCategoryBreakdownItem[] {
  const total = rows.reduce((sum, row) => sum + row.monto, 0)

  return rows.map((row) => ({
    category_id: row.category_id,
    name: row.name,
    color: row.color,
    monto: Math.round(row.monto * 100) / 100,
    pct: total > 0 ? Math.round((row.monto / total) * 1000) / 10 : 0,
  }))
}

export async function GET() {
  return measureServerOperation('api.dashboard.sidebar', async () => {
    const supabase = createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) return apiUnauthorized()

    const service = new DashboardService(supabase)
    const result = await service.getSummary(userId)
    if (!result.ok) return fromResult(result)

    const summary = result.data
    const saldoTotal = summary.accounts.reduce((sum, account) => sum + account.balancePen, 0)
    const porCobrar = summary.receivables.totalPendingPen
    const porPagar = summary.payables.totalPendingPen
    const neto = porCobrar - porPagar
    const exchangeRate = summary.meta.exchangeRateUsdPen

    const todayUtc = startOfTodayUtc()
    const next30DaysUtc = new Date(todayUtc)
    next30DaysUtc.setUTCDate(next30DaysUtc.getUTCDate() + 30)
    const todayIso = todayUtc.toISOString().slice(0, 10)
    const next30DaysIso = next30DaysUtc.toISOString().slice(0, 10)
    const monthStart = new Date(todayUtc)
    monthStart.setUTCDate(1)
    const nextMonthStart = new Date(Date.UTC(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth() + 1,
      1,
    ))
    const monthStartIso = monthStart.toISOString().slice(0, 10)
    const nextMonthStartIso = nextMonthStart.toISOString().slice(0, 10)

    const [
      activeCardsResult,
      debtorsResult,
      receivablesResult,
      creditorsResult,
      payablesResult,
      monthTransactionsResult,
    ] = await Promise.all([
      supabase
        .from('credits')
        .select('id, name')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .eq('credit_type', 'CREDIT_CARD'),
      supabase
        .from('debtors')
        .select('id, name')
        .eq('user_id', userId),
      supabase
        .from('accounts_receivable')
        .select('debtor_id, amount, collected_amount, currency, status')
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIAL']),
      supabase
        .from('creditors')
        .select('id, name')
        .eq('user_id', userId),
      supabase
        .from('accounts_payable')
        .select('creditor_id, amount, paid_amount, currency, status')
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIAL']),
      supabase
        .from('transactions')
        .select('category_id, amount_pen, type')
        .eq('user_id', userId)
        .eq('affects_reports', true)
        .in('type', ['INCOME', 'EXPENSE'])
        .gte('transaction_date', monthStartIso)
        .lt('transaction_date', nextMonthStartIso),
    ])

    if (activeCardsResult.error) {
      return apiError({
        code: 'DATABASE_ERROR',
        message: activeCardsResult.error.message,
      })
    }
    if (debtorsResult.error) {
      return apiError({
        code: 'DATABASE_ERROR',
        message: debtorsResult.error.message,
      })
    }
    if (receivablesResult.error) {
      return apiError({
        code: 'DATABASE_ERROR',
        message: receivablesResult.error.message,
      })
    }
    if (creditorsResult.error) {
      return apiError({
        code: 'DATABASE_ERROR',
        message: creditorsResult.error.message,
      })
    }
    if (payablesResult.error) {
      return apiError({
        code: 'DATABASE_ERROR',
        message: payablesResult.error.message,
      })
    }
    if (monthTransactionsResult.error) {
      return apiError({
        code: 'DATABASE_ERROR',
        message: monthTransactionsResult.error.message,
      })
    }

    const activeCards = activeCardsResult.data ?? []
    const cardById = new Map(activeCards.map((card) => [card.id, card.name]))
    const cardIds = activeCards.map((card) => card.id)

    let cycleRows: Array<{
      id: string
      credit_id: string
      payment_date: string
      total_to_pay: number
    }> = []

    if (cardIds.length > 0) {
      const { data, error } = await supabase
        .from('billing_cycles')
        .select('id, credit_id, payment_date, total_to_pay')
        .in('credit_id', cardIds)
        .gte('payment_date', todayIso)
        .lte('payment_date', next30DaysIso)
        .order('payment_date', { ascending: true })

      if (error) {
        return apiError({
          code: 'DATABASE_ERROR',
          message: error.message,
        })
      }

      cycleRows = (data ?? []).map((row) => ({
        id: row.id,
        credit_id: row.credit_id,
        payment_date: row.payment_date,
        total_to_pay: Number(row.total_to_pay ?? 0),
      }))
    }

    const debtorsById = new Map((debtorsResult.data ?? []).map((debtor) => [debtor.id, debtor.name]))
    const creditorsById = new Map((creditorsResult.data ?? []).map((creditor) => [creditor.id, creditor.name]))

    const debtorPending = new Map<string, number>()
    for (const row of receivablesResult.data ?? []) {
      if (!row.debtor_id) continue
      const pendingOriginal = Number(row.amount ?? 0) - Number(row.collected_amount ?? 0)
      const pendingPen = toPenAmount(Math.max(0, pendingOriginal), row.currency, exchangeRate)
      debtorPending.set(row.debtor_id, (debtorPending.get(row.debtor_id) ?? 0) + pendingPen)
    }

    const creditorPending = new Map<string, number>()
    for (const row of payablesResult.data ?? []) {
      if (!row.creditor_id) continue
      const pendingOriginal = Number(row.amount ?? 0) - Number(row.paid_amount ?? 0)
      const pendingPen = toPenAmount(Math.max(0, pendingOriginal), row.currency, exchangeRate)
      creditorPending.set(row.creditor_id, (creditorPending.get(row.creditor_id) ?? 0) + pendingPen)
    }

    const topDeudores: DashboardCounterpartyPreview[] = Array.from(debtorPending.entries())
    .map(([id, pendingAmountPen]) => ({
      id,
      name: debtorsById.get(id) ?? 'Deudor',
      pending_amount_pen: Math.round(pendingAmountPen * 100) / 100,
      href: `/receivables?debtorId=${id}`,
    }))
    .sort((a, b) => b.pending_amount_pen - a.pending_amount_pen)
    .slice(0, 3)

    const topAcreedores: DashboardCounterpartyPreview[] = Array.from(creditorPending.entries())
    .map(([id, pendingAmountPen]) => ({
      id,
      name: creditorsById.get(id) ?? 'Acreedor',
      pending_amount_pen: Math.round(pendingAmountPen * 100) / 100,
      href: `/payables?creditorId=${id}`,
    }))
    .sort((a, b) => b.pending_amount_pen - a.pending_amount_pen)
    .slice(0, 3)

    const transactionRows = monthTransactionsResult.data ?? []
    const categoryIds = Array.from(new Set(
      transactionRows
        .map((row) => row.category_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    ))

    const categoryMap = new Map<string, { name: string; color: string }>()
    if (categoryIds.length > 0) {
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, color')
        .in('id', categoryIds)

      if (categoriesError) {
        return apiError({
          code: 'DATABASE_ERROR',
          message: categoriesError.message,
        })
      }

      for (const category of categories ?? []) {
        categoryMap.set(category.id, {
          name: category.name,
          color: category.color,
        })
      }
    }

    const incomeAgg = new Map<string, { category_id: string | null; name: string; color: string; monto: number }>()
    const expenseAgg = new Map<string, { category_id: string | null; name: string; color: string; monto: number }>()

    for (const row of transactionRows) {
      const key = row.category_id ?? 'uncategorized'
      const ref = row.category_id ? categoryMap.get(row.category_id) : null
      const target = row.type === 'INCOME' ? incomeAgg : expenseAgg
      const current = target.get(key) ?? {
        category_id: row.category_id,
        name: ref?.name ?? UNCATEGORIZED_LABEL,
        color: ref?.color ?? UNCATEGORIZED_COLOR,
        monto: 0,
      }

      current.monto += Number(row.amount_pen ?? 0)
      target.set(key, current)
    }

    const ingresosCategoria = normalizeCategoryBreakdown(
      Array.from(incomeAgg.values())
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 5)
    )

    const egresosCategoria = normalizeCategoryBreakdown(
      Array.from(expenseAgg.values())
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 5)
    )

    const vencimientosCreditoBancario = summary.upcomingInstallments
      .filter((item) => item.daysUntilDue >= 0 && item.daysUntilDue <= 30)
      .map((item) => ({
        id: item.id,
        tipo: 'credito_bancario' as const,
        name: item.creditorName,
        due_date: item.dueDate,
        monto: item.totalAmount,
      }))

    const vencimientosTarjeta = cycleRows.map((cycle) => ({
      id: cycle.id,
      tipo: 'ciclo_tarjeta' as const,
      name: cardById.get(cycle.credit_id) ?? 'Tarjeta de crédito',
      due_date: cycle.payment_date,
      monto: cycle.total_to_pay,
    }))

    const vencimientosPorPagar = summary.payables.items
      .filter((item) => item.dueDate)
      .map((item) => ({
        item,
        daysUntil: getDaysUntil(item.dueDate as string, todayUtc),
      }))
      .filter(({ daysUntil }) => daysUntil >= 0 && daysUntil <= 30)
      .map(({ item }) => ({
        id: item.id,
        tipo: 'cuenta_por_pagar' as const,
        name: item.creditorName,
        due_date: item.dueDate as string,
        monto: item.pendingAmount,
      }))

    const payload: DashboardSidebar = {
      saldos_bancarios: {
        total_consolidado: saldoTotal,
        items: summary.accounts
          .slice()
          .sort((a, b) => b.balancePen - a.balancePen)
          .map((account) => ({
            portfolio_id: account.id,
            name: account.name,
            saldo: account.balancePen,
            pct_of_total: saldoTotal > 0
              ? Math.round((account.balancePen / saldoTotal) * 10000) / 100
              : 0,
          })),
      },
      flujo_pendiente: {
        por_cobrar_total: porCobrar,
        por_cobrar_count: summary.receivables.count,
        por_pagar_total: porPagar,
        por_pagar_count: summary.payables.count,
        neto,
        nota: neto > 0 ? 'favorece' : neto < 0 ? 'desfavorece' : 'equilibrado',
        top_deudores: topDeudores,
        top_acreedores: topAcreedores,
      },
      egresos_categoria: egresosCategoria,
      ingresos_categoria: ingresosCategoria,
      vencimientos_proximos: [
        ...vencimientosCreditoBancario,
        ...vencimientosTarjeta,
        ...vencimientosPorPagar,
      ]
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .slice(0, 10),
    }

    return apiOk(payload)
  }, { warnAtMs: 650 })
}
