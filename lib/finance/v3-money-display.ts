/** Presentation only. This module never parses input, converts FX, or sums money. */
export type MoneyAvailability = 'available' | 'unavailable' | 'unverified'
export type MoneyDirection = 'income' | 'expense' | 'transfer' | 'neutral'

export interface MoneyDisplayInput {
  value: number | null | undefined
  currency: string | null | undefined
  availability?: MoneyAvailability
  direction?: MoneyDirection
  precision?: number
}

export interface MoneyDisplayResult {
  text: string
  availability: MoneyAvailability
  currencyCode: string | null
  reason: string | null
}

const NUMBER_FORMATTERS = new Map<number, Intl.NumberFormat>()

function formatter(precision: number) {
  let instance = NUMBER_FORMATTERS.get(precision)
  if (!instance) {
    instance = new Intl.NumberFormat('en-US', {
      useGrouping: true,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    })
    NUMBER_FORMATTERS.set(precision, instance)
  }
  return instance
}

function normalizedCode(currency: string | null | undefined): string | null {
  const code = currency?.trim().toUpperCase()
  return code || null
}

function prefixFor(code: string | null) {
  if (code === 'PEN') return 'S/ '
  if (code === 'USD') return 'US$ '
  return code ? `${code} ` : ''
}

/**
 * The caller owns operation identity and must pass its real direction. `income`
 * and `expense` encode a positive source magnitude with a display sign; an
 * actual negative source value keeps its reversal sign. Zero is always neutral.
 */
export function formatV3Money({
  value,
  currency,
  availability = 'available',
  direction = 'neutral',
  precision = 2,
}: MoneyDisplayInput): MoneyDisplayResult {
  const currencyCode = normalizedCode(currency)
  if (availability === 'unavailable' || value == null || !Number.isFinite(value) || Math.abs(value) >= Number.MAX_SAFE_INTEGER) {
    return { text: '—', availability: 'unavailable', currencyCode, reason: 'No disponible' }
  }

  if (!Number.isInteger(precision) || precision < 2 || precision > 8) {
    throw new RangeError('Money display precision must be an integer from 2 to 8')
  }

  const knownCurrency = Boolean(currencyCode)
  const status: MoneyAvailability = availability === 'unverified' || !knownCurrency
    ? 'unverified'
    : 'available'
  const amount = Object.is(value, -0) ? 0 : value
  const magnitude = formatter(precision).format(Math.abs(amount))
  let sign = ''
  if (amount !== 0) {
    if (direction === 'income') sign = amount > 0 ? '+' : '−'
    else if (direction === 'expense') sign = amount > 0 ? '−' : '+'
    else if (amount < 0) sign = '−'
  }

  return {
    text: `${sign}${prefixFor(currencyCode)}${magnitude}`,
    availability: status,
    currencyCode,
    reason: status === 'unverified' ? 'Moneda no verificada' : null,
  }
}
