'use client'

import { useEffect, useMemo, useState } from 'react'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { RecordModal } from '@/components/ui/RecordModal'
import { InlineFeedback } from '@/components/forms/TransactionForm/FormFields'
import {
  operationTypeLabel,
  type OperationType,
} from '@/components/transactions/OperationTypeSelector'
import type {
  TransactionFormOptions,
  TransactionFormValues,
} from '@/lib/contracts/ui.contracts'
import type { TransactionWithRelations } from '@/types/database.types'

type EditableTransaction = Pick<
  TransactionWithRelations,
  | 'id'
  | 'type'
  | 'amount'
  | 'amount_pen'
  | 'currency'
  | 'exchange_rate'
  | 'description'
  | 'transaction_date'
  | 'category_id'
  | 'notes'
  | 'source_account_id'
  | 'destination_account_id'
  | 'source_account'
  | 'destination_account'
>

interface TransactionEditModalProps {
  open: boolean
  transactionId: string | null
  options: TransactionFormOptions
  initialTransaction?: Partial<EditableTransaction> | null
  onClose: () => void
  onUpdated?: (transaction: TransactionWithRelations) => void
}

function normalizeTransaction(raw: unknown): TransactionWithRelations | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Partial<TransactionWithRelations>
  if (!candidate.id || !candidate.type || !candidate.transaction_date) return null
  return candidate as TransactionWithRelations
}

function inferOperationType(transaction: Partial<EditableTransaction> | null): OperationType {
  if (transaction?.type === 'TRANSFER') return 'transfer'
  if (transaction?.type === 'INCOME') return 'income'
  return 'expense'
}

function toInitialValues(
  transaction: Partial<EditableTransaction> | null,
): Partial<TransactionFormValues> {
  if (!transaction) return {}

  return {
    type: transaction.type,
    source_account_id: transaction.source_account_id ?? undefined,
    destination_account_id: transaction.destination_account_id ?? undefined,
    amount: Number(transaction.amount ?? 0),
    currency: transaction.currency === 'USD' ? 'USD' : 'PEN',
    exchange_rate: Number(transaction.exchange_rate ?? 1),
    description: transaction.description ?? '',
    transaction_date: transaction.transaction_date,
    category_id: transaction.category_id ?? undefined,
    notes: transaction.notes ?? undefined,
  }
}

export function TransactionEditModal({
  open,
  transactionId,
  options,
  initialTransaction,
  onClose,
  onUpdated,
}: TransactionEditModalProps) {
  const [transaction, setTransaction] = useState<TransactionWithRelations | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visibleTransaction = transaction ?? (
    initialTransaction?.id ? initialTransaction as EditableTransaction : null
  )

  const operationType = useMemo(
    () => inferOperationType(visibleTransaction),
    [visibleTransaction],
  )
  const initialValues = useMemo(
    () => toInitialValues(visibleTransaction),
    [visibleTransaction],
  )

  useEffect(() => {
    if (!open || !transactionId) {
      setTransaction(null)
      setError(null)
      setLoading(false)
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
      } catch (caught) {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'No se pudo cargar el movimiento.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTransaction()
    return () => { cancelled = true }
  }, [open, transactionId])

  const title = `Editar ${operationTypeLabel(operationType).toLowerCase()}`

  return (
    <RecordModal
      open={open}
      onClose={onClose}
      eyebrow="Movimientos"
      title={title}
      subtitle="Usa la misma ventana de registro, ajustada al tipo de movimiento seleccionado."
      widthClassName="max-w-[min(96vw,920px)]"
      testId="transaction-edit-modal"
    >
      {error ? (
        <InlineFeedback type="error" message={error} />
      ) : null}

      {loading && !visibleTransaction ? (
        <InlineFeedback type="info" message="Cargando movimiento..." />
      ) : null}

      {visibleTransaction ? (
        <TransactionForm
          key={`${visibleTransaction.id}-${visibleTransaction.transaction_date}-${visibleTransaction.category_id ?? 'no-category'}`}
          options={options}
          initialValues={initialValues}
          className="tx-modal-form"
          hideTypeSelector
          operationType={operationType}
          showSuccessSummary={false}
          mode="edit"
          transactionId={visibleTransaction.id}
          onCancel={onClose}
          onEditSuccess={updatedTransaction => {
            onUpdated?.(updatedTransaction)
            onClose()
          }}
        />
      ) : null}
    </RecordModal>
  )
}
