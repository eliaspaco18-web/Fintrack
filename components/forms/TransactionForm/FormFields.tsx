// =============================================================================
// components/forms/TransactionForm/FormFields.tsx
// Primitivos de formulario del proyecto.
// Cada componente acepta react-hook-form registration + estado de error.
// Diseño: oscuro, refinado, con micro-animaciones en foco y error.
// =============================================================================

'use client'

import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { AppSelect, type AppSelectOption } from '@/components/ui/AppSelect'
import { NumericInput } from '@/components/ui/NumericInput'

// ─── TIPOS BASE ───────────────────────────────────────────────────────────────

interface FieldWrapperProps {
  label?:    string
  required?: boolean
  optional?: boolean
  optionalLabel?: string
  error?:    string
  hint?:     string
  description?: string
  children:  ReactNode
  className?: string
}

// ─── FIELD WRAPPER ────────────────────────────────────────────────────────────

export function FieldWrapper({
  label, required, optional = false, optionalLabel = 'Opcional', error, hint, description, children, className = '',
}: FieldWrapperProps) {
  return (
    <div className={`flex flex-col gap-[var(--ft-form-label-gap)] ${className}`}>
      {label && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <label className="text-[13px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--c-text)]">
            {label}
            {optional && (
              <span className="ml-2 text-[12px] font-medium text-[var(--ft-form-muted)]">
                {optionalLabel}
              </span>
            )}
          </label>
          {hint && (
            <span className="text-[12px] leading-[1.4] text-[var(--ft-form-muted)]">
              {hint}
            </span>
          )}
        </div>
      )}
      {description && (
        <p className="max-w-[65ch] text-[12px] leading-[1.5] text-[var(--ft-form-muted)]">
          {description}
        </p>
      )}
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-[12px] font-medium leading-[1.45] text-[var(--ft-form-error)]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

// ─── INPUT ────────────────────────────────────────────────────────────────────

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string
  numericDecimals?: number
  numericAllowNegative?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({
    error,
    className = '',
    type,
    numericDecimals,
    numericAllowNegative,
    min,
    step,
    ...props
  }, ref) {
    const baseClassName = `
      ft-form-input w-full px-3.5 py-2.5 rounded-lg text-sm font-medium tabular-nums
      bg-[var(--c-surface-2)] text-[var(--c-text)] placeholder:text-[var(--c-text-faint)]
      border transition-[border-color,box-shadow,background-color,color] duration-150 outline-none
      focus:ring-2 ring-offset-0
      ${error
        ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15'
        : 'border-[var(--c-border)] hover:border-[var(--c-border-hover)] focus:border-[rgba(14,79,70,0.35)] focus:ring-[rgba(14,79,70,0.10)]'
      }
      disabled:opacity-40 disabled:cursor-not-allowed
      ${className}
    `

    if (type === 'number') {
      const resolvedAllowNegative = numericAllowNegative ?? (() => {
        if (typeof min === 'number') return min < 0
        if (typeof min === 'string' && min.trim().length > 0) return Number(min) < 0
        return false
      })()

      return (
        <NumericInput
          ref={ref}
          {...props}
          min={min}
          step={step}
          decimals={numericDecimals}
          allowNegative={resolvedAllowNegative}
          className={baseClassName}
        />
      )
    }

    return (
      <input
        ref={ref}
        {...props}
        type={type}
        className={`
          ${baseClassName}
        `}
      />
    )
  }
)

// ─── SELECT ───────────────────────────────────────────────────────────────────

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  error?:       string
  placeholder?: string
  compact?:     boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({
    error,
    placeholder,
    compact = false,
    children,
    className = '',
    onChange,
    onBlur,
    value: controlledValue,
    defaultValue,
    disabled,
    required,
    name,
    ...props
  }, ref) {
    const selectRef = useRef<HTMLSelectElement | null>(null)
    const [uncontrolledValue, setUncontrolledValue] = useState<string>(
      String(defaultValue ?? ''),
    )

    const isControlled = controlledValue !== undefined
    const currentValue = String(isControlled ? controlledValue ?? '' : uncontrolledValue)

    const setRefs = useCallback((node: HTMLSelectElement | null) => {
      selectRef.current = node
      if (typeof ref === 'function') {
        ref(node)
        return
      }
      if (ref) {
        ref.current = node
      }
    }, [ref])

    const toOptionLabel = useCallback((child: ReactNode): string => {
      if (typeof child === 'string' || typeof child === 'number') return String(child)
      if (Array.isArray(child)) return child.map(item => toOptionLabel(item)).join('')
      if (!isValidElement(child)) return ''
      return toOptionLabel(child.props.children)
    }, [])

    type SelectOptionElementProps = {
      value?: string | number
      children?: ReactNode
      disabled?: boolean
    }

    const options = useMemo<AppSelectOption[]>(() => {
      const mapped = Children.toArray(children)
        .filter((node): node is ReactElement<SelectOptionElementProps> => isValidElement<SelectOptionElementProps>(node))
        .map(node => {
          const value = node.props.value
          return {
            value: String(value ?? ''),
            label: toOptionLabel(node.props.children),
            disabled: Boolean(node.props.disabled),
          } satisfies AppSelectOption
        })

      if (!placeholder) return mapped

      if (mapped.some(option => option.value === '')) {
        return mapped.map(option => (
          option.value === ''
            ? {
                ...option,
                label: option.label.trim().length > 0 ? option.label : placeholder,
                disabled: option.disabled || Boolean(required),
              }
            : option
        ))
      }

      return [
        {
          value: '',
          label: placeholder,
          disabled: Boolean(required),
        },
        ...mapped,
      ]
    }, [children, placeholder, required, toOptionLabel])

    useEffect(() => {
      if (isControlled) return
      const domValue = selectRef.current?.value
      if (typeof domValue === 'string' && domValue !== uncontrolledValue) {
        setUncontrolledValue(domValue)
      }
    }, [isControlled, options, uncontrolledValue])

    const emitChange = useCallback((nextValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(nextValue)
      }

      if (selectRef.current) {
        selectRef.current.value = nextValue
        selectRef.current.dispatchEvent(new Event('change', { bubbles: true }))
        selectRef.current.dispatchEvent(new Event('input', { bubbles: true }))
      }

      if (onChange) {
        const syntheticEvent = {
          target: { value: nextValue, name },
          currentTarget: { value: nextValue, name },
        } as unknown as React.ChangeEvent<HTMLSelectElement>
        onChange(syntheticEvent)
      }
    }, [isControlled, name, onChange])

    return (
      <div className="relative">
        <select
          ref={setRefs}
          {...props}
          name={name}
          value={currentValue}
          disabled={disabled}
          required={required}
          onChange={event => {
            if (!isControlled) {
              setUncontrolledValue(event.target.value)
            }
            onChange?.(event)
          }}
          onBlur={onBlur}
          className={`
            sr-only pointer-events-none absolute h-0 w-0 opacity-0
          `}
          tabIndex={-1}
          aria-hidden="true"
        >
          {options.map((option, index) => (
            <option key={`${option.value || '__empty-option__'}-${index}`} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <AppSelect
          options={options}
          value={currentValue}
          onChange={emitChange}
          disabled={disabled}
          compact={compact}
          placeholder={placeholder ?? 'Seleccionar...'}
          searchPlaceholder={placeholder ? `Buscar ${placeholder.toLowerCase()}...` : 'Buscar...'}
          buttonClassName={error ? 'app-select-invalid' : ''}
          className={className}
        />
      </div>
    )
  }
)

// ─── TEXTAREA ─────────────────────────────────────────────────────────────────

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ error, className = '', ...props }, ref) {
    return (
      <textarea
        ref={ref}
        {...props}
        className={`
          ft-form-textarea w-full px-3.5 py-2.5 rounded-lg text-sm font-medium resize-none
          bg-[var(--c-surface-2)] text-[var(--c-text)] placeholder:text-[var(--c-text-faint)]
          border transition-[border-color,box-shadow,background-color,color] duration-150 outline-none
          focus:ring-2 ring-offset-0
          ${error
            ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15'
            : 'border-[var(--c-border)] hover:border-[var(--c-border-hover)] focus:border-[rgba(14,79,70,0.35)] focus:ring-[rgba(14,79,70,0.10)]'
          }
          disabled:opacity-40 disabled:cursor-not-allowed
          ${className}
        `}
      />
    )
  }
)

// ─── CHECKBOX TOGGLE ─────────────────────────────────────────────────────────

interface CheckboxToggleProps {
  label:       string
  description?: string
  checked:     boolean
  onChange:    (v: boolean) => void
  disabled?:   boolean
  accent?:     'emerald' | 'blue' | 'amber'
}

export function CheckboxToggle({
  label, description, checked, onChange, disabled, accent = 'emerald',
}: CheckboxToggleProps) {
  const colors = {
    emerald: 'bg-[var(--c-primary)]',
    blue:    'bg-blue-500',
    amber:   'bg-amber-500',
  }

  return (
    <label className={`flex items-start gap-3 cursor-pointer group
      ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative flex-shrink-0 mt-0.5 w-9 h-5 rounded-full transition-all duration-200
          ${checked ? colors[accent] : 'bg-[var(--c-surface-2)] border border-[var(--c-border)]'}
          focus:outline-none focus:ring-2 focus:ring-[rgba(14,79,70,0.25)]
        `}
      >
        <span className={`
          absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--c-surface)]
          border border-[var(--c-border)]
          shadow-sm transition-transform duration-200
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}/>
      </button>
      <div>
        <p className="text-sm text-[var(--c-text)] font-medium leading-tight">{label}</p>
        {description && (
          <p className="text-[11px] text-[var(--c-text-muted)] mt-0.5">{description}</p>
        )}
      </div>
    </label>
  )
}

// ─── AMOUNT INPUT (especializado) ─────────────────────────────────────────────
// Con símbolo de moneda flotante y formato automático.

interface AmountInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  currency: 'PEN' | 'USD'
  error?:   string
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  function AmountInput({ currency, error, className = '', ...props }, ref) {
    const symbol = currency === 'PEN' ? 'S/' : '$'

    return (
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2
          text-sm font-bold text-[var(--c-text-muted)] pointer-events-none select-none tabular-nums">
          {symbol}
        </span>
        <NumericInput
          ref={ref}
          step="0.01"
          decimals={2}
          allowNegative={false}
          placeholder="0.00"
          {...props}
          className={`
            ft-form-amount-input w-full pl-10 pr-3.5 py-3 rounded-lg text-lg font-bold tabular-nums
            bg-[var(--c-surface-2)] text-[var(--c-text)] placeholder:text-[var(--c-text-faint)]
            border transition-[border-color,box-shadow,background-color,color] duration-150 outline-none
            focus:ring-2 ring-offset-0
            ${error
              ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15'
              : 'border-[var(--c-border)] hover:border-[var(--c-border-hover)] focus:border-[rgba(14,79,70,0.35)] focus:ring-[rgba(14,79,70,0.10)]'
            }
            ${className}
          `}
        />
      </div>
    )
  }
)

// ─── SECTION DIVIDER ──────────────────────────────────────────────────────────

interface SectionDividerProps {
  title:       string
  accent?:     string
  collapsible?: boolean
  open?:        boolean
  onToggle?:    () => void
}

export function SectionDivider({
  title, accent = 'var(--c-primary)', collapsible, open, onToggle,
}: SectionDividerProps) {
  return (
    <div
      className={`flex items-center gap-3 py-0.5 ${collapsible ? 'cursor-pointer select-none' : ''}`}
      onClick={collapsible ? onToggle : undefined}
    >
      <div className="h-px flex-1 bg-[var(--c-border)]"/>
      <span
        className="text-[10px] font-bold uppercase tracking-[0.12em] flex items-center gap-1.5"
        style={{ color: accent }}
      >
        {title}
        {collapsible && (
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        )}
      </span>
      <div className="h-px flex-1 bg-[var(--c-border)]"/>
    </div>
  )
}

// ─── COLLAPSED SECTION ───────────────────────────────────────────────────────
// Wrapper con animación de colapso/expansión para módulos derivados.

interface CollapsibleSectionProps {
  open:     boolean
  children: ReactNode
}

export function CollapsibleSection({ open, children }: CollapsibleSectionProps) {
  return (
    <div
      className={`
        overflow-hidden transition-all duration-300 ease-out
        ${open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}
      `}
    >
      <div className="pt-4 space-y-4">
        {children}
      </div>
    </div>
  )
}

// ─── MODULE CARD ──────────────────────────────────────────────────────────────
// Contenedor visual para secciones de módulos derivados.

interface ModuleCardProps {
  icon:     ReactNode
  title:    string
  color:    string
  children: ReactNode
}

export function ModuleCard({ icon, title, color, children }: ModuleCardProps) {
  return (
    <div
      className="rounded-xl border p-4 space-y-4"
      style={{
        borderColor: color + '30',
        background:  color + '08',
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color }} className="flex-shrink-0">{icon}</span>
        <span
          className="text-xs font-bold uppercase tracking-[0.1em]"
          style={{ color }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

// ─── INLINE FEEDBACK ─────────────────────────────────────────────────────────

interface InlineFeedbackProps {
  type:     'success' | 'error' | 'warning' | 'info'
  message:  string
  detail?:  string
}

const feedbackStyles = {
  success: { border: 'border-[var(--c-primary-border)]', bg: 'bg-[var(--c-primary-soft)]',  text: 'text-[var(--c-primary)]', icon: '✓' },
  error:   { border: 'border-red-500/20',     bg: 'bg-red-500/8',      text: 'text-red-400',     icon: '✕' },
  warning: { border: 'border-amber-500/20',   bg: 'bg-amber-500/8',    text: 'text-amber-400',   icon: '!' },
  info:    { border: 'border-blue-500/20',    bg: 'bg-blue-500/8',     text: 'text-blue-400',    icon: 'i' },
}

export function InlineFeedback({ type, message, detail }: InlineFeedbackProps) {
  const s = feedbackStyles[type]
  return (
    <div className={`rounded-lg border ${s.border} ${s.bg} px-4 py-3`}>
      <p className={`text-sm font-medium flex items-center gap-2 ${s.text}`}>
        <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center
          text-[9px] font-bold flex-shrink-0">
          {s.icon}
        </span>
        {message}
      </p>
      {detail && (
        <p className={`text-[11px] mt-1 ml-6 ${s.text} opacity-60`}>{detail}</p>
      )}
    </div>
  )
}
