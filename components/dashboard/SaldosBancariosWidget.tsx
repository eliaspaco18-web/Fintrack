'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { DashboardSidebar } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'
import { SmartTip } from './SmartTip'

const fetcher = (url: string) => fetchDashboardData<DashboardSidebar>(url)

export function SaldosBancariosWidget() {
  const [showAll, setShowAll] = useState(false)
  const { data, isLoading } = useSWR('/api/dashboard/sidebar', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const saldos = data?.saldos_bancarios.items ?? []
  const total = data?.saldos_bancarios.total_consolidado ?? 0
  const visible = showAll ? saldos : saldos.slice(0, 5)
  const hasMore = saldos.length > 5

  if (isLoading && !data) {
    return (
      <PremiumCard innerClassName="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-28 rounded bg-[var(--c-surface-2)]" />
          <div className="h-7 w-40 rounded bg-[var(--c-surface-2)]" />
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
            Saldos bancarios
          </p>
          <p className="mt-2 text-[1.45rem] font-semibold leading-none tracking-[-0.02em] text-[var(--c-text)]">
            S/ {formatNumber(total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <SmartTip text="Este panel te muestra cómo se distribuye tu liquidez actual entre portafolios para detectar concentración y margen de maniobra." />
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 text-[12px] text-[var(--c-text-muted)]">
          No hay saldos disponibles para mostrar.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((item) => (
            <div key={item.portfolio_id}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="truncate text-[12px] font-medium text-[var(--c-text)]">{item.name}</span>
                <span className="text-[11px] font-semibold tabular-nums text-[var(--c-text-muted)]">
                  S/ {formatNumber(item.saldo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
                <div className="h-full rounded-full bg-[var(--c-primary)]" style={{ width: `${Math.max(6, item.pct_of_total)}%` }} />
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="pt-1 text-[11px] font-semibold text-[var(--c-primary)] hover:underline"
            >
              {showAll ? 'Ver menos' : `Ver más (${saldos.length - 5})`}
            </button>
          )}
        </div>
      )}
    </PremiumCard>
  )
}
