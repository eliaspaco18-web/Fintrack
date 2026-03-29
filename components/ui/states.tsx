// =============================================================================
// components/ui/states.tsx
// Estados de interfaz: vacío, error, sin conexión, error de página.
// También incluye ErrorBoundary para envolver páginas.
// =============================================================================

'use client'

import Link                              from 'next/link'
import { useRouter }                     from 'next/navigation'
import { Component, type ReactNode,
         type ErrorInfo }                from 'react'

// ═════════════════════════════════════════════════════════════════════════════
// EMPTY STATES
// ═════════════════════════════════════════════════════════════════════════════

interface EmptyPageProps {
  icon:        ReactNode
  title:       string
  description: string
  action?:     { label: string; href?: string; onClick?: () => void }
  size?:       'sm' | 'md' | 'lg'
}

export function EmptyPage({
  icon, title, description, action, size = 'md',
}: EmptyPageProps) {
  const iconSize = { sm: 'w-10 h-10', md: 'w-14 h-14', lg: 'w-20 h-20' }[size]
  const titleSize = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' }[size]
  const pad = { sm: 'py-12', md: 'py-20', lg: 'py-28' }[size]

  return (
    <div className={`flex flex-col items-center justify-center text-center ${pad}`}>
      <div className={`
        ${iconSize} rounded-2xl bg-[var(--color-surface-2)] border border-[color:var(--color-border)]
        flex items-center justify-center mb-5 text-[var(--color-text-faint)]
      `}>
        {icon}
      </div>
      <p className={`font-semibold text-[var(--color-text)] ${titleSize}`}>{title}</p>
      <p className="text-[12px] text-[var(--color-text-muted)] mt-1.5 max-w-xs leading-relaxed">
        {description}
      </p>
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Link href={action.href}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                bg-emerald-500 hover:bg-emerald-400 text-[var(--color-on-accent)] text-sm font-bold
                transition-all shadow-lg shadow-emerald-500/20
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] border border-[color:var(--color-border)]
                text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-sm font-semibold
                transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-hover)]">
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── EMPTY STATES POR MÓDULO ──────────────────────────────────────────────────
// Reutilizables con icono y copy específicos por sección.

const EMPTY_CONFIGS = {
  transactions: {
    title:       'Sin transacciones',
    description: 'Registra tu primer ingreso, egreso o transferencia para empezar.',
    actionLabel: '+ Nueva transacción',
    actionHref:  '/transactions/new',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/></svg>,
  },
  credits: {
    title:       'Sin créditos activos',
    description: 'Los créditos y préstamos aparecerán al registrar un egreso de tipo crédito.',
    actionLabel: 'Registrar egreso',
    actionHref:  '/transactions/new',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/></svg>,
  },
  assets: {
    title:       'Sin activos registrados',
    description: 'Los activos se crean automáticamente al registrar un egreso de tipo activo.',
    actionLabel: 'Registrar egreso',
    actionHref:  '/transactions/new',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 2 9 4.9V17L12 22 3 17V6.9L12 2Z"/><path d="M12 22V12"/><path d="m3 7 9 5 9-5"/></svg>,
  },
  receivables: {
    title:       'Sin cuentas por cobrar',
    description: 'Aparecerán al registrar un ingreso con la categoría "Cuenta por cobrar".',
    actionLabel: 'Registrar ingreso',
    actionHref:  '/transactions/new',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="m9 15 2 2 4-4"/></svg>,
  },
  payables: {
    title:       'Sin cuentas por pagar',
    description: 'Aparecerán al registrar un egreso con la categoría "Cuenta por pagar".',
    actionLabel: 'Registrar egreso',
    actionHref:  '/transactions/new',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="9" y1="13" x2="15" y2="13"/></svg>,
  },
} as const

type ModuleKey = keyof typeof EMPTY_CONFIGS

export function ModuleEmptyState({ module }: { module: ModuleKey }) {
  const cfg = EMPTY_CONFIGS[module]
  return (
    <EmptyPage
      icon={cfg.icon}
      title={cfg.title}
      description={cfg.description}
      action={{ label: cfg.actionLabel, href: cfg.actionHref }}
    />
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ERROR STATES
// ═════════════════════════════════════════════════════════════════════════════

interface ErrorStateProps {
  title?:   string
  message?: string
  onRetry?: () => void
}

export function ErrorState({
  title   = 'Algo salió mal',
  message = 'Ocurrió un error al cargar los datos. Intenta de nuevo.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-500/[0.08] border border-red-500/20
        flex items-center justify-center mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4m0 4h.01"/>
        </svg>
      </div>
      <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
      <p className="text-[12px] text-[var(--color-text-muted)] mt-1 max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 px-4 py-2 rounded-xl text-sm
            bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)]
            border border-[color:var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)]
            transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-hover)]"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

// ─── OFFLINE STATE ────────────────────────────────────────────────────────────

export function OfflineBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-[52px] left-0 right-0 z-50
        flex items-center justify-center gap-2
        py-2 bg-amber-500/15 border-b border-amber-500/25
        text-amber-400 text-[12px] font-medium"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="2" y1="2" x2="22" y2="22"/>
        <path d="M8.5 16.5a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M5 12.859A10 10 0 0 1 12 10c.48 0 .96.04 1.42.12"/>
      </svg>
      Sin conexión — Los datos pueden estar desactualizados
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ═════════════════════════════════════════════════════════════════════════════

interface ErrorBoundaryState {
  hasError: boolean
  message:  string
}

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // En producción: enviar a servicio de monitoreo (Sentry, etc.)
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <ErrorState
          title="Error de renderizado"
          message={this.state.message}
          onRetry={() => this.setState({ hasError: false, message: '' })}
        />
      )
    }
    return this.props.children
  }
}

// ─── SUSPENSE FALLBACK ────────────────────────────────────────────────────────
// Para usar con <Suspense fallback={<PageLoader/>}>

export function PageLoader() {
  return (
    <div
      className="flex items-center justify-center py-20"
      role="status"
      aria-label="Cargando página…"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20
          border-t-emerald-500 animate-spin"/>
        <p className="text-[11px] text-[var(--color-text-muted)]">Cargando…</p>
      </div>
    </div>
  )
}
