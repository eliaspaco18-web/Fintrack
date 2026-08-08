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
  const segmentBaseClassName = 'h-8 min-w-8 rounded-control border-transparent px-2.5 shadow-none focus-visible:ring-offset-[var(--ft-surface-muted)]'

  return (
    <div
      id={id}
      className="inline-flex items-center gap-1 rounded-surface border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-1 shadow-elevation-sm"
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
            ? 'text-[var(--ft-primary)]'
            : 'text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)]'
        }`,
        })}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            ? 'text-[var(--ft-primary)]'
            : 'text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)]'
        }`,
        })}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </button>
    </div>
  )
}
