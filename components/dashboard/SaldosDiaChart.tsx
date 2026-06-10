'use client'

import { useState } from 'react'
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
import type { SaldoDiaPeriod, SaldoDiaPoint } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'
import {
  chartAxisTick,
  chartCursor,
  chartTheme,
} from './chartTheme'

type SaldoDiaResponse = {
  period: SaldoDiaPeriod
  points: SaldoDiaPoint[]
  totals: {
    ingresos: number
    egresos: number
  }
}

const PERIODS: SaldoDiaPeriod[] = ['5D', '1M', '3M', '6M', '1A']
const fetcher = (url: string) => fetchDashboardData<SaldoDiaResponse>(url)

function SaldosTooltip({ active, payload, label, avgSaldo }: any) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  const diff = row.saldo - avgSaldo

  return (
    <div className="rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-3 shadow-[var(--shadow-md)]">
      <p className="text-[11px] text-[var(--c-text-muted)]">
        {new Date(`${label}T12:00:00`).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}
      </p>
      <p className="mt-1 text-[1.15rem] font-semibold tabular-nums tracking-[-0.03em] text-[var(--c-text)]">
        S/ {formatNumber(row.saldo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className={`mt-2 text-[11px] ${diff >= 0 ? 'text-[var(--c-primary)]' : 'text-[var(--c-danger)]'}`}>
        {diff >= 0 ? '+' : ''}S/ {formatNumber(diff, { maximumFractionDigits: 0 })} vs promedio
      </p>
    </div>
  )
}

export function SaldosDiaChart() {
  const [period, setPeriod] = useState<SaldoDiaPeriod>('1M')

  const { data, isLoading } = useSWR(
    `/api/dashboard/saldos-dia?period=${period}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 20_000,
    }
  )

  const points = data?.points ?? []
  const totals = data?.totals ?? { ingresos: 0, egresos: 0 }
  const avgSaldo = points.length
    ? points.reduce((sum, point) => sum + point.saldo, 0) / points.length
    : 0

  if (isLoading && points.length === 0) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse">
          <div className="h-4 w-44 rounded bg-[var(--c-surface-2)]" />
          <div className="mt-4 h-[290px] rounded-[20px] bg-[var(--c-surface-2)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-text-faint)]">
            Saldos por día
          </p>
          <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
            Liquidez diaria con referencia visual de tu nivel normal.
          </p>
        </div>

        <div className="inline-flex rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1">
          {PERIODS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98] ${
                period === item
                  ? 'bg-[var(--c-primary)] text-[var(--c-text-on-primary)]'
                  : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[286px] w-full">
        <ResponsiveContainer>
          <AreaChart data={points} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="dailyBalanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--c-accent-landing)" stopOpacity={0.26} />
                <stop offset="100%" stopColor="var(--c-accent-landing)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={chartTheme.grid} />
            <ReferenceLine
              y={avgSaldo}
              stroke="var(--c-warning)"
              strokeDasharray="5 5"
              label={{
                value: 'Promedio',
                position: 'insideTopRight',
                fill: 'var(--c-text-muted)',
                fontSize: 11,
              }}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={chartAxisTick}
              tickFormatter={(value: string) => {
                const date = new Date(`${value}T12:00:00`)
                return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }).replace('.', '')
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={chartAxisTick}
              tickFormatter={(value: number) => formatNumber(value, { maximumFractionDigits: 0 })}
            />
            <Tooltip
              cursor={chartCursor}
              content={<SaldosTooltip avgSaldo={avgSaldo} />}
            />
            <Area
              type="monotone"
              dataKey="saldo"
              stroke="var(--c-accent-landing)"
              strokeWidth={2.5}
              fill="url(#dailyBalanceGradient)"
              activeDot={{
                r: 5,
                strokeWidth: 2,
                stroke: 'var(--c-surface)',
                fill: 'var(--c-accent-landing)',
              }}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
        <div className="rounded-[18px] border border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] px-4 py-3 text-[var(--c-primary)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">Ingresos acumulados</p>
          <p className="mt-2 text-[1rem] font-semibold tabular-nums">
            S/ {formatNumber(totals.ingresos, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--c-danger)_24%,transparent)] bg-[color-mix(in_srgb,var(--c-danger)_10%,transparent)] px-4 py-3 text-[var(--c-danger)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">Egresos acumulados</p>
          <p className="mt-2 text-[1rem] font-semibold tabular-nums">
            S/ {formatNumber(totals.egresos, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </PremiumCard>
  )
}
