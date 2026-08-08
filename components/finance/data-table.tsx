'use client'

import { type InputHTMLAttributes, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { AppSelect } from '@/components/ui/AppSelect'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { EmptyState as FinanceEmptyState } from '@/components/finance/primitives'

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function DataTable({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={joinClasses(
        'relative overflow-hidden rounded-xl border border-[var(--c-border)]',
        'bg-[var(--c-surface)] shadow-[var(--shadow-sm)]',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function DataToolbar({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={joinClasses(
        'border-b border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3',
        className,
      )}
    >
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

export function DataToolbarRow({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={joinClasses('filters-row', className)}>
      {children}
    </div>
  )
}

interface DataSearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
}

export function DataSearchField({
  value,
  onChange,
  placeholder = 'Buscar…',
  className = '',
  ...props
}: DataSearchFieldProps) {
  return (
    <div className={joinClasses('relative', className)}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-faint)]"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        {...props}
        className={joinClasses(
          'w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)]',
          'py-1.5 pl-8 pr-3 text-[13px] text-[var(--c-text)]',
          'placeholder:text-[var(--c-text-faint)]',
          'transition-[border-color,box-shadow] duration-150',
          'hover:border-[var(--c-border-hover)] focus:border-[var(--c-primary)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--c-primary-soft)]',
          className,
        )}
      />
    </div>
  )
}

interface DataFilterPresetProps {
  label: string
  active: boolean
  onClick: () => void
  count?: number
  color?: string
  testId?: string
}

export function DataFilterPreset({
  label,
  active,
  onClick,
  count,
  color,
  testId,
}: DataFilterPresetProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={joinClasses(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5',
        'text-[12px] font-medium whitespace-nowrap transition-colors duration-150',
        active
          ? color
            ? ''
            : 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]'
          : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-muted)] hover:border-[var(--c-border-hover)] hover:bg-[var(--c-surface)] hover:text-[var(--c-text)]',
      )}
      style={active && color ? {
        backgroundColor: `${color}18`,
        color,
        borderColor: `${color}35`,
      } : undefined}
    >
      {label}
      {count !== undefined && count > 0 ? (
        <span className={joinClasses('text-[10px] tabular-nums', active ? 'opacity-65' : 'opacity-50')}>
          {count}
        </span>
      ) : null}
    </button>
  )
}

interface DataSelectOption {
  value: string
  label: string
  hint?: string
}

export function DataSortSelect({
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  testId,
}: {
  options: DataSelectOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  testId?: string
}) {
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

export function DataErrorBanner({
  message,
  onRetry,
  className = '',
}: {
  message: string
  onRetry: () => void
  className?: string
}) {
  return (
    <div className={joinClasses('px-4 pt-3', className)}>
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-surface border border-[color-mix(in_srgb,var(--ft-danger)_22%,var(--ft-border))] bg-[var(--ft-danger-soft)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <svg
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--ft-danger)]"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <p className="text-[13px] font-medium leading-5 text-[var(--ft-danger)]">{message}</p>
        </div>
        <Button
          type="button"
          onClick={onRetry}
          variant="danger"
          size="sm"
          className="w-full shrink-0 focus-visible:ring-offset-[var(--ft-danger-soft)] sm:w-auto"
        >
          Reintentar
        </Button>
      </div>
    </div>
  )
}

interface SavedViewOption {
  value: string
  label: string
}

export function SavedViewsToolbar({
  value,
  options,
  onChange,
  onSave,
  onDelete,
  deleteDisabled = false,
  className = '',
  selectTestId,
  saveTestId,
  deleteTestId,
}: {
  value: string
  options: SavedViewOption[]
  onChange: (value: string) => void
  onSave: () => void
  onDelete: () => void
  deleteDisabled?: boolean
  className?: string
  selectTestId?: string
  saveTestId?: string
  deleteTestId?: string
}) {
  return (
    <div className={joinClasses('flex w-full flex-wrap items-center gap-2 md:justify-end', className)}>
      <AppSelect
        value={value}
        onChange={onChange}
        testId={selectTestId}
        className="filters-control sm:w-[165px]"
        compact
        searchPlaceholder="Buscar vista..."
        options={options}
      />
      <Button type="button" onClick={onSave} testId={saveTestId} variant="secondary" size="sm">
        Guardar vista
      </Button>
      <Button
        type="button"
        onClick={onDelete}
        testId={deleteTestId}
        disabled={deleteDisabled}
        variant="danger"
        size="sm"
      >
        Eliminar vista
      </Button>
    </div>
  )
}

export function DataEmptyStateRow({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
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

interface DataPaginationProps {
  page: number
  totalPages: number
  total: number
  perPage: number
  onPage: (page: number) => void
}

function DataPageButton({
  onClick,
  disabled,
  active,
  label,
}: {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={joinClasses(
        'h-7 min-w-[28px] rounded-lg px-2 text-[12px] font-medium',
        'transition-all duration-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ft-focus-ring-color)]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[var(--ft-text-muted)]',
        active
          ? 'border border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]'
          : 'text-[var(--c-text-muted)] hover:bg-[var(--c-surface)] hover:text-[var(--c-text)]',
      )}
    >
      {label}
    </button>
  )
}

export function DataPagination({
  page,
  totalPages,
  total,
  perPage,
  onPage,
}: DataPaginationProps) {
  if (totalPages <= 1) return null

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(current =>
    current === 1 || current === totalPages || (current >= page - 1 && current <= page + 1),
  )

  return (
    <div className="flex items-center justify-between border-t border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3">
      <p className="text-[11px] text-[var(--c-text-muted)] tabular-nums">
        {from}–{to} de {total}
      </p>

      <div className="flex items-center gap-1">
        <DataPageButton onClick={() => onPage(page - 1)} disabled={page <= 1} label="←" />

        {pages.map((current, index) => {
          const previous = pages[index - 1]
          const gap = previous && current - previous > 1

          return (
            <span key={current} className="flex items-center gap-1">
              {gap ? <span className="px-1 text-[11px] text-[var(--c-text-faint)]">…</span> : null}
              <DataPageButton
                onClick={() => onPage(current)}
                active={current === page}
                label={String(current)}
              />
            </span>
          )
        })}

        <DataPageButton onClick={() => onPage(page + 1)} disabled={page >= totalPages} label="→" />
      </div>
    </div>
  )
}

interface DataRowAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
  testId?: string
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

export function DataRowActions({ actions }: { actions: DataRowAction[] }) {
  return (
    <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity duration-150">
      {actions.map((action, index) => (
        <ActionIconButton
          key={index}
          onClick={event => {
            event.stopPropagation()
            action.onClick()
          }}
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

export function DataRefreshIndicator({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-t border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-4 py-2 text-center"
    >
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5 animate-spin text-[var(--ft-primary)] motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M21 12a9 9 0 1 1-6.22-8.56" />
      </svg>
      <p className="text-[11px] font-medium text-[var(--ft-text-muted)]">Actualizando…</p>
    </div>
  )
}
