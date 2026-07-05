'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { formatAxisValue, smoothPath, type SvgPoint } from '@/lib/charts/svg-utils'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import type {
  DashboardSummary as DashboardSummaryContract,
  ModulesSummary,
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
type TileTone = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const summaryFetcher = (url: string) => fetchDashboardData<DashboardSummaryContract>(url)
const moneyFlowFetcher = (url: string) => fetchDashboardData<MoneyFlowResponse>(url)
const modulesFetcher = (url: string) => fetchDashboardData<ModulesSummary>(url)
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
    warning: 'var(--ft-warning)',
    info: 'var(--ft-info)',
    neutral: 'var(--ft-text-muted)',
  }[tone]
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function CreditCapacityPanel({
  used,
  limit,
  utilization,
}: {
  used: number
  limit: number
  utilization: number
}) {
  const safeUtilization = clampPercent(utilization)
  const tone = safeUtilization >= 90
    ? 'danger'
    : safeUtilization >= 70
      ? 'warning'
      : 'primary'
  const color = tileAccent(tone)

  return (
    <div className="rounded-[14px] bg-[color-mix(in_oklch,var(--ft-surface-muted)_68%,transparent)] px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ft-text-subtle)]">
          Utilización
        </span>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
          {formatNumber(safeUtilization, { maximumFractionDigits: 1 })}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--ft-surface)]">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ width: `${safeUtilization}%`, background: color }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[var(--ft-text-muted)]">
        <span className="min-w-0 truncate">Usado {formatAxisValue(used, 'PEN')}</span>
        <span className="shrink-0 tabular-nums">Límite {formatAxisValue(limit, 'PEN')}</span>
      </div>
    </div>
  )
}

function AvailabilitySplitPanel({
  liquidity,
  creditAvailable,
}: {
  liquidity: number
  creditAvailable: number
}) {
  const total = Math.max(liquidity + creditAvailable, 0)
  const liquidityPct = total > 0 ? clampPercent((liquidity / total) * 100) : 0
  const creditPct = total > 0 ? clampPercent((creditAvailable / total) * 100) : 0

  return (
    <div className="rounded-[14px] bg-[color-mix(in_oklch,var(--ft-surface-muted)_68%,transparent)] px-3 py-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--ft-surface)]">
        <div
          className="h-full bg-[var(--ft-primary)]"
          style={{ width: `${liquidityPct}%` }}
        />
        <div
          className="h-full bg-[var(--ft-warning)]"
          style={{ width: `${creditPct}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-[var(--ft-text-muted)]">
        <span className="min-w-0 truncate">Propio {formatAxisValue(liquidity, 'PEN')}</span>
        <span className="min-w-0 truncate text-right">Crédito {formatAxisValue(creditAvailable, 'PEN')}</span>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[var(--ft-text-subtle)]">
        Incluye crédito disponible, no representa patrimonio.
      </p>
    </div>
  )
}

function OperatingMetricCard({
  label,
  value,
  helper,
  tone,
  children,
}: {
  label: string
  value: string
  helper: string
  tone: TileTone
  children: React.ReactNode
}) {
  return (
    <PremiumCard
      as="article"
      className="min-w-0"
      innerClassName="relative min-h-[154px] overflow-hidden p-4"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-12 opacity-75"
        style={{
          background: `linear-gradient(180deg, color-mix(in oklch, ${tileAccent(tone)} 8%, transparent), transparent)`,
        }}
      />
      <div className="relative z-10 flex min-h-[122px] flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]">
              {label}
            </p>
            <p className="mt-2 truncate text-[1.22rem] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[var(--ft-text)]">
              {value}
            </p>
          </div>
          <span
            className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: tileAccent(tone) }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[var(--ft-text-muted)]">
          {helper}
        </p>
        <div className="mt-auto pt-3">{children}</div>
      </div>
    </PremiumCard>
  )
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
  const [loadRecurring, setLoadRecurring] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setLoadRecurring(true), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const { data: summary, isLoading: summaryLoading } = useSWR('/api/dashboard/summary', summaryFetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
  })

  const { data: modules, isLoading: modulesLoading } = useSWR('/api/dashboard/modules-summary', modulesFetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
  })

  const { data: moneyFlow } = useSWR('/api/dashboard/money-flow?months=6&mode=acumulado', moneyFlowFetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
  })

  const { data: recurring } = useSWR(loadRecurring ? '/api/recurring?type=EXPENSE' : null, recurringFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const series = moneyFlow?.series ?? []
  const lastPoint = series.at(-1)
  const previousPoint = series.at(-2)

  const liquidezPropiaPen = modules?.liquidez_propia_total
    ?? modules?.cuentas_total_consolidado
    ?? summary?.balance_consolidado.pen
    ?? 0
  const creditoLimitePen = modules?.creditos_limite_total ?? 0
  const creditoUsadoPen = modules?.creditos_uso_total ?? 0
  const creditoDisponiblePen = modules?.creditos_disponible_total
    ?? Math.max(creditoLimitePen - creditoUsadoPen, 0)
  const disponibilidadAmpliadaPen = modules?.disponibilidad_ampliada_total
    ?? liquidezPropiaPen + creditoDisponiblePen
  const creditUsagePct = modules?.creditos_uso_pct ?? 0
  const patrimonioPen = summary?.patrimonio_neto.pen ?? liquidezPropiaPen
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
  const liquidityValues = patrimonioValues.length > 0 ? patrimonioValues : [liquidezPropiaPen]

  if ((summaryLoading || modulesLoading) && !summary && !modules) {
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
    <div className="space-y-3">
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          index={0}
          label="Patrimonio neto"
          value={toMoney(patrimonioPen)}
          tone="primary"
        >
          <KpiTrendPanel
            values={patrimonioValues.length > 0 ? patrimonioValues : [patrimonioPen]}
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

      <section className="rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-surface)] p-3 shadow-[0_18px_42px_color-mix(in_srgb,var(--ft-shadow)_7%,transparent)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
              Capacidad operativa
            </p>
            <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">
              Dinero propio y crédito disponible, separados para no confundir patrimonio con margen prestado.
            </p>
          </div>
          <span className="rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ft-text-subtle)]">
            No reemplaza patrimonio
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <OperatingMetricCard
            label="Liquidez propia"
            value={toMoney(liquidezPropiaPen)}
            helper={`${modules?.cuentas ?? 0} cuenta${modules?.cuentas === 1 ? '' : 's'} operativa${modules?.cuentas === 1 ? '' : 's'} con dinero real disponible.`}
            tone="primary"
          >
            <KpiTrendPanel
              values={liquidityValues}
              tone="primary"
              footerLeft="Solo cuentas no técnicas"
              footerRight={formatAxisValue(liquidezPropiaPen, 'PEN')}
              ariaLabel="Tendencia de liquidez propia de los últimos seis meses"
              gradientId="kpi-trend-liquidez-operativa"
            />
          </OperatingMetricCard>

          <OperatingMetricCard
            label="Crédito disponible"
            value={toMoney(creditoDisponiblePen)}
            helper="Cupo no usado en tarjetas y líneas activas. Es capacidad prestada, no dinero propio."
            tone="warning"
          >
            <CreditCapacityPanel
              used={creditoUsadoPen}
              limit={creditoLimitePen}
              utilization={creditUsagePct}
            />
          </OperatingMetricCard>

          <OperatingMetricCard
            label="Disponibilidad ampliada"
            value={toMoney(disponibilidadAmpliadaPen)}
            helper="Suma liquidez propia y crédito disponible para leer margen de maniobra inmediato."
            tone="success"
          >
            <AvailabilitySplitPanel
              liquidity={liquidezPropiaPen}
              creditAvailable={creditoDisponiblePen}
            />
          </OperatingMetricCard>
        </div>
      </section>
    </div>
  )
}
