'use client'

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export type AppSelectOption = {
  value: string
  label: string
  hint?: string
  disabled?: boolean
  icon?: ReactNode
}

interface AppSelectProps {
  options: AppSelectOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  placeholder?: string
  disabled?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  buttonClassName?: string
  menuClassName?: string
  testId?: string
  compact?: boolean
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function AppSelect({
  options,
  value,
  onChange,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  placeholder = 'Seleccionar...',
  disabled = false,
  searchable,
  searchPlaceholder = 'Buscar...',
  emptyText = 'Sin resultados',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  testId,
  compact = false,
}: AppSelectProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selectIdRef = useRef(`app-select-${Math.random().toString(36).slice(2, 10)}`)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const selected = useMemo(
    () => options.find(option => option.value === value) ?? null,
    [options, value],
  )

  const canSearch = (searchable ?? options.length >= 6) && options.length > 0

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return options
    return options.filter(option => {
      const haystack = `${option.label} ${option.hint ?? ''}`
      return normalize(haystack).includes(q)
    })
  }, [options, query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActiveIndex(-1)
  }, [])

  const openMenu = useCallback(() => {
    if (disabled) return
    window.dispatchEvent(new CustomEvent('app-select:open', {
      detail: { id: selectIdRef.current },
    }))
    setOpen(true)
  }, [disabled])

  const commitOption = useCallback((option: AppSelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    close()
  }, [close, onChange])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (!wrapperRef.current?.contains(target)) {
        close()
      }
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [close, open])

  useEffect(() => {
    const onSelectOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>
      if (customEvent.detail?.id === selectIdRef.current) return
      close()
    }

    window.addEventListener('app-select:open', onSelectOpen as EventListener)
    return () => window.removeEventListener('app-select:open', onSelectOpen as EventListener)
  }, [close])

  useEffect(() => {
    if (!open || !canSearch) return
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 16)
    return () => window.clearTimeout(timer)
  }, [canSearch, open])

  useEffect(() => {
    if (!open) return
    if (filtered.length === 0) {
      setActiveIndex(-1)
      return
    }

    const selectedIndex = filtered.findIndex(option => option.value === value && !option.disabled)
    if (selectedIndex >= 0) {
      setActiveIndex(selectedIndex)
      return
    }

    const firstEnabled = filtered.findIndex(option => !option.disabled)
    setActiveIndex(firstEnabled)
  }, [filtered, open, value])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const container = listRef.current
    const item = container?.querySelector<HTMLButtonElement>(`[data-option-index="${activeIndex}"]`)
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const moveActive = useCallback((direction: 1 | -1) => {
    if (filtered.length === 0) return
    let next = activeIndex
    for (let i = 0; i < filtered.length; i += 1) {
      next = (next + direction + filtered.length) % filtered.length
      if (!filtered[next]?.disabled) {
        setActiveIndex(next)
        return
      }
    }
  }, [activeIndex, filtered])

  const handleTriggerKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMenu()
    }
  }, [disabled, openMenu])

  const handleListKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (activeIndex >= 0 && filtered[activeIndex]) {
        commitOption(filtered[activeIndex]!)
      }
    }
  }, [activeIndex, commitOption, filtered, moveActive])

  const triggerLabel = selected?.label ?? placeholder
  const triggerHint = selected?.hint

  return (
    <div ref={wrapperRef} className={`app-select ${compact ? 'app-select-compact' : ''} ${className}`.trim()}>
      <button
        type="button"
        data-testid={testId}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`
          app-select-trigger field-base ui-pressable
          ${compact ? 'app-select-trigger-compact' : ''}
          ${open ? 'app-select-trigger-open' : ''}
          ${buttonClassName}
        `}
      >
        <span className="app-select-trigger-copy">
          <span className={`app-select-trigger-label ${selected ? '' : 'app-select-placeholder'}`}>
            {triggerLabel}
          </span>
          {triggerHint && (
            <span className="app-select-trigger-hint">{triggerHint}</span>
          )}
        </span>
        <span className={`app-select-chevron ${open ? 'app-select-chevron-open' : ''}`} aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          className={`app-select-menu ${compact ? 'app-select-menu-compact' : ''} ${menuClassName}`.trim()}
        >
          {canSearch && (
            <div className="app-select-search-wrap">
              <input
                ref={searchInputRef}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="app-select-search"
              />
            </div>
          )}

          <div ref={listRef} className="app-select-options">
            {filtered.length === 0 ? (
              <p className="app-select-empty">{emptyText}</p>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === value
                const isActive = index === activeIndex
                return (
                  <button
                    key={`${option.value}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-option-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commitOption(option)}
                    disabled={option.disabled}
                    className={`
                      app-select-option
                      ${isSelected ? 'app-select-option-selected' : ''}
                      ${isActive ? 'app-select-option-active' : ''}
                      ${option.disabled ? 'app-select-option-disabled' : ''}
                    `}
                  >
                    <span className="app-select-option-row">
                      {option.icon && <span className="app-select-option-icon">{option.icon}</span>}
                      <span className="app-select-option-copy">
                        <span className="app-select-option-label">{option.label}</span>
                        {option.hint && <span className="app-select-option-hint">{option.hint}</span>}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
