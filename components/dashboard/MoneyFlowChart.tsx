'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { MoneyFlowMode, MoneyFlowPoint } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'
import {
  chartAxisTick,
  chartCursor,
  chartTheme,
} from './chartTheme'

type MoneyFlowResponse = {
  mode: MoneyFlowMode
  months: number
  series: MoneyFlowPoint[]
}

const fetcher = (url: string) => fetchDashboardData<MoneyFlowResponse>(url)

const TOGGLE_OPTIONS: Array<{ key: MoneyFlowMode; label: string }> = [
  { key: 'acumulado', label: 'Saldo acumulado' },
  { key: 'mensual', label: 'Flujo mensual' },
]

function MoneyFlowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  const delta = row.deltaAmount ?? 0
  const isPositive = delta >= 0

  return (
    <div className="rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-3 shadow-[var(--shadow-md)]">
      <p className="text-[11px] font-semibold text-[var(--c-text)]">{label}</p>
      <p className="mt-1 text-[1.15rem] font-semibold tabular-nums tracking-[-0.03em] text-[var(--c-text)]">
        S/ {formatNumber(row.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
      <p className={`mt-3 text-[11px] ${isPositive ? 'text-[var(--c-primary)]' : 'text-[var(--c-danger)]'}`}>
        {isPositive ? '+' : ''}S/ {formatNumber(delta, { maximumFractionDigits: 0 })} vs mes anterior
      </p>
    </div>
  )
}

export function MoneyFlowChart() {
  const [mode, setMode] = useState<MoneyFlowMode>('acumulado')

  const { data, isLoading } = useSWR(
    `/api/dashboard/money-flow?months=6&mode=${mode}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  )

  const chartData = (data?.series ?? []).map((point, index, all) => {
    const value = mode === 'mensual' ? point.saldo_mensual : point.saldo_acumulado
    const previous = index > 0
      ? mode === 'mensual'
        ? all[index - 1]?.saldo_mensual ?? value
        : all[index - 1]?.saldo_acumulado ?? value
      : value

    return {
      month: point.month,
      value,
      ingresos: point.ingresos,
      egresos: point.egresos,
      deltaAmount: value - previous,
    }
  })

  if (isLoading && chartData.length === 0) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse">
          <div className="h-4 w-48 rounded bg-[var(--c-surface-2)]" />
          <div className="mt-4 h-[300px] rounded-[20px] bg-[var(--c-surface-2)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-text-faint)]">
            Flujo de dinero
          </p>
          <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
            Seis meses de contexto para leer presión y expansión de caja.
          </p>
        </div>

        <div className="inline-flex rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1">
          {TOGGLE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMode(option.key)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98] ${
                mode === option.key
                  ? 'bg-[var(--c-primary)] text-[var(--c-text-on-primary)]'
                  : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[304px] w-full">
        <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ top: 14, right: 18, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="moneyFlowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--c-primary)" stopOpacity={0.34} />
                <stop offset="55%" stopColor="var(--c-primary)" stopOpacity={0.10} />
                <stop offset="100%" stopColor="var(--c-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke={chartTheme.grid} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={chartAxisTick}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={chartAxisTick}
              tickFormatter={(value: number) => `S/${formatNumber(value, { maximumFractionDigits: 0 })}`}
            />
            <Tooltip cursor={chartCursor} content={<MoneyFlowTooltip />} />

            {mode === 'mensual' && (
              <>
                <Line
                  type="monotone"
                  dataKey="ingresos"
                  stroke="var(--c-primary)"
                  strokeOpacity={0.34}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                />
                <Line
                  type="monotone"
                  dataKey="egresos"
                  stroke="var(--c-danger)"
                  strokeOpacity={0.34}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                />
              </>
            )}

            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--c-primary)"
              strokeWidth={3}
              fill="url(#moneyFlowGradient)"
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
    </PremiumCard>
  )
}
