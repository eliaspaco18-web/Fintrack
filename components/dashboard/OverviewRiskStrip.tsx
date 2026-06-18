'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import type {
  DashboardAlertItem,
  DashboardAlertsResponse,
  DashboardSidebar,
} from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const alertsFetcher = (url: string) => fetchDashboardData<DashboardAlertsResponse>(url)
const sidebarFetcher = (url: string) => fetchDashboardData<DashboardSidebar>(url)

type RiskItem = {
  id: string
  href: string
  title: string
  meta: string
  amountLabel: string
  dueLabel: string
  tone: 'danger' | 'warning' | 'primary'
  priority: number
}

function daysUntil(dueDate: string): number {
  const today = new Date()
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const due = new Date(`${dueDate}T00:00:00Z`)
  return Math.floor((due.getTime() - base.getTime()) / 86_400_000)
}

function formatDueDate(dueDate: string | null) {
  if (!dueDate) return 'Sin fecha'

  return new Date(`${dueDate}T12:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
  }).replace('.', '')
}

function alertTypeLabel(type: DashboardAlertItem['type']) {
  return {
    installment: 'Cuota',
    receivable: 'Por cobrar',
    payable: 'Por pagar',
    budget_exceeded: 'Presupuesto',
  }[type]
}

function dueLabel(dueDate: string | null, urgency?: DashboardAlertItem['urgency']) {
  if (urgency === 'OVERDUE') return 'Vencido'
  if (!dueDate) return 'Sin fecha'

  const days = daysUntil(dueDate)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  if (days <= 7) return `${days} días`
  return formatDueDate(dueDate)
}

function dueTone(dueDate: string | null, urgency?: DashboardAlertItem['urgency']): RiskItem['tone'] {
  if (urgency === 'OVERDUE') return 'danger'
  if (!dueDate) return 'primary'

  const days = daysUntil(dueDate)
  if (days <= 1) return 'danger'
  if (days <= 7) return 'warning'
  return 'primary'
}

function sidebarTypeLabel(type: DashboardSidebar['vencimientos_proximos'][number]['tipo']) {
  if (type === 'ciclo_tarjeta') return 'Tarjeta'
  if (type === 'cuenta_por_pagar') return 'Cuenta'
  return 'Crédito'
}

function sidebarHref(item: DashboardSidebar['vencimientos_proximos'][number]) {
  if (item.tipo === 'cuenta_por_pagar') return `/payables/${item.id}`
  return '/credits'
}

function toneClasses(tone: RiskItem['tone']) {
  if (tone === 'danger') {
    return {
      item: 'border-[color-mix(in_oklch,var(--ft-danger)_20%,var(--ft-border))] bg-[color-mix(in_oklch,var(--ft-danger)_5%,var(--ft-surface))]',
      dot: 'bg-[var(--ft-danger)]',
      badge: 'border-[color-mix(in_oklch,var(--ft-danger)_22%,transparent)] bg-[color-mix(in_oklch,var(--ft-danger)_8%,transparent)] text-[var(--ft-danger)]',
      amount: 'text-[var(--ft-danger)]',
    }
  }

  if (tone === 'warning') {
    return {
      item: 'border-[color-mix(in_oklch,var(--ft-warning)_22%,var(--ft-border))] bg-[color-mix(in_oklch,var(--ft-warning)_6%,var(--ft-surface))]',
      dot: 'bg-[var(--ft-warning)]',
      badge: 'border-[color-mix(in_oklch,var(--ft-warning)_24%,transparent)] bg-[color-mix(in_oklch,var(--ft-warning)_9%,transparent)] text-[var(--ft-warning)]',
      amount: 'text-[var(--ft-warning)]',
    }
  }

  return {
    item: 'border-[var(--ft-border)] bg-[var(--ft-surface-muted)]',
    dot: 'bg-[var(--ft-primary)]',
    badge: 'border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]',
    amount: 'text-[var(--ft-text)]',
  }
}

function buildRiskItems(
  alerts: DashboardAlertsResponse | undefined,
  sidebar: DashboardSidebar | undefined
) {
  const alertItems: RiskItem[] = (alerts?.alerts ?? []).map((alert) => ({
    id: `alert-${alert.id}`,
    href: alert.href,
    title: alert.label,
    meta: alertTypeLabel(alert.type),
    amountLabel: formatCurrency(alert.amount, alert.currency),
    dueLabel: dueLabel(alert.dueDate, alert.urgency),
    tone: alert.urgency === 'OVERDUE' ? 'danger' : dueTone(alert.dueDate, alert.urgency),
    priority: alert.urgency === 'OVERDUE' ? 0 : 1,
  }))

  const seen = new Set(alertItems.map((item) => `${item.title}-${item.amountLabel}-${item.dueLabel}`))
  const dueItems: RiskItem[] = (sidebar?.vencimientos_proximos ?? [])
    .slice()
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((item) => {
      const amountLabel = formatCurrency(item.monto, 'PEN')
      const label = dueLabel(item.due_date)
      return {
        id: `due-${item.tipo}-${item.id}`,
        href: sidebarHref(item),
        title: item.name,
        meta: sidebarTypeLabel(item.tipo),
        amountLabel,
        dueLabel: label,
        tone: dueTone(item.due_date),
        priority: daysUntil(item.due_date) <= 1 ? 2 : 3,
      }
    })
    .filter((item) => {
      const key = `${item.title}-${item.amountLabel}-${item.dueLabel}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return [...alertItems, ...dueItems]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
}

export function OverviewRiskStrip() {
  const { data: alerts, isLoading: alertsLoading } = useSWR('/api/dashboard/alerts', alertsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })
  const { data: sidebar, isLoading: sidebarLoading } = useSWR('/api/dashboard/sidebar', sidebarFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const loading = (alertsLoading && !alerts) || (sidebarLoading && !sidebar)
  const items = buildRiskItems(alerts, sidebar)
  const criticalCount = alerts?.criticalCount ?? 0
  const dueCount = sidebar?.vencimientos_proximos.length ?? 0

  if (loading) {
    return (
      <PremiumCard innerClassName="p-4">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="h-3 w-44 rounded-full bg-[var(--ft-surface-muted)]" />
            <div className="h-7 w-28 rounded-full bg-[var(--ft-surface-muted)]" />
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="h-20 rounded-[16px] bg-[var(--ft-surface-muted)]" />
            <div className="h-20 rounded-[16px] bg-[var(--ft-surface-muted)]" />
            <div className="h-20 rounded-[16px] bg-[var(--ft-surface-muted)]" />
          </div>
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            Riesgos próximos
          </p>
          <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">
            Alertas críticas y vencimientos a 30 días.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
          <span className="rounded-full border border-[color-mix(in_oklch,var(--ft-danger)_22%,transparent)] bg-[color-mix(in_oklch,var(--ft-danger)_8%,transparent)] px-2.5 py-1 text-[var(--ft-danger)]">
            {criticalCount} críticos
          </span>
          <span className="rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-2.5 py-1 text-[var(--ft-text-subtle)]">
            {dueCount} vencimientos
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[16px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
          <div>
            <p className="text-[12px] font-semibold text-[var(--ft-text)]">Sin riesgos críticos</p>
            <p className="mt-0.5 text-[11px] text-[var(--ft-text-muted)]">No hay vencimientos urgentes en los próximos 30 días.</p>
          </div>
          <Link
            href="/alerts"
            className="rounded-full border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ft-primary)] transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--ft-primary)] hover:text-[var(--ft-text-on-primary)] active:scale-[0.98]"
          >
            Ver alertas
          </Link>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {items.map((item) => {
            const tone = toneClasses(item.tone)
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`${tone.item} group min-w-0 rounded-[16px] border px-3.5 py-3 transition-[border-color,background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 active:scale-[0.99]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`${tone.dot} mt-0.5 h-2 w-2 shrink-0 rounded-full shadow-[0_0_0_3px_var(--ft-surface)]`} />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold text-[var(--ft-text)]">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--ft-text-subtle)]">
                        {item.meta}
                      </span>
                    </span>
                  </span>
                  <span className={`${tone.badge} shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]`}>
                    {item.dueLabel}
                  </span>
                </div>
                <p className={`${tone.amount} mt-2 text-[13px] font-semibold tabular-nums`}>
                  {item.amountLabel}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </PremiumCard>
  )
}
