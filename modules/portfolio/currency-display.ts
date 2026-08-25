type PortfolioCurrencyDefinition = Readonly<{
  code: string
  name: string
  symbol: string
  is_system: boolean
}>

type PortfolioBalanceSource = Readonly<{
  balance: number
  currency: string
}>

export type PortfolioCurrencyKind = 'standard' | 'custom' | 'unavailable'

export type PortfolioCurrencyPresentation = Readonly<{
  code: string
  kind: PortfolioCurrencyKind
  name: string | null
}>

const CORE_CURRENCY_CODES = new Set(['PEN', 'USD'])

function normalizeCurrencyCode(value: string) {
  return value.trim().toUpperCase()
}

function formatNumber(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function getPortfolioCurrencyPresentation(
  currencyCode: string,
  currencies: readonly PortfolioCurrencyDefinition[],
): PortfolioCurrencyPresentation {
  const code = normalizeCurrencyCode(currencyCode)
  const definition = currencies.find(currency =>
    normalizeCurrencyCode(currency.code) === code
  )

  if (definition) {
    return {
      code,
      kind: definition.is_system ? 'standard' : 'custom',
      name: definition.name,
    }
  }

  if (CORE_CURRENCY_CODES.has(code)) {
    return {
      code,
      kind: 'standard',
      name: null,
    }
  }

  return {
    code: code || '—',
    kind: 'unavailable',
    name: null,
  }
}

export function formatPortfolioAmount(
  amount: number,
  currencyCode: string,
  currencies: readonly PortfolioCurrencyDefinition[],
  locale = 'es-PE',
) {
  const presentation = getPortfolioCurrencyPresentation(currencyCode, currencies)

  if (presentation.kind === 'standard') {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: presentation.code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch {
      // A malformed system catalog entry must remain explicit instead of
      // borrowing the symbol of another currency.
    }
  }

  return `${presentation.code} ${formatNumber(amount, locale)}`
}

export function groupPortfolioBalancesByCurrency(
  accounts: readonly PortfolioBalanceSource[],
) {
  const totals = new Map<string, number>()

  for (const account of accounts) {
    const current = totals.get(account.currency) ?? 0
    totals.set(account.currency, current + account.balance)
  }

  return totals
}
