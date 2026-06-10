'use client'

// =============================================================================
// components/ui/ProgressBar.tsx
// Barra de progreso con porcentaje. Usada en:
// - Créditos (avance del crédito)
// - CxC (avance de cobro por deudor)
// - CxP (avance de pago por acreedor)
// - Presupuestos (ejecución del presupuesto)
// - Dashboard (widgets de uso de crédito)
// =============================================================================

interface ProgressBarProps {
  /** Valor actual */
  current: number
  /** Valor total / objetivo */
  total: number
  /** Color de la barra (CSS color). Si no se pasa, se calcula automáticamente */
  color?: string
  /** Si true, muestra el % excedido en rojo */
  allowOverflow?: boolean
  /** Tamaño de la barra */
  size?: 'sm' | 'md' | 'lg'
  /** Mostrar etiqueta de porcentaje */
  showLabel?: boolean
  /** Formato de etiqueta personalizada */
  labelFormat?: (current: number, total: number, pct: number) => string
  /** ID para testing */
  id?: string
}

export function ProgressBar({
  current,
  total,
  color,
  allowOverflow = false,
  size = 'md',
  showLabel = true,
  labelFormat,
  id,
}: ProgressBarProps) {
  const safeTotal = total > 0 ? total : 1
  const rawPct = (current / safeTotal) * 100
  const pct = allowOverflow ? rawPct : Math.min(rawPct, 100)
  const isExceeded = rawPct > 100

  // Color automático basado en progreso
  const barColor = color ?? (
    isExceeded ? '#ef4444' :       // Rojo si excedido
    pct >= 80 ? '#f59e0b' :        // Amarillo si ≥ 80%
    '#10b981'                       // Verde normal
  )

  const heights: Record<string, string> = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  }

  const displayPct = Math.round(rawPct * 10) / 10 // 1 decimal
  const label = labelFormat
    ? labelFormat(current, total, displayPct)
    : `${displayPct}%`

  return (
    <div id={id} className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-[10px] font-bold tabular-nums"
            style={{ color: barColor }}
          >
            {label}
          </span>
          {isExceeded && allowOverflow && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-red-400">
              Excedido
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full ${heights[size]} rounded-full overflow-hidden bg-[var(--color-surface-2)]`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 8px ${barColor}40`,
          }}
        />
      </div>
    </div>
  )
}
