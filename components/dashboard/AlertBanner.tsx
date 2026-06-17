'use client'

import Link from 'next/link'
import { useState } from 'react'
import useSWR from 'swr'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import type { DashboardAlertItem, DashboardAlertsResponse } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'

const fetcher = (url: string) => fetchDashboardData<DashboardAlertsResponse>(url)

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M8.66 2.68a1.55 1.55 0 0 1 2.68 0l7.02 12.16A1.55 1.55 0 0 1 17.02 17H2.98a1.55 1.55 0 0 1-1.34-2.16L8.66 2.68ZM10 6.5c.41 0 .75.34.75.75v3.5a.75.75 0 0 1-1.5 0v-3.5c0-.41.34-.75.75-.75Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function alertTypeLabel(type: DashboardAlertItem['type']) {
  return {
    installment: 'Cuota',
    receivable: 'Por cobrar',
    payable: 'Por pagar',
    budget_exceeded: 'Presupuesto',
  }[type]
}

function urgencyLabel(urgency: DashboardAlertItem['urgency']) {
  return urgency === 'OVERDUE' ? 'Vencido' : 'Próximo'
}

function formatDueDate(dueDate: string | null) {
  if (!dueDate) return 'Sin fecha'

  return new Date(`${dueDate}T12:00:00`).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
  }).replace('.', '')
}

export function AlertBanner() {
  const [expanded, setExpanded] = useState(false)
  const { data, isLoading } = useSWR('/api/dashboard/alerts', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  if (isLoading || !data || data.criticalCount === 0) return null

  const alertCountLabel = `${data.criticalCount} vencimiento${data.criticalCount === 1 ? '' : 's'} crítico${data.criticalCount === 1 ? '' : 's'}`
  const totalLabel = formatCurrency(data.totalAmountPen, 'PEN')

  return (
    <section className="alert-banner overflow-hidden border-b border-[color-mix(in_oklch,var(--ft-danger)_18%,transparent)] bg-[color-mix(in_oklch,var(--ft-danger)_5%,var(--ft-surface))]">
      <style jsx>{`
        @keyframes dashboard-alert-enter {
          from {
            opacity: 0.45;
            transform: translateY(-100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .alert-banner {
          animation: dashboard-alert-enter 400ms cubic-bezier(0.32, 0.72, 0, 1) both;
        }
      `}</style>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-[var(--ft-text-primary)] transition-colors hover:bg-[color-mix(in_oklch,var(--ft-danger)_7%,transparent)] md:px-6"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--ft-danger)_14%,transparent)] text-[var(--ft-danger)]">
            <WarningIcon />
          </span>
          <span className="min-w-0 text-[13px] text-[var(--ft-text-secondary)]">
            <strong className="font-semibold text-[var(--ft-text-primary)]">{alertCountLabel}</strong>
            {' '}por <strong className="font-semibold text-[var(--ft-danger)]">{totalLabel}</strong> requieren atención
          </span>
        </span>
        <span className="flex-shrink-0 rounded-full border border-[color-mix(in_oklch,var(--ft-danger)_22%,transparent)] px-3 py-1 text-[11px] font-semibold text-[var(--ft-danger)]">
          {expanded ? 'Ocultar' : 'Revisar'}
        </span>
      </button>

      {expanded && (
        <div className="grid gap-2 border-t border-[color-mix(in_oklch,var(--ft-danger)_14%,transparent)] px-4 pb-4 pt-2 md:px-6">
          {data.alerts.map((alert) => (
            <Link
              key={alert.id}
              href={alert.href}
              className="grid gap-2 rounded-[8px] border border-[var(--ft-border)] bg-[var(--ft-surface)] px-3 py-2.5 text-[12px] transition-colors hover:border-[color-mix(in_oklch,var(--ft-danger)_30%,var(--ft-border))] sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[var(--ft-text-primary)]">{alert.label}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ft-text-tertiary)]">
                  <span>{alertTypeLabel(alert.type)}</span>
                  <span>{urgencyLabel(alert.urgency)}</span>
                  <span>{formatDueDate(alert.dueDate)}</span>
                </span>
              </span>
              <span className="self-center text-right font-semibold tabular-nums text-[var(--ft-danger)]">
                {formatCurrency(alert.amount, alert.currency)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
