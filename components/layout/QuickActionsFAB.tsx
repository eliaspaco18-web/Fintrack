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
    group flex items-center gap-2.5 rounded-[14px] border px-3.5 py-2.5
    shadow-[0_4px_16px_rgba(8,58,54,0.12)] text-[12.5px] font-semibold whitespace-nowrap
    hover:shadow-[0_6px_20px_rgba(8,58,54,0.18)] transition-all duration-200
  `

  return (
    <div ref={ref} className="pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      <div
        className={`
          flex max-h-[62vh] flex-col-reverse gap-2 overflow-y-auto pr-1
          transition-all duration-300 ease-out origin-bottom
          ${open
            ? 'pointer-events-auto opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 pointer-events-none scale-95'
          }
        `}
        aria-hidden={!open}
      >
        {actions.map((action, idx) => {
          const toneClass = action.tone === 'primary'
            ? 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]'
            : 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-text-muted)] hover:text-[var(--c-primary)]'

          if (action.kind === 'link') {
            return (
              <Link
                key={action.id}
                href={action.href}
                prefetch={false}
                scroll={false}
                onClick={() => setOpen(false)}
                style={{ transitionDelay: open ? `${idx * 30}ms` : '0ms' }}
                className={`${commonCard} ${toneClass}`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-current/10">
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
              style={{ transitionDelay: open ? `${idx * 30}ms` : '0ms' }}
              className={`${commonCard} ${toneClass} w-full text-left`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-current/10">
                {action.icon}
              </span>
              <span>{action.label}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => setOpen(prev => !prev)}
        aria-label={open ? 'Cerrar acciones rápidas' : 'Abrir acciones rápidas'}
        aria-expanded={open}
        className="
          pointer-events-auto relative flex h-14 w-14 items-center justify-center
          rounded-[18px] text-white
          shadow-[0_6px_24px_rgba(13,79,74,0.40)]
          hover:shadow-[0_8px_28px_rgba(13,79,74,0.50)]
          active:scale-[0.96]
          transition-all duration-200 ease-out
        "
        style={{ backgroundColor: 'var(--c-primary)' }}
      >
        {!open && (
          <span
            className="pointer-events-none absolute inset-0 rounded-[18px] animate-ping opacity-20"
            style={{ backgroundColor: 'var(--c-primary)' }}
          />
        )}

        <span className={`transition-all duration-200 ${open ? 'rotate-90 scale-90' : 'rotate-0 scale-100'}`}>
          {open ? <IconX size={20} /> : <IconPlus size={20} />}
        </span>
      </button>
    </div>
  )
}
