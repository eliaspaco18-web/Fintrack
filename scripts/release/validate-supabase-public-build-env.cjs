const PLACEHOLDER_PATTERN = /\[(?:SENSITIVE|REDACTED|PLACEHOLDER)\]/i

function requirePublicValue(env, name) {
  const value = typeof env[name] === 'string' ? env[name].trim() : ''
  if (!value || PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(`${name} is missing or contains a redaction placeholder.`)
  }
  return value
}

function isSupabaseAnonKey(value) {
  if (value.startsWith('sb_publishable_')) {
    return /^[A-Za-z0-9_-]{20,}$/.test(value.slice('sb_publishable_'.length))
  }

  const segments = value.split('.')
  if (segments.length !== 3 || segments.some(segment => !/^[A-Za-z0-9_-]+$/.test(segment))) return false

  try {
    const claims = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'))
    return claims.role === 'anon'
  } catch {
    return false
  }
}

function validateSupabasePublicBuildEnvironment(env) {
  // Local builds and CI without a Vercel deployment environment remain usable.
  // Vercel remote builds set VERCEL_ENV (production/preview/development).
  if (!env.VERCEL && !env.VERCEL_ENV) return { skipped: true }

  const rawUrl = requirePublicValue(env, 'NEXT_PUBLIC_SUPABASE_URL')
  let parsedUrl
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP or HTTPS URL.')
  }

  if (
    !['http:', 'https:'].includes(parsedUrl.protocol) ||
    !parsedUrl.hostname ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP or HTTPS URL.')
  }

  const anonKey = requirePublicValue(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!isSupabaseAnonKey(anonKey)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY must be a supported Supabase anon or publishable key.')
  }

  return { skipped: false }
}

module.exports = { validateSupabasePublicBuildEnvironment }
