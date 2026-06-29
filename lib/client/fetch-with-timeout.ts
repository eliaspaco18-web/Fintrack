'use client'

export const DEFAULT_CLIENT_FETCH_TIMEOUT_MS = 12_000

const DEFAULT_TIMEOUT_MESSAGE = 'La solicitud tardo demasiado. Reintenta en unos segundos.'

type FetchWithTimeoutInit = RequestInit & {
  timeoutMs?: number
  timeoutMessage?: string
}

export class ClientFetchTimeoutError extends Error {
  constructor(message = DEFAULT_TIMEOUT_MESSAGE) {
    super(message)
    this.name = 'ClientFetchTimeoutError'
  }
}

export async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: FetchWithTimeoutInit = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_CLIENT_FETCH_TIMEOUT_MS,
    timeoutMessage = DEFAULT_TIMEOUT_MESSAGE,
    signal,
    ...fetchInit
  } = init

  if (timeoutMs <= 0) {
    return fetch(input, { ...fetchInit, signal })
  }

  const controller = new AbortController()
  let timedOut = false
  let abortFromCaller: (() => void) | null = null

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason)
    } else {
      abortFromCaller = () => controller.abort(signal.reason)
      signal.addEventListener('abort', abortFromCaller, { once: true })
    }
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    return await fetch(input, { ...fetchInit, signal: controller.signal })
  } catch (error) {
    if (timedOut) {
      throw new ClientFetchTimeoutError(timeoutMessage)
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
    if (signal && abortFromCaller) {
      signal.removeEventListener('abort', abortFromCaller)
    }
  }
}
