'use client'

import { useState } from 'react'
import { chartTooltipStyle } from './chartTheme'

interface SmartTipProps {
  title?: string
  text: string
}

export function SmartTip({ title = 'SMART', text }: SmartTipProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full border border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-[var(--c-primary)]"
      >
        {title}
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-2 w-64 p-3 text-[11px] leading-5 text-[var(--c-text-muted)]"
          style={chartTooltipStyle}
        >
          {text}
        </div>
      )}
    </div>
  )
}
