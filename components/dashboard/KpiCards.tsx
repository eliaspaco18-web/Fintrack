'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import type { DashboardSummary as DashboardSummaryContract } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const summaryFetcher = (url: string) => fetchDashboardData<DashboardSummaryContract>(url)

function IconArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  )
}

function IconArrowDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  )
}

export function KpiCards() {
  const { data, isLoading } = useSWR('/api/dashboard/summary', summaryFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const items = [
    {
      key: 'income',
      label: 'Ingresos del mes',
      value: formatCurrency(data?.ingresos_mes ?? 0, 'PEN'),
      usd: formatCurrency(data?.ingresos_mes_usd ?? 0, 'USD'),
      icon: <IconArrowUp />,
      tone: 'text-[var(--c-primary)] border-[var(--c-primary-border)] bg-[var(--c-primary-soft)]',
      iconTone: 'bg-[var(--c-primary-soft)] text-[var(--c-primary)]',
    },
    {
      key: 'expense',
      label: 'Egresos del mes',
      value: formatCurrency(data?.egresos_mes ?? 0, 'PEN'),
      usd: formatCurrency(data?.egresos_mes_usd ?? 0, 'USD'),
      icon: <IconArrowDown />,
      tone: 'text-[var(--c-danger)] border-[color-mix(in_srgb,var(--c-danger)_24%,transparent)] bg-[color-mix(in_srgb,var(--c-danger)_10%,transparent)]',
      iconTone: 'bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] text-[var(--c-danger)]',
    },
  ]

  if (isLoading && !data) {
    return (
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <PremiumCard key={idx} innerClassName="p-4">
            <div className="animate-pulse">
              <div className="h-3 w-24 rounded bg-[var(--c-surface-2)]" />
              <div className="mt-3 h-7 w-28 rounded bg-[var(--c-surface-2)]" />
            </div>
          </PremiumCard>
        ))}
      </section>
    )
  }

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {items.map((item) => (
        <PremiumCard key={item.key} as="article" innerClassName={`p-4 ${item.tone}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">{item.label}</p>
              <p className="mt-2 text-[1.2rem] font-semibold leading-none tabular-nums">{item.value}</p>
              <p className="mt-1 text-[11px] opacity-75">Eq. {item.usd}</p>
            </div>
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${item.iconTone}`}>
              {item.icon}
            </span>
          </div>
        </PremiumCard>
      ))}

      <Link href="/alerts" className="block">
        <PremiumCard as="article" innerClassName="border-[color-mix(in_srgb,var(--c-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--c-warning)_10%,transparent)] p-4 text-[var(--c-warning)] transition-colors hover:bg-[color-mix(in_srgb,var(--c-warning)_14%,transparent)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">Alertas pendientes</p>
              <p className="mt-2 text-[1.2rem] font-semibold leading-none tabular-nums">{data?.alertas_pendientes ?? 0}</p>
              <p className="mt-1 text-[11px] opacity-75">Ir al módulo de alertas</p>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--c-warning)_16%,transparent)] text-[var(--c-warning)]">
              <IconAlert />
            </span>
          </div>
        </PremiumCard>
      </Link>
    </section>
  )
}
