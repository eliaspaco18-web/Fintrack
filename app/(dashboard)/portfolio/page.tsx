// =============================================================================
// app/(dashboard)/portfolio/page.tsx
// Portafolio — Módulo 2 del PRD v3
// Server component: pre-carga cuentas, bancos y monedas
// =============================================================================

import type { Metadata } from 'next'
import { PortfolioManager } from '@/components/management/PortfolioManager'
import { withTimeout } from '@/lib/server/promise-timeout'
import { createClient } from '@/lib/supabase.server'

type PortfolioCurrencyRow = {
  id: string
  code: string
  name: string
  symbol: string
  is_default: boolean
  is_system: boolean
  is_active: boolean
}

const SERVER_QUERY_TIMEOUT_MS = 4_000

function dedupeCurrencies(items: PortfolioCurrencyRow[]): PortfolioCurrencyRow[] {
  const grouped = new Map<string, PortfolioCurrencyRow>()

  for (const item of items) {
    const key = `${item.code.trim().toLocaleUpperCase('es')}::${item.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')}`
    const existing = grouped.get(key)

    if (!existing) {
      grouped.set(key, item)
      continue
    }

    const shouldReplace =
      (!item.is_system && item.is_default) ||
      (!item.is_system && existing.is_system) ||
      (item.is_active && !existing.is_active)

    grouped.set(key, shouldReplace ? item : existing)
  }

  return [...grouped.values()].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    return a.code.localeCompare(b.code, 'es')
  })
}

export const metadata: Metadata = {
  title: 'Portafolio | FinTrack',
  description: 'Gestiona tus cuentas bancarias y portafolios financieros',
}

export default async function PortfolioPage() {
  const supabase = createClient()
  const [accountsResult, banksResult, currenciesResult] = await Promise.allSettled([
    withTimeout(
      supabase
        .from('accounts')
        .select('id,name,institution,bank_entity_id,type,currency,balance,initial_balance,initial_balance_date,color,icon,include_in_net_worth,is_active,notes,created_at,bank_entity:bank_entities(id,name,short_name,color,icon,is_active)')
        .order('created_at', { ascending: false }),
      SERVER_QUERY_TIMEOUT_MS,
    ),
    withTimeout(
      supabase
        .from('bank_entities')
        .select('id,name,short_name,color,icon,is_active')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      SERVER_QUERY_TIMEOUT_MS,
    ),
    withTimeout(
      supabase
        .from('user_currencies')
        .select('id,code,name,symbol,is_default,is_system,is_active')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('code', { ascending: true }),
      SERVER_QUERY_TIMEOUT_MS,
    ),
  ])

  const accountsLoaded =
    accountsResult.status === 'fulfilled' && !accountsResult.value.error
  const banksLoaded =
    banksResult.status === 'fulfilled' && !banksResult.value.error
  const currenciesLoaded =
    currenciesResult.status === 'fulfilled' && !currenciesResult.value.error

  const initialAccountsRaw = accountsLoaded ? (accountsResult.value.data ?? []) : []
  const initialAccounts = initialAccountsRaw.map(account => ({
    ...account,
    bank_entity: Array.isArray(account.bank_entity)
      ? (account.bank_entity[0] ?? null)
      : (account.bank_entity ?? null),
  }))
  const initialBanks = banksLoaded ? (banksResult.value.data ?? []) : []
  const initialCurrencies = currenciesLoaded
    ? dedupeCurrencies((currenciesResult.value.data ?? []) as PortfolioCurrencyRow[])
    : []
  const preloaded = accountsLoaded && banksLoaded && currenciesLoaded

  return (
    <div className="space-y-6">
      <PortfolioManager
        initialAccounts={initialAccounts}
        initialBanks={initialBanks}
        initialCurrencies={initialCurrencies}
        preloaded={preloaded}
      />
    </div>
  )
}
