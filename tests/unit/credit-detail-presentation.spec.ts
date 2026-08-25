import { expect, test } from '@playwright/test'
import {
  CREDIT_AVAILABILITY_NOT_APPLICABLE_MESSAGE,
  CREDIT_AVAILABILITY_UNAVAILABLE_MESSAGE,
  CREDIT_CURRENCY_UNAVAILABLE_MESSAGE,
  getCreditDetailPresentation,
  type CreditDetailLoanEvidence,
} from '@/modules/credits/credit-detail-presentation'
import type { Credit } from '@/types/database.types'

function creditFixture(overrides: Partial<Credit> = {}): Credit {
  return {
    id: 'credit-1',
    user_id: 'user-1',
    account_id: 'account-1',
    bank_entity_id: 'bank-1',
    transaction_id: null,
    credit_type: 'CREDIT_CARD',
    name: 'Tarjeta principal',
    currency: 'PEN',
    credit_limit: 10_000,
    credit_limit_pen: 10_000,
    credit_limit_usd: 0,
    used_amount: 2_500,
    used_amount_pen: 2_500,
    used_amount_usd: 0,
    initial_used_amount_pen: 2_500,
    initial_used_amount_usd: 0,
    available_amount: 99,
    interest_rate: 0.03,
    closing_day: 20,
    payment_day: 5,
    status: 'ACTIVE',
    notes: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

const NO_LOAN: CreditDetailLoanEvidence = { status: 'NOT_APPLICABLE' }

test.describe('Credit detail currency and available amount correctness', () => {
  test('presents a PEN card in native currency and derives available amount from limit and used', () => {
    const credit = creditFixture({ available_amount: 99 })
    const before = structuredClone(credit)
    const result = getCreditDetailPresentation(credit, NO_LOAN)

    expect(result).toMatchObject({
      product: 'CARD',
      currency: 'PEN',
      currencyLabel: 'PEN',
      availability: {
        status: 'AVAILABLE',
        amount: 7_500,
        limit: 10_000,
        used: 2_500,
        utilizationPct: 25,
      },
      primaryAmount: { status: 'AVAILABLE', amount: 7_500, label: 'disponible' },
    })
    expect(result.availability.status === 'AVAILABLE' && result.availability.amount).not.toBe(credit.available_amount)
    expect(credit).toEqual(before)
  })

  test('presents a USD card in USD without converting or mixing PEN values', () => {
    const result = getCreditDetailPresentation(creditFixture({
      currency: 'USD',
      credit_limit: 4_000,
      credit_limit_pen: 25_000,
      credit_limit_usd: 4_000,
      used_amount: 1_250,
      used_amount_pen: 8_000,
      used_amount_usd: 1_250,
      available_amount: null,
    }), NO_LOAN)

    expect(result).toMatchObject({
      currency: 'USD',
      availability: {
        status: 'AVAILABLE',
        amount: 2_750,
        limit: 4_000,
        used: 1_250,
      },
    })
    expect(result.availability.status === 'AVAILABLE' && result.availability.amount).not.toBe(17_000)
  })

  test('uses the established matching native fallback for legacy card rows', () => {
    const result = getCreditDetailPresentation(creditFixture({
      currency: 'USD',
      credit_limit: 2_000,
      credit_limit_usd: 0,
      used_amount: 500,
      used_amount_usd: 0,
      available_amount: null,
    }), NO_LOAN)

    expect(result.availability).toMatchObject({
      status: 'AVAILABLE',
      amount: 1_500,
      limit: 2_000,
      used: 500,
    })
  })

  test('marks loan availability as not applicable and uses the verified native principal', () => {
    const result = getCreditDetailPresentation(creditFixture({
      credit_type: 'LINE_OF_CREDIT',
      currency: 'USD',
      credit_limit: 12_000,
      used_amount: 12_000,
      available_amount: 0,
    }), {
      status: 'VERIFIED',
      currency: 'USD',
      principalAmount: 12_000,
    })

    expect(result).toMatchObject({
      product: 'LOAN',
      productLabel: 'Préstamo bancario',
      currency: 'USD',
      availability: { status: 'NOT_APPLICABLE', amount: null },
      primaryAmount: { status: 'AVAILABLE', amount: 12_000, label: 'capital original' },
      availabilityMessage: CREDIT_AVAILABILITY_NOT_APPLICABLE_MESSAGE,
    })
  })

  test('presents an ordinary line availability when loan absence is verified', () => {
    const result = getCreditDetailPresentation(creditFixture({
      credit_type: 'LINE_OF_CREDIT',
      currency: 'PEN',
      credit_limit: 6_000,
      credit_limit_pen: 6_000,
      used_amount: 1_500,
      used_amount_pen: 1_500,
    }), NO_LOAN)

    expect(result).toMatchObject({
      product: 'LINE',
      productLabel: 'Línea de crédito',
      availability: { status: 'AVAILABLE', amount: 4_500 },
    })
  })

  test('does not claim availability when loan versus line cannot be verified', () => {
    const result = getCreditDetailPresentation(creditFixture({
      credit_type: 'LINE_OF_CREDIT',
      currency: 'PEN',
    }), { status: 'UNAVAILABLE' })

    expect(result).toMatchObject({
      product: 'UNAVAILABLE',
      productLabel: 'Tipo no verificable',
      currency: 'PEN',
      availability: { status: 'UNAVAILABLE', amount: null },
      availabilityMessage: CREDIT_AVAILABILITY_UNAVAILABLE_MESSAGE,
    })
  })

  test('does not assume PEN or USD for an unsupported currency', () => {
    const result = getCreditDetailPresentation(creditFixture({ currency: 'EUR' }), NO_LOAN)

    expect(result).toMatchObject({
      currency: null,
      currencyLabel: 'No verificable',
      availability: { status: 'UNAVAILABLE', amount: null },
      primaryAmount: { status: 'UNAVAILABLE', amount: null },
      availabilityMessage: CREDIT_CURRENCY_UNAVAILABLE_MESSAGE,
    })
  })

  test('does not silently choose a currency when credit and verified loan disagree', () => {
    const result = getCreditDetailPresentation(creditFixture({
      credit_type: 'LINE_OF_CREDIT',
      currency: 'PEN',
    }), {
      status: 'VERIFIED',
      currency: 'USD',
      principalAmount: 10_000,
    })

    expect(result).toMatchObject({
      product: 'LOAN',
      currency: null,
      currencyLabel: 'No verificable',
      primaryAmount: { status: 'UNAVAILABLE', amount: null },
      availabilityMessage: CREDIT_CURRENCY_UNAVAILABLE_MESSAGE,
    })
  })

  test('does not present a zero or invalid loan principal as a verified amount', () => {
    for (const invalidPrincipal of [0, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const result = getCreditDetailPresentation(creditFixture({
        credit_type: 'LINE_OF_CREDIT',
        currency: 'PEN',
      }), {
        status: 'VERIFIED',
        currency: 'PEN',
        principalAmount: invalidPrincipal,
      })

      expect(result).toMatchObject({
        product: 'LOAN',
        availability: { status: 'NOT_APPLICABLE', amount: null },
        primaryAmount: { status: 'UNAVAILABLE', amount: null },
      })
    }
  })

  test('uses a controlled unavailable state for invalid or unverifiable native values', () => {
    for (const invalidLimit of [0, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const result = getCreditDetailPresentation(creditFixture({
        credit_limit: invalidLimit,
        credit_limit_pen: invalidLimit,
      }), NO_LOAN)

      expect(result).toMatchObject({
        availability: { status: 'UNAVAILABLE', amount: null },
        availabilityMessage: CREDIT_AVAILABILITY_UNAVAILABLE_MESSAGE,
      })
    }
  })
})
