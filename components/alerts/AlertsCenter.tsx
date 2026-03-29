'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useCurrency, useDashboard } from '@/lib/hooks/useDashboard'
import { formatCurrency, formatPercent, toPenAmount } from '@/lib/contracts/ui.contracts'
import {
  WidgetShell,
  SectionHeader,
  EmptyWidget,
  UrgencyBadge,
} from '@/components/dashboard/primitives'

type AlertType = 'installment' | 'receivable' | 'payable'
type Urgency = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | null

interface AlertItem {
  id: string
  type: AlertType
  label: string
  amount: number
  currency: 'PEN' | 'USD'
  dueDate: string | null
  urgency: Urgency
  href: string
}

interface InsightItem {
  id: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  href: string
  hrefLabel: string
}

function urgencyOrder(value: Urgency): number {
  if (value === 'OVERDUE') return 0
  if (value === 'DUE_SOON') return 1
  if (value === 'UPCOMING') return 2
  return 3
}

function alertTypeLabel(type: AlertType): string {
  if (type === 'installment') return 'Cuota'
  if (type === 'receivable') return 'Por cobrar'
  return 'Por pagar'
}

function insightTone(severity: InsightItem['severity']) {
  if (severity === 'critical') {
    return {
      border: 'border-red-500/25',
      bg: 'bg-red-500/10',
      text: 'text-red-300',
      dot: '#ef4444',
    }
  }
  if (severity === 'warning') {
    return {
      border: 'border-amber-500/25',
      bg: 'bg-amber-500/10',
      text: 'text-amber-300',
      dot: '#f59e0b',
    }
  }
  return {
    border: 'border-sky-500/25',
    bg: 'bg-sky-500/10',
    text: 'text-sky-300',
    dot: '#0ea5e9',
  }
}

export function AlertsCenter() {
  const { summary, isLoading, error, refetch, lastUpdated } = useDashboard()
  const { preferred, format, exchangeRate } = useCurrency()

  const alerts = useMemo<AlertItem[]>(() => {
    if (!summary) return []

    const all: AlertItem[] = [
      ...summary.upcomingInstallments.map(item => ({
        id: item.id,
        type: 'installment' as const,
        label: `Cuota ${item.installmentNumber}/${item.totalInstallments} · ${item.creditorName}`,
        amount: item.totalAmount,
        currency: item.currency as 'PEN' | 'USD',
        dueDate: item.dueDate,
        urgency: item.urgency,
        href: '/credits',
      })),
      ...summary.receivables.items.map(item => ({
        id: item.id,
        type: 'receivable' as const,
        label: item.debtorName,
        amount: item.pendingAmount,
        currency: item.currency as 'PEN' | 'USD',
        dueDate: item.dueDate,
        urgency: item.urgency,
        href: '/receivables',
      })),
      ...summary.payables.items.map(item => ({
        id: item.id,
        type: 'payable' as const,
        label: item.creditorName,
        amount: item.pendingAmount,
        currency: item.currency as 'PEN' | 'USD',
        dueDate: item.dueDate,
        urgency: item.urgency,
        href: '/payables',
      })),
    ]

    return all.sort((a, b) => {
      const byUrgency = urgencyOrder(a.urgency) - urgencyOrder(b.urgency)
      if (byUrgency !== 0) return byUrgency
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })
  }, [summary])

  const overdueCount = alerts.filter(a => a.urgency === 'OVERDUE').length
  const dueSoonCount = alerts.filter(a => a.urgency === 'DUE_SOON').length

  const insights = useMemo<InsightItem[]>(() => {
    if (!summary) return []

    const result: InsightItem[] = []
    const flow = summary.cashFlow6m ?? []
    const currentMonth = flow[flow.length - 1]
    const previousMonth = flow[flow.length - 2]

    if (currentMonth && previousMonth && previousMonth.expensePen > 0) {
      const expenseChangePct = ((currentMonth.expensePen - previousMonth.expensePen) / previousMonth.expensePen) * 100
      if (expenseChangePct >= 15) {
        result.push({
          id: 'expense-growth',
          title: 'Tus egresos subieron vs mes anterior',
          message: `Crecieron ${formatPercent(expenseChangePct, { fractionDigits: 1 })}. Revisa categorías para ajustar.`,
          severity: expenseChangePct >= 30 ? 'critical' : 'warning',
          href: '/transactions',
          hrefLabel: 'Ver movimientos',
        })
      }
    }

    const highUtilization = summary.credits.filter(c => c.utilizationPct >= 80)
    if (highUtilization.length > 0) {
      result.push({
        id: 'high-credit-utilization',
        title: 'Utilización alta en créditos',
        message: `${highUtilization.length} crédito(s) están por encima del 80% de uso.`,
        severity: highUtilization.some(c => c.utilizationPct >= 95) ? 'critical' : 'warning',
        href: '/credits',
        hrefLabel: 'Revisar créditos',
      })
    }

    const topCategory = summary.topExpenseCategories[0]
    if (topCategory && topCategory.percentage >= 45) {
      result.push({
        id: 'category-concentration',
        title: 'Concentración de gasto por categoría',
        message: `${topCategory.categoryName} representa ${formatPercent(topCategory.percentage, { fractionDigits: 1 })} de tus egresos del mes.`,
        severity: topCategory.percentage >= 60 ? 'critical' : 'info',
        href: '/transactions',
        hrefLabel: 'Analizar categorías',
      })
    }

    if ((summary.currentMonth.netPen ?? 0) < 0) {
      result.push({
        id: 'negative-net',
        title: 'Balance mensual negativo',
        message: 'Este mes tus egresos superan tus ingresos. Prioriza pagos clave y reduce gastos variables.',
        severity: 'warning',
        href: '/dashboard',
        hrefLabel: 'Ver dashboard',
      })
    }

    return result
  }, [summary])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <WidgetShell><div className="h-24 animate-pulse rounded-xl bg-white/[0.04]"/></WidgetShell>
        <WidgetShell><div className="h-56 animate-pulse rounded-xl bg-white/[0.04]"/></WidgetShell>
      </div>
    )
  }

  if (error) {
    return (
      <WidgetShell>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-300">No se pudo cargar el centro de alertas</p>
            <p className="text-xs text-white/45 mt-1">{error.message ?? 'Intenta recargar.'}</p>
          </div>
          <button onClick={refetch} className="btn-secondary text-xs px-3 py-2">Reintentar</button>
        </div>
      </WidgetShell>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <WidgetShell>
          <p className="text-[11px] uppercase tracking-[0.09em] text-white/35">Alertas críticas</p>
          <p className="text-2xl font-bold tabular-nums text-red-400 mt-1">{overdueCount}</p>
          <p className="text-[11px] text-white/35 mt-1">vencidas</p>
        </WidgetShell>
        <WidgetShell>
          <p className="text-[11px] uppercase tracking-[0.09em] text-white/35">Por vencer</p>
          <p className="text-2xl font-bold tabular-nums text-amber-400 mt-1">{dueSoonCount}</p>
          <p className="text-[11px] text-white/35 mt-1">esta semana</p>
        </WidgetShell>
        <WidgetShell>
          <p className="text-[11px] uppercase tracking-[0.09em] text-white/35">Última actualización</p>
          <p className="text-base font-semibold text-white/80 mt-1">
            {lastUpdated
              ? lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
              : '—'}
          </p>
          <p className="text-[11px] text-white/35 mt-1">actualiza en automático</p>
        </WidgetShell>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <WidgetShell className="xl:col-span-7">
          <SectionHeader
            title="Alertas operativas"
            accent="#ef4444"
            action={<span className="text-[11px]">{alerts.length} ítem(s)</span>}
          />

          {alerts.length === 0 ? (
            <EmptyWidget
              message="Sin alertas pendientes"
              hint="Cuando tengas vencimientos o pendientes, se verán aquí."
            />
          ) : (
            <div className="space-y-2">
              {alerts.map(item => {
                const amountPen = toPenAmount(item.amount, item.currency, exchangeRate)
                const formatted = formatCurrency(format(amountPen), preferred)
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={item.href}
                    className="block rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5
                      hover:border-white/[0.16] hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-white/35 uppercase tracking-[0.08em]">
                          {alertTypeLabel(item.type)}
                        </p>
                        <p className="text-sm text-white/80 truncate mt-0.5">{item.label}</p>
                        {item.dueDate && (
                          <p className="text-[11px] text-white/40 mt-1">
                            Vence: {new Date(item.dueDate + 'T12:00:00').toLocaleDateString('es-PE')}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold tabular-nums text-white/80">{formatted}</p>
                        <div className="mt-1 flex justify-end">
                          <UrgencyBadge urgency={item.urgency}/>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </WidgetShell>

        <WidgetShell className="xl:col-span-5">
          <SectionHeader title="Sugerencias inteligentes" accent="#06b6d4"/>

          {insights.length === 0 ? (
            <EmptyWidget
              message="Sin sugerencias por ahora"
              hint="Cuando detectemos patrones de riesgo, aparecerán aquí."
            />
          ) : (
            <div className="space-y-3">
              {insights.map(item => {
                const tone = insightTone(item.severity)
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-3.5 py-3 ${tone.border} ${tone.bg}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full flex-shrink-0" style={{ background: tone.dot }}/>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${tone.text}`}>{item.title}</p>
                        <p className="text-[12px] text-white/60 mt-1">{item.message}</p>
                        <Link href={item.href} className="inline-flex mt-2 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">
                          {item.hrefLabel} →
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </WidgetShell>
      </div>
    </div>
  )
}
