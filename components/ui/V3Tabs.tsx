'use client'

import { type KeyboardEvent, useId, useRef } from 'react'

export interface V3TabItem {
  id: string
  label: string
  panelId: string
  disabled?: boolean
}

interface V3TabsProps {
  tabs: readonly V3TabItem[]
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  className?: string
}

export function V3Tabs({ tabs, value, onChange, ariaLabel, className = '' }: V3TabsProps) {
  const rootId = useId()
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())
  const firstEnabled = tabs.find(tab => !tab.disabled)?.id

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const enabled = tabs.filter(tab => !tab.disabled)
    if (enabled.length === 0) return
    event.preventDefault()
    const focusedId = (event.target as HTMLElement).getAttribute('data-tab-id') ?? value
    const current = Math.max(0, enabled.findIndex(tab => tab.id === focusedId))
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? enabled.length - 1
        : event.key === 'ArrowRight' ? (current + 1) % enabled.length
          : (current - 1 + enabled.length) % enabled.length
    const next = enabled[nextIndex]
    if (!next) return
    tabRefs.current.get(next.id)?.focus({ preventScroll: true })
    if (next.id !== value) onChange(next.id)
  }

  return (
    <div role="tablist" aria-label={ariaLabel} aria-orientation="horizontal"
      onKeyDown={onKeyDown} className={`ft-v3-tabs ${className}`.trim()}>
      {tabs.map((tab, index) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            ref={element => {
              if (element) tabRefs.current.set(tab.id, element)
              else tabRefs.current.delete(tab.id)
            }}
            id={`${rootId}-tab-${index}`}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            aria-selected={active}
            aria-controls={tab.panelId}
            aria-disabled={tab.disabled || undefined}
            tabIndex={active || (!tabs.some(item => item.id === value && !item.disabled) && tab.id === firstEnabled) ? 0 : -1}
            disabled={tab.disabled}
            className="ft-v3-tab"
            onClick={() => { if (!tab.disabled && tab.id !== value) onChange(tab.id) }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
