'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md'

interface ButtonClassNameOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

interface BaseButtonProps extends ButtonClassNameOptions {
  children: ReactNode
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
  testId?: string
  ariaLabel?: string
  title?: string
}

interface ButtonAsButtonProps
  extends BaseButtonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  href?: never
  prefetch?: never
  scroll?: never
}

interface ButtonAsLinkProps extends BaseButtonProps {
  href: string
  prefetch?: boolean
  scroll?: boolean
  disabled?: boolean
}

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

const BASE_CLASS_NAME = [
  'ui-pressable inline-flex items-center justify-center whitespace-nowrap',
  'rounded-[var(--ft-radius-control)] border font-medium tracking-[-0.01em]',
  'transition-[background-color,border-color,color,box-shadow,transform]',
  'duration-fast ease-[var(--ft-ease-out)]',
  'focus-visible:outline-none',
  'focus-visible:ring-[3px] focus-visible:ring-[color:var(--ft-focus-ring-color)]',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ft-canvas)]',
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100',
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:translate-y-0 aria-disabled:active:scale-100',
].join(' ')

const VARIANT_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: [
    'border-transparent bg-[var(--ft-primary)] text-[var(--ft-text-on-primary)]',
    'shadow-elevation-sm hover:bg-[var(--ft-primary-hover)]',
  ].join(' '),
  secondary: [
    'border-[var(--ft-border)] bg-[var(--ft-surface)] text-[var(--ft-text-strong)]',
    'shadow-elevation-sm hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-muted)]',
  ].join(' '),
  ghost: [
    'border-transparent bg-transparent text-[var(--ft-text-muted)] shadow-none',
    'hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)]',
  ].join(' '),
  danger: [
    'border-[color-mix(in_srgb,var(--ft-danger)_18%,transparent)] bg-[var(--ft-danger-soft)] text-[var(--ft-danger)]',
    'shadow-none hover:border-[color-mix(in_srgb,var(--ft-danger)_28%,transparent)] hover:bg-[color-mix(in_srgb,var(--ft-danger)_12%,var(--ft-surface))]',
  ].join(' '),
  success: [
    'border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]',
    'shadow-none hover:border-[color-mix(in_srgb,var(--ft-primary)_24%,transparent)] hover:bg-[color-mix(in_srgb,var(--ft-primary)_12%,var(--ft-surface))]',
  ].join(' '),
}

const SIZE_CLASS_NAMES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3 text-[12px]',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-[1.125rem] text-sm',
  'icon-sm': 'h-9 w-9 p-0 text-[13px]',
  'icon-md': 'h-10 w-10 p-0 text-sm',
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </svg>
  )
}

export function buttonClassName({
  variant = 'secondary',
  size = 'md',
  className = '',
}: ButtonClassNameOptions = {}) {
  return joinClasses(
    BASE_CLASS_NAME,
    VARIANT_CLASS_NAMES[variant],
    SIZE_CLASS_NAMES[size],
    className,
  )
}

export function Button(props: ButtonProps) {
  const {
    children,
    leadingIcon,
    trailingIcon,
    loading = false,
    fullWidth = false,
    testId,
    ariaLabel,
    title,
    variant = 'secondary',
    size = 'md',
    className = '',
  } = props

  const classes = buttonClassName({
    variant,
    size,
    className: joinClasses(fullWidth && 'w-full', className),
  })

  const content = (
    <>
      {loading ? <Spinner /> : leadingIcon}
      <span>{children}</span>
      {!loading ? trailingIcon : null}
    </>
  )

  if ('href' in props && props.href) {
    return (
      <Link
        href={props.href}
        prefetch={props.prefetch}
        scroll={props.scroll}
        aria-label={ariaLabel}
        title={title}
        aria-disabled={props.disabled ? true : undefined}
        data-testid={testId}
        className={joinClasses(props.disabled && 'pointer-events-none', classes)}
      >
        {content}
      </Link>
    )
  }

  const buttonOnlyProps = props as ButtonAsButtonProps
  const {
    type = 'button',
    disabled,
    loading: _loading,
    fullWidth: _fullWidth,
    testId: _testId,
    ariaLabel: _ariaLabel,
    leadingIcon: _leadingIcon,
    trailingIcon: _trailingIcon,
    variant: _variant,
    size: _size,
    ...buttonProps
  } = buttonOnlyProps

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      title={title}
      data-testid={testId}
      data-variant={variant}
      className={classes}
    >
      {content}
    </button>
  )
}
