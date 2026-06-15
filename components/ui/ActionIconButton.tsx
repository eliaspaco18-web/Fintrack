'use client'

import { type ButtonHTMLAttributes, type ReactNode, useId } from 'react'
import { Button } from '@/components/ui/Button'

type ActionIcon = 'view' | 'edit' | 'delete' | 'use' | 'deactivate' | 'reactivate' | 'settings'
type ActionVariant = 'default' | 'danger' | 'success'

interface BaseProps {
  label: string
  icon: ActionIcon
  variant?: ActionVariant
  className?: string
  testId?: string
  disabled?: boolean
  title?: string
  description?: string
}

interface ButtonProps extends BaseProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  href?: never
}

interface LinkProps extends BaseProps {
  href: string
}

type ActionIconButtonProps = ButtonProps | LinkProps

function iconSvg(icon: ActionIcon): ReactNode {
  switch (icon) {
    case 'view':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )
    case 'edit':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>
        </svg>
      )
    case 'delete':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 6h18"/>
          <path d="M8 6V4h8v2"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      )
    case 'use':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14"/>
          <path d="m12 5 7 7-7 7"/>
        </svg>
      )
    case 'deactivate':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="8"/>
          <path d="M8 12h8"/>
        </svg>
      )
    case 'reactivate':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
          <path d="M21 3v6h-6"/>
        </svg>
      )
    case 'settings':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 3a2 2 0 0 1 2 2v1.1a7 7 0 0 1 1.9.78l.78-.78a2 2 0 1 1 2.83 2.83l-.78.78c.33.6.59 1.24.77 1.9H21a2 2 0 1 1 0 4h-1.1a7 7 0 0 1-.77 1.9l.78.78a2 2 0 0 1-2.83 2.83l-.78-.78a7 7 0 0 1-1.9.78V21a2 2 0 1 1-4 0v-1.1a7 7 0 0 1-1.9-.78l-.78.78a2 2 0 1 1-2.83-2.83l.78-.78a7 7 0 0 1-.78-1.9H3a2 2 0 1 1 0-4h1.1c.19-.66.45-1.3.78-1.9l-.78-.78a2 2 0 1 1 2.83-2.83l.78.78A7 7 0 0 1 10 6.1V5a2 2 0 0 1 2-2Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )
    default:
      return null
  }
}

function resolveIconColor(variant: ActionVariant): string {
  if (variant === 'danger') {
    return 'text-[var(--c-danger)]'
  }
  if (variant === 'success') {
    return 'text-[var(--c-primary)]'
  }
  return 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
}

function baseClasses(variant: ActionVariant, className: string): string {
  return `rounded-[10px] ${resolveIconColor(variant)} ${className}`.trim()
}

function resolveButtonVariant(variant: ActionVariant) {
  if (variant === 'danger') return 'danger' as const
  if (variant === 'success') return 'success' as const
  return 'secondary' as const
}

function resolveTooltipDot(variant: ActionVariant): string {
  if (variant === 'danger') return 'bg-[var(--c-danger)]'
  if (variant === 'success') return 'bg-[var(--c-primary)]'
  return 'bg-[var(--c-text-faint)]'
}

export function ActionIconButton(props: ActionIconButtonProps) {
  const {
    label,
    icon,
    variant = 'default',
    className = '',
    testId,
    title,
    description,
  } = props

  const tooltipId = useId()
  const classes = baseClasses(variant, className)
  const iconNode = iconSvg(icon)
  const buttonTitle = title ?? label
  const hasTooltip = buttonTitle.trim().length > 0 || Boolean(description)

  const tooltip = hasTooltip ? (
    <span
      id={tooltipId}
      role="tooltip"
      className="
        pointer-events-none absolute bottom-[calc(100%+10px)] right-0 z-[60] hidden w-56
        origin-bottom-right rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)]
        px-3.5 py-3 text-left opacity-0 shadow-[var(--shadow-md)]
        transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]
        translate-y-1 sm:block group-hover/action:translate-y-0 group-hover/action:opacity-100
        group-focus-within/action:translate-y-0 group-focus-within/action:opacity-100
      "
    >
      <span
        aria-hidden="true"
        className="absolute -bottom-1 right-4 h-2.5 w-2.5 rotate-45 border-b border-r border-[var(--c-border)] bg-[var(--c-surface)]"
      />
      <span className="relative block">
        <span className="mb-1.5 flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${resolveTooltipDot(variant)}`.trim()} />
          <span className="text-[11px] font-semibold leading-none tracking-[-0.01em] text-[var(--c-text)]">
            {buttonTitle}
          </span>
        </span>
        {description ? (
          <span className="block text-[11px] leading-[1.45] text-[var(--c-text-muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </span>
  ) : null

  if ('href' in props && props.href) {
    return (
      <span className="group/action relative inline-flex align-middle">
        <Button
          href={props.href}
          ariaLabel={label}
          testId={testId}
          variant={resolveButtonVariant(variant)}
          size="icon-sm"
          className={classes}
        >
          {iconNode}
        </Button>
        {tooltip}
      </span>
    )
  }

  const buttonProps = props as ButtonProps
  const { disabled, onClick } = buttonProps
  return (
    <span className="group/action relative inline-flex align-middle">
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled}
        ariaLabel={label}
        aria-describedby={hasTooltip ? tooltipId : undefined}
        testId={testId}
        variant={resolveButtonVariant(variant)}
        size="icon-sm"
        className={`${classes} disabled:opacity-45`}
      >
        {iconNode}
      </Button>
      {tooltip}
    </span>
  )
}
