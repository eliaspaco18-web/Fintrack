'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
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

type MoneyFlowResponse = {
  mode: MoneyFlowMode
  months: number
  series: MoneyFlowPoint[]
}

type PeriodOption = 3 | 6 | 12

type MoneyFlowChartPoint = {
  month: string
  ingresos: number
  egresos: number
  neto: number
}

const PERIOD_OPTIONS: Array<{ value: PeriodOption; label: string }> = [
  { value: 3, label: '3M' },
  { value: 6, label: '6M' },
  { value: 12, label: '12M' },
]

const fetcher = (url: string) => fetchDashboardData<MoneyFlowResponse>(url)

const chartAxisTick = {
  fontSize: 11,
  fill: 'var(--ft-text-muted)',
  fontWeight: 600,
} as const

function formatPen(value: number, digits = 0) {
  return `S/ ${formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function MoneyFlowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: MoneyFlowChartPoint }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  const isPositive = row.neto >= 0

  return (
    <div
      className="rounded-[16px] border border-[var(--ft-border)] bg-[var(--ft-surface)] py-3 pl-3 pr-4 shadow-[var(--shadow-lg)]"
      style={{ borderLeft: `3px solid ${isPositive ? 'var(--ft-primary)' : 'var(--ft-danger)'}` }}
    >
      <p className="text-[12px] font-semibold text-[var(--ft-text)]">{label}</p>
      <div className="mt-3 space-y-2 text-[11px]">
        <div className="flex items-center justify-between gap-8">
          <span className="text-[var(--ft-text-muted)]">Ingreso</span>
          <span className="font-semibold tabular-nums text-[var(--ft-primary)]">
            {formatPen(row.ingresos)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-8">
          <span className="text-[var(--ft-text-muted)]">Egreso</span>
          <span className="font-semibold tabular-nums text-[var(--ft-danger)]">
            {formatPen(row.egresos)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-8 border-t border-[var(--ft-border)] pt-2">
          <span className="font-semibold text-[var(--ft-text)]">Neto</span>
          <span className={`font-semibold tabular-nums ${isPositive ? 'text-[var(--ft-primary)]' : 'text-[var(--ft-danger)]'}`}>
            {isPositive ? '+' : '-'}{formatPen(Math.abs(row.neto))}
          </span>
        </div>
      </div>
    </div>
  )
}

export function MoneyFlowChart() {
  const [months, setMonths] = useState<PeriodOption>(6)

  const { data, isLoading } = useSWR(
    `/api/dashboard/money-flow?months=${months}&mode=mensual`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  )

  const chartData = useMemo<MoneyFlowChartPoint[]>(
    () => (data?.series ?? []).map((point) => ({
      month: point.month,
      ingresos: point.ingresos,
      egresos: point.egresos,
      neto: point.saldo_mensual,
    })),
    [data?.series]
  )

  if (isLoading && chartData.length === 0) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse">
          <div className="h-4 w-48 rounded bg-[var(--ft-surface-muted)]" />
          <div className="mt-4 h-[300px] rounded-[20px] bg-[var(--ft-surface-muted)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            Flujo de dinero
          </p>
          <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">
            Ingresos y egresos comparados contra el resultado neto mensual.
          </p>
        </div>

        <label className="relative inline-flex items-center rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2 text-[11px] font-semibold text-[var(--ft-text)]">
          <select
            value={months}
            onChange={(event) => setMonths(Number(event.target.value) as PeriodOption)}
            className="appearance-none bg-transparent pr-6 text-[11px] font-semibold text-[var(--ft-text)] outline-none"
            aria-label="Periodo de flujo de dinero"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ft-text-muted)]"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </label>
      </div>

      <div className="h-[304px] w-full">
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 14, right: 18, left: 0, bottom: 8 }} barGap={6}>
            <CartesianGrid
              vertical={false}
              stroke="color-mix(in oklch, var(--ft-border) 74%, transparent)"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={chartAxisTick}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={54}
              tick={chartAxisTick}
              tickFormatter={(value: number) => formatAxisTick(value)}
            />
            <Tooltip
              cursor={{
                stroke: 'var(--ft-border-strong)',
                strokeDasharray: '4 4',
              }}
              content={<MoneyFlowTooltip />}
            />
            <Bar
              dataKey="ingresos"
              name="Ingresos"
              fill="var(--ft-primary)"
              radius={[4, 4, 0, 0]}
              barSize={18}
              animationDuration={600}
              animationBegin={0}
            />
            <Bar
              dataKey="egresos"
              name="Egresos"
              fill="var(--ft-danger)"
              radius={[4, 4, 0, 0]}
              barSize={18}
              animationDuration={600}
              animationBegin={40}
            />
            <Line
              type="monotone"
              dataKey="neto"
              name="Neto"
              stroke="var(--ft-text)"
              strokeWidth={2.4}
              dot={false}
              activeDot={{
                r: 5,
                stroke: 'var(--ft-surface)',
                strokeWidth: 2,
                fill: 'var(--ft-text)',
              }}
              animationDuration={680}
              animationBegin={120}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </PremiumCard>
  )
}

function formatAxisTick(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `S/${formatNumber(value / 1_000_000, { maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `S/${formatNumber(value / 1_000, { maximumFractionDigits: 0 })}k`
  return `S/${formatNumber(value, { maximumFractionDigits: 0 })}`
}
