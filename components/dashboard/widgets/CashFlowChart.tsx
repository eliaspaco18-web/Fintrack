'use client'

import { useState } from 'react'
import { useCurrency } from '@/lib/hooks/useDashboard'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import type { CashFlowPoint, DailyFlowPoint } from '@/modules/dashboard/dashboard.types'

const VIEW_W = 760
const VIEW_H = 256
const PAD = { top: 20, right: 16, bottom: 36, left: 58 }
const PLOT_W = VIEW_W - PAD.left - PAD.right
const PLOT_H = VIEW_H - PAD.top - PAD.bottom
const BASE_Y = PAD.top + PLOT_H

type RangeKey = '5D' | '1M' | '3M' | '6M' | '1Y'
type ChartSource = 'daily' | 'monthly'

interface ChartPoint {
  id: string
  label: string
  shortLabel: string
  incomePen: number
  expensePen: number
  netPen: number
  balancePen: number
}

const RANGE_OPTIONS: Array<{
  key: RangeKey
  label: string
  dailyDays: number
  monthlyPoints: number
}> = [
  { key: '5D', label: '5D', dailyDays: 5, monthlyPoints: 1 },
  { key: '1M', label: '1M', dailyDays: 30, monthlyPoints: 1 },
  { key: '3M', label: '3M', dailyDays: 90, monthlyPoints: 3 },
  { key: '6M', label: '6M', dailyDays: 180, monthlyPoints: 6 },
  { key: '1Y', label: '1Y', dailyDays: 365, monthlyPoints: 12 },
]

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function controlPoint(
  current: { x: number; y: number },
  previous: { x: number; y: number },
  next: { x: number; y: number },
  reverse = false,
) {
  const smoothing = 0.18
  const prev = previous || current
  const nxt = next || current
  const angle = Math.atan2(nxt.y - prev.y, nxt.x - prev.x) + (reverse ? Math.PI : 0)
  const length = Math.hypot(nxt.x - prev.x, nxt.y - prev.y) * smoothing
  return {
    x: current.x + Math.cos(angle) * length,
    y: current.y + Math.sin(angle) * length,
  }
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return ''

  let d = `M ${points[0]!.x} ${points[0]!.y}`

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!
    const current = points[i]!
    const previous2 = points[i - 2] ?? previous
    const next = points[i + 1] ?? current

    const cp1 = controlPoint(previous, previous2, current)
    const cp2 = controlPoint(current, previous, next, true)

    d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${current.x} ${current.y}`
  }

  return d
}

function formatAxisValue(value: number, preferred: 'PEN' | 'USD') {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const symbol = preferred === 'PEN' ? 'S/' : '$'

  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}k`
  return `${sign}${symbol}${abs.toFixed(0)}`
}

function monthShortLabel(label: string) {
  return label.split(' ')[0]?.slice(0, 3) ?? label.slice(0, 3)
}

function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-white p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-[rgba(13,79,74,0.08)]" />
        <div className="h-8 w-44 rounded-full bg-[rgba(13,79,74,0.06)]" />
      </div>
      <div className="h-[228px] rounded-xl bg-[rgba(13,79,74,0.05)]" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-white p-5 shadow-[var(--shadow-sm)]">
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface-2)]">
        <p className="text-[13px] text-[var(--c-text-muted)]">Sin datos para construir el money flow.</p>
      </div>
    </div>
  )
}

interface CashFlowChartProps {
  data?: CashFlowPoint[]
  dailyData?: DailyFlowPoint[]
  loading?: boolean
}

export function CashFlowChart({ data, dailyData, loading }: CashFlowChartProps) {
  const { preferred, format } = useCurrency()
  const [range, setRange] = useState<RangeKey>('1M')
  const [hovered, setHovered] = useState<number | null>(null)

  if (loading) return <ChartSkeleton />

  const monthly = data ?? []
  const daily = dailyData ?? []

  let source: ChartSource = 'monthly'
  let sourceSeries: ChartPoint[] = []

  if (daily.length >= 2) {
    source = 'daily'
    sourceSeries = daily.map(point => ({
      id: point.date,
      label: point.label,
      shortLabel: point.label.split(' ')[0] ?? point.label,
      incomePen: point.incomePen,
      expensePen: point.expensePen,
      netPen: point.netPen,
      balancePen: point.balancePen,
    }))
  } else {
    let running = 0
    sourceSeries = monthly.map(point => {
      running += point.netPen
      return {
        id: point.month,
        label: point.monthLabel,
        shortLabel: monthShortLabel(point.monthLabel),
        incomePen: point.incomePen,
        expensePen: point.expensePen,
        netPen: point.netPen,
        balancePen: running,
      }
    })
  }

  if (sourceSeries.length === 0) return <EmptyState />

  const activeRange = RANGE_OPTIONS.find(option => option.key === range) ?? RANGE_OPTIONS[1]!
  const sampleCount = source === 'daily' ? activeRange.dailyDays : activeRange.monthlyPoints
  const visibleCount = Math.max(1, Math.min(sampleCount, sourceSeries.length))
  const visible = sourceSeries.slice(-visibleCount)

  const values = visible.map(item => item.balancePen)
  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 0)
  const span = maxValue - minValue || 1
  const padding = Math.max(span * 0.18, 1)
  const yMin = minValue - padding
  const yMax = maxValue + padding
  const yRange = yMax - yMin || 1

  const xStep = visible.length > 1 ? PLOT_W / (visible.length - 1) : 0
  const fallbackCenterX = PAD.left + PLOT_W / 2

  const plotted = visible.map((point, index) => {
    const x = visible.length > 1 ? PAD.left + xStep * index : fallbackCenterX
    const y = PAD.top + ((yMax - point.balancePen) / yRange) * PLOT_H
    return { ...point, x, y }
  })

  const linePath = smoothPath(plotted.map(point => ({ x: point.x, y: point.y })))

  const activeIndex = hovered ?? plotted.length - 1
  const active = plotted[activeIndex] ?? plotted.at(-1)!

  const activeValueLabel = formatCurrency(format(active.balancePen), preferred)
  const badgeWidth = Math.max(86, Math.ceil(activeValueLabel.length * 7.2) + 22)
  const badgeX = clamp(active.x - badgeWidth / 2, PAD.left + 1, VIEW_W - PAD.right - badgeWidth - 1)
  const badgeY = clamp(active.y - 43, PAD.top + 2, BASE_Y - 26)

  const totalIncome = visible.reduce((sum, item) => sum + item.incomePen, 0)
  const totalExpense = visible.reduce((sum, item) => sum + item.expensePen, 0)

  const yGrid = [0, 1, 2, 3, 4].map(index => {
    const ratio = index / 4
    const value = yMax - yRange * ratio
    const y = PAD.top + PLOT_H * ratio
    return { value, y }
  })

  const hitWidth = Math.max(36, PLOT_W / Math.max(plotted.length, 5))
  const labelStep = Math.max(1, Math.ceil(plotted.length / 7))

  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-white shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-2 pt-5">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.19em] text-[var(--c-text-faint)]">Money Flow</p>
          <p className="mt-0.5 text-[17px] font-bold tracking-tight text-[var(--c-text)]">
            {source === 'daily' ? 'Saldos por día' : 'Saldo acumulado'}
          </p>
        </div>

        <span className="rounded-full border border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--c-primary)]">
          {visible[0]?.label} - {visible.at(-1)?.label}
        </span>
      </div>

      <div className="relative px-2 pb-2" onMouseLeave={() => setHovered(null)}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full"
          style={{ height: 228 }}
          preserveAspectRatio="xMidYMid meet"
        >
          {yGrid.map((line, index) => (
            <g key={index}>
              {index > 0 && (
                <line
                  x1={PAD.left}
                  y1={line.y}
                  x2={VIEW_W - PAD.right}
                  y2={line.y}
                  stroke="rgba(13,79,74,0.07)"
                  strokeWidth="1"
                />
              )}
              <text
                x={PAD.left - 8}
                y={line.y + 4}
                textAnchor="end"
                fontSize="10"
                fill="rgba(23,49,47,0.42)"
                fontFamily="Inter, sans-serif"
              >
                {formatAxisValue(line.value, preferred)}
              </text>
            </g>
          ))}

          <line
            x1={PAD.left}
            y1={BASE_Y}
            x2={VIEW_W - PAD.right}
            y2={BASE_Y}
            stroke="rgba(13,79,74,0.1)"
            strokeWidth="1"
          />

          <line
            x1={active.x}
            y1={PAD.top - 4}
            x2={active.x}
            y2={BASE_Y}
            stroke="rgba(13,79,74,0.24)"
            strokeWidth="1.15"
            strokeDasharray="3.5 3.5"
          />

          {plotted.length > 1 ? (
            <path
              d={linePath}
              fill="none"
              stroke="#0D4F4A"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="chart-line-enter"
            />
          ) : (
            <line
              x1={PAD.left + 4}
              y1={active.y}
              x2={VIEW_W - PAD.right - 4}
              y2={active.y}
              stroke="#0D4F4A"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          )}

          <circle cx={active.x} cy={active.y} r="6" fill="#3F6FD8" />
          <circle cx={active.x} cy={active.y} r="3.6" fill="#FFFFFF" />

          <rect
            x={badgeX}
            y={badgeY}
            width={badgeWidth}
            height="28"
            rx="10"
            fill="#3F6FD8"
            stroke="rgba(63,111,216,0.28)"
          />
          <text
            x={badgeX + badgeWidth / 2}
            y={badgeY + 18}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#FFFFFF"
            fontFamily="Inter, sans-serif"
          >
            {activeValueLabel}
          </text>

          {plotted.map((point, index) => {
            const showLabel = index % labelStep === 0 || index === plotted.length - 1
            return (
              <g key={point.id}>
                {showLabel && (
                  <text
                    x={point.x}
                    y={BASE_Y + 18}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight={index === activeIndex ? '700' : '500'}
                    fill="rgba(23,49,47,0.48)"
                    fontFamily="Inter, sans-serif"
                  >
                    {point.shortLabel}
                  </text>
                )}

                <rect
                  x={point.x - hitWidth / 2}
                  y={PAD.top - 8}
                  width={hitWidth}
                  height={PLOT_H + 16}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                  onFocus={() => setHovered(index)}
                  tabIndex={0}
                  aria-label={`${point.label}: ${formatCurrency(format(point.balancePen), preferred)}`}
                  style={{ cursor: 'crosshair' }}
                />
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5 pt-1">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--c-text-muted)]">
          <span className="font-semibold">Ingreso: {formatCurrency(format(totalIncome), preferred)}</span>
          <span className="font-semibold">Egreso: {formatCurrency(format(totalExpense), preferred)}</span>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1">
          {RANGE_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRange(option.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                range === option.key
                  ? 'bg-[var(--c-primary)] text-white shadow-sm'
                  : 'text-[var(--c-text-muted)] hover:text-[var(--c-primary)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
