export const NAV_BADGES_ENDPOINT = '/api/dashboard/nav-badges'

export const NAV_BADGES_SWR_POLICY = Object.freeze({
  revalidateOnFocus: false,
  shouldRetryOnError: true,
  errorRetryCount: 2,
  errorRetryInterval: 5_000,
  dedupingInterval: 30_000,
  refreshInterval: 60_000,
})

export type NavBadgesCacheKey = readonly [typeof NAV_BADGES_ENDPOINT, string]

export function getNavBadgesCacheKey(userId: string | null | undefined): NavBadgesCacheKey | null {
  return userId ? [NAV_BADGES_ENDPOINT, userId] : null
}
