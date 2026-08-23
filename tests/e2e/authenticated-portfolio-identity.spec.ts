import { expect, test, type APIRequestContext } from '@playwright/test'
import { getE2ECredentials, loginViaUI } from './helpers/auth'

const credentials = getE2ECredentials()
const mutationTargetApproved = process.env.E2E_ALLOW_ISOLATED_MUTATIONS === '1'

type AccountRecord = {
  id: string
  name: string
  type: string
  currency: string
  balance: number
  initial_balance: number
  initial_balance_date: string
  include_in_net_worth: boolean
  updated_at: string
  [key: string]: unknown
}

async function createAccount(
  request: APIRequestContext,
  data: Record<string, unknown>,
): Promise<AccountRecord> {
  const response = await request.post('/api/accounts', { data })
  const payload = await response.json()

  expect(response.status()).toBe(201)
  expect(payload).toMatchObject({ ok: true })
  return payload.data as AccountRecord
}

async function getAccount(
  request: APIRequestContext,
  accountId: string,
): Promise<AccountRecord> {
  const response = await request.get('/api/accounts?include_inactive=true')
  const payload = await response.json()

  expect(response.status()).toBe(200)
  expect(payload).toMatchObject({ ok: true })

  const account = (payload.data as AccountRecord[]).find(item => item.id === accountId)
  expect(account).toBeDefined()
  return account!
}

async function expectRejectedAndUnchanged(
  request: APIRequestContext,
  accountId: string,
  update: Record<string, unknown>,
  expectedMessage: RegExp,
) {
  const before = structuredClone(await getAccount(request, accountId))
  const response = await request.patch(`/api/accounts/${accountId}`, { data: update })
  const payload = await response.json()

  expect(response.status()).toBe(422)
  expect(payload).toMatchObject({
    ok: false,
    error: {
      code: 'BUSINESS_RULE_ERROR',
      message: expect.stringMatching(expectedMessage),
    },
  })
  expect(JSON.stringify(payload)).not.toContain(accountId)

  const after = await getAccount(request, accountId)
  expect(after).toEqual(before)
}

test.describe('authenticated Portfolio account identity integrity', () => {
  test.skip(
    !credentials || !mutationTargetApproved,
    'Requires E2E credentials and E2E_ALLOW_ISOLATED_MUTATIONS=1 for a disposable non-production target.',
  )

  test('rejects direct protected-identity PATCH requests and preserves both accounts', async ({ page }) => {
    await loginViaUI(page, credentials!)
    const request = page.context().request
    const createdIds: string[] = []
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    try {
      const operating = await createAccount(request, {
        name: `E2E Identity Operating ${suffix}`,
        type: 'CHECKING',
        currency: 'PEN',
        initial_balance: 125.75,
        include_in_net_worth: true,
        notes: 'Disposable G1B-P01 fixture',
      })
      createdIds.push(operating.id)

      const validEdit = await request.patch(`/api/accounts/${operating.id}`, {
        data: {
          name: `E2E Identity Valid Edit ${suffix}`,
          notes: 'Valid non-identity edit',
          type: 'CHECKING',
          currency: 'PEN',
        },
      })
      const validPayload = await validEdit.json()

      expect(validEdit.status()).toBe(200)
      expect(validPayload).toMatchObject({
        ok: true,
        data: {
          id: operating.id,
          name: `E2E Identity Valid Edit ${suffix}`,
          notes: 'Valid non-identity edit',
          type: 'CHECKING',
          currency: 'PEN',
          balance: 125.75,
          initial_balance: 125.75,
        },
      })

      await expectRejectedAndUnchanged(
        request,
        operating.id,
        { currency: 'USD' },
        /moneda de una cuenta existente/i,
      )
      await expectRejectedAndUnchanged(
        request,
        operating.id,
        { currency: 'XTSAMPLE' },
        /moneda de una cuenta existente/i,
      )
      await expectRejectedAndUnchanged(
        request,
        operating.id,
        { type: 'CREDIT_CARD' },
        /cuenta operativa en tarjeta de crédito/i,
      )

      const creditCard = await createAccount(request, {
        name: `E2E Identity Card ${suffix}`,
        type: 'CREDIT_CARD',
        currency: 'PEN',
        initial_balance: 0,
        include_in_net_worth: false,
        notes: 'Disposable G1B-P01 fixture',
      })
      createdIds.push(creditCard.id)

      await expectRejectedAndUnchanged(
        request,
        creditCard.id,
        { type: 'SAVINGS' },
        /tarjeta de crédito en cuenta operativa/i,
      )
    } finally {
      for (const accountId of createdIds.reverse()) {
        const response = await request.delete(`/api/accounts/${accountId}`)
        expect(response.status()).toBe(204)
      }
    }
  })
})
