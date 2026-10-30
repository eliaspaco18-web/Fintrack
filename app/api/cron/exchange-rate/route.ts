// Called by Vercel Cron Jobs — see vercel.json.
import { resolveLiveUsdPenExchangeRate } from '@/lib/server/exchange-rate'
import { runExchangeRateCron } from '@/lib/server/exchange-rate-cron-guard'

export function GET(req: Request) {
  return runExchangeRateCron(req, process.env.CRON_SECRET, resolveLiveUsdPenExchangeRate)
}
