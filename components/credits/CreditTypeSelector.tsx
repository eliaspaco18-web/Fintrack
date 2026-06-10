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
  color: string
  bgColor: string
  icon: React.ReactNode
}> = [
  {
    mode: 'CARD',
    title: 'Tarjeta de crédito',
    description: 'Registra la línea disponible y el consumo actual de tu tarjeta.',
    microcopy: 'Límite, consumo actual y ciclos de facturación.',
    color: '#0ea5e9',
    bgColor: 'border-[rgba(66,111,159,0.18)] bg-[var(--c-info-soft)]',
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
    color: '#f59e0b',
    bgColor: 'border-[rgba(169,120,47,0.18)] bg-[var(--c-warning-soft)]',
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
            ui-pressable group flex items-start gap-4 rounded-[20px] border px-4 py-4 text-left
            transition-[border-color,background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]
            hover:border-[var(--c-border-hover)] hover:shadow-[0_10px_24px_rgba(25,25,23,0.08)]
            ${type.bgColor}
          `}
        >
          <span
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${type.color}18`, color: type.color }}
          >
            {type.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-[-0.01em] text-[var(--c-text)]">{type.title}</p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">{type.description}</p>
            <p className="mt-2 text-[11px] font-medium leading-[1.45] text-[var(--c-text-faint)]">
              {type.microcopy}
            </p>
          </div>
          <svg
            className="ml-auto mt-1 shrink-0 text-[var(--c-text-faint)] transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      ))}
    </div>
  )
}
