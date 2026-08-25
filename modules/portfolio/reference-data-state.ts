export type PortfolioPrimaryDataState = 'loading' | 'error' | 'empty' | 'populated'

export type PortfolioReferenceSource = 'banks' | 'currencies'

type PortfolioBankReferenceSource = Readonly<{
  institution: string | null
  bank_entity_id: string | null
  bank_entity?: Readonly<{
    name: string | null
    short_name: string | null
  }> | null
}>

type PortfolioReferenceDataStateInput = Readonly<{
  accountCount: number
  accountsLoading: boolean
  accountsError: string | null
  banksLoading: boolean
  banksError: string | null
  currenciesLoading: boolean
  currenciesError: string | null
}>

export type PortfolioReferenceDataState = Readonly<{
  primary: PortfolioPrimaryDataState
  hasBlockingAccountsError: boolean
  canRenderAccounts: boolean
  showEmptyState: boolean
  unavailableReferences: readonly PortfolioReferenceSource[]
  referenceNotice: string | null
  banksAvailable: boolean
  currenciesAvailable: boolean
}>

const BANKS_UNAVAILABLE_NOTICE =
  'Las cuentas cargaron, pero el catálogo de bancos no está disponible. Las cuentas siguen visibles; el filtro y la selección bancaria están limitados.'

const CURRENCIES_UNAVAILABLE_NOTICE =
  'Las cuentas cargaron, pero el catálogo de monedas no está disponible. Los importes conservan su código registrado; el filtro y la creación están limitados.'

const REFERENCES_UNAVAILABLE_NOTICE =
  'Las cuentas cargaron, pero los catálogos de bancos y monedas no están disponibles. Las cuentas y saldos visibles se conservan; los controles dependientes están limitados.'

export function getIdentifiedPortfolioInstitution(
  account: PortfolioBankReferenceSource,
): string | null {
  if (account.bank_entity?.name?.trim()) return account.bank_entity.name.trim()
  if (account.bank_entity?.short_name?.trim()) return account.bank_entity.short_name.trim()
  return account.institution?.trim() || null
}

export function getPortfolioBankDisplayName(account: PortfolioBankReferenceSource): string {
  const identifiedInstitution = getIdentifiedPortfolioInstitution(account)
  if (identifiedInstitution) return identifiedInstitution
  if (account.bank_entity_id) return 'Entidad no disponible'
  return 'Sin banco'
}

function getPrimaryState(input: PortfolioReferenceDataStateInput): PortfolioPrimaryDataState {
  if (input.accountsLoading) return 'loading'
  if (input.accountsError) return 'error'
  return input.accountCount === 0 ? 'empty' : 'populated'
}

function getReferenceNotice(unavailable: readonly PortfolioReferenceSource[]) {
  if (unavailable.length === 2) return REFERENCES_UNAVAILABLE_NOTICE
  if (unavailable[0] === 'banks') return BANKS_UNAVAILABLE_NOTICE
  if (unavailable[0] === 'currencies') return CURRENCIES_UNAVAILABLE_NOTICE
  return null
}

export function getPortfolioReferenceDataState(
  input: PortfolioReferenceDataStateInput,
): PortfolioReferenceDataState {
  const primary = getPrimaryState(input)
  const unavailableReferences: PortfolioReferenceSource[] = []

  if (input.banksError && !input.banksLoading) unavailableReferences.push('banks')
  if (input.currenciesError && !input.currenciesLoading) unavailableReferences.push('currencies')

  const hasBlockingAccountsError = primary === 'error' && input.accountCount === 0
  const referenceNotice = primary === 'empty' || primary === 'populated'
    ? getReferenceNotice(unavailableReferences)
    : null

  return {
    primary,
    hasBlockingAccountsError,
    canRenderAccounts: primary === 'populated' || (primary === 'error' && input.accountCount > 0),
    showEmptyState: primary === 'empty',
    unavailableReferences,
    referenceNotice,
    banksAvailable: !input.banksLoading && !input.banksError,
    currenciesAvailable: !input.currenciesLoading && !input.currenciesError,
  }
}
