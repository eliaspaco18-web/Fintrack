import { expect, test } from '@playwright/test'
import { runExchangeRateCron } from '../../lib/server/exchange-rate-cron-guard'

const secret = 'unit-test-cron-secret'
const productionHost = 'fintrack-eta-silk.vercel.app'
const stagedHost = 'fintrack-staged-git-codex-branch-abc123.vercel.app'
const snapshot = {
  refreshed: true,
  rate: 3.75,
  fetched_at: '2026-10-30T00:00:00.000Z',
  source: 'test-fixture',
}

test.describe('exchange-rate cron host and secret guard', () => {
  test('blocks a staged deployment host even when the secret is valid', async () => {
    let refreshCalls = 0
    const request = new Request(`https://${stagedHost}/api/cron/exchange-rate`, {
      headers: { host: stagedHost, authorization: `Bearer ${secret}` },
    })

    const response = await runExchangeRateCron(request, secret, async () => {
      refreshCalls += 1
      return snapshot
    })

    expect(response.status).toBe(403)
    expect(refreshCalls).toBe(0)
  })

  test('does not trust a forwarded Production host when the actual host is staged', async () => {
    let refreshCalls = 0
    const request = new Request(`https://${stagedHost}/api/cron/exchange-rate`, {
      headers: {
        host: stagedHost,
        authorization: `Bearer ${secret}`,
        'x-forwarded-host': productionHost,
      },
    })

    const response = await runExchangeRateCron(request, secret, async () => {
      refreshCalls += 1
      return snapshot
    })

    expect(response.status).toBe(403)
    expect(refreshCalls).toBe(0)
  })

  test('requires a configured secret on the Production host', async () => {
    let refreshCalls = 0
    const request = new Request(`https://${productionHost}/api/cron/exchange-rate`, {
      headers: { host: productionHost },
    })

    const response = await runExchangeRateCron(request, undefined, async () => {
      refreshCalls += 1
      return snapshot
    })

    expect(response.status).toBe(401)
    expect(refreshCalls).toBe(0)
  })

  test('rejects an incorrect secret on the Production host', async () => {
    let refreshCalls = 0
    const request = new Request(`https://${productionHost}/api/cron/exchange-rate`, {
      headers: { host: productionHost, authorization: 'Bearer incorrect-secret' },
    })

    const response = await runExchangeRateCron(request, secret, async () => {
      refreshCalls += 1
      return snapshot
    })

    expect(response.status).toBe(401)
    expect(refreshCalls).toBe(0)
  })

  test('rejects a blank configured secret on the Production host', async () => {
    let refreshCalls = 0
    const request = new Request(`https://${productionHost}/api/cron/exchange-rate`, {
      headers: { host: productionHost, authorization: 'Bearer   ' },
    })

    const response = await runExchangeRateCron(request, '   ', async () => {
      refreshCalls += 1
      return snapshot
    })

    expect(response.status).toBe(401)
    expect(refreshCalls).toBe(0)
  })

  test('runs the refresh exactly once for an authorized Production request', async () => {
    let refreshCalls = 0
    let refreshOptions: { forceRefresh: true } | undefined
    const request = new Request(`https://${productionHost}/api/cron/exchange-rate`, {
      headers: { host: productionHost, authorization: `Bearer ${secret}` },
    })

    const response = await runExchangeRateCron(request, secret, async (options) => {
      refreshCalls += 1
      refreshOptions = options
      return snapshot
    })

    expect(response.status).toBe(200)
    expect(refreshCalls).toBe(1)
    expect(refreshOptions).toEqual({ forceRefresh: true })
    await expect(response.json()).resolves.toEqual({
      ok: true,
      rate: snapshot.rate,
      fetched_at: snapshot.fetched_at,
      source: snapshot.source,
    })
  })
})
