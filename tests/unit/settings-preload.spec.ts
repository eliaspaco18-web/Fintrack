import { expect, test } from '@playwright/test'
import { getSettingsPreloadPlan, loadSettingsPagePreload } from '@/modules/settings/settings-preload'

test('settings tabs request only the server data required by the active panel', async () => {
  const calls: string[] = []
  const loaders = {
    profile: async () => { calls.push('profile'); return { default_currency: 'USD' } },
    accountCount: async () => { calls.push('account-count'); return 3 },
    accounts: async () => { calls.push('accounts'); return [{ id: 'a' }] },
  }

  expect(getSettingsPreloadPlan('profile')).toEqual({ profile: true, accountCount: true, accounts: false })
  expect(getSettingsPreloadPlan('preferences')).toEqual({ profile: true, accountCount: false, accounts: false })
  expect(getSettingsPreloadPlan('accounts')).toEqual({ profile: false, accountCount: false, accounts: true })

  const support = await loadSettingsPagePreload('support', loaders)
  expect(support).toMatchObject({ profile: null, accounts: [], accountCount: 0, profileUnavailable: false, accountsUnavailable: false })
  expect(calls).toEqual([])

  const preferences = await loadSettingsPagePreload('preferences', loaders)
  expect(preferences.profile).toEqual({ default_currency: 'USD' })
  expect(calls).toEqual(['profile'])

  const profile = await loadSettingsPagePreload('profile', loaders)
  expect(profile.accountCount).toBe(3)
  expect(calls).toEqual(['profile', 'profile', 'account-count'])

  const accounts = await loadSettingsPagePreload('accounts', loaders)
  expect(accounts.accounts).toEqual([{ id: 'a' }])
  expect(accounts.accountCount).toBe(1)
  expect(calls).toEqual(['profile', 'profile', 'account-count', 'accounts'])
})

test('settings preload failures remain explicit instead of becoming a trusted empty account list', async () => {
  const result = await loadSettingsPagePreload('accounts', {
    profile: async () => ({ id: 'unused' }),
    accountCount: async () => 0,
    accounts: async () => { throw new Error('synthetic query failure') },
  })

  expect(result.accounts).toEqual([])
  expect(result.accountsUnavailable).toBe(true)
})
