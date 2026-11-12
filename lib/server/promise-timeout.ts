import 'server-only'

export class PromiseTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Timeout after ${timeoutMs}ms`)
    this.name = 'PromiseTimeoutError'
  }
}

export async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Timeout after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

/**
 * Adds a deadline to a request that supports AbortSignal and cancels its
 * underlying work when the deadline expires. A caller may pass a shared
 * controller to cancel sibling requests after one required read fails.
 */
export async function withAbortableTimeout<T>(
  request: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs: number,
  controller: AbortController = new AbortController(),
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false

  try {
    return await Promise.race([
      Promise.resolve().then(() => request(controller.signal)),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true
          const error = new PromiseTimeoutError(timeoutMs)
          controller.abort(error)
          reject(error)
        }, timeoutMs)
      }),
    ])
  } catch (error) {
    if (timedOut) throw new PromiseTimeoutError(timeoutMs)
    throw error
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
