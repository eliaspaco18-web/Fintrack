function normalizeUrlCandidate(raw: string | undefined): string | null {
  if (!raw) return null

  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return null

  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed.replace(/\/+$/, '')
    : `https://${trimmed.replace(/\/+$/, '')}`
}

function normalizeSafePreviewUrl(raw: string | undefined): string | null {
  const normalized = normalizeUrlCandidate(raw)
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') || url.hostname === 'fintrack-eta-silk.vercel.app') return null
    return url.origin
  } catch {
    return null
  }
}

export function resolveConfiguredAppUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.VERCEL_ENV === 'preview') {
    // VERCEL_PROJECT_PRODUCTION_URL always describes Production. A Preview
    // must use its own VERCEL_URL to avoid sending QA auth links to Production.
    return (
      normalizeSafePreviewUrl(env.VERCEL_URL) ??
      normalizeSafePreviewUrl(env.NEXT_PUBLIC_SITE_URL) ??
      normalizeSafePreviewUrl(env.NEXT_PUBLIC_APP_URL)
    )
  }

  return (
    normalizeUrlCandidate(env.NEXT_PUBLIC_SITE_URL) ??
    normalizeUrlCandidate(env.NEXT_PUBLIC_APP_URL) ??
    normalizeUrlCandidate(env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeUrlCandidate(env.VERCEL_URL)
  )
}

export function resolveAppUrlFromRequest(request: { url: string }): string {
  const configured = resolveConfiguredAppUrl()
  if (configured) return configured
  if (process.env.VERCEL_ENV === 'preview') return normalizeSafePreviewUrl(new URL(request.url).origin) ?? 'http://localhost:3000'
  return new URL(request.url).origin
}

export function resolveAppUrlFallback(): string {
  return resolveConfiguredAppUrl() ?? 'http://localhost:3000'
}
