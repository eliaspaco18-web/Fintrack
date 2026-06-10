type ObservabilityMeta = Record<string, string | number | boolean | null | undefined>

function serializeMeta(meta: ObservabilityMeta | undefined): string {
  if (!meta) return ''

  const entries = Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)

  return entries.length > 0 ? ` ${entries.join(' ')}` : ''
}

function isExpectedDynamicServerUsage(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const digest = 'digest' in error ? error.digest : undefined
  return digest === 'DYNAMIC_SERVER_USAGE'
}

export async function measureServerOperation<T>(
  operation: string,
  work: () => Promise<T>,
  options?: {
    warnAtMs?: number
    meta?: ObservabilityMeta
  },
): Promise<T> {
  const startedAt = Date.now()
  const warnAtMs = options?.warnAtMs ?? 700

  try {
    const result = await work()
    const durationMs = Date.now() - startedAt

    if (durationMs >= warnAtMs) {
      console.info(`[perf] ${operation} duration_ms=${durationMs}${serializeMeta(options?.meta)}`)
    }

    return result
  } catch (error) {
    const durationMs = Date.now() - startedAt
    if (!isExpectedDynamicServerUsage(error)) {
      console.error(`[perf] ${operation} failed duration_ms=${durationMs}${serializeMeta(options?.meta)}`, error)
    }
    throw error
  }
}
