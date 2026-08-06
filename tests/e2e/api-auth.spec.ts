import { expect, test } from '@playwright/test'

const PROTECTED_API_ROUTES = [
  '/api/dashboard/summary',
  '/api/dashboard/modules-summary',
  '/api/dashboard/sidebar',
  '/api/accounts',
  '/api/profile',
  '/api/transactions',
] as const

for (const route of PROTECTED_API_ROUTES) {
  test(`${route} returns JSON 401 without a session`, async ({ request }) => {
    const response = await request.get(route, { maxRedirects: 0 })
    const payload = await response.json()

    expect(response.status()).toBe(401)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(payload).toMatchObject({
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
      },
    })
  })
}

test('/api/auth/forgot-password remains public with a generic response', async ({ request }) => {
  const response = await request.post('/api/auth/forgot-password', {
    data: {
      email: `fintrack-b3-auth-${Date.now()}@example.invalid`,
    },
    maxRedirects: 0,
  })
  const payload = await response.json()

  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('application/json')
  expect(payload).toMatchObject({
    ok: true,
    data: {
      message: 'Si el correo existe, recibirás un enlace de recuperación en unos minutos.',
    },
  })
})

test('billing-cycle DELETE remains inert without a session', async ({ request }) => {
  const response = await request.delete('/api/credits/test/billing-cycles', {
    maxRedirects: 0,
  })
  const payload = await response.json()

  expect(response.status()).toBe(500)
  expect(response.headers()['content-type']).toContain('application/json')
  expect(payload).toMatchObject({
    ok: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Elimina el ciclo desde el detalle del crédito',
    },
  })
})

test('developer APIs remain blocked in a production-like runtime', async ({ request }) => {
  test.skip(
    process.env.E2E_EXPECT_PRODUCTION_GATES !== '1',
    'Set E2E_EXPECT_PRODUCTION_GATES=1 when testing a production-mode server or Preview.',
  )

  for (const route of ['/api/dev/app-control', '/api/dev/bank-icons']) {
    const response = await request.get(route, { maxRedirects: 0 })
    expect(response.status()).toBe(403)
    expect(response.headers()['content-type']).toContain('application/json')
  }
})
