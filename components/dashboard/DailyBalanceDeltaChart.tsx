'use client'

import useSWR from 'swr'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { chartAxisTick, chartCursor, chartTheme } from './chartTheme'

type SaldoDiaResponse = {
  period: SaldoDiaPeriod
  points: SaldoDiaPoint[]
  totals: {
    ingresos: number
    egresos: number
  }
}

const fetcher = (url: string) => fetchDashboardData<SaldoDiaResponse>(url)

function DeltaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  return (
    <div className="rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-3 shadow-[var(--shadow-md)]">
      <p className="text-[11px] text-[var(--c-text-muted)]">
        {new Date(`${label}T12:00:00`).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'long',
        })}
      </p>
      <p className={`mt-1 text-[1.1rem] font-semibold tabular-nums tracking-[-0.03em] ${row.delta >= 0 ? 'text-[var(--c-primary)]' : 'text-[var(--c-danger)]'}`}>
        {row.delta >= 0 ? '+' : ''}S/ {formatNumber(row.delta, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="mt-2 text-[11px] text-[var(--c-text-muted)]">
        Shock diario respecto al cierre previo.
      </p>
    </div>
  )
}

export function DailyBalanceDeltaChart() {
  const { data, isLoading } = useSWR('/api/dashboard/saldos-dia?period=1M', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  })

  const deltaData = (data?.points ?? [])
    .map((point, index, all) => {
      const previous = all[index - 1]?.saldo ?? point.saldo
      return {
        date: point.date,
        delta: point.saldo - previous,
      }
    })
    .slice(1)

  const latestDelta = deltaData.at(-1)?.delta ?? 0
  const strongestMove = deltaData.reduce((largest, item) => {
    return Math.abs(item.delta) > Math.abs(largest) ? item.delta : largest
  }, 0)

  if (isLoading && deltaData.length === 0) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-44 rounded bg-[var(--c-surface-2)]" />
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
            Variación diaria
          </p>
          <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
            Barras compactas para detectar entradas y salidas bruscas.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--c-text-faint)]">Último cierre</p>
          <p className={`mt-1 text-[1rem] font-semibold tabular-nums ${latestDelta >= 0 ? 'text-[var(--c-primary)]' : 'text-[var(--c-danger)]'}`}>
            {latestDelta >= 0 ? '+' : ''}S/ {formatNumber(latestDelta, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div className="mt-5 h-[220px] w-full">
        <ResponsiveContainer>
          <BarChart data={deltaData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={chartTheme.grid} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={chartAxisTick}
              tickFormatter={(value: string) =>
                new Date(`${value}T12:00:00`)
                  .toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
                  .replace('.', '')
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={chartAxisTick}
              tickFormatter={(value: number) => formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            />
            <ReferenceLine y={0} stroke="var(--c-border-hover)" />
            <Tooltip cursor={chartCursor} content={<DeltaTooltip />} />
            <Bar dataKey="delta" radius={[6, 6, 6, 6]} barSize={10} animationDuration={700} animationEasing="ease-out">
              {deltaData.map((entry) => (
                <Cell
                  key={entry.date}
                  fill={entry.delta >= 0 ? 'var(--c-primary)' : 'var(--c-danger)'}
                  fillOpacity={0.82}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-[11px] leading-5 text-[var(--c-text-muted)]">
        Movimiento más intenso del período: {strongestMove >= 0 ? '+' : ''}S/ {formatNumber(strongestMove, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}.
      </p>
    </PremiumCard>
  )
}
