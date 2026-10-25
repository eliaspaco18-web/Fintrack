import { expect, test } from '@playwright/test'
import { toInitialValues } from '@/components/forms/transaction-edit-data'

test('editing an older USD transaction without a persisted rate does not invent a rate', () => {
  const values = toInitialValues({
    id: 'fixture',
    type: 'EXPENSE',
    currency: 'USD',
    amount: 10,
    exchange_rate: null,
    transaction_date: '2026-10-25',
  } as never)

  expect(values.exchange_rate).toBeUndefined()
})

test('editing a USD transaction retains its persisted historical rate', () => {
  const values = toInitialValues({
    id: 'fixture',
    type: 'EXPENSE',
    currency: 'USD',
    amount: 10,
    exchange_rate: 3.8,
    transaction_date: '2026-10-25',
  } as never)

  expect(values.exchange_rate).toBe(3.8)
})
