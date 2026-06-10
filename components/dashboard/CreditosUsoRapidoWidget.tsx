'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { ProgressMetric } from '@/components/finance'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import type { ModulesSummary } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'
import { chartTheme } from './chartTheme'

const fetcher = (url: string) => fetchDashboardData<ModulesSummary>(url)

export function CreditosUsoRapidoWidget() {
  const { data, isLoading } = useSWR('/api/dashboard/modules-summary', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const totalLimit = data?.creditos_limite_total ?? 0
  const totalUsed = data?.creditos_uso_total ?? 0
  const usagePct = Math.max(0, Math.min(100, data?.creditos_uso_pct ?? 0))
  const available = Math.max(0, totalLimit - totalUsed)
  const usageTone = usagePct >= 90 ? 'danger' : usagePct >= 70 ? 'warning' : 'primary'

  if (isLoading && !data) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-36 rounded bg-[var(--ft-surface-muted)]" />
          <div className="h-16 rounded-[18px] bg-[var(--ft-surface-muted)]" />
          <div className="h-20 rounded-[18px] bg-[var(--ft-surface-muted)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            Créditos uso rápido
          </p>
          <p className="mt-1 text-[11px] text-[var(--ft-text-muted)]">
            Lectura inmediata del endeudamiento activo.
          </p>
        </div>

        <Link
          href="/credits"
          className="group inline-flex items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-2 py-1.5 text-[11px] font-semibold text-[var(--ft-text)] transition-[border-color,background-color,transform] duration-200 ease-[var(--ease-out)] hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)] active:scale-[0.98]"
        >
          <span>Ir a Créditos</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface)] text-[var(--ft-primary)] transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
            ↗
          </span>
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ft-text-subtle)]">Cupo total</p>
          <p className="mt-2 text-[1.2rem] font-semibold tabular-nums tracking-[-0.03em] text-[var(--ft-text)]">
            {formatCurrency(totalLimit, 'PEN')}
          </p>
        </div>

        <div className="rounded-[18px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ft-text-subtle)]">Cupo usado</p>
          <p
            className="mt-2 text-[1.2rem] font-semibold tabular-nums tracking-[-0.03em]"
            style={{ color: usagePct >= 90 ? chartTheme.negative : usagePct >= 70 ? chartTheme.warning : chartTheme.positive }}
          >
            {formatCurrency(totalUsed, 'PEN')}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-[var(--ft-border)] bg-[var(--ft-surface)] px-4 py-4">
        <ProgressMetric
          value={usagePct}
          label="Utilización consolidada"
          valueLabel={`${formatNumber(usagePct, { maximumFractionDigits: 1 })}%`}
          tone={usageTone}
          description={`Disponible inmediato: ${formatCurrency(available, 'PEN')} · ${data?.creditos ?? 0} línea${data?.creditos === 1 ? '' : 's'} activa${data?.creditos === 1 ? '' : 's'}.`}
        />
      </div>

      <p className="mt-4 rounded-[18px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-3 text-[11px] leading-5 text-[var(--ft-text-muted)]">
        {usagePct >= 90
          ? 'La utilización está en zona crítica y conviene revisar líneas de mayor presión.'
          : usagePct >= 70
            ? 'La utilización está elevada; el margen operativo empieza a comprimirse.'
            : 'La utilización se mantiene contenida y deja holgura para maniobra financiera.'}
      </p>
    </PremiumCard>
  )
}
