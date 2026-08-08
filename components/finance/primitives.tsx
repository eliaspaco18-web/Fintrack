'use client'

import {
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import Link from 'next/link'
import { FocusTrap } from '@/components/ui/accessibility'
import { Button, buttonClassName } from '@/components/ui/Button'
import { ModalOverlayPortal } from '@/components/ui/ModalOverlayPortal'

type Tone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'

type StatusBadgeTone = Tone | 'muted'

function toneClasses(tone: Exclude<Tone, 'neutral'> | 'neutral') {
  const tones = {
    neutral: {
      badge: 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-text-muted)]',
      text: 'text-[var(--c-text)]',
      subtle: 'text-[var(--c-text-muted)]',
      progress: 'bg-[var(--c-border-hover)]',
      progressSoft: 'bg-[var(--c-surface-2)]',
    },
    primary: {
      badge: 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]',
      text: 'text-[var(--c-primary)]',
      subtle: 'text-[var(--c-text-muted)]',
      progress: 'bg-[var(--c-primary)]',
      progressSoft: 'bg-[var(--c-primary-soft)]',
    },
    success: {
      badge: 'border-[var(--c-success)]/15 bg-[var(--c-success-soft)] text-[var(--c-success)]',
      text: 'text-[var(--c-success)]',
      subtle: 'text-[var(--c-text-muted)]',
      progress: 'bg-[var(--c-success)]',
      progressSoft: 'bg-[var(--c-success-soft)]',
    },
    warning: {
      badge: 'border-[var(--c-warning)]/15 bg-[var(--c-warning-soft)] text-[var(--c-warning)]',
      text: 'text-[var(--c-warning)]',
      subtle: 'text-[var(--c-text-muted)]',
      progress: 'bg-[var(--c-warning)]',
      progressSoft: 'bg-[var(--c-warning-soft)]',
    },
    danger: {
      badge: 'border-[var(--c-danger)]/15 bg-[var(--c-danger-soft)] text-[var(--c-danger)]',
      text: 'text-[var(--c-danger)]',
      subtle: 'text-[var(--c-text-muted)]',
      progress: 'bg-[var(--c-danger)]',
      progressSoft: 'bg-[var(--c-danger-soft)]',
    },
    info: {
      badge: 'border-[var(--c-info)]/15 bg-[var(--c-info-soft)] text-[var(--c-info)]',
      text: 'text-[var(--c-info)]',
      subtle: 'text-[var(--c-text-muted)]',
      progress: 'bg-[var(--c-info)]',
      progressSoft: 'bg-[var(--c-info-soft)]',
    },
  } as const

  return tones[tone]
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function surfaceClassName(extra = '') {
  return `rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] ${extra}`.trim()
}

export type ModuleHeaderMode = 'full' | 'content' | 'hidden'

interface SimpleAction {
  label: string
  href?: string
  onClick?: () => void
}

function InlineAction({ action }: { action: SimpleAction }) {
  if (action.href) {
    return (
      <Button href={action.href} variant="secondary" size="md">
        {action.label}
      </Button>
    )
  }

  return (
    <Button type="button" onClick={action.onClick} variant="secondary" size="md">
      {action.label}
    </Button>
  )
}

export function PageLayout({
  header,
  stats,
  controls,
  children,
  className = '',
}: {
  header?: ReactNode
  stats?: ReactNode
  controls?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`mx-auto flex w-full max-w-[1440px] flex-col gap-4 pb-10 ${className}`.trim()}>
      {header}
      {stats}
      {controls}
      {children}
    </div>
  )
}

export function RegisterModule({
  eyebrow,
  title,
  description,
  actions,
  headerMode = 'full',
  stats,
  controls,
  children,
  className = '',
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  headerMode?: ModuleHeaderMode
  stats?: ReactNode
  controls?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <PageLayout
      className={`max-w-[1320px] gap-5 ${className}`.trim()}
      header={(
        <ModuleHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={actions}
          mode={headerMode}
        />
      )}
      stats={stats}
      controls={controls}
    >
      {children}
    </PageLayout>
  )
}

export function ModuleHeader({
  eyebrow,
  title,
  description,
  actions,
  mode = 'full',
  className = '',
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  mode?: ModuleHeaderMode
  className?: string
}) {
  if (mode === 'hidden') {
    return actions ? (
      <div className={`flex justify-end ${className}`.trim()}>
        {actions}
      </div>
    ) : null
  }

  if (mode === 'content') {
    return (
      <header
        className={`flex items-center justify-between gap-3 border-b border-[var(--c-border)] pb-3 ${className}`.trim()}
      >
        <div className="min-w-0">
          {eyebrow ? (
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
              {eyebrow}
            </p>
          ) : null}
          {description ? (
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--c-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
    )
  }

  return (
    <header
      className={`flex flex-col gap-3 border-b border-[var(--c-border)] pb-4 md:flex-row md:items-end md:justify-between ${className}`.trim()}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[var(--c-text)] md:text-[26px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--c-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function StatGrid({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`.trim()}>
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  detail,
  caption,
  tone = 'neutral',
  icon,
  className = '',
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  caption?: ReactNode
  tone?: Tone
  icon?: ReactNode
  className?: string
}) {
  const styles = toneClasses(tone)

  return (
    <section className={`${surfaceClassName('px-4 py-3')} ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-[0.02em] text-[var(--c-text-faint)]">
            {label}
          </p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <strong className={`truncate font-mono text-xl font-semibold tabular-nums ${styles.text}`}>
              {value}
            </strong>
            {detail ? (
              <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-[11px] font-medium ${styles.badge}`}>
                {detail}
              </span>
            ) : null}
          </div>
          {caption ? (
            <p className="mt-2 text-[12px] leading-5 text-[var(--c-text-muted)]">
              {caption}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-text-muted)]">
            {icon}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function ControlsBar({
  presets,
  search,
  filters,
  actions,
  viewToggle,
  className = '',
}: {
  presets?: ReactNode
  search?: ReactNode
  filters?: ReactNode
  actions?: ReactNode
  viewToggle?: ReactNode
  className?: string
}) {
  const hasSecondaryRow = Boolean(search || filters)

  return (
    <section className={`${surfaceClassName('p-3')} ${className}`.trim()}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">{presets}</div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {viewToggle}
            {actions}
          </div>
        </div>

        {hasSecondaryRow ? (
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_auto] md:items-start">
            <div className="min-w-0">{search}</div>
            <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 md:justify-end">
              {filters}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function FilterBar({
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  )
}

export function StatusBadge({
  children,
  tone = 'neutral',
  className = '',
  dot = true,
}: {
  children: ReactNode
  tone?: StatusBadgeTone
  className?: string
  dot?: boolean
}) {
  const resolvedTone = tone === 'muted' ? 'neutral' : tone
  const styles = toneClasses(resolvedTone)
  const mutedClass = tone === 'muted' ? 'text-[var(--c-text-faint)]' : ''

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap ${styles.badge} ${mutedClass} ${className}`.trim()}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  )
}

export function AmountCell({
  label,
  value,
  meta,
  tone = 'neutral',
  align = 'right',
  className = '',
}: {
  label?: ReactNode
  value: ReactNode
  meta?: ReactNode
  tone?: Tone
  align?: 'left' | 'right'
  className?: string
}) {
  const styles = toneClasses(tone)
  const alignClass = align === 'right' ? 'items-end text-right' : 'items-start text-left'

  return (
    <div className={`flex min-w-0 flex-col ${alignClass} ${className}`.trim()}>
      {label ? (
        <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-faint)]">
          {label}
        </p>
      ) : null}
      <p className={`font-mono text-sm font-semibold tabular-nums ${styles.text}`}>
        {value}
      </p>
      {meta ? (
        <p className={`text-[11px] ${styles.subtle}`}>
          {meta}
        </p>
      ) : null}
    </div>
  )
}

export function ProgressMetric({
  value,
  label,
  valueLabel,
  description,
  tone = 'neutral',
  className = '',
}: {
  value: number
  label?: ReactNode
  valueLabel?: ReactNode
  description?: ReactNode
  tone?: Tone
  className?: string
}) {
  const percentage = useMemo(() => clampPercentage(value), [value])
  const styles = toneClasses(tone)

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`.trim()}>
      {(label || valueLabel) ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium text-[var(--c-text-muted)]">{label}</p>
          <p className={`text-[11px] font-semibold tabular-nums ${styles.text}`}>
            {valueLabel ?? `${Math.round(percentage)}%`}
          </p>
        </div>
      ) : null}
      <div className={`h-2 overflow-hidden rounded-full ${styles.progressSoft}`}>
        <div
          className={`h-full rounded-full ${styles.progress}`}
          style={{
            width: `${percentage}%`,
            transition: 'width var(--transition-base)',
          }}
        />
      </div>
      {description ? (
        <p className="text-[11px] text-[var(--c-text-faint)]">{description}</p>
      ) : null}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
  compact = false,
}: {
  icon?: ReactNode
  title: string
  description: string
  action?: SimpleAction | ReactNode
  className?: string
  compact?: boolean
}) {
  const resolvedAction =
    action && typeof action === 'object' && 'label' in action
      ? <InlineAction action={action as SimpleAction} />
      : action

  return (
    <div
      className={`${surfaceClassName(compact ? 'px-5 py-8' : 'px-6 py-14')} flex flex-col items-center justify-center text-center ${className}`.trim()}
    >
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-text-faint)]">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-[var(--c-text)]">{title}</p>
      <p className="mt-1.5 max-w-sm text-[12px] leading-6 text-[var(--c-text-muted)]">
        {description}
      </p>
      {resolvedAction ? <div className="mt-5">{resolvedAction}</div> : null}
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  loading = false,
  danger = false,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  testId,
  cancelTestId,
  confirmTestId,
}: {
  open: boolean
  title: string
  message: ReactNode
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  danger?: boolean
  confirmLabel?: string
  cancelLabel?: string
  testId?: string
  cancelTestId?: string
  confirmTestId?: string
}) {
  const titleId = useId()
  const descriptionId = useId()

  if (!open) return null

  return (
    <ModalOverlayPortal className="z-modal" data-testid={testId} onClick={() => {
      if (!loading) onCancel()
    }}>
      <FocusTrap active={open} onEscape={() => {
        if (!loading) onCancel()
      }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          aria-busy={loading || undefined}
          className="mx-auto flex min-h-full w-full items-center justify-center px-4 py-4"
        >
          <div
            className="w-full max-w-sm rounded-modal border border-[var(--ft-border)] bg-[var(--ft-modal-bg)] p-6 shadow-elevation-xl"
          >
            <h3 id={titleId} className="text-base font-semibold tracking-[-0.02em] text-[var(--ft-text-strong)]">
              {title}
            </h3>
            <div id={descriptionId} className="mt-2 text-sm leading-6 text-[var(--ft-text-muted)]">
              {message}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                onClick={onCancel}
                testId={cancelTestId}
                disabled={loading}
                variant="secondary"
                size="md"
                className="w-full focus-visible:ring-offset-[var(--ft-modal-bg)] sm:w-auto"
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                testId={confirmTestId}
                loading={loading}
                variant={danger ? 'danger' : 'primary'}
                size="md"
                className="w-full focus-visible:ring-offset-[var(--ft-modal-bg)] sm:w-auto"
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </ModalOverlayPortal>
  )
}

export function DetailDrawer({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  width = 520,
  side = 'right',
  inset = false,
}: {
  open: boolean
  title: string
  description?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
  side?: 'right' | 'left'
  inset?: boolean
}) {
  const titleId = useId()
  const descriptionId = useId()
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  if (!open && !mounted) return null

  return (
    <ModalOverlayPortal
      className="z-overlay"
      onClick={() => onClose()}
      onTransitionEnd={() => {
        if (!open) setMounted(false)
      }}
    >
      <FocusTrap active={open} onEscape={onClose}>
        <div
          className={`flex min-h-full w-screen ${side === 'right' ? 'justify-end' : 'justify-start'} ${inset ? 'p-3 sm:p-4' : ''}`}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className={`flex w-full max-w-full flex-col border border-[var(--ft-border)] bg-[var(--ft-modal-bg)] shadow-elevation-xl ${
                inset
                  ? 'h-[calc(100dvh-24px)] rounded-panel'
                  : `h-dvh rounded-none border-y-0 ${side === 'right' ? 'border-r-0 md:rounded-l-panel' : 'border-l-0 md:rounded-r-panel'}`
              }`}
            style={{
              width: inset ? `min(calc(100vw - 24px), ${width}px)` : `min(100vw, ${width}px)`,
              transform: open
                ? 'translateX(0)'
                : side === 'right'
                  ? 'translateX(var(--ft-space-3))'
                  : 'translateX(calc(var(--ft-space-3) * -1))',
              opacity: open ? 1 : 0,
              transition: 'transform var(--ft-duration-base) var(--ft-ease-out), opacity var(--ft-duration-base) var(--ft-ease-out)',
            }}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--ft-border)] bg-[var(--ft-modal-bg)] px-5 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold tracking-[-0.02em] text-[var(--ft-text-strong)]">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1 max-w-[65ch] text-sm leading-6 text-[var(--ft-text-muted)]">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className={buttonClassName({
                  variant: 'secondary',
                  size: 'icon-md',
                  className: 'shrink-0 focus-visible:ring-offset-[var(--ft-modal-bg)]',
                })}
                aria-label="Cerrar panel"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              {children}
            </div>

            {footer ? (
              <footer className="shrink-0 border-t border-[var(--ft-border)] bg-[var(--ft-modal-bg)] px-5 py-4">
                {footer}
              </footer>
            ) : null}
          </aside>
        </div>
      </FocusTrap>
    </ModalOverlayPortal>
  )
}
