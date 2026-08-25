import { ClientFetchTimeoutError } from '@/lib/client/fetch-with-timeout'

export const PORTFOLIO_MUTATION_TIMEOUT_MS = 12_000

export const PORTFOLIO_MUTATION_TIMEOUT_MESSAGE =
  'La operación tardó demasiado y no pudimos confirmar su resultado. Revisa o actualiza la lista de cuentas antes de intentarlo nuevamente.'

export type PortfolioMutationPayload = ({ ok?: boolean } & Record<string, unknown>) | null

type PortfolioMutationResult = {
  response: Response
  payload: PortfolioMutationPayload
}

type PortfolioMutationRuntime = {
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

type ReconcilePortfolio = () => void | Promise<void>

function startReconciliation(reconcilePortfolio: ReconcilePortfolio) {
  try {
    void Promise.resolve(reconcilePortfolio()).catch(() => undefined)
  } catch {
    // The timeout remains the primary controlled error. The UI still exposes
    // its normal retry path when a background reconciliation cannot start.
  }
}

export async function requestPortfolioMutation(
  input: Parameters<typeof fetch>[0],
  init: RequestInit,
  reconcilePortfolio: ReconcilePortfolio,
  runtime: PortfolioMutationRuntime = {},
): Promise<PortfolioMutationResult> {
  const timeoutMs = Math.max(1, runtime.timeoutMs ?? PORTFOLIO_MUTATION_TIMEOUT_MS)
  const fetchImpl = runtime.fetchImpl ?? fetch
  const controller = new AbortController()
  const { signal: callerSignal, ...requestInit } = init
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  let abortFromCaller: (() => void) | null = null

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason)
    } else {
      abortFromCaller = () => controller.abort(callerSignal.reason)
      callerSignal.addEventListener('abort', abortFromCaller, { once: true })
    }
  }

  const request = async (): Promise<PortfolioMutationResult> => {
    const response = await fetchImpl(input, {
      ...requestInit,
      signal: controller.signal,
    })
    const payload = response.status === 204
      ? null
      : await response.json().catch(() => null) as PortfolioMutationPayload

    return { response, payload }
  }

  try {
    return await Promise.race([
      request(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true
          controller.abort()
          reject(new ClientFetchTimeoutError(PORTFOLIO_MUTATION_TIMEOUT_MESSAGE))
        }, timeoutMs)
      }),
    ])
  } catch (error) {
    if (timedOut) {
      startReconciliation(reconcilePortfolio)
      throw new ClientFetchTimeoutError(PORTFOLIO_MUTATION_TIMEOUT_MESSAGE)
    }

    throw error
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    if (callerSignal && abortFromCaller) {
      callerSignal.removeEventListener('abort', abortFromCaller)
    }
  }
}
