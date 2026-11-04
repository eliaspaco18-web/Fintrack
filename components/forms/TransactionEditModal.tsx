'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { RecordModal } from '@/components/ui/RecordModal'
import { Button } from '@/components/ui/Button'
import { FormActions } from '@/components/forms/primitives'
import styles from '@/components/tables/TransactionsRound07.module.css'
import incomeStyles from '@/components/forms/TransactionForm/IncomeTransactionForm.module.css'
import { InlineFeedback } from '@/components/forms/TransactionForm/FormFields'
import { getTransactionEditPresentation } from '@/components/forms/transaction-edit-presentation'
import { firstLinkedRecord, inferOperationType, toInitialValues } from '@/components/forms/transaction-edit-data'
import {
  buildTransactionDuplicationPlan,
  getTransactionDuplicationBlockReason,
  type DuplicableTransaction,
} from '@/modules/transactions/transaction-duplication'
import type { OperationType } from '@/components/transactions/OperationTypeSelector'
import { useTransactionEditRecord } from '@/components/forms/use-transaction-edit-record'
import type { TransactionFormOptions } from '@/lib/contracts/ui.contracts'
import type { TransactionWithRelations } from '@/types/database.types'

interface TransactionEditModalProps {
  open: boolean
  transactionId: string | null
  intent?: 'edit' | 'duplicate'
  options: TransactionFormOptions
  initialOperationType?: OperationType | null
  onClose: () => void
  onUpdated?: (transaction: TransactionWithRelations) => void
  onCreated?: () => void
}

function EditTransactionLoadingActions({ onCancel, operationType, intent = 'edit' }: { onCancel: () => void; operationType: OperationType | null; intent?: 'edit' | 'duplicate' }) {
  return (
    <FormActions
      className={operationType === 'income' ? '' : incomeStyles.operationFormActions}
      secondaryAction={(
        <Button type="button" variant="secondary" size="lg" onClick={onCancel}>
          Cancelar
        </Button>
      )}
      primaryAction={(
        <Button type="button" size="lg" disabled className="min-w-[190px]" aria-disabled="true">
          {intent === 'duplicate' ? 'Crear movimiento' : 'Guardar cambios'}
        </Button>
      )}
    />
  )
}

function EditTransactionSkeleton({
  visible,
  onCancel,
  operationType,
  intent = 'edit',
}: {
  visible: boolean
  onCancel: () => void
  operationType: OperationType | null
  intent?: 'edit' | 'duplicate'
}) {
  return (
    <div className="grid content-start gap-4" data-testid="transaction-edit-loading-state">
      <div
        className={`${styles.editSkeletonContainer} grid min-h-[460px] content-start gap-5`}
        role={visible ? 'status' : undefined}
        aria-label={visible ? 'Cargando datos del movimiento' : undefined}
        aria-busy={visible || undefined}
        aria-hidden={!visible}
        data-visible={visible ? 'true' : 'false'}
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
      <EditTransactionLoadingActions onCancel={onCancel} operationType={operationType} intent={intent} />
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
  onCreated,
  intent = 'edit',
}: TransactionEditModalProps) {
  const editRecord = useTransactionEditRecord(open, transactionId)
  const visibleTransaction = editRecord.transaction
  const duplicationBlockReason = intent === 'duplicate'
    ? getTransactionDuplicationBlockReason(visibleTransaction as DuplicableTransaction | null, options)
    : null
  const duplicationPlan = useMemo(() => (
    intent === 'duplicate' && visibleTransaction && !duplicationBlockReason
      ? buildTransactionDuplicationPlan(visibleTransaction as DuplicableTransaction, options)
      : null
  ), [duplicationBlockReason, intent, options, visibleTransaction])
  const operationType = intent === 'duplicate'
    ? duplicationPlan?.operationType ?? (visibleTransaction ? inferOperationType(visibleTransaction) : null)
    : visibleTransaction
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

  const onSuccessfulCreate = useCallback(() => {
    onCreated?.()
    onClose()
  }, [onClose, onCreated])

  const title = intent === 'duplicate' ? 'Duplicar movimiento' : editPresentation?.title ?? 'Editar movimiento'
  const subtitleText = isLoading
    ? 'Cargando datos del movimiento.'
    : intent === 'duplicate'
      ? 'Se creará un movimiento nuevo e independiente. Revisa los datos antes de guardar.'
    : editPresentation?.blocked
      ? 'La distribución financiera de este movimiento está protegida.'
      : 'Actualiza los datos permitidos de este movimiento.'
  // Both the loading and ready copy reserve two lines. This avoids a panel
  // height change when the final subtitle wraps on narrow workbench widths.
  const subtitle = <span className="block min-h-10">{subtitleText}</span>

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
      overlayClassName={styles.formOverlay}
    >
      {open && !transactionId ? (
        <div className="grid gap-4">
          <InlineFeedback type="error" message="No se seleccionó un movimiento para editar." />
          <EditTransactionLoadingActions onCancel={onClose} operationType={operationType} intent={intent} />
        </div>
      ) : null}

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
          <EditTransactionLoadingActions onCancel={onClose} operationType={operationType} intent={intent} />
        </div>
      ) : null}

      {isLoading && !loadError ? (
        <EditTransactionSkeleton visible={showSkeleton} onCancel={onClose} operationType={operationType} intent={intent} />
      ) : null}

      {intent === 'duplicate' && visibleTransaction && duplicationBlockReason ? (
        <div className="grid gap-4" data-testid="transaction-duplicate-blocked">
          <InlineFeedback type="error" message={duplicationBlockReason} />
          <FormActions secondaryAction={(
            <Button type="button" variant="secondary" size="lg" onClick={onClose}>Cerrar</Button>
          )} primaryAction={null} />
        </div>
      ) : null}

      {intent === 'duplicate' && duplicationPlan?.warnings.length ? (
        <div className="grid gap-2" role="status" data-testid="transaction-duplicate-warnings">
          {duplicationPlan.warnings.map(warning => <InlineFeedback key={warning} type="warning" message={warning} />)}
        </div>
      ) : null}

      {visibleTransaction && operationType && (intent === 'edit' || !duplicationBlockReason && duplicationPlan) ? (
        <div className={styles.editFormReveal} data-testid="transaction-edit-form">
          <TransactionForm
            key={visibleTransaction.id}
            options={options}
            initialValues={intent === 'duplicate' ? duplicationPlan!.initialValues : initialValues}
            className="tx-modal-form"
            hideTypeSelector
            operationType={operationType}
            showSuccessSummary={false}
            mode={intent === 'duplicate' ? 'create' : 'edit'}
            transactionId={intent === 'edit' ? visibleTransaction.id : undefined}
            editContext={intent === 'edit' ? {
              hasExistingAttachment: Boolean(visibleTransaction.attachment_url),
              receivableCollectedAmount: Number(firstLinkedRecord(visibleTransaction.linked_receivable)?.collected_amount ?? 0),
              payablePaidAmount: Number(firstLinkedRecord(visibleTransaction.linked_payable)?.paid_amount ?? 0),
            } : undefined}
            onCancel={onClose}
            ensureExchangeRateOnMount={intent !== 'duplicate'}
            onEditSuccess={intent === 'edit' ? onSuccessfulEdit : undefined}
            onSuccess={intent === 'duplicate' ? onSuccessfulCreate : undefined}
          />
        </div>
      ) : null}
    </RecordModal>
  )
}
