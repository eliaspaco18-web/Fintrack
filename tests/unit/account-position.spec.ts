import { expect, test } from '@playwright/test'
import {
  getPortfolioPositionFacts,
  PORTFOLIO_POSITION_COMPARISON_DISCLOSURE,
  PORTFOLIO_POSITION_COMPARISON_TITLE,
} from '@/modules/portfolio/account-position'

type AccountPositionFixture = Readonly<{
  balance: number
  currency: string
  initial_balance: number
  initial_balance_date: string | null
}>

function makeAccount(
  overrides: Partial<AccountPositionFixture> = {},
): AccountPositionFixture {
  return Object.freeze({
    balance: 1540.75,
    currency: 'PEN',
    initial_balance: 1200.25,
    initial_balance_date: '2026-01-15',
    ...overrides,
  })
}

test.describe('Portfolio position truthfulness', () => {
  test('exposes only the persisted opening and current position', () => {
    const account = makeAccount()

    const facts = getPortfolioPositionFacts(account)

    expect(facts).toEqual({
      currency: 'PEN',
      opening: {
        amount: 1200.25,
        recordedDate: '2026-01-15',
      },
      current: {
        amount: 1540.75,
      },
    })
    expect(Object.keys(facts)).toEqual(['currency', 'opening', 'current'])
    expect(Object.keys(facts.opening)).toEqual(['amount', 'recordedDate'])
    expect(Object.keys(facts.current)).toEqual(['amount'])
  })

  test('does not generate monthly points between opening and current balances', () => {
    const facts = getPortfolioPositionFacts(makeAccount({
      initial_balance: 100,
      balance: 500,
    }))

    const serialized = JSON.stringify(facts)

    expect(serialized).not.toContain('points')
    expect(serialized).not.toContain('months')
    expect(serialized).not.toContain('trend')
    expect([facts.opening.amount, facts.current.amount]).toEqual([100, 500])
  })

  test('keeps a low-data account useful without implying a trend', () => {
    const facts = getPortfolioPositionFacts(makeAccount({
      initial_balance: 0,
      balance: 0,
      initial_balance_date: null,
    }))

    expect(facts.opening).toEqual({ amount: 0, recordedDate: null })
    expect(facts.current).toEqual({ amount: 0 })
  })

  test('does not infer a date when the stored date is unavailable or invalid', () => {
    expect(getPortfolioPositionFacts(makeAccount({ initial_balance_date: null })).opening.recordedDate)
      .toBeNull()
    expect(getPortfolioPositionFacts(makeAccount({ initial_balance_date: 'not-a-date' })).opening.recordedDate)
      .toBeNull()
  })

  test('preserves exact persisted amounts and does not mutate the source account', () => {
    const account = makeAccount({
      currency: 'USD',
      initial_balance: 9876.54,
      balance: -321.09,
    })
    const snapshot = structuredClone(account)

    const facts = getPortfolioPositionFacts(account)

    expect(facts.currency).toBe('USD')
    expect(facts.opening.amount).toBe(9876.54)
    expect(facts.current.amount).toBe(-321.09)
    expect(account).toEqual(snapshot)
  })

  test('labels the comparison explicitly as non-historical', () => {
    expect(PORTFOLIO_POSITION_COMPARISON_TITLE).toBe('Apertura y posición actual')
    expect(PORTFOLIO_POSITION_COMPARISON_DISCLOSURE).toContain('no representa un historial mensual')
  })
})
