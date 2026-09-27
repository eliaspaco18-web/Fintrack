/** Existing transaction creation deep links; no mutation or preselected record ID is generated here. */
export const QUICK_OPERATIONS = [
  { id: 'expense', label: 'Egreso', href: '/transactions?new=transaction&type=EXPENSE', group: 'Movimiento' },
  { id: 'income', label: 'Ingreso', href: '/transactions?new=transaction&type=INCOME' },
  { id: 'transfer', label: 'Transferencia interna', href: '/transactions?new=transaction&type=TRANSFER' },
  { id: 'receivable_issue', label: 'Prestar dinero', href: '/transactions?new=transaction&type=EXPENSE&module=receivable', group: 'Compromisos' },
  { id: 'receivable_collect', label: 'Registrar cobro', href: '/transactions?new=transaction&type=INCOME&module=receivable' },
  { id: 'payable_issue', label: 'Dinero recibido a devolver', href: '/transactions?new=transaction&type=INCOME&module=payable' },
  { id: 'payable_pay', label: 'Registrar pago', href: '/transactions?new=transaction&type=EXPENSE&module=payable' },
  { id: 'asset_purchase', label: 'Comprar un activo', href: '/transactions?new=transaction&type=EXPENSE&module=asset' },
] as const

export const QUICK_CONTEXTUAL_CREATE = {
  portfolio: { id: 'account', label: 'Añadir cuenta', href: '/portfolio?new=portfolio' },
  budgets: { id: 'budget', label: 'Crear presupuesto', href: '/budgets?new=budget' },
  credits: { id: 'credit', label: 'Añadir crédito', href: '/credits?new=credit' },
} as const
