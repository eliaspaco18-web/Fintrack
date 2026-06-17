'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type {
  DashboardSidebar,
  DashboardSummary,
  ModulesSummary,
} from '@/lib/dashboard/types'
import type { DashboardSummary as FullDashboardSummary } from '@/modules/dashboard/dashboard.types'
import {
  HEALTH_FACTOR_ORDER,
  calcCreditScore,
  calcDebtScore,
  calcDisciplineScore,
  calcDiversificationScore,
  calcHealthScore,
  calcLiquidityScore,
  calcSavingsScore,
} from '@/lib/charts/radar-score'
import type { HealthFactorKey } from '@/lib/charts/radar-score'
import { hexagonPoints, polarToCartesian } from '@/lib/charts/svg-utils'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const VIEWBOX_SIZE = 280
const CENTER = 140
const RADIUS = 100
const LABEL_RADIUS = 124
const MAX_SCORE = 100
const REFERENCE_SCORE = 75

const summaryFetcher = (url: string) => fetchDashboardData<DashboardSummary>(url)
const modulesFetcher = (url: string) => fetchDashboardData<ModulesSummary>(url)
const sidebarFetcher = (url: string) => fetchDashboardData<DashboardSidebar>(url)
const fullDashboardFetcher = (url: string) => fetchDashboardData<FullDashboardSummary>(url)

const FACTOR_LABELS: Record<HealthFactorKey, string> = {
  savings: 'Ahorro',
  credit: 'Crédito',
  liquidity: 'Liquidez',
  debt: 'Deuda',
  diversification: 'Diversificación',
  discipline: 'Disciplina',
}

const FACTOR_EXPLANATIONS: Record<HealthFactorKey, string> = {
  savings: 'Tasa de ahorro mensual normalizada sobre el ingreso.',
  credit: 'Menor uso de líneas de crédito mejora este eje.',
  liquidity: 'Runway estimado con el balance actual frente a egresos.',
  debt: 'Relación entre deuda usada y activos registrados.',
  diversification: 'Variedad de tipos de activos en el portafolio.',
  discipline: 'Penaliza alertas pendientes y vencimientos críticos.',
}

function daysUntil(dueDate: string) {
  const today = new Date()
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const due = new Date(`${dueDate}T00:00:00Z`)

  return Math.floor((due.getTime() - base.getTime()) / 86_400_000)
}

function formatScore(value: number) {
  return formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function scorePoint(value: number, index: number) {
  return polarToCartesian(CENTER, CENTER, (RADIUS * value) / MAX_SCORE, index * 60)
}

function labelPoint(index: number) {
  return polarToCartesian(CENTER, CENTER, LABEL_RADIUS, index * 60)
}

function labelAnchor(index: number): 'start' | 'middle' | 'end' {
  if (index === 1 || index === 2) return 'end'
  if (index === 4 || index === 5) return 'start'

  return 'middle'
}

function FinancialHealthSkeleton() {
  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="animate-pulse space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-36 rounded-full bg-[var(--ft-surface-muted)]" />
            <div className="h-3 w-56 rounded-full bg-[var(--ft-surface-muted)]" />
          </div>
          <div className="h-7 w-32 rounded-full bg-[var(--ft-surface-muted)]" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_148px] lg:items-center">
          <div className="mx-auto grid h-[280px] w-full max-w-[320px] place-items-center">
            <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} className="h-full w-full max-w-[280px]">
              {[100, 75, 50, 25].map((value) => (
                <polygon
                  key={value}
                  points={hexagonPoints(CENTER, CENTER, RADIUS, Array(6).fill(value), MAX_SCORE)}
                  fill="none"
                  stroke="var(--ft-border)"
                  strokeOpacity="0.7"
                />
              ))}
              <polygon
                points={hexagonPoints(CENTER, CENTER, RADIUS, [64, 72, 58, 69, 42, 78], MAX_SCORE)}
                fill="color-mix(in oklch, var(--ft-text-subtle) 12%, transparent)"
                stroke="var(--ft-border-strong)"
                strokeWidth="2"
              />
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {HEALTH_FACTOR_ORDER.map((key) => (
              <div key={key} className="h-12 rounded-[14px] bg-[var(--ft-surface-muted)]" />
            ))}
          </div>
        </div>
      </div>
    </PremiumCard>
  )
}

function EmptyRadar() {
  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            Salud financiera
          </p>
          <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">
            Aún no hay movimientos suficientes para calcular el radar.
          </p>
        </div>
        <span className="inline-flex rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]">
          Sin lectura
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_150px] lg:items-center">
        <div className="mx-auto grid h-[280px] w-full max-w-[320px] place-items-center rounded-[22px] bg-[color-mix(in_oklch,var(--ft-surface-muted)_68%,transparent)]">
          <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} className="h-full w-full max-w-[280px]">
            {[100, 75, 50, 25].map((value) => (
              <polygon
                key={value}
                points={hexagonPoints(CENTER, CENTER, RADIUS, Array(6).fill(value), MAX_SCORE)}
                fill="none"
                stroke="var(--ft-border)"
                strokeOpacity={value === 100 ? 0.9 : 0.56}
              />
            ))}
            {HEALTH_FACTOR_ORDER.map((key, index) => {
              const vertex = polarToCartesian(CENTER, CENTER, RADIUS, index * 60)
              return (
                <line
                  key={key}
                  x1={CENTER}
                  y1={CENTER}
                  x2={vertex.x}
                  y2={vertex.y}
                  stroke="var(--ft-border)"
                  strokeOpacity="0.45"
                />
              )
            })}
            <text
              x={CENTER}
              y={CENTER - 2}
              textAnchor="middle"
              fontSize="30"
              fontWeight="650"
              fill="var(--ft-text-subtle)"
            >
              --
            </text>
            <text
              x={CENTER}
              y={CENTER + 20}
              textAnchor="middle"
              fontSize="9"
              fontWeight="650"
              letterSpacing="0.14em"
              fill="var(--ft-text-subtle)"
            >
              SOBRE 100
            </text>
          </svg>
        </div>

        <div className="rounded-[18px] border border-dashed border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-4">
          <p className="text-[12px] font-semibold text-[var(--ft-text)]">Radar pendiente</p>
          <p className="mt-2 text-[11px] leading-5 text-[var(--ft-text-muted)]">
            Registra ingresos o egresos del mes para activar la lectura de salud financiera.
          </p>
        </div>
      </div>
    </PremiumCard>
  )
}

export function FinancialHealthScore() {
  const [hoveredAxis, setHoveredAxis] = useState<number | null>(null)
  const { data: summary } = useSWR('/api/dashboard/summary', summaryFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })
  const { data: modules } = useSWR('/api/dashboard/modules-summary', modulesFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })
  const { data: sidebar, isLoading: sidebarLoading } = useSWR('/api/dashboard/sidebar', sidebarFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })
  const { data: fullDashboard } = useSWR('/api/dashboard', fullDashboardFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const isLoading = sidebarLoading && !summary && !modules && !sidebar
  const ingresosMes = summary?.ingresos_mes ?? 0
  const egresosMes = summary?.egresos_mes ?? 0

  const criticalDueCount = useMemo(
    () => (sidebar?.vencimientos_proximos ?? []).filter((item) => daysUntil(item.due_date) <= 0).length,
    [sidebar?.vencimientos_proximos]
  )

  const uniqueAssetTypes = useMemo(() => {
    const byType = fullDashboard?.assets.byType ?? []
    const activeTypes = byType.filter((item) => item.count > 0 && item.totalPen > 0).length

    if (activeTypes > 0) return activeTypes
    return modules?.activos.count ? 1 : 0
  }, [fullDashboard?.assets.byType, modules?.activos.count])

  const factorDetails = useMemo(() => {
    const creditUsage = modules?.creditos_uso_pct ?? 0
    const balance = summary?.balance_consolidado.pen ?? 0
    const totalDeuda = modules?.creditos_uso_total ?? 0
    const totalActivos = modules?.activos.total_soles ?? fullDashboard?.assets.totalValuePen ?? 0
    const alertas = summary?.alertas_pendientes ?? 0
    const savingsRate = ingresosMes > 0 ? ((ingresosMes - egresosMes) / ingresosMes) * 100 : 0
    const runwayMonths = egresosMes > 0 ? balance / egresosMes : balance > 0 ? 3 : 0
    const debtRatio = totalActivos > 0 ? (totalDeuda / totalActivos) * 100 : null

    return {
      savings: {
        value: calcSavingsScore(ingresosMes, egresosMes),
        helper: `${formatNumber(savingsRate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% del ingreso mensual`,
      },
      credit: {
        value: calcCreditScore(creditUsage),
        helper: `${formatNumber(creditUsage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% de uso total`,
      },
      liquidity: {
        value: calcLiquidityScore(balance, egresosMes),
        helper: `${formatNumber(runwayMonths, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses de runway`,
      },
      debt: {
        value: calcDebtScore(totalDeuda, totalActivos),
        helper: debtRatio === null
          ? 'Sin activos registrados: lectura neutral'
          : `${formatNumber(debtRatio, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% deuda/activos`,
      },
      diversification: {
        value: calcDiversificationScore(uniqueAssetTypes),
        helper: `${uniqueAssetTypes} tipo${uniqueAssetTypes === 1 ? '' : 's'} de activo`,
      },
      discipline: {
        value: calcDisciplineScore(alertas, criticalDueCount),
        helper: `${alertas} alertas y ${criticalDueCount} críticas hoy`,
      },
    }
  }, [criticalDueCount, egresosMes, fullDashboard?.assets.totalValuePen, ingresosMes, modules, summary, uniqueAssetTypes])

  if (isLoading) return <FinancialHealthSkeleton />
  if (ingresosMes === 0 && egresosMes === 0) return <EmptyRadar />

  const factors = {
    savings: factorDetails.savings.value,
    credit: factorDetails.credit.value,
    liquidity: factorDetails.liquidity.value,
    debt: factorDetails.debt.value,
    diversification: factorDetails.diversification.value,
    discipline: factorDetails.discipline.value,
  }
  const health = calcHealthScore(factors)
  const userPoints = hexagonPoints(CENTER, CENTER, RADIUS, health.scores, MAX_SCORE)
  const referencePoints = hexagonPoints(
    CENTER,
    CENTER,
    RADIUS,
    Array(HEALTH_FACTOR_ORDER.length).fill(REFERENCE_SCORE),
    MAX_SCORE
  )
  const hoveredKey = hoveredAxis === null ? null : HEALTH_FACTOR_ORDER[hoveredAxis]
  const hoveredPoint = hoveredAxis === null ? null : scorePoint(health.scores[hoveredAxis] ?? 0, hoveredAxis)

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            Salud financiera
          </p>
          <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">
            Radar de seis dimensiones sobre solvencia, liquidez y disciplina.
          </p>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${health.tone.ring}`}>
          {health.tone.label}
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_150px] lg:items-center">
        <div
          className="relative mx-auto grid h-[300px] w-full max-w-[340px] place-items-center rounded-[22px] bg-[color-mix(in_oklch,var(--ft-surface-muted)_46%,transparent)]"
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <svg
            viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
            className="h-full w-full max-w-[300px]"
            role="img"
            aria-label={`Radar de salud financiera: ${health.average} sobre 100`}
          >
            {[100, 75, 50, 25].map((value) => (
              <polygon
                key={value}
                points={hexagonPoints(CENTER, CENTER, RADIUS, Array(6).fill(value), MAX_SCORE)}
                fill="none"
                stroke="var(--ft-border)"
                strokeOpacity={value === 100 ? 0.9 : 0.54}
                strokeWidth={value === 75 ? 1.25 : 1}
              />
            ))}

            {HEALTH_FACTOR_ORDER.map((key, index) => {
              const vertex = polarToCartesian(CENTER, CENTER, RADIUS, index * 60)
              const label = labelPoint(index)
              const anchor = labelAnchor(index)

              return (
                <g key={key}>
                  <line
                    x1={CENTER}
                    y1={CENTER}
                    x2={vertex.x}
                    y2={vertex.y}
                    stroke="var(--ft-border)"
                    strokeOpacity="0.42"
                  />
                  <text
                    x={label.x}
                    y={label.y - 3}
                    textAnchor={anchor}
                    fontSize="10"
                    fontWeight="650"
                    fill="var(--ft-text)"
                    className="hidden sm:block"
                  >
                    {FACTOR_LABELS[key]}
                  </text>
                  <text
                    x={label.x}
                    y={label.y + 10}
                    textAnchor={anchor}
                    fontSize="9"
                    fontWeight="600"
                    fill="var(--ft-text-subtle)"
                    className="hidden tabular-nums sm:block"
                  >
                    {formatScore(health.scores[index] ?? 0)}
                  </text>
                </g>
              )
            })}

            <polygon
              points={referencePoints}
              fill="none"
              stroke="var(--ft-border-strong)"
              strokeDasharray="4 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.25"
            />
            <polygon
              points={userPoints}
              fill="color-mix(in oklch, var(--ft-primary) 14%, transparent)"
              stroke="var(--ft-primary)"
              strokeLinejoin="round"
              strokeWidth="2"
              className="transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
            />

            {HEALTH_FACTOR_ORDER.map((key, index) => {
              const value = health.scores[index] ?? 0
              const point = scorePoint(value, index)
              const isHovered = hoveredAxis === index

              return (
                <circle
                  key={key}
                  cx={point.x}
                  cy={point.y}
                  r={isHovered ? 5.5 : 4}
                  fill="var(--ft-surface)"
                  stroke="var(--ft-primary)"
                  strokeWidth="2"
                  className="cursor-crosshair transition-[r,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  onMouseEnter={() => setHoveredAxis(index)}
                  onFocus={() => setHoveredAxis(index)}
                  tabIndex={0}
                  aria-label={`${FACTOR_LABELS[key]}: ${formatScore(value)} sobre 100`}
                />
              )
            })}

            <text
              x={CENTER}
              y={CENTER - 4}
              textAnchor="middle"
              fontSize="31"
              fontWeight="650"
              letterSpacing="-0.03em"
              fill="var(--ft-text)"
              className="tabular-nums"
            >
              {health.average}
            </text>
            <text
              x={CENTER}
              y={CENTER + 19}
              textAnchor="middle"
              fontSize="9"
              fontWeight="650"
              letterSpacing="0.14em"
              fill="var(--ft-text-subtle)"
            >
              SOBRE 100
            </text>
          </svg>

          {hoveredKey && hoveredPoint && (
            <div
              className="pointer-events-none absolute w-[176px] rounded-[16px] border border-[var(--ft-border)] bg-[var(--ft-surface)] px-3 py-2 shadow-[var(--shadow-lg)]"
              style={{
                left: `${(hoveredPoint.x / VIEWBOX_SIZE) * 100}%`,
                top: `${(hoveredPoint.y / VIEWBOX_SIZE) * 100}%`,
                transform: hoveredPoint.x > CENTER ? 'translate(-100%, -108%)' : 'translate(8%, -108%)',
              }}
            >
              <p className="text-[11px] font-semibold text-[var(--ft-text)]">{FACTOR_LABELS[hoveredKey]}</p>
              <p className="mt-0.5 text-[17px] font-semibold leading-none tabular-nums text-[var(--ft-primary)]">
                {formatScore(factorDetails[hoveredKey].value)}
              </p>
              <p className="mt-1 text-[10.5px] leading-4 text-[var(--ft-text-muted)]">
                {FACTOR_EXPLANATIONS[hoveredKey]}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {HEALTH_FACTOR_ORDER.map((key, index) => {
            const value = health.scores[index] ?? 0

            return (
              <button
                key={key}
                type="button"
                onMouseEnter={() => setHoveredAxis(index)}
                onFocus={() => setHoveredAxis(index)}
                onBlur={() => setHoveredAxis(null)}
                className="rounded-[14px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2 text-left transition-[border-color,transform,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-[var(--ft-primary-border)] hover:bg-[var(--ft-primary-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--ft-primary-border)]"
              >
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ft-text-subtle)]">
                  {FACTOR_LABELS[key]}
                </span>
                <span className="mt-1 block text-[16px] font-semibold leading-none tabular-nums text-[var(--ft-text)]">
                  {formatScore(value)}
                </span>
                <span className="mt-1 hidden text-[10.5px] leading-4 text-[var(--ft-text-muted)] lg:block">
                  {factorDetails[key].helper}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </PremiumCard>
  )
}
