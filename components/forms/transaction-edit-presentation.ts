import type { OperationType } from '@/components/transactions/OperationTypeSelector'

export const TRANSACTION_EDIT_PRESENTATION: Record<OperationType, { title: string; blocked: boolean }> = {
  income: { title: 'Editar ingreso', blocked: false },
  expense: { title: 'Editar egreso', blocked: false },
  transfer: { title: 'Editar transferencia', blocked: false },
  asset_purchase: { title: 'Editar compra de activo', blocked: false },
  receivable_issue: { title: 'Editar préstamo otorgado', blocked: false },
  receivable_collect: { title: 'Editar cobro', blocked: true },
  payable_issue: { title: 'Editar préstamo recibido', blocked: false },
  payable_pay: { title: 'Editar pago', blocked: true },
}

export function getTransactionEditPresentation(operationType: OperationType) {
  return TRANSACTION_EDIT_PRESENTATION[operationType]
}
