'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { clamp, formatAxisValue, smoothPath } from '@/lib/charts/svg-utils'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { SaldoDiaPeriod, SaldoDiaPoint } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

type SaldoDiaVisualPoint = SaldoDiaPoint & {
  min_saldo?: number
  max_saldo?: number
}

type SaldoDiaResponse = {
  period: SaldoDiaPeriod
  points: SaldoDiaPoint[]
  totals: {
    ingresos: number
    egresos: number
  }
}

type PlottedPoint = {
  point: SaldoDiaVisualPoint
  x: number
  closeY: number
  minY: number
  maxY: number
  hasRange: boolean
  label: string
}

const PERIODS: SaldoDiaPeriod[] = ['5D', '1M', '3M', '6M', '1A']
const fetcher = (url: string) => fetchDashboardData<SaldoDiaResponse>(url)

const CHART_WIDTH = 960
const CHART_HEIGHT = 292
const PADDING = { top: 34, right: 36, bottom: 46, left: 74 }

function formatDateLabel(value: string) {
  return new Date(`${value}T12:00:00`)
    .toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
    .replace('.', '')
}

function buildDomain(points: SaldoDiaVisualPoint[], average: number) {
  const values = points.flatMap((point) => [
    point.saldo,
    point.min_saldo ?? point.saldo,
    point.max_saldo ?? point.saldo,
  ])

  if (average > 0) values.push(average)
  if (values.length === 0) return { min: 0, max: 1 }

  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const spread = rawMax - rawMin
  const padding = spread > 0 ? spread * 0.14 : Math.max(Math.abs(rawMax) * 0.08, 1)

  return {
    min: rawMin - padding,
    max: rawMax + padding,
  }
}

function buildAreaPath(path: string, plotted: PlottedPoint[]) {
  const first = plotted[0]
  const last = plotted.at(-1)

  if (!path || !first || !last) return ''
  return `${path} L ${last.x} ${CHART_HEIGHT - PADDING.bottom} L ${first.x} ${CHART_HEIGHT - PADDING.bottom} Z`
}

function shouldShowMarker(item: PlottedPoint, index: number, plotted: PlottedPoint[]) {
  const lastIndex = plotted.length - 1
  const previous = plotted[index - 1]
  const next = plotted[index + 1]

  if (index === 0 || index === lastIndex) return true

  const isLocalPeak =
    previous &&
    next &&
    item.point.saldo > previous.point.saldo &&
    item.point.saldo > next.point.saldo
  const isLocalValley =
    previous &&
    next &&
    item.point.saldo < previous.point.saldo &&
    item.point.saldo < next.point.saldo

  return Boolean(isLocalPeak || isLocalValley)
}

function averageLabelPosition(averageY: number) {
  const labelWidth = 116
  const labelHeight = 24
  const x = CHART_WIDTH - PADDING.right - labelWidth
  const y = clamp(
    averageY < PADDING.top + labelHeight + 10
      ? averageY + 10
      : averageY - labelHeight - 10,
    PADDING.top,
    CHART_HEIGHT - PADDING.bottom - labelHeight
  )

  return { x, y, width: labelWidth, height: labelHeight }
}

export function SaldosDiaChart() {
  const [period, setPeriod] = useState<SaldoDiaPeriod>('1M')
  const activePeriodIndex = PERIODS.indexOf(period)

  const { data, isLoading } = useSWR(
    `/api/dashboard/saldos-dia?period=${period}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 20_000,
    }
  )

  const points = useMemo(
    () => (data?.points ?? []) as SaldoDiaVisualPoint[],
    [data?.points]
  )
  const totals = data?.totals ?? { ingresos: 0, egresos: 0 }
  const avgSaldo = points.length
    ? points.reduce((sum, point) => sum + point.saldo, 0) / points.length
    : 0

  const chart = useMemo(() => {
    const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right
    const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom
    const domain = buildDomain(points, avgSaldo)
    const domainSpan = domain.max - domain.min || 1
    const y = (value: number) =>
      PADDING.top + ((domain.max - value) / domainSpan) * plotHeight
    const x = (index: number) =>
      points.length <= 1
        ? PADDING.left + plotWidth / 2
        : PADDING.left + (index / (points.length - 1)) * plotWidth

    const plotted: PlottedPoint[] = points.map((point, index) => {
      const minSaldo = point.min_saldo ?? point.saldo
      const maxSaldo = point.max_saldo ?? point.saldo
      const hasRange =
        Number.isFinite(point.min_saldo) &&
        Number.isFinite(point.max_saldo) &&
        Math.abs(maxSaldo - minSaldo) > 0.01

      return {
        point,
        x: x(index),
        closeY: y(point.saldo),
        minY: y(minSaldo),
        maxY: y(maxSaldo),
        hasRange,
        label: formatDateLabel(point.date),
      }
    })

    const yTicks = Array.from({ length: 4 }, (_, index) => {
      const ratio = index / 3
      const value = domain.max - ratio * domainSpan

      return {
        value,
        y: y(value),
      }
    })

    const labelEvery = Math.max(1, Math.ceil(points.length / 5))
    const xLabels = plotted.filter((_, index) => (
      index === 0 ||
      index === plotted.length - 1 ||
      index % labelEvery === 0
    ))

    return {
      plotted,
      yTicks,
      xLabels,
      averageY: y(avgSaldo),
      averageLabel: averageLabelPosition(y(avgSaldo)),
      hasRangeBars: plotted.some((item) => item.hasRange),
      closePath: smoothPath(plotted.map((item) => ({ x: item.x, y: item.closeY }))),
    }
  }, [avgSaldo, points])

  if (isLoading && points.length === 0) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse">
          <div className="h-4 w-44 rounded bg-[var(--ft-surface-muted)]" />
          <div className="mt-4 h-[286px] rounded-[20px] bg-[var(--ft-surface-muted)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-tertiary)]">
            Saldos por día
          </p>
          <p className="mt-1 text-[12px] text-[var(--ft-text-secondary)]">
            Cierre diario con referencia visual de tu nivel normal.
          </p>
        </div>

        <div className="relative grid grid-cols-5 rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-1">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 rounded-full bg-[var(--ft-primary)] shadow-[0_10px_24px_color-mix(in_srgb,var(--ft-primary)_22%,transparent)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              width: `calc((100% - 0.5rem) / ${PERIODS.length})`,
              transform: `translateX(${clamp(activePeriodIndex, 0, PERIODS.length - 1) * 100}%)`,
            }}
          />
          {PERIODS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={`relative z-10 min-w-9 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors duration-200 ${
                period === item
                  ? 'text-[var(--ft-text-inverse)]'
                  : 'text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[292px] w-full overflow-hidden rounded-[20px] border border-[var(--ft-border)] bg-[var(--ft-surface-subtle)]">
        {chart.plotted.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-[var(--ft-text-secondary)]">
            Sin saldos para el periodo seleccionado.
          </div>
        ) : (
          <svg
            role="img"
            aria-label="Saldos diarios del periodo seleccionado"
            className="h-full w-full"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="saldosCloseStroke" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="var(--ft-info)" />
                <stop offset="55%" stopColor="var(--ft-primary)" />
                <stop offset="100%" stopColor="var(--ft-success)" />
              </linearGradient>
              <linearGradient id="saldosCloseArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--ft-primary)" stopOpacity="0.13" />
                <stop offset="100%" stopColor="var(--ft-primary)" stopOpacity="0.015" />
              </linearGradient>
            </defs>

            {chart.yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={PADDING.left}
                  x2={CHART_WIDTH - PADDING.right}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="var(--ft-border)"
                  strokeDasharray="2 8"
                  strokeOpacity={0.75}
                />
                <text
                  x={PADDING.left - 12}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-[var(--ft-text-tertiary)] text-[10px] font-medium"
                >
                  {formatAxisValue(tick.value, 'PEN')}
                </text>
              </g>
            ))}

            <line
              x1={PADDING.left}
              x2={CHART_WIDTH - PADDING.right}
              y1={chart.averageY}
              y2={chart.averageY}
              stroke="var(--ft-warning)"
              strokeDasharray="5 7"
              strokeLinecap="round"
              strokeWidth={1.4}
            />
            <g transform={`translate(${chart.averageLabel.x} ${chart.averageLabel.y})`}>
              <rect
                width={chart.averageLabel.width}
                height={chart.averageLabel.height}
                rx="12"
                fill="var(--ft-surface)"
                stroke="color-mix(in_srgb,var(--ft-warning)_34%,transparent)"
              />
              <text
                x={chart.averageLabel.width / 2}
                y="16"
                textAnchor="middle"
                className="fill-[var(--ft-text-secondary)] text-[10px] font-semibold"
              >
                Prom: {formatAxisValue(avgSaldo, 'PEN')}
              </text>
            </g>

            {chart.hasRangeBars ? (
              chart.plotted.map((item) => (
                <g key={item.point.date}>
                  <line
                    x1={item.x}
                    x2={item.x}
                    y1={item.maxY}
                    y2={item.minY}
                    stroke="color-mix(in_srgb,var(--ft-primary)_46%,var(--ft-surface-muted))"
                    strokeLinecap="round"
                    strokeWidth={7}
                  />
                  <circle
                    cx={item.x}
                    cy={item.closeY}
                    r={4.5}
                    fill={item.point.saldo >= avgSaldo ? 'var(--ft-success)' : 'var(--ft-danger)'}
                    stroke="var(--ft-surface)"
                    strokeWidth={2}
                  />
                </g>
              ))
            ) : (
              <>
                <path
                  d={buildAreaPath(chart.closePath, chart.plotted)}
                  fill="url(#saldosCloseArea)"
                />
                <path
                  d={chart.closePath}
                  fill="none"
                  stroke="url(#saldosCloseStroke)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.8}
                  vectorEffect="non-scaling-stroke"
                />
                {chart.plotted.filter((item, index) => shouldShowMarker(item, index, chart.plotted)).map((item) => (
                  <circle
                    key={item.point.date}
                    cx={item.x}
                    cy={item.closeY}
                    r={5.2}
                    fill={item.point.saldo >= avgSaldo ? 'var(--ft-success)' : 'var(--ft-primary)'}
                    stroke="var(--ft-surface)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </>
            )}

            {chart.xLabels.map((item) => (
              <text
                key={item.point.date}
                x={item.x}
                y={CHART_HEIGHT - 14}
                textAnchor="middle"
                className="fill-[var(--ft-text-tertiary)] text-[10px] font-medium"
              >
                {item.label}
              </text>
            ))}
          </svg>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
        <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--ft-primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--ft-primary)_10%,var(--ft-surface))] px-4 py-3 text-[var(--ft-primary)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">Ingresos acumulados</p>
          <p className="mt-2 text-[1rem] font-semibold tabular-nums">
            S/ {formatNumber(totals.ingresos, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--ft-danger)_24%,transparent)] bg-[color-mix(in_srgb,var(--ft-danger)_10%,var(--ft-surface))] px-4 py-3 text-[var(--ft-danger)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">Egresos acumulados</p>
          <p className="mt-2 text-[1rem] font-semibold tabular-nums">
            S/ {formatNumber(totals.egresos, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </PremiumCard>
  )
}
