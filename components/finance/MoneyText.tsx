import type { HTMLAttributes } from 'react'
import {
  formatV3Money,
  type MoneyDisplayInput,
} from '@/lib/finance/v3-money-display'

export interface MoneyTextProps extends MoneyDisplayInput, Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Already-verified presentation amount; no rate is calculated here. */
  equivalent?: MoneyDisplayInput & { provenance?: string }
  compactUnavailable?: boolean
}

export function MoneyText({
  value,
  currency,
  availability,
  direction = 'neutral',
  precision,
  equivalent,
  compactUnavailable = false,
  className = '',
  ...spanProps
}: MoneyTextProps) {
  const display = formatV3Money({ value, currency, availability, direction, precision })
  const equivalentDisplay = equivalent ? formatV3Money(equivalent) : null
  const directionColor = display.availability === 'available' && value !== 0
    ? direction === 'income' ? 'var(--ft-success)'
      : direction === 'expense' ? 'var(--ft-danger)'
        : 'var(--ft-text-strong)'
    : 'var(--ft-text-strong)'

  return (
    <span
      {...spanProps}
      className={`inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 tabular-nums lining-nums ${className}`.trim()}
      style={{ color: directionColor, ...spanProps.style }}
    >
      <span className="whitespace-nowrap">{display.text}</span>
      {display.reason && !compactUnavailable ? (
        <span className="text-[11px] font-normal text-[var(--ft-text-muted)]">{display.reason}</span>
      ) : null}
      {equivalentDisplay && equivalentDisplay.availability !== 'unavailable' ? (
        <span className="text-[11px] font-normal text-[var(--ft-text-muted)]">
          ≈ {equivalentDisplay.text}
          {equivalent?.provenance ? ` · ${equivalent.provenance}` : ' · procedencia no disponible'}
        </span>
      ) : null}
    </span>
  )
}
