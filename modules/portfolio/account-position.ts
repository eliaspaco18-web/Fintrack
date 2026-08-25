export const PORTFOLIO_POSITION_COMPARISON_TITLE = 'Apertura y posición actual'

export const PORTFOLIO_POSITION_COMPARISON_DISCLOSURE =
  'Compara dos valores registrados; no representa un historial mensual.'

type AccountPositionSource = Readonly<{
  balance: number
  currency: string
  initial_balance: number
  initial_balance_date: string | null
}>

export type PortfolioPositionFacts = Readonly<{
  currency: string
  opening: Readonly<{
    amount: number
    recordedDate: string | null
  }>
  current: Readonly<{
    amount: number
  }>
}>

function storedDateOrNull(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export function getPortfolioPositionFacts(
  account: AccountPositionSource,
): PortfolioPositionFacts {
  return {
    currency: account.currency,
    opening: {
      amount: account.initial_balance,
      recordedDate: storedDateOrNull(account.initial_balance_date),
    },
    current: {
      amount: account.balance,
    },
  }
}
