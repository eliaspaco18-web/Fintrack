'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { DashboardSidebar } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'
import { chartTheme, chartTooltipStyle } from './chartTheme'

const fetcher = (url: string) => fetchDashboardData<DashboardSidebar>(url)

export function EgresosCategoriasWidget() {
  const [mode, setMode] = useState<'expense' | 'income'>('expense')
  const { data, isLoading } = useSWR('/api/dashboard/sidebar', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const expenseItems = data?.egresos_categoria ?? []
  const incomeItems = data?.ingresos_categoria ?? []
  const items = mode === 'expense' ? expenseItems : incomeItems
  const total = items.reduce((sum, item) => sum + item.monto, 0)
  const monthLabel = new Date().toLocaleDateString('es-PE', {
    month: 'long',
    year: 'numeric',
  })
  const title = mode === 'expense' ? 'Egresos por categoría' : 'Ingresos por categoría'
  const emptyLabel = mode === 'expense'
    ? 'Sin egresos en el período actual.'
    : 'Sin ingresos en el período actual.'
  const summaryLabel = mode === 'expense'
    ? 'categorías con salida de dinero durante el período actual.'
    : 'categorías con entrada de dinero durante el período actual.'
  const activeTone = useMemo(
    () => mode === 'expense' ? chartTheme.negative : chartTheme.positive,
    [mode]
  )

  if (isLoading && !data) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-40 rounded bg-[var(--ft-surface-muted)]" />
          <div className="h-40 rounded-[20px] bg-[var(--ft-surface-muted)]" />
        </div>
      </PremiumCard>
    )
  }

  return (
    <PremiumCard innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-subtle)]">
            {title}
          </p>
          <p className="mt-1 text-[11px] text-[var(--ft-text-muted)]">{monthLabel}</p>
        </div>

        <div className="inline-flex rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-1">
          <button
            type="button"
            onClick={() => setMode('expense')}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-[background-color,color,transform] duration-200 ease-[var(--ease-out)] active:scale-[0.97] ${
              mode === 'expense'
                ? 'bg-[color-mix(in_srgb,var(--ft-danger)_12%,transparent)] text-[var(--ft-danger)]'
                : 'text-[var(--ft-text-muted)] hover:text-[var(--ft-text)]'
            }`}
          >
            Egresos
          </button>
          <button
            type="button"
            onClick={() => setMode('income')}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-[background-color,color,transform] duration-200 ease-[var(--ease-out)] active:scale-[0.97] ${
              mode === 'income'
                ? 'bg-[color-mix(in_srgb,var(--ft-primary)_12%,transparent)] text-[var(--ft-primary)]'
                : 'text-[var(--ft-text-muted)] hover:text-[var(--ft-text)]'
            }`}
          >
            Ingresos
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-[12px] text-[var(--ft-text-muted)]">{emptyLabel}</p>
      ) : (
        <>
          <div className="mt-5 grid gap-5 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
            <div className="relative h-[180px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={items}
                    dataKey="monto"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={78}
                    paddingAngle={3}
                    cornerRadius={4}
                    stroke="var(--ft-surface)"
                    strokeWidth={3}
                  >
                    {items.map((entry) => (
                      <Cell
                        key={`${mode}-${entry.category_id ?? entry.name}`}
                        fill={entry.color || activeTone}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => {
                      const numericValue = typeof value === 'number'
                        ? value
                        : Number(value ?? 0)
                      const label = typeof name === 'string' ? name : String(name ?? '')

                      return [
                        `S/ ${formatNumber(numericValue, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`,
                        label,
                      ]
                    }}
                    contentStyle={chartTooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ft-text-subtle)]">Total</p>
                  <p className="mt-1 text-[1rem] font-semibold tabular-nums tracking-[-0.02em] text-[var(--ft-text)]">
                    S/ {formatNumber(total, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {items.slice(0, 5).map((item) => (
                <div key={`${mode}-${item.category_id ?? item.name}`}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
                    <span className="truncate font-medium text-[var(--ft-text)]">{item.name}</span>
                    <div className="text-right">
                      <span className="block tabular-nums text-[var(--ft-text-muted)]">
                        {formatNumber(item.pct, { maximumFractionDigits: 1 })}%
                      </span>
                      <span className="block text-[11px] font-semibold tabular-nums text-[var(--ft-text)]">
                        S/ {formatNumber(item.monto, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--ft-surface-muted)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out)]"
                      style={{
                        width: `${Math.max(4, item.pct)}%`,
                        backgroundColor: item.color || activeTone,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-[12px] text-[var(--ft-text-muted)]">
            {items.length} {summaryLabel}
          </p>
        </>
      )}
    </PremiumCard>
  )
}
