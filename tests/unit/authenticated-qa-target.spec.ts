import { expect, test } from '@playwright/test'
import {
  QA_CONFIRMATION,
  requireAuthenticatedQaTarget,
  validateAuthenticatedQaTarget,
} from '@/tests/e2e/helpers/qa-target'

function safeEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    E2E_USER_EMAIL: 'qa-user@example.test',
    E2E_USER_PASSWORD: 'not-a-real-secret',
    E2E_TARGET_ENV: 'preview',
    E2E_BASE_URL: 'https://fintrack-g1z-p01-example.vercel.app',
    E2E_EXPECTED_HOST: 'fintrack-g1z-p01-example.vercel.app',
    E2E_PRODUCTION_HOSTS: 'fintrack.app,www.fintrack.app,fintrack-production.vercel.app',
    E2E_QA_SUPABASE_PROJECT_REF: 'qapreviewproject0001',
    E2E_PRODUCTION_SUPABASE_PROJECT_REFS: 'productionproject001',
    E2E_ALLOW_ISOLATED_MUTATIONS: '1',
    E2E_QA_CONFIRMATION: QA_CONFIRMATION,
    ...overrides,
  }
}

test.describe('authenticated QA target guard', () => {
  test('accepts an explicitly confirmed isolated Preview target', () => {
    const result = validateAuthenticatedQaTarget(safeEnvironment())

    expect(result).toEqual({
      ok: true,
      errors: [],
      target: {
        baseURL: 'https://fintrack-g1z-p01-example.vercel.app',
        hostname: 'fintrack-g1z-p01-example.vercel.app',
        supabaseProjectRef: 'qapreviewproject0001',
      },
    })
  })

  test('blocks a production hostname before login or mutation', () => {
    const result = validateAuthenticatedQaTarget(safeEnvironment({
      E2E_BASE_URL: 'https://fintrack.app',
      E2E_EXPECTED_HOST: 'fintrack.app',
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('The authenticated QA target matches a production hostname or subdomain.')
  })

  test('blocks a production Supabase project ref', () => {
    const result = validateAuthenticatedQaTarget(safeEnvironment({
      E2E_QA_SUPABASE_PROJECT_REF: 'productionproject001',
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('The declared QA Supabase project matches a production project ref.')
  })

  test('blocks localhost and non-HTTPS targets', () => {
    const result = validateAuthenticatedQaTarget(safeEnvironment({
      E2E_BASE_URL: 'http://127.0.0.1:3100',
      E2E_EXPECTED_HOST: '127.0.0.1',
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('Authenticated QA requires an HTTPS Preview URL.')
    expect(result.errors).toContain('Authenticated QA cannot target localhost or a loopback address.')
  })

  test('blocks a mismatched expected host and missing mutation confirmation', () => {
    const result = validateAuthenticatedQaTarget(safeEnvironment({
      E2E_EXPECTED_HOST: 'different-preview.example.test',
      E2E_ALLOW_ISOLATED_MUTATIONS: '0',
      E2E_QA_CONFIRMATION: 'NO',
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('E2E_BASE_URL does not match E2E_EXPECTED_HOST.')
    expect(result.errors).toContain('E2E_ALLOW_ISOLATED_MUTATIONS must be exactly "1".')
  })

  test('fails closed without credentials or production denylists', () => {
    const result = validateAuthenticatedQaTarget(safeEnvironment({
      E2E_USER_EMAIL: undefined,
      E2E_USER_PASSWORD: undefined,
      E2E_PRODUCTION_HOSTS: undefined,
      E2E_PRODUCTION_SUPABASE_PROJECT_REFS: undefined,
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('Dedicated E2E user credentials are required in the process environment.')
    expect(result.errors).toContain('E2E_PRODUCTION_HOSTS must list every production hostname.')
    expect(result.errors).toContain('E2E_PRODUCTION_SUPABASE_PROJECT_REFS must list every production project ref.')
  })

  test('controlled failure does not expose credentials', () => {
    const secret = 'sensitive-password-value'

    expect(() => requireAuthenticatedQaTarget(safeEnvironment({
      E2E_USER_PASSWORD: secret,
      E2E_TARGET_ENV: 'production',
    }))).toThrow(/Authenticated QA blocked before login or mutation/)

    try {
      requireAuthenticatedQaTarget(safeEnvironment({
        E2E_USER_PASSWORD: secret,
        E2E_TARGET_ENV: 'production',
      }))
    } catch (error) {
      expect(String(error)).not.toContain(secret)
    }
  })
})
