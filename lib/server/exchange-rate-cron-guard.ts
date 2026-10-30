const PRODUCTION_HOST = 'fintrack-eta-silk.vercel.app'

type ExchangeRateSnapshot = {
  refreshed: boolean
  rate: number | null
  fetched_at: string | null
  source: string
}

type RefreshExchangeRate = (options: { forceRefresh: true }) => Promise<ExchangeRateSnapshot>

/**
 * Keep the exchange-rate refresh available only through the approved Production
 * hostname and only when the caller supplies the configured Vercel Cron secret.
 */
export async function runExchangeRateCron(
  request: Request,
  cronSecret: string | undefined,
  refresh: RefreshExchangeRate,
): Promise<Response> {
  const host = request.headers.get('host')?.toLowerCase()
  if (host !== PRODUCTION_HOST) {
    return new Response('Forbidden', { status: 403 })
  }

  if (!cronSecret?.trim() || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const snapshot = await refresh({ forceRefresh: true })
    if (!snapshot.refreshed || snapshot.rate === null) {
      return Response.json({
        ok: false,
        message: 'No se pudo refrescar desde internet, se mantiene la tasa almacenada',
        rate: snapshot.rate,
        fetched_at: snapshot.fetched_at,
        source: snapshot.source,
      })
    }

    return Response.json({
      ok: true,
      rate: snapshot.rate,
      fetched_at: snapshot.fetched_at,
      source: snapshot.source,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
