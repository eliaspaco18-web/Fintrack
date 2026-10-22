'use client'

import type { ReactNode } from 'react'
import {
  DataErrorBanner,
  EmptyState,
  PageLayout,
} from '@/components/finance'
import assetsStyles from '@/components/assets/AssetsListPanel.module.css'
import movementStyles from '@/components/tables/TransactionsRound07.module.css'

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
      className={`max-w-none !gap-0 ${movementStyles.v3ModuleContent}`}
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

      <div className="min-w-0 pt-1">
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
    <section className="overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)]">
      <div className="border-b border-[var(--c-border)] px-4 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--c-text)]">
                {title}
              </h2>
              {typeof count === 'number' ? (
                <span className="font-mono text-[12px] font-medium tabular-nums text-[var(--c-text-faint)]">
                  {count}
                </span>
              ) : null}
            </div>
            {description ? (
              <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                {description}
              </p>
            ) : null}
            {summary ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {summary}
              </div>
            ) : null}
          </div>

          {primaryAction ? (
            <div className="flex shrink-0 items-center gap-2">
              {primaryAction}
            </div>
          ) : null}
        </div>
      </div>

      {hasControls ? (
        <div className="border-b border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3">
          <div className="grid gap-2 lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              {search}
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 lg:justify-end">
              {filters}
              {controlsActions}
            </div>
          </div>
        </div>
      ) : null}

      {error && onRetry ? (
        <DataErrorBanner message={error} onRetry={onRetry} className="pb-3" />
      ) : null}

      {loading ? (
        loadingState
      ) : empty && emptyState ? (
        emptyState
      ) : (
        <>
          {columns && columns.length > 0 && gridClassName ? (
            <div
              className={`hidden border-b border-[var(--c-border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)] md:grid ${gridClassName}`.trim()}
            >
              {columns.map(column => (
                <span
                  key={column.label}
                  className={`${column.align === 'right' ? 'text-right' : ''} ${column.className ?? ''}`.trim()}
                >
                  {column.label}
                </span>
              ))}
            </div>
          ) : null}
          <div>{children}</div>
        </>
      )}
    </section>
  )
}

export function CatalogRow({
  gridClassName,
  accentColor,
  muted = false,
  children,
}: {
  gridClassName: string
  accentColor?: string
  muted?: boolean
  children: ReactNode
}) {
  return (
    <article
      className={`grid gap-3 border-b border-[var(--c-border)] px-4 py-4 transition-[background-color,opacity] duration-150 last:border-b-0 hover:bg-[var(--c-surface-2)] ${gridClassName} ${muted ? 'opacity-65' : ''}`.trim()}
      style={{
        boxShadow: accentColor ? `inset 2px 0 0 ${accentColor}` : undefined,
      }}
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
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-faint)] md:hidden">
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
        <p className="truncate text-sm font-semibold text-[var(--c-text)]">
          {title}
        </p>
        {(subtitle || meta) ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {subtitle ? (
              <span className="text-[12px] text-[var(--c-text-muted)]">{subtitle}</span>
            ) : null}
            {meta}
          </div>
        ) : null}
      </div>
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
