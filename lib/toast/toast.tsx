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
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
}              from 'react'
import {
  createAcknowledgementClock,
  dismissAcknowledgement,
  enqueueAcknowledgement,
  resizeAcknowledgementClock,
  setAcknowledgementPause,
  tickAcknowledgements,
  type Acknowledgement,
  type AcknowledgementPauseReason,
  type AcknowledgementVariant,
} from './v3-acknowledgement-clock'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export type ToastVariant = AcknowledgementVariant
export type Toast = Acknowledgement

interface ToastInput {
  variant: ToastVariant
  title: string
  detail?: string
  duration?: number
  key?: string
}

interface ToastActions {
  add:     (t: ToastInput) => string
  remove:  (id: string) => void
  clear:   () => void
  pause:   (id: string, reason: AcknowledgementPauseReason, paused: boolean) => void
}

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

const ToastActionsCtx = createContext<ToastActions>({
  add:    () => '',
  remove: () => {},
  clear:  () => {},
  pause:  () => {},
})
const ToastStateCtx = createContext(createAcknowledgementClock(2))

// ─── PROVIDER ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [clock, setClock] = useState(() => createAcknowledgementClock(2))
  const nextId = useRef(0)

  const remove = useCallback((id: string) => {
    setClock(previous => dismissAcknowledgement(previous, id, performance.now()))
  }, [])

  const add = useCallback((toast: ToastInput): string => {
    nextId.current += 1
    const id = `toast-${Date.now()}-${nextId.current}`
    setClock(previous => {
      let updated = enqueueAcknowledgement(previous, { ...toast, id }, performance.now())
      if (document.hidden) {
        updated = updated.items.reduce((next, item) =>
          setAcknowledgementPause(next, item.id, 'hidden', true, performance.now()), updated)
      }
      return updated
    })
    return id
  }, [])

  const clear = useCallback(() => {
    setClock(previous => createAcknowledgementClock(previous.visibleLimit))
  }, [])

  const pause = useCallback((id: string, reason: AcknowledgementPauseReason, paused: boolean) => {
    setClock(previous => setAcknowledgementPause(previous, id, reason, paused, performance.now()))
  }, [])

  const active = clock.items.length > 0
  useEffect(() => {
    if (!active) return
    const interval = window.setInterval(() => {
      setClock(previous => tickAcknowledgements(previous, performance.now()))
    }, 50)
    return () => window.clearInterval(interval)
  }, [active])

  useEffect(() => {
    const updateCapacity = () => {
      const limit = window.matchMedia('(max-width: 767px)').matches ? 1 : 2
      setClock(previous => previous.visibleLimit === limit
        ? previous
        : resizeAcknowledgementClock(previous, limit, performance.now()))
    }
    updateCapacity()
    window.addEventListener('resize', updateCapacity)
    return () => window.removeEventListener('resize', updateCapacity)
  }, [])

  useEffect(() => {
    const updateVisibility = () => {
      setClock(previous => previous.items.reduce((next, item) =>
        setAcknowledgementPause(next, item.id, 'hidden', document.hidden, performance.now()), previous))
    }
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  const actions = useMemo(() => ({ add, remove, clear, pause }), [add, remove, clear, pause])

  return (
    <ToastActionsCtx.Provider value={actions}>
      <ToastStateCtx.Provider value={clock}>{children}</ToastStateCtx.Provider>
    </ToastActionsCtx.Provider>
  )
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

interface ToastHelpers {
  success: (
    title: string,
    detail?: string,
    options?: SuccessToastOptions
  ) => void
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

type SuccessToastOptions = {
  persist?: boolean
  category?: 'SYSTEM' | 'PORTFOLIO' | 'TRANSACTION' | 'BANK' | 'CATEGORY' | 'BUDGET' | 'ALERT'
  event?: string
  href?: string | null
}

export function useToast(): { toast: ToastHelpers } {
  const ctx = useContext(ToastActionsCtx)

  const make = useCallback((variant: ToastVariant) =>
    (title: string, detail?: string) => {
      ctx.add({ variant, title, detail })
    }, [ctx])

  const persistSuccessActivity = useCallback((
    title: string,
    detail?: string,
    options?: { category?: string; event?: string; href?: string | null },
  ) => {
    void fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: options?.category ?? 'SYSTEM',
        event: options?.event ?? 'TOAST_SUCCESS',
        title,
        message: detail ?? null,
        href: options?.href ?? null,
      }),
    }).catch(() => {
      // Sin impacto en UX: si falla persistencia, mantenemos solo el toast local.
    })
  }, [])

  const toast: ToastHelpers = {
    success: (title: string, detail?: string, options?: SuccessToastOptions) => {
      ctx.add({ variant: 'success', title, detail })
      if (options?.persist === false) return
      persistSuccessActivity(title, detail, {
        category: options?.category,
        event: options?.event,
        href: options?.href ?? null,
      })
    },
    error:   make('error'),
    warning: make('warning'),
    info:    make('info'),
    promise: async (p, opts) => {
      const id = ctx.add({ variant: 'info', title: opts.loading, duration: 0 })
      try {
        const result = await p
        ctx.remove(id)
        ctx.add({ variant: 'success', title: opts.success })
        persistSuccessActivity(opts.success)
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

// ─── TOAST ITEM ───────────────────────────────────────────────────────────────

function ToastItem({ toast: t, actions }: { toast: Toast; actions: ToastActions }) {
  const remainingSeconds = Math.max(1, Math.ceil(t.remaining / 1000))
  const paused = t.pauseReasons.length > 0
  const progress = t.duration > 0 ? Math.max(0, Math.min(1, t.remaining / t.duration)) : 0

  return (
    <div
      role={t.variant === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      aria-hidden={t.phase === 'closing' || undefined}
      data-variant={t.variant}
      data-phase={t.phase}
      className="ft-v3-toast"
      onPointerEnter={event => {
        if (event.pointerType !== 'touch') actions.pause(t.id, 'hover', true)
      }}
      onPointerLeave={event => {
        if (event.pointerType !== 'touch') actions.pause(t.id, 'hover', false)
        actions.pause(t.id, 'hold', false)
      }}
      onPointerDown={() => actions.pause(t.id, 'hold', true)}
      onPointerUp={() => actions.pause(t.id, 'hold', false)}
      onPointerCancel={() => actions.pause(t.id, 'hold', false)}
      onFocusCapture={() => actions.pause(t.id, 'focus', true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          actions.pause(t.id, 'focus', false)
        }
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && event.currentTarget.contains(document.activeElement)) {
          event.preventDefault()
          event.stopPropagation()
          actions.remove(t.id)
        }
      }}
    >
      <span className="ft-v3-toast-glyph" aria-hidden="true">
        {ICONS[t.variant]}
      </span>
      <div className="ft-v3-toast-copy">
        <p className="ft-v3-toast-title">{t.title}</p>
        {t.detail && <p className="ft-v3-toast-detail">{t.detail}</p>}
        {t.duration > 0 && (
          <div className="ft-v3-toast-lifetime" aria-hidden="true">
            <span className="ft-v3-toast-track">
              <span className="ft-v3-toast-fill" style={{ transform: `scaleX(${progress})` }} />
            </span>
            <span className="ft-v3-toast-seconds">{paused ? 'En pausa' : `Cierra en ${remainingSeconds} s`}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => actions.remove(t.id)}
        aria-label="Cerrar notificación"
        className="ft-v3-toast-close"
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
  const clock = useContext(ToastStateCtx)
  const actions = useContext(ToastActionsCtx)
  const visible = clock.items.filter(item => item.phase !== 'queued')
  if (visible.length === 0) return null

  return (
    <div data-ft-v3="" aria-label="Notificaciones" className="ft-v3-toast-host">
      {visible.map(item => <ToastItem key={item.id} toast={item} actions={actions} />)}
    </div>
  )
}
