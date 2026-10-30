'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import styles from '@/components/forms/TransactionForm/IncomeTransactionForm.module.css'

/** Credit-scoped wrapper using the exact approved V3 contextual-help treatment. */
export function CreditInfoHint({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const lastInputRef = useRef<'mouse' | 'touch' | 'keyboard'>('mouse')
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => setMounted(true), [])

  const showTooltip = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
    setClosing(false)
    setOpen(true)
  }, [])

  const closeTooltip = useCallback((immediate = false) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
    if (immediate) {
      setOpen(false)
      setClosing(false)
      return
    }
    setClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      setClosing(false)
      closeTimerRef.current = null
    }, 120)
  }, [])

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    const margin = 12
    const gap = 8
    const triggerRect = trigger.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    const maxLeft = Math.max(margin, window.innerWidth - tooltipRect.width - margin)
    const left = Math.min(maxLeft, Math.max(margin, triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2))
    const spaceAbove = triggerRect.top - margin
    const spaceBelow = window.innerHeight - triggerRect.bottom - margin
    const placeAbove = spaceAbove >= tooltipRect.height + gap || (spaceBelow < tooltipRect.height + gap && spaceAbove > spaceBelow)
    const top = placeAbove
      ? Math.max(margin, triggerRect.top - tooltipRect.height - gap)
      : Math.min(window.innerHeight - tooltipRect.height - margin, triggerRect.bottom + gap)

    setPosition(previous => previous?.left === left && previous.top === top ? previous : { left, top })
  }, [])

  useLayoutEffect(() => {
    if (!open || !mounted) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [mounted, open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeTooltip(true)
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) closeTooltip()
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [closeTooltip, open])

  const triggerIsV3 = Boolean(triggerRef.current?.closest('[data-ft-v3], [data-ft-v3-shell]'))

  return (
    <span className={styles.infoHint}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open && !closing}
        className={styles.infoHintTrigger}
        onPointerDown={event => { lastInputRef.current = event.pointerType === 'touch' ? 'touch' : 'mouse' }}
        onPointerEnter={event => {
          if (event.pointerType === 'mouse') {
            lastInputRef.current = 'mouse'
            showTooltip()
          }
        }}
        onPointerLeave={event => {
          if (event.pointerType === 'mouse' && lastInputRef.current === 'mouse') closeTooltip()
        }}
        onFocus={event => {
          if (lastInputRef.current !== 'touch') {
            lastInputRef.current = event.currentTarget.matches(':focus-visible') ? 'keyboard' : 'mouse'
            showTooltip()
          }
        }}
        onBlur={() => { if (lastInputRef.current === 'keyboard') closeTooltip() }}
        onKeyDown={event => {
          if (event.key !== 'Escape') lastInputRef.current = 'keyboard'
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            closeTooltip(true)
          }
        }}
        onClick={event => {
          if (event.detail > 0 && lastInputRef.current === 'touch') {
            if (open && !closing) closeTooltip()
            else showTooltip()
          }
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 7.1v3.7M8 5.2h.01" />
        </svg>
      </button>
      {open && mounted ? createPortal(
        <span
          ref={tooltipRef}
          id={id}
          role="tooltip"
          className={styles.infoTooltip}
          data-ft-v3={triggerIsV3 ? '' : undefined}
          data-state={closing ? 'closing' : 'open'}
          style={{ left: position?.left ?? 12, top: position?.top ?? 12, visibility: position ? 'visible' : 'hidden' }}
        >
          {children}
        </span>,
        document.body,
      ) : null}
    </span>
  )
}
