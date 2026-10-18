'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { RecordModal } from '@/components/ui/RecordModal'
import { Button } from '@/components/ui/Button'
import styles from '@/components/tables/TransactionsRound07.module.css'
import { InlineFeedback } from '@/components/forms/TransactionForm/FormFields'
import { getTransactionEditPresentation } from '@/components/forms/transaction-edit-presentation'
import { firstLinkedRecord, inferOperationType, toInitialValues } from '@/components/forms/transaction-edit-data'
import type { OperationType } from '@/components/transactions/OperationTypeSelector'
import { useTransactionEditRecord } from '@/components/forms/use-transaction-edit-record'
import type { TransactionFormOptions } from '@/lib/contracts/ui.contracts'
import type { TransactionWithRelations } from '@/types/database.types'

interface TransactionEditModalProps {
  open: boolean
  transactionId: string | null
  options: TransactionFormOptions
  initialOperationType?: OperationType | null
  onClose: () => void
  onUpdated?: (transaction: TransactionWithRelations) => void
}

function EditTransactionSkeleton() {
  return (
    <div
      className="grid min-h-[460px] content-start gap-5"
      role="status"
      aria-label="Cargando datos del movimiento"
      aria-busy="true"
      data-testid="transaction-edit-skeleton"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_132px]">
        <span className={styles.editSkeleton} />
        <span className={styles.editSkeleton} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <span className={styles.editSkeleton} />
        <span className={styles.editSkeleton} />
      </div>
      <span className={styles.editSkeleton} />
      <div className="grid gap-3 sm:grid-cols-2">
        <span className={styles.editSkeleton} />
        <span className={styles.editSkeleton} />
      </div>
      <span className={`${styles.editSkeleton} ${styles.editSkeletonLarge}`} />
      <span className={`${styles.editSkeleton} ${styles.editSkeletonWide}`} />
    </div>
  )
}

export function TransactionEditModal({
  open,
  transactionId,
  options,
  initialOperationType,
  onClose,
  onUpdated,
}: TransactionEditModalProps) {
  const editRecord = useTransactionEditRecord(open, transactionId)
  const visibleTransaction = editRecord.transaction
  const operationType = visibleTransaction
    ? inferOperationType(visibleTransaction)
    : (open && transactionId ? initialOperationType ?? null : null)
  const initialValues = useMemo(
    () => toInitialValues(visibleTransaction),
    [visibleTransaction],
  )
  const editPresentation = operationType ? getTransactionEditPresentation(operationType) : null
  const isLoading = editRecord.status === 'loading'
  const loadError = editRecord.error
  const [skeletonTransactionId, setSkeletonTransactionId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading || !transactionId || loadError) {
      setSkeletonTransactionId(null)
      return
    }

    const timeoutId = window.setTimeout(() => setSkeletonTransactionId(transactionId), 120)
    return () => window.clearTimeout(timeoutId)
  }, [isLoading, loadError, transactionId])

  const showSkeleton = isLoading && !loadError && skeletonTransactionId === transactionId

  const onSuccessfulEdit = useCallback((updatedTransaction: TransactionWithRelations) => {
    onUpdated?.(updatedTransaction)
    onClose()
  }, [onClose, onUpdated])

  const title = editPresentation?.title ?? 'Editar movimiento'
  const subtitle = isLoading
    ? 'Cargando datos del movimiento.'
    : editPresentation?.blocked
      ? 'La distribución financiera de este movimiento está protegida.'
      : 'Actualiza los datos permitidos de este movimiento.'

  return (
    <RecordModal
      open={open}
      onClose={onClose}
      onExitComplete={editRecord.clearAfterExit}
      eyebrow="Movimientos"
      title={title}
      subtitle={subtitle}
      widthClassName="max-w-[min(96vw,580px)]"
      testId="transaction-edit-modal"
      presentation="workbench"
      motionSource="pointer"
      footer={visibleTransaction ? undefined : (
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="lg" onClick={onClose}>Cancelar</Button>
          <Button type="button" size="lg" disabled className="min-w-[190px]" aria-disabled="true">
            Guardar cambios
          </Button>
        </div>
      )}
      overlayClassName={styles.formOverlay}
    >
      {open && !transactionId ? <InlineFeedback type="error" message="No se seleccionó un movimiento para editar." /> : null}

      {loadError ? (
        <div className="space-y-3" role="alert">
          <InlineFeedback type="error" message={loadError} />
          <button
            type="button"
            onClick={editRecord.retry}
            className="inline-flex min-h-10 items-center rounded-control border border-[var(--ft-border)] px-3 text-[13px] font-semibold text-[var(--ft-text-strong)] transition-colors hover:bg-[var(--ft-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ft-focus-ring-color)] motion-reduce:transition-none"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {showSkeleton ? <EditTransactionSkeleton /> : null}

      {visibleTransaction && operationType ? (
        <div className={styles.editFormReveal} data-testid="transaction-edit-form">
          <TransactionForm
            key={visibleTransaction.id}
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
            onEditSuccess={onSuccessfulEdit}
          />
        </div>
      ) : null}
    </RecordModal>
  )
}
