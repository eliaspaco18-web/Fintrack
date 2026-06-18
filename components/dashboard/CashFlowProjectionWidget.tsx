'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type {
  CashFlowProjectionEvent,
  CashFlowProjectionPoint,
  CashFlowProjectionResponse,
  ProjectionHorizon,
} from '@/lib/dashboard/types'
import { clamp, formatAxisValue, smoothPath } from '@/lib/charts/svg-utils'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const VIEW_W = 760
const VIEW_H = 312
const PAD = { top: 24, right: 18, bottom: 42, left: 64 }
const PLOT_W = VIEW_W - PAD.left - PAD.right
const PLOT_H = VIEW_H - PAD.top - PAD.bottom
const BASE_Y = PAD.top + PLOT_H
const HORIZON_RANK: Record<ProjectionHorizon, number> = {
  '30D': 1,
  '60D': 2,
  '90D': 3,
}
const HORIZON_SUMMARY_INDEX: Record<ProjectionHorizon, number> = {
  '30D': 30,
  '60D': 60,
  '90D': 90,
}

type CashFlowProjectionWidgetProps = {
  variant?: 'full' | 'compact'
  horizon?: ProjectionHorizon
}

type WeeklyPoint = {
  id: string
  label: string
  date: string
  horizon: ProjectionHorizon
  startBalance: number
  endBalance: number
  inflows: number
  outflows: number
  net: number
  confidence: number
  events: CashFlowProjectionEvent[]
  x: number
  yStart: number
  yEnd: number
}

const fetcher = (url: string) => fetchDashboardData<CashFlowProjectionResponse>(url)

function formatPen(value: number) {
  return `S/ ${formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDateLabel(dateIso: string) {
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(new Date(`${dateIso}T00:00:00Z`))
}

function eventTypeLabel(type: CashFlowProjectionEvent['type']) {
  switch (type) {
    case 'recurring_income':
      return 'Recurrente ingreso'
    case 'recurring_expense':
      return 'Recurrente egreso'
    case 'receivable':
      return 'Cobro esperado'
    case 'payable':
      return 'Pago pendiente'
    case 'installment':
      return 'Cuota de crédito'
    case 'billing_cycle':
      return 'Ciclo de tarjeta'
  }
}

function horizonTone(value: number) {
  if (value >= 0) return 'border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]'
  return 'border-[color-mix(in_oklch,var(--ft-danger)_22%,transparent)] bg-[color-mix(in_oklch,var(--ft-danger)_9%,transparent)] text-[var(--ft-danger)]'
}

function projectionAt(points: CashFlowProjectionPoint[], day: number) {
  return points[Math.min(day, points.length - 1)] ?? points.at(-1) ?? null
}

function confidenceOpacity(horizon: ProjectionHorizon) {
  if (horizon === '30D') return 0.18
  if (horizon === '60D') return 0.1
  return 0.05
}

function buildBandPath(points: WeeklyPoint[], yScale: (value: number) => number) {
  if (points.length < 2) return ''

  const upper = points.map((point) => ({
    x: point.x,
    y: yScale(point.endBalance + Math.max(140, Math.abs(point.endBalance) * 0.018)),
  }))
  const lower = points
    .slice()
    .reverse()
    .map((point) => ({
      x: point.x,
      y: yScale(point.endBalance - Math.max(140, Math.abs(point.endBalance) * 0.018)),
    }))

  const first = upper[0]
  if (!first) return ''

  return `M ${first.x} ${first.y} ${upper.slice(1).map((point) => `L ${point.x} ${point.y}`).join(' ')} ${lower.map((point) => `L ${point.x} ${point.y}`).join(' ')} Z`
}

function ProjectionSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <PremiumCard innerClassName={compact ? 'p-4' : 'p-5 md:p-6'}>
      <div className={compact ? 'animate-pulse space-y-4' : 'animate-pulse space-y-5'}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-44 rounded-full bg-[var(--ft-surface-muted)]" />
            <div className="h-4 w-64 rounded-full bg-[var(--ft-surface-muted)]" />
          </div>
          <div className="h-7 w-32 rounded-full bg-[var(--ft-surface-muted)]" />
        </div>
        <div className={compact ? 'h-[214px] rounded-[18px] bg-[var(--ft-surface-muted)]' : 'h-[276px] rounded-[22px] bg-[var(--ft-surface-muted)]'} />
        {!compact && (
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="h-10 rounded-full bg-[var(--ft-surface-muted)]" />
            <div className="h-10 rounded-full bg-[var(--ft-surface-muted)]" />
            <div className="h-10 rounded-full bg-[var(--ft-surface-muted)]" />
          </div>
        )}
      </div>
    </PremiumCard>
  )
}

function EmptyProjection({ compact = false }: { compact?: boolean }) {
  return (
    <PremiumCard innerClassName={compact ? 'p-4' : 'p-5 md:p-6'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            {compact ? 'Proyección 30D' : 'Proyección de flujo'}
          </p>
          <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">
            {compact ? 'Sin señales cercanas suficientes para proyectar caja.' : 'Sin eventos futuros suficientes para proyectar caja.'}
          </p>
        </div>
      </div>

      <div className={`${compact ? 'mt-4 min-h-[208px] rounded-[18px] p-5' : 'mt-5 min-h-[248px] rounded-[22px] p-6'} grid place-items-center border border-dashed border-[var(--ft-border)] bg-[var(--ft-surface-muted)] text-center`}>
        <div>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface)] text-[var(--ft-primary)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 16h4l3-8 4 11 3-7h2" />
              <path d="M4 4v16h16" />
            </svg>
          </div>
          <p className="mt-4 text-[13px] font-semibold text-[var(--ft-text)]">Activa señales futuras</p>
          <p className="mt-2 max-w-sm text-[12px] leading-5 text-[var(--ft-text-muted)]">
            Registra recurrentes, cuentas por cobrar o vencimientos para construir una proyección útil.
          </p>
          <Link
            href="/recurring?new=template"
            className="mt-4 inline-flex rounded-full border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-4 py-2 text-[11px] font-semibold text-[var(--ft-primary)] transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--ft-primary)] hover:text-[var(--ft-text-on-primary)] active:scale-[0.98]"
          >
            Registrar recurrente
          </Link>
        </div>
      </div>
    </PremiumCard>
  )
}

export function CashFlowProjectionWidget({
  variant = 'full',
  horizon = '30D',
}: CashFlowProjectionWidgetProps = {}) {
  const compact = variant === 'compact'
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null)
  const { data, isLoading } = useSWR('/api/dashboard/projection', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const chartData = useMemo(() => {
    const points = data?.projectionPoints ?? []
    if (!data || points.length === 0) return null
    const visiblePoints = compact
      ? points.filter((point) => HORIZON_RANK[point.horizon] <= HORIZON_RANK[horizon])
      : points
    if (visiblePoints.length === 0) return null

    const weeklyRaw: Array<Omit<WeeklyPoint, 'x' | 'yStart' | 'yEnd'>> = []
    let previousBalance = data.currentBalance

    for (let start = 0; start < visiblePoints.length; start += 7) {
      const slice = visiblePoints.slice(start, start + 7)
      const last = slice.at(-1)
      const first = slice[0]
      if (!first || !last) continue

      const inflows = slice.reduce((sum, point) => sum + point.inflows, 0)
      const outflows = slice.reduce((sum, point) => sum + point.outflows, 0)
      const net = inflows - outflows
      const endBalance = last.projectedBalance

      weeklyRaw.push({
        id: `${first.date}-${last.date}`,
        label: formatDateLabel(first.date),
        date: first.date,
        horizon: last.horizon,
        startBalance: previousBalance,
        endBalance,
        inflows,
        outflows,
        net,
        confidence: last.confidence,
        events: slice.flatMap((point) => point.events),
      })

      previousBalance = endBalance
    }

    if (weeklyRaw.length === 0) return null

    const balanceValues = weeklyRaw.flatMap((point) => [point.startBalance, point.endBalance])
    const minValue = Math.min(data.currentBalance, ...balanceValues)
    const maxValue = Math.max(data.currentBalance, ...balanceValues)
    const span = maxValue - minValue || 1
    const pad = Math.max(span * 0.18, 600)
    const yMin = minValue - pad
    const yMax = maxValue + pad
    const yRange = yMax - yMin || 1
    const yScale = (value: number) => PAD.top + ((yMax - value) / yRange) * PLOT_H
    const xStep = weeklyRaw.length > 1 ? PLOT_W / (weeklyRaw.length - 1) : 0

    const weekly = weeklyRaw.map((point, index) => {
      const x = weeklyRaw.length > 1 ? PAD.left + index * xStep : PAD.left + PLOT_W / 2
      return {
        ...point,
        x,
        yStart: yScale(point.startBalance),
        yEnd: yScale(point.endBalance),
      }
    })

    const yGrid = [0, 1, 2, 3].map((index) => {
      const ratio = index / 3
      const value = yMax - yRange * ratio
      const y = PAD.top + PLOT_H * ratio
      return { value, y }
    })

    return {
      weekly,
      yGrid,
      yScale,
      linePath: smoothPath(weekly.map((point) => ({ x: point.x, y: point.yEnd }))),
      bands: (compact ? [horizon] : (['30D', '60D', '90D'] as ProjectionHorizon[])).map((bandHorizon) => {
        const bandPoints = weekly.filter((point) => point.horizon === bandHorizon)
        return {
          horizon: bandHorizon,
          path: buildBandPath(bandPoints, yScale),
          opacity: confidenceOpacity(bandHorizon),
        }
      }),
    }
  }, [compact, data, horizon])

  if (isLoading && !data) return <ProjectionSkeleton compact={compact} />

  const hasSignals = (data?.projectionPoints ?? []).some((point) => point.inflows > 0 || point.outflows > 0)
    || (data?.recurringMonthlyExpense ?? 0) > 0
    || (data?.recurringMonthlyIncome ?? 0) > 0

  if (!data || !chartData || !hasSignals) return <EmptyProjection compact={compact} />

  const activeIndex = hoveredWeek ?? chartData.weekly.length - 1
  const active = chartData.weekly[activeIndex] ?? chartData.weekly.at(-1)!
  const hitWidth = Math.max(36, PLOT_W / Math.max(chartData.weekly.length, 8))
  const projectedPoint = projectionAt(data.projectionPoints, HORIZON_SUMMARY_INDEX[horizon])
  const projectedBalance = projectedPoint?.projectedBalance ?? data.currentBalance
  const projectedDelta = projectedBalance - data.currentBalance
  const eventCount = chartData.weekly.reduce((sum, point) => sum + point.events.length, 0)
  const summary30 = projectionAt(data.projectionPoints, 30)
  const summary60 = projectionAt(data.projectionPoints, 60)
  const summary90 = projectionAt(data.projectionPoints, 90)

  return (
    <PremiumCard innerClassName={compact ? 'p-4' : 'p-5 md:p-6'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            {compact ? `Proyección ${horizon}` : 'Proyección de flujo'}
          </p>
          <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">
            {compact ? 'Eventos cercanos y cambio esperado de caja.' : 'Waterfall de eventos esperados a 30, 60 y 90 días.'}
          </p>
        </div>
        <span className="inline-flex rounded-full border border-[var(--ft-warning)]/20 bg-[color-mix(in_oklch,var(--ft-warning)_9%,transparent)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ft-warning)]">
          {compact ? `${formatPen(projectedBalance)} en ${horizon}` : `${formatPen(data.recurringMonthlyExpense)}/mes en recurrentes`}
        </span>
      </div>

      <div className={`${compact ? 'mt-4 rounded-[18px]' : 'mt-5 rounded-[22px]'} relative overflow-hidden bg-[color-mix(in_oklch,var(--ft-surface-muted)_52%,transparent)] px-2 py-2`} onMouseLeave={() => setHoveredWeek(null)}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className={compact ? 'h-[198px] w-full md:h-[214px]' : 'h-[286px] w-full'}
          role="img"
          aria-label={`Proyección de caja en formato waterfall ${compact ? horizon : 'a 30, 60 y 90 días'}`}
        >
          {chartData.yGrid.map((line, index) => (
            <g key={index}>
              <line
                x1={PAD.left}
                y1={line.y}
                x2={VIEW_W - PAD.right}
                y2={line.y}
                stroke="var(--ft-border)"
                strokeOpacity={index === chartData.yGrid.length - 1 ? 0.78 : 0.48}
                strokeDasharray={index === chartData.yGrid.length - 1 ? undefined : '4 6'}
              />
              <text x={PAD.left - 10} y={line.y + 4} textAnchor="end" fontSize="10" fontWeight="600" fill="var(--ft-text-subtle)">
                {formatAxisValue(line.value, 'PEN')}
              </text>
            </g>
          ))}

          <line x1={PAD.left} y1={PAD.top - 4} x2={PAD.left} y2={BASE_Y} stroke="var(--ft-text-subtle)" strokeDasharray="4 5" strokeOpacity="0.52" />
          <text x={PAD.left + 7} y={PAD.top + 10} fontSize="10" fontWeight="700" fill="var(--ft-text-subtle)">Hoy</text>

          {chartData.bands.map((band) => (
            band.path ? <path key={band.horizon} d={band.path} fill="var(--ft-primary)" opacity={band.opacity} /> : null
          ))}

          {chartData.weekly.map((point, index) => {
            const isPositive = point.net >= 0
            const rectTop = Math.min(point.yStart, point.yEnd)
            const rectHeight = Math.max(3, Math.abs(point.yEnd - point.yStart))
            const barWidth = Math.min(30, Math.max(16, hitWidth * 0.5))

            return (
              <g key={point.id}>
                <rect
                  x={point.x - barWidth / 2}
                  y={rectTop}
                  width={barWidth}
                  height={rectHeight}
                  rx="6"
                  fill={isPositive ? 'var(--ft-primary)' : 'var(--ft-danger)'}
                  opacity={activeIndex === index ? 0.9 : 0.68}
                  className="waterfall-block transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{
                    animationDelay: `${index * 55}ms`,
                    filter: activeIndex === index ? 'brightness(1.06)' : undefined,
                  }}
                />
                {index > 0 && (
                  <line
                    x1={(chartData.weekly[index - 1]?.x ?? point.x) + barWidth / 2}
                    y1={point.yStart}
                    x2={point.x - barWidth / 2}
                    y2={point.yStart}
                    stroke="var(--ft-border-strong)"
                    strokeDasharray="3 5"
                    strokeOpacity="0.72"
                  />
                )}
                <rect
                  x={point.x - hitWidth / 2}
                  y={PAD.top - 10}
                  width={hitWidth}
                  height={PLOT_H + 20}
                  fill="transparent"
                  onMouseEnter={() => setHoveredWeek(index)}
                  onFocus={() => setHoveredWeek(index)}
                  tabIndex={0}
                  aria-label={`${point.label}: ${formatPen(point.endBalance)}`}
                />
                <text x={point.x} y={BASE_Y + 22} textAnchor="middle" fontSize="10" fontWeight={activeIndex === index ? '700' : '600'} fill="var(--ft-text-subtle)">
                  {point.label}
                </text>
              </g>
            )
          })}

          <path
            d={chartData.linePath}
            fill="none"
            stroke="var(--ft-accent-landing)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5 5"
          />
          <circle cx={active.x} cy={active.yEnd} r="5" fill="var(--ft-accent-landing)" stroke="var(--ft-surface)" strokeWidth="2" />
        </svg>

        {!compact && (
          <div
            className="pointer-events-none absolute w-[232px] rounded-[16px] border border-[var(--ft-border)] bg-[var(--ft-surface)] px-3 py-2 shadow-[var(--shadow-lg)]"
            style={{
              left: `${clamp((active.x / VIEW_W) * 100, 4, 72)}%`,
              top: `${clamp((active.yEnd / VIEW_H) * 100, 8, 62)}%`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-[var(--ft-text)]">Semana {active.label}</p>
                <p className={`mt-1 text-[18px] font-semibold leading-none tabular-nums ${active.net >= 0 ? 'text-[var(--ft-primary)]' : 'text-[var(--ft-danger)]'}`}>
                  {active.net >= 0 ? '+' : '-'}{formatPen(Math.abs(active.net))}
                </p>
              </div>
              <span className="rounded-full bg-[var(--ft-surface-muted)] px-2 py-1 text-[10px] font-semibold text-[var(--ft-text-subtle)]">
                {active.horizon}
              </span>
            </div>
            <div className="mt-2 space-y-1 text-[10.5px] leading-4 text-[var(--ft-text-muted)]">
              {active.events.length === 0 ? (
                <p>Sin eventos agrupados esta semana.</p>
              ) : (
                active.events.slice(0, 3).map((event) => (
                  <p key={event.id} className="truncate">
                    {eventTypeLabel(event.type)} · {event.label} · {formatPen(event.amountPen)}
                  </p>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {compact ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-[14px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2">
            <p className="font-semibold uppercase tracking-[0.13em] text-[var(--ft-text-subtle)]">Saldo</p>
            <p className="mt-1 font-semibold tabular-nums text-[var(--ft-text)]">{formatPen(projectedBalance)}</p>
          </div>
          <div className="rounded-[14px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2">
            <p className="font-semibold uppercase tracking-[0.13em] text-[var(--ft-text-subtle)]">Cambio</p>
            <p className={`mt-1 font-semibold tabular-nums ${projectedDelta >= 0 ? 'text-[var(--ft-primary)]' : 'text-[var(--ft-danger)]'}`}>
              {projectedDelta >= 0 ? '+' : '-'}{formatPen(Math.abs(projectedDelta))}
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2">
            <p className="font-semibold uppercase tracking-[0.13em] text-[var(--ft-text-subtle)]">Eventos</p>
            <p className="mt-1 font-semibold tabular-nums text-[var(--ft-text)]">{eventCount}</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ['30D', summary30],
            ['60D', summary60],
            ['90D', summary90],
          ].map(([label, point]) => {
            const projected = typeof point === 'object' && point ? point.projectedBalance : 0
            return (
              <div key={label as string} className={`rounded-full border px-3 py-2 text-[11px] font-semibold tabular-nums ${horizonTone(projected)}`}>
                <span className="mr-2 text-[10px] uppercase tracking-[0.14em]">{label as string}</span>
                {formatPen(projected)}
              </div>
            )
          })}
        </div>
      )}

      <style jsx>{`
        .waterfall-block {
          animation: waterfall-block-enter 560ms cubic-bezier(0.32, 0.72, 0, 1) both;
          transform-box: fill-box;
          transform-origin: center bottom;
        }

        @keyframes waterfall-block-enter {
          from {
            transform: translateY(10px) scaleY(0.18);
          }
          to {
            transform: translateY(0) scaleY(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .waterfall-block {
            animation: none;
          }
        }
      `}</style>
    </PremiumCard>
  )
}
