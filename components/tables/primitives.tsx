// =============================================================================
// components/tables/primitives.tsx
// Primitivos compartidos para todas las tablas y listados.
// Diseño v3: Forest Green, cards blancas, profesional — datos financieros.
// =============================================================================

'use client'

import { type ReactNode, type InputHTMLAttributes } from 'react'
import {
  EmptyState as FinanceEmptyState,
  StatusBadge as FinanceStatusBadge,
} from '@/components/finance'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { AppSelect } from '@/components/ui/AppSelect'

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
      className={`relative overflow-hidden rounded-panel border border-[var(--ft-border)]
        bg-[var(--ft-surface)]
        shadow-elevation-sm ${className}`}
    >
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
      onKeyDown={sortable ? event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSort!(sortKey!)
        }
      } : undefined}
      tabIndex={sortable ? 0 : undefined}
      aria-sort={sortable
        ? sortDir === 'asc'
          ? 'ascending'
          : sortDir === 'desc'
            ? 'descending'
            : 'none'
        : undefined}
      className={`
        border-b border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-2.5
        text-left text-[12px] font-semibold tracking-[0.01em] text-[var(--ft-text-muted)]
        whitespace-nowrap
        ${sortable ? 'cursor-pointer select-none transition-colors duration-fast motion-reduce:transition-none hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)] focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)]' : ''}
        ${right ? 'text-right' : ''}
        ${className}
      `}
    >
      <span className={`inline-flex items-center gap-1.5 ${right ? 'w-full justify-end' : ''}`}>
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
    <span aria-hidden="true" className="flex flex-col gap-[2px]">
      <svg width="7" height="4" viewBox="0 0 7 4" className={dir === 'asc' ? 'text-[var(--ft-text-strong)]' : 'text-[var(--ft-text-subtle)]'}>
        <path d="M3.5 0L7 4H0L3.5 0Z" fill="currentColor"/>
      </svg>
      <svg width="7" height="4" viewBox="0 0 7 4" className={dir === 'desc' ? 'text-[var(--ft-text-strong)]' : 'text-[var(--ft-text-subtle)]'}>
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
      border-b border-[var(--ft-border)] px-4 py-2.5 text-[13px] align-middle
      ${right ? 'text-right tabular-nums' : ''}
      ${muted ? 'text-[var(--ft-text-muted)]' : 'text-[var(--ft-text-strong)]'}
      ${className}
    `}>
      {children}
    </td>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOLBAR
// ═════════════════════════════════════════════════════════════════════════════

export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`filters-row border-b border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-3 sm:p-4 ${className}`}>
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
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ft-text-subtle)]"
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
          h-9 w-full rounded-control border border-[var(--ft-border)] bg-[var(--ft-surface)] pl-8 pr-3 text-[13px]
          text-[var(--ft-text-strong)] placeholder:text-[var(--ft-text-subtle)]
          transition-[border-color,box-shadow,background-color] duration-fast motion-reduce:transition-none
          hover:border-[var(--ft-border-strong)] focus:border-[var(--ft-primary)]
          focus:outline-none focus:ring-[3px] focus:ring-[var(--ft-focus-ring-color)]
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
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={`
        flex h-9 items-center gap-1.5 rounded-control border px-2.5 text-[12px] font-medium
        whitespace-nowrap transition-colors duration-fast motion-reduce:transition-none
        focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)]
        ${active
          ? `border-current/30 ${color ? '' : 'border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]'}`
          : 'border-[var(--ft-border)] bg-[var(--ft-surface)] text-[var(--ft-text-muted)] hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)]'
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

interface SortSelectProps {
  options:  SortOption[]
  value:    string
  onChange: (v: string) => void
  disabled?: boolean
  className?: string
  testId?: string
}

export function SortSelect({
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  testId,
}: SortSelectProps) {
  return (
    <AppSelect
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      compact
      searchable={false}
      placeholder="Ordenar"
      testId={testId}
    />
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// STATUS BADGES
// ═════════════════════════════════════════════════════════════════════════════

type StatusVariant =
  | 'success' | 'error' | 'warning' | 'info'
  | 'pending' | 'active' | 'closed' | 'overdue'
  | 'paid' | 'partial' | 'collected'

// Border tokens for badge variants (light / dark via CSS vars)
const STATUS_BORDER: Record<StatusVariant, string> = {
  success:   'border-[color-mix(in_srgb,var(--ft-success)_22%,var(--ft-border))]',
  error:     'border-[color-mix(in_srgb,var(--ft-danger)_22%,var(--ft-border))]',
  warning:   'border-[color-mix(in_srgb,var(--ft-warning)_22%,var(--ft-border))]',
  info:      'border-[color-mix(in_srgb,var(--ft-info)_22%,var(--ft-border))]',
  pending:   'border-[var(--ft-border)]',
  active:    'border-[color-mix(in_srgb,var(--ft-success)_22%,var(--ft-border))]',
  closed:    'border-[var(--ft-border)]',
  overdue:   'border-[color-mix(in_srgb,var(--ft-danger)_22%,var(--ft-border))]',
  paid:      'border-[color-mix(in_srgb,var(--ft-success)_22%,var(--ft-border))]',
  partial:   'border-[color-mix(in_srgb,var(--ft-warning)_22%,var(--ft-border))]',
  collected: 'border-[color-mix(in_srgb,var(--ft-success)_22%,var(--ft-border))]',
}

export function StatusBadge({
  label,
  variant,
}: {
  label:   string
  variant: StatusVariant
}) {
  const tone = {
    success: 'success',
    error: 'danger',
    warning: 'warning',
    info: 'info',
    pending: 'neutral',
    active: 'success',
    closed: 'muted',
    overdue: 'danger',
    paid: 'success',
    partial: 'warning',
    collected: 'success',
  } as const

  return (
    <FinanceStatusBadge tone={tone[variant]} className={`status-badge ${STATUS_BORDER[variant]}`}>
      {label}
    </FinanceStatusBadge>
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

function iconFromActionLabel(label: string): 'view' | 'edit' | 'delete' | 'use' | 'deactivate' | 'reactivate' | 'settings' {
  const normalized = label.toLowerCase()
  if (normalized.includes('eliminar') || normalized.includes('borrar')) return 'delete'
  if (normalized.includes('desactivar') || normalized.includes('cerrar') || normalized.includes('bloquear')) return 'deactivate'
  if (normalized.includes('reactivar') || normalized.includes('activar')) return 'reactivate'
  if (normalized.includes('editar') || normalized.includes('modificar')) return 'edit'
  if (normalized.includes('usar')) return 'use'
  if (normalized.includes('detalle') || normalized.includes('ver')) return 'view'
  return 'settings'
}

export function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex items-center justify-end gap-1.5
      opacity-100 transition-opacity duration-fast motion-reduce:transition-none">
      {actions.map((action, i) => (
        <ActionIconButton
          key={i}
          onClick={e => { e.stopPropagation(); action.onClick() }}
          disabled={action.disabled}
          icon={iconFromActionLabel(action.label)}
          label={action.label}
          variant={action.variant === 'danger' ? 'danger' : 'default'}
          testId={action.testId}
        />
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
      <td colSpan={99} className="p-0">
        <FinanceEmptyState
          icon={icon}
          title={title}
          description={description}
          action={action}
          compact
        />
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
        <tr key={ri} className="border-b border-[var(--ft-border)]">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-4 py-3">
              <div
                className="h-3 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none"
                style={{
                  width: `${widths[ci % widths.length]}px`,
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
    <div className="flex flex-col items-start gap-3 border-t border-[var(--ft-border)]
      bg-[var(--ft-surface-muted)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <p className="text-[12px] tabular-nums text-[var(--ft-text-muted)]">
        {from}–{to} de {total}
      </p>

      <nav aria-label="Paginación" className="flex max-w-full items-center gap-1 overflow-x-auto">
        <PageBtn onClick={() => onPage(page - 1)} disabled={page <= 1} label="←"/>

        {pages.map((p, i) => {
          const prev = pages[i - 1]
          const gap  = prev && p - prev > 1

          return (
            <span key={p} className="flex items-center gap-1">
              {gap && (
                <span className="px-1 text-[11px] text-[var(--ft-text-subtle)]">…</span>
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
      </nav>
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
  const accessibleLabel = label === '←'
    ? 'Página anterior'
    : label === '→'
      ? 'Página siguiente'
      : `Página ${label}`

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={accessibleLabel}
      aria-current={active ? 'page' : undefined}
      className={`
        h-9 min-w-9 rounded-control px-2 text-[12px] font-medium
        transition-colors duration-fast motion-reduce:transition-none
        focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)]
        disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[var(--ft-text-muted)]
        ${active
          ? 'border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]'
          : 'text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)]'
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
    income:  'text-[var(--ft-success)]',
    expense: 'text-[var(--ft-danger)]',
    neutral: 'text-[var(--ft-text-strong)]',
  }[variant]

  const showOriginal =
    original &&
    original.currency !== preferred &&
    original.currency !== secondaryCurrency

  return (
    <div className="text-right">
      <p className={`font-mono text-sm font-semibold tabular-nums ${colorClass}`}>
        {prefix}{display}
      </p>
      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--ft-text-muted)]">
        ≈ {secondaryDisplay}
      </p>
      {showOriginal && (
        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--ft-text-muted)]">
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
      <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--ft-text-muted)]">
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
    <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--ft-text-muted)]">
      {formatted}
    </span>
  )
}

// ─── PROGRESS BAR (re-export from dashboard primitives for use in tables) ─────
export { ProgressBar } from '@/components/dashboard/primitives'
