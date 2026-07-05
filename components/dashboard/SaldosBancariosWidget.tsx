'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import type { DashboardSidebar } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'
import { SmartTip } from './SmartTip'

const fetcher = (url: string) => fetchDashboardData<DashboardSidebar>(url)
const SEGMENT_COLORS = [
  'color-mix(in oklch, var(--ft-primary) 78%, var(--ft-surface))',
  'color-mix(in oklch, var(--ft-info) 74%, var(--ft-surface))',
  'color-mix(in oklch, var(--ft-success) 72%, var(--ft-surface))',
  'color-mix(in oklch, var(--ft-warning) 76%, var(--ft-surface))',
  'color-mix(in oklch, var(--ft-danger) 70%, var(--ft-surface))',
]

function PortfolioEmptyState() {
  return (
    <div className="mt-5 rounded-[20px] border border-dashed border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-5 py-6 text-center">
      <svg
        aria-hidden="true"
        className="mx-auto h-16 w-16 text-[var(--ft-primary)]"
        fill="none"
        viewBox="0 0 64 64"
      >
        <circle cx="32" cy="32" r="25" stroke="currentColor" strokeOpacity="0.18" strokeWidth="6" />
        <path
          d="M20 27.5h24M20 36.5h24M24 19h16a6 6 0 0 1 6 6v19a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V25a6 6 0 0 1 6-6Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      <p className="mt-4 text-[13px] font-semibold text-[var(--ft-text)]">
        Sin saldos disponibles
      </p>
      <p className="mx-auto mt-2 max-w-[18rem] text-[11px] leading-5 text-[var(--ft-text-muted)]">
        Agrega una cuenta o portafolio para ver cómo se distribuye tu liquidez.
      </p>
      <Link
        href="/portfolio"
        className="group mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-4 py-2 text-[11px] font-semibold text-[var(--ft-primary)] transition-[background-color,color,transform,border-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-[var(--ft-primary)] hover:bg-[var(--ft-primary)] hover:text-[var(--ft-text-on-primary)] active:scale-[0.98]"
      >
        <span>Agregar portafolio</span>
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--ft-surface)] text-[var(--ft-primary)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
          ↗
        </span>
      </Link>
    </div>
  )
}

export function SaldosBancariosWidget() {
  const [showAll, setShowAll] = useState(false)
  const { data, isLoading } = useSWR('/api/dashboard/sidebar', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
  })

  const saldos = data?.saldos_bancarios.items ?? []
  const total = data?.saldos_bancarios.total_consolidado ?? 0
  const distribution = saldos
    .filter((item) => item.saldo > 0)
    .map((item, index) => ({
      ...item,
      color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
    }))
  const distributionTotal = distribution.reduce((sum, item) => sum + item.saldo, 0)
  const visible = showAll ? distribution : distribution.slice(0, 5)
  const hasMore = distribution.length > 5

  if (isLoading && !data) {
    return (
      <PremiumCard innerClassName="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-28 rounded bg-[var(--ft-surface-muted)]" />
          <div className="h-8 w-44 rounded bg-[var(--ft-surface-muted)]" />
          <div className="h-24 rounded-[18px] bg-[var(--ft-surface-muted)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            Saldos bancarios
          </p>
          <p className="mt-2 text-[2rem] font-semibold leading-none tracking-normal text-[var(--ft-text)]">
            {formatCurrency(total, 'PEN')}
          </p>
          <p className="mt-1 text-[11px] text-[var(--ft-text-muted)]">
            Total consolidado
          </p>
        </div>
        <SmartTip text="Este panel te muestra cómo se distribuye tu liquidez actual entre portafolios para detectar concentración y margen de maniobra." />
      </div>

      {distribution.length === 0 || distributionTotal <= 0 ? (
        <PortfolioEmptyState />
      ) : (
        <div className="mt-5">
          <div className="overflow-hidden rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-1">
            <div className="flex h-9 overflow-hidden rounded-full bg-[var(--ft-surface)]">
              {distribution.map((item) => {
                const pct = Math.max(0, (item.saldo / distributionTotal) * 100)

                return (
                  <div
                    key={item.portfolio_id}
                    className="relative flex min-w-[3px] items-center justify-center overflow-hidden text-[10px] font-semibold text-[var(--ft-text-on-primary)] transition-[filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:brightness-105"
                    style={{
                      width: `${pct}%`,
                      background: item.color,
                    }}
                    title={`${item.name}: ${formatNumber(pct, { maximumFractionDigits: 1 })}%`}
                  >
                    {pct >= 12 && (
                      <span className="truncate px-2 tabular-nums">
                        {formatNumber(pct, { maximumFractionDigits: 0 })}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {visible.map((item) => (
              <div
                key={item.portfolio_id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: item.color }}
                />
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[12px] font-medium text-[var(--ft-text)]">{item.name}</span>
                    <span className="text-[11px] font-semibold tabular-nums text-[var(--ft-text)]">
                      {formatNumber((item.saldo / distributionTotal) * 100, { maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--ft-surface-muted)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(3, (item.saldo / distributionTotal) * 100)}%`,
                        background: item.color,
                      }}
                    />
                  </div>
                </div>
                <span className="text-[11px] tabular-nums text-[var(--ft-text-muted)]">
                  {formatCurrency(item.saldo, 'PEN')}
                </span>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="mt-3 text-[11px] font-semibold text-[var(--ft-primary)] transition-[color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-[var(--ft-primary-hover)] active:scale-[0.98]"
            >
              {showAll ? 'Ver menos' : `Ver más (${distribution.length - 5})`}
            </button>
          )}
        </div>
      )}
    </PremiumCard>
  )
}
