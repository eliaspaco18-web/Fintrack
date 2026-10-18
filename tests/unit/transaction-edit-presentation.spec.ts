import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getTransactionEditPresentation } from '@/components/forms/transaction-edit-presentation'
import { inferOperationType, toInitialValues, type EditableTransaction } from '@/components/forms/transaction-edit-data'
import { CategoryKeys } from '@/lib/constants/category-keys'

const operationTitles = {
  income: 'Editar ingreso',
  expense: 'Editar egreso',
  transfer: 'Editar transferencia',
  asset_purchase: 'Editar compra de activo',
  receivable_issue: 'Editar préstamo otorgado',
  receivable_collect: 'Editar cobro',
  payable_issue: 'Editar préstamo recibido',
  payable_pay: 'Editar pago',
} as const

test('edit presentation gives every operation its matching title and protects settlements', () => {
  for (const [operation, title] of Object.entries(operationTitles)) {
    const presentation = getTransactionEditPresentation(operation as keyof typeof operationTitles)
    expect(presentation.title).toBe(title)
    expect(presentation.blocked).toBe(operation === 'receivable_collect' || operation === 'payable_pay')
  }
})

test('edit modal and form use the approved operation layouts without unlocking protected settlements', () => {
  const form = readFileSync(join(process.cwd(), 'components/forms/TransactionForm/index.tsx'), 'utf8')
  const modal = readFileSync(join(process.cwd(), 'components/forms/TransactionEditModal.tsx'), 'utf8')
  const modalStyles = readFileSync(join(process.cwd(), 'components/tables/TransactionsRound07.module.css'), 'utf8')

  for (const layout of [
    'isIncomeLayout',
    'isAssetPurchaseLayout',
    'isReceivableIssueLayout',
    'isReceivableCollectLayout',
    'isPayableIssueLayout',
    'isPayablePayLayout',
    'isStageALayout && layoutMode === \'expense\'',
    'isStageALayout && layoutMode === \'transfer\'',
  ]) {
    expect(form).toContain(layout)
  }

  expect(form).toContain('data-operation-layout={layoutMode}')
  expect(form).toContain('getTransactionEditPresentation(layoutMode).blocked')
  expect(form).toContain('primaryAction={lockSettlementEdit ? null : (')
  expect(form).toContain("if (paymentMethod === 'CREDIT' && !selectedCreditCardId && sourceAccountId)")
  expect(form).toContain('const linkedCard = creditCardOptions.find(option => option.meta?.account_id === sourceAccountId)')
  expect(form).toContain("setValue('credit_card_id', linkedCard.value")
  expect(form).toContain("setValue('credit_operation', 'CONSUMPTION'")
  expect(modal).toContain('title={title}')
  expect(modal).toContain('key={visibleTransaction.id}')
  expect(modal).toContain('className={styles.editFormReveal}')
  expect(modal).toContain('{showSkeleton ? <EditTransactionSkeleton /> : null}')
  expect(modal).toContain('window.setTimeout(() => setSkeletonTransactionId(transactionId), 120)')
  expect(modalStyles).toContain('animation: editFormReveal 150ms ease-out both')
  expect(modalStyles).toContain('@media (prefers-reduced-motion: reduce)')
  expect(modal).toContain('widthClassName="max-w-[min(96vw,580px)]"')
  expect(form).toContain('onClick={onCancel}')
})

test('synthetic persisted records retain their original values and operation relationships in edit prefill', () => {
  const base = {
    id: 'synthetic-transaction',
    type: 'EXPENSE',
    amount: 125.5,
    amount_pen: 477.9,
    currency: 'USD',
    exchange_rate: 3.808,
    description: 'Compra de equipo',
    transaction_date: '2026-09-14',
    category_id: 'category-1',
    notes: null,
    is_recurring: true,
    attachment_url: 'private/receipt.pdf',
    payment_method: 'CREDIT',
    sender: null,
    recipient: null,
    budget_id: 'budget-1',
    source_account_id: 'account-source',
    destination_account_id: 'account-destination',
  } as unknown as Partial<EditableTransaction>

  const assetRecord = {
    ...base,
    linked_asset: {
      id: 'asset-1', name: 'Laptop', asset_type: 'ELECTRONICS', asset_type_id: 'asset-type-1',
      serial_number: 'SN-88', location: 'Oficina', recipient: 'Proveedor Uno',
    },
  } as unknown as Partial<EditableTransaction>
  expect(inferOperationType(assetRecord)).toBe('asset_purchase')
  expect(toInitialValues(assetRecord)).toMatchObject({
    amount: 125.5, currency: 'USD', exchange_rate: 3.808, transaction_date: '2026-09-14',
    payment_method: 'CREDIT', is_recurring: true, asset_name: 'Laptop', asset_serial: 'SN-88',
    asset_location: 'Oficina', recipient: 'Proveedor Uno', creates_asset: true,
  })

  const receivableRecord = {
    ...base,
    linked_receivable: { id: 'receivable-1', debtor_id: 'debtor-1', due_date: '2026-10-14', notes: 'Nota del módulo' },
  } as unknown as Partial<EditableTransaction>
  expect(inferOperationType(receivableRecord)).toBe('receivable_issue')
  expect(toInitialValues(receivableRecord)).toMatchObject({
    creates_receivable: true, receivable_debtor_id: 'debtor-1', receivable_due: '2026-10-14', notes: 'Nota del módulo',
  })

  const payableRecord = {
    ...base,
    type: 'INCOME',
    linked_payable: { id: 'payable-1', creditor_id: 'creditor-1', due_date: '2026-11-14', notes: 'Nota del acreedor' },
  } as unknown as Partial<EditableTransaction>
  expect(inferOperationType(payableRecord)).toBe('payable_issue')
  expect(toInitialValues(payableRecord)).toMatchObject({
    type: 'INCOME', creates_payable: true, payable_creditor_id: 'creditor-1', payable_due: '2026-11-14', notes: 'Nota del acreedor',
  })

  const operationFixtures: Array<[Partial<EditableTransaction>, string]> = [
    [{ ...base, type: 'INCOME' }, 'income'],
    [{ ...base, category: { id: 'category-2', system_key: CategoryKeys.INCOME_RECEIVABLE_COLLECTION } }, 'receivable_collect'],
    [{ ...base, category: { id: 'category-3', system_key: CategoryKeys.EXPENSE_PAYABLE_PAYMENT } }, 'payable_pay'],
    [{ ...base, type: 'TRANSFER' }, 'transfer'],
    [base, 'expense'],
  ]
  for (const [record, operation] of operationFixtures) {
    expect(inferOperationType(record)).toBe(operation)
    expect(toInitialValues(record)).toMatchObject({
      amount: 125.5, currency: 'USD', exchange_rate: 3.808, transaction_date: '2026-09-14',
      source_account_id: 'account-source', destination_account_id: 'account-destination',
    })
  }
})

const sharedPersistedValues = {
  id: 'synthetic-edit-record',
  amount: 125.5,
  amount_pen: 477.9,
  currency: 'USD',
  exchange_rate: 3.808,
  description: 'Registro de prueba',
  transaction_date: '2026-09-14',
  category_id: 'category-1',
  notes: 'Nota persistida',
  is_recurring: true,
  attachment_url: 'private/receipt.pdf',
  payment_method: 'DEBIT',
  sender: 'Remitente de prueba',
  recipient: 'Destinatario de prueba',
  budget_id: 'budget-1',
  source_account_id: 'account-source',
  destination_account_id: 'account-destination',
} as const

const editOperationCases = [
  {
    name: 'Ingreso', operation: 'income', title: 'Editar ingreso', blocked: false,
    record: { ...sharedPersistedValues, type: 'INCOME' },
    expected: { type: 'INCOME', sender: 'Remitente de prueba', recipient: 'Destinatario de prueba', is_recurring: true },
  },
  {
    name: 'Egreso', operation: 'expense', title: 'Editar egreso', blocked: false,
    record: { ...sharedPersistedValues, type: 'EXPENSE', category: { id: 'category-1', system_key: null } },
    expected: { type: 'EXPENSE', category_id: 'category-1', budget_id: 'budget-1', payment_method: 'DEBIT' },
  },
  {
    name: 'Transferencia', operation: 'transfer', title: 'Editar transferencia', blocked: false,
    record: { ...sharedPersistedValues, type: 'TRANSFER' },
    expected: { type: 'TRANSFER', source_account_id: 'account-source', destination_account_id: 'account-destination' },
  },
  {
    name: 'Compra de activo', operation: 'asset_purchase', title: 'Editar compra de activo', blocked: false,
    record: {
      ...sharedPersistedValues,
      type: 'EXPENSE',
      recipient: null,
      linked_asset: {
        id: 'asset-1', name: 'Laptop de prueba', asset_type: 'ELECTRONICS', asset_type_id: 'asset-type-1',
        serial_number: 'SN-88', location: 'Oficina', recipient: 'Proveedor guardado',
      },
    },
    expected: {
      type: 'EXPENSE', creates_asset: true, asset_name: 'Laptop de prueba', asset_serial: 'SN-88',
      asset_location: 'Oficina', recipient: 'Proveedor guardado',
    },
  },
  {
    name: 'Préstamo otorgado', operation: 'receivable_issue', title: 'Editar préstamo otorgado', blocked: false,
    record: {
      ...sharedPersistedValues,
      type: 'EXPENSE',
      linked_receivable: { id: 'receivable-1', debtor_id: 'debtor-1', due_date: '2026-10-14', notes: 'Nota de la deuda' },
    },
    expected: {
      type: 'EXPENSE', creates_receivable: true, receivable_debtor_id: 'debtor-1', receivable_due: '2026-10-14',
      notes: 'Nota persistida',
    },
  },
  {
    name: 'Préstamo recibido', operation: 'payable_issue', title: 'Editar préstamo recibido', blocked: false,
    record: {
      ...sharedPersistedValues,
      type: 'INCOME',
      linked_payable: { id: 'payable-1', creditor_id: 'creditor-1', due_date: '2026-11-14', notes: 'Nota del acreedor' },
    },
    expected: { type: 'INCOME', creates_payable: true, payable_creditor_id: 'creditor-1', payable_due: '2026-11-14' },
  },
  {
    name: 'Cobro', operation: 'receivable_collect', title: 'Editar cobro', blocked: true,
    record: {
      ...sharedPersistedValues,
      type: 'INCOME',
      category: { id: 'category-collect', system_key: CategoryKeys.INCOME_RECEIVABLE_COLLECTION },
    },
    expected: { type: 'INCOME', category_id: 'category-1', notes: 'Nota persistida' },
  },
  {
    name: 'Pago', operation: 'payable_pay', title: 'Editar pago', blocked: true,
    record: {
      ...sharedPersistedValues,
      type: 'EXPENSE',
      category: { id: 'category-pay', system_key: CategoryKeys.EXPENSE_PAYABLE_PAYMENT },
    },
    expected: { type: 'EXPENSE', category_id: 'category-1', notes: 'Nota persistida' },
  },
] as const

for (const fixture of editOperationCases) {
  test(`edit regression: ${fixture.name} uses its Astra form and preserves persisted values`, () => {
    const record = fixture.record as unknown as Partial<EditableTransaction>
    const operation = inferOperationType(record)
    const presentation = getTransactionEditPresentation(operation)
    const initialValues = toInitialValues(record)

    expect(operation).toBe(fixture.operation)
    expect(presentation).toEqual({ title: fixture.title, blocked: fixture.blocked })
    expect(initialValues).toMatchObject({
      amount: 125.5,
      currency: 'USD',
      exchange_rate: 3.808,
      transaction_date: '2026-09-14',
      description: 'Registro de prueba',
      source_account_id: 'account-source',
      destination_account_id: 'account-destination',
      ...fixture.expected,
    })

    if (fixture.operation === 'transfer') {
      // The edit contract exposes the source amount and rate, but no destination amount.
      // Do not synthesize a cross-currency receive amount for the edit form.
      expect(initialValues).not.toHaveProperty('crossCurrencyDestAmount')
      expect(initialValues).not.toHaveProperty('destination_amount')
    }

    if (fixture.blocked) {
      expect(presentation.blocked).toBe(true)
    }
  })
}

test('opening an edit is read-only and settlement consultation has no save action', () => {
  const modal = readFileSync(join(process.cwd(), 'components/forms/TransactionEditModal.tsx'), 'utf8')
  const loader = readFileSync(join(process.cwd(), 'components/forms/use-transaction-edit-record.ts'), 'utf8')
  const form = readFileSync(join(process.cwd(), 'components/forms/TransactionForm/index.tsx'), 'utf8')

  expect(loader).toContain('fetch(`/api/transactions/${transactionId}`')
  expect(loader).toContain('candidate.id !== expectedId')
  expect(loader).toContain('controller.abort()')
  expect(modal).not.toContain('updateTransactionAction')
  expect(form).toContain('if (lockSettlementEdit)')
  expect(form).toContain('primaryAction={lockSettlementEdit ? null : (')
  expect(form).toContain('<fieldset\n            disabled={lockSettlementEdit}')
  expect(form).toContain('onClick={onCancel}')
})

test('credit-card edit resolves the persisted technical account to its existing card option', () => {
  const creditExpense = {
    ...sharedPersistedValues,
    type: 'EXPENSE',
    payment_method: 'CREDIT',
    source_account_id: 'technical-card-account',
  } as unknown as Partial<EditableTransaction>
  const initialValues = toInitialValues(creditExpense)
  const form = readFileSync(join(process.cwd(), 'components/forms/TransactionForm/index.tsx'), 'utf8')

  expect(initialValues).toMatchObject({
    payment_method: 'CREDIT',
    source_account_id: 'technical-card-account',
  })
  expect(form).toContain('creditCardOptions.find(option => option.meta?.account_id === sourceAccountId)')
  expect(form).toContain("setValue('credit_card_id', linkedCard.value")
})
