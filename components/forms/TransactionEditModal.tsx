'use client'

import { useEffect, useMemo, useState } from 'react'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { RecordModal } from '@/components/ui/RecordModal'
import styles from '@/components/tables/TransactionsRound07.module.css'
import { InlineFeedback } from '@/components/forms/TransactionForm/FormFields'
import { getTransactionEditPresentation } from '@/components/forms/transaction-edit-presentation'
import { firstLinkedRecord, inferOperationType, toInitialValues, type EditableTransaction } from '@/components/forms/transaction-edit-data'
import type {
  TransactionFormOptions,
} from '@/lib/contracts/ui.contracts'
import type { TransactionWithRelations } from '@/types/database.types'

interface TransactionEditModalProps {
  open: boolean
  transactionId: string | null
  options: TransactionFormOptions
  initialTransaction?: Partial<EditableTransaction> | null
  onClose: () => void
  onUpdated?: (transaction: TransactionWithRelations) => void
}

function normalizeTransaction(raw: unknown): (TransactionWithRelations & EditableTransaction) | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Partial<TransactionWithRelations & EditableTransaction>
  if (!candidate.id || !candidate.type || !candidate.transaction_date) return null
  return candidate as TransactionWithRelations & EditableTransaction
}


export function TransactionEditModal({
  open,
  transactionId,
  options,
  initialTransaction,
  onClose,
  onUpdated,
}: TransactionEditModalProps) {
  const [transaction, setTransaction] = useState<(TransactionWithRelations & EditableTransaction) | null>(null)
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

  const editPresentation = getTransactionEditPresentation(operationType)

  return (
    <RecordModal
      open={open}
      onClose={onClose}
      eyebrow="Movimientos"
      title={editPresentation.title}
      subtitle={editPresentation.blocked
        ? 'La distribución financiera de este movimiento está protegida.'
        : 'Actualiza los datos permitidos de este movimiento.'}
      widthClassName="max-w-[min(96vw,580px)]"
      testId="transaction-edit-modal"
      presentation="workbench"
      motionSource="pointer"
      overlayClassName={styles.formOverlay}
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
          editContext={{
            hasExistingAttachment: Boolean(visibleTransaction.attachment_url),
            receivableCollectedAmount: Number(firstLinkedRecord(visibleTransaction.linked_receivable)?.collected_amount ?? 0),
            payablePaidAmount: Number(firstLinkedRecord(visibleTransaction.linked_payable)?.paid_amount ?? 0),
          }}
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
