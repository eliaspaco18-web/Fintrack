import { expect, test } from '@playwright/test'
import { ClientFetchTimeoutError } from '@/lib/client/fetch-with-timeout'
import { getApiErrorMessage } from '@/lib/api/error-message'
import {
  PORTFOLIO_MUTATION_TIMEOUT_MESSAGE,
  requestPortfolioMutation,
} from '@/modules/portfolio/account-mutation-timeout'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test.describe('Portfolio mutation timeout protection', () => {
  test('keeps a successful mutation working without reconciliation', async () => {
    let reconciliationCalls = 0
    const observed: { signal?: AbortSignal } = {}

    const result = await requestPortfolioMutation(
      '/api/accounts',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Cuenta segura' }),
      },
      () => { reconciliationCalls += 1 },
      {
        timeoutMs: 50,
        fetchImpl: async (_input, init) => {
          observed.signal = init?.signal ?? undefined
          return jsonResponse({ ok: true, data: { id: 'account-1' } }, 201)
        },
      },
    )

    expect(result.response.status).toBe(201)
    expect(result.payload).toEqual({ ok: true, data: { id: 'account-1' } })
    expect(reconciliationCalls).toBe(0)
    expect(observed.signal?.aborted).toBe(false)
  })

  test('preserves a controlled API error for the existing UI path', async () => {
    let reconciliationCalls = 0

    const result = await requestPortfolioMutation(
      '/api/accounts/account-1',
      { method: 'PATCH' },
      () => { reconciliationCalls += 1 },
      {
        timeoutMs: 50,
        fetchImpl: async () => jsonResponse({
          ok: false,
          error: {
            message: 'No se pudo actualizar la cuenta.',
            detail: 'La cuenta no fue modificada.',
          },
        }, 409),
      },
    )

    expect(result.response.status).toBe(409)
    expect(getApiErrorMessage(result.payload, 'Fallback')).toBe(
      'No se pudo actualizar la cuenta. La cuenta no fue modificada.',
    )
    expect(reconciliationCalls).toBe(0)
  })

  test('times out a stalled mutation, aborts it, and starts reconciliation', async () => {
    let reconciliationCalls = 0
    const observed: { signal?: AbortSignal } = {}

    const mutation = requestPortfolioMutation(
      '/api/accounts/account-1',
      { method: 'PATCH' },
      () => { reconciliationCalls += 1 },
      {
        timeoutMs: 5,
        fetchImpl: (_input, init) => {
          observed.signal = init?.signal ?? undefined
          return new Promise<Response>((_, reject) => {
            observed.signal?.addEventListener('abort', () => {
              reject(new DOMException('sensitive transport detail', 'AbortError'))
            }, { once: true })
          })
        },
      },
    )

    await expect(mutation).rejects.toMatchObject({
      name: 'ClientFetchTimeoutError',
      message: PORTFOLIO_MUTATION_TIMEOUT_MESSAGE,
    })
    expect(observed.signal?.aborted).toBe(true)
    expect(reconciliationCalls).toBe(1)
    expect(PORTFOLIO_MUTATION_TIMEOUT_MESSAGE).not.toMatch(
      /postgres|supabase|table|relation|policy|rls|sensitive/i,
    )
  })

  test('bounds response-body parsing as part of the mutation', async () => {
    let reconciliationCalls = 0

    const responseWithStalledBody = {
      status: 200,
      json: () => new Promise<never>(() => undefined),
    } as unknown as Response

    await expect(requestPortfolioMutation(
      '/api/accounts/account-1',
      { method: 'PATCH' },
      () => { reconciliationCalls += 1 },
      {
        timeoutMs: 5,
        fetchImpl: async () => responseWithStalledBody,
      },
    )).rejects.toBeInstanceOf(ClientFetchTimeoutError)

    expect(reconciliationCalls).toBe(1)
  })

  test('lets the caller release loading after a timeout', async () => {
    let loading = true
    let reconciliationCalls = 0

    try {
      await requestPortfolioMutation(
        '/api/accounts/account-1',
        { method: 'DELETE' },
        () => { reconciliationCalls += 1 },
        {
          timeoutMs: 5,
          fetchImpl: () => new Promise<Response>(() => undefined),
        },
      )
    } catch (error) {
      expect(error).toBeInstanceOf(ClientFetchTimeoutError)
    } finally {
      loading = false
    }

    expect(loading).toBe(false)
    expect(reconciliationCalls).toBe(1)
  })

  test('does not keep the mutation pending if background reconciliation stalls', async () => {
    let reconciliationCalls = 0

    const mutationOutcome = requestPortfolioMutation(
      '/api/accounts/account-1',
      { method: 'PATCH' },
      () => {
        reconciliationCalls += 1
        return new Promise<void>(() => undefined)
      },
      {
        timeoutMs: 5,
        fetchImpl: () => new Promise<Response>(() => undefined),
      },
    ).then(
      () => 'unexpected-success',
      error => error instanceof ClientFetchTimeoutError ? 'controlled-timeout' : 'unexpected-error',
    )

    const outcome = await Promise.race([
      mutationOutcome,
      new Promise<'still-pending'>(resolve => setTimeout(() => resolve('still-pending'), 50)),
    ])

    expect(outcome).toBe('controlled-timeout')
    expect(reconciliationCalls).toBe(1)
  })

  test('does not misclassify an immediate request failure as a timeout', async () => {
    let reconciliationCalls = 0
    const networkError = new Error('network unavailable')

    await expect(requestPortfolioMutation(
      '/api/accounts/account-1',
      { method: 'PATCH' },
      () => { reconciliationCalls += 1 },
      {
        timeoutMs: 50,
        fetchImpl: async () => { throw networkError },
      },
    )).rejects.toBe(networkError)

    expect(reconciliationCalls).toBe(0)
  })

  test('handles a successful no-content delete response', async () => {
    const result = await requestPortfolioMutation(
      '/api/accounts/account-1',
      { method: 'DELETE' },
      () => undefined,
      {
        timeoutMs: 50,
        fetchImpl: async () => new Response(null, { status: 204 }),
      },
    )

    expect(result.response.status).toBe(204)
    expect(result.payload).toBeNull()
  })
})
