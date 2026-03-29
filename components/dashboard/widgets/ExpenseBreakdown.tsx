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
  const SIZE = 80
  const R    = 30
  const CX   = SIZE / 2
  const CY   = SIZE / 2
  const STROKE_W = 10
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
      <div className="flex items-center justify-center w-20 h-20 rounded-full
        border-4 border-white/[0.05]">
        <span className="text-[10px] text-white/20">—</span>
      </div>
    )
  }

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="flex-shrink-0">
      {/* Track */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
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
          <div className="h-3 w-32 rounded bg-white/[0.06]"/>
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-full bg-white/[0.05]"/>
            <div className="flex-1 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-3 rounded bg-white/[0.05]" style={{ width: `${60 + i * 10}%` }}/>
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
      <SectionHeader title="Egresos por categoría" accent="#ef4444"/>

      {cats.length === 0 ? (
        <EmptyWidget
          message="Sin egresos este mes"
          hint="Los egresos aparecerán aquí al registrar transacciones"
        />
      ) : (
        <>
          {/* Donut + total */}
          <div className="flex items-center gap-4 mb-5">
            <DonutChart categories={cats} total={total}/>
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wide">Total mes</p>
              <p className="text-xl font-bold tabular-nums text-red-400 leading-tight">
                {formatCurrency(format(total), preferred)}
              </p>
              <p className="text-[11px] text-white/25 mt-0.5">
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
                    <span className="text-[12px] text-white/60 font-medium truncate">
                      {cat.categoryName}
                    </span>
                  </div>
                  <span className="text-[11px] text-white/50 tabular-nums flex-shrink-0 ml-2">
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
