'use client'

export interface V3ScopeChip {
  id: string
  label: string
  onRemove: () => void
}

export function V3ScopeChips({
  chips,
  onClearAll,
  label = 'Filtros aplicados',
}: {
  chips: V3ScopeChip[]
  onClearAll?: () => void
  label?: string
}) {
  if (chips.length === 0) return null

  return (
    <div className="ft-v3-scope-chips" data-ft-v3="" role="group" aria-label={label}>
      {chips.map(chip => (
        <span className="ft-v3-scope-chip" key={chip.id}>
          <span className="ft-v3-scope-chip-label">{chip.label}</span>
          <button
            type="button"
            className="ft-v3-scope-chip-remove"
            onClick={chip.onRemove}
            aria-label={`Quitar filtro: ${chip.label}`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      {onClearAll ? (
        <button type="button" className="ft-v3-scope-clear" onClick={onClearAll}>Limpiar todo</button>
      ) : null}
    </div>
  )
}
