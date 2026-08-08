'use client'

// =============================================================================
// components/layout/QuickActionsFAB.tsx
// Botón de acciones rápidas flotante (FAB) — esquina inferior derecha
// Centraliza atajos operativos para no recargar el Topbar.
// =============================================================================

import Link from 'next/link'
import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useCurrency } from '@/lib/hooks/useDashboard'
import { useTheme } from '@/lib/hooks/useTheme'
import {
  NavIcon,
  IconPlus,
  IconX,
  IconCurrencyDollar,
  IconMoon,
  IconSun,
  IconUser,
} from './LayoutIcons'

type QuickAction = {
  id: string
  label: string
  icon: ReactNode
  tone?: 'primary' | 'default'
} & (
  | { kind: 'link'; href: string }
  | { kind: 'button'; onClick: () => void; ariaLabel: string }
)

export function QuickActionsFAB() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { preferred, toggle } = useCurrency()
  const { theme, mounted, toggleTheme } = useTheme()
  const isLight = mounted && theme !== 'dark'

  const actions: QuickAction[] = [
    {
      id: 'transactions',
      kind: 'link',
      label: 'Movimientos',
      href: '/transactions',
      icon: <NavIcon name="transactions" size={14} strokeWidth={1.8} className="shrink-0" />,
    },
    {
      id: 'alerts',
      kind: 'link',
      label: 'Alertas',
      href: '/alerts',
      icon: <NavIcon name="alerts" size={14} strokeWidth={1.8} className="shrink-0" />,
    },
    {
      id: 'currency',
      kind: 'button',
      label: preferred,
      onClick: toggle,
      ariaLabel: `Cambiar a ${preferred === 'PEN' ? 'USD' : 'PEN'}`,
      icon: <IconCurrencyDollar size={13} />,
    },
    {
      id: 'theme',
      kind: 'button',
      label: isLight ? 'Oscuro' : 'Claro',
      onClick: toggleTheme,
      ariaLabel: 'Cambiar tema',
      icon: isLight ? <IconMoon size={13} /> : <IconSun size={13} />,
    },
    {
      id: 'profile',
      kind: 'link',
      label: 'Perfil',
      href: '/settings?tab=profile',
      icon: <IconUser size={14} />,
    },
    {
      id: 'new',
      kind: 'link',
      label: 'Nueva',
      href: '/transactions?new=transaction',
      icon: <IconPlus size={14} />,
      tone: 'primary',
    },
  ]

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }

    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  const commonCard = `
    group flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-surface border px-3.5 py-2.5
    text-[12px] font-semibold shadow-elevation-sm
    transition-[background-color,border-color,color,box-shadow,transform] duration-fast
    ease-[var(--ft-ease-out)] motion-reduce:transition-none
    hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)] hover:shadow-elevation-md
    active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[3px]
    focus-visible:ring-[var(--ft-focus-ring-color)]
  `

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed right-4 z-dropdown flex flex-col items-end gap-2.5 sm:right-6"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div
        className={`
          flex max-h-[62vh] origin-bottom flex-col-reverse gap-2 overflow-y-auto p-1
          transition-[opacity,transform] duration-base ease-[var(--ft-ease-out)] motion-reduce:transition-none
          ${open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-2 opacity-0'
          }
        `}
        aria-hidden={!open}
      >
        {actions.map((action) => {
          const toneClass = action.tone === 'primary'
            ? 'border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]'
            : 'border-[var(--ft-border)] bg-[var(--ft-surface)] text-[var(--ft-text-muted)] hover:text-[var(--ft-text-strong)]'

          if (action.kind === 'link') {
            return (
              <Link
                key={action.id}
                href={action.href}
                prefetch={false}
                scroll={false}
                onClick={() => setOpen(false)}
                className={`${commonCard} ${toneClass}`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-control bg-[var(--ft-surface-muted)]">
                  {action.icon}
                </span>
                <span>{action.label}</span>
              </Link>
            )
          }

          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              aria-label={action.ariaLabel}
              className={`${commonCard} ${toneClass} w-full text-left`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-control bg-[var(--ft-surface-muted)]">
                {action.icon}
              </span>
              <span>{action.label}</span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-label={open ? 'Cerrar acciones rápidas' : 'Abrir acciones rápidas'}
        aria-expanded={open}
        className="
          pointer-events-auto relative flex h-12 w-12 items-center justify-center
          rounded-surface border border-transparent bg-[var(--ft-primary)] text-[var(--ft-text-on-primary)]
          shadow-elevation-md hover:bg-[var(--ft-primary-hover)] hover:shadow-elevation-lg
          active:scale-[0.96]
          transition-[background-color,box-shadow,transform] duration-fast ease-[var(--ft-ease-out)]
          motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-[3px]
          focus-visible:ring-[var(--ft-focus-ring-color)] focus-visible:ring-offset-2
          focus-visible:ring-offset-[var(--ft-canvas)]
        "
      >
        <span className={`transition-transform duration-base ease-[var(--ft-ease-out)] motion-reduce:transition-none ${open ? 'rotate-90' : 'rotate-0'}`}>
          {open ? <IconX size={18} /> : <IconPlus size={18} />}
        </span>
      </button>
    </div>
  )
}
