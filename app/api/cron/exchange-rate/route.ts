// app/api/cron/exchange-rate/route.ts
// Llamado por Vercel Cron Jobs — ver vercel.json
import { NextResponse }          from 'next/server'
import { resolveLiveUsdPenExchangeRate } from '@/lib/server/exchange-rate'

export async function GET(req: Request) {
  // Verificar que viene de Vercel Cron (o llamada manual con secret)
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const snapshot = await resolveLiveUsdPenExchangeRate({ forceRefresh: true })
    if (!snapshot.refreshed) {
      return NextResponse.json({
        ok: false,
        message: 'No se pudo refrescar desde internet, se mantiene la tasa almacenada',
        rate: snapshot.rate,
        fetched_at: snapshot.fetched_at,
        source: snapshot.source,
      })
    }

    return NextResponse.json({
      ok: true,
      rate: snapshot.rate,
      fetched_at: snapshot.fetched_at,
      source: snapshot.source,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
