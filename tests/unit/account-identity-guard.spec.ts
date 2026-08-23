import { expect, test } from '@playwright/test'
import type { AccountType } from '@/types/database.types'
import {
  crossesTechnicalAccountBoundary,
  getAccountIdentityViolation,
} from '@/modules/portfolio/account-identity'

type AccountFixture = Readonly<{
  id: string
  type: AccountType
  currency: string
  balance: number
  initial_balance: number
  initial_balance_date: string
  include_in_net_worth: boolean
  name: string
}>

function makeAccount(overrides: Partial<AccountFixture> = {}): AccountFixture {
  return Object.freeze({
    id: 'account-fixture',
    type: 'SAVINGS',
    currency: 'PEN',
    balance: 1540.75,
    initial_balance: 1200,
    initial_balance_date: '2026-01-15',
    include_in_net_worth: true,
    name: 'Cuenta de prueba',
    ...overrides,
  })
}

test.describe('Portfolio account identity guard', () => {
  test('allows valid edits that omit or preserve protected identity', () => {
    const existing = makeAccount()

    expect(getAccountIdentityViolation(existing, {})).toBeNull()
    expect(getAccountIdentityViolation(existing, {
      currency: ' pen ',
      type: 'SAVINGS',
    })).toBeNull()
  })

  test('allows an operating-to-operating type change', () => {
    const existing = makeAccount({ type: 'SAVINGS' })

    expect(crossesTechnicalAccountBoundary(existing.type, 'CHECKING')).toBe(false)
    expect(getAccountIdentityViolation(existing, { type: 'CHECKING' })).toBeNull()
  })

  test('rejects a system currency change without mutating the account', () => {
    const existing = makeAccount({ currency: 'PEN' })
    const snapshot = structuredClone(existing)

    const violation = getAccountIdentityViolation(existing, { currency: 'USD' })

    expect(violation).toMatchObject({ field: 'currency' })
    expect(existing).toEqual(snapshot)
  })

  test('rejects a custom currency change without mutating the account', () => {
    const existing = makeAccount({ currency: 'PEN' })
    const snapshot = structuredClone(existing)

    const violation = getAccountIdentityViolation(existing, { currency: 'XTSAMPLE' })

    expect(violation).toMatchObject({ field: 'currency' })
    expect(existing).toEqual(snapshot)
  })

  test('rejects an operating-to-credit-card transition without mutating balances', () => {
    const existing = makeAccount({ type: 'CHECKING' })
    const snapshot = structuredClone(existing)

    const violation = getAccountIdentityViolation(existing, { type: 'CREDIT_CARD' })

    expect(violation).toMatchObject({ field: 'type' })
    expect(existing).toEqual(snapshot)
  })

  test('rejects a credit-card-to-operating transition without mutating balances', () => {
    const existing = makeAccount({
      type: 'CREDIT_CARD',
      balance: 0,
      initial_balance: 0,
      include_in_net_worth: false,
    })
    const snapshot = structuredClone(existing)

    const violation = getAccountIdentityViolation(existing, { type: 'CHECKING' })

    expect(violation).toMatchObject({ field: 'type' })
    expect(existing).toEqual(snapshot)
  })

  test('keeps an idempotent credit-card identity valid', () => {
    const existing = makeAccount({
      type: 'CREDIT_CARD',
      balance: 0,
      initial_balance: 0,
      include_in_net_worth: false,
    })

    expect(getAccountIdentityViolation(existing, {
      type: 'CREDIT_CARD',
      currency: 'PEN',
    })).toBeNull()
  })
})
