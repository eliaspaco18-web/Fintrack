'use client'

import useSWR from 'swr'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import type { DashboardSummary as DashboardSummaryContract } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const summaryFetcher = (url: string) => fetchDashboardData<DashboardSummaryContract>(url)

interface MetricItem {
  id: string
  label: string
  amountPen: number
  amountUsd: number
  isBalance?: boolean
}

export function MetricCards() {
  const { data, isLoading } = useSWR('/api/dashboard/summary', summaryFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const patrimonio = data?.patrimonio_neto.pen ?? 0
  const patrimonioUsd = data?.patrimonio_neto.usd ?? 0
  const ingresos = data?.ingresos_mes ?? 0
  const ingresosUsd = data?.ingresos_mes_usd ?? 0
  const egresos = data?.egresos_mes ?? 0
  const egresosUsd = data?.egresos_mes_usd ?? 0
  const balance = data?.balance_mes ?? 0
  const balanceUsd = data?.balance_mes_usd ?? 0

  const metrics: MetricItem[] = [
    { id: 'patrimonio', label: 'Patrimonio Neto', amountPen: patrimonio, amountUsd: patrimonioUsd },
    { id: 'ingresos', label: 'Ingresos del Mes', amountPen: ingresos, amountUsd: ingresosUsd },
    { id: 'egresos', label: 'Egresos del Mes', amountPen: egresos, amountUsd: egresosUsd },
    { id: 'balance', label: 'Balance del Mes', amountPen: balance, amountUsd: balanceUsd, isBalance: true },
  ]

  if (isLoading && !data) {
    return (
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <PremiumCard key={idx} innerClassName="p-4">
            <div className="animate-pulse">
              <div className="h-3 w-28 rounded bg-[var(--c-surface-2)]" />
              <div className="mt-3 h-7 w-36 rounded bg-[var(--c-surface-2)]" />
            </div>
          </PremiumCard>
        ))}
      </section>
    )
  }

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {metrics.map((metric) => {
        const isNegative = metric.isBalance ? metric.amountPen < 0 : metric.id === 'egresos'
        const borderColor = isNegative ? 'border-[color-mix(in_srgb,var(--c-danger)_22%,transparent)]' : 'border-[var(--c-border)]'
        const valueColor = isNegative ? 'text-[var(--c-danger)]' : 'text-[var(--c-text)]'

        return (
          <PremiumCard key={metric.id} as="article" innerClassName={`bg-[var(--c-surface)] p-4 ${borderColor}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">{metric.label}</p>
            <p className={`mt-2 text-[1.35rem] font-semibold leading-none tabular-nums ${valueColor}`}>
              {formatCurrency(metric.amountPen, 'PEN')}
            </p>
            <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">
              Eq. {formatCurrency(metric.amountUsd, 'USD')}
            </p>
          </PremiumCard>
        )
      })}
    </section>
  )
}
