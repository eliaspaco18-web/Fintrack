// =============================================================================
// components/forms/TransactionForm/SubmitButton.tsx
// Botón de envío con estados: idle / loading / success / error.
// El color cambia según el tipo de transacción activo.
// =============================================================================

'use client'

import type { ActionState }          from '@/lib/contracts/ui.contracts'
import type { CreateTransactionResult } from '@/modules/transactions/transaction.service.types'
import { TYPE_CONFIG }               from './TypeSelector'
import type { TransactionFormValues } from '@/lib/contracts/ui.contracts'

type TxType = TransactionFormValues['type']

interface SubmitButtonProps {
  type:        TxType
  state:       ActionState<CreateTransactionResult>
  disabled?:   boolean
  fullWidth?:  boolean
  className?:  string
}

const TYPE_LABELS: Record<TxType, { idle: string; loading: string; success: string }> = {
  INCOME:   { idle: 'Registrar ingreso',       loading: 'Registrando…', success: '¡Ingreso registrado!' },
  EXPENSE:  { idle: 'Registrar egreso',        loading: 'Registrando…', success: '¡Egreso registrado!' },
  TRANSFER: { idle: 'Registrar transferencia', loading: 'Procesando…',  success: '¡Transferencia registrada!' },
}

const TYPE_STYLES: Record<TxType, string> = {
  INCOME:   'bg-[var(--c-primary)] hover:bg-[var(--c-primary-hover)] shadow-[rgba(14,79,70,0.20)]',
  EXPENSE:  'bg-red-500    hover:bg-red-400     shadow-red-500/20',
  TRANSFER: 'bg-blue-500   hover:bg-blue-400    shadow-blue-500/20',
}

export function SubmitButton({ type, state, disabled, fullWidth = true, className = '' }: SubmitButtonProps) {
  const labels = TYPE_LABELS[type]
  const isLoading = state.status === 'loading'
  const isSuccess = state.status === 'success'

  const label = isLoading ? labels.loading
    : isSuccess            ? labels.success
    :                        labels.idle

  return (
    <button
      type="submit"
      data-testid="transaction-submit-button"
      disabled={disabled || isLoading || isSuccess}
      className={`
        relative ${fullWidth ? 'w-full' : 'w-auto'} py-3.5 rounded-xl text-sm font-bold
        tracking-wide transition-all duration-200 shadow-lg
        overflow-hidden
        disabled:opacity-60 disabled:cursor-not-allowed
        ${isSuccess
          ? 'bg-[var(--c-primary)] shadow-[rgba(14,79,70,0.20)] text-[var(--c-text-on-primary)]'
          : TYPE_STYLES[type] + ' text-[var(--c-text-on-primary)]'
        }
        ${className}
      `}
    >
      {/* Shimmer en loading */}
      {isLoading && (
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--c-text-on-primary)]/10 to-transparent
          animate-[shimmer_1.5s_ease-in-out_infinite] -translate-x-full"/>
      )}

      <span className="relative flex items-center justify-center gap-2">
        {isLoading && (
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        )}
        {isSuccess && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        )}
        {label}
      </span>
    </button>
  )
}

// ─── SUCCESS SUMMARY ──────────────────────────────────────────────────────────
// Muestra un resumen de lo que se creó tras el envío exitoso.

interface SuccessSummaryProps {
  result:   CreateTransactionResult
  onNew:    () => void
  onView:   () => void
}

export function SuccessSummary({ result, onNew, onView }: SuccessSummaryProps) {
  const modules: string[] = []
  if (result.asset)      modules.push('activo')
  if (result.credit)     modules.push('crédito')
  if (result.loan)       modules.push(`préstamo (${result.installments_generated ?? 0} cuotas)`)
  if (result.receivable) modules.push('cuenta por cobrar')
  if (result.payable)    modules.push('cuenta por pagar')

  return (
    <div data-testid="transaction-success-summary" className="rounded-xl border border-[var(--c-primary-border)] bg-[var(--c-primary)]/6 p-5 space-y-4
      animate-[slide-down_0.3s_ease-out]">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--c-primary-soft)] border border-[var(--c-primary-border)]
          flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--c-primary)" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--c-primary)]">Transacción registrada</p>
          <p className="text-xs text-[var(--c-text-muted)] mt-0.5">
            {result.transaction.description}
          </p>
          {modules.length > 0 && (
            <p className="text-[11px] text-[var(--c-primary)]/60 mt-2">
              También se creó: {modules.join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onNew}
          data-testid="transaction-success-new-button"
          className="flex-1 py-2 rounded-lg border border-[var(--c-primary-border)] text-xs
            font-semibold text-[var(--c-primary)] hover:bg-[var(--c-primary-soft)] transition-colors"
        >
          + Nueva transacción
        </button>
        <button
          type="button"
          onClick={onView}
          data-testid="transaction-success-view-button"
          className="flex-1 py-2 rounded-lg bg-[var(--c-surface-2)] border border-[var(--c-border)]
            text-xs font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:border-[var(--c-border-hover)] transition-colors"
        >
          Ver transacciones
        </button>
      </div>
    </div>
  )
}
