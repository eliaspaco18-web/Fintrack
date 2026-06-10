'use client'

import useSWR from 'swr'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { DashboardSidebar } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const fetcher = (url: string) => fetchDashboardData<DashboardSidebar>(url)

export function TopCategoriesWidget() {
  const { data, isLoading } = useSWR('/api/dashboard/sidebar', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const items = (data?.egresos_categoria ?? [])
    .slice()
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5)

  const concentrationTop3 = items
    .slice(0, 3)
    .reduce((sum, item) => sum + item.pct, 0)

  if (isLoading && !data) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-40 rounded bg-[var(--c-surface-2)]" />
          <div className="h-[196px] rounded-[20px] bg-[var(--c-surface-2)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-text-faint)]">
            Top categorías
          </p>
          <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
            Ranking operativo para detectar concentración de gasto.
          </p>
        </div>
        <span className="rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-muted)]">
          Top 5
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-5 text-[12px] text-[var(--c-text-muted)]">
          Todavía no hay gasto suficiente para construir el ranking.
        </p>
      ) : (
        <>
          <div className="mt-5 space-y-3.5">
            {items.map((category, index) => (
              <div key={category.category_id ?? category.name} className="group">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="text-[11px] tabular-nums text-[var(--c-text-faint)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="h-2.5 w-2.5 rounded-full shadow-[0_0_0_3px_color-mix(in_srgb,var(--c-surface)_90%,transparent)]"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="truncate text-[12px] font-medium text-[var(--c-text)]">
                      {category.name}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="block text-[11px] font-semibold tabular-nums text-[var(--c-text)]">
                      S/ {formatNumber(category.monto, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="block text-[10px] tabular-nums text-[var(--c-text-muted)]">
                      {formatNumber(category.pct, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
                  <div
                    className="h-full rounded-full transition-[width,opacity,transform] duration-700 ease-[var(--ease-out)] group-hover:opacity-85"
                    style={{ width: `${Math.max(4, category.pct)}%`, backgroundColor: category.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3.5 py-3 text-[11px] leading-5 text-[var(--c-text-muted)]">
            Las tres primeras concentran {formatNumber(concentrationTop3, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% del gasto categorizado.
          </p>
        </>
      )}
    </PremiumCard>
  )
}
