'use client'

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

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
  selectedFallbackLabel?: string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  sourceComplete?: boolean
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function filterAppSelectOptions(options: AppSelectOption[], query: string): AppSelectOption[] {
  const normalizedQuery = normalize(query.trim())
  if (!normalizedQuery) return options
  return options.filter(option =>
    normalize(`${option.label} ${option.hint ?? ''}`).includes(normalizedQuery),
  )
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
  selectedFallbackLabel = 'Selección anterior (sin cargar)',
  loading = false,
  error = null,
  onRetry,
  sourceComplete = true,
}: AppSelectProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selectId = useId()
  const panelId = `${selectId}-panel`
  const listboxId = `${selectId}-listbox`
  const [open, setOpen] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [announcement, setAnnouncement] = useState('')
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  const [v3Layer, setV3Layer] = useState(false)
  const exitTimerRef = useRef<number | null>(null)
  const exitGenerationRef = useRef(0)
  const settleTimerRef = useRef<number | null>(null)
  const pointerCommitRef = useRef<{ value: string; at: number } | null>(null)
  const [textSettling, setTextSettling] = useState(false)

  const selected = useMemo(
    () => options.find(option => option.value === value) ?? null,
    [options, value],
  )

  // V3 keeps one predictable searchable selection surface for every option count.
  // Retain the prop for existing callers; it no longer changes the V3 interaction.
  void searchable

  const filtered = useMemo(() => filterAppSelectOptions(options, query), [options, query])

  const close = useCallback((fromPointer = false) => {
    exitGenerationRef.current += 1
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
    setOpen(false)
    const animate = fromPointer && v3Layer && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (animate) {
      const generation = exitGenerationRef.current
      setExiting(true)
      exitTimerRef.current = window.setTimeout(() => {
        if (exitGenerationRef.current !== generation) return
        setExiting(false)
        setQuery('')
        setActiveIndex(-1)
        setPortalRoot(null)
        exitTimerRef.current = null
      }, 110)
      return
    }
    setExiting(false)
    setQuery('')
    setActiveIndex(-1)
    setPortalRoot(null)
  }, [v3Layer])

  useEffect(() => () => {
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current)
  }, [])

  useEffect(() => {
    const pending = pointerCommitRef.current
    if (!pending || pending.value !== value) return
    pointerCommitRef.current = null
    if (performance.now() - pending.at > 500) return
    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current)
    setTextSettling(true)
    settleTimerRef.current = window.setTimeout(() => {
      setTextSettling(false)
      settleTimerRef.current = null
    }, 120)
  }, [value])

  const openMenu = useCallback(() => {
    if (disabled) return
    exitGenerationRef.current += 1
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
    exitTimerRef.current = null
    setExiting(false)
    window.dispatchEvent(new CustomEvent('app-select:open', {
      detail: { id: selectId },
    }))
    setQuery('')
    setMenuStyle({ visibility: 'hidden' })
    setV3Layer(Boolean(wrapperRef.current?.closest('[data-ft-v3]')))
    setPortalRoot(wrapperRef.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body)
    setOpen(true)
  }, [disabled, selectId])

  const commitOption = useCallback((option: AppSelectOption, fromPointer = false) => {
    if (option.disabled) return
    pointerCommitRef.current = fromPointer && v3Layer && option.value !== value &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? { value: option.value, at: performance.now() }
      : null
    if (!pointerCommitRef.current) {
      if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
      setTextSettling(false)
    }
    onChange(option.value)
    setAnnouncement(`Seleccionado: ${option.label}`)
    close(fromPointer)
    triggerRef.current?.focus({ preventScroll: true })
  }, [close, onChange, v3Layer, value])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (!wrapperRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        close(true)
      }
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
        triggerRef.current?.focus({ preventScroll: true })
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    // Escape must close this layer before an enclosing RecordModal's focus trap.
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [close, open])

  useEffect(() => {
    const onSelectOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>
      if (customEvent.detail?.id === selectId) return
      close()
    }

    window.addEventListener('app-select:open', onSelectOpen as EventListener)
    return () => window.removeEventListener('app-select:open', onSelectOpen as EventListener)
  }, [close, selectId])

  useEffect(() => {
    if (!open || !portalRoot || menuStyle.visibility !== 'visible') return
    searchInputRef.current?.focus({ preventScroll: true })
  }, [open, portalRoot, menuStyle.visibility])

  useEffect(() => {
    if (!open || !portalRoot) return

    const positionMenu = () => {
      const trigger = triggerRef.current
      const menu = menuRef.current
      if (!trigger || !menu) return
      const viewport = window.visualViewport
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportWidth = viewport?.width ?? window.innerWidth
      const viewportHeight = viewport?.height ?? window.innerHeight
      const triggerRect = trigger.getBoundingClientRect()
      const isMobile = viewportWidth < 768
      const width = isMobile
        ? Math.max(0, viewportWidth - 16)
        : Math.min(400, Math.max(320, triggerRect.width), Math.max(0, viewportWidth - 24))
      const height = Math.min(menu.offsetHeight, Math.max(0, viewportHeight - 16))

      if (isMobile) {
        setMenuStyle({
          position: 'fixed',
          left: viewportLeft + 8,
          top: viewportTop + viewportHeight - height - 8,
          width,
          maxHeight: viewportHeight - 16,
          right: 'auto',
          marginTop: 0,
          visibility: 'visible',
          transformOrigin: 'bottom center',
        })
        return
      }

      const left = Math.max(viewportLeft + 12, Math.min(triggerRect.left, viewportLeft + viewportWidth - width - 12))
      const below = viewportTop + viewportHeight - triggerRect.bottom - 8
      const above = triggerRect.top - viewportTop - 8
      const flip = below < height && above > below
      const top = flip
        ? Math.max(viewportTop + 12, triggerRect.top - height - 8)
        : Math.min(triggerRect.bottom + 8, viewportTop + viewportHeight - height - 12)
      setMenuStyle({
        position: 'fixed', left, top, width, maxHeight: viewportHeight - 24,
        right: 'auto', marginTop: 0, visibility: 'visible',
        transformOrigin: flip ? 'bottom center' : 'top center',
      })
    }

    const frame = window.requestAnimationFrame(positionMenu)
    window.addEventListener('resize', positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    window.visualViewport?.addEventListener('resize', positionMenu)
    window.visualViewport?.addEventListener('scroll', positionMenu)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', positionMenu, true)
      window.visualViewport?.removeEventListener('resize', positionMenu)
      window.visualViewport?.removeEventListener('scroll', positionMenu)
    }
  }, [open, portalRoot, filtered.length, loading, error, sourceComplete])

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
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu()
    }
  }, [disabled, openMenu])

  const exitSelectionWithTab = useCallback((backward: boolean) => {
    const trigger = triggerRef.current
    const scope = wrapperRef.current?.closest<HTMLElement>('[role="dialog"]') ?? document
    const focusable = Array.from(scope.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(element => !menuRef.current?.contains(element) && element.getClientRects().length > 0)
    const triggerIndex = trigger ? focusable.indexOf(trigger) : -1
    const next = triggerIndex >= 0 ? focusable[triggerIndex + (backward ? -1 : 1)] : undefined
    close()
    const target = next ?? trigger
    target?.focus({ preventScroll: true })
  }, [close])

  const handleSearchKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      exitSelectionWithTab(event.shiftKey)
      return
    }
    if (loading || error) {
      return
    }
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
      return
    }
    if (query.length === 0 && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault()
      const indices = filtered.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0)
      setActiveIndex(event.key === 'Home' ? (indices[0] ?? -1) : (indices.at(-1) ?? -1))
    }
  }, [activeIndex, commitOption, error, exitSelectionWithTab, filtered, loading, moveActive, query.length])

  const triggerLabel = selected?.label ?? (value ? selectedFallbackLabel : placeholder)
  const triggerHint = selected?.hint
  const activeOptionId = !loading && !error && activeIndex >= 0 && filtered[activeIndex] && !filtered[activeIndex]?.disabled
    ? `${listboxId}-option-${activeIndex}`
    : undefined

  return (
    <div ref={wrapperRef} className={`app-select ${compact ? 'app-select-compact' : ''} ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        data-testid={testId}
        onClick={event => (open ? close(event.detail > 0) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`
          app-select-trigger field-base ui-pressable
          ${compact ? 'app-select-trigger-compact' : ''}
          ${open ? 'app-select-trigger-open' : ''}
          ${buttonClassName}
        `}
      >
        <span className="app-select-trigger-copy">
          <span className={`app-select-trigger-label ${selected || value ? '' : 'app-select-placeholder'} ${textSettling ? 'app-select-trigger-label-settle' : ''}`}>
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

      {(open || exiting) && portalRoot && createPortal(
        <div
          ref={menuRef}
          id={panelId}
          role="dialog"
          aria-hidden={exiting || undefined}
          aria-label={ariaLabel ?? 'Seleccionar opción'}
          aria-labelledby={ariaLabelledBy}
          data-ft-v3={v3Layer ? '' : undefined}
          style={menuStyle}
          className={`app-select-menu ${compact ? 'app-select-menu-compact' : ''} ${exiting ? 'app-select-menu-exit' : ''} ${menuClassName}`.trim()}
        >
          <div className="app-select-search-wrap">
            <input
              ref={searchInputRef}
              role="combobox"
              aria-label={ariaLabel ?? 'Buscar opciones'}
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={loading || error ? undefined : listboxId}
              aria-activedescendant={activeOptionId}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className="app-select-search"
            />
          </div>

          {loading ? (
            <div role="status" aria-live="polite" className="app-select-status">Cargando opciones…</div>
          ) : error ? (
            <div role="alert" className="app-select-status">
              <span>{error}</span>
              {onRetry && <button type="button" onClick={onRetry} className="app-select-retry">Reintentar</button>}
            </div>
          ) : (
            <div ref={listRef} id={listboxId} role="listbox" aria-label={ariaLabel ?? 'Opciones'} className="app-select-options">
              {filtered.length === 0 ? (
                <p className="app-select-empty">{options.length === 0 ? 'No hay opciones disponibles' : emptyText}</p>
              ) : filtered.map((option, index) => {
                const isSelected = option.value === value
                const isActive = index === activeIndex
                return (
                  <button
                    key={`${option.value}-${index}`}
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    tabIndex={-1}
                    data-option-index={index}
                    onMouseEnter={() => { if (!option.disabled) setActiveIndex(index) }}
                    onClick={event => commitOption(option, event.detail > 0)}
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
                      {isSelected && (
                        <svg className="app-select-option-check" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {!sourceComplete && !loading && !error && (
            <p className="app-select-coverage">Mostrando opciones cargadas; puede haber más resultados.</p>
          )}
        </div>,
        portalRoot,
      )}
      <span role="status" aria-live="polite" className="sr-only">{announcement}</span>
    </div>
  )
}
