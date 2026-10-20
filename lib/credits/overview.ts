import type { CreditListItem } from '@/lib/credits/display-type'

export interface CreditOverview {
  activeCount: number
  activeLineCount: number
  closedCount: number
  activeCardCount: number
  activeCardCurrencyCount: { PEN: number; USD: number }
  cardDebt: { PEN: number; USD: number }
  activeLoanCount: number
  verifiedLoanCapital: { PEN: number; USD: number }
  verifiedLoanCountByCurrency: { PEN: number; USD: number }
  unavailableLoanCapitalCount: number
}

/** Presentation-only aggregation; retains native currency and excludes unverified loan links. */
export function summarizeCredits(credits: CreditListItem[]): CreditOverview {
  const active = credits.filter(credit => credit.status === 'ACTIVE')
  const activeCards = active.filter(credit => credit.display_type === 'CARD')
  const activeLoans = active.filter(credit => credit.display_type === 'LOAN')
  const overview: CreditOverview = {
    activeCount: active.length,
    activeLineCount: active.filter(credit => credit.display_type === 'LINE').length,
    closedCount: credits.filter(credit => credit.status !== 'ACTIVE').length,
    activeCardCount: activeCards.length,
    activeCardCurrencyCount: { PEN: 0, USD: 0 },
    cardDebt: { PEN: 0, USD: 0 },
    activeLoanCount: activeLoans.length,
    verifiedLoanCapital: { PEN: 0, USD: 0 },
    verifiedLoanCountByCurrency: { PEN: 0, USD: 0 },
    unavailableLoanCapitalCount: 0,
  }

  for (const credit of activeCards) {
    const penUsed = Number(credit.used_amount_pen ?? (credit.currency === 'PEN' ? credit.used_amount : 0))
    const usdUsed = Number(credit.used_amount_usd ?? (credit.currency === 'USD' ? credit.used_amount : 0))
    if (Number.isFinite(penUsed) && penUsed > 0) overview.cardDebt.PEN += penUsed
    if (Number.isFinite(usdUsed) && usdUsed > 0) overview.cardDebt.USD += usdUsed
    const penLimit = Number(credit.credit_limit_pen ?? (credit.currency === 'PEN' ? credit.credit_limit : 0))
    const usdLimit = Number(credit.credit_limit_usd ?? (credit.currency === 'USD' ? credit.credit_limit : 0))
    if (penLimit > 0 || penUsed > 0) overview.activeCardCurrencyCount.PEN += 1
    if (usdLimit > 0 || usdUsed > 0) overview.activeCardCurrencyCount.USD += 1
  }

  for (const credit of activeLoans) {
    const capital = Number(credit.credit_limit)
    const currency = credit.currency === 'PEN' || credit.currency === 'USD' ? credit.currency : null
    if (!credit.has_loan || !currency || !Number.isFinite(capital) || capital <= 0) {
      overview.unavailableLoanCapitalCount += 1
      continue
    }
    overview.verifiedLoanCapital[currency] += capital
    overview.verifiedLoanCountByCurrency[currency] += 1
  }

  return overview
}
