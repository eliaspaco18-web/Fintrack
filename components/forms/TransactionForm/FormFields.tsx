// =============================================================================
// components/forms/TransactionForm/FormFields.tsx
// Primitivos de formulario del proyecto.
// Cada componente acepta react-hook-form registration + estado de error.
// Diseño: oscuro, refinado, con micro-animaciones en foco y error.
// =============================================================================

'use client'

import { forwardRef, type ReactNode }  from 'react'

// ─── TIPOS BASE ───────────────────────────────────────────────────────────────

interface FieldWrapperProps {
  label?:    string
  required?: boolean
  error?:    string
  hint?:     string
  children:  ReactNode
  className?: string
}

// ─── FIELD WRAPPER ────────────────────────────────────────────────────────────

export function FieldWrapper({
  label, required, error, hint, children, className = '',
}: FieldWrapperProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="flex items-center gap-1 text-[11px] font-semibold
          text-[var(--color-text-muted)] uppercase tracking-[0.08em]">
          {label}
          {required && (
            <span className="text-red-400 font-bold">*</span>
          )}
          {hint && (
            <span className="ml-auto text-[10px] font-normal normal-case
              text-[var(--color-text-faint)] tracking-normal">
              {hint}
            </span>
          )}
        </label>
      )}
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-[11px] text-red-400
          animate-[slide-down_0.15s_ease-out]">
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
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ error, className = '', ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={`
          w-full px-3.5 py-2.5 rounded-lg text-sm font-medium
          bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder:text-[var(--color-text-faint)]
          border transition-all duration-150 outline-none
          focus:ring-2 ring-offset-0
          ${error
            ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15'
            : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-hover)] focus:border-emerald-500/40 focus:ring-emerald-500/10'
          }
          disabled:opacity-40 disabled:cursor-not-allowed
          ${className}
        `}
      />
    )
  }
)

// ─── SELECT ───────────────────────────────────────────────────────────────────

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  error?:       string
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ error, placeholder, children, className = '', ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          {...props}
          className={`
            w-full px-3.5 py-2.5 rounded-lg text-sm font-medium
            bg-[var(--color-surface-2)] text-[var(--color-text)] appearance-none cursor-pointer
            border transition-all duration-150 outline-none
            focus:ring-2 ring-offset-0 pr-9
            ${error
              ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15'
              : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-hover)] focus:border-emerald-500/40 focus:ring-emerald-500/10'
            }
            disabled:opacity-40 disabled:cursor-not-allowed
            ${className}
          `}
        >
          {placeholder && (
            <option value="" disabled>{placeholder}</option>
          )}
          {children}
        </select>
        {/* Chevron */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2
          text-[var(--color-text-faint)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </span>
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
          w-full px-3.5 py-2.5 rounded-lg text-sm font-medium resize-none
          bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder:text-[var(--color-text-faint)]
          border transition-all duration-150 outline-none
          focus:ring-2 ring-offset-0
          ${error
            ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15'
            : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-hover)] focus:border-emerald-500/40 focus:ring-emerald-500/10'
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
    emerald: 'bg-emerald-500',
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
          ${checked ? colors[accent] : 'bg-[var(--color-surface-2)] border border-[color:var(--color-border)]'}
          focus:outline-none focus:ring-2 focus:ring-emerald-500/30
        `}
      >
        <span className={`
          absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--color-surface)]
          border border-[color:var(--color-border)]
          shadow-sm transition-transform duration-200
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}/>
      </button>
      <div>
        <p className="text-sm text-[var(--color-text)] font-medium leading-tight">{label}</p>
        {description && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{description}</p>
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
          text-sm font-bold text-[var(--color-text-muted)] pointer-events-none select-none tabular-nums">
          {symbol}
        </span>
        <input
          ref={ref}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...props}
          className={`
            w-full pl-10 pr-3.5 py-3 rounded-lg text-lg font-bold tabular-nums
            bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder:text-[var(--color-text-faint)]
            border transition-all duration-150 outline-none
            focus:ring-2 ring-offset-0
            ${error
              ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15'
              : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-hover)] focus:border-emerald-500/40 focus:ring-emerald-500/10'
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
  title, accent = '#10b981', collapsible, open, onToggle,
}: SectionDividerProps) {
  return (
    <div
      className={`flex items-center gap-3 py-0.5 ${collapsible ? 'cursor-pointer select-none' : ''}`}
      onClick={collapsible ? onToggle : undefined}
    >
      <div className="h-px flex-1 bg-[var(--color-border)]"/>
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
      <div className="h-px flex-1 bg-[var(--color-border)]"/>
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
  success: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/8',  text: 'text-emerald-400', icon: '✓' },
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
