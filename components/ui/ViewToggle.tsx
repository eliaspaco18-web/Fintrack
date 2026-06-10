'use client'

// =============================================================================
// components/ui/ViewToggle.tsx
// Toggle reutilizable para alternar entre vista lista y vista tarjetas.
// Usado en: Portafolio, Créditos, Activos, Presupuestos, CxC, CxP, Recurrentes
// =============================================================================

import { buttonClassName } from '@/components/ui/Button'

export type ViewMode = 'list' | 'cards'

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  id?: string
}

export function ViewToggle({ value, onChange, id }: ViewToggleProps) {
  const segmentBaseClassName = 'h-8 min-w-[2.125rem] rounded-md border-transparent px-2.5 shadow-none'

  return (
    <div
      id={id}
      className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] p-1 shadow-[0_1px_2px_rgba(25,25,23,0.04)]"
      role="radiogroup"
      aria-label="Modo de vista"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === 'list'}
        aria-label="Vista lista"
        onClick={() => onChange('list')}
        className={buttonClassName({
          variant: value === 'list' ? 'success' : 'ghost',
          size: 'sm',
          className: `${segmentBaseClassName} ${
          value === 'list'
            ? 'text-[var(--c-primary)]'
            : 'text-[var(--c-text-muted)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-text)]'
        }`,
        })}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="4" rx="1" />
          <rect x="3" y="12" width="18" height="4" rx="1" />
          <rect x="3" y="20" width="18" height="0" rx="0" />
          <path d="M3 14h18M3 6h18M3 10h18M3 18h18" />
        </svg>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'cards'}
        aria-label="Vista tarjetas"
        onClick={() => onChange('cards')}
        className={buttonClassName({
          variant: value === 'cards' ? 'success' : 'ghost',
          size: 'sm',
          className: `${segmentBaseClassName} ${
          value === 'cards'
            ? 'text-[var(--c-primary)]'
            : 'text-[var(--c-text-muted)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-text)]'
        }`,
        })}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </button>
    </div>
  )
}
