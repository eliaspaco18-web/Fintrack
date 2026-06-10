'use client'

import { type ReactNode } from 'react'

interface ScreenHeroProps {
  label?: string
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}

export function ScreenHero({
  label = 'Sección',
  title,
  subtitle,
  icon,
  actions,
}: ScreenHeroProps) {
  return (
    <section
      className="screen-hero hero-contrast relative overflow-hidden rounded-3xl border border-[var(--c-primary-border)] px-5 py-5 md:px-7 md:py-6
        bg-[linear-gradient(135deg,#006948_0%,#007b57_48%,#0f8a64_100%)]
        shadow-[0_16px_34px_rgba(0,70,48,0.32)]"
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[38%]" style={{ backgroundColor: 'rgba(255, 255, 255, 0.10)' }}/>
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.18)' }}/>
      <div className="pointer-events-none absolute -bottom-12 right-20 h-24 w-24 rounded-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.13)' }}/>

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-[color:var(--hero-ink-muted)]">{label}</p>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-[color:var(--hero-ink-strong)]">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-[12px] text-[color:var(--hero-ink-soft)]">{subtitle}</p>
          )}
        </div>

        <div className="relative flex items-start gap-3">
          {actions}
          {icon && (
            <div
              className="pointer-events-none hidden md:flex h-12 w-12 items-center justify-center rounded-xl
                border border-white/20 text-[color:var(--hero-ink-soft)]"
              style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
            >
              {icon}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
