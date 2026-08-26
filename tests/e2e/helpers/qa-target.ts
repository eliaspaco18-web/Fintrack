export const QA_CONFIRMATION = 'DISPOSABLE_QA_ONLY'

type Environment = Record<string, string | undefined>

export interface AuthenticatedQaTarget {
  baseURL: string
  hostname: string
  supabaseProjectRef: string
}

export interface AuthenticatedQaValidation {
  ok: boolean
  errors: string[]
  target: AuthenticatedQaTarget | null
}

function value(env: Environment, key: string) {
  return env[key]?.trim() ?? ''
}

function entries(raw: string) {
  return raw
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
}

function isLoopback(hostname: string) {
  const normalized = hostname.toLowerCase()
  return normalized === 'localhost'
    || normalized === '::1'
    || normalized === '[::1]'
    || normalized.startsWith('127.')
    || normalized.endsWith('.localhost')
}

function matchesProductionHost(hostname: string, productionHost: string) {
  return hostname === productionHost || hostname.endsWith(`.${productionHost}`)
}

export function validateAuthenticatedQaTarget(
  env: Environment = process.env,
): AuthenticatedQaValidation {
  const errors: string[] = []
  const email = value(env, 'E2E_USER_EMAIL')
  const password = value(env, 'E2E_USER_PASSWORD')
  const baseURL = value(env, 'E2E_BASE_URL')
  const expectedHost = value(env, 'E2E_EXPECTED_HOST').toLowerCase()
  const productionHosts = entries(value(env, 'E2E_PRODUCTION_HOSTS'))
  const qaProjectRef = value(env, 'E2E_QA_SUPABASE_PROJECT_REF').toLowerCase()
  const productionProjectRefs = entries(value(env, 'E2E_PRODUCTION_SUPABASE_PROJECT_REFS'))

  if (!email || !password) {
    errors.push('Dedicated E2E user credentials are required in the process environment.')
  }

  if (value(env, 'E2E_TARGET_ENV') !== 'preview') {
    errors.push('E2E_TARGET_ENV must be exactly "preview".')
  }

  if (value(env, 'E2E_ALLOW_ISOLATED_MUTATIONS') !== '1') {
    errors.push('E2E_ALLOW_ISOLATED_MUTATIONS must be exactly "1".')
  }

  if (value(env, 'E2E_QA_CONFIRMATION') !== QA_CONFIRMATION) {
    errors.push(`E2E_QA_CONFIRMATION must be exactly "${QA_CONFIRMATION}".`)
  }

  if (!expectedHost) {
    errors.push('E2E_EXPECTED_HOST is required.')
  }

  if (productionHosts.length === 0) {
    errors.push('E2E_PRODUCTION_HOSTS must list every production hostname.')
  } else if (productionHosts.some(host => host.includes('/') || host.includes(':'))) {
    errors.push('E2E_PRODUCTION_HOSTS entries must be hostnames without scheme, path, or port.')
  }

  if (!qaProjectRef) {
    errors.push('E2E_QA_SUPABASE_PROJECT_REF is required.')
  } else if (!/^[a-z0-9]{20}$/.test(qaProjectRef)) {
    errors.push('E2E_QA_SUPABASE_PROJECT_REF must be a valid 20-character project ref.')
  }

  if (productionProjectRefs.length === 0) {
    errors.push('E2E_PRODUCTION_SUPABASE_PROJECT_REFS must list every production project ref.')
  } else if (productionProjectRefs.some(projectRef => !/^[a-z0-9]{20}$/.test(projectRef))) {
    errors.push('Every production Supabase project ref must contain exactly 20 lowercase letters or digits.')
  }

  if (qaProjectRef && productionProjectRefs.includes(qaProjectRef)) {
    errors.push('The declared QA Supabase project matches a production project ref.')
  }

  let parsedURL: URL | null = null
  if (!baseURL) {
    errors.push('E2E_BASE_URL is required for authenticated QA.')
  } else {
    try {
      parsedURL = new URL(baseURL)
    } catch {
      errors.push('E2E_BASE_URL must be a valid absolute URL.')
    }
  }

  if (parsedURL) {
    const hostname = parsedURL.hostname.toLowerCase()

    if (parsedURL.protocol !== 'https:') {
      errors.push('Authenticated QA requires an HTTPS Preview URL.')
    }
    if (parsedURL.username || parsedURL.password) {
      errors.push('E2E_BASE_URL must not contain embedded credentials.')
    }
    if (parsedURL.pathname !== '/' || parsedURL.search || parsedURL.hash) {
      errors.push('E2E_BASE_URL must contain only the Preview origin.')
    }
    if (isLoopback(hostname)) {
      errors.push('Authenticated QA cannot target localhost or a loopback address.')
    }
    if (expectedHost && hostname !== expectedHost) {
      errors.push('E2E_BASE_URL does not match E2E_EXPECTED_HOST.')
    }
    if (productionHosts.some(productionHost => matchesProductionHost(hostname, productionHost))) {
      errors.push('The authenticated QA target matches a production hostname or subdomain.')
    }
    if (value(env, 'VERCEL_ENV') === 'production') {
      errors.push('Authenticated QA cannot run with VERCEL_ENV=production.')
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    target: errors.length === 0 && parsedURL
      ? {
          baseURL: parsedURL.origin,
          hostname: parsedURL.hostname.toLowerCase(),
          supabaseProjectRef: qaProjectRef,
        }
      : null,
  }
}

export function requireAuthenticatedQaTarget(
  env: Environment = process.env,
): AuthenticatedQaTarget {
  const result = validateAuthenticatedQaTarget(env)

  if (!result.ok || !result.target) {
    throw new Error([
      'Authenticated QA blocked before login or mutation.',
      ...result.errors.map(error => `- ${error}`),
      'See AUTHENTICATED_QA_SETUP.md for the isolated Preview setup.',
    ].join('\n'))
  }

  return result.target
}
