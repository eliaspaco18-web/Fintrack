'use client'

import { createPortal } from 'react-dom'
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** Credit-scoped version of the contextual “!” help used by the approved V3 forms. */
export function CreditInfoHint({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !tooltipRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const place = () => {
      const trigger = triggerRef.current
      const tooltip = tooltipRef.current
      if (!trigger || !tooltip) return
      const rect = trigger.getBoundingClientRect()
      const margin = 12
      const width = Math.min(280, window.innerWidth - margin * 2)
      const left = Math.min(Math.max(margin, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - margin)
      const top = rect.bottom + 8 + tooltip.offsetHeight <= window.innerHeight - margin
        ? rect.bottom + 8
        : Math.max(margin, rect.top - tooltip.offsetHeight - 8)
      setPosition({ position: 'fixed', left, top, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  return (
    <span ref={rootRef} className="inline-flex align-middle">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(value => !value)}
        className="inline-flex h-[17px] w-[17px] items-center justify-center rounded-full border border-[var(--ft-border-strong)] bg-[var(--ft-surface)] text-[10px] font-semibold leading-none text-[var(--ft-text-muted)] transition-colors hover:border-[var(--ft-primary)] hover:text-[var(--ft-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ft-focus-ring-color)] motion-reduce:transition-none"
      >!</button>
      {open && typeof document !== 'undefined' ? createPortal(
        <span
          ref={tooltipRef}
          id={id}
          role="tooltip"
          style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
          className="z-[150] max-w-[calc(100vw-24px)] rounded-[var(--ft-form-radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-surface)] px-3 py-2.5 text-left text-[12px] font-normal leading-[1.45] text-[var(--ft-text-muted)] shadow-elevation-md"
        >{children}</span>,
        document.body,
      ) : null}
    </span>
  )
}
