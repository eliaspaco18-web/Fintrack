export interface ExchangeRateResolutionOptions {
  forceRefresh: boolean
}

/** Coalesces equivalent in-process live-rate work without caching its result. */
export function createExchangeRateSingleFlight<T>(
  resolve: (options: ExchangeRateResolutionOptions) => Promise<T>,
) {
  let inFlight: {
    forceRefresh: boolean
    promise: Promise<T>
  } | null = null

  const run = async (forceRefresh: boolean): Promise<T> => {
    const active = inFlight
    if (active) {
      if (!forceRefresh || active.forceRefresh) return active.promise

      // Preserve the explicit refresh contract, but serialize it behind a
      // normal resolution so both calls do not refresh/persist concurrently.
      await active.promise.catch(() => undefined)
      return run(true)
    }

    const flight = {
      forceRefresh,
      promise: Promise.resolve().then(() => resolve({ forceRefresh })),
    }
    inFlight = flight

    try {
      return await flight.promise
    } finally {
      if (inFlight === flight) inFlight = null
    }
  }

  return (options: Partial<ExchangeRateResolutionOptions> = {}) =>
    run(options.forceRefresh === true)
}
