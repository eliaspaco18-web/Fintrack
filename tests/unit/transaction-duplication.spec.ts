import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CategoryKeys } from '@/lib/constants/category-keys'
import type { TransactionFormOptions } from '@/lib/contracts/ui.contracts'
import {
  buildTransactionDuplicationPlan,
  getTransactionDuplicationBlockReason,
  type DuplicableTransaction,
} from '@/modules/transactions/transaction-duplication'
import { TransactionRepository } from '@/modules/transactions/transaction.repository'

const options: TransactionFormOptions = {
  accounts: [
    { value: 'cash-1', label: 'Efectivo', meta: { type: 'CASH' } },
    { value: 'bank-1', label: 'Cuenta bancaria', meta: { type: 'CHECKING' } },
    { value: 'card-1', label: 'Tarjeta', meta: { type: 'CREDIT_CARD' } },
  ],
  creditCards: [{ value: 'card-product-1', label: 'Tarjeta ficticia', meta: { account_id: 'card-1' } }],
  creditors: [],
  debtors: [],
  pendingReceivables: [],
  pendingPayables: [],
  assetTypes: [],
  categories: {
    income: [{ value: 'income-cat', label: 'Salario', system_key: null }],
    expense: [
      { value: 'expense-cat', label: 'Comida', system_key: null },
    ],
  },
  currencies: [],
}

function base(overrides: Partial<DuplicableTransaction> = {}): DuplicableTransaction {
  return {
    id: 'original-id',
    type: 'EXPENSE',
    amount: 42.5,
    amount_pen: 42.5,
    currency: 'PEN',
    exchange_rate: 1,
    description: 'Compra de prueba',
    transaction_date: '2026-10-18',
    category_id: 'expense-cat',
    category: { id: 'expense-cat', system_key: null },
    notes: 'Nota ficticia',
    is_recurring: true,
    recurring_transaction_id: 'schedule-id',
    attachment_url: 'private/original-receipt.pdf',
    payment_method: 'DEBIT',
    sender: null,
    recipient: 'Proveedor ficticio',
    budget_id: 'budget-id',
    source_account_id: 'cash-1',
    destination_account_id: null,
    ...overrides,
  } as DuplicableTransaction
}

test('income, expense, and transfer duplication create safe generic form values', () => {
  const income = buildTransactionDuplicationPlan(base({ type: 'INCOME', category_id: 'income-cat', sender: 'Cliente ficticio' }), options)
  expect(income.operationType).toBe('income')
  expect(income.initialValues).toMatchObject({ type: 'INCOME', source_account_id: 'cash-1', category_id: 'income-cat', sender: 'Cliente ficticio' })

  const expense = buildTransactionDuplicationPlan(base({ currency: 'USD', exchange_rate: 3.8, payment_method: 'DEBIT' }), options)
  expect(expense.operationType).toBe('expense')
  expect(expense.initialValues).toMatchObject({
    type: 'EXPENSE', amount: 42.5, currency: 'USD', payment_method: 'DEBIT', is_recurring: false,
    creates_asset: false, creates_credit: false, creates_loan: false, creates_receivable: false, creates_payable: false,
  })
  expect(expense.initialValues).not.toHaveProperty('exchange_rate')
  expect(expense.initialValues).not.toHaveProperty('attachment_url')
  expect(expense.initialValues).not.toHaveProperty('recurring_transaction_id')
  expect(expense.initialValues).not.toHaveProperty('id')
  expect(expense.warnings.join(' ')).toContain('movimiento único')

  const transfer = buildTransactionDuplicationPlan(base({
    type: 'TRANSFER', category_id: null, destination_account_id: 'bank-1',
  }), options)
  expect(transfer.operationType).toBe('transfer')
  expect(transfer.initialValues).toMatchObject({ type: 'TRANSFER', source_account_id: 'cash-1', destination_account_id: 'bank-1' })
  expect(getTransactionDuplicationBlockReason(base({ type: 'TRANSFER', destination_account_id: 'bank-1' }), options)).toBeNull()
})

test('inactive account or unavailable category is not preselected and the user receives a clear warning', () => {
  const accountMissing = buildTransactionDuplicationPlan(base({ source_account_id: 'inactive-account' }), options)
  expect(accountMissing.initialValues.source_account_id).toBe('')
  expect(accountMissing.warnings.join(' ')).toContain('cuenta original ya no está activa')

  const categoryMissing = buildTransactionDuplicationPlan(base({ category_id: 'missing-category' }), options)
  expect(categoryMissing.initialValues.category_id).toBeUndefined()
  expect(categoryMissing.warnings.join(' ')).toContain('categoría original ya no está disponible')
  expect(getTransactionDuplicationBlockReason(base({ source_account_id: 'inactive-account' }), options)).toBeNull()
})

test('special financial relationships and credit operations fail closed with actionable reasons', () => {
  const specialCases: Array<[string, Partial<DuplicableTransaction>]> = [
    ['card payment', { payment_method: 'CREDIT', credit_card_id: 'card-product-1', credit_operation: 'PAYMENT' }],
    ['card technical account without consumption', { source_account_id: 'card-1' }],
    ['asset', { linked_asset: { id: 'asset-id' } }],
    ['receivable', { linked_receivable: { id: 'receivable-id' } }],
    ['payable', { linked_payable: { id: 'payable-id' } }],
    ['credit line', { linked_credit: { id: 'credit-id' } }],
    ['loan', { linked_loan: { id: 'loan-id' } }],
    ['subtype', { sub_type: 'ASSET_PURCHASE' }],
    ['recurring module category', { category: { id: 'module-cat', system_key: CategoryKeys.EXPENSE_ASSET } }],
    ['locked settlement category', { category: { id: 'settlement-cat', system_key: CategoryKeys.INCOME_RECEIVABLE_COLLECTION } }],
  ]
  for (const [name, overrides] of specialCases) {
    expect(getTransactionDuplicationBlockReason(base(overrides), options), name).toBeTruthy()
  }

  const ordinaryCardPurchase = base({
    source_account_id: 'card-1', payment_method: 'CREDIT', credit_card_id: 'card-product-1', credit_operation: 'CONSUMPTION',
  })
  expect(getTransactionDuplicationBlockReason(ordinaryCardPurchase, options)).toBeNull()
  expect(buildTransactionDuplicationPlan(ordinaryCardPurchase, options).initialValues).toMatchObject({
    source_account_id: 'card-1', payment_method: 'CREDIT', credit_card_id: 'card-product-1', credit_operation: 'CONSUMPTION',
  })
  expect(getTransactionDuplicationBlockReason(ordinaryCardPurchase, { ...options, creditCards: [] })).toContain('tarjeta original ya no está activa')

  const unavailable = getTransactionDuplicationBlockReason(base({ currency: 'EUR' }), options)
  expect(unavailable).toContain('moneda original no se puede verificar')
  expect(getTransactionDuplicationBlockReason(base({ amount: Number.NaN }), options)).toContain('importe original no se puede verificar')
})

test('authenticated detail read is user scoped and returns relations required to block unsafe duplication', async () => {
  let selected = ''
  const filters: Array<[string, string]> = []
  const query = {
    select(columns: string) { selected = columns; return this },
    eq(column: string, value: string) { filters.push([column, value]); return this },
    single() { return this },
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(resolve({ data: { id: 'original-id' }, error: null }))
    },
  }
  const repository = new TransactionRepository({ from: (table: string) => {
    expect(table).toBe('transactions')
    return query
  } } as never)

  const result = await repository.findByIdForUser('original-id', 'owner-42')
  expect(result.ok).toBe(true)
  expect(filters).toEqual([['id', 'original-id'], ['user_id', 'owner-42']])
  expect(selected).toContain('linked_credit:credits!credits_transaction_id_fkey(id)')
  expect(selected).toContain('linked_loan:loans!loans_transaction_id_fkey(id)')
  expect(selected).toContain('linked_asset:assets(')
  expect(selected).toContain('linked_receivable:accounts_receivable(')
  expect(selected).toContain('linked_payable:accounts_payable(')

  const route = readFileSync(join(process.cwd(), 'app/api/transactions/[id]/route.ts'), 'utf8')
  expect(route).toContain('const userId   = await getSessionUserId(supabase)')
  expect(route).toContain('service.getTransactionById(userId, params.id)')
})

test('desktop and mobile row actions open the same shared modal as a fresh create flow', () => {
  const table = readFileSync(join(process.cwd(), 'components/tables/TransactionTable.tsx'), 'utf8')
  const modal = readFileSync(join(process.cwd(), 'components/forms/TransactionEditModal.tsx'), 'utf8')
  expect(table).toContain("label: 'Duplicar'")
  expect(table).toContain("id: 'duplicate', label: 'Duplicar'")
  expect(table).toContain('openDuplicateTransaction(tx.id)')
  expect(modal).toContain("mode={intent === 'duplicate' ? 'create' : 'edit'}")
  expect(modal).toContain("transactionId={intent === 'edit' ? visibleTransaction.id : undefined}")
  expect(modal).toContain('ensureExchangeRateOnMount={intent !== \'duplicate\'}')
  expect(modal).toContain('onSuccess={intent === \'duplicate\' ? onSuccessfulCreate : undefined}')

  const form = readFileSync(join(process.cwd(), 'components/forms/TransactionForm/index.tsx'), 'utf8')
  expect(form).toContain("ensure: ensureExchangeRateOnMount ? '1' : '0'")
  const rateResolver = readFileSync(join(process.cwd(), 'lib/server/exchange-rate.ts'), 'utf8')
  const accountingResolver = rateResolver.slice(
    rateResolver.indexOf('export async function resolveAccountingUsdPenExchangeRate'),
    rateResolver.indexOf('async function resolveLiveUsdPenExchangeRateOnce'),
  )
  expect(accountingResolver).toContain('if (latestLegacy?.effective_date === effectiveDate)')
  expect(accountingResolver).not.toContain('return { ...latestLegacy, effective_date: effectiveDate }')
})
