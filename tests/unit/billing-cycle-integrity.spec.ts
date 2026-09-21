import { describe, expect, test } from '@playwright/test'
import {
  getBillingCycleDateIssue,
  getBillingCyclesSubmissionIssue,
} from '@/modules/credits/billing-cycle-integrity'

const validCycle = {
  billing_month: 9,
  billing_year: 2026,
  consumption_from: '2026-08-21',
  consumption_to: '2026-09-20',
  payment_date: '2026-10-05',
}

describe('billing-cycle integrity', () => {
  test('accepts a cycle that closes in its selected billing month', () => {
    expect(getBillingCycleDateIssue(validCycle)).toBeNull()
  })

  test('rejects a payment date before the billing period closes', () => {
    expect(getBillingCycleDateIssue({
      ...validCycle,
      payment_date: '2026-09-19',
    })).toMatch(/fecha de pago/i)
  })

  test('rejects a billing month that does not match the closing date', () => {
    expect(getBillingCycleDateIssue({
      ...validCycle,
      billing_month: 8,
    })).toMatch(/mes y año/i)
  })

  test('rejects overlapping consumption periods', () => {
    expect(getBillingCyclesSubmissionIssue([
      validCycle,
      {
        billing_month: 10,
        billing_year: 2026,
        consumption_from: '2026-09-15',
        consumption_to: '2026-10-20',
        payment_date: '2026-11-05',
      },
    ])).toMatch(/superponerse/i)
  })
})
