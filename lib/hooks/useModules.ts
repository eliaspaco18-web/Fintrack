// =============================================================================
// lib/hooks/useModules.ts
// Hooks SWR para los módulos derivados.
// Siguen el mismo patrón que useTransactions pero más simples
// (sin filtros complejos — los listados de módulos son más directos).
// =============================================================================

'use client'

import useSWR                 from 'swr'
import { useState, useCallback } from 'react'
import { CacheTTL }           from '@/lib/cache/cache.config'
import { fetchWithTimeout }   from '@/lib/client/fetch-with-timeout'
import type { CreditListItem } from '@/lib/credits/display-type'
import type { FormError }     from '@/lib/contracts/ui.contracts'
import type {
  Budget,
  Asset,
  AccountReceivable,
  AccountPayable,
  Loan,
  Installment,
}                             from '@/types/database.types'

// ─── FETCHER BASE ─────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetchWithTimeout(url).then(async res => {
    const json = await res.json()
    if (!res.ok || !json.ok) throw json.error
    return json.data
  })

// ─── FILTROS COMUNES ─────────────────────────────────────────────────────────

export interface ModuleFilters {
  search?:  string
  status?:  string
  currency?: 'PEN' | 'USD'
  sort?:    string
  page?:    number
  per_page?: number
}

function buildUrl(base: string, filters: ModuleFilters): string {
  const p = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) p.set(k, String(v))
  })
  const qs = p.toString()
  return qs ? `${base}?${qs}` : base
}

// =============================================================================
// useCredits
// =============================================================================

export interface UseCreditsReturn {
  credits:     CreditListItem[]
  isLoading:   boolean
  isEmpty:     boolean
  error:       FormError | null
  filters:     ModuleFilters
  setFilters:  (f: Partial<ModuleFilters>) => void
  refetch:     () => void
}

export function useCredits(initial: ModuleFilters = {}): UseCreditsReturn {
  const [filters, setFiltersState] = useState<ModuleFilters>({
    status: 'ACTIVE', sort: 'name', ...initial,
  })

  const url = buildUrl('/api/credits', filters)

  const { data, isLoading, error, mutate } = useSWR<CreditListItem[]>(
    url, fetcher, {
      revalidateOnFocus:  false,
      dedupingInterval:   CacheTTL.credits * 1000,
      keepPreviousData:   true,
    }
  )

  const setFilters = useCallback((f: Partial<ModuleFilters>) => {
    setFiltersState(prev => ({ ...prev, ...f }))
  }, [])

  return {
    credits:    data ?? [],
    isLoading:  isLoading && !data,
    isEmpty:    !isLoading && (data ?? []).length === 0,
    error:      error as FormError | null,
    filters,
    setFilters,
    refetch:    () => mutate(),
  }
}

// =============================================================================
// useAssets
// =============================================================================

export interface UseAssetsReturn {
  assets:      Asset[]
  isLoading:   boolean
  isEmpty:     boolean
  error:       FormError | null
  filters:     ModuleFilters
  setFilters:  (f: Partial<ModuleFilters>) => void
  refetch:     () => void
}

// =============================================================================
// useBudgets
// =============================================================================

export interface UseBudgetsReturn {
  budgets:     Budget[]
  isLoading:   boolean
  isEmpty:     boolean
  error:       FormError | null
  filters:     ModuleFilters
  setFilters:  (f: Partial<ModuleFilters>) => void
  refetch:     () => void
}

export function useBudgets(initial: ModuleFilters = {}): UseBudgetsReturn {
  const [filters, setFiltersState] = useState<ModuleFilters>({
    status: 'ACTIVE', sort: 'created_at', ...initial,
  })

  const url = buildUrl('/api/budgets', filters)

  const { data, isLoading, error, mutate } = useSWR<Budget[]>(
    url, fetcher, {
      revalidateOnFocus: false,
      dedupingInterval:  CacheTTL.budgets * 1000,
      keepPreviousData:  true,
    }
  )

  const setFilters = useCallback((f: Partial<ModuleFilters>) => {
    setFiltersState(prev => ({ ...prev, ...f }))
  }, [])

  return {
    budgets:    data ?? [],
    isLoading:  isLoading && !data,
    isEmpty:    !isLoading && (data ?? []).length === 0,
    error:      error as FormError | null,
    filters,
    setFilters,
    refetch:    () => mutate(),
  }
}

export function useAssets(initial: ModuleFilters = {}): UseAssetsReturn {
  const [filters, setFiltersState] = useState<ModuleFilters>({
    status: 'ACTIVE', sort: 'purchase_date', ...initial,
  })

  const url = buildUrl('/api/assets', filters)

  const { data, isLoading, error, mutate } = useSWR<Asset[]>(
    url, fetcher, {
      revalidateOnFocus: false,
      dedupingInterval:  CacheTTL.assets * 1000,
      keepPreviousData:  true,
    }
  )

  const setFilters = useCallback((f: Partial<ModuleFilters>) => {
    setFiltersState(prev => ({ ...prev, ...f }))
  }, [])

  return {
    assets:     data ?? [],
    isLoading:  isLoading && !data,
    isEmpty:    !isLoading && (data ?? []).length === 0,
    error:      error as FormError | null,
    filters,
    setFilters,
    refetch:    () => mutate(),
  }
}

// =============================================================================
// useReceivables
// =============================================================================

export interface UseReceivablesReturn {
  receivables:  AccountReceivable[]
  isLoading:    boolean
  isEmpty:      boolean
  error:        FormError | null
  filters:      ModuleFilters
  setFilters:   (f: Partial<ModuleFilters>) => void
  refetch:      () => void
}

export function useReceivables(initial: ModuleFilters = {}): UseReceivablesReturn {
  const [filters, setFiltersState] = useState<ModuleFilters>({
    status: 'PENDING', sort: 'due_date', ...initial,
  })

  const url = buildUrl('/api/receivables', filters)

  const { data, isLoading, error, mutate } = useSWR<AccountReceivable[]>(
    url, fetcher, {
      revalidateOnFocus: false,
      dedupingInterval:  CacheTTL.receivables * 1000,
      keepPreviousData:  true,
    }
  )

  const setFilters = useCallback((f: Partial<ModuleFilters>) => {
    setFiltersState(prev => ({ ...prev, ...f }))
  }, [])

  return {
    receivables: data ?? [],
    isLoading:   isLoading && !data,
    isEmpty:     !isLoading && (data ?? []).length === 0,
    error:       error as FormError | null,
    filters,
    setFilters,
    refetch:     () => mutate(),
  }
}

// =============================================================================
// usePayables
// =============================================================================

export interface UsePayablesReturn {
  payables:    AccountPayable[]
  isLoading:   boolean
  isEmpty:     boolean
  error:       FormError | null
  filters:     ModuleFilters
  setFilters:  (f: Partial<ModuleFilters>) => void
  refetch:     () => void
}

export function usePayables(initial: ModuleFilters = {}): UsePayablesReturn {
  const [filters, setFiltersState] = useState<ModuleFilters>({
    status: 'PENDING', sort: 'due_date', ...initial,
  })

  const url = buildUrl('/api/payables', filters)

  const { data, isLoading, error, mutate } = useSWR<AccountPayable[]>(
    url, fetcher, {
      revalidateOnFocus: false,
      dedupingInterval:  CacheTTL.payables * 1000,
      keepPreviousData:  true,
    }
  )

  const setFilters = useCallback((f: Partial<ModuleFilters>) => {
    setFiltersState(prev => ({ ...prev, ...f }))
  }, [])

  return {
    payables:   data ?? [],
    isLoading:  isLoading && !data,
    isEmpty:    !isLoading && (data ?? []).length === 0,
    error:      error as FormError | null,
    filters,
    setFilters,
    refetch:    () => mutate(),
  }
}

// =============================================================================
// useLoanInstallments (para página de detalle de crédito/préstamo)
// =============================================================================

export function useLoanInstallments(loanId: string | null) {
  const { data, isLoading } = useSWR<Installment[]>(
    loanId ? `/api/loans/${loanId}/installments` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
  return { installments: data ?? [], isLoading }
}
