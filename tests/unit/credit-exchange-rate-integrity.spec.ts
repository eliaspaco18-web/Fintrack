import { expect, test } from '@playwright/test'
import {
  USD_CREDIT_EXCHANGE_RATE_ERROR,
  resolveCreditExchangeRateInput,
  zBankCreditExchangeRateSubmission,
} from '@/modules/credits/exchange-rate-integrity'
import { apiZodError } from '@/lib/api/response'

test.describe('Credits USD exchange-rate submission integrity', () => {
  test('keeps PEN submissions valid without inventing an exchange rate', () => {
    const parsed = zBankCreditExchangeRateSubmission.safeParse({ currency: 'PEN' })
    const resolved = resolveCreditExchangeRateInput('PEN', '')

    expect(parsed.success).toBe(true)
    expect(resolved).toEqual({ ok: true, exchangeRate: undefined })
  })

  test('accepts a finite positive exchange rate for USD from API and form inputs', () => {
    const parsed = zBankCreditExchangeRateSubmission.safeParse({
      currency: 'USD',
      exchange_rate: 3.725,
    })
    const resolved = resolveCreditExchangeRateInput('USD', '3.725')

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.exchange_rate).toBe(3.725)
    expect(resolved).toEqual({ ok: true, exchangeRate: 3.725 })
  })

  test('blocks missing, null, empty, zero, negative, NaN and infinite USD rates', () => {
    const invalidValues: unknown[] = [
      undefined,
      null,
      '',
      '   ',
      0,
      -0.01,
      0.009,
      100.001,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]

    for (const exchangeRate of invalidValues) {
      const parsed = zBankCreditExchangeRateSubmission.safeParse({
        currency: 'USD',
        exchange_rate: exchangeRate,
      })
      const resolved = resolveCreditExchangeRateInput('USD', exchangeRate)

      expect(parsed.success, `API accepted ${String(exchangeRate)}`).toBe(false)
      expect(resolved, `Form accepted ${String(exchangeRate)}`).toEqual({
        ok: false,
        message: USD_CREDIT_EXCHANGE_RATE_ERROR,
      })
    }
  })

  test('does not coerce ambiguous direct API or form text into an exchange rate', () => {
    const ambiguousValues = ['3.725 PEN', '3,725', '1e3', 'USD 3.725', '3.7.25']

    for (const exchangeRate of ambiguousValues) {
      expect(zBankCreditExchangeRateSubmission.safeParse({
        currency: 'USD',
        exchange_rate: exchangeRate,
      }).success, `API accepted ${exchangeRate}`).toBe(false)
      expect(resolveCreditExchangeRateInput('USD', exchangeRate)).toEqual({
        ok: false,
        message: USD_CREDIT_EXCHANGE_RATE_ERROR,
      })
    }
  })

  test('returns a controlled non-sensitive error without mutating the request', async () => {
    const request = Object.freeze({
      currency: 'USD' as const,
      exchange_rate: 0,
      principal_amount: 25_000,
    })
    const snapshot = structuredClone(request)

    const parsed = zBankCreditExchangeRateSubmission.safeParse(request)

    expect(parsed.success).toBe(false)
    if (parsed.success) throw new Error('Expected invalid exchange-rate submission')

    const response = apiZodError(parsed.error)
    const payload = await response.json()

    expect(response.status).toBe(422)
    expect(payload).toMatchObject({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos',
        fields: {
          exchange_rate: [USD_CREDIT_EXCHANGE_RATE_ERROR],
        },
      },
    })
    expect(request).toEqual(snapshot)
    expect(USD_CREDIT_EXCHANGE_RATE_ERROR).not.toMatch(
      /postgres|supabase|table|relation|policy|rls|token|secret/i,
    )
  })
})
