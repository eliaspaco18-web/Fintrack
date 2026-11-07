import test from 'node:test'
import assert from 'node:assert/strict'
import { assertPreviewBuildEnvironment, verifyPreviewBuildEnvironment } from './verify-preview-build-env.mjs'

const qaRef = 'abcdefghijklmnopqrst'
const productionRef = 'zyxwvutsrqponmlkjihg'
const serviceKey = 'sb_secret_synthetic_0123456789abcdefghijkl'

function environment(overrides = {}) {
  return {
    VERCEL_ENV: 'preview',
    FINTRACK_PREVIEW_BUILD_VERIFICATION: '1',
    FINTRACK_PREVIEW_EXPECTED_PROJECT_REF: qaRef,
    FINTRACK_PREVIEW_PRODUCTION_PROJECT_REF: productionRef,
    NEXT_PUBLIC_SUPABASE_URL: `https://${qaRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: `sb_publishable_${'a'.repeat(24)}`,
    SUPABASE_PROJECT_ID: qaRef,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    NEXT_PUBLIC_FINTRACK_V3_SHELL: '1',
    ...overrides,
  }
}

test('remote Preview build skips the QA credential probe unless the trusted workflow requests it', () => {
  assert.deepEqual(assertPreviewBuildEnvironment({ VERCEL_ENV: 'preview' }), { skipped: true })
  assert.deepEqual(assertPreviewBuildEnvironment({ FINTRACK_PREVIEW_BUILD_VERIFICATION: '0' }), { skipped: true })
})

test('remote Preview build rejects production targets, missing Secrets and the unretrievable marker', () => {
  assert.throws(() => assertPreviewBuildEnvironment(environment({ VERCEL_ENV: 'production' })), /only run in a Vercel Preview/)
  assert.throws(() => assertPreviewBuildEnvironment(environment({ SUPABASE_SERVICE_ROLE_KEY: '[SENSITIVE]' })), /missing a usable SUPABASE_SERVICE_ROLE_KEY/)
  assert.throws(() => assertPreviewBuildEnvironment(environment({ SUPABASE_SERVICE_ROLE_KEY: '' })), /missing a usable SUPABASE_SERVICE_ROLE_KEY/)

  const secretEnv = environment({ SUPABASE_SERVICE_ROLE_KEY: '[SENSITIVE]' })
  assert.throws(() => assertPreviewBuildEnvironment(secretEnv), error => {
    assert.doesNotMatch(error.message, /\[SENSITIVE\]/)
    return true
  })
})

test('remote Preview build refuses Production or mismatched Supabase project settings before network access', async () => {
  let requested = false
  const fetchImpl = async () => {
    requested = true
    return new Response(null, { status: 200 })
  }

  await assert.rejects(
    verifyPreviewBuildEnvironment(environment({ NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co` }), fetchImpl),
    /not bound to the isolated QA Supabase project/,
  )
  await assert.rejects(
    verifyPreviewBuildEnvironment(environment({ SUPABASE_PROJECT_ID: productionRef }), fetchImpl),
    /not bound to the isolated QA Supabase project/,
  )
  assert.equal(requested, false)
})

test('remote Preview validates an opaque Secret with a read-only QA Auth request without logging it', async () => {
  let request
  const result = await verifyPreviewBuildEnvironment(environment(), async (url, options) => {
    request = { url, options }
    return new Response(null, { status: 200 })
  })

  assert.equal(result.verified, true)
  assert.equal(request.url, `https://${qaRef}.supabase.co/auth/v1/settings`)
  assert.equal(request.options.method, 'GET')
  assert.equal(request.options.redirect, 'error')
  assert.equal(request.options.headers.apikey, serviceKey)
  assert.equal('Authorization' in request.options.headers, false)
  assert.doesNotMatch(JSON.stringify(result), new RegExp(serviceKey))
})

test('remote Preview validates legacy service JWT scope and rejects unavailable or rejected Secrets safely', async () => {
  const claims = Buffer.from(JSON.stringify({ ref: qaRef, role: 'service_role' })).toString('base64url')
  const legacyKey = `header.${claims}.signature`
  let request
  await verifyPreviewBuildEnvironment(environment({ SUPABASE_SERVICE_ROLE_KEY: legacyKey }), async (url, options) => {
    request = { url, options }
    return new Response(null, { status: 204 })
  })
  assert.equal(request.options.headers.Authorization, `Bearer ${legacyKey}`)

  const responseError = await assert.rejects(
    verifyPreviewBuildEnvironment(environment(), async () => new Response(null, { status: 401 })),
    /was rejected by the isolated project/,
  )
  assert.doesNotMatch(String(responseError), new RegExp(serviceKey))

  const networkError = await assert.rejects(
    verifyPreviewBuildEnvironment(environment(), async () => { throw new Error(`sensitive ${serviceKey}`) }),
    /could not verify its QA Supabase Secret/,
  )
  assert.doesNotMatch(String(networkError), new RegExp(serviceKey))
})
