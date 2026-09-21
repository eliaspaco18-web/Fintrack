import { describe, expect, test } from '@playwright/test'
import { getCreditCardTransferPolicy } from '@/modules/transactions/credit-card-transfer-policy'

describe('credit-card transfer policy', () => {
  test('keeps transfers between non-card accounts as ordinary transfers', () => {
    expect(getCreditCardTransferPolicy('SAVINGS', 'CHECKING')).toEqual({
      kind: null,
      violation: null,
    })
  })

  test('classifies a liquid-account payment to a card', () => {
    expect(getCreditCardTransferPolicy('SAVINGS', 'CREDIT_CARD')).toEqual({
      kind: 'PAYMENT',
      violation: null,
    })
  })

  test('classifies a disposition from a card to a liquid account', () => {
    expect(getCreditCardTransferPolicy('CREDIT_CARD', 'CHECKING')).toEqual({
      kind: 'DISPOSITION',
      violation: null,
    })
  })

  test('rejects a transfer between credit cards', () => {
    expect(getCreditCardTransferPolicy('CREDIT_CARD', 'CREDIT_CARD')).toEqual({
      kind: null,
      violation: 'CARD_TO_CARD',
    })
  })

  test('rejects card movements against investment accounts', () => {
    expect(getCreditCardTransferPolicy('CREDIT_CARD', 'ETF')).toEqual({
      kind: null,
      violation: 'INVALID_COUNTERPARTY',
    })
  })
})
