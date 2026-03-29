// =============================================================================
// components/dashboard/primitives.tsx
// Primitivos compartidos entre todos los widgets del dashboard.
// No contienen datos — solo estructura y presentación.
// =============================================================================

'use client'

import { type ReactNode } from 'react'
import { formatPercent } from '@/lib/contracts/ui.contracts'

// ─── WIDGET SHELL ─────────────────────────────────────────────────────────────
// Contenedor base para todos los widgets. Maneja loading, empty y error.

interface WidgetShellProps {
  children:   ReactNode
  className?: string
  noPadding?: boolean
}

export function WidgetShell({ children, className = '', noPadding }: WidgetShellProps) {
  return (
    <div
      className={`
        rounded-2xl border border-white/[0.06]
        bg-white/[0.025]
        ${noPadding ? '' : 'p-5'}
        ${className}
      `}
    >
      {children}
    </div>
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
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {accent && (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: accent }}
          />
        )}
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/35">
          {title}
        </h2>
      </div>
      {action && (
        <div className="text-[11px] text-white/30">{action}</div>
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
    value:  'text-emerald-400',
    badge:  'bg-emerald-500/10 text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    ring:   'ring-emerald-500/20',
  },
  red: {
    value:  'text-red-400',
    badge:  'bg-red-500/10 text-red-400',
    iconBg: 'bg-red-500/10',
    ring:   'ring-red-500/20',
  },
  amber: {
    value:  'text-amber-400',
    badge:  'bg-amber-500/10 text-amber-400',
    iconBg: 'bg-amber-500/10',
    ring:   'ring-amber-500/20',
  },
  blue: {
    value:  'text-blue-400',
    badge:  'bg-blue-500/10 text-blue-400',
    iconBg: 'bg-blue-500/10',
    ring:   'ring-blue-500/20',
  },
  white: {
    value:  'text-white/80',
    badge:  'bg-white/10 text-white/60',
    iconBg: 'bg-white/5',
    ring:   'ring-white/10',
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
          <div className="h-3 w-24 rounded bg-white/[0.06]"/>
          <div className="h-7 w-32 rounded bg-white/[0.08]"/>
          <div className="h-3 w-16 rounded bg-white/[0.04]"/>
        </div>
      </WidgetShell>
    )
  }

  const changeLabel = change != null
    ? formatPercent(change, { fractionDigits: 1, signed: true })
    : null

  return (
    <WidgetShell className={`ring-1 ${s.ring} hover:ring-2 transition-all duration-200`}>
      <div className="flex items-start justify-between gap-3">
        {/* Label + values */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-white/30 mb-2">
            {label}
          </p>
          <p className={`text-2xl font-bold tabular-nums leading-none ${s.value}`}>
            {value}
          </p>
          {subvalue && (
            <p className="text-[11px] text-white/25 tabular-nums mt-1">{subvalue}</p>
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
          <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${s.iconBg}
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
  return <div className="h-px bg-white/[0.05] my-4"/>
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
        w-full flex items-center justify-between gap-3 py-2.5
        border-b border-white/[0.04] last:border-0
        text-left
        ${onClick ? 'hover:bg-white/[0.025] -mx-5 px-5 rounded-lg cursor-pointer transition-colors' : ''}
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {accent && (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent }}/>
          )}
          <p className="text-sm text-white/70 font-medium truncate">{label}</p>
          {badge}
        </div>
        {sublabel && (
          <p className="text-[11px] text-white/25 mt-0.5 ml-3.5 truncate">{sublabel}</p>
        )}
      </div>
      <span className="text-sm font-bold tabular-nums text-white/80 flex-shrink-0">{amount}</span>
    </Tag>
  )
}

// ─── URGENCY BADGE ────────────────────────────────────────────────────────────

export type UrgencyLevel = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | null

export function UrgencyBadge({ urgency }: { urgency: UrgencyLevel }) {
  if (!urgency) return null

  const styles = {
    OVERDUE:  'bg-red-500/15 text-red-400',
    DUE_SOON: 'bg-amber-500/15 text-amber-400',
    UPCOMING: 'bg-white/5 text-white/35',
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
    <div className="flex flex-col items-center justify-center py-8 text-center">
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06]
          flex items-center justify-center mb-3 text-white/15">
          {icon}
        </div>
      )}
      <p className="text-sm text-white/30 font-medium">{message}</p>
      {hint && <p className="text-[11px] text-white/15 mt-1">{hint}</p>}
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

export function ProgressBar({ value, color = '#10b981', height = 4, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div>
      {label && (
        <div className="flex justify-between text-[10px] text-white/30 mb-1">
          <span>{label}</span>
          <span className="tabular-nums">{formatPercent(clamped, { fractionDigits: 0 })}</span>
        </div>
      )}
      <div
        className="w-full rounded-full bg-white/[0.06] overflow-hidden"
        style={{ height }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
