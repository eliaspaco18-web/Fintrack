'use client'

import { useEffect, useMemo, useState } from 'react'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { RecordModal } from '@/components/ui/RecordModal'
import { InlineFeedback } from '@/components/forms/TransactionForm/FormFields'
import {
  operationTypeLabel,
  type OperationType,
} from '@/components/transactions/OperationTypeSelector'
import { CategoryKeys } from '@/lib/constants/category-keys'
import type {
  TransactionFormOptions,
  TransactionFormValues,
} from '@/lib/contracts/ui.contracts'
import type { TransactionWithRelations } from '@/types/database.types'

type LinkedAssetSnapshot = {
  id: string
  name: string
  asset_type: TransactionFormValues['asset_type']
  asset_type_id: string | null
  serial_number: string | null
  location: string | null
}

type LinkedReceivableSnapshot = {
  id: string
  debtor_id: string | null
  due_date: string | null
}

type LinkedPayableSnapshot = {
  id: string
  creditor_id: string | null
  due_date: string | null
}

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
  | 'payment_method'
  | 'sender'
  | 'recipient'
  | 'budget_id'
  | 'source_account_id'
  | 'destination_account_id'
  | 'source_account'
  | 'destination_account'
> & {
  category?: { id: string; system_key?: string | null } | null
  linked_asset?: LinkedAssetSnapshot[] | LinkedAssetSnapshot | null
  linked_receivable?: LinkedReceivableSnapshot[] | LinkedReceivableSnapshot | null
  linked_payable?: LinkedPayableSnapshot[] | LinkedPayableSnapshot | null
}

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

function firstLinkedRecord<T>(value: T[] | T | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function inferOperationType(transaction: Partial<EditableTransaction> | null): OperationType {
  if (firstLinkedRecord(transaction?.linked_asset)) return 'asset_purchase'
  if (firstLinkedRecord(transaction?.linked_receivable)) return 'receivable_issue'
  if (firstLinkedRecord(transaction?.linked_payable)) return 'payable_issue'

  const categorySystemKey = transaction?.category?.system_key ?? null
  if (categorySystemKey === CategoryKeys.INCOME_RECEIVABLE_COLLECTION) return 'receivable_collect'
  if (categorySystemKey === CategoryKeys.EXPENSE_PAYABLE_PAYMENT) return 'payable_pay'
  if (transaction?.type === 'TRANSFER') return 'transfer'
  if (transaction?.type === 'INCOME') return 'income'
  return 'expense'
}

function toInitialValues(
  transaction: Partial<EditableTransaction> | null,
): Partial<TransactionFormValues> {
  if (!transaction) return {}

  const linkedAsset = firstLinkedRecord(transaction.linked_asset)
  const linkedReceivable = firstLinkedRecord(transaction.linked_receivable)
  const linkedPayable = firstLinkedRecord(transaction.linked_payable)

  return {
    type: transaction.type,
    source_account_id: transaction.source_account_id ?? undefined,
    destination_account_id: transaction.destination_account_id ?? undefined,
    amount: Number(transaction.amount ?? 0),
    currency: transaction.currency === 'USD' ? 'USD' : 'PEN',
    exchange_rate: transaction.currency === 'USD'
      ? Number(transaction.exchange_rate ?? 1)
      : undefined,
    payment_method: transaction.payment_method ?? 'DEBIT',
    description: transaction.description ?? '',
    transaction_date: transaction.transaction_date,
    category_id: transaction.category_id ?? undefined,
    notes: transaction.notes ?? undefined,
    sender: transaction.sender ?? undefined,
    recipient: transaction.recipient ?? undefined,
    budget_id: transaction.budget_id ?? undefined,
    creates_asset: Boolean(linkedAsset),
    asset_name: linkedAsset?.name ?? undefined,
    asset_type: linkedAsset?.asset_type ?? undefined,
    asset_type_id: linkedAsset?.asset_type_id ?? undefined,
    asset_serial: linkedAsset?.serial_number ?? undefined,
    asset_location: linkedAsset?.location ?? undefined,
    creates_receivable: Boolean(linkedReceivable),
    receivable_debtor_id: linkedReceivable?.debtor_id ?? undefined,
    receivable_due: linkedReceivable?.due_date ?? undefined,
    creates_payable: Boolean(linkedPayable),
    payable_creditor_id: linkedPayable?.creditor_id ?? undefined,
    payable_due: linkedPayable?.due_date ?? undefined,
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
