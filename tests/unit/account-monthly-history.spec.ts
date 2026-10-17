import { expect, test } from '@playwright/test'
import {
  calculateAccountMonthlyHistories,
  readAccountMonthlyHistories,
  type MonthlyHistoryReader,
  type MonthlyHistoryAccount,
  type MonthlyHistoryTransaction,
} from '@/modules/portfolio/account-monthly-history'

const account: MonthlyHistoryAccount = {
  id: 'cash-1',
  type: 'CHECKING',
  currency: 'PEN',
  initial_balance: 100,
  initial_balance_date: '2025-01-01',
  balance: 90,
}

function transaction(
  overrides: Partial<MonthlyHistoryTransaction> = {},
): MonthlyHistoryTransaction {
  return {
    source_account_id: 'cash-1',
    destination_account_id: null,
    type: 'INCOME',
    amount: 0,
    currency: 'PEN',
    transaction_date: '2025-01-01',
    ...overrides,
  }
}

test.describe('Portfolio account monthly closing history', () => {
  test('reconstructs openings, income, expense, same-currency transfers and no-op months', () => {
    const transactions = [
      transaction({ type: 'INCOME', amount: 50, transaction_date: '2025-01-10' }),
      transaction({ type: 'EXPENSE', amount: 30, transaction_date: '2025-02-10' }),
      transaction({ type: 'TRANSFER', amount: 40, destination_account_id: 'other-1', transaction_date: '2025-03-10' }),
      transaction({ type: 'TRANSFER', source_account_id: 'other-1', destination_account_id: 'cash-1', amount: 10, transaction_date: '2025-04-10' }),
    ]

    const result = calculateAccountMonthlyHistories([account], transactions, '2025-08-15')['cash-1']

    expect(result).toEqual({
      status: 'available',
      points: [
        { month: '2025-02', balance: 120 },
        { month: '2025-03', balance: 80 },
        { month: '2025-04', balance: 90 },
        { month: '2025-05', balance: 90 },
        { month: '2025-06', balance: 90 },
        { month: '2025-07', balance: 90 },
      ],
    })
  })

  test('preserves negative month-end balances', () => {
    const result = calculateAccountMonthlyHistories(
      [{ ...account, balance: -50 }],
      [transaction({ type: 'EXPENSE', amount: 150, transaction_date: '2025-02-12' })],
      '2025-05-01',
    )['cash-1']!

    expect(result.status).toBe('available')
    if (result.status === 'available') {
      expect(result.points.slice(0, 2)).toEqual([
        { month: '2025-01', balance: 100 },
        { month: '2025-02', balance: -50 },
      ])
    }
  })

  test('reconstructs using the current persisted retroactive transaction date', () => {
    const result = calculateAccountMonthlyHistories(
      [{ ...account, balance: 150 }],
      [transaction({ type: 'INCOME', amount: 50, transaction_date: '2025-04-25' })],
      '2025-08-15',
    )['cash-1']!

    expect(result.status).toBe('available')
    if (result.status === 'available') {
      expect(result.points).toEqual([
        { month: '2025-02', balance: 100 },
        { month: '2025-03', balance: 100 },
        { month: '2025-04', balance: 150 },
        { month: '2025-05', balance: 150 },
        { month: '2025-06', balance: 150 },
        { month: '2025-07', balance: 150 },
      ])
    }
  })

  test('fails closed when ledger replay cannot reconcile with the current account balance', () => {
    expect(calculateAccountMonthlyHistories(
      [{ ...account, balance: 1000 }],
      [transaction({ type: 'INCOME', amount: 50, transaction_date: '2025-04-25' })],
      '2025-08-15',
    )['cash-1']!).toMatchObject({ status: 'unavailable', reason: 'CURRENT_BALANCE_MISMATCH', points: [] })
  })

  test('withholds history for cross-currency transfer destinations', () => {
    const usdAccount = { ...account, currency: 'USD', balance: 110 }
    expect(calculateAccountMonthlyHistories(
      [usdAccount],
      [transaction({ type: 'TRANSFER', amount: 10, currency: 'PEN', destination_account_id: 'cash-1', source_account_id: 'other-1', transaction_date: '2025-04-25' })],
      '2025-08-15',
    )['cash-1']!).toMatchObject({ status: 'unavailable', reason: 'CURRENCY_MISMATCH', points: [] })
  })

  test('reconstructs the source side of a cross-currency transfer but withholds the destination side', () => {
    const sourceAccount = { ...account, balance: 90 }
    const destinationAccount = {
      ...account,
      id: 'usd-1',
      currency: 'USD',
      initial_balance: 100,
      balance: 110,
    }
    const crossCurrencyTransfer = transaction({
      type: 'TRANSFER',
      amount: 10,
      currency: 'PEN',
      source_account_id: sourceAccount.id,
      destination_account_id: destinationAccount.id,
      transaction_date: '2025-04-25',
    })
    const histories = calculateAccountMonthlyHistories(
      [sourceAccount, destinationAccount],
      [crossCurrencyTransfer],
      '2025-08-15',
    )

    expect(histories[sourceAccount.id]).toMatchObject({ status: 'available' })
    expect(histories[destinationAccount.id]).toMatchObject({
      status: 'unavailable',
      reason: 'CURRENCY_MISMATCH',
      points: [],
    })
  })

  test('withholds technical accounts, incomplete history and insufficient closed months', () => {
    const histories = calculateAccountMonthlyHistories([
      { ...account, id: 'card-1', type: 'CREDIT_CARD' },
      { ...account, id: 'no-date', initial_balance_date: null },
      { ...account, id: 'new-account', balance: 100, initial_balance_date: '2025-07-15' },
    ], [], '2025-08-15')

    expect(histories['card-1']!).toMatchObject({ status: 'unavailable', reason: 'TECHNICAL_ACCOUNT', points: [] })
    expect(histories['no-date']!).toMatchObject({ status: 'unavailable', reason: 'MISSING_OPENING_DATE', points: [] })
    expect(histories['new-account']!).toMatchObject({ status: 'unavailable', reason: 'INSUFFICIENT_CLOSED_MONTHS', points: [] })
  })

  test('withholds histories for pre-opening rows, invalid and zero amounts, or self-transfers', () => {
    const cases = [
      { tx: transaction({ amount: 10, transaction_date: '2024-12-31' }), reason: 'TRANSACTION_BEFORE_OPENING' },
      { tx: transaction({ amount: 0, transaction_date: '2025-02-01' }), reason: 'INVALID_TRANSACTION' },
      { tx: transaction({ amount: 10, type: 'TRANSFER', destination_account_id: 'cash-1', transaction_date: '2025-02-01' }), reason: 'INVALID_TRANSACTION' },
    ] as const

    for (const { tx, reason } of cases) {
      expect(calculateAccountMonthlyHistories(
        [{ ...account, balance: 100 + (tx.transaction_date < account.initial_balance_date! ? 0 : tx.type === 'EXPENSE' ? -Number(tx.amount) : Number(tx.amount)) }],
        [tx],
        '2025-08-15',
      )['cash-1']!).toMatchObject({ status: 'unavailable', reason, points: [] })
    }
  })
})

function readerMock(overrides: Partial<MonthlyHistoryReader> = {}): MonthlyHistoryReader {
  return {
    getUserId: async () => 'user-a',
    listAccounts: async () => ({ data: [{ ...account, balance: 120, updated_at: '2025-08-01T00:00:00.000Z' }], error: null }),
    listTransactionsPage: async () => ({
      data: [transaction({ amount: 20, transaction_date: '2025-04-10' })],
      error: null,
      count: 1,
    }),
    hasTransactionsUpdatedAfter: async () => ({ data: [], error: null }),
    hasAccountsUpdatedAfter: async () => ({ data: [], error: null }),
    ...overrides,
  }
}

test.describe('Portfolio monthly history endpoint security', () => {
  test('rejects unauthenticated requests without querying account or transaction data', async () => {
    let reads = 0
    const reader = readerMock({
      getUserId: async () => null,
      listAccounts: async () => { reads += 1; return { data: [], error: null } },
      listTransactionsPage: async () => { reads += 1; return { data: [], error: null, count: 0 } },
    })
    const response = await readAccountMonthlyHistories(reader)

    expect(response).toEqual({ status: 'unauthorized' })
    expect(reads).toBe(0)
  })

  test('scopes every read to the authenticated owner and returns no foreign-account keys', async () => {
    const userIds: string[] = []
    const ownedAccount = { ...account, balance: 120, updated_at: '2025-08-01T00:00:00.000Z' }
    const reader = readerMock({
      listAccounts: async userId => {
        userIds.push(userId)
        return { data: [ownedAccount], error: null }
      },
      listTransactionsPage: async userId => {
        userIds.push(userId)
        return {
          data: [
            transaction({ amount: 20, transaction_date: '2025-04-10' }),
            transaction({ source_account_id: 'foreign-account', amount: 999_999, transaction_date: '2025-04-10' }),
          ],
          error: null,
          count: 2,
        }
      },
      hasTransactionsUpdatedAfter: async userId => { userIds.push(userId); return { data: [], error: null } },
      hasAccountsUpdatedAfter: async userId => { userIds.push(userId); return { data: [], error: null } },
    })
    const response = await readAccountMonthlyHistories(reader, {
      now: () => new Date('2025-08-15T12:00:00.000Z'),
    })

    expect(response.status).toBe('ok')
    expect(userIds).toEqual(['user-a', 'user-a', 'user-a', 'user-a'])
    if (response.status === 'ok') {
      expect(Object.keys(response.histories)).toEqual(['cash-1'])
      expect(response.histories['cash-1']).toMatchObject({ status: 'available' })
    }
  })

  test('fails closed when account opening data is incomplete', async () => {
    const reader = readerMock({
      listAccounts: async () => ({
        data: [{ ...account, initial_balance_date: null, balance: 100, updated_at: '2025-08-01T00:00:00.000Z' }],
        error: null,
      }),
      listTransactionsPage: async () => ({ data: [], error: null, count: 0 }),
    })
    const response = await readAccountMonthlyHistories(reader, {
      now: () => new Date('2025-08-15T12:00:00.000Z'),
    })

    expect(response.status).toBe('ok')
    if (response.status !== 'ok') return
    expect(response.histories['cash-1']).toMatchObject({
      status: 'unavailable',
      reason: 'MISSING_OPENING_DATE',
      points: [],
    })
  })

  test('stops at the account safety limit without reading transaction pages', async () => {
    let transactionReads = 0
    const tooManyAccounts = Array.from({ length: 501 }, (_, index) => ({
      ...account,
      id: `cash-${index}`,
    }))
    const reader = readerMock({
      listAccounts: async () => ({ data: tooManyAccounts, error: null, count: tooManyAccounts.length }),
      listTransactionsPage: async () => {
        transactionReads += 1
        return { data: [], error: null, count: 0 }
      },
    })
    const response = await readAccountMonthlyHistories(reader)

    expect(response.status).toBe('ok')
    if (response.status === 'ok') {
      expect(response.histories['cash-0']).toMatchObject({ status: 'unavailable', reason: 'DATASET_TOO_LARGE', points: [] })
    }
    expect(transactionReads).toBe(0)
  })

  test('returns a generic error for database failures without exposing query details', async () => {
    const reader = readerMock({
      listTransactionsPage: async () => ({
        data: null,
        count: null,
        error: { message: 'private relation details and query fragment' },
      }),
    })
    const response = await readAccountMonthlyHistories(reader)

    expect(response).toEqual({ status: 'error' })
    expect(JSON.stringify(response)).not.toContain('private relation details')
  })

  test('aborts a stalled read and returns a controlled timeout response', async () => {
    const reader = readerMock({
      listAccounts: async (_userId, signal) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }),
    })
    const response = await readAccountMonthlyHistories(reader, { timeoutMs: 5 })

    expect(response).toEqual({ status: 'timeout' })
  })
})
