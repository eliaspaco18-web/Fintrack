'use client'

import useSWR from 'swr'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { MoneyFlowMode, MoneyFlowPoint } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'
import { chartAxisTick, chartCursor, chartTheme } from './chartTheme'

type MoneyFlowResponse = {
  mode: MoneyFlowMode
  months: number
  series: MoneyFlowPoint[]
}

const fetcher = (url: string) => fetchDashboardData<MoneyFlowResponse>(url)

function SavingsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  return (
    <div className="rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-3 shadow-[var(--shadow-md)]">
      <p className="text-[11px] font-semibold text-[var(--c-text)]">{label}</p>
      <p className="mt-1 text-[1.1rem] font-semibold tabular-nums tracking-[-0.03em] text-[var(--c-text)]">
        {formatNumber(row.savingsRate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
      </p>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <span className="text-[var(--c-text-muted)]">Ingresos</span>
        <span className="text-right font-semibold tabular-nums text-[var(--c-primary)]">
          S/ {formatNumber(row.ingresos, { maximumFractionDigits: 0 })}
        </span>
        <span className="text-[var(--c-text-muted)]">Egresos</span>
        <span className="text-right font-semibold tabular-nums text-[var(--c-danger)]">
          S/ {formatNumber(row.egresos, { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  )
}

export function SavingsRateTrendChart() {
  const { data, isLoading } = useSWR('/api/dashboard/money-flow?months=6&mode=acumulado', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const savingsData = (data?.series ?? []).map((point) => ({
    month: point.month,
    savingsRate: point.ingresos > 0 ? ((point.ingresos - point.egresos) / point.ingresos) * 100 : 0,
    ingresos: point.ingresos,
    egresos: point.egresos,
  }))

  const currentRate = savingsData.at(-1)?.savingsRate ?? 0
  const rateTone = currentRate >= 20 ? 'text-[var(--c-primary)]' : currentRate >= 0 ? 'text-[var(--c-warning)]' : 'text-[var(--c-danger)]'

  if (isLoading && savingsData.length === 0) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-36 rounded bg-[var(--c-surface-2)]" />
          <div className="h-[220px] rounded-[20px] bg-[var(--c-surface-2)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-text-faint)]">
            Tasa de ahorro
          </p>
          <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
            Tendencia mensual para distinguir disciplina, no solo volumen.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Último mes</p>
          <p className={`mt-1 text-[1rem] font-semibold tabular-nums ${rateTone}`}>
            {formatNumber(currentRate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </p>
        </div>
      </div>

      <div className="mt-5 h-[220px] w-full">
        <ResponsiveContainer>
          <AreaChart data={savingsData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="savingsRateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--c-primary)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--c-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={chartTheme.grid} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={chartAxisTick} />
            <YAxis
              tickFormatter={(value: number) => `${formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`}
              tickLine={false}
              axisLine={false}
              tick={chartAxisTick}
            />
            <ReferenceLine y={20} stroke="var(--c-warning)" strokeDasharray="4 4" />
            <Tooltip cursor={chartCursor} content={<SavingsTooltip />} />
            <Area
              type="monotone"
              dataKey="savingsRate"
              stroke="var(--c-primary)"
              strokeWidth={2.5}
              fill="url(#savingsRateGradient)"
              activeDot={{
                r: 5,
                strokeWidth: 2,
                stroke: 'var(--c-surface)',
                fill: 'var(--c-primary)',
              }}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-[11px] leading-5 text-[var(--c-text-muted)]">
        La línea de referencia marca 20%, un umbral sano para leer ahorro operativo del mes.
      </p>
    </PremiumCard>
  )
}
