import React from 'react'
import type { TransactionListItem } from '@/lib/contracts/ui.contracts'
import { CategoryKeys } from '@/lib/constants/category-keys'

export type OperationType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'asset_purchase'
  | 'receivable_issue'
  | 'receivable_collect'
  | 'payable_issue'
  | 'payable_pay'

const OPERATION_ICONS: Record<OperationType, React.ReactNode> = {
  income: <><path d="M12 4v12m-5-5 5 5 5-5" /><path d="M4 17v3h16v-3" /></>,
  expense: <><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M4 17v3h16v-3" /></>,
  receivable_collect: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6m-6 4h3" /><path d="M15 13v4m-2-2 2 2 2-2" /></>,
  payable_issue: <><circle cx="8" cy="13" r="4" /><path d="M8 11v4m-1.5-2h3M16 4v10m-3-3 3 3 3-3" /></>,
  receivable_issue: <><circle cx="8" cy="15" r="4" /><path d="M8 13v4m-1.5-2h3M13 11l7-7m-5 0h5v5" /></>,
  payable_pay: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H20v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M4 9h16M8 14h3m5-8V3m-2 2 2-2 2 2" /></>,
  asset_purchase: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z" /><path d="m3 8 9 5 9-5M12 13v9" /></>,
  transfer: <><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" /></>,
}

export function OperationTypeIcon({ operationType, size = 18 }: { operationType: OperationType; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-operation-icon={operationType}
      aria-hidden="true"
    >
      {OPERATION_ICONS[operationType]}
    </svg>
  )
}

export function resolveTransactionOperationIconType(
  transaction: Pick<TransactionListItem, 'type' | 'sub_type' | 'category' | 'linked_asset' | 'linked_receivable' | 'linked_payable'>,
): OperationType {
  const hasRelatedModule = (value: TransactionListItem['linked_asset']) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value?.id)
  const categoryKey = transaction.category?.system_key

  if (transaction.type === 'TRANSFER') return 'transfer'
  if (transaction.type === 'INCOME') {
    if (categoryKey === CategoryKeys.INCOME_RECEIVABLE_COLLECTION) return 'receivable_collect'
    if (
      categoryKey === CategoryKeys.INCOME_PAYABLE_ISSUE
      || hasRelatedModule(transaction.linked_payable)
    ) return 'payable_issue'
    return 'income'
  }
  if (
    transaction.sub_type === 'PAYABLE_PAYMENT'
    || categoryKey === CategoryKeys.EXPENSE_PAYABLE_PAYMENT
  ) return 'payable_pay'
  if (
    transaction.sub_type === 'ASSET_PURCHASE'
    || categoryKey === CategoryKeys.EXPENSE_ASSET
    || hasRelatedModule(transaction.linked_asset)
  ) return 'asset_purchase'
  if (
    transaction.sub_type === 'RECEIVABLE_LENDING'
    || categoryKey === CategoryKeys.EXPENSE_RECEIVABLE_ISSUE
    || hasRelatedModule(transaction.linked_receivable)
  ) return 'receivable_issue'
  return 'expense'
}
