'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { DashboardCategoryBreakdownItem, DashboardSidebar } from '@/lib/dashboard/types'
import { fetchDashboardData } from './api'
import { PremiumCard } from './PremiumCard'

const MAX_VISIBLE_CATEGORIES = 10
const fetcher = (url: string) => fetchDashboardData<DashboardSidebar>(url)

type CategoryMode = 'expense' | 'income'
type CategoryItemWithId = DashboardCategoryBreakdownItem & { stableId: string }
type CategoryTone = {
  accent: string
  fill: string
  track: string
}

const CATEGORY_TONES = [
  {
    accent: 'var(--ft-primary)',
    fill: 'color-mix(in oklch, var(--ft-primary) 70%, var(--ft-surface))',
    track: 'color-mix(in oklch, var(--ft-primary) 12%, var(--ft-surface-muted))',
  },
  {
    accent: 'var(--ft-info)',
    fill: 'color-mix(in oklch, var(--ft-info) 68%, var(--ft-surface))',
    track: 'color-mix(in oklch, var(--ft-info) 12%, var(--ft-surface-muted))',
  },
  {
    accent: 'var(--ft-success)',
    fill: 'color-mix(in oklch, var(--ft-success) 68%, var(--ft-surface))',
    track: 'color-mix(in oklch, var(--ft-success) 12%, var(--ft-surface-muted))',
  },
  {
    accent: 'var(--ft-warning)',
    fill: 'color-mix(in oklch, var(--ft-warning) 66%, var(--ft-surface))',
    track: 'color-mix(in oklch, var(--ft-warning) 12%, var(--ft-surface-muted))',
  },
  {
    accent: 'var(--ft-danger)',
    fill: 'color-mix(in oklch, var(--ft-danger) 66%, var(--ft-surface))',
    track: 'color-mix(in oklch, var(--ft-danger) 12%, var(--ft-surface-muted))',
  },
] satisfies [CategoryTone, ...CategoryTone[]]

function formatPen(value: number, digits = 0) {
  return `S/ ${formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function modeTone(mode: CategoryMode) {
  return mode === 'expense' ? 'var(--ft-danger)' : 'var(--ft-primary)'
}

function safeCategoryId(item: DashboardCategoryBreakdownItem, index: number) {
  return item.category_id ?? `${item.name}-${index}`
}

function currentPeriodKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function dateFromPeriodKey(periodKey: string) {
  const [yearRaw, monthRaw] = periodKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    const now = new Date()
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  }

  return new Date(Date.UTC(year, month - 1, 1))
}

function formatPeriodLabel(periodKey: string) {
  return new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dateFromPeriodKey(periodKey))
}

function shiftPeriod(periodKey: string, offset: number) {
  const date = dateFromPeriodKey(periodKey)
  date.setUTCMonth(date.getUTCMonth() + offset)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function groupVisibleCategories(items: CategoryItemWithId[]): {
  visibleItems: CategoryItemWithId[]
  groupedCount: number
} {
  if (items.length <= MAX_VISIBLE_CATEGORIES) {
    return { visibleItems: items, groupedCount: 0 }
  }

  const visibleItems = items.slice(0, MAX_VISIBLE_CATEGORIES - 1)
  const groupedItems = items.slice(MAX_VISIBLE_CATEGORIES - 1)
  const groupedAmount = groupedItems.reduce((sum, item) => sum + item.monto, 0)
  const groupedPct = groupedItems.reduce((sum, item) => sum + item.pct, 0)

  return {
    visibleItems: [
      ...visibleItems,
      {
        category_id: null,
        stableId: 'grouped-otros',
        name: 'Otros',
        color: '',
        monto: Math.round(groupedAmount * 100) / 100,
        pct: Math.round(groupedPct * 10) / 10,
      },
    ],
    groupedCount: groupedItems.length,
  }
}

function PeriodButton({
  direction,
  disabled = false,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={direction === 'prev' ? 'Mes anterior' : 'Mes siguiente'}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-full text-[var(--ft-text-muted)] transition-[background-color,color,transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--ft-surface)] hover:text-[var(--ft-text)] active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
        <path
          d={direction === 'prev' ? 'M9.8 3.4 5.2 8l4.6 4.6' : 'M6.2 3.4 10.8 8l-4.6 4.6'}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </button>
  )
}

function EmptyCategoryState({
  mode,
  periodLabel,
}: {
  mode: CategoryMode
  periodLabel: string
}) {
  const activeTone = modeTone(mode)

  return (
    <div className="mt-5 grid min-h-[246px] place-items-center rounded-[20px] border border-dashed border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-6 text-center">
      <div className="max-w-[250px]">
        <div
          className="mx-auto grid h-10 w-10 place-items-center rounded-full"
          style={{ backgroundColor: `color-mix(in oklch, ${activeTone} 12%, transparent)` }}
        >
          <span
            className="block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: activeTone }}
          />
        </div>
        <p className="mt-4 text-[13px] font-semibold text-[var(--ft-text)]">
          {mode === 'expense' ? 'Sin egresos registrados' : 'Sin ingresos registrados'}
        </p>
        <p className="mt-1.5 text-[12px] leading-5 text-[var(--ft-text-muted)]">
          No hay movimientos de {mode === 'expense' ? 'egreso' : 'ingreso'} para {periodLabel}.
        </p>
      </div>
    </div>
  )
}

function CategoryBars({
  items,
  total,
}: {
  items: CategoryItemWithId[]
  total: number
}) {
  const maxAmount = Math.max(...items.map((item) => item.monto), 0)

  return (
    <div className="mt-5 space-y-2.5 rounded-[20px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-3">
      {items.map((item, index) => {
        const tone = CATEGORY_TONES[index % CATEGORY_TONES.length] ?? CATEGORY_TONES[0]
        const pctOfTotal = total > 0 ? (item.monto / total) * 100 : 0
        const widthPct = maxAmount > 0 ? (item.monto / maxAmount) * 100 : 0
        const isGrouped = item.stableId === 'grouped-otros'

        return (
          <div
            key={item.stableId}
            className="rounded-[16px] border border-[var(--ft-border)] bg-[var(--ft-surface)] p-3 transition-[border-color,background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-[var(--ft-border-strong)] hover:bg-[color-mix(in_oklch,var(--ft-surface)_88%,var(--ft-surface-muted))]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tone.accent }}
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--ft-text)]">
                    {item.name}
                  </p>
                  <p className="mt-1 text-[10.5px] tabular-nums text-[var(--ft-text-muted)]">
                    {formatNumber(pctOfTotal, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}% del total{isGrouped ? ' agrupado' : ''}
                  </p>
                </div>
              </div>

              <p className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-[var(--ft-text)]">
                {formatPen(item.monto)}
              </p>
            </div>

            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full"
              style={{ backgroundColor: tone.track }}
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{
                  width: `${Math.max(3, Math.min(100, widthPct))}%`,
                  background: `linear-gradient(90deg, ${tone.fill}, ${tone.accent})`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function EgresosCategoriasWidget() {
  const [mode, setMode] = useState<CategoryMode>('expense')
  const [periodKey, setPeriodKey] = useState(currentPeriodKey)
  const currentKey = currentPeriodKey()
  const monthLabel = formatPeriodLabel(periodKey)
  const { data, isLoading } = useSWR(`/api/dashboard/sidebar?period=${periodKey}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const expenseItems = data?.egresos_categoria ?? []
  const incomeItems = data?.ingresos_categoria ?? []
  const rawItems = mode === 'expense' ? expenseItems : incomeItems
  const items = useMemo(
    () => rawItems
      .slice()
      .sort((a, b) => b.monto - a.monto)
      .map((item, index) => ({ ...item, stableId: safeCategoryId(item, index) })),
    [rawItems]
  )
  const total = items.reduce((sum, item) => sum + item.monto, 0)
  const title = mode === 'expense' ? 'Egresos por categoría' : 'Ingresos por categoría'
  const activeTone = modeTone(mode)
  const canGoNext = periodKey < currentKey
  const { visibleItems, groupedCount } = useMemo(() => groupVisibleCategories(items), [items])

  const footerText = items.length === 0
    ? `0 categorías en ${monthLabel}.`
    : groupedCount > 0
      ? `${visibleItems.length} filas visibles · ${groupedCount} ${groupedCount === 1 ? 'categoría agrupada' : 'categorías agrupadas'} en Otros.`
      : `${visibleItems.length} ${visibleItems.length === 1 ? 'categoría' : 'categorías'} · barras escaladas al mayor monto.`

  if (isLoading && !data) {
    return (
      <PremiumCard innerClassName="p-5 md:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-40 rounded bg-[var(--ft-surface-muted)]" />
          <div className="h-[246px] rounded-[20px] bg-[var(--ft-surface-muted)]" />
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
          <p className="mt-1 text-[11px] text-[var(--ft-text-muted)]">Distribución mensual</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex items-center rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-1">
            <PeriodButton direction="prev" onClick={() => setPeriodKey((value) => shiftPeriod(value, -1))} />
            <span className="min-w-[118px] px-1 text-center text-[11px] font-semibold capitalize tabular-nums text-[var(--ft-text)]">
              {monthLabel}
            </span>
            <PeriodButton
              direction="next"
              disabled={!canGoNext}
              onClick={() => setPeriodKey((value) => shiftPeriod(value, 1))}
            />
          </div>

          <div className="relative inline-flex rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-1">
            <span
              className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{
                backgroundColor: `color-mix(in oklch, ${activeTone} 12%, transparent)`,
                transform: mode === 'income' ? 'translateX(100%)' : 'translateX(0)',
              }}
            />
            <button
              type="button"
              onClick={() => setMode('expense')}
              className={`relative rounded-full px-3 py-1.5 text-[11px] font-semibold transition-[color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] ${
                mode === 'expense' ? 'text-[var(--ft-danger)]' : 'text-[var(--ft-text-muted)] hover:text-[var(--ft-text)]'
              }`}
            >
              Egresos
            </button>
            <button
              type="button"
              onClick={() => setMode('income')}
              className={`relative rounded-full px-3 py-1.5 text-[11px] font-semibold transition-[color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] ${
                mode === 'income' ? 'text-[var(--ft-primary)]' : 'text-[var(--ft-text-muted)] hover:text-[var(--ft-text)]'
              }`}
            >
              Ingresos
            </button>
          </div>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <EmptyCategoryState mode={mode} periodLabel={monthLabel} />
      ) : (
        <CategoryBars items={visibleItems} total={total} />
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--ft-text-muted)]">{footerText}</p>
        <p className="text-[12px] font-semibold tabular-nums text-[var(--ft-text)]">
          Total {formatPen(total)}
        </p>
      </div>
    </PremiumCard>
  )
}
