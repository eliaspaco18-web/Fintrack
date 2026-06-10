function normalizeUrlCandidate(raw: string | undefined): string | null {
  if (!raw) return null

  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return null

  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed.replace(/\/+$/, '')
    : `https://${trimmed.replace(/\/+$/, '')}`
}

export function resolveConfiguredAppUrl(): string | null {
  return (
    normalizeUrlCandidate(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeUrlCandidate(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeUrlCandidate(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeUrlCandidate(process.env.VERCEL_URL)
  )
}

export function resolveAppUrlFromRequest(request: { url: string }): string {
  return resolveConfiguredAppUrl() ?? new URL(request.url).origin
}

export function resolveAppUrlFallback(): string {
  return resolveConfiguredAppUrl() ?? 'http://localhost:3000'
}
