'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { updateTransactionAction } from '@/app/actions/transaction.actions'
import { RecordModal, RecordModalFooter } from '@/components/ui/RecordModal'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import type { TransactionWithRelations } from '@/types/database.types'

type EditableTransaction = Pick<
  TransactionWithRelations,
  | 'id'
  | 'type'
  | 'amount'
  | 'amount_pen'
  | 'currency'
  | 'description'
  | 'transaction_date'
  | 'notes'
  | 'source_account'
  | 'destination_account'
>

interface EditFormValues {
  description: string
  notes: string
  transaction_date: string
}

interface TransactionEditModalProps {
  open: boolean
  transactionId: string | null
  initialTransaction?: Partial<EditableTransaction> | null
  onClose: () => void
  onUpdated?: (transaction: TransactionWithRelations) => void
}

const TYPE_LABELS: Record<string, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Egreso',
  TRANSFER: 'Transferencia',
}

function normalizeTransaction(raw: unknown): TransactionWithRelations | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Partial<TransactionWithRelations>
  if (!candidate.id || !candidate.type || !candidate.transaction_date) return null
  return candidate as TransactionWithRelations
}

export function TransactionEditModal({
  open,
  transactionId,
  initialTransaction,
  onClose,
  onUpdated,
}: TransactionEditModalProps) {
  const [transaction, setTransaction] = useState<TransactionWithRelations | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<EditFormValues>({
    defaultValues: {
      description: '',
      notes: '',
      transaction_date: '',
    },
  })
  const { register, handleSubmit, reset, formState: { errors } } = form

  const visibleTransaction = transaction ?? (
    initialTransaction?.id ? initialTransaction as EditableTransaction : null
  )

  const modalTitle = visibleTransaction?.description
    ? 'Editar movimiento'
    : 'Editar transacción'
  const typeLabel = visibleTransaction?.type
    ? TYPE_LABELS[visibleTransaction.type] ?? visibleTransaction.type
    : 'Movimiento'

  const amountLabel = useMemo(() => {
    if (!visibleTransaction) return null
    const amount = Number(visibleTransaction.amount ?? 0)
    const amountPen = Number(visibleTransaction.amount_pen ?? amount)
    const currency = visibleTransaction.currency === 'USD' ? 'USD' : 'PEN'
    return currency === 'USD'
      ? `${formatCurrency(amount, 'USD')} · equiv. ${formatCurrency(amountPen, 'PEN')}`
      : formatCurrency(amount, 'PEN')
  }, [visibleTransaction])

  useEffect(() => {
    if (!open || !transactionId) {
      setTransaction(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const loadTransaction = async () => {
      try {
        const res = await fetch(`/api/transactions/${transactionId}`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (cancelled) return

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error?.message ?? 'No se pudo cargar el movimiento.')
        }

        const nextTransaction = normalizeTransaction(json.data)
        if (!nextTransaction) throw new Error('El movimiento no tiene el formato esperado.')

        setTransaction(nextTransaction)
        reset({
          description: nextTransaction.description ?? '',
          notes: nextTransaction.notes ?? '',
          transaction_date: nextTransaction.transaction_date,
        })
      } catch (caught) {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'No se pudo cargar el movimiento.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTransaction()
    return () => { cancelled = true }
  }, [open, reset, transactionId])

  const handleClose = useCallback(() => {
    if (saving) return
    onClose()
  }, [onClose, saving])

  const onSubmit = handleSubmit(async values => {
    if (!transactionId) return

    setSaving(true)
    setError(null)
    const result = await updateTransactionAction(transactionId, {
      description: values.description,
      notes: values.notes.trim() ? values.notes : null,
      transaction_date: values.transaction_date,
    })
    setSaving(false)

    if (!result.ok) {
      setError(result.error.message)
      return
    }

    onUpdated?.(result.data as TransactionWithRelations)
    onClose()
  })

  return (
    <RecordModal
      open={open}
      onClose={handleClose}
      eyebrow="Movimientos"
      title={modalTitle}
      subtitle="Actualiza los datos descriptivos del movimiento. El monto, tipo y cuentas se mantienen fijos para proteger el historial de saldos."
      widthClassName="max-w-[min(96vw,720px)]"
      testId="transaction-edit-modal"
    >
      <form id="transaction-edit-form" onSubmit={event => void onSubmit(event)} className="space-y-[var(--ft-form-section-gap)]">
        {visibleTransaction && (
          <div className="grid grid-cols-1 gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] p-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Tipo</p>
              <p className="mt-1 text-sm font-semibold text-[var(--c-text)]">{typeLabel}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Monto</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--c-text)]">{amountLabel}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ft-form-muted)]">Cuenta</p>
              <p className="mt-1 truncate text-sm font-semibold text-[var(--c-text)]">
                {visibleTransaction.source_account?.name ?? 'Sin cuenta'}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px]">
          <div className="grid grid-cols-1 gap-[var(--ft-form-field-gap)] md:grid-cols-2">
            <label className="block space-y-[var(--ft-form-label-gap)] md:col-span-2">
              <span className="text-[11px] font-medium text-[var(--c-text)]">Descripción</span>
              <input
                className="field-base ft-form-input"
                placeholder="Descripción del movimiento"
                {...register('description', {
                  required: 'La descripción es obligatoria.',
                  maxLength: {
                    value: 255,
                    message: 'Máximo 255 caracteres.',
                  },
                })}
              />
              {errors.description?.message && (
                <span className="text-[11px] text-[var(--ft-form-error)]">{errors.description.message}</span>
              )}
            </label>

            <label className="block space-y-[var(--ft-form-label-gap)]">
              <span className="text-[11px] font-medium text-[var(--c-text)]">Fecha</span>
              <input
                type="date"
                className="field-base ft-form-input"
                {...register('transaction_date', {
                  required: 'La fecha es obligatoria.',
                })}
              />
              <span className="block text-[11px] leading-[1.45] text-[var(--ft-form-muted)]">
                Solo se permite moverla dentro del mismo mes.
              </span>
            </label>

            <label className="block space-y-[var(--ft-form-label-gap)] md:col-span-2">
              <span className="text-[11px] font-medium text-[var(--c-text)]">Notas</span>
              <textarea
                rows={4}
                className="field-base ft-form-textarea resize-none"
                placeholder="Observaciones opcionales"
                {...register('notes', {
                  maxLength: {
                    value: 1000,
                    message: 'Máximo 1000 caracteres.',
                  },
                })}
              />
              {errors.notes?.message && (
                <span className="text-[11px] text-[var(--ft-form-error)]">{errors.notes.message}</span>
              )}
            </label>
          </div>
        </div>

        {(error || loading) && (
          <div className={`rounded-[var(--ft-form-radius)] border px-3.5 py-3 ${
            error
              ? 'border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)]'
              : 'border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)]'
          }`}>
            <p className={`text-[12px] font-medium ${
              error ? 'text-[var(--ft-form-error)]' : 'text-[var(--ft-form-muted)]'
            }`}>
              {error ?? 'Cargando movimiento...'}
            </p>
          </div>
        )}
      </form>

      <RecordModalFooter>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="transaction-edit-form"
            variant="primary"
            loading={saving}
            disabled={loading || !transactionId}
          >
            Guardar cambios
          </Button>
        </div>
      </RecordModalFooter>
    </RecordModal>
  )
}
