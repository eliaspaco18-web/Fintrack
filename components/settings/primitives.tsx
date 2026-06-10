import type { ReactNode } from 'react'

export type SettingsBadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
export type SettingsDensity = 'default' | 'compact'
export type SettingsRowVariant = 'default' | 'compact' | 'danger'

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function settingsInputClassName(className = '') {
  return joinClasses(
    'ft-settings-input w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-3 text-sm text-[var(--c-text)] outline-none',
    'placeholder:text-[var(--c-text-faint)]',
    'transition-[border-color,box-shadow,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
    'hover:border-[var(--c-border-hover)]',
    'focus:outline-none focus-visible:border-[var(--c-primary-border)] focus-visible:ring-2 focus-visible:ring-[var(--c-primary-soft)]',
    'disabled:cursor-not-allowed disabled:opacity-55',
    className,
  )
}

export function SettingsBadge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: SettingsBadgeTone
  className?: string
}) {
  const toneClassName = {
    neutral: 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-muted)]',
    accent: 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]',
    success: 'border-[color:rgba(63,127,98,0.2)] bg-[var(--c-success-soft)] text-[var(--c-success)]',
    warning: 'border-[color:rgba(169,120,47,0.18)] bg-[var(--c-warning-soft)] text-[var(--c-warning)]',
    danger: 'border-[color:rgba(184,74,74,0.2)] bg-[var(--c-danger-soft)] text-[var(--c-danger)]',
  }[tone]

  return (
    <span
      className={joinClasses(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
        toneClassName,
        className,
      )}
    >
      {children}
    </span>
  )
}

export function SettingsPanel({
  eyebrow,
  title,
  description,
  action,
  children,
  density = 'default',
  className = '',
  bodyClassName = '',
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  density?: SettingsDensity
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      data-density={density}
      className={joinClasses('ft-settings-panel', className)}
    >
      <div className="ft-settings-panel-header">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="ft-settings-eyebrow">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="ft-settings-panel-title">
            {title}
          </h2>
          {description ? (
            <p className="ft-settings-panel-description">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="ft-settings-panel-action">{action}</div> : null}
      </div>
      <div className={joinClasses('ft-settings-panel-body', bodyClassName)}>{children}</div>
    </section>
  )
}

export function SettingsSubsection({
  title,
  description,
  action,
  children,
  density = 'default',
  className = '',
  bodyClassName = '',
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  density?: SettingsDensity
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      data-density={density}
      className={joinClasses('ft-settings-subsection', className)}
    >
      <div className="ft-settings-subsection-header">
        <div className="min-w-0">
          <h3 className="ft-settings-subsection-title">{title}</h3>
          {description ? (
            <p className="ft-settings-subsection-description">{description}</p>
          ) : null}
        </div>
        {action ? <div className="ft-settings-subsection-action">{action}</div> : null}
      </div>
      <div className={joinClasses('ft-settings-subsection-body', bodyClassName)}>{children}</div>
    </section>
  )
}

export function SettingsMetric({
  label,
  value,
  caption,
  className = '',
}: {
  label: string
  value: ReactNode
  caption?: ReactNode
  className?: string
}) {
  return (
    <div className={joinClasses('ft-settings-metric', className)}>
      <p className="ft-settings-metric-label">{label}</p>
      <p className="ft-settings-metric-value">{value}</p>
      {caption ? <p className="ft-settings-metric-caption">{caption}</p> : null}
    </div>
  )
}

export function SettingsRow({
  icon,
  title,
  description,
  children,
  variant = 'default',
  className = '',
}: {
  icon?: ReactNode
  title: string
  description: string
  children?: ReactNode
  variant?: SettingsRowVariant
  className?: string
}) {
  return (
    <div
      data-variant={variant}
      className={joinClasses(
        'ft-settings-row',
        className,
      )}
    >
      <div className="ft-settings-row-copy">
        {icon ? (
          <div className="ft-settings-row-icon">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="ft-settings-row-title">{title}</p>
          <p className="ft-settings-row-description">{description}</p>
        </div>
      </div>
      {children ? <div className="ft-settings-row-action">{children}</div> : null}
    </div>
  )
}

export function SettingsToggle({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  ariaLabelledBy,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  ariaLabel?: string
  ariaLabelledBy?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={joinClasses(
        'ft-settings-switch',
        checked
          ? 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]'
          : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-faint)]',
      )}
    >
      <span
        className={joinClasses(
          'ft-settings-switch-thumb',
          checked ? 'translate-x-[18px]' : 'translate-x-0',
        )}
      >
        <span className="sr-only">{checked ? 'Activo' : 'Inactivo'}</span>
      </span>
    </button>
  )
}
