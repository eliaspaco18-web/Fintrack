'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './BudgetMonthPicker.module.css'

type Props = {
  value: string
  onChange: (value: string) => void
  testId?: string
}

type Position = { top: number; left: number; placement: 'above' | 'below' }

const MONTHS = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat('es-PE', {
  month: 'long',
  timeZone: 'UTC',
}).format(new Date(Date.UTC(2026, month, 1))))

function parseMonth(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value)
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1 } : null
}

function monthLabel(value: string) {
  const parsed = parseMonth(value)
  if (!parsed) return value
  return new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(parsed.year, parsed.month, 1)))
}

export function BudgetMonthPicker({ value, onChange, testId = 'budgets-header-period-select' }: Props) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const monthRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [open, setOpen] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const selected = parseMonth(value) ?? { year: new Date().getFullYear(), month: new Date().getMonth() }
  const [viewYear, setViewYear] = useState(selected.year)
  const monthNames = useMemo(() => MONTHS, [])
  const labelId = `${id}-label`

  useEffect(() => setPortalReady(true), [])

  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    setPosition(null)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return
    const rect = trigger.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const inset = 8
    const width = Math.min(panelRect.width || 296, window.innerWidth - inset * 2)
    const height = panelRect.height
    const left = Math.max(inset, Math.min(rect.left, window.innerWidth - width - inset))
    const below = window.innerHeight - rect.bottom - 8
    const above = rect.top - 8
    const placement = below >= height || below >= above ? 'below' : 'above'
    const top = placement === 'below'
      ? Math.min(window.innerHeight - height - inset, rect.bottom + 6)
      : Math.max(inset, rect.top - height - 6)
    setPosition({ top, left, placement })
  }, [])

  useLayoutEffect(() => {
    if (!open || !portalReady) return
    positionPanel()
    const frame = requestAnimationFrame(() => {
      monthRefs.current[selected.month]?.focus({ preventScroll: true })
    })
    const handleViewportChange = () => positionPanel()
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      close()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
      }
    }
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [close, open, portalReady, positionPanel, selected.month])

  const chooseMonth = (month: number) => {
    onChange(`${viewYear}-${String(month + 1).padStart(2, '0')}`)
    close(true)
  }

  const moveMonthFocus = (currentMonth: number, offset: number) => {
    const target = currentMonth + offset
    if (target < 0) {
      setViewYear(year => year - 1)
      requestAnimationFrame(() => monthRefs.current[11]?.focus())
    } else if (target > 11) {
      setViewYear(year => year + 1)
      requestAnimationFrame(() => monthRefs.current[0]?.focus())
    } else {
      monthRefs.current[target]?.focus()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        aria-label={`Período seleccionado: ${monthLabel(value)}`}
        data-testid={testId}
        onClick={() => {
          if (open) close()
          else {
            setViewYear(selected.year)
            setOpen(true)
          }
        }}
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
        <span>{monthLabel(value)}</span>
        <svg aria-hidden="true" className={styles.chevron} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      {open && portalReady ? createPortal(
        <div
          ref={panelRef}
          id={`${id}-panel`}
          role="dialog"
          aria-labelledby={labelId}
          className={styles.panel}
          data-placement={position?.placement ?? 'below'}
          data-testid="budget-month-picker-panel"
          style={{
            position: 'fixed',
            top: position?.top ?? 8,
            left: position?.left ?? 8,
            visibility: position ? 'visible' : 'hidden',
          }}
        >
          <header className={styles.panelHeader}>
            <button type="button" className={styles.yearButton} aria-label="Año anterior" onClick={() => setViewYear(year => year - 1)}>
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <h2 id={labelId}>{viewYear}</h2>
            <button type="button" className={styles.yearButton} aria-label="Año siguiente" onClick={() => setViewYear(year => year + 1)}>
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </header>
          <div className={styles.monthGrid} role="group" aria-label={`Meses de ${viewYear}`}>
            {monthNames.map((monthName, month) => {
              const isSelected = selected.year === viewYear && selected.month === month
              return (
                <button
                  ref={element => { monthRefs.current[month] = element }}
                  key={month}
                  type="button"
                  className={styles.monthButton}
                  aria-pressed={isSelected}
                  aria-label={`${monthName} ${viewYear}`}
                  data-selected={isSelected}
                  onClick={() => chooseMonth(month)}
                  onKeyDown={event => {
                    if (event.key === 'ArrowLeft') { event.preventDefault(); moveMonthFocus(month, -1) }
                    if (event.key === 'ArrowRight') { event.preventDefault(); moveMonthFocus(month, 1) }
                    if (event.key === 'ArrowUp') { event.preventDefault(); moveMonthFocus(month, -3) }
                    if (event.key === 'ArrowDown') { event.preventDefault(); moveMonthFocus(month, 3) }
                    if (event.key === 'Home') { event.preventDefault(); monthRefs.current[0]?.focus() }
                    if (event.key === 'End') { event.preventDefault(); monthRefs.current[11]?.focus() }
                  }}
                >
                  {monthName}
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
