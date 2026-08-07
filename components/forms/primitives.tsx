'use client'

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Button } from '@/components/ui/Button'

type FormFieldControlProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function mergeDescribedBy(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ') || undefined
}

function enhanceControl(
  child: ReactNode,
  controlId: string,
  describedBy: string | undefined,
  invalid: boolean,
) {
  if (!isValidElement<FormFieldControlProps>(child)) {
    return child
  }

  const existingDescribedBy = child.props['aria-describedby']
  const mergedDescribedBy = mergeDescribedBy(existingDescribedBy, describedBy)

  return cloneElement(child as ReactElement<FormFieldControlProps>, {
    id: child.props.id ?? controlId,
    'aria-describedby': mergedDescribedBy,
    'aria-invalid': invalid || child.props['aria-invalid'] ? true : undefined,
  })
}

export function FormField({
  label,
  optional = false,
  optionalLabel = 'Opcional',
  hint,
  description,
  error,
  htmlFor,
  prefix,
  suffix,
  className = '',
  controlClassName = '',
  children,
}: {
  label: string
  optional?: boolean
  optionalLabel?: string
  hint?: string
  description?: string
  error?: string
  htmlFor?: string
  prefix?: ReactNode
  suffix?: ReactNode
  className?: string
  controlClassName?: string
  children: ReactNode
}) {
  const generatedId = useId()
  const controlId = htmlFor ?? `form-field-${generatedId}`
  const hintId = hint ? `${controlId}-hint` : undefined
  const descriptionId = description ? `${controlId}-description` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = mergeDescribedBy(descriptionId, hintId, errorId)
  const child = Children.count(children) === 1 ? Children.only(children) : children
  const enhancedChild = enhanceControl(child, controlId, describedBy, Boolean(error))

  return (
    <div className={joinClasses('flex flex-col gap-[var(--ft-form-label-gap)]', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label
          htmlFor={controlId}
          className="text-[13px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--ft-text-strong)]"
        >
          {label}
          {optional ? (
            <span className="ml-2 text-[12px] font-medium text-[var(--ft-form-muted)]">
              {optionalLabel}
            </span>
          ) : null}
        </label>
        {hint ? (
          <p id={hintId} className="text-[12px] leading-[1.4] text-[var(--ft-form-muted)]">
            {hint}
          </p>
        ) : null}
      </div>

      {description ? (
        <p id={descriptionId} className="max-w-[65ch] text-[12px] leading-[1.5] text-[var(--ft-form-muted)]">
          {description}
        </p>
      ) : null}

      <div className={joinClasses('flex items-center gap-3', controlClassName)}>
        {prefix ? (
          <span className="shrink-0 text-[13px] font-medium tabular-nums text-[var(--ft-form-muted)]">
            {prefix}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">{enhancedChild}</div>
        {suffix ? (
          <span className="shrink-0 text-[13px] font-medium text-[var(--ft-form-muted)]">
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-[12px] font-medium leading-[1.45] text-[var(--ft-form-error)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function FormSection({
  title,
  description,
  columns = '1',
  className = '',
  children,
}: {
  title?: string
  description?: string
  columns?: '1' | '2' | 'auto'
  className?: string
  children: ReactNode
}) {
  const gridClassName = {
    '1': 'grid-cols-1',
    '2': 'grid-cols-1 md:grid-cols-2',
    auto: 'grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
  }[columns]

  return (
    <section className={joinClasses('space-y-[var(--ft-form-section-gap)]', className)}>
      {title || description ? (
        <div className="space-y-1">
          {title ? (
            <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--ft-text-strong)]">
              {title}
            </h3>
          ) : null}
          {description ? (
            <p className="max-w-[65ch] text-[13px] leading-6 text-[var(--ft-form-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={joinClasses('grid gap-x-[var(--ft-form-group-gap)] gap-y-[var(--ft-form-field-gap)]', gridClassName)}>
        {children}
      </div>
    </section>
  )
}

export function FormSeparator({ className = '' }: { className?: string }) {
  return (
    <div
      role="separator"
      className={joinClasses('h-px w-full bg-[var(--ft-form-border)]', className)}
    />
  )
}

export function FormActions({
  primaryAction,
  secondaryAction,
  message,
  destructive = false,
  className = '',
}: {
  primaryAction: ReactNode
  secondaryAction?: ReactNode
  message?: ReactNode
  destructive?: boolean
  className?: string
}) {
  return (
    <div
      className={joinClasses(
        'flex min-h-[var(--ft-form-footer-h)] flex-col gap-3 md:flex-row md:items-center md:justify-between',
        className,
      )}
      data-destructive={destructive ? 'true' : 'false'}
    >
      <div className="flex min-h-[44px] items-center gap-2">
        {secondaryAction ?? (
          <Button variant="ghost" size="lg">
            Cancelar
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col-reverse gap-3 md:flex-row md:items-center md:justify-end">
        {message ? (
          <p className="text-[12px] leading-[1.45] text-[var(--ft-form-muted)] md:text-right">
            {message}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2">{primaryAction}</div>
      </div>
    </div>
  )
}

export function OptionalSection({
  title = 'Mas opciones',
  summary = [],
  defaultOpen = false,
  open,
  onOpenChange,
  hasError = false,
  children,
  className = '',
}: {
  title?: string
  summary?: string[]
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (nextOpen: boolean) => void
  hasError?: boolean
  children: ReactNode
  className?: string
}) {
  const panelId = useId()
  const contentRef = useRef<HTMLDivElement>(null)
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const [contentHeight, setContentHeight] = useState(0)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  useEffect(() => {
    const element = contentRef.current
    if (!element) return

    const updateHeight = () => {
      setContentHeight(element.scrollHeight)
    }

    updateHeight()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)
    return () => observer.disconnect()
  }, [children, isOpen])

  const chips = useMemo(() => summary.filter(Boolean), [summary])

  const handleToggle = () => {
    const nextOpen = !isOpen
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  return (
    <section
      className={joinClasses(
        'rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)]',
        className,
      )}
      data-open={isOpen ? 'true' : 'false'}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={handleToggle}
        className="
          ui-pressable flex w-full items-center justify-between gap-4 rounded-[var(--ft-form-radius)]
          px-4 py-3 text-left
        "
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--ft-text-strong)]">
              {title}
            </span>
            {hasError ? (
              <span className="rounded-full bg-[var(--ft-danger-soft)] px-2 py-1 text-[11px] font-medium text-[var(--ft-form-error)]">
                Revisar
              </span>
            ) : null}
          </div>

          {!isOpen && chips.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {chips.map(chip => (
                <span
                  key={chip}
                  className="rounded-full border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--ft-form-muted)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <span
          aria-hidden="true"
          className={joinClasses(
            'shrink-0 text-[var(--ft-form-muted)] transition-transform duration-fast ease-[var(--ft-ease-out)]',
            isOpen && 'rotate-180',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      <div
        id={panelId}
        className="overflow-hidden transition-[height,opacity] duration-base ease-[var(--ft-ease-out)]"
        style={{
          height: isOpen ? `${contentHeight}px` : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div
          ref={contentRef}
          className={joinClasses(
            'space-y-[var(--ft-form-field-gap)] border-t border-[var(--ft-form-border)] px-4 py-4 transition-transform duration-base ease-[var(--ft-ease-out)]',
            isOpen ? 'translate-y-0' : '-translate-y-1',
          )}
        >
          {children}
        </div>
      </div>
    </section>
  )
}
