'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { MoneyFlowMode, MoneyFlowPoint } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

type MoneyFlowResponse = {
  mode: MoneyFlowMode
  months: number
  series: MoneyFlowPoint[]
}

type SavingsPoint = {
  month: string
  savingsRate: number
  ingresos: number
  egresos: number
}

const GAUGE_MAX = 40
const GAUGE_W = 340
const GAUGE_H = 42
const SPARK_W = 340
const SPARK_H = 42
const fetcher = (url: string) => fetchDashboardData<MoneyFlowResponse>(url)

function formatPercent(value: number) {
  return `${formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function formatPen(value: number) {
  return `S/ ${formatNumber(value, { maximumFractionDigits: 0 })}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function rateTone(rate: number) {
  if (rate >= 20) {
    return {
      text: 'text-[var(--ft-primary)]',
      fill: 'var(--ft-primary)',
      soft: 'color-mix(in oklch, var(--ft-primary) 13%, var(--ft-surface-muted))',
      label: 'Sobre meta',
    }
  }
  if (rate >= 10) {
    return {
      text: 'text-[var(--ft-warning)]',
      fill: 'var(--ft-warning)',
      soft: 'color-mix(in oklch, var(--ft-warning) 16%, var(--ft-surface-muted))',
      label: 'En progreso',
    }
  }

  return {
    text: 'text-[var(--ft-danger)]',
    fill: 'var(--ft-danger)',
    soft: 'color-mix(in oklch, var(--ft-danger) 14%, var(--ft-surface-muted))',
    label: 'Bajo meta',
  }
}

function sparklinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`

    const previous = points[index - 1]
    if (!previous) return path

    const midX = (previous.x + point.x) / 2
    return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`
  }, '')
}

function BulletGauge({ rate }: { rate: number }) {
  const markerX = (clamp(rate, 0, GAUGE_MAX) / GAUGE_MAX) * GAUGE_W
  const tone = rateTone(rate)
  const metaX = (20 / GAUGE_MAX) * GAUGE_W

  return (
    <svg viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`} className="h-[42px] w-full overflow-visible" role="img" aria-label={`Tasa de ahorro actual ${formatPercent(rate)}`}>
      <rect x="0" y="18" width={GAUGE_W * 0.25} height="10" rx="5" fill="color-mix(in oklch, var(--ft-danger) 20%, var(--ft-surface-muted))" />
      <rect x={GAUGE_W * 0.25} y="18" width={GAUGE_W * 0.25} height="10" rx="5" fill="color-mix(in oklch, var(--ft-warning) 22%, var(--ft-surface-muted))" />
      <rect x={GAUGE_W * 0.5} y="18" width={GAUGE_W * 0.5} height="10" rx="5" fill="color-mix(in oklch, var(--ft-primary) 19%, var(--ft-surface-muted))" />
      <line x1={metaX} x2={metaX} y1="10" y2="34" stroke="var(--ft-warning)" strokeWidth="1.5" strokeLinecap="round" />
      <text x={metaX + 6} y="10" fill="var(--ft-warning)" fontSize="10" fontWeight="700">
        Meta
      </text>
      <g className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ transform: `translateX(${markerX}px)` }}>
        <path d="M -5 3 L 5 3 L 0 12 Z" fill={tone.fill} />
        <line x1="0" x2="0" y1="12" y2="34" stroke={tone.fill} strokeWidth="2" strokeLinecap="round" />
        <circle cx="0" cy="23" r="4" fill="var(--ft-surface)" stroke={tone.fill} strokeWidth="2" />
      </g>
    </svg>
  )
}

function Sparkline({
  points,
  selectedIndex,
  onSelect,
}: {
  points: SavingsPoint[]
  selectedIndex: number
  onSelect: (index: number) => void
}) {
  const plotted = useMemo(() => {
    const rates = points.map((point) => point.savingsRate)
    const minRate = Math.min(0, 20, ...rates)
    const maxRate = Math.max(20, ...rates)
    const spread = Math.max(1, maxRate - minRate)
    const count = Math.max(1, points.length - 1)

    return points.map((point, index) => ({
      point,
      x: points.length === 1 ? SPARK_W / 2 : (index / count) * SPARK_W,
      y: 6 + (1 - ((point.savingsRate - minRate) / spread)) * (SPARK_H - 12),
    }))
  }, [points])
  const path = sparklinePath(plotted)

  return (
    <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="h-[42px] w-full overflow-visible" role="img" aria-label="Tendencia de tasa de ahorro de seis meses">
      <path d={path} fill="none" stroke="color-mix(in oklch, var(--ft-text-muted) 42%, transparent)" strokeWidth="2" strokeLinecap="round" />
      {plotted.map(({ point, x, y }, index) => {
        const tone = rateTone(point.savingsRate)
        const isSelected = selectedIndex === index

        return (
          <g key={`${point.month}-${index}`}>
            <circle
              cx={x}
              cy={y}
              r={isSelected ? 7 : 5}
              fill="var(--ft-surface)"
              stroke={tone.fill}
              strokeWidth={isSelected ? 3 : 2}
              className="cursor-pointer transition-[r,stroke-width,filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ filter: isSelected ? 'drop-shadow(0 4px 10px color-mix(in oklch, var(--ft-text) 12%, transparent))' : undefined }}
              role="button"
              tabIndex={0}
              aria-label={`${point.month}: ${formatPercent(point.savingsRate)}`}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(index)
                }
              }}
            />
            <circle cx={x} cy={y} r="2.25" fill={tone.fill} pointerEvents="none" />
          </g>
        )
      })}
    </svg>
  )
}

function SelectedMonthCard({ point }: { point: SavingsPoint }) {
  const tone = rateTone(point.savingsRate)

  return (
    <div className="rounded-[16px] border border-[var(--ft-border)] bg-[var(--ft-surface)] px-3 py-3 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--ft-text-on-primary)_18%,transparent)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-[var(--ft-text)]">{point.month}</p>
          <p className={`mt-1 text-[1.05rem] font-semibold leading-none tabular-nums ${tone.text}`}>
            {formatPercent(point.savingsRate)}
          </p>
        </div>
        <span
          className="rounded-full px-2 py-1 text-[10px] font-semibold"
          style={{ backgroundColor: tone.soft, color: tone.fill }}
        >
          {tone.label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <span className="text-[var(--ft-text-muted)]">Ingresos</span>
        <span className="text-right font-semibold tabular-nums text-[var(--ft-primary)]">
          {formatPen(point.ingresos)}
        </span>
        <span className="text-[var(--ft-text-muted)]">Egresos</span>
        <span className="text-right font-semibold tabular-nums text-[var(--ft-danger)]">
          {formatPen(point.egresos)}
        </span>
      </div>
    </div>
  )
}

export function SavingsRateTrendChart() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const { data, isLoading } = useSWR('/api/dashboard/money-flow?months=6&mode=acumulado', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
  })

  const savingsData = useMemo(
    () => (data?.series ?? []).map((point) => ({
      month: point.month,
      savingsRate: point.ingresos > 0 ? ((point.ingresos - point.egresos) / point.ingresos) * 100 : 0,
      ingresos: point.ingresos,
      egresos: point.egresos,
    })),
    [data?.series]
  )

  const currentRate = savingsData.at(-1)?.savingsRate ?? 0
  const currentTone = rateTone(currentRate)
  const selectedPoint = savingsData[selectedIndex ?? savingsData.length - 1] ?? savingsData.at(-1) ?? null
  const activeIndex = selectedPoint ? savingsData.indexOf(selectedPoint) : -1

  if (isLoading && savingsData.length === 0) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-36 rounded bg-[var(--ft-surface-muted)]" />
          <div className="h-24 rounded-[20px] bg-[var(--ft-surface-muted)]" />
          <div className="h-16 rounded-[16px] bg-[var(--ft-surface-muted)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            Tasa de ahorro
          </p>
          <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">
            Lectura compacta contra la meta sana de 20%.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]">Último mes</p>
          <p className={`mt-1 text-[1rem] font-semibold tabular-nums ${currentTone.text}`}>
            {formatPercent(currentRate)}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-[20px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]">
            Gauge mensual
          </p>
          <p className={`text-[11px] font-semibold ${currentTone.text}`}>{currentTone.label}</p>
        </div>
        <div className="mt-3">
          <BulletGauge rate={currentRate} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--ft-text-muted)]">
          <span>0%</span>
          <span>10%</span>
          <span>20%</span>
          <span>40%+</span>
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]">
            Últimos 6 meses
          </p>
          <p className="text-[10.5px] text-[var(--ft-text-muted)]">Click en un punto</p>
        </div>
        <div className="mt-3">
          <Sparkline
            points={savingsData}
            selectedIndex={activeIndex}
            onSelect={(index) => setSelectedIndex(index)}
          />
        </div>
      </div>

      {selectedPoint && (
        <div className="mt-3">
          <SelectedMonthCard point={selectedPoint} />
        </div>
      )}
    </PremiumCard>
  )
}
