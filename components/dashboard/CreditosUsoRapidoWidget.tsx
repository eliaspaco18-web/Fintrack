'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import type { ModulesSummary } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const fetcher = (url: string) => fetchDashboardData<ModulesSummary>(url)
const RING_SIZE = 148
const RING_STROKE = 12
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function usageToneColor(value: number) {
  if (value >= 90) return 'var(--ft-danger)'
  if (value >= 70) return 'var(--ft-warning)'
  return 'var(--ft-primary)'
}

function usageToneLabel(value: number) {
  if (value >= 90) return 'Zona crítica'
  if (value >= 70) return 'Uso elevado'
  return 'Uso controlado'
}

function CreditUsageRing({
  value,
  toneColor,
}: {
  value: number
  toneColor: string
}) {
  const offset = RING_CIRCUMFERENCE * (1 - value / 100)

  return (
    <div className="relative mx-auto grid h-[164px] w-[164px] place-items-center rounded-full bg-[color-mix(in_oklch,var(--ft-surface-muted)_70%,transparent)]">
      <svg
        aria-label={`Utilización consolidada ${formatNumber(value, { maximumFractionDigits: 1 })}%`}
        className="h-[148px] w-[148px] -rotate-90"
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="color-mix(in_oklch,var(--ft-border)_76%,transparent)"
          strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={toneColor}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={RING_STROKE}
          className="transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.04em] text-[var(--ft-text)]">
            {formatNumber(value, { maximumFractionDigits: 0 })}%
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]">
            usado
          </p>
        </div>
      </div>
    </div>
  )
}

function CreditEmptyState() {
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
          d="M22 35.5h20M22 28.5h20M24 22h16a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H24a5 5 0 0 1-5-5V27a5 5 0 0 1 5-5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      <p className="mt-4 text-[13px] font-semibold text-[var(--ft-text)]">
        Sin líneas de crédito activas
      </p>
      <p className="mx-auto mt-2 max-w-[18rem] text-[11px] leading-5 text-[var(--ft-text-muted)]">
        Registra una línea para ver utilización, cupo disponible y presión de endeudamiento.
      </p>
      <Link
        href="/credits"
        className="group mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-4 py-2 text-[11px] font-semibold text-[var(--ft-primary)] transition-[background-color,color,transform,border-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-[var(--ft-primary)] hover:bg-[var(--ft-primary)] hover:text-[var(--ft-text-on-primary)] active:scale-[0.98]"
      >
        <span>Registrar línea de crédito</span>
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--ft-surface)] text-[var(--ft-primary)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
          ↗
        </span>
      </Link>
    </div>
  )
}

export function CreditosUsoRapidoWidget() {
  const { data, isLoading } = useSWR('/api/dashboard/modules-summary', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
  })

  const totalLimit = data?.creditos_limite_total ?? 0
  const totalUsed = data?.creditos_uso_total ?? 0
  const usagePct = Math.max(0, Math.min(100, data?.creditos_uso_pct ?? 0))
  const available = data?.creditos_disponible_total ?? Math.max(0, totalLimit - totalUsed)
  const activeCredits = data?.creditos ?? 0
  const hasCredits = activeCredits > 0 && totalLimit > 0
  const toneColor = usageToneColor(usagePct)

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
          className="group inline-flex items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-2 py-1.5 text-[11px] font-semibold text-[var(--ft-text)] transition-[border-color,background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)] active:scale-[0.98]"
        >
          <span>Ir a Créditos</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface)] text-[var(--ft-primary)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
            ↗
          </span>
        </Link>
      </div>

      {!hasCredits ? (
        <CreditEmptyState />
      ) : (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
            <CreditUsageRing value={usagePct} toneColor={toneColor} />

            <div className="grid gap-3">
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
                  style={{ color: toneColor }}
                >
                  {formatCurrency(totalUsed, 'PEN')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[18px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: toneColor }}>
                {usageToneLabel(usagePct)}
              </span>
              <span className="text-[11px] tabular-nums text-[var(--ft-text-muted)]">
                Disponible: {formatCurrency(available, 'PEN')}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[var(--ft-text-muted)]">
              {usagePct >= 90
                ? 'La utilización está en zona crítica y conviene revisar líneas de mayor presión.'
                : usagePct >= 70
                  ? 'La utilización está elevada; el margen operativo empieza a comprimirse.'
                  : `La utilización se mantiene contenida en ${activeCredits} línea${activeCredits === 1 ? '' : 's'} activa${activeCredits === 1 ? '' : 's'}.`}
            </p>
          </div>
        </>
      )}
    </PremiumCard>
  )
}
