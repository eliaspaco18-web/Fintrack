// =============================================================================
// lib/server/exchange-rate.ts
// Resuelve dos capas de tipo de cambio USD -> PEN:
//   1. Histórico/raw en exchange_rates (legado / cron / soporte live posterior)
//   2. Diario contable en exchange_rates_daily (importaciones y registros)
// =============================================================================

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_USD_PEN_EXCHANGE_RATE } from '@/lib/constants/currency'
import { withTimeout } from '@/lib/server/promise-timeout'
import { createClient, createServiceClient } from '@/lib/supabase.server'

const EXCHANGE_RATE_TIMEOUT_MS = 3_000
const ACCOUNTING_TIMEZONE = 'America/Lima'
const LIVE_EXCHANGE_RATE_TTL_MINUTES = 10

export interface ExchangeRateSnapshot {
  rate: number
  fetched_at: string | null
  source: string
  refreshed: boolean
  effective_date?: string | null
}

interface ExternalRateResult {
  rate: number
  source: string
  fetchedAt?: string | null
}

type UntypedDbClient = SupabaseClient

function untyped(db: ReturnType<typeof createClient> | ReturnType<typeof createServiceClient>): UntypedDbClient {
  return db as unknown as UntypedDbClient
}

function normalizeEnvValue(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return null
  return trimmed
}

function isIsoDate(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getLimaDateString(input: Date | string = new Date()): string {
  const date = input instanceof Date ? input : new Date(input)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ACCOUNTING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find(part => part.type === 'year')?.value ?? '1970'
  const month = parts.find(part => part.type === 'month')?.value ?? '01'
  const day = parts.find(part => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

function normalizeEffectiveDate(date?: string | null): string {
  if (isIsoDate(date)) return date
  return getLimaDateString()
}

function fallbackSnapshot(effectiveDate?: string | null): ExchangeRateSnapshot {
  return {
    rate: DEFAULT_USD_PEN_EXCHANGE_RATE,
    fetched_at: null,
    source: 'fallback',
    refreshed: false,
    effective_date: effectiveDate ?? null,
  }
}

async function fetchExchangeRateApiUsdPenRate(): Promise<ExternalRateResult | null> {
  const apiKey = normalizeEnvValue(process.env.EXCHANGE_RATE_API_KEY)
  const apiUrl = normalizeEnvValue(process.env.EXCHANGE_RATE_API_URL)
  if (!apiKey || !apiUrl) return null

  try {
    const res = await fetch(`${apiUrl}/${apiKey}/pair/USD/PEN`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(EXCHANGE_RATE_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const json = await res.json()
    const rate = Number(json?.conversion_rate)
    if (!Number.isFinite(rate) || rate <= 0) return null
    return { rate, source: 'exchangerate-api' }
  } catch {
    return null
  }
}

async function fetchExchangeRateApiUsdPenRateForDate(effectiveDate: string): Promise<ExternalRateResult | null> {
  const apiKey = normalizeEnvValue(process.env.EXCHANGE_RATE_API_KEY)
  const apiUrl = normalizeEnvValue(process.env.EXCHANGE_RATE_API_URL)
  if (!apiKey || !apiUrl) return null

  const [year, month, day] = effectiveDate.split('-')
  if (!year || !month || !day) return null

  try {
    const res = await fetch(`${apiUrl}/${apiKey}/history/USD/${year}/${month}/${day}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(EXCHANGE_RATE_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const json = await res.json()
    const rate = Number(json?.conversion_rates?.PEN)
    if (!Number.isFinite(rate) || rate <= 0) return null
    return { rate, source: 'exchangerate-api-history', fetchedAt: `${effectiveDate}T12:00:00.000Z` }
  } catch {
    return null
  }
}

async function fetchOpenErApiUsdPenRate(): Promise<ExternalRateResult | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      cache: 'no-store',
      signal: AbortSignal.timeout(EXCHANGE_RATE_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const json = await res.json()
    const rate = Number(json?.rates?.PEN)
    if (!Number.isFinite(rate) || rate <= 0) return null
    return { rate, source: 'open-er-api' }
  } catch {
    return null
  }
}

async function fetchCurrencyApiUsdPenRateForDate(effectiveDate: string): Promise<ExternalRateResult | null> {
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${effectiveDate}/v1/currencies/usd.json`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(EXCHANGE_RATE_TIMEOUT_MS),
      }
    )
    if (!res.ok) return null
    const json = await res.json()
    const rate = Number(json?.usd?.pen)
    if (!Number.isFinite(rate) || rate <= 0) return null
    return { rate, source: 'currency-api-history', fetchedAt: `${effectiveDate}T12:00:00.000Z` }
  } catch {
    return null
  }
}

async function fetchExchangeRateHostUsdPenRate(): Promise<ExternalRateResult | null> {
  try {
    const res = await fetch(
      'https://api.exchangerate.host/latest?base=USD&symbols=PEN',
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(EXCHANGE_RATE_TIMEOUT_MS),
      }
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

async function fetchExchangeRateHostUsdPenRateForDate(effectiveDate: string): Promise<ExternalRateResult | null> {
  try {
    const res = await fetch(
      `https://api.exchangerate.host/${effectiveDate}?base=USD&symbols=PEN`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(EXCHANGE_RATE_TIMEOUT_MS),
      }
    )
    if (!res.ok) return null
    const json = await res.json()
    const rate = Number(json?.rates?.PEN)
    if (!Number.isFinite(rate) || rate <= 0) return null
    return { rate, source: 'exchangerate-host-history', fetchedAt: `${effectiveDate}T12:00:00.000Z` }
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

async function fetchExternalUsdPenRateForDate(effectiveDate: string): Promise<ExternalRateResult | null> {
  const today = getLimaDateString()
  if (effectiveDate === today) return fetchExternalUsdPenRate()

  const primary = await fetchExchangeRateApiUsdPenRateForDate(effectiveDate)
  if (primary) return primary

  const secondary = await fetchCurrencyApiUsdPenRateForDate(effectiveDate)
  if (secondary) return secondary

  return fetchExchangeRateHostUsdPenRateForDate(effectiveDate)
}

async function getLatestLegacyRateFromDb(): Promise<ExchangeRateSnapshot | null> {
  try {
    const supabase = createClient()
    const { data, error } = await withTimeout(
      supabase
        .from('exchange_rates')
        .select('rate, fetched_at, source')
        .eq('from_currency', 'USD')
        .eq('to_currency', 'PEN')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      EXCHANGE_RATE_TIMEOUT_MS,
    )

    if (error || !data?.rate || data.rate <= 0) return null

    return {
      rate: data.rate,
      fetched_at: data.fetched_at ?? null,
      source: data.source ?? 'database',
      refreshed: false,
      effective_date: data.fetched_at ? getLimaDateString(data.fetched_at) : null,
    }
  } catch {
    return null
  }
}

async function getLiveRateFromDb(): Promise<ExchangeRateSnapshot | null> {
  try {
    const supabase = untyped(createClient())
    const { data, error } = await withTimeout(
      supabase
        .from('exchange_rates_live')
        .select('rate, fetched_at, source')
        .eq('from_currency', 'USD')
        .eq('to_currency', 'PEN')
        .limit(1)
        .maybeSingle(),
      EXCHANGE_RATE_TIMEOUT_MS,
    )

    if (error || !data?.rate || Number(data.rate) <= 0) return null

    return {
      rate: Number(data.rate),
      fetched_at: typeof data.fetched_at === 'string' ? data.fetched_at : null,
      source: typeof data.source === 'string' ? data.source : 'database',
      refreshed: false,
      effective_date: data.fetched_at ? getLimaDateString(data.fetched_at) : null,
    }
  } catch {
    return null
  }
}

async function getDailyRateByDate(effectiveDate: string): Promise<ExchangeRateSnapshot | null> {
  try {
    const supabase = untyped(createClient())
    const { data, error } = await withTimeout(
      supabase
        .from('exchange_rates_daily')
        .select('rate, fetched_at, source, effective_date')
        .eq('from_currency', 'USD')
        .eq('to_currency', 'PEN')
        .eq('effective_date', effectiveDate)
        .limit(1)
        .maybeSingle(),
      EXCHANGE_RATE_TIMEOUT_MS,
    )

    if (error || !data?.rate || data.rate <= 0) return null

    return {
      rate: Number(data.rate),
      fetched_at: typeof data.fetched_at === 'string' ? data.fetched_at : null,
      source: typeof data.source === 'string' ? data.source : 'database',
      refreshed: false,
      effective_date: typeof data.effective_date === 'string' ? data.effective_date : effectiveDate,
    }
  } catch {
    return null
  }
}

async function getDailyRateOnOrBefore(effectiveDate: string): Promise<ExchangeRateSnapshot | null> {
  try {
    const supabase = untyped(createClient())
    const { data, error } = await withTimeout(
      supabase
        .from('exchange_rates_daily')
        .select('rate, fetched_at, source, effective_date')
        .eq('from_currency', 'USD')
        .eq('to_currency', 'PEN')
        .lte('effective_date', effectiveDate)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      EXCHANGE_RATE_TIMEOUT_MS,
    )

    if (error || !data?.rate || data.rate <= 0) return null

    return {
      rate: Number(data.rate),
      fetched_at: typeof data.fetched_at === 'string' ? data.fetched_at : null,
      source: typeof data.source === 'string' ? data.source : 'database',
      refreshed: false,
      effective_date: typeof data.effective_date === 'string' ? data.effective_date : effectiveDate,
    }
  } catch {
    return null
  }
}

async function persistLegacyRate(
  rate: number,
  source: string,
): Promise<Pick<ExchangeRateSnapshot, 'fetched_at' | 'source'> | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null

  try {
    const service = createServiceClient()
    const { data, error } = await withTimeout(
      service
        .from('exchange_rates')
        .insert({
          from_currency: 'USD',
          to_currency: 'PEN',
          rate,
          source,
        })
        .select('fetched_at, source')
        .single(),
      EXCHANGE_RATE_TIMEOUT_MS,
    )

    if (error) return null
    return {
      fetched_at: data?.fetched_at ?? new Date().toISOString(),
      source: data?.source ?? source,
    }
  } catch {
    return null
  }
}

async function persistLiveRate(
  rate: number,
  source: string,
): Promise<Pick<ExchangeRateSnapshot, 'fetched_at' | 'source'> | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null

  try {
    const service = untyped(createServiceClient())
    const fetchedAt = new Date().toISOString()
    const { data, error } = await withTimeout(
      service
        .from('exchange_rates_live')
        .upsert({
          from_currency: 'USD',
          to_currency: 'PEN',
          rate,
          source,
          fetched_at: fetchedAt,
        }, {
          onConflict: 'from_currency,to_currency',
        })
        .select('fetched_at, source')
        .single(),
      EXCHANGE_RATE_TIMEOUT_MS,
    )

    if (error) return null
    return {
      fetched_at: typeof data?.fetched_at === 'string' ? data.fetched_at : fetchedAt,
      source: typeof data?.source === 'string' ? data.source : source,
    }
  } catch {
    return null
  }
}

function isSnapshotFresh(snapshot: ExchangeRateSnapshot | null, maxAgeMinutes: number): boolean {
  if (!snapshot?.fetched_at) return false
  const ageMs = Date.now() - new Date(snapshot.fetched_at).getTime()
  if (!Number.isFinite(ageMs) || ageMs < 0) return false
  return ageMs <= maxAgeMinutes * 60_000
}

async function persistDailyRateIfMissing(
  rate: number,
  source: string,
  effectiveDate: string,
  fetchedAt?: string | null,
): Promise<ExchangeRateSnapshot | null> {
  const existing = await getDailyRateByDate(effectiveDate)
  if (existing) return existing
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null

  try {
    const service = untyped(createServiceClient())
    const payload = {
      from_currency: 'USD',
      to_currency: 'PEN',
      rate,
      source,
      effective_date: effectiveDate,
      fetched_at: fetchedAt ?? new Date().toISOString(),
    }

    const { data, error } = await withTimeout(
      service
        .from('exchange_rates_daily')
        .insert(payload)
        .select('rate, fetched_at, source, effective_date')
        .single(),
      EXCHANGE_RATE_TIMEOUT_MS,
    )

    if (error) {
      return await getDailyRateByDate(effectiveDate)
    }

    return {
      rate: Number(data?.rate ?? rate),
      fetched_at: typeof data?.fetched_at === 'string' ? data.fetched_at : payload.fetched_at,
      source: typeof data?.source === 'string' ? data.source : source,
      refreshed: false,
      effective_date: typeof data?.effective_date === 'string' ? data.effective_date : effectiveDate,
    }
  } catch {
    return await getDailyRateByDate(effectiveDate)
  }
}

export async function ensureAccountingUsdPenExchangeRate(
  opts: { date?: string | null } = {},
): Promise<ExchangeRateSnapshot> {
  const effectiveDate = normalizeEffectiveDate(opts.date)
  const existing = await getDailyRateByDate(effectiveDate)
  if (existing) return existing

  const fresh = await fetchExternalUsdPenRateForDate(effectiveDate)
  if (fresh) {
    const stored = await persistDailyRateIfMissing(
      fresh.rate,
      fresh.source,
      effectiveDate,
      fresh.fetchedAt,
    )
    if (stored) {
      return { ...stored, refreshed: true }
    }

    return {
      rate: fresh.rate,
      fetched_at: new Date().toISOString(),
      source: fresh.source,
      refreshed: true,
      effective_date: effectiveDate,
    }
  }

  const latestLegacy = await getLatestLegacyRateFromDb()
  if (
    latestLegacy?.rate &&
    latestLegacy.rate > 0 &&
    latestLegacy.effective_date === effectiveDate
  ) {
    const stored = await persistDailyRateIfMissing(
      latestLegacy.rate,
      latestLegacy.source,
      effectiveDate,
      latestLegacy.fetched_at,
    )

    if (stored) return stored
    return { ...latestLegacy, effective_date: effectiveDate }
  }

  const prior = await getDailyRateOnOrBefore(effectiveDate)
  if (prior) return prior

  if (latestLegacy?.rate && latestLegacy.rate > 0) {
    return latestLegacy
  }

  return fallbackSnapshot(effectiveDate)
}

export async function resolveAccountingUsdPenExchangeRate(
  opts: {
    date?: string | null
    allowPrior?: boolean
    ensureForToday?: boolean
  } = {},
): Promise<ExchangeRateSnapshot> {
  const effectiveDate = normalizeEffectiveDate(opts.date)

  if (opts.ensureForToday !== false) {
    return ensureAccountingUsdPenExchangeRate({ date: effectiveDate })
  }

  const exact = await getDailyRateByDate(effectiveDate)
  if (exact) return exact

  if (opts.allowPrior !== false) {
    const prior = await getDailyRateOnOrBefore(effectiveDate)
    if (prior) return prior
  }

  const latestLegacy = await getLatestLegacyRateFromDb()
  if (latestLegacy) {
    return { ...latestLegacy, effective_date: effectiveDate }
  }

  return fallbackSnapshot(effectiveDate)
}

export async function resolveLiveUsdPenExchangeRate(
  opts: {
    forceRefresh?: boolean
    maxAgeMinutes?: number
  } = {},
): Promise<ExchangeRateSnapshot> {
  const maxAgeMinutes = Number.isFinite(opts.maxAgeMinutes)
    ? Math.max(1, Math.trunc(opts.maxAgeMinutes as number))
    : LIVE_EXCHANGE_RATE_TTL_MINUTES

  const live = await getLiveRateFromDb()
  if (!opts.forceRefresh && isSnapshotFresh(live, maxAgeMinutes)) {
    return live as ExchangeRateSnapshot
  }

  const fresh = await fetchExternalUsdPenRate()
  if (fresh) {
    const livePersisted = await persistLiveRate(fresh.rate, fresh.source)
    const legacyPersisted = await persistLegacyRate(fresh.rate, fresh.source)
    const effectiveDate = getLimaDateString()
    await persistDailyRateIfMissing(
      fresh.rate,
      fresh.source,
      effectiveDate,
      livePersisted?.fetched_at ?? legacyPersisted?.fetched_at ?? new Date().toISOString(),
    )

    return {
      rate: fresh.rate,
      fetched_at: livePersisted?.fetched_at ?? legacyPersisted?.fetched_at ?? new Date().toISOString(),
      source: livePersisted?.source ?? legacyPersisted?.source ?? fresh.source,
      refreshed: true,
      effective_date: effectiveDate,
    }
  }

  if (live) return live

  const latestLegacy = await getLatestLegacyRateFromDb()
  if (latestLegacy) return latestLegacy

  return fallbackSnapshot()
}

export async function resolveUsdPenExchangeRate(
  opts: { refresh?: boolean } = {},
): Promise<ExchangeRateSnapshot> {
  try {
    const latest = await getLatestLegacyRateFromDb()
    if (!opts.refresh) return latest ?? fallbackSnapshot()

    const fresh = await fetchExternalUsdPenRate()
    if (!fresh) return latest ?? fallbackSnapshot()

    const persisted = await persistLegacyRate(fresh.rate, fresh.source)
    const effectiveDate = getLimaDateString()
    await persistDailyRateIfMissing(
      fresh.rate,
      fresh.source,
      effectiveDate,
      persisted?.fetched_at ?? new Date().toISOString(),
    )

    return {
      rate: fresh.rate,
      fetched_at: persisted?.fetched_at ?? latest?.fetched_at ?? new Date().toISOString(),
      source: persisted?.source ?? fresh.source,
      refreshed: true,
      effective_date: effectiveDate,
    }
  } catch {
    return fallbackSnapshot()
  }
}
