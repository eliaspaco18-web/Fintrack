import { expect, test } from '@playwright/test'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { apiError } from '@/lib/api/response'
import {
  ACCOUNT_LINK_VERIFICATION_UNAVAILABLE_ERROR,
  checkAccountLinkedRecords,
} from '@/modules/portfolio/account-linked-records'

function countResult(count: number | null, error: unknown = null) {
  return async () => ({ count, error })
}

test.describe('Portfolio linked-record guard', () => {
  test('allows the risky operation only after both counts are verified as zero', async () => {
    const result = await checkAccountLinkedRecords(
      countResult(0),
      countResult(0),
    )

    expect(result).toEqual({
      status: 'clear',
      counts: { transactions: 0, credits: 0, total: 0 },
    })
  })

  test('blocks when a linked transaction exists', async () => {
    const result = await checkAccountLinkedRecords(
      countResult(1),
      countResult(0),
    )

    expect(result).toEqual({
      status: 'linked',
      counts: { transactions: 1, credits: 0, total: 1 },
    })
  })

  test('blocks when a linked credit exists', async () => {
    const result = await checkAccountLinkedRecords(
      countResult(0),
      countResult(2),
    )

    expect(result).toEqual({
      status: 'linked',
      counts: { transactions: 0, credits: 2, total: 2 },
    })
  })

  test('fails closed when the transaction count query returns an error', async () => {
    const result = await checkAccountLinkedRecords(
      countResult(null, { message: 'sensitive transaction database detail' }),
      countResult(0),
    )

    expect(result).toEqual({ status: 'unavailable' })
    expect(JSON.stringify(result)).not.toContain('sensitive transaction database detail')
  })

  test('fails closed when the credit count query returns an error', async () => {
    const result = await checkAccountLinkedRecords(
      countResult(0),
      countResult(null, { message: 'sensitive credit database detail' }),
    )

    expect(result).toEqual({ status: 'unavailable' })
    expect(JSON.stringify(result)).not.toContain('sensitive credit database detail')
  })

  test('fails closed when a count is missing despite no reported query error', async () => {
    const result = await checkAccountLinkedRecords(
      countResult(null),
      countResult(0),
    )

    expect(result).toEqual({ status: 'unavailable' })
  })

  test('fails closed when a count query throws', async () => {
    const result = await checkAccountLinkedRecords(
      async () => {
        throw new Error('sensitive transport detail')
      },
      countResult(0),
    )

    expect(result).toEqual({ status: 'unavailable' })
    expect(JSON.stringify(result)).not.toContain('sensitive transport detail')
  })

  test('exposes a controlled and non-sensitive API/UI error for an unavailable check', async () => {
    expect(ACCOUNT_LINK_VERIFICATION_UNAVAILABLE_ERROR).toEqual({
      code: 'DATABASE_ERROR',
      message: 'No pudimos verificar si esta cuenta tiene registros vinculados.',
      detail: 'La cuenta no fue modificada. Inténtalo nuevamente.',
    })
    expect(JSON.stringify(ACCOUNT_LINK_VERIFICATION_UNAVAILABLE_ERROR)).not.toMatch(
      /postgres|supabase|table|relation|policy|rls/i,
    )

    const response = apiError(ACCOUNT_LINK_VERIFICATION_UNAVAILABLE_ERROR)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({
      ok: false,
      error: {
        ...ACCOUNT_LINK_VERIFICATION_UNAVAILABLE_ERROR,
      },
    })
    expect(getApiErrorMessage(payload, 'Fallback')).toBe(
      'No pudimos verificar si esta cuenta tiene registros vinculados. La cuenta no fue modificada. Inténtalo nuevamente.',
    )
  })

  test('never reaches a mutation branch for linked or unavailable checks', async () => {
    const checks = await Promise.all([
      checkAccountLinkedRecords(countResult(1), countResult(0)),
      checkAccountLinkedRecords(countResult(0), countResult(null, new Error('query failed'))),
    ])
    let mutationCalls = 0

    for (const check of checks) {
      if (check.status === 'clear') mutationCalls += 1
    }

    expect(mutationCalls).toBe(0)
  })
})
