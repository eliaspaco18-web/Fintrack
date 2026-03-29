// =============================================================================
// components/tables/primitives.tsx
// Primitivos compartidos para todas las tablas y listados.
// Diseño: oscuro, denso, profesional — orientado a datos financieros.
// =============================================================================

'use client'

import { type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'

// ═════════════════════════════════════════════════════════════════════════════
// TABLE SHELL
// ═════════════════════════════════════════════════════════════════════════════

interface TableShellProps {
  children:  ReactNode
  className?: string
}

export function TableShell({ children, className = '' }: TableShellProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[color:var(--color-border)]
        bg-[var(--color-surface)]
        shadow-[0_12px_30px_rgba(15,23,42,0.18)] ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-500/45 via-cyan-400/35 to-transparent"/>
      {children}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TABLE HEADER / BODY / FOOT
// ═════════════════════════════════════════════════════════════════════════════

export function Th({
  children,
  right,
  sortKey,
  currentSort,
  onSort,
  className = '',
}: {
  children?:   ReactNode
  right?:      boolean
  sortKey?:    string
  currentSort?: { key: string; dir: 'asc' | 'desc' }
  onSort?:     (key: string) => void
  className?:  string
}) {
  const isSorted   = sortKey && currentSort?.key === sortKey
  const sortDir    = isSorted ? currentSort!.dir : null
  const sortable   = !!sortKey && !!onSort

  return (
    <th
      onClick={sortable ? () => onSort!(sortKey!) : undefined}
      className={`
        px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.1em]
        text-[var(--color-text-muted)] border-b border-[color:var(--color-border)] bg-[var(--color-surface-2)]
        whitespace-nowrap
        ${sortable ? 'cursor-pointer select-none hover:text-[var(--color-text)] transition-colors' : ''}
        ${right ? 'text-right' : ''}
        ${className}
      `}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        {sortable && (
          <SortIndicator dir={sortDir}/>
        )}
      </span>
    </th>
  )
}

function SortIndicator({ dir }: { dir: 'asc' | 'desc' | null }) {
  return (
    <span className="flex flex-col gap-[2px]">
      <svg width="7" height="4" viewBox="0 0 7 4" className={dir === 'asc' ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}>
        <path d="M3.5 0L7 4H0L3.5 0Z" fill="currentColor"/>
      </svg>
      <svg width="7" height="4" viewBox="0 0 7 4" className={dir === 'desc' ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}>
        <path d="M3.5 4L0 0H7L3.5 4Z" fill="currentColor"/>
      </svg>
    </span>
  )
}

export function Td({
  children,
  right,
  muted,
  className = '',
}: {
  children?:  ReactNode
  right?:     boolean
  muted?:     boolean
  className?: string
}) {
  return (
    <td className={`
      px-4 py-3.5 text-sm align-middle border-b border-[color:var(--color-border)]
      ${right ? 'text-right' : ''}
      ${muted ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}
      ${className}
    `}>
      {children}
    </td>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOLBAR
// ═════════════════════════════════════════════════════════════════════════════

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--color-border)] bg-[var(--color-surface-2)] p-4 backdrop-blur-sm">
      {children}
    </div>
  )
}

// ─── SEARCH INPUT ─────────────────────────────────────────────────────────────

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  value:    string
  onChange: (v: string) => void
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…', className = '', ...props }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
        width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        {...props}
        className={`
          w-full sm:w-56 pl-8 pr-3 py-1.5 rounded-lg text-sm
          bg-[var(--color-surface)] border border-[color:var(--color-border)]
          text-[var(--color-text)] placeholder:text-[var(--color-text-faint)]
          focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/35
          transition-all duration-150
        `}
      />
    </div>
  )
}

// ─── FILTER PILL ──────────────────────────────────────────────────────────────

interface FilterPillProps {
  label:    string
  active:   boolean
  onClick:  () => void
  count?:   number
  color?:   string
  testId?:  string
}

export function FilterPill({ label, active, onClick, count, color, testId }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold
        border transition-all duration-150 whitespace-nowrap
        ${active
          ? `border-current/30 ${color ? '' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'}`
          : 'border-[color:var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
        }
      `}
      style={active && color ? {
        backgroundColor: color + '18',
        color:           color,
        borderColor:     color + '35',
      } : undefined}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] tabular-nums ${active ? 'opacity-60' : 'opacity-50'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── SORT SELECT ──────────────────────────────────────────────────────────────

interface SortOption { value: string; label: string }

interface SortSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  options:  SortOption[]
  value:    string
  onChange: (v: string) => void
}

export function SortSelect({ options, value, onChange, ...props }: SortSelectProps) {
  return (
    <div className="relative ml-auto">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        {...props}
        className="
          pl-3 pr-7 py-1.5 rounded-lg text-[12px] font-medium
          bg-[var(--color-surface)] border border-[color:var(--color-border)]
          text-[var(--color-text-muted)] appearance-none cursor-pointer
          focus:outline-none focus:ring-1 focus:ring-white/10
          transition-all duration-150
        "
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
        width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// STATUS BADGES
// ═════════════════════════════════════════════════════════════════════════════

type StatusVariant =
  | 'success' | 'error' | 'warning' | 'info'
  | 'pending' | 'active' | 'closed' | 'overdue'
  | 'paid' | 'partial' | 'collected'

const STATUS_STYLES: Record<StatusVariant, string> = {
  success:   'bg-emerald-500/12 text-emerald-400',
  error:     'bg-red-500/12 text-red-400',
  warning:   'bg-amber-500/12 text-amber-400',
  info:      'bg-blue-500/12 text-blue-400',
  pending:   'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]',
  active:    'bg-emerald-500/12 text-emerald-400',
  closed:    'bg-[var(--color-surface-2)] text-[var(--color-text-faint)]',
  overdue:   'bg-red-500/15 text-red-400',
  paid:      'bg-emerald-500/12 text-emerald-400',
  partial:   'bg-amber-500/12 text-amber-400',
  collected: 'bg-emerald-500/12 text-emerald-400',
}

export function StatusBadge({
  label,
  variant,
}: {
  label:   string
  variant: StatusVariant
}) {
  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded-full
      text-[10px] font-bold uppercase tracking-wide whitespace-nowrap
      ${STATUS_STYLES[variant]}
    `}>
      {label}
    </span>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ROW ACTIONS
// ═════════════════════════════════════════════════════════════════════════════

interface RowAction {
  label:     string
  onClick:   () => void
  variant?:  'default' | 'danger'
  disabled?: boolean
  testId?:   string
}

export function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex items-center justify-end gap-2
      opacity-100 transition-opacity duration-150">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={e => { e.stopPropagation(); action.onClick() }}
          disabled={action.disabled}
          data-testid={action.testId}
          className={`
            inline-flex items-center justify-center
            text-[11px] font-semibold px-2.5 py-1 rounded-md border
            transition-colors duration-100
            disabled:opacity-30 disabled:cursor-not-allowed
            ${action.variant === 'danger'
              ? 'border-red-400/25 bg-red-500/[0.04] text-red-400/75 hover:text-red-400 hover:bg-red-500/[0.08]'
              : 'border-[color:var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:border-[color:var(--color-border-hover)]'
            }
          `}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═════════════════════════════════════════════════════════════════════════════

interface EmptyStateProps {
  icon?:       ReactNode
  title:       string
  description: string
  action?:     ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <tr>
      <td colSpan={99}>
        <div className="flex flex-col items-center justify-center py-16 text-center px-8">
          {icon && (
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-2)] border border-[color:var(--color-border)]
              flex items-center justify-center mb-4 text-[var(--color-text-faint)]">
              {icon}
            </div>
          )}
          <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-1 max-w-xs leading-relaxed">{description}</p>
          {action && <div className="mt-4">{action}</div>}
        </div>
      </td>
    </tr>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// LOADING ROWS
// ═════════════════════════════════════════════════════════════════════════════

export function SkeletonRows({ cols, rows = 8 }: { cols: number; rows?: number }) {
  const widths = [90, 160, 120, 80, 70, 60, 90, 50]
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className="border-b border-[color:var(--color-border)]">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-4 py-3.5">
              <div
                className="h-3 rounded animate-pulse"
                style={{
                  width: `${widths[ci % widths.length]}px`,
                  backgroundColor: 'color-mix(in srgb, var(--color-text-faint) 28%, transparent)',
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGINATION
// ═════════════════════════════════════════════════════════════════════════════

interface PaginationProps {
  page:       number
  totalPages: number
  total:      number
  perPage:    number
  onPage:     (p: number) => void
}

export function Pagination({ page, totalPages, total, perPage, onPage }: PaginationProps) {
  if (totalPages <= 1) return null

  const from = (page - 1) * perPage + 1
  const to   = Math.min(page * perPage, total)

  // Páginas visibles: prev, current±1, next
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(p =>
    p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)
  )

  return (
    <div className="flex items-center justify-between px-4 py-3
      border-t border-[color:var(--color-border)] bg-[var(--color-surface-2)]">
      <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
        {from}–{to} de {total}
      </p>

      <div className="flex items-center gap-1">
        <PageBtn onClick={() => onPage(page - 1)} disabled={page <= 1} label="←"/>

        {pages.map((p, i) => {
          const prev = pages[i - 1]
          const gap  = prev && p - prev > 1

          return (
            <span key={p} className="flex items-center gap-1">
              {gap && (
                <span className="text-white/15 text-[11px] px-1">…</span>
              )}
              <PageBtn
                onClick={() => onPage(p)}
                active={p === page}
                label={String(p)}
              />
            </span>
          )
        })}

        <PageBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages} label="→"/>
      </div>
    </div>
  )
}

function PageBtn({
  onClick, disabled, active, label,
}: {
  onClick:  () => void
  disabled?: boolean
  active?:   boolean
  label:     string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        min-w-[28px] h-7 px-2 rounded-lg text-[12px] font-medium
        transition-all duration-100
        disabled:opacity-25 disabled:cursor-not-allowed
        ${active
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
        }
      `}
    >
      {label}
    </button>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// AMOUNT CELL — para mostrar montos con conversión
// ═════════════════════════════════════════════════════════════════════════════

interface AmountCellProps {
  amountPen:  number
  original?:  { amount: number; currency: string }
  variant?:   'income' | 'expense' | 'neutral'
  preferred:  'PEN' | 'USD'
  exchangeRate?: number
  format:     (n: number) => number
  formatter:  (n: number, c: string) => string
}

export function AmountCell({
  amountPen, original, variant = 'neutral', preferred, exchangeRate = 1, format, formatter,
}: AmountCellProps) {
  const display = formatter(format(amountPen), preferred)
  const prefix  = variant === 'income' ? '+' : variant === 'expense' ? '−' : ''
  const safeExchangeRate = exchangeRate > 0 ? exchangeRate : 1
  const secondaryCurrency = preferred === 'PEN' ? 'USD' : 'PEN'
  const secondaryAmount = preferred === 'PEN'
    ? amountPen / safeExchangeRate
    : amountPen
  const secondaryDisplay = formatter(secondaryAmount, secondaryCurrency)

  const colorClass = {
    income:  'text-emerald-400',
    expense: 'text-red-400',
    neutral: 'text-white/75',
  }[variant]

  const showOriginal =
    original &&
    original.currency !== preferred &&
    original.currency !== secondaryCurrency

  return (
    <div className="text-right">
      <p className={`text-sm font-bold tabular-nums ${colorClass}`}>
        {prefix}{display}
      </p>
      <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums mt-0.5">
        ≈ {secondaryDisplay}
      </p>
      {showOriginal && (
        <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums mt-0.5">
          {formatter(original.amount, original.currency)}
        </p>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// DATE CELL
// ═════════════════════════════════════════════════════════════════════════════

export function DateCell({ date, relative }: { date: string; relative?: boolean }) {
  if (!date) {
    return (
      <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
        —
      </span>
    )
  }

  const normalized = date.includes('T') ? date : `${date}T12:00:00`
  const d = new Date(normalized)
  const isValid = !Number.isNaN(d.getTime())
  const formatted = isValid
    ? d.toLocaleDateString('es-PE', {
        day: 'numeric', month: 'short', year: '2-digit',
      })
    : '—'

  return (
    <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
      {formatted}
    </span>
  )
}

// ─── PROGRESS BAR (re-export from dashboard primitives for use in tables) ─────
export { ProgressBar } from '@/components/dashboard/primitives'
