import { expect, test } from '@playwright/test'
import {
  formatPortfolioAmount,
  getPortfolioCurrencyPresentation,
  groupPortfolioBalancesByCurrency,
} from '@/modules/portfolio/currency-display'

const currencies = Object.freeze([
  Object.freeze({ code: 'PEN', name: 'Sol peruano', symbol: 'S/', is_system: true }),
  Object.freeze({ code: 'USD', name: 'Dólar americano', symbol: '$', is_system: true }),
  Object.freeze({ code: 'EUR', name: 'Euro', symbol: '€', is_system: true }),
  Object.freeze({ code: 'TOK', name: 'Crédito interno', symbol: '$', is_system: false }),
])

function compactWhitespace(value: string) {
  return value.replace(/\s/g, ' ')
}

test.describe('Portfolio custom currency display', () => {
  test('keeps PEN presentation correct', () => {
    const formatted = compactWhitespace(formatPortfolioAmount(1234.5, 'PEN', currencies))

    expect(formatted).toContain('S/')
    expect(formatted).toContain('1,234.50')
    expect(getPortfolioCurrencyPresentation('PEN', currencies).kind).toBe('standard')
  })

  test('keeps USD presentation correct', () => {
    const formatted = compactWhitespace(formatPortfolioAmount(1234.5, 'USD', currencies))

    expect(formatted).toMatch(/(?:USD|US\$|\$)/)
    expect(formatted).toContain('1,234.50')
    expect(getPortfolioCurrencyPresentation('USD', currencies).kind).toBe('standard')
  })

  test('uses the real ISO code for another standard currency', () => {
    const formatted = compactWhitespace(formatPortfolioAmount(1234.5, 'EUR', currencies))

    expect(formatted).toMatch(/(?:EUR|€)/)
    expect(formatted).not.toContain('$')
    expect(getPortfolioCurrencyPresentation('EUR', currencies)).toMatchObject({
      code: 'EUR',
      kind: 'standard',
    })
  })

  test('shows a custom code explicitly even when its configured symbol is a dollar sign', () => {
    const formatted = compactWhitespace(formatPortfolioAmount(1234.5, 'TOK', currencies))

    expect(formatted).toBe('TOK 1,234.50')
    expect(formatted).not.toContain('$')
    expect(formatted).not.toContain('S/')
    expect(getPortfolioCurrencyPresentation('TOK', currencies)).toEqual({
      code: 'TOK',
      kind: 'custom',
      name: 'Crédito interno',
    })
  })

  test('trusts custom metadata even if its code resembles a core currency', () => {
    const conflictingCurrency = [
      { code: 'USD', name: 'Unidad de servicio', symbol: '$', is_system: false },
    ]

    expect(getPortfolioCurrencyPresentation('USD', conflictingCurrency).kind).toBe('custom')
    expect(compactWhitespace(formatPortfolioAmount(42, 'USD', conflictingCurrency))).toBe('USD 42.00')
  })

  test('keeps an unresolved code explicit instead of defaulting to USD or PEN', () => {
    const formatted = compactWhitespace(formatPortfolioAmount(75, 'XYZUNIT', []))

    expect(formatted).toBe('XYZUNIT 75.00')
    expect(formatted).not.toContain('$')
    expect(formatted).not.toContain('S/')
    expect(getPortfolioCurrencyPresentation('XYZUNIT', []).kind).toBe('unavailable')
  })

  test('does not convert or mutate a custom-currency balance', () => {
    const account = Object.freeze({ balance: 9876.54, currency: 'TOK' })
    const snapshot = structuredClone(account)

    const formatted = compactWhitespace(formatPortfolioAmount(account.balance, account.currency, currencies))

    expect(formatted).toBe('TOK 9,876.54')
    expect(account.balance).toBe(9876.54)
    expect(account).toEqual(snapshot)
  })

  test('keeps PEN, USD, and custom balances in separate totals', () => {
    const totals = groupPortfolioBalancesByCurrency([
      { balance: 100, currency: 'PEN' },
      { balance: 25, currency: 'PEN' },
      { balance: 10, currency: 'USD' },
      { balance: 500, currency: 'TOK' },
    ])

    expect([...totals.entries()]).toEqual([
      ['PEN', 125],
      ['USD', 10],
      ['TOK', 500],
    ])
  })
})
