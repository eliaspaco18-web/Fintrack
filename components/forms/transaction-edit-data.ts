import { CategoryKeys } from '@/lib/constants/category-keys'
import type { OperationType } from '@/components/transactions/OperationTypeSelector'
import type { TransactionFormValues } from '@/lib/contracts/ui.contracts'
import type { TransactionWithRelations } from '@/types/database.types'

type LinkedAssetSnapshot = {
  id: string
  name: string
  asset_type: TransactionFormValues['asset_type']
  asset_type_id: string | null
  serial_number: string | null
  location: string | null
  recipient?: string | null
}

type LinkedReceivableSnapshot = {
  id: string
  debtor_id: string | null
  due_date: string | null
  notes?: string | null
  collected_amount?: number | null
}

type LinkedPayableSnapshot = {
  id: string
  creditor_id: string | null
  due_date: string | null
  notes?: string | null
  paid_amount?: number | null
}

export type EditableTransaction = Pick<
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
  | 'is_recurring'
  | 'attachment_url'
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

export function firstLinkedRecord<T>(value: T[] | T | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function inferOperationType(transaction: Partial<EditableTransaction> | null): OperationType {
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

export function toInitialValues(
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
      ? (typeof transaction.exchange_rate === 'number' && Number.isFinite(transaction.exchange_rate) && transaction.exchange_rate > 0
        ? Number(transaction.exchange_rate)
        : undefined)
      : undefined,
    payment_method: transaction.payment_method ?? 'DEBIT',
    description: transaction.description ?? '',
    transaction_date: transaction.transaction_date,
    category_id: transaction.category_id ?? undefined,
    notes: transaction.notes?.trim()
      ? transaction.notes
      : linkedReceivable?.notes ?? linkedPayable?.notes ?? undefined,
    is_recurring: Boolean(transaction.is_recurring),
    sender: transaction.sender ?? undefined,
    recipient: transaction.recipient ?? linkedAsset?.recipient ?? undefined,
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
