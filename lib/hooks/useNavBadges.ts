'use client'

import useSWR from 'swr'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import {
  getNavBadgesCacheKey,
  NAV_BADGES_SWR_POLICY,
  type NavBadgesCacheKey,
} from '@/lib/hooks/nav-badges-policy'

export type NavBadgeCounts = Partial<Record<string, number>>

const CLIENT_FETCH_TIMEOUT_MS = 5_000

function isNavBadgeCounts(value: unknown): value is NavBadgeCounts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every(count =>
    typeof count === 'number' && Number.isFinite(count) && Number.isInteger(count) && count >= 0,
  )
}

async function fetchNavBadges([url]: NavBadgesCacheKey): Promise<NavBadgeCounts> {
  const response = await fetchWithTimeout(url, {
    cache: 'no-store',
    timeoutMs: CLIENT_FETCH_TIMEOUT_MS,
    timeoutMessage: 'No se pudo actualizar el estado del menú.',
  })
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.ok || !isNavBadgeCounts(payload.data)) {
    throw new Error('No se pudo verificar el estado del menú')
  }

  return payload.data
}

export function useNavBadges(initialData: NavBadgeCounts | undefined, userId: string) {
  const { data, error, isValidating, mutate } = useSWR<NavBadgeCounts, Error, NavBadgesCacheKey | null>(
    getNavBadgesCacheKey(userId),
    fetchNavBadges,
    {
      ...NAV_BADGES_SWR_POLICY,
      fallbackData: initialData,
    },
  )

  return {
    data: data ?? initialData ?? {},
    error,
    isValidating,
    retry: () => mutate(),
  }
}
