// =============================================================================
// components/detail/primitives.tsx
// Primitivos compartidos por todas las páginas de detalle.
// Diseñados para presentar entidades financieras de forma clara y densa.
// =============================================================================

'use client'

import Link                          from 'next/link'
import { useRouter }                 from 'next/navigation'
import { type ReactNode, useState }  from 'react'
import { Button } from '@/components/ui/Button'

export { ConfirmDialog } from '@/components/finance'

// ─── BACK LINK ────────────────────────────────────────────────────────────────

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[12px] text-[var(--c-text-muted)]
        hover:text-[var(--c-text)] transition-colors mb-6 group"
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
    <div className={`rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[0_1px_2px_rgba(25,25,23,0.04)] ${className}`}>
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
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-text-muted)]">
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--c-text-faint)] mb-1">
        {label}
      </p>
      <div className={`text-sm text-[var(--c-text)] ${mono ? 'font-mono tabular-nums' : 'font-medium'}`}>
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
  primary: 'primary',
  secondary: 'secondary',
  danger: 'danger',
  ghost: 'ghost',
} as const

export function ActionButton({
  label, onClick, href, variant = 'secondary', disabled, loading, icon, testId,
}: ActionButtonProps) {
  if (href) {
    return (
      <Button
        href={href}
        testId={testId}
        variant={VARIANTS[variant]}
        size="md"
        leadingIcon={icon}
      >
        {label}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      testId={testId}
      variant={VARIANTS[variant]}
      size="md"
      leadingIcon={icon}
    >
      {loading ? 'Procesando…' : label}
    </Button>
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
      <p className="text-[var(--c-text)] text-base font-semibold">{entity} no encontrado</p>
      <p className="text-[var(--c-text-muted)] text-sm mt-1">
        Puede haber sido eliminado o no tienes acceso.
      </p>
      <Link href={backHref}
        className="mt-6 btn-secondary text-sm px-4 py-2">
        Volver al listado
      </Link>
    </div>
  )
}
