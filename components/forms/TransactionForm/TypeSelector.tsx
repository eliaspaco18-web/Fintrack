// =============================================================================
// components/forms/TransactionForm/TypeSelector.tsx
// Selector de tipo de transacción. Tres botones pill con indicador animado.
// El color del formulario completo cambia según el tipo seleccionado.
// =============================================================================

'use client'

import type { TransactionFormValues } from '@/lib/contracts/ui.contracts'

type TxType = TransactionFormValues['type']

interface TypeConfig {
  label:        string
  description:  string
  activeClass:  string
  dotColor:     string
  accentColor:  string
}

export const TYPE_CONFIG: Record<TxType, TypeConfig> = {
  INCOME: {
    label:       'Ingreso',
    description: 'Dinero que entra a tu cuenta',
    activeClass: 'bg-emerald-500/12 border-emerald-500/30 text-emerald-400',
    dotColor:    'bg-emerald-500',
    accentColor: '#10b981',
  },
  EXPENSE: {
    label:       'Egreso',
    description: 'Dinero que sale de tu cuenta',
    activeClass: 'bg-red-500/12 border-red-500/30 text-red-400',
    dotColor:    'bg-red-500',
    accentColor: '#ef4444',
  },
  TRANSFER: {
    label:       'Transferencia',
    description: 'Entre tus propias cuentas',
    activeClass: 'bg-blue-500/12 border-blue-500/30 text-blue-400',
    dotColor:    'bg-blue-500',
    accentColor: '#3b82f6',
  },
}

interface TypeSelectorProps {
  value:    TxType
  onChange: (type: TxType) => void
  disabled?: boolean
}

export function TypeSelector({ value, onChange, disabled }: TypeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[var(--color-surface)] border border-[color:var(--color-border)]">
      {(Object.entries(TYPE_CONFIG) as [TxType, TypeConfig][]).map(([type, cfg]) => {
        const active = value === type
        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type)}
            className={`
              relative flex flex-col items-center justify-center
              px-2 py-3 rounded-lg border
              text-center transition-all duration-200
              disabled:opacity-40 disabled:cursor-not-allowed
              ${active
                ? cfg.activeClass
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
              }
            `}
          >
            {active && (
              <span
                className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${cfg.dotColor}`}
              />
            )}
            <span className="text-xs font-bold tracking-wide">{cfg.label}</span>
            <span className={`
              text-[10px] mt-0.5 leading-tight hidden sm:block
              ${active ? 'opacity-60' : 'opacity-0'}
            `}>
              {cfg.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Retorna el color de acento del tipo actual para colorear elementos del form */
export function useTypeAccent(type: TxType): string {
  return TYPE_CONFIG[type].accentColor
}
