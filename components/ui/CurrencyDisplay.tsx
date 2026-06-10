'use client'

// =============================================================================
// components/ui/CurrencyDisplay.tsx
// Muestra un monto con su equivalencia en otra moneda debajo.
// Usado en: Transacciones, Dashboard, Portafolio, Activos, CxC, CxP
// =============================================================================

import { formatWithSymbol, calculateEquivalence } from '@/lib/utils/currency-format'

interface CurrencyDisplayProps {
  /** Monto principal */
  amount: number
  /** Código de moneda del monto (ej: 'PEN', 'USD') */
  currency: string
  /** Tipo de cambio USD→PEN para calcular equivalencia */
  exchangeRate: number
  /** Tamaño del monto principal */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Color del monto (CSS class o color) */
  colorClass?: string
  /** Alineación */
  align?: 'left' | 'right' | 'center'
  /** Mostrar equivalencia */
  showEquivalence?: boolean
  /** ID para testing */
  id?: string
}

export function CurrencyDisplay({
  amount,
  currency,
  exchangeRate,
  size = 'md',
  colorClass = 'text-[var(--color-text)]',
  align = 'left',
  showEquivalence = true,
  id,
}: CurrencyDisplayProps) {
  const formatted = formatWithSymbol(amount, currency)
  const equivalence = showEquivalence && exchangeRate > 0
    ? calculateEquivalence(amount, currency, exchangeRate)
    : null

  const sizeStyles: Record<string, string> = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-bold',
    lg: 'text-lg font-bold',
    xl: 'text-2xl font-bold',
  }

  const alignStyles: Record<string, string> = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
  }

  return (
    <div id={id} className={alignStyles[align]}>
      <p className={`${sizeStyles[size]} tabular-nums ${colorClass}`}>
        {formatted}
      </p>
      {equivalence && (
        <p className="text-[11px] tabular-nums text-[var(--color-text-muted)] mt-0.5">
          {equivalence.text}
        </p>
      )}
    </div>
  )
}

// ─── Inline variant (for table cells) ───────────────────────────────────────

interface CurrencyInlineProps {
  amount: number
  currency: string
  exchangeRate?: number
  colorClass?: string
  id?: string
}

export function CurrencyInline({
  amount,
  currency,
  exchangeRate,
  colorClass = 'text-[var(--color-text)]',
  id,
}: CurrencyInlineProps) {
  const formatted = formatWithSymbol(amount, currency)
  const equivalence = exchangeRate && exchangeRate > 0
    ? calculateEquivalence(amount, currency, exchangeRate)
    : null

  return (
    <span id={id} className="inline-flex flex-col">
      <span className={`text-sm font-semibold tabular-nums ${colorClass}`}>
        {formatted}
      </span>
      {equivalence && (
        <span className="text-[10px] tabular-nums text-[var(--color-text-muted)]">
          {equivalence.text}
        </span>
      )}
    </span>
  )
}
