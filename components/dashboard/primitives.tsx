// =============================================================================
// components/dashboard/primitives.tsx
// Primitivos compartidos entre todos los widgets del dashboard.
// No contienen datos — solo estructura y presentación.
// =============================================================================

'use client'

import { type ReactNode } from 'react'
import { formatPercent } from '@/lib/contracts/ui.contracts'
import { PremiumCard } from './PremiumCard'

// ─── WIDGET SHELL ─────────────────────────────────────────────────────────────
// Contenedor base para todos los widgets. Maneja loading, empty y error.

interface WidgetShellProps {
  children:   ReactNode
  className?: string
  noPadding?: boolean
}

export function WidgetShell({ children, className = '', noPadding }: WidgetShellProps) {
  return (
    <PremiumCard
      className={`dashboard-report-card ${className}`}
      innerClassName={noPadding ? '' : 'p-4'}
    >
      {children}
    </PremiumCard>
  )
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title:    string
  action?:  ReactNode
  /** Dot de color de acento */
  accent?:  string
}

export function SectionHeader({ title, action, accent }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {accent && (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: accent }}
          />
        )}
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-muted)]">
          {title}
        </h2>
      </div>
      {action && (
        <div className="text-[11px] text-[var(--c-text-muted)]">{action}</div>
      )}
    </div>
  )
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:      string
  value:      string               // ya formateado con moneda
  subvalue?:  string               // equivalente en otra moneda
  change?:    number | null        // % vs mes anterior
  trend?:     'up' | 'down' | 'flat'
  accent:     'emerald' | 'red' | 'amber' | 'blue' | 'white'
  icon?:      ReactNode
  loading?:   boolean
}

const ACCENT_STYLES: Record<KpiCardProps['accent'], {
  value: string; badge: string; iconBg: string; ring: string
}> = {
  emerald: {
    value:  'text-[var(--c-primary)]',
    badge:  'bg-[var(--c-primary-soft)] text-[var(--c-primary)]',
    iconBg: 'bg-[var(--c-primary-soft)] text-[var(--c-primary)]',
    ring:   '',
  },
  red: {
    value:  'text-[#C14554]',
    badge:  'bg-[rgba(193,69,84,0.10)] text-[#C14554]',
    iconBg: 'bg-[rgba(193,69,84,0.10)] text-[#C14554]',
    ring:   '',
  },
  amber: {
    value:  'text-[#B88435]',
    badge:  'bg-amber-500/10 text-[#B88435]',
    iconBg: 'bg-amber-500/10 text-[#B88435]',
    ring:   '',
  },
  blue: {
    value:  'text-[#3F68A7]',
    badge:  'bg-blue-500/10 text-[#3F68A7]',
    iconBg: 'bg-blue-500/10 text-[#3F68A7]',
    ring:   '',
  },
  white: {
    value:  'text-[var(--c-text)]',
    badge:  'bg-[var(--c-surface-2)] text-[var(--c-text-muted)]',
    iconBg: 'bg-[var(--c-surface-2)]',
    ring:   '',
  },
}

export function KpiCard({
  label, value, subvalue, change, trend, accent, icon, loading,
}: KpiCardProps) {
  const s = ACCENT_STYLES[accent]

  if (loading) {
    return (
      <WidgetShell>
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-24 rounded bg-[var(--c-primary-soft)]"/>
          <div className="h-7 w-32 rounded bg-[rgba(13,79,74,0.06)]"/>
          <div className="h-3 w-16 rounded bg-[rgba(13,79,74,0.04)]"/>
        </div>
      </WidgetShell>
    )
  }

  const changeLabel = change != null
    ? formatPercent(change, { fractionDigits: 1, signed: true })
    : null

  return (
    <WidgetShell className="hover:shadow-[var(--shadow-md)] transition-shadow duration-200">
      <div className="flex items-start justify-between gap-3">
        {/* Label + values */}
        <div className="flex-1 min-w-0">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--c-text-faint)]">
            {label}
          </p>
          <p className={`text-[1.25rem] font-bold tabular-nums leading-none tracking-[-0.025em] md:text-[1.52rem] ${s.value}`}>
            {value}
          </p>
          {subvalue && (
            <p className="mt-1 text-[10px] text-[var(--c-text-faint)] tabular-nums">{subvalue}</p>
          )}
          {changeLabel && (
            <div className={`inline-flex items-center gap-1 mt-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${s.badge}`}>
              {trend === 'up'   && <TrendArrow direction="up"/>}
              {trend === 'down' && <TrendArrow direction="down"/>}
              {changeLabel} vs mes anterior
            </div>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div className={`flex-shrink-0 w-9 h-9 rounded-[11px] ${s.iconBg}
            flex items-center justify-center`}>
            {icon}
          </div>
        )}
      </div>
    </WidgetShell>
  )
}

// ─── TREND ARROW ─────────────────────────────────────────────────────────────

function TrendArrow({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      {direction === 'up'
        ? <path d="M18 15l-6-6-6 6"/>
        : <path d="M6 9l6 6 6-6"/>
      }
    </svg>
  )
}

// ─── DIVIDER ROW ─────────────────────────────────────────────────────────────

export function WidgetDivider() {
  return <div className="h-px my-4 bg-[var(--c-border)]"/>
}

// ─── MONEY ROW ───────────────────────────────────────────────────────────────
// Fila de un ítem con monto y etiqueta. Usada en listados dentro de widgets.

interface MoneyRowProps {
  label:     string
  sublabel?: string
  amount:    string
  badge?:    ReactNode
  accent?:   string
  onClick?:  () => void
}

export function MoneyRow({ label, sublabel, amount, badge, accent, onClick }: MoneyRowProps) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className={`
        w-full flex items-center justify-between gap-3 py-2
        border-b border-[var(--c-border)] last:border-0
        text-left
        ${onClick ? 'hover:bg-[var(--c-surface-2)] -mx-5 px-5 rounded-lg cursor-pointer transition-colors' : ''}
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {accent && (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent }}/>
          )}
          <p className="text-[12px] text-[var(--c-text)] font-medium truncate">{label}</p>
          {badge}
        </div>
        {sublabel && (
          <p className="text-[10px] text-[var(--c-text-faint)] mt-0.5 ml-3.5 truncate">{sublabel}</p>
        )}
      </div>
      <span className="text-[12px] font-semibold tabular-nums text-[var(--c-text)] flex-shrink-0">{amount}</span>
    </Tag>
  )
}

// ─── URGENCY BADGE ────────────────────────────────────────────────────────────

export type UrgencyLevel = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | null

export function UrgencyBadge({ urgency }: { urgency: UrgencyLevel }) {
  if (!urgency) return null

  const styles = {
    OVERDUE:  'bg-[rgba(193,69,84,0.14)] text-[#C14554]',
    DUE_SOON: 'bg-amber-500/12 text-amber-700',
    UPCOMING: 'bg-[var(--c-primary-soft)] text-[var(--c-primary)]',
  } as const

  const labels = {
    OVERDUE:  'Vencida',
    DUE_SOON: 'Esta semana',
    UPCOMING: 'Próxima',
  } as const

  return (
    <span className={`
      text-[9px] font-bold uppercase tracking-wide
      px-1.5 py-0.5 rounded-full flex-shrink-0
      ${styles[urgency]}
    `}>
      {labels[urgency]}
    </span>
  )
}

// ─── EMPTY WIDGET ─────────────────────────────────────────────────────────────

interface EmptyWidgetProps {
  icon?:   ReactNode
  message: string
  hint?:   string
}

export function EmptyWidget({ icon, message, hint }: EmptyWidgetProps) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center py-5 text-center">
      {icon && (
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[0.9rem] border border-[var(--c-border)] bg-[var(--c-surface-2)]
          flex items-center justify-center mb-3 text-[var(--c-text-faint)]">
          {icon}
        </div>
      )}
      <p className="text-[13px] text-[var(--c-text)] font-medium">{message}</p>
      {hint && <p className="mt-1 text-[10px] text-[var(--c-text-faint)]">{hint}</p>}
    </div>
  )
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value:   number    // 0-100
  color?:  string
  height?: number
  label?:  string
}

export function ProgressBar({ value, color = '#0D4F4A', height = 4, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div>
      {label && (
        <div className="flex justify-between text-[10px] text-[var(--c-text-muted)] mb-1">
          <span>{label}</span>
          <span className="tabular-nums">{formatPercent(clamped, { fractionDigits: 0 })}</span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--c-primary-soft)', height }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
