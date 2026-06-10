// =============================================================================
// components/dashboard/widgets/ExpenseBreakdown.tsx
// Widget de egresos por categoría del mes actual.
// Donut SVG + lista de categorías con barras de progreso.
// =============================================================================

'use client'

import { useCurrency }          from '@/lib/hooks/useDashboard'
import { formatCurrency }       from '@/lib/contracts/ui.contracts'
import {
  WidgetShell,
  SectionHeader,
  EmptyWidget,
  ProgressBar,
}                               from '../primitives'
import type { ExpenseCategoryItem } from '@/modules/dashboard/dashboard.types'

// ─── DONUT CHART ─────────────────────────────────────────────────────────────

function DonutChart({
  categories,
  total,
}: {
  categories: ExpenseCategoryItem[]
  total:      number
}) {
  const SIZE = 72
  const R    = 26
  const CX   = SIZE / 2
  const CY   = SIZE / 2
  const STROKE_W = 8
  const CIRCUMFERENCE = 2 * Math.PI * R

  // Calcular segmentos
  let offset = -90 * (CIRCUMFERENCE / 360)  // empezar desde arriba
  const segments = categories.slice(0, 6).map(cat => {
    const pct   = (cat.totalPen / total) * 100
    const dash  = (pct / 100) * CIRCUMFERENCE
    const seg   = { cat, dash, offset, gap: CIRCUMFERENCE - dash }
    offset += dash
    return seg
  })

  if (total === 0) {
    return (
      <div className="flex items-center justify-center w-[72px] h-[72px] rounded-full
        border-4 border-[color:var(--color-border)]">
        <span className="text-[10px] text-[var(--color-text-faint)]">—</span>
      </div>
    )
  }

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="flex-shrink-0">
      {/* Track */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={STROKE_W}
      />
      {/* Segments */}
      {segments.map(({ cat, dash, offset, gap }) => (
        <circle
          key={cat.categoryId ?? 'other'}
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={cat.categoryColor}
          strokeWidth={STROKE_W}
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={-offset}
          strokeLinecap="butt"
          style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
        />
      ))}
    </svg>
  )
}

// ─── WIDGET PRINCIPAL ─────────────────────────────────────────────────────────

interface ExpenseBreakdownProps {
  categories?: ExpenseCategoryItem[]
  loading?:    boolean
}

export function ExpenseBreakdown({ categories, loading }: ExpenseBreakdownProps) {
  const { preferred, format } = useCurrency()

  if (loading) {
    return (
      <WidgetShell>
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-32 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text-faint) 26%, transparent)' }}/>
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text-faint) 20%, transparent)' }}/>
            <div className="flex-1 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-3 rounded" style={{ width: `${60 + i * 10}%`, backgroundColor: 'color-mix(in srgb, var(--color-text-faint) 20%, transparent)' }}/>
              ))}
            </div>
          </div>
        </div>
      </WidgetShell>
    )
  }

  const cats  = categories ?? []
  const total = cats.reduce((s, c) => s + c.totalPen, 0)

  return (
    <WidgetShell>
      <SectionHeader title="Egresos por categoría" accent="var(--c-primary)"/>

      {cats.length === 0 ? (
        <EmptyWidget
          message="Sin egresos este mes"
          hint="Los egresos aparecerán aquí al registrar transacciones"
        />
      ) : (
        <>
          {/* Donut + total */}
          <div className="mb-4 flex items-center gap-3">
            <DonutChart categories={cats} total={total}/>
            <div>
              <p className="text-[10px] text-[var(--color-text-faint)] uppercase tracking-wide">Total mes</p>
              <p className="text-[1.45rem] font-semibold tabular-nums text-[var(--c-primary)] leading-tight">
                {formatCurrency(format(total), preferred)}
              </p>
              <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5">
                {cats.length} categoría{cats.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Lista con barras */}
          <div className="space-y-3">
            {cats.slice(0, 5).map(cat => (
              <div key={cat.categoryId ?? 'other'}>
                <div className="flex justify-between items-baseline mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.categoryColor }}
                    />
                    <span className="text-[12px] text-[var(--color-text-muted)] font-medium truncate">
                      {cat.categoryName}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--color-text-faint)] tabular-nums flex-shrink-0 ml-2">
                    {formatCurrency(format(cat.totalPen), preferred)}
                  </span>
                </div>
                <ProgressBar
                  value={cat.percentage ?? 0}
                  color={cat.categoryColor}
                  height={3}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </WidgetShell>
  )
}
