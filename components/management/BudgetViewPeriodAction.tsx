'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import styles from './BudgetsManager.module.css'

type Props = {
  onClick: () => void
  testId: string
}

type Point = { top: number; left: number }

const TOOLTIP_TITLE = 'Ver período'
const TOOLTIP_DESCRIPTION = 'Abre el detalle y muestra los movimientos vinculados a sus fechas.'

export function BudgetViewPeriodAction({ onClick, testId }: Props) {
  const id = useId()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<Point | null>(null)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)

  useEffect(() => setMounted(true), [])

  const updatePosition = useCallback(() => {
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const width = Math.min(224, window.innerWidth - 16)
    const estimatedHeight = 78
    const above = rect.top - estimatedHeight - 8 >= 8
    const top = above
      ? rect.top - estimatedHeight - 8
      : Math.max(8, Math.min(window.innerHeight - estimatedHeight - 8, rect.bottom + 8))
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    setPosition({ top, left })
  }, [anchor])

  useLayoutEffect(() => {
    if (!visible || !mounted || !anchor) return
    updatePosition()
    const handleViewportChange = () => updatePosition()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [anchor, mounted, updatePosition, visible])

  useEffect(() => {
    if (!visible) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setVisible(false)
        setPosition(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible])

  const tooltip = mounted ? createPortal(
    <div
      id={id}
      role="tooltip"
      className={styles.periodActionTooltip}
      data-visible={visible && position !== null}
      style={{ top: position?.top ?? 8, left: position?.left ?? 8 }}
    >
      <span className={styles.periodActionTooltipTitle}>{TOOLTIP_TITLE}</span>
      <span>{TOOLTIP_DESCRIPTION}</span>
    </div>,
    document.body,
  ) : null

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        className="rounded-[var(--ft-radius-control)] text-[var(--ft-text-muted)] hover:text-[var(--ft-text-strong)]"
        ariaLabel="Abrir este período y sus movimientos"
        aria-describedby={id}
        testId={testId}
        onMouseEnter={event => {
          setAnchor(event.currentTarget)
          setPosition(null)
          setVisible(true)
        }}
        onMouseLeave={() => {
          setVisible(false)
          setPosition(null)
        }}
        onFocus={event => {
          setAnchor(event.currentTarget)
          const shouldShow = event.currentTarget.matches(':focus-visible')
          setPosition(null)
          setVisible(shouldShow)
        }}
        onBlur={() => {
          setVisible(false)
          setPosition(null)
        }}
        onClick={() => {
          setVisible(false)
          setPosition(null)
          onClick()
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </Button>
      {tooltip}
    </>
  )
}
