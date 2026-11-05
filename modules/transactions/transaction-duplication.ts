import { getModuleTrigger, isLockedCategorySystemKey } from '@/lib/constants/category-keys'
import type { CategoryOption, TransactionFormOptions, TransactionFormValues } from '@/lib/contracts/ui.contracts'
import type { EditableTransaction } from '@/components/forms/transaction-edit-data'
import { firstLinkedRecord } from '@/components/forms/transaction-edit-data'

export type DuplicableTransaction = Omit<Partial<EditableTransaction>, 'linked_asset' | 'linked_receivable' | 'linked_payable'> & {
  linked_asset?: Array<{ id: string }> | { id: string } | null
  linked_receivable?: Array<{ id: string }> | { id: string } | null
  linked_payable?: Array<{ id: string }> | { id: string } | null
  linked_credit?: Array<{ id: string }> | { id: string } | null
  linked_loan?: Array<{ id: string }> | { id: string } | null
  credit_card_id?: string | null
  credit_operation?: 'CONSUMPTION' | 'PAYMENT' | null
}

export interface TransactionDuplicationPlan {
  operationType: 'income' | 'expense' | 'transfer'
  initialValues: Partial<TransactionFormValues>
  warnings: string[]
}

function categoryFor(type: DuplicableTransaction['type'], options: TransactionFormOptions): CategoryOption[] {
  if (type === 'INCOME') return options.categories.income
  if (type === 'EXPENSE') return options.categories.expense
  return []
}

function activeAccount(id: string | null | undefined, options: TransactionFormOptions) {
  return id ? options.accounts.find(account => account.value === id) ?? null : null
}

function hasLinkedRecord(value: unknown): boolean {
  return firstLinkedRecord(value as Array<{ id: string }> | { id: string } | null | undefined) !== null
}

function isOrdinaryCardConsumption(transaction: DuplicableTransaction): boolean {
  return transaction.type === 'EXPENSE'
    && transaction.payment_method === 'CREDIT'
    && (transaction.credit_operation === undefined || transaction.credit_operation === 'CONSUMPTION')
}

export function getTransactionDuplicationBlockReason(
  transaction: DuplicableTransaction | null,
  options: TransactionFormOptions,
): string | null {
  if (!transaction) return 'No se pudo verificar el movimiento seleccionado.'

  if (transaction.type !== 'INCOME' && transaction.type !== 'EXPENSE' && transaction.type !== 'TRANSFER') {
    return 'Este tipo de movimiento no admite duplicación segura.'
  }
  const isCardConsumption = isOrdinaryCardConsumption(transaction)
  if (transaction.sub_type || (transaction.payment_method === 'CREDIT' && !isCardConsumption)) {
    return 'Este movimiento está vinculado a una operación de crédito o pago de obligación y no puede duplicarse desde Movimientos.'
  }
  if (
    hasLinkedRecord(transaction.linked_asset)
    || hasLinkedRecord(transaction.linked_receivable)
    || hasLinkedRecord(transaction.linked_payable)
    || hasLinkedRecord(transaction.linked_credit)
    || hasLinkedRecord(transaction.linked_loan)
  ) {
    return 'Este movimiento tiene una relación financiera asociada. Duplícalo desde su módulo para evitar obligaciones o saldos duplicados.'
  }

  const categoryKey = transaction.category?.system_key ?? null
  if (categoryKey && (isLockedCategorySystemKey(categoryKey) || getModuleTrigger(categoryKey))) {
    return 'Este movimiento pertenece a un flujo especial de activos, créditos o deudas y no admite duplicación genérica.'
  }

  const amount = Number(transaction.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'El importe original no se puede verificar; no es seguro crear una copia.'
  }
  if (transaction.currency !== 'PEN' && transaction.currency !== 'USD') {
    return 'La moneda original no se puede verificar; no es seguro crear una copia.'
  }
  if (!transaction.transaction_date || !/^\d{4}-\d{2}-\d{2}$/.test(transaction.transaction_date)) {
    return 'La fecha original no se puede verificar; no es seguro crear una copia.'
  }

  const source = activeAccount(transaction.source_account_id, options)
  const selectedCard = transaction.credit_card_id
    ? options.creditCards.find(card => card.value === transaction.credit_card_id) ?? null
    : options.creditCards.find(card => card.meta?.account_id === transaction.source_account_id) ?? null
  if (isCardConsumption && (!selectedCard || selectedCard.meta?.account_id !== transaction.source_account_id)) {
    return 'La tarjeta original ya no está activa o disponible. Elige una tarjeta vigente desde Créditos antes de duplicar el consumo.'
  }
  if (source?.meta?.type === 'CREDIT_CARD' && !isCardConsumption) {
    return 'Este movimiento utiliza una cuenta técnica de tarjeta fuera de un consumo ordinario y no puede duplicarse como una operación genérica.'
  }
  if (transaction.type === 'TRANSFER') {
    const destination = activeAccount(transaction.destination_account_id, options)
    if (destination?.meta?.type === 'CREDIT_CARD') {
      return 'Esta transferencia utiliza una tarjeta de crédito y no puede duplicarse como una operación genérica.'
    }
    if (source && destination && destination.value === source.value) {
      return 'Las cuentas de esta transferencia no son válidas para crear una copia.'
    }
  }

  return null
}

export function buildTransactionDuplicationPlan(
  transaction: DuplicableTransaction,
  options: TransactionFormOptions,
): TransactionDuplicationPlan {
  const type = transaction.type
  if (type !== 'INCOME' && type !== 'EXPENSE' && type !== 'TRANSFER') {
    throw new Error('Cannot build a duplication plan for an unsupported transaction type.')
  }

  const warnings: string[] = []
  const isCardConsumption = isOrdinaryCardConsumption(transaction)
  const selectedCard = isCardConsumption
    ? transaction.credit_card_id
      ? options.creditCards.find(card => card.value === transaction.credit_card_id) ?? null
      : options.creditCards.find(card => card.meta?.account_id === transaction.source_account_id) ?? null
    : null
  if (transaction.is_recurring || transaction.recurring_transaction_id) {
    warnings.push('La copia será un movimiento único. No se copiará ni activará la programación recurrente original.')
  }
  const source = activeAccount(transaction.source_account_id, options)
  if (!source) warnings.push('La cuenta original ya no está activa. Elige una cuenta vigente antes de guardar.')

  const destination = activeAccount(transaction.destination_account_id, options)
  if (type === 'TRANSFER' && !destination) {
    warnings.push('La cuenta de destino original ya no está activa. Elige una cuenta vigente antes de guardar.')
  }

  const category = transaction.category_id
    ? categoryFor(type, options).find(option => option.value === transaction.category_id) ?? null
    : null
  if (transaction.category_id && !category) {
    warnings.push('La categoría original ya no está disponible para este tipo. Selecciona una categoría válida o continúa sin categoría.')
  }

  const validCategory = category
  const operationType = type === 'INCOME' ? 'income' : type === 'TRANSFER' ? 'transfer' : 'expense'

  return {
    operationType,
    warnings,
    initialValues: {
      type,
      source_account_id: source?.value ?? '',
      ...(type === 'TRANSFER' ? { destination_account_id: destination?.value ?? '' } : {}),
      amount: Number(transaction.amount),
      currency: transaction.currency === 'USD' ? 'USD' : 'PEN',
      // Deliberately omit the persisted FX rate; create mode resolves a verified rate for this date.
      description: transaction.description ?? '',
      transaction_date: transaction.transaction_date,
      category_id: validCategory?.value,
      notes: transaction.notes?.trim() ? transaction.notes : undefined,
      payment_method: type === 'EXPENSE' ? (isCardConsumption ? 'CREDIT' : 'DEBIT') : undefined,
      credit_card_id: isCardConsumption ? selectedCard?.value : undefined,
      credit_operation: isCardConsumption ? 'CONSUMPTION' : undefined,
      is_recurring: false,
      sender: transaction.sender ?? undefined,
      recipient: transaction.recipient ?? undefined,
      budget_id: type === 'EXPENSE' ? transaction.budget_id ?? undefined : undefined,
      creates_asset: false,
      creates_credit: false,
      creates_loan: false,
      loan_schedule: false,
      creates_receivable: false,
      creates_payable: false,
    },
  }
}
