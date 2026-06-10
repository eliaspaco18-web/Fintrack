'use client'

import useSWR from 'swr'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import type {
  DashboardSummary as DashboardSummaryContract,
  MoneyFlowMode,
  MoneyFlowPoint,
} from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'
import { chartTheme } from './chartTheme'

type MoneyFlowResponse = {
  mode: MoneyFlowMode
  months: number
  series: MoneyFlowPoint[]
}

const summaryFetcher = (url: string) => fetchDashboardData<DashboardSummaryContract>(url)
const moneyFlowFetcher = (url: string) => fetchDashboardData<MoneyFlowResponse>(url)

function BalanceSparkline({ series }: { series: MoneyFlowPoint[] }) {
  const data = series.map((point) => ({
    month: point.month,
    value: point.saldo_acumulado,
  }))

  if (data.length === 0) {
    return (
      <div className="flex h-[96px] items-center justify-center rounded-[20px] border border-dashed border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 text-[11px] text-[var(--ft-text-muted)]">
        La tendencia aparecerá cuando haya datos suficientes.
      </div>
    )
  }

  return (
    <div className="rounded-[20px] border border-[var(--ft-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--ft-primary)_9%,transparent),transparent)] px-2 pb-2 pt-3">
      <div className="h-[96px] w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceSparkline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ft-primary)" stopOpacity={0.24} />
                <stop offset="70%" stopColor="var(--ft-primary)" stopOpacity={0.06} />
                <stop offset="100%" stopColor="var(--ft-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--ft-primary)"
              strokeWidth={2.5}
              fill="url(#balanceSparkline)"
              dot={false}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3 px-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]">
          Últimos 6 meses
        </span>
        <span className="text-[11px] font-medium text-[var(--ft-text-muted)]">
          Saldo acumulado
        </span>
      </div>
    </div>
  )
}

interface HeroStatProps {
  label: string
  value: string
  tone?: 'neutral' | 'positive' | 'negative' | 'warning'
}

function HeroStat({ label, value, tone = 'neutral' }: HeroStatProps) {
  const toneClass = {
    neutral: 'text-[var(--ft-text)]',
    positive: 'text-[var(--ft-primary)]',
    negative: 'text-[var(--ft-danger)]',
    warning: 'text-[var(--ft-warning)]',
  }[tone]

  return (
    <div className="rounded-[18px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]">
        {label}
      </p>
      <p className={`mt-2 text-[1rem] font-semibold tabular-nums tracking-[-0.02em] ${toneClass}`}>
        {value}
      </p>
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

  const balancePen = summary?.balance_consolidado.pen ?? 0
  const balanceUsd = summary?.balance_consolidado.usd ?? 0
  const monthlyVariation = summary?.monthly_balance_variation
  const resultadoMensual = summary?.resultado_mensual ?? 0
  const ingresosMes = summary?.ingresos_mes ?? 0
  const egresosMes = summary?.egresos_mes ?? 0
  const alertasPendientes = summary?.alertas_pendientes ?? 0
  const variationAmount = monthlyVariation?.amount_pen ?? 0
  const variationPercent = monthlyVariation?.percent ?? null
  const variationTrend = monthlyVariation?.trend ?? 'flat'
  const variationPositive = variationTrend === 'up'
  const variationPrefix = variationTrend === 'up' ? '+' : ''
  const variationColor = variationTrend === 'up'
    ? chartTheme.positive
    : variationTrend === 'down'
      ? chartTheme.negative
      : 'var(--ft-text-muted)'
  const variationBg = variationTrend === 'up'
    ? 'bg-[color-mix(in_srgb,var(--ft-primary)_10%,transparent)]'
    : variationTrend === 'down'
      ? 'bg-[color-mix(in_srgb,var(--ft-danger)_10%,transparent)]'
      : 'bg-[var(--ft-surface-muted)]'
  const variationBorder = variationTrend === 'up'
    ? 'border-[color-mix(in_srgb,var(--ft-primary)_18%,transparent)]'
    : variationTrend === 'down'
      ? 'border-[color-mix(in_srgb,var(--ft-danger)_20%,transparent)]'
      : 'border-[var(--ft-border)]'

  const series = moneyFlow?.series ?? []
  const lastPoint = series.at(-1)
  const previousPoint = series.at(-2)
  const trendDelta = lastPoint && previousPoint
    ? lastPoint.saldo_acumulado - previousPoint.saldo_acumulado
    : resultadoMensual
  const trendPositive = trendDelta >= 0

  if (summaryLoading && !summary) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6 lg:p-7">
        <div className="animate-pulse space-y-5">
          <div className="h-3 w-36 rounded bg-[var(--ft-surface-muted)]" />
          <div className="h-14 w-64 rounded bg-[var(--ft-surface-muted)]" />
          <div className="h-[96px] rounded-[20px] bg-[var(--ft-surface-muted)]" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-[76px] rounded-[18px] bg-[var(--ft-surface-muted)]" />
            ))}
          </div>
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard
      className="overflow-hidden"
      innerClassName="relative overflow-hidden p-5 md:p-6 lg:p-7"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--ft-primary)_16%,transparent),transparent_60%)]"
      />

      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_220px] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="inline-flex rounded-full border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-primary)]">
                Balance consolidado
              </p>
              <h2 className="mt-4 text-[2.65rem] font-semibold leading-none tracking-[-0.055em] text-[var(--ft-text)] sm:text-[3.25rem]">
                {formatCurrency(balancePen, 'PEN')}
              </h2>
              <p className="mt-3 text-[13px] text-[var(--ft-text-muted)]">
                Equivalencia USD: <span className="font-medium tabular-nums text-[var(--ft-text)]">{formatCurrency(balanceUsd, 'USD')}</span>
              </p>
              <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium ${variationBg} ${variationBorder}`}>
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: variationColor }}
                />
                <span className="tabular-nums" style={{ color: variationColor }}>
                  {variationPrefix}S/ {formatNumber(variationAmount, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  {variationPercent != null ? ` (${variationPrefix}${formatNumber(variationPercent, { maximumFractionDigits: 1 })}%)` : ''}
                </span>
                <span className="text-[var(--ft-text-muted)]">vs mes anterior</span>
              </div>
            </div>

            <div
              className={`min-w-[196px] rounded-[20px] border px-4 py-4 ${
                resultadoMensual >= 0
                  ? 'border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)]'
                  : 'border-[color-mix(in_srgb,var(--ft-danger)_24%,transparent)] bg-[color-mix(in_srgb,var(--ft-danger)_10%,transparent)]'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]">
                Resultado mensual
              </p>
              <p
                className="mt-2 text-[1.55rem] font-semibold leading-none tabular-nums tracking-[-0.03em]"
                style={{ color: resultadoMensual >= 0 ? 'var(--ft-primary)' : 'var(--ft-danger)' }}
              >
                {formatCurrency(resultadoMensual, 'PEN')}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-[var(--ft-text-muted)]">
                {trendPositive ? 'Mes en expansión' : 'Mes bajo presión'} · {trendPositive ? '+' : ''}
                S/ {formatNumber(trendDelta, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <BalanceSparkline series={series} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <HeroStat
            label="Ingresos"
            value={formatCurrency(ingresosMes, 'PEN')}
            tone="positive"
          />
          <HeroStat
            label="Egresos"
            value={formatCurrency(egresosMes, 'PEN')}
            tone="negative"
          />
          <HeroStat
            label="Alertas"
            value={String(alertasPendientes)}
            tone={alertasPendientes > 0 ? 'warning' : 'neutral'}
          />
        </div>
      </div>
    </PremiumCard>
  )
}
