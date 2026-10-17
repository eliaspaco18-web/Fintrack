import { expect, test } from '@playwright/test'
import { filterPortfolioAccounts, type PortfolioFilterAccount } from '@/modules/portfolio/account-view-filters'

type AccountFixture = PortfolioFilterAccount & { id: string }

const accounts: AccountFixture[] = [
  {
    id: 'checking-active',
    name: 'Cuenta diaria',
    type: 'CHECKING',
    currency: 'PEN',
    is_active: true,
    bank_entity_id: 'bank-1',
    institution: null,
    bank_entity: { name: 'Banco Horizonte', short_name: 'BH' },
  },
  {
    id: 'savings-inactive',
    name: 'Ahorro viaje',
    type: 'SAVINGS',
    currency: 'USD',
    is_active: false,
    bank_entity_id: null,
    institution: 'Cooperativa Sur',
    bank_entity: null,
  },
  {
    id: 'card-active',
    name: 'Tarjeta compras',
    type: 'CREDIT_CARD',
    currency: 'PEN',
    is_active: true,
    bank_entity_id: 'bank-1',
    institution: null,
    bank_entity: { name: 'Banco Horizonte', short_name: 'BH' },
  },
]

const typeLabels = {
  CHECKING: 'Cuenta corriente',
  SAVINGS: 'Cuenta ahorros',
  CREDIT_CARD: 'Tarjeta',
}

test.describe('Portfolio list/card shared filters', () => {
  test('keeps active, inactive, and all operational account states distinct from technical accounts', () => {
    const base = { query: '', currency: 'all', type: 'all', bank: 'all', technical: false }

    expect(filterPortfolioAccounts(accounts, { ...base, status: 'active' }, typeLabels).map(account => account.id))
      .toEqual(['checking-active'])
    expect(filterPortfolioAccounts(accounts, { ...base, status: 'inactive' }, typeLabels).map(account => account.id))
      .toEqual(['savings-inactive'])
    expect(filterPortfolioAccounts(accounts, { ...base, status: 'all' }, typeLabels).map(account => account.id))
      .toEqual(['checking-active', 'savings-inactive'])
    expect(filterPortfolioAccounts(accounts, { ...base, status: 'all', technical: true }, typeLabels).map(account => account.id))
      .toEqual(['card-active'])
  })

  test('combines search, currency, type, institution, and status without resetting other filters', () => {
    const filtered = filterPortfolioAccounts(accounts, {
      query: 'horizonte',
      currency: 'PEN',
      type: 'CHECKING',
      status: 'active',
      bank: 'bank-1',
      technical: false,
    }, typeLabels)

    expect(filtered.map(account => account.id)).toEqual(['checking-active'])
  })

  test('searches localized type and preserves the no-institution filter', () => {
    const filtered = filterPortfolioAccounts(accounts, {
      query: 'cuenta ahorros',
      currency: 'USD',
      type: 'SAVINGS',
      status: 'inactive',
      bank: 'none',
      technical: false,
    }, typeLabels)

    expect(filtered.map(account => account.id)).toEqual(['savings-inactive'])
  })

  test('does not leak technical card balances into operational tabs when card type is selected', () => {
    const operational = filterPortfolioAccounts(accounts, {
      query: '',
      currency: 'all',
      type: 'CREDIT_CARD',
      status: 'all',
      bank: 'all',
      technical: false,
    }, typeLabels)
    const technical = filterPortfolioAccounts(accounts, {
      query: '',
      currency: 'all',
      type: 'CREDIT_CARD',
      status: 'all',
      bank: 'all',
      technical: true,
    }, typeLabels)

    expect(operational).toEqual([])
    expect(technical.map(account => account.id)).toEqual(['card-active'])
  })
})
