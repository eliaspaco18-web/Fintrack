'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { ModulesSummary } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const fetcher = (url: string) => fetchDashboardData<ModulesSummary>(url)

export function ModulesMiniCards() {
  const { data, isLoading } = useSWR('/api/dashboard/modules-summary', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  if (isLoading && !data) {
    return (
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <PremiumCard key={idx} innerClassName="p-4">
            <div className="animate-pulse">
              <div className="h-3 w-20 rounded bg-[var(--c-surface-2)]" />
              <div className="mt-3 h-6 w-16 rounded bg-[var(--c-surface-2)]" />
            </div>
          </PremiumCard>
        ))}
      </section>
    )
  }

  const pendientes = (data?.por_cobrar.count ?? 0) + (data?.por_pagar.count ?? 0)
  const creditUsage = data?.creditos_uso_pct ?? 0
  const creditUsageSafe = Math.max(0, Math.min(100, creditUsage))
  const posicionNeta = data?.posicion_neta ?? 0

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <PremiumCard as="article" innerClassName="p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Cuentas</p>
        <p className="mt-2 text-[1.3rem] font-semibold leading-none tabular-nums text-[var(--c-text)]">{data?.cuentas ?? 0}</p>
        <Link href="/portfolio" className="mt-3 inline-flex text-[11px] font-semibold text-[var(--c-primary)] hover:underline">
          Gestionar
        </Link>
        <p className="mt-3 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-2.5 py-2 text-[11px] text-[var(--c-text-muted)]">
          Total consolidado: <span className="font-semibold text-[var(--c-text)]">S/ {formatNumber(data?.cuentas_total_consolidado ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </p>
      </PremiumCard>

      <PremiumCard as="article" innerClassName="p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Créditos</p>
        <p className="mt-2 text-[1.3rem] font-semibold leading-none tabular-nums text-[var(--c-text)]">{data?.creditos ?? 0}</p>
        <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">Uso: {formatNumber(data?.creditos_uso_pct ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
          <div className="h-full rounded-full bg-[var(--c-primary)]" style={{ width: `${creditUsageSafe}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-[var(--c-text-muted)]">
          {formatNumber(data?.creditos_uso_total ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {formatNumber(data?.creditos_limite_total ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <Link href="/credits" className="mt-2 inline-flex text-[11px] font-semibold text-[var(--c-primary)] hover:underline">
          Ver todos
        </Link>
      </PremiumCard>

      <PremiumCard as="article" innerClassName="p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Activos</p>
        <p className="mt-2 text-[1.3rem] font-semibold leading-none tabular-nums text-[var(--c-text)]">{data?.activos.count ?? 0}</p>
        <p className="mt-1 text-[11px] text-[var(--c-text-muted)]">S/ {formatNumber(data?.activos.total_soles ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <Link href="/assets" className="mt-2 inline-flex text-[11px] font-semibold text-[var(--c-primary)] hover:underline">
          Ver todos
        </Link>
      </PremiumCard>

      <PremiumCard as="article" innerClassName="p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Por cobrar / pagar</p>
        <p className="mt-2 text-[1.3rem] font-semibold leading-none tabular-nums text-[var(--c-text)]">{pendientes}</p>
        <p className="mt-2 text-[11px] text-[var(--c-text-muted)]">
          <span className={posicionNeta >= 0 ? 'text-[var(--c-primary)]' : 'text-[var(--c-danger)]'}>{posicionNeta >= 0 ? '↑' : '↓'}</span>{' '}
          Posición neta: S/ {formatNumber(Math.abs(posicionNeta), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div className="mt-3 flex items-center gap-3 text-[11px] font-semibold">
          <Link href="/receivables" className="text-[var(--c-primary)] hover:underline">Por cobrar</Link>
          <Link href="/payables" className="text-[var(--c-primary)] hover:underline">Por pagar</Link>
        </div>
      </PremiumCard>
    </section>
  )
}
