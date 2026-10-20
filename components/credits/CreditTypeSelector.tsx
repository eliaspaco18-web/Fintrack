'use client'

// =============================================================================
// components/credits/CreditTypeSelector.tsx
// PRD v3 — Selector de tipo: Tarjeta de Crédito | Crédito Bancario
// =============================================================================

import type { CreditMode } from '@/components/credits/CreditsWorkspace'

interface CreditTypeSelectorProps {
  onSelect: (mode: CreditMode) => void
}

const CREDIT_TYPES: Array<{
  mode: CreditMode
  title: string
  description: string
  microcopy: string
  toneClass: string
  icon: React.ReactNode
}> = [
  {
    mode: 'CARD',
    title: 'Tarjeta de crédito',
    description: 'Registra la línea disponible y el consumo actual de tu tarjeta.',
    microcopy: 'Límite, consumo actual y ciclos de facturación.',
    toneClass: 'border-[var(--ft-info)]/20 bg-[var(--ft-info-soft)] text-[var(--ft-info)]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="2" y="6" width="20" height="13" rx="2"/>
        <path d="M2 10h20"/>
        <path d="M6 14h3"/>
      </svg>
    ),
  },
  {
    mode: 'BANK',
    title: 'Crédito bancario',
    description: 'Registra el desembolso y la estructura base de un préstamo.',
    microcopy: 'Desembolso, cuotas y cronograma de pagos.',
    toneClass: 'border-[var(--ft-warning)]/20 bg-[var(--ft-warning-soft)] text-[var(--ft-warning)]',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
]

export function CreditTypeSelector({ onSelect }: CreditTypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {CREDIT_TYPES.map(type => (
        <button
          key={type.mode}
          type="button"
          onClick={() => onSelect(type.mode)}
          data-testid={type.mode === 'CARD' ? 'credit-type-card-button' : 'credit-type-bank-button'}
          className={`
            ui-pressable group flex min-w-0 items-start gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-4 py-4 text-left
            font-[Manrope] transition-[border-color,background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]
            hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-muted)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)] motion-reduce:transition-none
          `}
        >
          <span
            className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ft-form-radius-sm)] border ${type.toneClass}`}
          >
            {type.icon}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold leading-5 tracking-[-0.01em] text-[var(--ft-text-strong)]">{type.title}</p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--ft-text-muted)]">{type.description}</p>
            <p className="mt-2 text-[11px] font-medium leading-[1.45] text-[var(--ft-text-subtle)]">
              {type.microcopy}
            </p>
          </div>
          <svg
            className="ml-auto mt-1 shrink-0 text-[var(--ft-text-subtle)] transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      ))}
    </div>
  )
}
