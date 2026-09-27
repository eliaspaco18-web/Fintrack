'use client'

import * as React from 'react'
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

export interface AnchoredAction {
  id: string
  label: string
  detail?: string
  groupLabel?: string
  icon?: ReactNode
  disabled?: boolean
  destructive?: boolean
  onSelect: (source: 'pointer' | 'keyboard') => void
}

interface AnchoredActionMenuProps {
  label: string
  actions: AnchoredAction[]
  triggerContent?: ReactNode
  renderTriggerContent?: (open: boolean) => ReactNode
  disabled?: boolean
  className?: string
  menuClassName?: string
  align?: 'start' | 'end'
  focusFirstOnPointer?: boolean
  dismissSignal?: string
  dismissOnSourceScroll?: boolean
  dismissOnFocusExit?: boolean
}

const EXIT_MS = 110

export function AnchoredActionMenu({
  label,
  actions,
  triggerContent,
  renderTriggerContent,
  disabled = false,
  className = '',
  menuClassName = '',
  align = 'end',
  focusFirstOnPointer = true,
  dismissSignal,
  dismissOnSourceScroll = false,
  dismissOnFocusExit = false,
}: AnchoredActionMenuProps) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const exitTimerRef = useRef<number | null>(null)
  const generationRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [animated, setAnimated] = useState(false)
  const [openedByPointer, setOpenedByPointer] = useState(false)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  const [v3Layer, setV3Layer] = useState(false)
  const [side, setSide] = useState<'above' | 'below'>('below')

  const close = useCallback((fromPointer = false, restoreFocus = false) => {
    generationRef.current += 1
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
    setOpen(false)
    const shouldAnimate = fromPointer && animated &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (shouldAnimate) {
      const generation = generationRef.current
      setExiting(true)
      exitTimerRef.current = window.setTimeout(() => {
        if (generationRef.current !== generation) return
        setExiting(false)
        setPortalRoot(null)
        exitTimerRef.current = null
      }, EXIT_MS)
    } else {
      setExiting(false)
      setPortalRoot(null)
    }
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true })
  }, [animated])

  const openMenu = useCallback((fromPointer: boolean) => {
    if (disabled) return
    generationRef.current += 1
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
    exitTimerRef.current = null
    window.dispatchEvent(new CustomEvent('ft-v3-action-menu:open', { detail: { id } }))
    setExiting(false)
    setAnimated(fromPointer && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setOpenedByPointer(fromPointer)
    setV3Layer(Boolean(triggerRef.current?.closest('[data-ft-v3]')))
    setPortalRoot(triggerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body)
    setMenuStyle({ visibility: 'hidden' })
    setOpen(true)
  }, [disabled, id])

  useEffect(() => () => {
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
  }, [])

  const lastDismissSignal = useRef(dismissSignal)
  useEffect(() => {
    if (lastDismissSignal.current === dismissSignal) return
    lastDismissSignal.current = dismissSignal
    if (open || exiting) close()
  }, [close, dismissSignal, exiting, open])

  useEffect(() => {
    if (!open || !dismissOnSourceScroll) return
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      close()
    }
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [close, dismissOnSourceScroll, open])

  useEffect(() => {
    if (!open || !dismissOnFocusExit) return
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null
      if (target && !triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close()
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [close, dismissOnFocusExit, open])

  useEffect(() => {
    if (!open) return
    const onOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && !triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        close(true)
      }
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close(false, true)
    }
    document.addEventListener('pointerdown', onOutsidePointer, true)
    document.addEventListener('keydown', onEscape, true)
    return () => {
      document.removeEventListener('pointerdown', onOutsidePointer, true)
      document.removeEventListener('keydown', onEscape, true)
    }
  }, [close, open])

  useEffect(() => {
    const onAnotherMenu = (event: Event) => {
      if ((open || exiting) && (event as CustomEvent<{ id: string }>).detail?.id !== id) close()
    }
    window.addEventListener('ft-v3-action-menu:open', onAnotherMenu)
    return () => window.removeEventListener('ft-v3-action-menu:open', onAnotherMenu)
  }, [close, exiting, id, open])

  useEffect(() => {
    if (!open || !portalRoot) return
    const positionMenu = () => {
      const trigger = triggerRef.current
      const menu = menuRef.current
      if (!trigger || !menu) return
      const visual = window.visualViewport
      const leftBound = visual?.offsetLeft ?? 0
      const topBound = visual?.offsetTop ?? 0
      const viewportWidth = visual?.width ?? window.innerWidth
      const viewportHeight = visual?.height ?? window.innerHeight
      const rect = trigger.getBoundingClientRect()
      const width = Math.min(menu.offsetWidth, Math.max(0, viewportWidth - 24))
      const height = Math.min(menu.offsetHeight, Math.max(0, viewportHeight - 24))
      const rawLeft = align === 'end' ? rect.right - width : rect.left
      const left = Math.max(leftBound + 12, Math.min(rawLeft, leftBound + viewportWidth - width - 12))
      const below = topBound + viewportHeight - rect.bottom - 8
      const above = rect.top - topBound - 8
      const flip = below < height && above > below
      setSide(flip ? 'above' : 'below')
      const top = flip
        ? Math.max(topBound + 12, rect.top - height - 8)
        : Math.min(rect.bottom + 8, topBound + viewportHeight - height - 12)
      const originX = Math.max(16, Math.min(width - 16, rect.left + rect.width / 2 - left))
      const rootRect = portalRoot.getBoundingClientRect()
      const rootStyle = getComputedStyle(portalRoot)
      const dialogContainingBlock = portalRoot !== document.body &&
        (rootStyle.position !== 'static' || rootStyle.transform !== 'none')
      setMenuStyle({
        position: dialogContainingBlock ? 'absolute' : 'fixed',
        left: dialogContainingBlock ? left - rootRect.left + portalRoot.scrollLeft : left,
        top: dialogContainingBlock ? top - rootRect.top + portalRoot.scrollTop : top,
        width,
        maxHeight: viewportHeight - 24,
        visibility: 'visible',
        transformOrigin: `${originX}px ${flip ? 'bottom' : 'top'}`,
        '--ft-menu-enter-y': flip ? '4px' : '-4px',
      } as CSSProperties)
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
  }, [align, actions.length, open, portalRoot])

  useEffect(() => {
    if (!open || menuStyle.visibility !== 'visible') return
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')
    if (!openedByPointer || focusFirstOnPointer) first?.focus({ preventScroll: true })
  }, [focusFirstOnPointer, menuStyle.visibility, open, openedByPointer])

  const focusAdjacentToTrigger = useCallback((backward: boolean) => {
    const scope = triggerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? document
    const focusables = Array.from(scope.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    )).filter(element => !menuRef.current?.contains(element) && element.getClientRects().length > 0)
    const index = triggerRef.current ? focusables.indexOf(triggerRef.current) : -1
    const next = index >= 0 ? focusables[index + (backward ? -1 : 1)] : undefined
    close()
    ;(next ?? triggerRef.current)?.focus({ preventScroll: true })
  }, [close])

  const onMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      focusAdjacentToTrigger(event.shiftKey)
      return
    }
    const enabled = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [])
    if (enabled.length === 0) return
    const current = enabled.indexOf(document.activeElement as HTMLButtonElement)
    let next = current
    if (event.key === 'ArrowDown') next = (current + 1) % enabled.length
    else if (event.key === 'ArrowUp') next = (current - 1 + enabled.length) % enabled.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = enabled.length - 1
    else return
    event.preventDefault()
    enabled[next]?.focus({ preventScroll: true })
  }, [focusAdjacentToTrigger])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-open={open ? 'true' : 'false'}
        data-ft-action-menu-trigger=""
        className={`ft-v3-action-menu-trigger ${className}`.trim()}
        onClick={event => open ? close(event.detail > 0, true) : openMenu(event.detail > 0)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) openMenu(false)
          }
        }}
      >
        {renderTriggerContent ? renderTriggerContent(open) : triggerContent ?? label}
      </button>
      {(open || exiting) && portalRoot && createPortal(
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          aria-hidden={exiting || undefined}
          data-ft-v3={v3Layer ? '' : undefined}
          data-motion={animated && open ? 'enter' : exiting ? 'exit' : 'none'}
          data-side={side}
          className={`ft-v3-action-menu ${menuClassName}`.trim()}
          style={menuStyle}
          onKeyDown={onMenuKeyDown}
        >
          {actions.map(action => (
            <React.Fragment key={action.id}>
            {action.groupLabel ? <div className="ft-v3-action-menu-group" role="presentation">{action.groupLabel}</div> : null}
            <button
              type="button"
              role="menuitem"
              disabled={action.disabled}
              aria-disabled={action.disabled || undefined}
              data-destructive={action.destructive || undefined}
              className="ft-v3-action-menu-item"
              onClick={event => {
                if (action.disabled) return
                close(event.detail > 0, false)
                action.onSelect(event.detail > 0 ? 'pointer' : 'keyboard')
              }}
            >
              {action.icon && <span className="ft-v3-action-menu-icon" aria-hidden="true">{action.icon}</span>}
              <span className="ft-v3-action-menu-copy">
                <span className="ft-v3-action-menu-label">{action.label}</span>
                {action.detail && <span className="ft-v3-action-menu-detail">{action.detail}</span>}
              </span>
            </button>
            </React.Fragment>
          ))}
        </div>,
        portalRoot,
      )}
    </>
  )
}
