import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function fail(message) {
  throw new Error(message)
}

function decodeJwtClaims(value) {
  const parts = String(value ?? '').split('.')
  if (parts.length !== 3 || !parts[1]) fail('Preview service credential is not a verifiable project-scoped Supabase JWT.')
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    fail('Preview service credential has an invalid JWT payload.')
  }
}

function assertProjectRef(value, name) {
  if (!/^[a-z0-9]{20}$/.test(String(value ?? ''))) fail(`${name} is missing or malformed.`)
}

export function assertPreviewBuildEnvironment(env) {
  if (env.FINTRACK_PREVIEW_BUILD_VERIFICATION !== '1') return { skipped: true }
  if (env.VERCEL_ENV !== 'preview') fail('The QA credential verification can only run in a Vercel Preview build.')

  const previewProjectRef = env.FINTRACK_PREVIEW_EXPECTED_PROJECT_REF
  const productionProjectRef = env.FINTRACK_PREVIEW_PRODUCTION_PROJECT_REF
  assertProjectRef(previewProjectRef, 'Expected Preview Supabase project reference')
  assertProjectRef(productionProjectRef, 'Production Supabase project reference')
  if (previewProjectRef === productionProjectRef) fail('Preview Supabase project must differ from Production.')

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_PROJECT_ID',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_FINTRACK_V3_SHELL',
  ]
  for (const name of required) {
    if (!String(env[name] ?? '').trim() || env[name] === '[SENSITIVE]') {
      fail(`Vercel remote Preview build is missing a usable ${name}.`)
    }
  }

  let supabaseUrl
  try {
    supabaseUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL)
  } catch {
    fail('Vercel remote Preview build has an invalid Supabase URL.')
  }
  if (
    supabaseUrl.protocol !== 'https:' ||
    supabaseUrl.hostname !== `${previewProjectRef}.supabase.co` ||
    supabaseUrl.pathname !== '/' ||
    env.SUPABASE_PROJECT_ID !== previewProjectRef
  ) {
    fail('Vercel remote Preview build is not bound to the isolated QA Supabase project.')
  }
  if (supabaseUrl.hostname === `${productionProjectRef}.supabase.co`) {
    fail('Production Supabase URL is forbidden in a Preview build.')
  }
  if (env.NEXT_PUBLIC_FINTRACK_V3_SHELL !== '1') fail('Vercel Preview build must use the V3 shell.')

  const anonKey = String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (anonKey.includes('.')) {
    const claims = decodeJwtClaims(anonKey)
    if (claims.ref !== previewProjectRef || claims.role !== 'anon') {
      fail('Vercel Preview anon credential is not scoped to the isolated QA project.')
    }
  } else if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(anonKey)) {
    fail('Vercel Preview anon credential has an unsupported format.')
  }

  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY)
  if (serviceKey.includes('.')) {
    const claims = decodeJwtClaims(serviceKey)
    if (claims.ref !== previewProjectRef || claims.role !== 'service_role') {
      fail('Vercel Preview service credential is not scoped to the isolated QA project.')
    }
  } else if (!/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(serviceKey)) {
    fail('Vercel Preview service credential has an unsupported format.')
  }

  return { skipped: false, supabaseUrl: supabaseUrl.origin, previewProjectRef }
}

export async function verifyPreviewBuildEnvironment(env, fetchImpl = fetch) {
  const result = assertPreviewBuildEnvironment(env)
  if (result.skipped) return result

  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY)
  const headers = { apikey: serviceKey }
  if (serviceKey.split('.').length === 3) headers.Authorization = `Bearer ${serviceKey}`

  let response
  try {
    response = await fetchImpl(`${result.supabaseUrl}/auth/v1/settings`, {
      method: 'GET',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    fail('Vercel remote Preview could not verify its QA Supabase Secret using the read-only Auth settings endpoint.')
  }
  if (response.status < 200 || response.status >= 300) {
    fail('Vercel remote Preview QA Supabase Secret was rejected by the isolated project.')
  }

  return { ...result, verified: true }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await verifyPreviewBuildEnvironment(process.env)
    if (result.skipped) {
      process.stdout.write('Preview-only QA Secret check was not requested.\n')
    } else {
      process.stdout.write('Vercel remote Preview QA credentials were verified without disclosing their values.\n')
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Preview QA credential verification failed.'}\n`)
    process.exitCode = 1
  }
}
