// =============================================================================
// components/dashboard/widgets/CashFlowChart.tsx
// Gráfico de barras agrupadas: ingresos vs egresos de los últimos 6 meses.
// Implementado en SVG puro — sin dependencias externas.
// =============================================================================

'use client'

import { useCurrency }          from '@/lib/hooks/useDashboard'
import { formatCurrency }       from '@/lib/contracts/ui.contracts'
import { WidgetShell, SectionHeader } from '../primitives'
import type { CashFlowPoint }   from '@/modules/dashboard/dashboard.types'

// ─── CONSTANTES DE LAYOUT ─────────────────────────────────────────────────────

const CHART_H      = 120
const CHART_PAD_L  = 0
const CHART_PAD_B  = 24   // espacio para etiquetas del eje X
const BAR_GAP      = 4    // gap entre las dos barras de un mes
const GROUP_GAP    = 12   // gap entre grupos de meses

// ─── SKELETON ─────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <WidgetShell>
      <div className="animate-pulse space-y-4">
        <div className="h-3 w-28 rounded bg-white/[0.06]"/>
        <div className="flex items-end gap-3 h-[120px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 flex gap-1 items-end h-full">
              <div className="flex-1 rounded-t bg-white/[0.05]" style={{ height: `${40 + i * 10}%` }}/>
              <div className="flex-1 rounded-t bg-white/[0.04]" style={{ height: `${30 + i * 8}%` }}/>
            </div>
          ))}
        </div>
      </div>
    </WidgetShell>
  )
}

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────

interface TooltipData {
  x:       number
  month:   string
  income:  number
  expense: number
  net:     number
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

interface CashFlowChartProps {
  data?:    CashFlowPoint[]
  loading?: boolean
}

export function CashFlowChart({ data, loading }: CashFlowChartProps) {
  const { preferred, format } = useCurrency()

  if (loading) return <ChartSkeleton/>

  const points = data ?? []

  // Calcular dimensiones
  const groupCount  = points.length
  const viewW       = 560   // viewBox width — el SVG se escala via width="100%"
  const availW      = viewW - CHART_PAD_L
  const groupW      = groupCount > 0 ? (availW - GROUP_GAP * (groupCount - 1)) / groupCount : 80
  const barW        = (groupW - BAR_GAP) / 2

  const maxVal = Math.max(
    ...points.flatMap(p => [p.incomePen, p.expensePen]),
    1
  )

  const toY = (v: number) =>
    CHART_PAD_B + CHART_H - (v / maxVal) * CHART_H

  const barHeight = (v: number) => (v / maxVal) * CHART_H

  const totalIncome  = points.reduce((s, p) => s + p.incomePen, 0)
  const totalExpense = points.reduce((s, p) => s + p.expensePen, 0)
  const netBalance   = points.reduce((s, p) => s + p.netPen, 0)

  if (points.length === 0) {
    return (
      <WidgetShell>
        <SectionHeader title="Flujo de caja" accent="#10b981"/>
        <div className="flex items-center justify-center h-[120px]">
          <p className="text-sm text-white/20">Sin datos de los últimos meses</p>
        </div>
      </WidgetShell>
    )
  }

  return (
    <WidgetShell>
      {/* Header + resumen */}
      <SectionHeader
        title="Flujo de caja · 6 meses"
        accent="#10b981"
        action={
          <span className={`text-[11px] font-bold tabular-nums ${
            netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {netBalance >= 0 ? '+' : ''}{formatCurrency(format(netBalance), preferred)}
          </span>
        }
      />

      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total ingresos', value: totalIncome,  color: 'text-emerald-400' },
          { label: 'Total egresos',  value: totalExpense, color: 'text-red-400' },
          { label: 'Balance neto',   value: netBalance,   color: netBalance >= 0 ? 'text-emerald-400' : 'text-red-400' },
        ].map(m => (
          <div key={m.label} className="text-center">
            <p className={`text-base font-bold tabular-nums ${m.color}`}>
              {formatCurrency(format(m.value), preferred)}
            </p>
            <p className="text-[10px] text-white/25 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Gráfico SVG */}
      <svg
        width="100%"
        viewBox={`0 0 ${viewW} ${CHART_H + CHART_PAD_B + 4}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          {/* Gradientes para las barras */}
          <linearGradient id="grad-income" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#10b981" stopOpacity="0.85"/>
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.40"/>
          </linearGradient>
          <linearGradient id="grad-expense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.75"/>
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.30"/>
          </linearGradient>
        </defs>

        {/* Líneas horizontales de referencia */}
        {[0.25, 0.5, 0.75, 1].map(frac => {
          const y = CHART_PAD_B + CHART_H * (1 - frac)
          return (
            <line
              key={frac}
              x1="0" y1={y} x2={viewW} y2={y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
          )
        })}

        {/* Barras por mes */}
        {points.map((point, i) => {
          const groupX = CHART_PAD_L + i * (groupW + GROUP_GAP)
          const incX   = groupX
          const expX   = groupX + barW + BAR_GAP
          const incH   = barHeight(point.incomePen)
          const expH   = barHeight(point.expensePen)
          const baseline = CHART_PAD_B + CHART_H

          // Etiqueta del mes: tomar las primeras 3 letras
          const monthLabel = point.monthLabel.slice(0, 3)

          return (
            <g key={point.month}>
              {/* Barra ingreso */}
              <rect
                x={incX}
                y={baseline - incH}
                width={barW}
                height={Math.max(incH, 2)}
                rx="2"
                fill="url(#grad-income)"
              />
              {/* Barra egreso */}
              <rect
                x={expX}
                y={baseline - expH}
                width={barW}
                height={Math.max(expH, 2)}
                rx="2"
                fill="url(#grad-expense)"
              />
              {/* Etiqueta mes (centrada bajo el grupo) */}
              <text
                x={groupX + groupW / 2}
                y={baseline + 14}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(255,255,255,0.25)"
                fontFamily="var(--font-body)"
              >
                {monthLabel}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Leyenda */}
      <div className="flex items-center gap-5 mt-2">
        <span className="flex items-center gap-1.5 text-[11px] text-white/35">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70 flex-shrink-0"/>
          Ingresos
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-white/35">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/60 flex-shrink-0"/>
          Egresos
        </span>
      </div>
    </WidgetShell>
  )
}
