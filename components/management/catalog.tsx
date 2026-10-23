'use client'

import type { ReactNode } from 'react'
import {
  DataErrorBanner,
  EmptyState,
  PageLayout,
} from '@/components/finance'
import assetsStyles from '@/components/assets/AssetsListPanel.module.css'
import movementStyles from '@/components/tables/TransactionsRound07.module.css'
import styles from '@/components/management/CatalogWorkspace.module.css'
import { AnchoredActionMenu, type AnchoredAction } from '@/components/ui/AnchoredActionMenu'

export interface CatalogNavItem<T extends string> {
  key: T
  label: string
}

export function CatalogAdminLayout<T extends string>({
  title,
  description,
  action,
  nav,
  activeKey,
  onSelect,
  children,
}: {
  title: string
  description: string
  action?: ReactNode
  nav: CatalogNavItem<T>[]
  activeKey: T
  onSelect: (key: T) => void
  children: ReactNode
}) {
  return (
    <PageLayout
      className={`max-w-none !gap-0 ${movementStyles.v3ModuleContent} ${styles.workspace}`}
      header={(
        <header className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]">{title}</h1>
            <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]">{description}</p>
          </div>
          {action ? <div className="flex w-full items-center sm:w-auto sm:shrink-0">{action}</div> : null}
        </header>
      )}
    >
      <nav aria-label="Catálogos" className={`${movementStyles.tabs} ${assetsStyles.tabs} mb-3`} data-testid="catalog-tabs">
        {nav.map(item => (
          <button
            key={item.key}
            type="button"
            aria-current={item.key === activeKey ? 'page' : undefined}
            aria-pressed={item.key === activeKey}
            data-active={item.key === activeKey}
            className={assetsStyles.tab}
            onClick={() => onSelect(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={`${styles.content} min-w-0 pt-1`}>
        {children}
      </div>
    </PageLayout>
  )
}

export function CatalogTable({
  title,
  description,
  count,
  summary,
  primaryAction,
  search,
  filters,
  controlsActions,
  error,
  onRetry,
  loading,
  empty = false,
  loadingState,
  emptyState,
  columns,
  gridClassName,
  children,
}: {
  title: string
  description?: string
  count?: number
  summary?: ReactNode
  primaryAction?: ReactNode
  search?: ReactNode
  filters?: ReactNode
  controlsActions?: ReactNode
  error?: string | null
  onRetry?: () => void
  loading?: boolean
  empty?: boolean
  loadingState?: ReactNode
  emptyState?: ReactNode
  columns?: Array<{ label: string; align?: 'left' | 'right'; className?: string }>
  gridClassName?: string
  children?: ReactNode
}) {
  const hasControls = Boolean(search || filters || controlsActions)

  return (
    <section className={styles.catalog} data-testid="catalog-listing">
      <div className={styles.context}>
        <div className={styles.contextTitle}>
          <h2>{title}</h2>
          {typeof count === 'number' ? <span>{count}</span> : null}
          {description ? <p>{description}</p> : null}
        </div>
        {summary ? <div className={styles.summary}>{summary}</div> : null}
        {primaryAction ? <div className={styles.contextAction}>{primaryAction}</div> : null}
      </div>

      {hasControls ? (
        <div className={styles.controls} data-testid="catalog-controls">
          <div className={styles.search}>
            <div className="min-w-0">
              {search}
            </div>
            <div className={styles.filters}>
              {filters}
              {controlsActions}
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.list}>
        {error && onRetry ? <DataErrorBanner message={error} onRetry={onRetry} className="pb-3" /> : null}
        {loading ? loadingState : empty && emptyState ? emptyState : (
          <>
            {columns && columns.length > 0 && gridClassName ? (
              <div className={`hidden ${styles.tableHead} md:grid ${gridClassName}`.trim()} data-testid="catalog-table-head">
                {columns.map(column => (
                  <span key={column.label} className={`${column.align === 'right' ? 'text-right' : ''} ${column.className ?? ''}`.trim()}>
                    {column.label}
                  </span>
                ))}
              </div>
            ) : null}
            <div>{children}</div>
          </>
        )}
      </div>
    </section>
  )
}

export function CatalogRow({
  gridClassName,
  muted = false,
  testId,
  'data-testid': dataTestId,
  children,
}: {
  gridClassName: string
  muted?: boolean
  testId?: string
  'data-testid'?: string
  children: ReactNode
}) {
  return (
    <article
      data-testid={testId ?? dataTestId}
      className={`${styles.row} grid gap-3 border-b border-[var(--ft-border)] px-4 transition-[background-color,opacity] duration-150 last:border-b-0 hover:bg-[var(--ft-surface-hover)] ${gridClassName} ${muted ? 'opacity-65' : ''}`.trim()}
    >
      {children}
    </article>
  )
}

export function CatalogCell({
  label,
  align = 'left',
  children,
}: {
  label?: string
  align?: 'left' | 'right'
  children: ReactNode
}) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'md:text-right' : ''}`.trim()}>
      {label ? (
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--ft-text-muted)] md:hidden">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  )
}

export function CatalogIdentity({
  icon,
  title,
  subtitle,
  meta,
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {icon ? <div className="shrink-0">{icon}</div> : null}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-[19px] text-[var(--ft-text-strong)]">
          {title}
        </p>
        {(subtitle || meta) ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {subtitle ? (
              <span className="text-[11px] leading-4 text-[var(--ft-text-muted)]">{subtitle}</span>
            ) : null}
            {meta}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Shared compact row actions: direct Edit plus the approved contextual menu. */
export function CatalogRowActions({
  label,
  editLabel = 'Editar',
  onEdit,
  actions,
  disabled = false,
}: {
  label: string
  editLabel?: string
  onEdit: () => void
  actions: AnchoredAction[]
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        aria-label={`${editLabel} ${label}`}
        className="min-h-9 rounded-control px-2.5 text-[11px] font-semibold text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-muted)] hover:text-[var(--ft-text-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ft-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {editLabel}
      </button>
      <AnchoredActionMenu
        label={`Más acciones para ${label}`}
        disabled={disabled || actions.length === 0}
        actions={actions}
        align="end"
        triggerContent={(
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        )}
        className="grid h-9 w-9 place-items-center rounded-control text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-muted)] hover:text-[var(--ft-text-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ft-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}

export function CatalogEmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="p-4">
      <EmptyState compact title={title} description={description} action={action} />
    </div>
  )
}
