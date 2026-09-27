import type { ReactNode } from 'react'

export type FinancialBasis = 'native' | 'report' | 'equivalent'

export interface FinancialScopeProps {
  title: string
  basis: FinancialBasis
  interval?: string
  asOf?: string
  exclusions?: readonly string[]
  unavailableSources?: readonly string[]
  children?: ReactNode
  className?: string
}

const basisLabel: Record<FinancialBasis, string> = {
  native: 'Moneda original de cada registro',
  report: 'Base del reporte',
  equivalent: 'Equivalencia según el cálculo actual',
}

/** The owner supplies source provenance; this component never invents an as-of date. */
export function FinancialScope({
  title,
  basis,
  interval,
  asOf,
  exclusions = [],
  unavailableSources = [],
  children,
  className = '',
}: FinancialScopeProps) {
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-[18px] text-[var(--ft-text-muted)] ${className}`.trim()}>
      <span>{title}</span>
      {interval ? <span>· {interval}</span> : null}
      <details className="group relative inline-block">
        <summary className="cursor-pointer list-none rounded-[var(--ft-radius-control)] px-1 font-semibold text-[var(--ft-primary)] outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--ft-primary)]">
          Alcance<span className="sr-only"> de {title}</span>
        </summary>
        <div className="absolute left-0 top-[calc(100%+8px)] z-[var(--ft-z-dropdown)] w-[min(320px,calc(100vw-32px))] rounded-[var(--ft-radius-menu)] border border-[var(--ft-border)] bg-[var(--ft-surface)] p-3 text-[12px] leading-[18px] text-[var(--ft-text-strong)] shadow-[var(--ft-shadow-menu)]">
          <p className="font-semibold">{basisLabel[basis]}</p>
          {interval ? <p className="mt-1">Período: {interval}</p> : null}
          {asOf ? <p className="mt-1">Última lectura: {asOf}</p> : null}
          {exclusions.length ? <p className="mt-2">No incluye: {exclusions.join(', ')}.</p> : null}
          {unavailableSources.length ? (
            <p className="mt-2 text-[var(--ft-warning)]">No disponible: {unavailableSources.join(', ')}.</p>
          ) : null}
          {children}
        </div>
      </details>
    </div>
  )
}
