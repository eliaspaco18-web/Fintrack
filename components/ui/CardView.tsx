'use client'

// =============================================================================
// components/ui/CardView.tsx
// Componente genérico de vista tarjetas para módulos.
// Renderiza una grilla de tarjetas con contenido personalizable via render props.
// =============================================================================

import { ReactNode } from 'react'

interface CardViewProps<T> {
  items: T[]
  keyExtractor: (item: T) => string
  renderCard: (item: T) => ReactNode
  emptyMessage?: string
  columns?: 1 | 2 | 3 | 4
  id?: string
}

export function CardView<T>({
  items,
  keyExtractor,
  renderCard,
  emptyMessage = 'No hay elementos para mostrar',
  columns = 3,
  id,
}: CardViewProps<T>) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-text-faint)]">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">{emptyMessage}</p>
      </div>
    )
  }

  const gridCols: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  }

  return (
    <div id={id} className={`grid ${gridCols[columns]} gap-4`}>
      {items.map((item) => (
        <div key={keyExtractor(item)}>{renderCard(item)}</div>
      ))}
    </div>
  )
}

// ─── Card Shell ─────────────────────────────────────────────────────────────
// Contenedor base para cada tarjeta individual, con hover y estilos consistentes.

interface CardShellProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  id?: string
}

export function CardShell({ children, onClick, className = '', id }: CardShellProps) {
  const interactive = onClick ? 'cursor-pointer' : ''

  return (
    <div
      id={id}
      onClick={onClick}
      className={`
        rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)]
        p-4 transition-all duration-150
        hover:border-[color:var(--color-border-hover)] hover:shadow-lg hover:shadow-black/10
        ${interactive} ${className}
      `.trim()}
    >
      {children}
    </div>
  )
}

// ─── Card Status Badge ──────────────────────────────────────────────────────

interface CardStatusProps {
  active: boolean
  activeLabel?: string
  inactiveLabel?: string
}

export function CardStatus({
  active,
  activeLabel = 'Activo',
  inactiveLabel = 'Desactivado',
}: CardStatusProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5
        text-[10px] font-bold uppercase tracking-wide
        ${active
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-red-500/10 text-red-400'
        }
      `.trim()}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}
