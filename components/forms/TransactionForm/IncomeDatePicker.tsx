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
  const [inputValue, setInputValue] = useState(() => formatIsoDateForDisplay(value))
  const today = localTodayIso()
  const selected = dateParts(value)
  const currentView = selected ?? dateParts(today)!
  const [view, setView] = useState(currentView)
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
    if (parts) setView(parts)
  }, [value])

  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    setPosition(null)
    setPortalRoot(null)
    lastAnchorRectRef.current = null
    desiredHeightRef.current = null
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
    const weekCount = daysGrid.querySelectorAll(':scope > [role="row"]').length
    const weekHeight = Number.parseFloat(daysStyle.gridAutoRows)
    const intrinsicDaysHeight = weekHeight * weekCount +
      Number.parseFloat(daysStyle.rowGap || '0') * Math.max(0, weekCount - 1)
    // Derive the calendar's full date-grid size from its explicit CSS row
    // track, never from scrollHeight/clientHeight or transient row geometry.
    // Those measurements reflect a previously constrained panel and can
    // feed its reduced size back into the next positioning pass.
    const measuredDesiredHeight = Math.min(Math.ceil(verticalChrome + intrinsicDaysHeight + 1), 344)
    const desiredHeight = force || desiredHeightRef.current === null
      ? measuredDesiredHeight
      : desiredHeightRef.current
    desiredHeightRef.current = desiredHeight
    const safeAreaHeight = Math.max(0, safeModalBottom - safeModalTop)
    if (safeAreaHeight < 160) {
      close()
      return
    }
    // Keep the calendar's height stable while its anchor moves inside a
    // scrolling form. Constrain only to the fixed visible modal/viewport area,
    // not the changing gap above or below the field.
    const maxHeight = Math.floor(Math.min(desiredHeight, safeAreaHeight))
    const panelHeight = maxHeight
    const openAbove = spaceAbove >= panelHeight || spaceAbove > spaceBelow
    const preferredTop = openAbove ? rect.top - panelHeight - gap : rect.bottom + gap
    const top = Math.max(safeModalTop, Math.min(preferredTop, safeModalBottom - panelHeight))
    setPosition({ top, left, width, height: panelHeight, maxHeight, constrained: panelHeight < desiredHeight })
  }, [close])

  const show = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const focusScope = trigger.closest<HTMLElement>('[data-app-select-portal-root]')
    lastAnchorRectRef.current = null
    desiredHeightRef.current = null
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
  }, [close, open, portalRoot, updatePosition, view.month, view.year])

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
    if (parts) setView(parts)
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLButtonElement>(`[data-calendar-date="${nextIso}"]`)?.focus())
  }, [])

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
      setView(current => moveCalendarMonth(current.year, current.month, amount))
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
            <button type="button" className={styles.arrow} aria-label="Mes anterior" onClick={() => setView(current => moveCalendarMonth(current.year, current.month, -1))}>‹</button>
            <div className={styles.selectors}>
              <select aria-label="Mes" value={view.month} onChange={event => setView(current => ({ ...current, month: Number(event.target.value) }))}>
                {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
              </select>
              <select aria-label="Año" value={view.year} onChange={event => setView(current => ({ ...current, year: Number(event.target.value) }))}>
                {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <button type="button" className={styles.arrow} aria-label="Mes siguiente" onClick={() => setView(current => moveCalendarMonth(current.year, current.month, 1))}>›</button>
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
