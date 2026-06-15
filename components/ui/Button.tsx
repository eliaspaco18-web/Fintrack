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
  'duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
  'focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-[color:var(--c-primary-soft)]',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg)]',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')

const VARIANT_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: [
    'border-transparent bg-[var(--c-primary)] text-[var(--c-text-on-primary)]',
    'shadow-[0_1px_2px_rgba(13,107,94,0.18)]',
    'hover:bg-[var(--c-primary-hover)] hover:shadow-[0_6px_16px_rgba(13,107,94,0.14)]',
  ].join(' '),
  secondary: [
    'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)]',
    'shadow-[0_1px_2px_rgba(25,25,23,0.04)]',
    'hover:border-[var(--c-border-hover)] hover:bg-[var(--c-surface-2)]',
  ].join(' '),
  ghost: [
    'border-transparent bg-transparent text-[var(--c-text-muted)] shadow-none',
    'hover:bg-[var(--c-surface-2)] hover:text-[var(--c-text)]',
  ].join(' '),
  danger: [
    'border-[rgba(184,74,74,0.18)] bg-[var(--c-danger-soft)] text-[var(--c-danger)]',
    'shadow-none hover:border-[rgba(184,74,74,0.28)] hover:bg-[rgba(184,74,74,0.12)]',
  ].join(' '),
  success: [
    'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]',
    'shadow-none hover:border-[rgba(13,107,94,0.22)] hover:bg-[rgba(13,107,94,0.12)]',
  ].join(' '),
}

const SIZE_CLASS_NAMES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-[12px]',
  md: 'h-9 gap-2 px-4 text-sm',
  lg: 'h-10 gap-2 px-[1.125rem] text-sm',
  'icon-sm': 'h-8 w-8 p-0 text-[13px]',
  'icon-md': 'h-9 w-9 p-0 text-sm',
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 animate-spin"
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
