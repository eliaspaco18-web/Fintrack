'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { formatAxisValue, smoothPath, type SvgPoint } from '@/lib/charts/svg-utils'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import type {
  DashboardSummary as DashboardSummaryContract,
  MoneyFlowMode,
  MoneyFlowPoint,
} from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

type MoneyFlowResponse = {
  mode: MoneyFlowMode
  months: number
  series: MoneyFlowPoint[]
}

type RecurringRow = {
  id: string
  type: string
  amount: number | string
  currency: 'PEN' | 'USD' | string
  is_active: boolean
}

type DeltaTone = 'positive' | 'negative' | 'neutral'
type TileTone = 'primary' | 'success' | 'danger' | 'neutral'

const summaryFetcher = (url: string) => fetchDashboardData<DashboardSummaryContract>(url)
const moneyFlowFetcher = (url: string) => fetchDashboardData<MoneyFlowResponse>(url)
const recurringFetcher = (url: string) => fetchDashboardData<RecurringRow[]>(url)

const TREND_W = 260
const TREND_H = 58

function toMoney(value: number) {
  return formatCurrency(value, 'PEN')
}

function boundedDomain(values: number[]) {
  if (values.length === 0) return { min: 0, max: 1 }

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    const padding = Math.max(Math.abs(max) * 0.08, 1)
    return { min: min - padding, max: max + padding }
  }

  const spread = max - min
  return { min: min - spread * 0.12, max: max + spread * 0.12 }
}

function pointsForSeries(values: number[], width: number, height: number, pad = 5): SvgPoint[] {
  if (values.length === 0) return []

  const domain = boundedDomain(values)
  const span = domain.max - domain.min || 1
  const plotWidth = width - pad * 2
  const plotHeight = height - pad * 2

  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : pad + (index / (values.length - 1)) * plotWidth,
    y: pad + ((domain.max - value) / span) * plotHeight,
  }))
}

function areaPath(points: SvgPoint[], height: number) {
  const line = smoothPath(points)
  const first = points[0]
  const last = points.at(-1)
  if (!line || !first || !last) return ''

  return `${line} L ${last.x} ${height} L ${first.x} ${height} Z`
}

function baselineY(domain: { min: number; max: number }, height: number, pad = 6) {
  if (domain.min >= 0 || domain.max <= 0) return null
  const span = domain.max - domain.min || 1
  return pad + ((domain.max - 0) / span) * (height - pad * 2)
}

function deltaPercent(current: number, previous: number): number | null {
  if (Math.abs(previous) < 0.01) return Math.abs(current) < 0.01 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

function deltaTone(current: number, previous: number, goodWhenHigher = true): DeltaTone {
  const delta = current - previous
  if (Math.abs(delta) < 0.01) return 'neutral'
  return (delta > 0) === goodWhenHigher ? 'positive' : 'negative'
}

function deltaLabel(current: number, previous: number) {
  const pct = deltaPercent(current, previous)
  const delta = current - previous
  const sign = delta > 0 ? '+' : ''

  if (pct == null) return `${sign}${formatAxisValue(delta, 'PEN')}`
  return `${sign}${formatNumber(pct, { maximumFractionDigits: 1 })}%`
}

function tileAccent(tone: TileTone) {
  return {
    primary: 'var(--ft-primary)',
    success: 'var(--ft-success)',
    danger: 'var(--ft-danger)',
    neutral: 'var(--ft-text-muted)',
  }[tone]
}

function KpiTile({
  index,
  label,
  value,
  tone,
  children,
}: {
  index: number
  label: string
  value: string
  tone: TileTone
  children?: React.ReactNode
}) {
  return (
    <PremiumCard
      className="command-strip-tile min-w-0"
      innerClassName="relative min-h-[178px] overflow-hidden p-4"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-14 opacity-80"
        style={{
          background: `linear-gradient(180deg, color-mix(in oklch, ${tileAccent(tone)} 9%, transparent), transparent)`,
        }}
      />
      <div
        className="relative z-10 flex h-full min-h-[146px] flex-col"
        style={{
          animation: 'commandTileEnter 520ms cubic-bezier(0.32,0.72,0,1) both',
          animationDelay: `${index * 80}ms`,
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]">
          {label}
        </p>
        <p
          className="mt-3 text-[1.35rem] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[var(--ft-text)] xl:text-[1.45rem]"
          title={value}
        >
          {value}
        </p>
        <div className="mt-auto pt-3">{children}</div>
      </div>
    </PremiumCard>
  )
}

function KpiTrendPanel({
  values,
  tone,
  footerLeft,
  footerRight,
  ariaLabel,
  gradientId,
}: {
  values: number[]
  tone: TileTone
  footerLeft: string
  footerRight: string
  ariaLabel: string
  gradientId: string
}) {
  const color = tileAccent(tone)
  const safeValues = values.length > 0 ? values : [0, 0]
  const domain = boundedDomain(safeValues)
  const points = pointsForSeries(safeValues, TREND_W, TREND_H, 6)
  const path = smoothPath(points)
  const fill = areaPath(points, TREND_H - 3)
  const last = points.at(-1)
  const baseY = baselineY(domain, TREND_H, 6)

  if (!path) {
    return (
      <div className="rounded-[14px] bg-[color-mix(in_oklch,var(--ft-surface-muted)_68%,transparent)] px-3 py-2">
        <div className="h-[58px] rounded-[10px] bg-[var(--ft-surface-muted)]" />
        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[var(--ft-text-muted)]">
          <span className="min-w-0 truncate">{footerLeft}</span>
          <span className="shrink-0 tabular-nums">{footerRight}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[14px] bg-[color-mix(in_oklch,var(--ft-surface-muted)_68%,transparent)] px-3 py-2">
      <svg
        aria-label={ariaLabel}
        className="h-[58px] w-full overflow-visible"
        viewBox={`0 0 ${TREND_W} ${TREND_H}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={TREND_W}
            y1={TREND_H * ratio}
            y2={TREND_H * ratio}
            stroke="var(--ft-border)"
            strokeOpacity="0.42"
            strokeDasharray="3 8"
          />
        ))}
        {baseY != null && (
          <line
            x1="0"
            x2={TREND_W}
            y1={baseY}
            y2={baseY}
            stroke="var(--ft-text-subtle)"
            strokeOpacity="0.46"
          />
        )}
        <path d={fill} fill={`url(#${gradientId})`} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
          vectorEffect="non-scaling-stroke"
        />
        {last && (
          <circle
            cx={last.x}
            cy={last.y}
            r="4"
            fill="var(--ft-surface)"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[var(--ft-text-muted)]">
        <span className="min-w-0 truncate">{footerLeft}</span>
        <span className="shrink-0 tabular-nums">{footerRight}</span>
      </div>
    </div>
  )
}

export function DashboardHeader() {
  const { data: summary, isLoading: summaryLoading } = useSWR('/api/dashboard/summary', summaryFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const { data: moneyFlow } = useSWR('/api/dashboard/money-flow?months=6&mode=acumulado', moneyFlowFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const { data: recurring } = useSWR('/api/recurring?type=EXPENSE', recurringFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const series = moneyFlow?.series ?? []
  const lastPoint = series.at(-1)
  const previousPoint = series.at(-2)

  const patrimonioPen = summary?.patrimonio_neto.pen ?? summary?.balance_consolidado.pen ?? 0
  const ingresosMes = summary?.ingresos_mes ?? lastPoint?.ingresos ?? 0
  const egresosMes = summary?.egresos_mes ?? lastPoint?.egresos ?? 0
  const balanceMes = summary?.balance_mes ?? summary?.resultado_mensual ?? lastPoint?.saldo_mensual ?? 0
  const previousIncome = previousPoint?.ingresos ?? 0
  const previousExpense = previousPoint?.egresos ?? 0

  const recurringExpensePen = useMemo(() => {
    return (recurring ?? []).reduce((sum, item) => {
      if (!item.is_active || item.currency !== 'PEN') return sum
      const amount = Number(item.amount ?? 0)
      return Number.isFinite(amount) ? sum + amount : sum
    }, 0)
  }, [recurring])

  const incomeTone = deltaTone(ingresosMes, previousIncome, true)
  const expenseTone = deltaTone(egresosMes, previousExpense, false)
  const balancePositive = balanceMes >= 0
  const patrimonioValues = series.map((point) => point.saldo_acumulado)
  const incomeValues = series.map((point) => point.ingresos)
  const expenseValues = series.map((point) => point.egresos)
  const balanceValues = series.map((point) => point.saldo_mensual)

  if (summaryLoading && !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <PremiumCard key={index} innerClassName="min-h-[154px] p-4">
            <div className="animate-pulse">
              <div className="h-3 w-24 rounded bg-[var(--ft-surface-muted)]" />
              <div className="mt-4 h-7 w-32 rounded bg-[var(--ft-surface-muted)]" />
              <div className="mt-8 h-9 rounded-[12px] bg-[var(--ft-surface-muted)]" />
            </div>
          </PremiumCard>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <style jsx>{`
        @keyframes commandTileEnter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <KpiTile
        index={0}
        label="Patrimonio neto"
        value={toMoney(patrimonioPen)}
        tone="primary"
      >
        <KpiTrendPanel
          values={patrimonioValues}
          tone="primary"
          footerLeft="Últimos 6 meses"
          footerRight={formatAxisValue(patrimonioPen, 'PEN')}
          ariaLabel="Tendencia del patrimonio neto de los últimos seis meses"
          gradientId="kpi-trend-patrimonio"
        />
      </KpiTile>

      <KpiTile
        index={1}
        label="Ingresos del mes"
        value={toMoney(ingresosMes)}
        tone="success"
      >
        <KpiTrendPanel
          values={incomeValues}
          tone={incomeTone === 'negative' ? 'danger' : 'success'}
          footerLeft="Vs mes anterior"
          footerRight={deltaLabel(ingresosMes, previousIncome)}
          ariaLabel="Tendencia de ingresos mensuales"
          gradientId="kpi-trend-ingresos"
        />
      </KpiTile>

      <KpiTile
        index={2}
        label="Egresos del mes"
        value={toMoney(egresosMes)}
        tone="danger"
      >
        <KpiTrendPanel
          values={expenseValues}
          tone={expenseTone === 'positive' ? 'success' : 'danger'}
          footerLeft={`${formatAxisValue(recurringExpensePen, 'PEN')} recurrentes`}
          footerRight={deltaLabel(egresosMes, previousExpense)}
          ariaLabel="Tendencia de egresos mensuales"
          gradientId="kpi-trend-egresos"
        />
      </KpiTile>

      <KpiTile
        index={3}
        label="Balance neto"
        value={toMoney(balanceMes)}
        tone={balancePositive ? 'primary' : 'danger'}
      >
        <KpiTrendPanel
          values={balanceValues}
          tone={balancePositive ? 'primary' : 'danger'}
          footerLeft="Resultado mensual"
          footerRight={deltaLabel(balanceMes, previousPoint?.saldo_mensual ?? 0)}
          ariaLabel="Tendencia del balance neto mensual"
          gradientId="kpi-trend-balance"
        />
      </KpiTile>
    </div>
  )
}
