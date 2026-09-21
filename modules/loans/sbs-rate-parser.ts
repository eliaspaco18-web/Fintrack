export type SbsRateCurrency = 'PEN' | 'USD'

/**
 * Extracts the annual average rate displayed by the official SBS daily pages.
 * The pages are server-rendered but include nested markup and non-breaking
 * spaces, so extraction happens only after normalizing visible text.
 */
export function extractSbsAnnualRate(html: string, currency: SbsRateCurrency): number | null {
  const normalized = html
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')

  const currencyLabel = currency === 'PEN' ? 'Moneda Nacional' : 'Moneda Extranjera'
  const match = normalized.match(
    new RegExp(`${currencyLabel}\\s*([0-9]+(?:[.,][0-9]+)?)\\s*%?\\s*Anual`, 'i'),
  )
  if (!match?.[1]) return null

  const rate = Number(match[1].replace(',', '.'))
  return Number.isFinite(rate) && rate >= 0 ? rate : null
}
