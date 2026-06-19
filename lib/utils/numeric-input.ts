export interface NumericFormatOptions {
  decimals?: number
  allowNegative?: boolean
}

const DEFAULT_DECIMALS = 2

function clampDecimals(decimals: number | undefined): number {
  if (typeof decimals !== 'number' || Number.isNaN(decimals)) return DEFAULT_DECIMALS
  if (decimals < 0) return 0
  if (decimals > 8) return 8
  return Math.floor(decimals)
}

export function getStepPrecision(step: string | number | undefined): number {
  if (step === undefined || step === null || step === '') return 0
  const raw = String(step).trim()
  if (raw === '' || raw.toLowerCase() === 'any') return DEFAULT_DECIMALS
  if (!raw.includes('.')) return 0
  return raw.split('.')[1]?.length ?? 0
}

function resolveDecimalIndex(unsigned: string, decimals: number): number {
  const dotIndexes = [...unsigned.matchAll(/\./g)].map(match => match.index ?? -1)
  const commaIndexes = [...unsigned.matchAll(/,/g)].map(match => match.index ?? -1)
  const allIndexes = [...dotIndexes, ...commaIndexes].filter(index => index >= 0).sort((a, b) => a - b)

  if (allIndexes.length === 0) return -1

  const lastIndexCandidate = allIndexes.at(-1)
  const lastIndex = typeof lastIndexCandidate === 'number' ? lastIndexCandidate : -1
  if (lastIndex < 0) return -1
  const lastChar = unsigned.charAt(lastIndex)
  const hasMixedSeparators = dotIndexes.length > 0 && commaIndexes.length > 0

  if (hasMixedSeparators) return lastIndex

  const sameSeparatorCount = lastChar === '.' ? dotIndexes.length : commaIndexes.length
  const digitsAfterLast = unsigned.slice(lastIndex + 1).replace(/[.,]/g, '').length
  const hasTrailingSeparator = lastIndex === unsigned.length - 1

  if (hasTrailingSeparator) return decimals > 0 ? lastIndex : -1
  if (sameSeparatorCount > 1) return -1
  if (decimals <= 0) return -1
  if (digitsAfterLast === 3 && decimals < 3) return -1

  return lastIndex
}

export function normalizeNumericInput(rawValue: unknown, options?: NumericFormatOptions): string {
  const decimals = clampDecimals(options?.decimals)
  const allowNegative = options?.allowNegative ?? false
  const raw = String(rawValue ?? '').trim()

  if (raw.length === 0) return ''

  let normalized = raw
    .replace(/\s+/g, '')
    .replace(/[^0-9.,\-]/g, '')

  if (!allowNegative) {
    normalized = normalized.replace(/-/g, '')
  } else {
    const isNegative = normalized.startsWith('-')
    normalized = normalized.replace(/-/g, '')
    if (isNegative) normalized = `-${normalized}`
  }

  const sign = allowNegative && normalized.startsWith('-') ? '-' : ''
  const unsigned = normalized.replace(/^-/, '')
  const decimalIndex = resolveDecimalIndex(unsigned, decimals)

  const hasTrailingDot = decimals > 0 && (unsigned.endsWith('.') || unsigned.endsWith(','))

  const integerRaw = decimalIndex >= 0
    ? unsigned.slice(0, decimalIndex)
    : unsigned
  const fractionRaw = decimalIndex >= 0
    ? unsigned.slice(decimalIndex + 1)
    : ''

  let integer = integerRaw
    .replace(/[.,]/g, '')
    .replace(/^0+(?=\d)/, '')

  if (integer.length === 0 && (fractionRaw.length > 0 || hasTrailingDot)) {
    integer = '0'
  }

  let result = `${sign}${integer}`

  if (decimals > 0 && (fractionRaw.length > 0 || hasTrailingDot)) {
    const cleanFraction = fractionRaw.replace(/[.,]/g, '')
    result += '.'
    result += cleanFraction.slice(0, decimals)
  }

  if (result === '-' || result === '-0') {
    return allowNegative ? result : ''
  }

  return result
}

export function formatNumericForDisplay(rawValue: unknown, options?: NumericFormatOptions & {
  padDecimals?: boolean
}): string {
  const decimals = clampDecimals(options?.decimals)
  const allowNegative = options?.allowNegative ?? false
  const padDecimals = options?.padDecimals ?? false

  const normalized = normalizeNumericInput(rawValue, { decimals, allowNegative })
  if (!normalized || normalized === '-') return normalized

  const trailingDot = normalized.endsWith('.')
  const [integerPart = '', fractionPart = ''] = normalized.replace(/\.$/, '').split('.')
  const sign = integerPart.startsWith('-') ? '-' : ''
  const digits = integerPart.replace(/^-/, '')

  const groupedInteger = Number(digits || '0').toLocaleString('en-US', {
    useGrouping: true,
    maximumFractionDigits: 0,
  })

  if (decimals === 0) return `${sign}${groupedInteger}`
  if (trailingDot) return `${sign}${groupedInteger}.`
  if (fractionPart.length > 0) return `${sign}${groupedInteger}.${fractionPart}`

  if (padDecimals) {
    const numericValue = Number(normalized)
    if (Number.isFinite(numericValue)) {
      return numericValue.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: true,
      })
    }
  }

  return `${sign}${groupedInteger}`
}

export function normalizeForStore(rawValue: unknown, options?: NumericFormatOptions): string {
  const decimals = clampDecimals(options?.decimals)
  const allowNegative = options?.allowNegative ?? false
  const normalized = normalizeNumericInput(rawValue, { decimals, allowNegative }).replace(/\.$/, '')

  if (!normalized || normalized === '-') return ''

  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue)) return ''

  if (decimals === 0) {
    return String(Math.trunc(numericValue))
  }

  return numericValue.toFixed(decimals)
}

export function parseNumericInput(rawValue: unknown, fallback = Number.NaN): number {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : fallback
  }
  const normalized = normalizeNumericInput(rawValue, {
    decimals: 8,
    allowNegative: true,
  }).replace(/\.$/, '')

  if (!normalized || normalized === '-') return fallback

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function roundToDecimals(value: number, decimals = 2): number {
  const safeDecimals = clampDecimals(decimals)
  const factor = 10 ** safeDecimals
  return Math.round(value * factor) / factor
}

export function hasAtMostDecimals(value: number, decimals = 2): boolean {
  if (!Number.isFinite(value)) return false
  const safeDecimals = clampDecimals(decimals)
  const factor = 10 ** safeDecimals
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6
}
