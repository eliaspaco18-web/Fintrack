// =============================================================================
// components/detail/primitives.tsx
// Primitivos compartidos por todas las páginas de detalle.
// Diseñados para presentar entidades financieras de forma clara y densa.
// =============================================================================

'use client'

import Link                          from 'next/link'
import { useRouter }                 from 'next/navigation'
import { type ReactNode, useId, useState }  from 'react'
import { FocusTrap }                 from '@/components/ui/accessibility'

// ─── BACK LINK ────────────────────────────────────────────────────────────────

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[12px] text-white/30
        hover:text-white/60 transition-colors mb-6 group"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className="group-hover:-translate-x-0.5 transition-transform">
        <path d="m15 18-6-6 6-6"/>
      </svg>
      {label}
    </Link>
  )
}

// ─── DETAIL SHELL ─────────────────────────────────────────────────────────────

interface DetailShellProps {
  children:   ReactNode
  aside?:     ReactNode
  /** Si true, usa layout de dos columnas en desktop */
  twoColumn?: boolean
}

export function DetailShell({ children, aside, twoColumn }: DetailShellProps) {
  if (twoColumn && aside) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-5">{children}</div>
        <div className="space-y-5 lg:sticky lg:top-[72px]">{aside}</div>
      </div>
    )
  }
  return <div className="max-w-3xl space-y-5">{children}</div>
}

// ─── DETAIL CARD ──────────────────────────────────────────────────────────────

interface DetailCardProps {
  children:  ReactNode
  className?: string
}

export function DetailCard({ children, className = '' }: DetailCardProps) {
  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.025] ${className}`}>
      {children}
    </div>
  )
}

// ─── DETAIL SECTION ───────────────────────────────────────────────────────────

interface DetailSectionProps {
  title:      string
  children:   ReactNode
  accent?:    string
  action?:    ReactNode
  border?:    boolean
}

export function DetailSection({
  title, children, accent, action, border = true,
}: DetailSectionProps) {
  return (
    <div className={border ? 'p-5' : 'px-5 py-4'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {accent && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }}/>
          )}
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/30">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─── DETAIL FIELD ─────────────────────────────────────────────────────────────

interface DetailFieldProps {
  label:     string
  children:  ReactNode
  /** Si true, ocupa el ancho completo del grid */
  full?:     boolean
  mono?:     boolean
}

export function DetailField({ label, children, full, mono }: DetailFieldProps) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-white/25 mb-1">
        {label}
      </p>
      <div className={`text-sm text-white/75 ${mono ? 'font-mono tabular-nums' : 'font-medium'}`}>
        {children}
      </div>
    </div>
  )
}

/** Grid de campos, 2 columnas */
export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      {children}
    </div>
  )
}

// ─── ACTION BAR ───────────────────────────────────────────────────────────────

interface ActionBarProps {
  children: ReactNode
}

export function ActionBar({ children }: ActionBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      {children}
    </div>
  )
}

// ─── ACTION BUTTON ────────────────────────────────────────────────────────────

interface ActionButtonProps {
  label:     string
  onClick?:  () => void
  href?:     string
  variant?:  'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
  loading?:  boolean
  icon?:     ReactNode
  testId?:   string
}

const VARIANTS = {
  primary:   'bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-md shadow-emerald-500/20',
  secondary: 'bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/65 hover:text-white/85',
  danger:    'bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400',
  ghost:     'text-white/35 hover:text-white/65 hover:bg-white/[0.05]',
}

export function ActionButton({
  label, onClick, href, variant = 'secondary', disabled, loading, icon, testId,
}: ActionButtonProps) {
  const classes = `
    inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm
    transition-all duration-150
    disabled:opacity-40 disabled:cursor-not-allowed
    ${VARIANTS[variant]}
  `

  if (href) {
    return (
      <Link href={href} className={classes} data-testid={testId}>
        {icon}
        {label}
      </Link>
    )
  }

  return (
    <button onClick={onClick} disabled={disabled || loading} className={classes} data-testid={testId}>
      {loading
        ? <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        : icon
      }
      {loading ? 'Procesando…' : label}
    </button>
  )
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open:      boolean
  title:     string
  message:   string
  onConfirm: () => void
  onCancel:  () => void
  loading?:  boolean
  danger?:   boolean
  testId?:   string
  cancelTestId?: string
  confirmTestId?: string
}

export function ConfirmDialog({
  open, title, message, onConfirm, onCancel, loading, danger, testId, cancelTestId, confirmTestId,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid={testId}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <FocusTrap
        active={open}
        onEscape={() => {
          if (!loading) onCancel()
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="relative z-10 w-full max-w-sm rounded-2xl border border-white/[0.09]
            bg-[#0f1520] shadow-2xl shadow-black/60 p-6"
        >
          <h3 id={titleId} className="text-base font-bold text-white/85 mb-2">{title}</h3>
          <p id={descriptionId} className="text-sm text-white/45 leading-relaxed mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              data-testid={cancelTestId}
              className="px-4 py-2 rounded-xl text-sm text-white/45 hover:text-white/65
                bg-white/[0.05] hover:bg-white/[0.08] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              data-testid={confirmTestId}
              className={`
                px-4 py-2 rounded-xl text-sm font-semibold transition-all
                disabled:opacity-40
                ${danger
                  ? 'bg-red-500 hover:bg-red-400 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black font-bold'
                }
              `}
            >
              {loading ? 'Procesando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  )
}

// ─── LINKED MODULE BADGE ──────────────────────────────────────────────────────

interface LinkedModuleProps {
  label:  string
  href:   string
  color:  string
  icon?:  ReactNode
}

export function LinkedModuleBadge({ label, href, color, icon }: LinkedModuleProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
        text-[11px] font-semibold transition-all hover:opacity-80"
      style={{
        backgroundColor: color + '15',
        color,
        border:          `1px solid ${color}25`,
      }}
    >
      {icon}
      {label}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="m9 18 6-6-6-6"/>
      </svg>
    </Link>
  )
}

// ─── INLINE ERROR ─────────────────────────────────────────────────────────────

export function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-500/[0.08] border border-red-500/20 px-4 py-3">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  )
}

// ─── NOT FOUND ────────────────────────────────────────────────────────────────

export function NotFound({ entity, backHref }: { entity: string; backHref: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-3xl mb-3">🔍</p>
      <p className="text-white/40 text-base font-semibold">{entity} no encontrado</p>
      <p className="text-white/20 text-sm mt-1">
        Puede haber sido eliminado o no tienes acceso.
      </p>
      <Link href={backHref}
        className="mt-6 btn-secondary text-sm px-4 py-2">
        Volver al listado
      </Link>
    </div>
  )
}
