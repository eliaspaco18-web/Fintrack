// =============================================================================
// lib/hooks/useDashboard.ts
// Hook + CurrencyProvider + useCurrency para el dashboard.
// =============================================================================

'use client'

import useSWR                              from 'swr'
import {
  useState, useCallback, createContext,
  useContext, type ReactNode
}                                          from 'react'
import { CacheTTL }                        from '@/lib/cache/cache.config'
import { fetchWithTimeout }                from '@/lib/client/fetch-with-timeout'
import { toDisplayAmount }                 from '@/lib/contracts/ui.contracts'
import { getVerifiedUsdPenRate } from '@/lib/finance/exchange-rate-verification'
import type { DashboardSummary }           from '@/modules/dashboard/dashboard.types'
import type { FormError, DisplayCurrency } from '@/lib/contracts/ui.contracts'

// ─── FETCHER ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetchWithTimeout(url).then(async res => {
    const json = await res.json()
    if (!res.ok || !json.ok) throw json.error
    return json.data
  })

// ─── CURRENCY CONTEXT ─────────────────────────────────────────────────────────

interface CurrencyContextValue {
  preferred:    DisplayCurrency
  exchangeRate: number | null
  toggle:       () => void
  format:       (amountPen: number) => number | null
}

const CurrencyContext = createContext<CurrencyContextValue>({
  preferred:    'PEN',
  exchangeRate: null,
  toggle:       () => {},
  format:       (v) => v,
})

export function CurrencyProvider({
  children,
  initialRate,
  initialCurrency = 'PEN',
}: {
  children:        ReactNode
  initialRate:     number | null
  initialCurrency?: DisplayCurrency
}) {
  const [preferred, setPreferred] = useState<DisplayCurrency>(initialCurrency)
  const { data: liveRatePayload } = useSWR<{ rate?: number; fetched_at?: string | null; source?: string }>(
    '/api/exchange-rate?mode=live',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 5 * 60 * 1000,
      dedupingInterval: 60_000,
    },
  )

  const toggle = useCallback(() => {
    setPreferred(prev => prev === 'PEN' ? 'USD' : 'PEN')
  }, [])

  const liveRate = getVerifiedUsdPenRate(liveRatePayload)
  const resolvedRate = liveRate ?? initialRate

  const format = useCallback(
    (amountPen: number) => {
      if (!Number.isFinite(amountPen)) return null
      if (preferred === 'PEN') return amountPen
      if (resolvedRate === null || !Number.isFinite(resolvedRate) || resolvedRate <= 0) return null
      return toDisplayAmount(amountPen, preferred, resolvedRate)
    },
    [preferred, resolvedRate]
  )

  return (
    <CurrencyContext.Provider
      value={{
        preferred,
        exchangeRate: resolvedRate,
        toggle,
        format,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}

// ─── HOOK PRINCIPAL ───────────────────────────────────────────────────────────

export interface UseDashboardOptions {
  initialData?: DashboardSummary | null
}

export interface UseDashboardReturn {
  summary:      DashboardSummary | null
  isLoading:    boolean
  isRefreshing: boolean
  error:        FormError | null
  refetch:      () => void
  lastUpdated:  Date | null
}

export function useDashboard(options: UseDashboardOptions = {}): UseDashboardReturn {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    options.initialData ? new Date() : null
  )

  const { data, isLoading, isValidating, error, mutate } = useSWR<DashboardSummary>(
    '/api/dashboard',
    fetcher,
    {
      fallbackData:          options.initialData ?? undefined,
      revalidateOnFocus:     false,
      revalidateOnReconnect: true,
      refreshInterval:       CacheTTL.dashboard * 1000,
      dedupingInterval:      30_000,
      onSuccess: () => setLastUpdated(new Date()),
    }
  )

  return {
    summary:      data ?? null,
    isLoading:    isLoading && !data,
    isRefreshing: isValidating && !!data,
    error:        error as FormError | null,
    refetch:      () => mutate(),
    lastUpdated,
  }
}

// ─── HOOK DE CUENTAS ──────────────────────────────────────────────────────────

export function useAccounts() {
  const { data, isLoading } = useSWR('/api/accounts', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval:  60_000,
  })
  return {
    accounts: (data ?? []) as Array<{
      id: string; name: string; type: string; currency: string
      balance: number; color: string; icon: string
    }>,
    isLoading,
  }
}
