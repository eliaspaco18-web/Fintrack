'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  calendarMonthDays,
  formatIsoDateForDisplay,
  moveCalendarMonth,
  parseDisplayDateToIso,
  parseIsoCalendarDate,
  toIsoCalendarDate,
} from '@/modules/transactions/income-date'
import styles from './IncomeDatePicker.module.css'

type Props = {
  value: string
  onChange: (value: string) => void
  onInvalidInput: (message: string | null) => void
  error?: string
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const CALENDAR_WEEK_ROWS = 6
type CalendarView = { year: number; month: number }
type CalendarMotion = { revision: number; direction: 'forward' | 'backward' }
const MONTHS = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat('es-PE', {
  month: 'long',
  timeZone: 'UTC',
}).format(new Date(Date.UTC(2026, month, 1))))

function localTodayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function dateParts(value: string): { year: number; month: number } | null {
  const date = parseIsoCalendarDate(value)
  return date ? { year: date.getUTCFullYear(), month: date.getUTCMonth() } : null
}

export function IncomeDatePicker({ value, onChange, onInvalidInput, error }: Props) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number; width: number; height: number; maxHeight: number; constrained: boolean } | null>(null)
  const lastAnchorRectRef = useRef<{ top: number; right: number; bottom: number; left: number; width: number; height: number } | null>(null)
  const desiredHeightRef = useRef<number | null>(null)
  const panelHeightRef = useRef<number | null>(null)
  const placementRef = useRef<'above' | 'below' | null>(null)
  const gridAnimationRef = useRef<Animation | null>(null)
  const [inputValue, setInputValue] = useState(() => formatIsoDateForDisplay(value))
  const today = localTodayIso()
  const selected = dateParts(value)
  const currentView = selected ?? dateParts(today)!
  const [view, setView] = useState(currentView)
  const viewRef = useRef(currentView)
  const [gridMotion, setGridMotion] = useState<CalendarMotion>({ revision: 0, direction: 'forward' })
  const days = useMemo(() => calendarMonthDays(view.year, view.month), [view.month, view.year])
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const from = Math.min(currentYear - 30, view.year - 2)
    const through = Math.max(currentYear + 10, view.year + 2)
    return Array.from({ length: through - from + 1 }, (_, index) => from + index)
  }, [view.year])
  const activeDate = value || today

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setInputValue(formatIsoDateForDisplay(value))
    const parts = dateParts(value)
    if (parts) {
      viewRef.current = parts
      setView(parts)
    }
  }, [value])

  const navigateView = useCallback((next: CalendarView | ((current: CalendarView) => CalendarView)) => {
    const previous = viewRef.current
    const resolved = typeof next === 'function' ? next(previous) : next
    if (resolved.year === previous.year && resolved.month === previous.month) return
    const previousIndex = previous.year * 12 + previous.month
    const nextIndex = resolved.year * 12 + resolved.month
    viewRef.current = resolved
    setView(resolved)
    setGridMotion(current => ({
      revision: current.revision + 1,
      direction: nextIndex > previousIndex ? 'forward' : 'backward',
    }))
  }, [])

  const close = useCallback((restoreFocus = false) => {
    gridAnimationRef.current?.cancel()
    gridAnimationRef.current = null
    setOpen(false)
    setPosition(null)
    setPortalRoot(null)
    lastAnchorRectRef.current = null
    desiredHeightRef.current = null
    panelHeightRef.current = null
    placementRef.current = null
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  const updatePosition = useCallback((force = false) => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return
    const rect = trigger.getBoundingClientRect()
    const lastRect = lastAnchorRectRef.current
    if (!force && lastRect &&
      lastRect.top === rect.top &&
      lastRect.right === rect.right &&
      lastRect.bottom === rect.bottom &&
      lastRect.left === rect.left &&
      lastRect.width === rect.width &&
      lastRect.height === rect.height) {
      return
    }
    lastAnchorRectRef.current = {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    }
    const inset = 8
    const gap = 6
    const width = Math.min(296, window.innerWidth - inset * 2)
    const left = Math.max(inset, Math.min(rect.left, window.innerWidth - width - inset))
    const viewportTop = window.visualViewport?.offsetTop ?? 0
    const viewportBottom = Math.min(
      window.innerHeight,
      viewportTop + (window.visualViewport?.height ?? window.innerHeight),
    )
    const safeTop = Math.max(inset, viewportTop + inset)
    const safeBottom = Math.max(safeTop, viewportBottom - inset)
    const modalBody = trigger.closest<HTMLElement>('[role="dialog"]')
      ?.querySelector<HTMLElement>('[data-record-modal-body="true"]')
    const bodyRect = modalBody?.getBoundingClientRect()
    if (bodyRect) {
      const visibleBodyTop = Math.max(safeTop, bodyRect.top)
      const visibleBodyBottom = Math.min(safeBottom, bodyRect.bottom)
      if (rect.bottom <= visibleBodyTop || rect.top >= visibleBodyBottom) {
        // The anchor has left the visible, scrollable form. Closing is more
        // predictable than progressively shrinking a detached calendar.
        close()
        return
      }
    }
    // The portal is outside the scrolling body, so use its visible top as the
    // upper boundary. This keeps an upward-opening calendar below the sticky
    // modal header instead of painting over the title.
    const safeModalTop = Math.max(safeTop, bodyRect === undefined ? safeTop : bodyRect.top + 4)
    const safeModalBottom = Math.min(safeBottom, bodyRect === undefined ? safeBottom : bodyRect.bottom - 4)
    const spaceBelow = Math.max(0, safeModalBottom - rect.bottom - gap)
    const spaceAbove = Math.max(0, rect.top - gap - safeModalTop)
    const daysGrid = panel.querySelector<HTMLElement>('[data-calendar-grid="true"]')
    if (!daysGrid) return
    const panelStyle = getComputedStyle(panel)
    const fixedRows = ['[data-calendar-header="true"]', '[data-calendar-weekdays="true"]', '[data-calendar-footer="true"]']
      .map(selector => panel.querySelector<HTMLElement>(selector)?.getBoundingClientRect().height ?? 0)
    const verticalChrome = fixedRows.reduce((total, height) => total + height, 0) +
      Number.parseFloat(panelStyle.rowGap || '0') * 3 +
      Number.parseFloat(panelStyle.paddingTop || '0') +
      Number.parseFloat(panelStyle.paddingBottom || '0') +
      Number.parseFloat(panelStyle.borderTopWidth || '0') +
      Number.parseFloat(panelStyle.borderBottomWidth || '0')
    const daysStyle = getComputedStyle(daysGrid)
    const explicitRowHeight = Number.parseFloat(daysStyle.gridTemplateRows)
    const weekHeight = Number.isFinite(explicitRowHeight)
      ? explicitRowHeight
      : Number.parseFloat(daysStyle.gridAutoRows)
    const intrinsicDaysHeight = weekHeight * CALENDAR_WEEK_ROWS +
      Number.parseFloat(daysStyle.rowGap || '0') * (CALENDAR_WEEK_ROWS - 1)
    // Derive the calendar's full date-grid size from its explicit CSS row
    // track, never from scrollHeight/clientHeight or transient row geometry.
    // Those measurements reflect a previously constrained panel and can
    // feed its reduced size back into the next positioning pass.
    const measuredDesiredHeight = Math.min(Math.ceil(verticalChrome + intrinsicDaysHeight + 1), 344)
    const desiredHeight = desiredHeightRef.current ?? measuredDesiredHeight
    desiredHeightRef.current = desiredHeight
    const safeAreaHeight = Math.max(0, safeModalBottom - safeModalTop)
    if (!placementRef.current) {
      placementRef.current = spaceBelow >= desiredHeight
        ? 'below'
        : spaceAbove >= desiredHeight
          ? 'above'
          : spaceBelow >= spaceAbove ? 'below' : 'above'
    }
    const placementSpace = placementRef.current === 'above' ? spaceAbove : spaceBelow
    // On a compact viewport, reserve as much of the chosen side as is safely
    // available and scroll only the date grid. Pin this height for the open
    // session so navigating between months cannot resize or reorient it.
    if (panelHeightRef.current === null || force) {
      panelHeightRef.current = Math.floor(Math.min(desiredHeight, safeAreaHeight, placementSpace))
    }
    const panelHeight = panelHeightRef.current
    if (panelHeight < 160) {
      close()
      return
    }
    const maxHeight = panelHeight
    const preferredTop = placementRef.current === 'above' ? rect.top - panelHeight - gap : rect.bottom + gap
    const top = Math.max(safeModalTop, Math.min(preferredTop, safeModalBottom - panelHeight))
    setPosition({ top, left, width, height: panelHeight, maxHeight, constrained: panelHeight < desiredHeight })
  }, [close])

  const show = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const focusScope = trigger.closest<HTMLElement>('[data-app-select-portal-root]')
    lastAnchorRectRef.current = null
    desiredHeightRef.current = null
    panelHeightRef.current = null
    placementRef.current = null
    setPortalRoot(focusScope ?? document.body)
    setOpen(true)
  }, [])

  useLayoutEffect(() => {
    if (!open || !portalRoot) return
    // Wait for the portal's CSS grid tracks to settle before measuring. The
    // first synchronous layout can report a transient row size and cause a
    // one-pixel resize on the first subsequent scroll.
    const initialPositionFrame = window.requestAnimationFrame(() => updatePosition(true))
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      close()
    }
    const onScroll = () => updatePosition()
    const onViewportChange = () => updatePosition(true)
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onScroll, true)
    window.visualViewport?.addEventListener('resize', onViewportChange)
    window.visualViewport?.addEventListener('scroll', onViewportChange)
    return () => {
      window.cancelAnimationFrame(initialPositionFrame)
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onScroll, true)
      window.visualViewport?.removeEventListener('resize', onViewportChange)
      window.visualViewport?.removeEventListener('scroll', onViewportChange)
    }
  }, [close, open, portalRoot, updatePosition])

  useLayoutEffect(() => {
    if (gridMotion.revision === 0) return
    const grid = panelRef.current?.querySelector<HTMLElement>('[data-calendar-grid="true"]')
    if (!grid || typeof grid.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gridAnimationRef.current?.cancel()
    const offset = gridMotion.direction === 'forward' ? 8 : -8
    gridAnimationRef.current = grid.animate([
      { opacity: 0.58, transform: `translateX(${offset}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ], {
      duration: 160,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    })
    return () => {
      gridAnimationRef.current?.cancel()
      gridAnimationRef.current = null
    }
  }, [gridMotion])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLButtonElement>(`[data-calendar-date="${activeDate}"]`)?.focus())
  }, [activeDate, open])

  const selectDate = useCallback((iso: string) => {
    onChange(iso)
    onInvalidInput(null)
    setInputValue(formatIsoDateForDisplay(iso))
    close(true)
  }, [close, onChange, onInvalidInput])

  const moveFocus = useCallback((iso: string, delta: number) => {
    const date = parseIsoCalendarDate(iso)
    if (!date) return
    date.setUTCDate(date.getUTCDate() + delta)
    const nextIso = toIsoCalendarDate(date)
    const parts = dateParts(nextIso)
    if (parts) navigateView(parts)
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLButtonElement>(`[data-calendar-date="${nextIso}"]`)?.focus())
  }, [navigateView])

  const handleDayKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, iso: string) => {
    const date = parseIsoCalendarDate(iso)
    const weekday = date ? (date.getUTCDay() + 6) % 7 : 0
    const offset = event.key === 'ArrowRight' ? 1
      : event.key === 'ArrowLeft' ? -1
        : event.key === 'ArrowDown' ? 7
          : event.key === 'ArrowUp' ? -7
            : event.key === 'Home' ? -weekday
              : event.key === 'End' ? 6 - weekday
                : null
    if (offset !== null) {
      event.preventDefault()
      moveFocus(iso, offset)
      return
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      const amount = (event.shiftKey ? 12 : 1) * (event.key === 'PageUp' ? -1 : 1)
      navigateView(current => moveCalendarMonth(current.year, current.month, amount))
    }
  }

  const commitManualDate = () => {
    if (!inputValue.trim()) {
      onInvalidInput(null)
      return
    }
    const iso = parseDisplayDateToIso(inputValue)
    if (!iso) {
      onChange('')
      onInvalidInput('Ingresa una fecha válida en formato DD/MM/AAAA.')
      return
    }
    onChange(iso)
    onInvalidInput(null)
    setInputValue(formatIsoDateForDisplay(iso))
  }

  return (
    <div className={styles.picker}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={inputValue}
        placeholder="DD/MM/AAAA"
        aria-label="Fecha del ingreso, día, mes y año"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        autoComplete="off"
        className={styles.input}
        data-testid="transaction-date-input"
        onChange={event => {
          const next = event.target.value
          setInputValue(next)
          const parsed = parseDisplayDateToIso(next)
          onChange(parsed ?? '')
          onInvalidInput(null)
        }}
        onBlur={commitManualDate}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commitManualDate()
          }
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            show()
          }
        }}
      />
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={open ? 'Cerrar calendario' : 'Abrir calendario'}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? `${id}-calendar` : undefined}
        onClick={() => open ? close() : show()}
        onKeyDown={event => {
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            event.stopPropagation()
            close(true)
          }
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="4.5" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6.5 2.8v3.4M13.5 2.8v3.4M3.5 8h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {error ? <span id={`${id}-error`} className={styles.error} role="alert">{error}</span> : null}

      {open && portalRoot ? createPortal(
        <div
          ref={panelRef}
          id={`${id}-calendar`}
          role="dialog"
          aria-label="Seleccionar fecha"
          className={styles.popover}
          style={position ? {
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: position.width,
            height: position.height,
            maxHeight: position.maxHeight,
          } : {
            position: 'fixed',
            top: 0,
            left: 8,
            width: 'min(296px, calc(100vw - 16px))',
            visibility: 'hidden',
            pointerEvents: 'none',
          }}
          data-constrained={position?.constrained ? 'true' : 'false'}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              close(true)
            }
          }}
        >
          <div className={styles.header} data-calendar-header="true">
            <button type="button" className={styles.arrow} aria-label="Mes anterior" onClick={() => navigateView(current => moveCalendarMonth(current.year, current.month, -1))}>‹</button>
            <div className={styles.selectors}>
              <select aria-label="Mes" value={view.month} onChange={event => navigateView(current => ({ ...current, month: Number(event.target.value) }))}>
                {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
              </select>
              <select aria-label="Año" value={view.year} onChange={event => navigateView(current => ({ ...current, year: Number(event.target.value) }))}>
                {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <button type="button" className={styles.arrow} aria-label="Mes siguiente" onClick={() => navigateView(current => moveCalendarMonth(current.year, current.month, 1))}>›</button>
          </div>
          <div className={styles.weekdays} role="row" data-calendar-weekdays="true">
            {WEEKDAYS.map((weekday, index) => <span role="columnheader" aria-label={['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][index]} key={weekday}>{weekday}</span>)}
          </div>
          <div className={styles.days} role="grid" aria-label={`${MONTHS[view.month]} ${view.year}`} data-calendar-grid="true">
            {Array.from({ length: days.length / 7 }, (_, row) => (
              <div role="row" className={styles.week} key={`week-${row}`}>
                {days.slice(row * 7, row * 7 + 7).map(date => {
                  const iso = toIsoCalendarDate(date)
                  const inMonth = date.getUTCMonth() === view.month
                  const activeIsInView = dateParts(activeDate)?.year === view.year && dateParts(activeDate)?.month === view.month
                  const tabStop = inMonth && (iso === activeDate || (!activeIsInView && date.getUTCDate() === 1))
                  return (
                    <div role="gridcell" key={iso} aria-selected={iso === value}>
                      <button
                        type="button"
                        data-calendar-date={iso}
                        aria-label={new Intl.DateTimeFormat('es-PE', { dateStyle: 'full', timeZone: 'UTC' }).format(date)}
                        aria-current={iso === today ? 'date' : undefined}
                        aria-pressed={iso === value}
                        tabIndex={tabStop ? 0 : -1}
                        data-outside-month={!inMonth ? 'true' : undefined}
                        data-today={iso === today ? 'true' : undefined}
                        data-selected={iso === value ? 'true' : undefined}
                        className={styles.day}
                        onClick={() => selectDate(iso)}
                        onKeyDown={event => handleDayKeyDown(event, iso)}
                      >{date.getUTCDate()}</button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div className={styles.footer} data-calendar-footer="true">
            <span>{value ? formatIsoDateForDisplay(value) : 'Sin fecha seleccionada'}</span>
            <button type="button" onClick={() => selectDate(today)}>Hoy</button>
          </div>
        </div>,
        portalRoot,
      ) : null}
    </div>
  )
}
