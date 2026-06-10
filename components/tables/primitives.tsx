// =============================================================================
// components/tables/primitives.tsx
// Primitivos compartidos para todas las tablas y listados.
// Diseño v3: Forest Green, cards blancas, profesional — datos financieros.
// =============================================================================

'use client'

import { type ReactNode, type InputHTMLAttributes } from 'react'
import { StatusBadge as FinanceStatusBadge } from '@/components/finance'
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
      className={`relative overflow-hidden rounded-xl border border-[var(--c-border)]
        bg-[var(--c-surface)]
        shadow-[var(--shadow-sm)] ${className}`}
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
      className={`
        px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em]
        text-[var(--c-text-faint)] border-b border-[var(--c-border)] bg-[var(--c-surface-2)]
        whitespace-nowrap
        ${sortable ? 'cursor-pointer select-none hover:text-[var(--c-text-muted)] transition-colors duration-100' : ''}
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
      <svg width="7" height="4" viewBox="0 0 7 4" className={dir === 'asc' ? 'text-[var(--c-text)]' : 'text-[var(--c-text-faint)]'}>
        <path d="M3.5 0L7 4H0L3.5 0Z" fill="currentColor"/>
      </svg>
      <svg width="7" height="4" viewBox="0 0 7 4" className={dir === 'desc' ? 'text-[var(--c-text)]' : 'text-[var(--c-text-faint)]'}>
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
      px-4 py-2.5 text-[13px] align-middle border-b border-[var(--c-border)]
      ${right ? 'text-right' : ''}
      ${muted ? 'text-[var(--c-text-muted)]' : 'text-[var(--c-text)]'}
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
    <div className={`filters-row border-b border-[var(--c-border)] bg-[var(--c-surface-2)] p-4 backdrop-blur-sm ${className}`}>
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
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-faint)] pointer-events-none"
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
          w-full pl-8 pr-3 py-1.5 rounded-lg text-[13px]
          bg-[var(--c-surface)] border border-[var(--c-border)]
          text-[var(--c-text)] placeholder:text-[var(--c-text-faint)]
          focus:outline-none focus:border-[var(--c-primary)]
          focus:ring-2 focus:ring-[var(--c-primary-soft)]
          hover:border-[var(--c-border-hover)]
          transition-[border-color,box-shadow] duration-150
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
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium
        border transition-colors duration-150 whitespace-nowrap
        ${active
          ? `border-current/30 ${color ? '' : 'bg-[var(--c-primary-soft)] text-[var(--c-primary)] border-[var(--c-primary-border)]'}`
          : 'border-[var(--c-border)] text-[var(--c-text-muted)] bg-[var(--c-surface)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] hover:border-[var(--c-border-hover)]'
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
  success:   'border-[#D4E8D1]',
  error:     'border-[#F5D0CE]',
  warning:   'border-[#F0E2B6]',
  info:      'border-[#C8DEF5]',
  pending:   'border-[var(--c-border)]',
  active:    'border-[#D4E8D1]',
  closed:    'border-[var(--c-border)]',
  overdue:   'border-[#F5D0CE]',
  paid:      'border-[#D4E8D1]',
  partial:   'border-[#F0E2B6]',
  collected: 'border-[#D4E8D1]',
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
    <div className="flex items-center justify-end gap-2
      opacity-100 transition-opacity duration-150">
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
      <td colSpan={99}>
        <div className="flex flex-col items-center justify-center py-16 text-center px-8">
          {icon && (
            <div className="w-12 h-12 rounded-2xl bg-[var(--c-surface-2)] border border-[var(--c-border)]
              flex items-center justify-center mb-4 text-[var(--c-text-faint)]">
              {icon}
            </div>
          )}
          <p className="text-sm font-semibold text-[var(--c-text)]">{title}</p>
          <p className="text-[12px] text-[var(--c-text-muted)] mt-1 max-w-xs leading-relaxed">{description}</p>
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
        <tr key={ri} className="border-b border-[var(--c-border)]">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-4 py-3">
              <div
                className="h-3 rounded animate-pulse"
                style={{
                  width: `${widths[ci % widths.length]}px`,
                  backgroundColor: 'var(--c-surface-2)',
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
      border-t border-[var(--c-border)] bg-[var(--c-surface-2)]">
      <p className="text-[11px] text-[var(--c-text-muted)] tabular-nums">
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
                <span className="text-[var(--c-text-faint)] text-[11px] px-1">…</span>
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
          ? 'bg-[var(--c-primary-soft)] text-[var(--c-primary)] border border-[var(--c-primary-border)]'
          : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)]'
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
    income:  'text-[var(--c-success)]',
    expense: 'text-[var(--c-danger)]',
    neutral: 'text-[var(--c-text)]',
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
      <p className="text-[10px] text-[var(--c-text-muted)] tabular-nums mt-0.5">
        ≈ {secondaryDisplay}
      </p>
      {showOriginal && (
        <p className="text-[10px] text-[var(--c-text-muted)] tabular-nums mt-0.5">
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
      <span className="text-[12px] text-[var(--c-text-muted)] tabular-nums whitespace-nowrap">
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
    <span className="text-[12px] text-[var(--c-text-muted)] tabular-nums whitespace-nowrap">
      {formatted}
    </span>
  )
}

// ─── PROGRESS BAR (re-export from dashboard primitives for use in tables) ─────
export { ProgressBar } from '@/components/dashboard/primitives'
