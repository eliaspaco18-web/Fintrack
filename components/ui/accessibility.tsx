// =============================================================================
// components/ui/accessibility.tsx
// Utilidades de accesibilidad reutilizables.
// FocusTrap, VisuallyHidden, skip-to-content, keyboard shortcuts, offline.
// =============================================================================

'use client'

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
}              from 'react'
import { useRouter } from 'next/navigation'

// ─── VISUALLY HIDDEN ─────────────────────────────────────────────────────────
// Oculta visualmente pero disponible para screen readers.

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <span className="sr-only">{children}</span>
  )
}

// ─── SKIP TO CONTENT ─────────────────────────────────────────────────────────
// Primer elemento del layout — salta al contenido principal en Tab.

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="
        sr-only focus:not-sr-only
        fixed top-4 left-4 z-[200]
        px-4 py-2 rounded-xl
        bg-emerald-500 text-black font-bold text-sm
        focus:outline-none focus:ring-2 focus:ring-emerald-300
        transition-all
      "
    >
      Ir al contenido principal
    </a>
  )
}

// ─── FOCUS TRAP ───────────────────────────────────────────────────────────────
// Atrapa el foco dentro de un contenedor (para modals, drawers).

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(', ')

interface FocusTrapProps {
  active:    boolean
  children:  ReactNode
  onEscape?: () => void
}

export function FocusTrap({ active, children, onEscape }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return

    // Guardar el elemento que tenía foco antes de abrir
    const previouslyFocused = document.activeElement as HTMLElement

    // Enfocar el primer elemento focusable
    const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE)
    firstFocusable?.focus()

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape?.()
        return
      }

      if (e.key !== 'Tab') return

      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusables.length === 0) return

      const first = focusables[0]
      const last  = focusables[focusables.length - 1]
      if (!first || !last) return

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restaurar foco al cerrar
      previouslyFocused?.focus?.()
    }
  }, [active, onEscape])

  return <div ref={containerRef}>{children}</div>
}

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────
// Shortcuts globales de la aplicación.

type ShortcutKey = {
  key:      string
  meta?:    boolean
  ctrl?:    boolean
  shift?:   boolean
  action:   () => void
  label:    string
}

export function useKeyboardShortcuts(shortcuts: ShortcutKey[]) {
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      // No activar si el foco está en un input/textarea
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      for (const shortcut of shortcuts) {
        const metaMatch  = !shortcut.meta  || (e.metaKey || e.ctrlKey)
        const ctrlMatch  = !shortcut.ctrl  || e.ctrlKey
        const shiftMatch = !shortcut.shift || e.shiftKey
        const keyMatch   = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (keyMatch && metaMatch && ctrlMatch && shiftMatch) {
          e.preventDefault()
          shortcut.action()
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}

// ─── APP KEYBOARD SHORTCUTS ───────────────────────────────────────────────────
// Atajos globales de la aplicación fintech.

export function useAppKeyboardShortcuts() {
  const router = useRouter()

  const shortcuts: ShortcutKey[] = [
    {
      key:    'n',
      label:  'Nueva transacción',
      action: () => router?.push('/transactions/new'),
    },
    {
      key:    'd',
      label:  'Dashboard',
      action: () => router?.push('/dashboard'),
    },
    {
      key:    't',
      label:  'Transacciones',
      action: () => router?.push('/transactions'),
    },
    {
      key:    '/',
      label:  'Búsqueda',
      action: () => {
        const searchInput = document.querySelector<HTMLInputElement>('input[type="search"]')
        searchInput?.focus()
      },
    },
  ]

  useKeyboardShortcuts(shortcuts)
}

// ─── OFFLINE DETECTION ────────────────────────────────────────────────────────

export function useOffline(): boolean {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine)

    window.addEventListener('online',  update)
    window.addEventListener('offline', update)

    // Estado inicial
    setIsOffline(!navigator.onLine)

    return () => {
      window.removeEventListener('online',  update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return isOffline
}

// ─── ANNOUNCE ────────────────────────────────────────────────────────────────
// Live region para anuncios a screen readers (ej: "10 resultados encontrados").

interface AnnounceRegionProps {
  message?: string
  mode?:    'polite' | 'assertive'
}

export function AnnounceRegion({ message, mode = 'polite' }: AnnounceRegionProps) {
  return (
    <div
      role="status"
      aria-live={mode}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  )
}

// ─── ACCESSIBLE ICON BUTTON ───────────────────────────────────────────────────

interface IconButtonProps {
  label:     string
  onClick:   () => void
  children:  ReactNode
  disabled?: boolean
  size?:     'sm' | 'md' | 'lg'
  variant?:  'ghost' | 'surface'
}

export function IconButton({
  label, onClick, children, disabled, size = 'md', variant = 'ghost',
}: IconButtonProps) {
  const sizeClass  = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-10 h-10' }[size]
  const styleClass = variant === 'surface'
    ? 'bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10]'
    : 'hover:bg-white/[0.07]'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`
        ${sizeClass} rounded-xl
        flex items-center justify-center
        text-white/35 hover:text-white/65
        transition-all duration-150
        disabled:opacity-30 disabled:cursor-not-allowed
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/30
        ${styleClass}
      `}
    >
      <span aria-hidden>{children}</span>
    </button>
  )
}
