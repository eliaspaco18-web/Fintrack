'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { DashboardSidebar } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const fetcher = (url: string) => fetchDashboardData<DashboardSidebar>(url)

function daysUntil(dueDate: string): number {
  const today = new Date()
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const due = new Date(`${dueDate}T00:00:00Z`)
  return Math.floor((due.getTime() - base.getTime()) / 86_400_000)
}

function urgencyBadge(dueDate: string) {
  const days = daysUntil(dueDate)

  if (days <= 1) {
    return {
      label: days <= 0 ? 'Hoy' : 'Mañana',
      className: 'border-[color-mix(in_srgb,var(--c-danger)_22%,transparent)] bg-[color-mix(in_srgb,var(--c-danger)_10%,transparent)] text-[var(--c-danger)]',
      dotColor: 'var(--c-danger)',
    }
  }

  if (days <= 7) {
    return {
      label: 'Dentro de 7 días',
      className: 'border-[color-mix(in_srgb,var(--c-warning)_22%,transparent)] bg-[color-mix(in_srgb,var(--c-warning)_10%,transparent)] text-[var(--c-warning)]',
      dotColor: 'var(--c-warning)',
    }
  }

  return {
    label: 'Dentro de 30 días',
    className: 'border-[color-mix(in_srgb,var(--c-accent-landing)_26%,transparent)] bg-[color-mix(in_srgb,var(--c-accent-landing)_10%,transparent)] text-[var(--c-accent-landing-text)]',
    dotColor: 'var(--c-accent-landing)',
  }
}

function typeLabel(tipo: DashboardSidebar['vencimientos_proximos'][number]['tipo']) {
  if (tipo === 'ciclo_tarjeta') return 'Tarjeta'
  if (tipo === 'cuenta_por_pagar') return 'Cuenta'
  return 'Crédito'
}

function targetHref(item: DashboardSidebar['vencimientos_proximos'][number]) {
  if (item.tipo === 'cuenta_por_pagar') {
    return `/payables/${item.id}`
  }

  return '/credits'
}

export function VencimientosWidget() {
  const { data, isLoading } = useSWR('/api/dashboard/sidebar', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const items = (data?.vencimientos_proximos ?? [])
    .slice()
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  const criticalCount = items.filter((item) => daysUntil(item.due_date) <= 1).length
  const weekCount = items.filter((item) => {
    const days = daysUntil(item.due_date)
    return days > 1 && days <= 7
  }).length
  const monthCount = items.filter((item) => {
    const days = daysUntil(item.due_date)
    return days > 7 && days <= 30
  }).length

  if (isLoading && !data) {
    return (
      <PremiumCard innerClassName="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-44 rounded bg-[var(--c-surface-2)]" />
          <div className="h-20 rounded bg-[var(--c-surface-2)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-text-faint)]">
            Vencimientos Próximos
          </p>
          <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
            Timeline priorizado para decidir qué atender primero.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Críticos</p>
          <p className="mt-1 text-[1rem] font-semibold tabular-nums text-[var(--c-text)]">
            {criticalCount}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-[12px] text-[var(--c-text-muted)]">No hay vencimientos en los próximos 30 días.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[color-mix(in_srgb,var(--c-danger)_22%,transparent)] bg-[color-mix(in_srgb,var(--c-danger)_10%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-danger)]">
              {criticalCount} hoy o mañana
            </span>
            <span className="rounded-full border border-[color-mix(in_srgb,var(--c-warning)_22%,transparent)] bg-[color-mix(in_srgb,var(--c-warning)_10%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-warning)]">
              {weekCount} dentro de 7 días
            </span>
            <span className="rounded-full border border-[color-mix(in_srgb,var(--c-accent-landing)_26%,transparent)] bg-[color-mix(in_srgb,var(--c-accent-landing)_10%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-accent-landing-text)]">
              {monthCount} dentro de 30 días
            </span>
          </div>

          <div className="relative mt-4 space-y-2.5 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-[var(--c-border)]">
          {items.map((item) => {
            const badge = urgencyBadge(item.due_date)
            return (
              <Link
                key={`${item.tipo}-${item.id}`}
                href={targetHref(item)}
                className="group list-reveal-item relative grid grid-cols-[20px_minmax(0,1fr)_auto] gap-3 rounded-[18px] px-2 py-2 transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--c-surface-2)] active:scale-[0.98]"
              >
                <span
                  className="relative z-10 mt-1 h-[18px] w-[18px] rounded-full border-2 border-[var(--c-surface)] shadow-[0_0_0_1px_var(--c-border)] transition-transform duration-200 ease-[var(--ease-out)] group-hover:scale-105"
                  style={{ backgroundColor: badge.dotColor }}
                />

                <span className="min-w-0">
                  <span className="inline-flex rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-muted)]">
                    {typeLabel(item.tipo)}
                  </span>
                  <span className="mt-1 block truncate text-[12px] font-medium text-[var(--c-text)]">
                    {item.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--c-text-muted)]">
                    Vence{' '}
                    {new Date(`${item.due_date}T12:00:00`).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                    }).replace('.', '')}
                  </span>
                </span>

                <span className="text-right">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${badge.className}`}>
                    {badge.label}
                  </span>
                  <span className="mt-1 block text-[11px] font-semibold tabular-nums text-[var(--c-text)]">
                    S/ {formatNumber(item.monto, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
              </Link>
            )
          })}
          </div>

          <p className="mt-4 rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3.5 py-3 text-[11px] leading-5 text-[var(--c-text-muted)]">
            Los vencimientos más cercanos suben primero para reducir fricción de lectura y priorizar acción.
          </p>
        </>
      )}
    </PremiumCard>
  )
}
