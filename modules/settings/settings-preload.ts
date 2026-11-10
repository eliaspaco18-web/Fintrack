import type { SettingsTab } from '@/components/settings/config'

export type SettingsPreloadPlan = {
  profile: boolean
  accountCount: boolean
  accounts: boolean
}

export function getSettingsPreloadPlan(tab: SettingsTab): SettingsPreloadPlan {
  return {
    profile: tab === 'profile' || tab === 'preferences',
    accountCount: tab === 'profile',
    accounts: tab === 'accounts',
  }
}

type LoadResult<T> =
  | { status: 'loaded'; value: T }
  | { status: 'failed' }
  | { status: 'skipped' }

async function loadSafely<T>(loader?: () => Promise<T>): Promise<LoadResult<T>> {
  if (!loader) return { status: 'skipped' }
  try {
    return { status: 'loaded', value: await loader() }
  } catch {
    return { status: 'failed' }
  }
}

export async function loadSettingsPagePreload<TProfile, TAccount>(
  tab: SettingsTab,
  loaders: {
    profile: () => Promise<TProfile>
    accountCount: () => Promise<number>
    accounts: () => Promise<TAccount[]>
  },
) {
  const plan = getSettingsPreloadPlan(tab)
  const [profile, accountCountResult, accountsResult] = await Promise.all([
    loadSafely(plan.profile ? loaders.profile : undefined),
    loadSafely(plan.accountCount ? loaders.accountCount : undefined),
    loadSafely(plan.accounts ? loaders.accounts : undefined),
  ])

  const accounts = accountsResult.status === 'loaded' ? accountsResult.value : []
  const accountCount = plan.accounts
    ? accounts.length
    : plan.accountCount && accountCountResult.status === 'loaded'
      ? accountCountResult.value
      : 0

  return {
    profile: profile.status === 'loaded' ? profile.value : null,
    profileUnavailable: plan.profile && profile.status !== 'loaded',
    accounts,
    accountsUnavailable: plan.accounts
      ? accountsResult.status !== 'loaded'
      : plan.accountCount && accountCountResult.status !== 'loaded',
    accountCount,
  }
}
