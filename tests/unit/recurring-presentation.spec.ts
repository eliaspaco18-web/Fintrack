import { expect, test } from '@playwright/test'
import {
  getRecurringDirection,
  getRecurringOperation,
  matchesRecurringTab,
  recurringUseHref,
  summarizeRecurringRows,
} from '@/modules/recurring/recurring-presentation'

test.describe('Recurring template presentation', () => {
  test('classifies persisted base type and financial subtype together', () => {
    expect(getRecurringOperation({ type: 'EXPENSE', sub_type: 'RECEIVABLE_LENDING' })).toBe('RECEIVABLE')
    expect(getRecurringOperation({ type: 'INCOME', sub_type: 'PAYABLE_PAYMENT' })).toBe('PAYABLE')
    expect(getRecurringOperation({ type: 'EXPENSE', sub_type: null })).toBe('EXPENSE')
    expect(getRecurringOperation({ type: 'EXPENSE', sub_type: 'UNRECOGNIZED' })).toBe('UNKNOWN')
  })

  test('groups incoming loans and outgoing lending without changing their financial meaning', () => {
    expect(getRecurringDirection('PAYABLE')).toBe('incoming')
    expect(getRecurringDirection('RECEIVABLE')).toBe('outgoing')
    expect(matchesRecurringTab('PAYABLE', 'incoming')).toBe(true)
    expect(matchesRecurringTab('RECEIVABLE', 'outgoing')).toBe(true)
    expect(matchesRecurringTab('UNKNOWN', 'other')).toBe(true)
    expect(matchesRecurringTab('TRANSFER', 'incoming')).toBe(false)
  })

  test('counts active availability independently from operation classification', () => {
    expect(summarizeRecurringRows([
      { type: 'INCOME', sub_type: null, is_active: true },
      { type: 'EXPENSE', sub_type: 'RECEIVABLE_LENDING', is_active: false },
      { type: 'INCOME', sub_type: 'PAYABLE_PAYMENT', is_active: true },
      { type: 'TRANSFER', sub_type: null, is_active: null },
      { type: 'EXPENSE', sub_type: 'UNKNOWN', is_active: false },
      { type: 'EXPENSE', sub_type: 'ASSET_PURCHASE', is_active: true },
    ])).toEqual({ active: 2, inactive: 2, incoming: 2, outgoing: 1, transfers: 1, other: 2 })
  })

  test('opens only an active, recognized template in the existing review form without transaction type overrides', () => {
    expect(recurringUseHref({ id: 'template-1', type: 'INCOME', sub_type: null, is_active: true }))
      .toBe('/transactions/new?from_recurring=template-1')
    expect(recurringUseHref({ id: 'template-2', type: 'EXPENSE', sub_type: 'RECEIVABLE_LENDING', is_active: true }))
      .toBe('/transactions/new?from_recurring=template-2')
    expect(recurringUseHref({ id: 'inactive', type: 'INCOME', is_active: false })).toBeNull()
    expect(recurringUseHref({ id: 'unknown', type: 'EXPENSE', sub_type: 'UNKNOWN', is_active: true })).toBeNull()
  })
})
