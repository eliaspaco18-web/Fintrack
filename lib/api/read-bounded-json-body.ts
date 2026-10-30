/**
 * Vercel Functions reject request bodies larger than 4.5 MB. Keep the same
 * ceiling at the application boundary so local and self-hosted deployments
 * do not rely on a platform-specific limit before parsing JSON.
 */
export const MAX_API_JSON_BODY_BYTES = 4_500_000

export type BoundedJsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too_large' | 'invalid_json' }

export async function readBoundedJsonBody(
  request: Request,
  maximumBytes = MAX_API_JSON_BODY_BYTES,
): Promise<BoundedJsonBodyResult> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maximumBytes) {
    try {
      await request.body?.cancel()
    } catch {
      // The size decision is already made; cancellation is best-effort.
    }
    return { ok: false, reason: 'too_large' }
  }

  if (!request.body) return { ok: false, reason: 'invalid_json' }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maximumBytes) {
        try {
          await reader.cancel()
        } catch {
          // The size decision is already made; cancellation is best-effort.
        }
        return { ok: false, reason: 'too_large' }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, reason: 'invalid_json' }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(body)) as unknown }
  } catch {
    return { ok: false, reason: 'invalid_json' }
  }
}
