'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
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

interface AppNotificationItem {
  id: string
  category: string
  event: string
  title: string
  message: string | null
  href: string | null
  is_read: boolean
  created_at: string
}

function urgencyOrder(value: Urgency): number {
  if (value === 'OVERDUE') return 0
  if (value === 'DUE_SOON') return 1
  if (value === 'UPCOMING') return 2
  return 3
}

function notificationCategoryLabel(category: string): string {
  if (category === 'PORTFOLIO') return 'Portafolio'
  if (category === 'BANK') return 'Bancos'
  if (category === 'TRANSACTION') return 'Transacciones'
  if (category === 'CATEGORY') return 'Categorías'
  return 'Sistema'
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
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=20', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) return
      setNotifications(json.data as AppNotificationItem[])
    } finally {
      setNotificationsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const unreadNotifications = notifications.filter(item => !item.is_read).length

  const markNotificationsAsRead = useCallback(async () => {
    if (markingRead || unreadNotifications === 0) return
    setMarkingRead(true)
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true, is_read: true }),
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        setNotifications(json.data as AppNotificationItem[])
      }
    } finally {
      setMarkingRead(false)
    }
  }, [markingRead, unreadNotifications])

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
        <WidgetShell><div className="h-24 animate-pulse rounded-xl bg-[var(--c-surface-2)]"/></WidgetShell>
        <WidgetShell><div className="h-56 animate-pulse rounded-xl bg-[var(--c-surface-2)]"/></WidgetShell>
      </div>
    )
  }

  if (error) {
    return (
      <WidgetShell>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-300">No se pudo cargar el centro de alertas</p>
            <p className="mt-1 text-xs text-[var(--c-text-muted)]">{error.message ?? 'Intenta recargar.'}</p>
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
          <p className="text-[11px] uppercase tracking-[0.09em] text-[var(--c-text-muted)]">Alertas críticas</p>
          <p className="text-2xl font-bold tabular-nums text-red-400 mt-1">{overdueCount}</p>
          <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">vencidas</p>
        </WidgetShell>
        <WidgetShell>
          <p className="text-[11px] uppercase tracking-[0.09em] text-[var(--c-text-muted)]">Por vencer</p>
          <p className="text-2xl font-bold tabular-nums text-amber-400 mt-1">{dueSoonCount}</p>
          <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">esta semana</p>
        </WidgetShell>
        <WidgetShell>
          <p className="text-[11px] uppercase tracking-[0.09em] text-[var(--c-text-muted)]">Última actualización</p>
          <p className="mt-1 text-base font-semibold text-[var(--c-text)]">
            {lastUpdated
              ? lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
              : '—'}
          </p>
          <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">actualiza en automático</p>
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
                    className="block rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5
                      transition-colors hover:border-[var(--c-border-hover)] hover:bg-[var(--c-surface-2)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.08em] text-[var(--c-text-muted)]">
                          {alertTypeLabel(item.type)}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-[var(--c-text)]">{item.label}</p>
                        {item.dueDate && (
                          <p className="mt-1 text-[11px] text-[var(--c-text-faint)]">
                            Vence: {new Date(item.dueDate + 'T12:00:00').toLocaleDateString('es-PE')}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold tabular-nums text-[var(--c-text)]">{formatted}</p>
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
                        <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">{item.message}</p>
                        <Link href={item.href} className="inline-flex mt-2 text-[11px] font-semibold text-[var(--c-primary)] hover:text-[var(--c-primary)]">
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

      <WidgetShell>
        <SectionHeader
          title="Actividad reciente"
          accent="var(--c-primary)"
          action={
            unreadNotifications > 0 ? (
              <button
                type="button"
                onClick={() => void markNotificationsAsRead()}
                disabled={markingRead}
                className="text-[11px] text-[var(--c-primary)] hover:text-[var(--c-primary)] transition-colors disabled:opacity-60"
              >
                {markingRead ? 'Marcando...' : `Marcar leídas (${unreadNotifications})`}
              </button>
            ) : (
              <span className="text-[11px] text-[var(--c-text-muted)]">Todo al día</span>
            )
          }
        />

        {notificationsLoading ? (
          <div className="h-20 animate-pulse rounded-xl bg-[var(--c-surface-2)]"/>
        ) : notifications.length === 0 ? (
          <EmptyWidget
            message="Sin actividad reciente"
            hint="Los registros creados y actualizados aparecerán aquí."
          />
        ) : (
          <div className="space-y-2">
            {notifications.slice(0, 8).map(item => (
              <div
                key={item.id}
                className={`rounded-xl border px-3 py-2.5 ${
                  item.is_read
                    ? 'border-[var(--c-border)] bg-[var(--c-surface)]'
                    : 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
                      {notificationCategoryLabel(item.category)}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-[var(--c-text)]">{item.title}</p>
                    {item.message && (
                      <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">{item.message}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[10px] text-[var(--c-text-faint)]">
                      {new Date(item.created_at).toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {item.href && (
                      <Link href={item.href} className="mt-1 inline-block text-[11px] text-[var(--c-primary)] hover:text-[var(--c-primary)]">
                        Ver →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </WidgetShell>
    </div>
  )
}
