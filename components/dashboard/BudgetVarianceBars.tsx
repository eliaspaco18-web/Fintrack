'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import { clamp } from '@/lib/charts/svg-utils'
import type { BudgetPeriod, CurrencyCode } from '@/types/database.types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const VIEW_W = 720
const ROW_H = 46
const PAD_X = 18
const LABEL_W = 190
const VALUE_W = 116
const PLOT_X = PAD_X + LABEL_W
const PLOT_W = VIEW_W - PLOT_X - VALUE_W - PAD_X
const MAX_VISIBLE = 6

type BudgetVariancePeriod = {
  id: string
  amount: number
  spent_amount: number
  remaining_amount: number
  progress_percent: number
  over_limit: boolean
  period_start: string
  period_end: string
  budget: {
    name: string
    currency: CurrencyCode
    period_type: BudgetPeriod
    category?: {
      name: string
      color: string
    } | null
  }
}

type VarianceRow = BudgetVariancePeriod & {
  pressure: number
}

const fetcher = (url: string) => fetchDashboardData<BudgetVariancePeriod[]>(url)

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function currentPeriodKey() {
  return formatLocalDate(new Date()).slice(0, 7)
}

function dateFromPeriodKey(periodKey: string) {
  const [yearRaw, monthRaw] = periodKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    const now = new Date()
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  }

  return new Date(Date.UTC(year, month - 1, 1))
}

function formatPeriodLabel(periodKey: string) {
  return new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dateFromPeriodKey(periodKey))
}

function shiftPeriod(periodKey: string, offset: number) {
  const date = dateFromPeriodKey(periodKey)
  date.setUTCMonth(date.getUTCMonth() + offset)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function barTone(row: VarianceRow) {
  if (row.over_limit || row.pressure >= 100) return 'var(--ft-danger)'
  if (row.pressure >= 80) return 'var(--ft-warning)'
  return 'var(--ft-primary)'
}

function PeriodButton({
  direction,
  onClick,
}: {
  direction: 'prev' | 'next'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={direction === 'prev' ? 'Mes anterior' : 'Mes siguiente'}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-full text-[var(--ft-text-muted)] transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--ft-surface)] hover:text-[var(--ft-text)] active:scale-[0.95]"
    >
      {direction === 'prev' ? '‹' : '›'}
    </button>
  )
}

function EmptyState({ monthLabel }: { monthLabel: string }) {
  return (
    <div className="mt-4 rounded-[20px] border border-dashed border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-5 py-6 text-center">
      <p className="text-[13px] font-semibold text-[var(--ft-text)]">Sin variación presupuestal</p>
      <p className="mx-auto mt-2 max-w-[20rem] text-[11px] leading-5 text-[var(--ft-text-muted)]">
        No hay periodos presupuestales para comparar durante {monthLabel}.
      </p>
      <Link
        href="/budgets"
        className="mt-4 inline-flex rounded-full border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-4 py-2 text-[11px] font-semibold text-[var(--ft-primary)] transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--ft-primary)] hover:text-[var(--ft-text-on-primary)] active:scale-[0.98]"
      >
        Ir a Presupuestos
      </Link>
    </div>
  )
}

export function BudgetVarianceBars() {
  const [periodKey, setPeriodKey] = useState(currentPeriodKey)
  const monthLabel = formatPeriodLabel(periodKey)
  const { data, isLoading } = useSWR(`/api/budget-periods?period=${periodKey}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const rows: VarianceRow[] = (data ?? [])
    .map((period) => ({
      ...period,
      pressure: Number(period.amount ?? 0) > 0
        ? Math.max(0, (Number(period.spent_amount ?? 0) / Number(period.amount ?? 0)) * 100)
        : 0,
    }))
    .sort((left, right) => right.pressure - left.pressure)

  const visibleRows = rows.slice(0, MAX_VISIBLE)
  const chartH = Math.max(128, 28 + visibleRows.length * ROW_H)
  const maxScale = Math.max(120, ...visibleRows.map((row) => Math.min(160, row.pressure)))
  const totalDefined = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  const totalSpent = rows.reduce((sum, row) => sum + Number(row.spent_amount ?? 0), 0)
  const aggregatePct = totalDefined > 0 ? (totalSpent / totalDefined) * 100 : 0

  if (isLoading && !data) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-3 w-44 rounded-full bg-[var(--ft-surface-muted)]" />
              <div className="h-3 w-56 rounded-full bg-[var(--ft-surface-muted)]" />
            </div>
            <div className="h-7 w-32 rounded-full bg-[var(--ft-surface-muted)]" />
          </div>
          <div className="h-[268px] rounded-[20px] bg-[var(--ft-surface-muted)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            Variación presupuestal
          </p>
          <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">
            Presión de gasto frente al límite del periodo.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-1">
          <PeriodButton direction="prev" onClick={() => setPeriodKey((value) => shiftPeriod(value, -1))} />
          <input
            aria-label="Periodo de variación presupuestal"
            type="month"
            value={periodKey}
            onChange={(event) => setPeriodKey(event.target.value || currentPeriodKey())}
            className="h-7 w-[128px] rounded-full border border-transparent bg-transparent px-2 text-center text-[11px] font-semibold capitalize text-[var(--ft-text)] outline-none transition-[border-color,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--ft-surface)] focus:border-[var(--ft-primary-border)] focus:bg-[var(--ft-surface)]"
          />
          <PeriodButton direction="next" onClick={() => setPeriodKey((value) => shiftPeriod(value, 1))} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[16px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--ft-text-subtle)]">Ejecución</p>
          <p className={`mt-1 text-[1rem] font-semibold tabular-nums ${aggregatePct >= 100 ? 'text-[var(--ft-danger)]' : aggregatePct >= 80 ? 'text-[var(--ft-warning)]' : 'text-[var(--ft-primary)]'}`}>
            {formatNumber(aggregatePct, { maximumFractionDigits: 1 })}%
          </p>
        </div>
        <div className="rounded-[16px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--ft-text-subtle)]">Ejecutado</p>
          <p className="mt-1 text-[1rem] font-semibold tabular-nums text-[var(--ft-text)]">{formatCurrency(totalSpent, 'PEN')}</p>
        </div>
        <div className="rounded-[16px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--ft-text-subtle)]">Periodos</p>
          <p className="mt-1 text-[1rem] font-semibold tabular-nums text-[var(--ft-text)]">{rows.length}</p>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <EmptyState monthLabel={monthLabel} />
      ) : (
        <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-2">
          <svg
            viewBox={`0 0 ${VIEW_W} ${chartH}`}
            className="h-auto w-full"
            role="img"
            aria-label={`Variación presupuestal de ${monthLabel}`}
          >
            <line
              x1={PLOT_X + (100 / maxScale) * PLOT_W}
              x2={PLOT_X + (100 / maxScale) * PLOT_W}
              y1="16"
              y2={chartH - 12}
              stroke="var(--ft-border-strong)"
              strokeDasharray="4 6"
              strokeOpacity="0.65"
            />
            <text
              x={PLOT_X + (100 / maxScale) * PLOT_W + 6}
              y="16"
              fontSize="10"
              fontWeight="700"
              fill="var(--ft-text-subtle)"
            >
              límite
            </text>

            {visibleRows.map((row, index) => {
              const y = 32 + index * ROW_H
              const width = Math.max(4, (clamp(row.pressure, 0, maxScale) / maxScale) * PLOT_W)
              const tone = barTone(row)

              return (
                <g key={row.id}>
                  <text x={PAD_X} y={y + 5} fontSize="12" fontWeight="650" fill="var(--ft-text)">
                    {row.budget.name.length > 24 ? `${row.budget.name.slice(0, 23)}…` : row.budget.name}
                  </text>
                  <text x={PAD_X} y={y + 21} fontSize="10" fontWeight="600" fill="var(--ft-text-muted)">
                    {formatNumber(row.pressure, { maximumFractionDigits: 1 })}% usado
                  </text>
                  <rect
                    x={PLOT_X}
                    y={y - 6}
                    width={PLOT_W}
                    height="14"
                    rx="7"
                    fill="var(--ft-surface)"
                  />
                  <rect
                    x={PLOT_X}
                    y={y - 6}
                    width={width}
                    height="14"
                    rx="7"
                    fill={tone}
                    opacity="0.82"
                    className="budget-variance-bar"
                    style={{ animationDelay: `${index * 60}ms` }}
                  />
                  <text
                    x={VIEW_W - PAD_X}
                    y={y + 5}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="700"
                    fill={row.over_limit ? 'var(--ft-danger)' : 'var(--ft-text)'}
                  >
                    {formatCurrency(row.spent_amount, row.budget.currency)}
                  </text>
                  <text x={VIEW_W - PAD_X} y={y + 21} textAnchor="end" fontSize="10" fontWeight="600" fill="var(--ft-text-muted)">
                    de {formatCurrency(row.amount, row.budget.currency)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}

      {rows.length > MAX_VISIBLE && (
        <p className="mt-3 text-[11px] text-[var(--ft-text-muted)]">
          Mostrando los {MAX_VISIBLE} presupuestos con mayor presión de gasto.
        </p>
      )}

      <style jsx>{`
        .budget-variance-bar {
          animation: budget-variance-enter 520ms cubic-bezier(0.32, 0.72, 0, 1) both;
          transform-box: fill-box;
          transform-origin: left center;
        }

        @keyframes budget-variance-enter {
          from {
            opacity: 0;
            transform: scaleX(0.18);
          }
          to {
            opacity: 0.82;
            transform: scaleX(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .budget-variance-bar {
            animation: none;
          }
        }
      `}</style>
    </PremiumCard>
  )
}
