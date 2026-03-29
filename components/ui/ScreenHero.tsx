'use client'

import { type ReactNode } from 'react'

interface ScreenHeroProps {
  label?: string
  title: string
  subtitle: string
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
      className="relative overflow-hidden rounded-2xl border border-white/[0.1] px-5 py-5 md:px-6 md:py-6
        bg-[linear-gradient(135deg,rgba(13,148,136,0.32),rgba(15,23,42,0.88),rgba(79,70,229,0.22))]
        shadow-[0_10px_34px_rgba(0,0,0,0.28)]"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/[0.08]"/>
      <div className="pointer-events-none absolute -bottom-14 right-16 h-28 w-28 rounded-full bg-white/[0.05]"/>

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/65">{label}</p>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-1 text-[12px] text-white/70">{subtitle}</p>
        </div>

        <div className="relative flex items-start gap-3">
          {actions}
          {icon && (
            <div className="pointer-events-none hidden md:flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.1] text-white/80">
              {icon}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
