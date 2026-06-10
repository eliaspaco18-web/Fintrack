'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { DashboardSidebar } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'
import { SmartTip } from './SmartTip'
import { chartTheme } from './chartTheme'

const fetcher = (url: string) => fetchDashboardData<DashboardSidebar>(url)

function TopCounterpartyList({
  title,
  items,
  accent,
}: {
  title: string
  items: DashboardSidebar['flujo_pendiente']['top_deudores']
  accent: string
}) {
  return (
    <div className="rounded-[18px] border border-[var(--ft-border)] bg-[var(--ft-surface)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]">
        {title}
      </p>

      {items.length === 0 ? (
        <p className="mt-3 text-[11px] leading-5 text-[var(--ft-text-muted)]">
          Sin contrapartes destacadas en este período.
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group flex items-center justify-between gap-3 rounded-[14px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2.5 transition-[border-color,background-color,transform] duration-200 ease-[var(--ease-out)] hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)] active:scale-[0.99]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  <span className="truncate text-[12px] font-medium text-[var(--ft-text)]">
                    {item.name}
                  </span>
                </div>
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--ft-text-subtle)]">
                  Abrir ficha
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tabular-nums text-[var(--ft-text)]">
                  S/ {formatNumber(item.pending_amount_pen, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface)] text-[11px] transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:-translate-y-px"
                  style={{ color: accent }}
                >
                  ↗
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function FlujoPendienteWidget() {
  const { data, isLoading } = useSWR('/api/dashboard/sidebar', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const flujo = data?.flujo_pendiente
  const porCobrar = flujo?.por_cobrar_total ?? 0
  const porPagar = flujo?.por_pagar_total ?? 0
  const neto = flujo?.neto ?? 0
  const maxValue = Math.max(porCobrar, porPagar, 1)
  const cobrarPct = (porCobrar / maxValue) * 100
  const pagarPct = (porPagar / maxValue) * 100

  const nota = neto > 0
    ? 'Tu posición favorece tu flujo de caja.'
    : neto < 0
      ? 'Tu posición perjudica tu flujo de caja.'
      : 'Tu posición está equilibrada.'
  const topDeudores = flujo?.top_deudores ?? []
  const topAcreedores = flujo?.top_acreedores ?? []

  if (isLoading && !data) {
    return (
      <PremiumCard innerClassName="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-36 rounded bg-[var(--ft-surface-muted)]" />
          <div className="h-7 w-40 rounded bg-[var(--ft-surface-muted)]" />
          <div className="h-24 rounded bg-[var(--ft-surface-muted)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            Flujo pendiente neto
          </p>
          <p className={`mt-2 text-[1.45rem] font-semibold leading-none tracking-[-0.02em] tabular-nums ${neto >= 0 ? 'text-[var(--ft-primary)]' : 'text-[var(--ft-danger)]'}`}>
            S/ {formatNumber(neto, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <SmartTip text="Compara lo que te deben contra lo que debes pagar para anticipar tensión o holgura en caja." />
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
            <span className="text-[var(--ft-text)]">Por cobrar ({flujo?.por_cobrar_count ?? 0} movimientos)</span>
            <span className="font-semibold tabular-nums" style={{ color: chartTheme.positive }}>
              S/ {formatNumber(porCobrar, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--ft-surface-muted)]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(6, cobrarPct)}%`, backgroundColor: chartTheme.positive }} />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
            <span className="text-[var(--ft-text)]">Por pagar ({flujo?.por_pagar_count ?? 0} pendientes)</span>
            <span className="font-semibold tabular-nums" style={{ color: chartTheme.negative }}>
              S/ {formatNumber(porPagar, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ft-danger)_12%,transparent)]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(6, pagarPct)}%`, backgroundColor: chartTheme.negative }} />
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2 text-[11px] leading-5 text-[var(--ft-text-muted)]">
        {nota}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <TopCounterpartyList
          title="Top 3 deudores"
          items={topDeudores}
          accent={chartTheme.positive}
        />
        <TopCounterpartyList
          title="Top 3 acreedores"
          items={topAcreedores}
          accent={chartTheme.negative}
        />
      </div>
    </PremiumCard>
  )
}
