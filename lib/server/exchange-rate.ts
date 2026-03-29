// =============================================================================
// lib/server/exchange-rate.ts
// Resolución y refresco del tipo de cambio USD -> PEN para server-side.
// =============================================================================

import 'server-only'

import { DEFAULT_USD_PEN_EXCHANGE_RATE } from '@/lib/constants/currency'
import { createClient, createServiceClient } from '@/lib/supabase.server'

export interface ExchangeRateSnapshot {
  rate: number
  fetched_at: string | null
  source: string
  refreshed: boolean
}

interface ExternalRateResult {
  rate: number
  source: string
}

async function getLatestFromDb(): Promise<ExchangeRateSnapshot | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('rate, fetched_at, source')
    .eq('from_currency', 'USD')
    .eq('to_currency', 'PEN')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.rate || data.rate <= 0) return null

  return {
    rate: data.rate,
    fetched_at: data.fetched_at ?? null,
    source: data.source ?? 'database',
    refreshed: false,
  }
}

function normalizeEnvValue(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return null
  return trimmed
}

async function fetchExchangeRateApiUsdPenRate(): Promise<ExternalRateResult | null> {
  const apiKey = normalizeEnvValue(process.env.EXCHANGE_RATE_API_KEY)
  const apiUrl = normalizeEnvValue(process.env.EXCHANGE_RATE_API_URL)
  if (!apiKey || !apiUrl) return null

  try {
    const res = await fetch(`${apiUrl}/${apiKey}/pair/USD/PEN`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    const rate = Number(json?.conversion_rate)
    if (!Number.isFinite(rate) || rate <= 0) return null
    return { rate, source: 'exchangerate-api' }
  } catch {
    return null
  }
}

async function fetchOpenErApiUsdPenRate(): Promise<ExternalRateResult | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    const rate = Number(json?.rates?.PEN)
    if (!Number.isFinite(rate) || rate <= 0) return null
    return { rate, source: 'open-er-api' }
  } catch {
    return null
  }
}

async function fetchExchangeRateHostUsdPenRate(): Promise<ExternalRateResult | null> {
  try {
    const res = await fetch(
      'https://api.exchangerate.host/latest?base=USD&symbols=PEN',
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const json = await res.json()
    const rate = Number(json?.rates?.PEN)
    if (!Number.isFinite(rate) || rate <= 0) return null
    return { rate, source: 'exchangerate-host' }
  } catch {
    return null
  }
}

async function fetchExternalUsdPenRate(): Promise<ExternalRateResult | null> {
  const primary = await fetchExchangeRateApiUsdPenRate()
  if (primary) return primary

  const secondary = await fetchOpenErApiUsdPenRate()
  if (secondary) return secondary

  return fetchExchangeRateHostUsdPenRate()
}

async function persistRate(
  rate: number,
  source: string
): Promise<Pick<ExchangeRateSnapshot, 'fetched_at' | 'source'> | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null

  try {
    const service = createServiceClient()
    const { data, error } = await service
      .from('exchange_rates')
      .insert({
        from_currency: 'USD',
        to_currency: 'PEN',
        rate,
        source,
      })
      .select('fetched_at, source')
      .single()

    if (error) return null
    return {
      fetched_at: data?.fetched_at ?? new Date().toISOString(),
      source: data?.source ?? 'exchangerate-api',
    }
  } catch {
    return null
  }
}

function fallbackSnapshot(): ExchangeRateSnapshot {
  return {
    rate: DEFAULT_USD_PEN_EXCHANGE_RATE,
    fetched_at: null,
    source: 'fallback',
    refreshed: false,
  }
}

export async function resolveUsdPenExchangeRate(
  opts: { refresh?: boolean } = {}
): Promise<ExchangeRateSnapshot> {
  const latest = await getLatestFromDb()
  if (!opts.refresh) return latest ?? fallbackSnapshot()

  const fresh = await fetchExternalUsdPenRate()
  if (!fresh) return latest ?? fallbackSnapshot()

  const persisted = await persistRate(fresh.rate, fresh.source)
  return {
    rate: fresh.rate,
    fetched_at: persisted?.fetched_at ?? latest?.fetched_at ?? new Date().toISOString(),
    source: persisted?.source ?? fresh.source,
    refreshed: true,
  }
}
