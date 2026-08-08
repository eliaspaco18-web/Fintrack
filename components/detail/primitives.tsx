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

// =============================================================================
// CANONICAL DETAIL EXPERIENCE (OPT-IN)
//
// These primitives are intentionally additive. The legacy exports above remain
// unchanged so existing credit, asset, receivable, and payable details keep
// their current presentation until they are migrated explicitly.
// =============================================================================

export type CanonicalDetailTone = 'neutral' | 'primary' | 'danger' | 'info'

const CANONICAL_TONE_CLASSES: Record<CanonicalDetailTone, {
  badge: string
  marker: string
  amount: string
}> = {
  neutral: {
    badge: 'border-[var(--ft-border)] bg-[var(--ft-surface-muted)] text-[var(--ft-text-muted)]',
    marker: 'border-[var(--ft-border)] bg-[var(--ft-surface-muted)] text-[var(--ft-text-strong)]',
    amount: 'text-[var(--ft-text-strong)]',
  },
  primary: {
    badge: 'border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]',
    marker: 'border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]',
    amount: 'text-[var(--ft-primary)]',
  },
  danger: {
    badge: 'border-[color-mix(in_srgb,var(--ft-danger)_20%,transparent)] bg-[var(--ft-danger-soft)] text-[var(--ft-danger)]',
    marker: 'border-[color-mix(in_srgb,var(--ft-danger)_20%,transparent)] bg-[var(--ft-danger-soft)] text-[var(--ft-danger)]',
    amount: 'text-[var(--ft-danger)]',
  },
  info: {
    badge: 'border-[color-mix(in_srgb,var(--ft-info)_20%,transparent)] bg-[var(--ft-info-soft)] text-[var(--ft-info)]',
    marker: 'border-[color-mix(in_srgb,var(--ft-info)_20%,transparent)] bg-[var(--ft-info-soft)] text-[var(--ft-info)]',
    amount: 'text-[var(--ft-info)]',
  },
}

export function CanonicalDetailBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-10 items-center gap-2 rounded-control px-2 text-[13px]
        font-medium text-[var(--ft-text-muted)] transition-colors duration-fast
        hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)]
        focus-visible:outline-none focus-visible:ring-[3px]
        focus-visible:ring-[color:var(--ft-focus-ring-color)] focus-visible:ring-offset-2
        focus-visible:ring-offset-[var(--ft-canvas)] motion-reduce:transition-none"
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4 transition-transform duration-fast group-hover:-translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </Link>
  )
}

interface CanonicalDetailLayoutProps {
  back: ReactNode
  summary: ReactNode
  actions: ReactNode
  children: ReactNode
  aside?: ReactNode
}

/**
 * One responsive detail composition with a single action DOM tree.
 * Mobile order: summary, actions, facts, related context.
 * Wide desktop: identity/facts with an action/context rail.
 */
export function CanonicalDetailLayout({
  back,
  summary,
  actions,
  children,
  aside,
}: CanonicalDetailLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <div className="mb-4 sm:mb-5">{back}</div>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_288px] xl:items-start">
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">{summary}</div>
        <div className="min-w-0 xl:col-start-2 xl:row-start-1">{actions}</div>
        <div className="min-w-0 xl:col-start-1 xl:row-start-2">{children}</div>
        {aside ? (
          <aside className="min-w-0 xl:col-start-2 xl:row-start-2">
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  )
}

interface CanonicalDetailSummaryProps {
  marker: ReactNode
  tone?: CanonicalDetailTone
  badges: ReactNode
  title: ReactNode
  subtitle: ReactNode
  amount: ReactNode
  amountMeta?: ReactNode
}

export function CanonicalDetailSummary({
  marker,
  tone = 'neutral',
  badges,
  title,
  subtitle,
  amount,
  amountMeta,
}: CanonicalDetailSummaryProps) {
  const toneClasses = CANONICAL_TONE_CLASSES[tone]

  return (
    <header className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] px-4 py-5 shadow-elevation-sm sm:px-6 sm:py-6">
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span
            aria-hidden="true"
            className={`flex h-11 w-11 flex-none items-center justify-center rounded-surface border text-base font-semibold sm:h-12 sm:w-12 sm:text-lg ${toneClasses.marker}`}
          >
            {marker}
          </span>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">{badges}</div>
            <h1 className="break-words font-display text-[22px] font-bold leading-[1.2] tracking-[-0.025em] text-[var(--ft-text-strong)] sm:text-2xl">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-5 text-[var(--ft-text-muted)]">{subtitle}</p>
          </div>
        </div>

        <div className="min-w-0 border-t border-[var(--ft-border)] pt-4 sm:flex-none sm:border-0 sm:pt-0 sm:text-right">
          <p className={`break-words text-[28px] font-bold leading-none tracking-[-0.025em] tabular-nums sm:text-[30px] ${toneClasses.amount}`}>
            {amount}
          </p>
          {amountMeta ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 sm:justify-end">{amountMeta}</div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export function CanonicalDetailBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: CanonicalDetailTone
}) {
  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CANONICAL_TONE_CLASSES[tone].badge}`}>
      {children}
    </span>
  )
}

export function CanonicalDetailFacts({ children }: { children: ReactNode }) {
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-panel border border-[var(--ft-border)] bg-[var(--ft-border)] shadow-elevation-sm sm:grid-cols-2">
      {children}
    </dl>
  )
}

interface CanonicalDetailFactProps {
  label: string
  children: ReactNode
  full?: boolean
  mono?: boolean
}

export function CanonicalDetailFact({
  label,
  children,
  full,
  mono,
}: CanonicalDetailFactProps) {
  return (
    <div className={`min-w-0 bg-[var(--ft-surface)] px-4 py-4 sm:px-5 ${full ? 'sm:col-span-2' : ''}`}>
      <dt className="text-xs font-medium leading-4 text-[var(--ft-text-muted)]">{label}</dt>
      <dd className={`mt-1.5 min-w-0 break-words text-sm leading-5 text-[var(--ft-text-strong)] ${mono ? 'font-mono tabular-nums' : 'font-medium'}`}>
        {children}
      </dd>
    </div>
  )
}

export function CanonicalDetailRailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] p-4 shadow-elevation-sm sm:p-5">
      <h2 className="mb-3 text-xs font-semibold leading-4 text-[var(--ft-text-muted)]">{title}</h2>
      {children}
    </section>
  )
}

export function CanonicalDetailActionButton({
  label,
  onClick,
  href,
  variant = 'secondary',
  disabled,
  loading,
  icon,
  testId,
}: ActionButtonProps) {
  if (href) {
    return (
      <Button
        href={href}
        testId={testId}
        variant={VARIANTS[variant]}
        size="md"
        leadingIcon={icon}
        fullWidth
        className="justify-start"
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
      fullWidth
      className="justify-start"
    >
      {loading ? 'Procesando…' : label}
    </Button>
  )
}

export function CanonicalRelatedRecordLink({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-control
        border border-transparent px-3 py-2 text-[13px] font-medium leading-5
        text-[var(--ft-text-strong)] transition-colors duration-fast
        hover:border-[var(--ft-border)] hover:bg-[var(--ft-surface-muted)]
        focus-visible:outline-none focus-visible:ring-[3px]
        focus-visible:ring-[color:var(--ft-focus-ring-color)] focus-visible:ring-offset-2
        focus-visible:ring-offset-[var(--ft-surface)] motion-reduce:transition-none"
    >
      <span className="min-w-0 break-words">{label}</span>
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5 flex-none text-[var(--ft-text-subtle)] transition-transform duration-fast group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  )
}

export function CanonicalInlineError({ message }: { message: string }) {
  return (
    <div
      className="rounded-surface border border-[color-mix(in_srgb,var(--ft-danger)_20%,transparent)] bg-[var(--ft-danger-soft)] px-3 py-2.5"
    >
      <p className="text-sm leading-5 text-[var(--ft-danger)]">{message}</p>
    </div>
  )
}
