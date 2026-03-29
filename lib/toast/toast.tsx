// =============================================================================
// lib/toast/toast.tsx
// Sistema de toasts global.
// Patrón: Context + hook useToast() + componente ToastRenderer en el layout raíz.
//
// USO DESDE CUALQUIER CLIENT COMPONENT:
//   const { toast } = useToast()
//   toast.success('Transacción registrada')
//   toast.error('No se pudo eliminar', 'Hay cuotas pagadas vinculadas')
//   toast.promise(myAction(), { loading: 'Guardando…', success: '¡Listo!', error: 'Error' })
// =============================================================================

'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
}              from 'react'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id:       string
  variant:  ToastVariant
  title:    string
  detail?:  string
  duration: number          // ms; 0 = persistente hasta cierre manual
  closing?: boolean
}

interface ToastInput {
  variant: ToastVariant
  title: string
  detail?: string
  duration?: number
}

interface ToastContextValue {
  toasts:  Toast[]
  add:     (t: ToastInput) => string
  remove:  (id: string) => void
  clear:   () => void
}

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

const ToastCtx = createContext<ToastContextValue>({
  toasts: [],
  add:    () => '',
  remove: () => {},
  clear:  () => {},
})

// ─── PROVIDER ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const removeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const EXIT_ANIMATION_MS = 220

  const remove = useCallback((id: string) => {
    const t = timers.current.get(id)
    if (t) { clearTimeout(t); timers.current.delete(id) }

    if (removeTimers.current.has(id)) return

    setToasts(prev => {
      let exists = false
      const next = prev.map(item => {
        if (item.id !== id) return item
        exists = true
        return item.closing ? item : { ...item, closing: true }
      })
      return exists ? next : prev
    })

    const removeTimer = setTimeout(() => {
      removeTimers.current.delete(id)
      setToasts(prev => prev.filter(item => item.id !== id))
    }, EXIT_ANIMATION_MS)

    removeTimers.current.set(id, removeTimer)
  }, [])

  const add = useCallback((toast: ToastInput): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const duration = typeof toast.duration === 'number'
      ? toast.duration
      : (toast.variant === 'error' ? 6000 : 4200)

    setToasts(prev => {
      // Máximo 5 toasts simultáneos — eliminar el más antiguo si se supera
      const next = [...prev, { ...toast, id, duration, closing: false }]
      if (next.length <= 5) return next

      const dropped = next[0]
      if (dropped) {
        const autoTimer = timers.current.get(dropped.id)
        if (autoTimer) {
          clearTimeout(autoTimer)
          timers.current.delete(dropped.id)
        }
        const exitTimer = removeTimers.current.get(dropped.id)
        if (exitTimer) {
          clearTimeout(exitTimer)
          removeTimers.current.delete(dropped.id)
        }
      }
      return next.slice(next.length - 5)
    })

    if (duration > 0) {
      const timer = setTimeout(() => remove(id), duration)
      timers.current.set(id, timer)
    }

    return id
  }, [remove])

  const clear = useCallback(() => {
    timers.current.forEach(t => clearTimeout(t))
    timers.current.clear()
    removeTimers.current.forEach(t => clearTimeout(t))
    removeTimers.current.clear()
    setToasts([])
  }, [])

  // Limpiar al desmontar
  useEffect(() => {
    const activeTimers = timers.current
    const activeRemoveTimers = removeTimers.current
    return () => {
      activeTimers.forEach(t => clearTimeout(t))
      activeRemoveTimers.forEach(t => clearTimeout(t))
    }
  }, [])

  return (
    <ToastCtx.Provider value={{ toasts, add, remove, clear }}>
      {children}
    </ToastCtx.Provider>
  )
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

interface ToastHelpers {
  success: (title: string, detail?: string) => void
  error:   (title: string, detail?: string) => void
  warning: (title: string, detail?: string) => void
  info:    (title: string, detail?: string) => void
  promise: <T>(
    p:       Promise<T>,
    options: { loading: string; success: string; error: string }
  ) => Promise<T>
  dismiss: (id: string) => void
  clear:   () => void
}

export function useToast(): { toast: ToastHelpers } {
  const ctx = useContext(ToastCtx)

  const make = useCallback((variant: ToastVariant) =>
    (title: string, detail?: string) => {
      ctx.add({ variant, title, detail })
    }, [ctx])

  const toast: ToastHelpers = {
    success: make('success'),
    error:   make('error'),
    warning: make('warning'),
    info:    make('info'),
    promise: async (p, opts) => {
      const id = ctx.add({ variant: 'info', title: opts.loading, duration: 0 })
      try {
        const result = await p
        ctx.remove(id)
        ctx.add({ variant: 'success', title: opts.success })
        return result
      } catch (e) {
        ctx.remove(id)
        const msg = e instanceof Error ? e.message : opts.error
        ctx.add({ variant: 'error', title: opts.error, detail: msg })
        throw e
      }
    },
    dismiss: ctx.remove,
    clear:   ctx.clear,
  }

  return { toast }
}

// ─── ICONOS ───────────────────────────────────────────────────────────────────

const ICONS: Record<ToastVariant, ReactNode> = {
  success: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  error: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  ),
  warning: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4m0-4h.01"/>
    </svg>
  ),
}

const VARIANT_STYLES: Record<ToastVariant, { wrap: string; icon: string; bar: string }> = {
  success: {
    wrap: 'border-emerald-500/30 bg-emerald-500/10',
    icon: 'bg-emerald-500/15 text-emerald-400',
    bar:  'bg-emerald-500',
  },
  error: {
    wrap: 'border-red-500/30 bg-red-500/10',
    icon: 'bg-red-500/15 text-red-400',
    bar:  'bg-red-500',
  },
  warning: {
    wrap: 'border-amber-500/30 bg-amber-500/10',
    icon: 'bg-amber-500/15 text-amber-400',
    bar:  'bg-amber-500',
  },
  info: {
    wrap: 'border-blue-500/30 bg-blue-500/10',
    icon: 'bg-blue-500/15 text-blue-400',
    bar:  'bg-blue-500',
  },
}

// ─── TOAST ITEM ───────────────────────────────────────────────────────────────

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const s = VARIANT_STYLES[t.variant]

  // Entrada animada
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Accesibilidad: Enter/Escape cierra el toast
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') onRemove(t.id)
  }, [t.id, onRemove])

  return (
    <div
      role="alert"
      aria-live={t.variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`
        relative overflow-hidden
        flex items-start gap-3 w-full max-w-sm
        rounded-xl border px-4 py-3.5
        shadow-2xl shadow-black/50
        transition-all duration-300 ease-out
        focus:outline-none focus:ring-2 focus:ring-white/20
        ${s.wrap}
        ${visible && !t.closing
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
        }
      `}
    >
      {/* Barra de progreso */}
      {t.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/[0.05]">
          <div
            className={`h-full ${s.bar} origin-left`}
            style={{
              animation: `toast-drain ${t.duration}ms linear forwards`,
            }}
          />
        </div>
      )}

      {/* Icono */}
      <span className={`
        flex-shrink-0 w-6 h-6 rounded-lg
        flex items-center justify-center mt-0.5
        ${s.icon}
      `}>
        {ICONS[t.variant]}
      </span>

      {/* Contenido */}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-sm font-semibold text-[var(--color-text)] leading-tight">{t.title}</p>
        {t.detail && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{t.detail}</p>
        )}
      </div>

      {/* Cerrar */}
      <button
        onClick={() => onRemove(t.id)}
        aria-label="Cerrar notificación"
        className="flex-shrink-0 p-1 -mr-1 rounded-lg text-[var(--color-text-faint)]
          hover:text-[var(--color-text)] hover:bg-white/[0.06]
          transition-colors focus:outline-none focus:ring-1 focus:ring-[color:var(--color-border-hover)]"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}

// ─── RENDERER ─────────────────────────────────────────────────────────────────
// Montar en el root layout, fuera del área de contenido.

export function ToastRenderer() {
  const { toasts, remove } = useContext(ToastCtx)

  if (toasts.length === 0) return null

  return (
    <>
      {/* Keyframe para la barra de progreso */}
      <style>{`
        @keyframes toast-drain {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>

      {/* Zona de toasts: esquina inferior derecha en desktop, top en móvil */}
      <div
        aria-label="Notificaciones"
        className="
          fixed z-[100] flex flex-col gap-2 pointer-events-none
          bottom-6 right-4 left-4
          sm:left-auto sm:w-[360px] sm:right-5
        "
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={remove}/>
          </div>
        ))}
      </div>
    </>
  )
}
