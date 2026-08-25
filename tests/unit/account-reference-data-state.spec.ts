import { expect, test } from '@playwright/test'
import {
  getIdentifiedPortfolioInstitution,
  getPortfolioBankDisplayName,
  getPortfolioReferenceDataState,
} from '@/modules/portfolio/reference-data-state'

type StateInput = Parameters<typeof getPortfolioReferenceDataState>[0]

const READY_STATE: StateInput = {
  accountCount: 0,
  accountsLoading: false,
  accountsError: null,
  banksLoading: false,
  banksError: null,
  currenciesLoading: false,
  currenciesError: null,
}

function state(overrides: Partial<StateInput> = {}) {
  return getPortfolioReferenceDataState({ ...READY_STATE, ...overrides })
}

test.describe('Portfolio reference-data states', () => {
  test('keeps a successfully empty account result as a valid empty state', () => {
    const result = state()

    expect(result.primary).toBe('empty')
    expect(result.showEmptyState).toBe(true)
    expect(result.hasBlockingAccountsError).toBe(false)
    expect(result.referenceNotice).toBeNull()
  })

  test('keeps populated accounts available when both reference sources load', () => {
    const result = state({ accountCount: 3 })

    expect(result.primary).toBe('populated')
    expect(result.canRenderAccounts).toBe(true)
    expect(result.banksAvailable).toBe(true)
    expect(result.currenciesAvailable).toBe(true)
    expect(result.unavailableReferences).toEqual([])
  })

  test('keeps accounts visible and identifies a bank-only failure', () => {
    const result = state({
      accountCount: 2,
      banksError: 'raw bank service failure',
    })

    expect(result.primary).toBe('populated')
    expect(result.canRenderAccounts).toBe(true)
    expect(result.banksAvailable).toBe(false)
    expect(result.currenciesAvailable).toBe(true)
    expect(result.unavailableReferences).toEqual(['banks'])
    expect(result.referenceNotice).toContain('catálogo de bancos')
    expect(result.referenceNotice).not.toContain('raw bank service failure')
  })

  test('keeps accounts visible and identifies a currency-only failure', () => {
    const result = state({
      accountCount: 2,
      currenciesError: 'raw currency service failure',
    })

    expect(result.primary).toBe('populated')
    expect(result.canRenderAccounts).toBe(true)
    expect(result.banksAvailable).toBe(true)
    expect(result.currenciesAvailable).toBe(false)
    expect(result.unavailableReferences).toEqual(['currencies'])
    expect(result.referenceNotice).toContain('catálogo de monedas')
    expect(result.referenceNotice).not.toContain('raw currency service failure')
  })

  test('keeps accounts visible and identifies both failed reference sources', () => {
    const result = state({
      accountCount: 2,
      banksError: 'bank failure',
      currenciesError: 'currency failure',
    })

    expect(result.primary).toBe('populated')
    expect(result.canRenderAccounts).toBe(true)
    expect(result.unavailableReferences).toEqual(['banks', 'currencies'])
    expect(result.referenceNotice).toContain('bancos y monedas')
    expect(result.referenceNotice).not.toContain('bank failure')
    expect(result.referenceNotice).not.toContain('currency failure')
  })

  test('does not let reference failures hide a valid empty account result', () => {
    const result = state({
      banksError: 'bank failure',
      currenciesError: 'currency failure',
    })

    expect(result.primary).toBe('empty')
    expect(result.showEmptyState).toBe(true)
    expect(result.hasBlockingAccountsError).toBe(false)
    expect(result.referenceNotice).toContain('bancos y monedas')
  })

  test('treats a primary account failure as blocking when no accounts are available', () => {
    const result = state({
      accountsError: 'accounts failed',
      banksError: 'bank failure',
      currenciesError: 'currency failure',
    })

    expect(result.primary).toBe('error')
    expect(result.hasBlockingAccountsError).toBe(true)
    expect(result.canRenderAccounts).toBe(false)
    expect(result.showEmptyState).toBe(false)
    expect(result.unavailableReferences).toEqual(['banks', 'currencies'])
    expect(result.referenceNotice).toBeNull()
  })

  test('can retain previously available accounts after a failed refresh without calling them empty', () => {
    const result = state({
      accountCount: 2,
      accountsError: 'refresh failed',
    })

    expect(result.primary).toBe('error')
    expect(result.hasBlockingAccountsError).toBe(false)
    expect(result.canRenderAccounts).toBe(true)
    expect(result.showEmptyState).toBe(false)
  })

  test('keeps reference controls unavailable while their retry is loading', () => {
    const result = state({
      accountCount: 1,
      banksLoading: true,
      banksError: 'previous bank failure',
    })

    expect(result.banksAvailable).toBe(false)
    expect(result.unavailableReferences).toEqual([])
    expect(result.referenceNotice).toBeNull()
  })
})

test.describe('Portfolio bank reference labels', () => {
  test('uses only account-backed relation or institution labels', () => {
    const related = {
      institution: 'Legacy label',
      bank_entity_id: 'bank-1',
      bank_entity: { name: 'Banco registrado', short_name: 'BR' },
    }
    const legacy = {
      institution: 'Entidad almacenada',
      bank_entity_id: null,
      bank_entity: null,
    }

    expect(getPortfolioBankDisplayName(related)).toBe('Banco registrado')
    expect(getPortfolioBankDisplayName(legacy)).toBe('Entidad almacenada')
    expect(getIdentifiedPortfolioInstitution(related)).toBe('Banco registrado')
    expect(getIdentifiedPortfolioInstitution(legacy)).toBe('Entidad almacenada')
  })

  test('does not relabel an unresolved bank link as an account without a bank', () => {
    const unresolved = {
      institution: null,
      bank_entity_id: 'bank-unavailable',
      bank_entity: null,
    }
    const genuinelyUnassigned = {
      institution: null,
      bank_entity_id: null,
      bank_entity: null,
    }

    expect(getPortfolioBankDisplayName(unresolved)).toBe('Entidad no disponible')
    expect(getIdentifiedPortfolioInstitution(unresolved)).toBeNull()
    expect(getPortfolioBankDisplayName(genuinelyUnassigned)).toBe('Sin banco')
  })
})
