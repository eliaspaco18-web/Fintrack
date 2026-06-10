// =============================================================================
// lib/utils/currency-format.ts
// Formato numérico #,000.00 y equivalencia de monedas.
// Centraliza toda la lógica de presentación monetaria de la app.
// =============================================================================

/**
 * Formatea un número al formato #,000.00
 * @example formatCurrency(5530.5) → "5,530.50"
 * @example formatCurrency(1234567.89) → "1,234,567.89"
 */
export function formatCurrency(
  value: number | string | null | undefined,
  decimals = 2
): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  if (isNaN(num)) return '0.00'

  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Formatea con símbolo de moneda.
 * @example formatWithSymbol(5530.5, 'PEN') → "S/ 5,530.50"
 * @example formatWithSymbol(100, 'USD') → "$ 100.00"
 */
export function formatWithSymbol(
  value: number | string | null | undefined,
  currencyCode: string
): string {
  const symbol = getCurrencySymbol(currencyCode)
  return `${symbol} ${formatCurrency(value)}`
}

/**
 * Calcula la equivalencia en otra moneda.
 * @param amount Monto en la moneda original
 * @param fromCurrency Código de moneda original
 * @param exchangeRate Tipo de cambio (ej: 3.75 para USD→PEN)
 * @returns Objeto con el monto convertido y el texto formateado
 */
export function calculateEquivalence(
  amount: number,
  fromCurrency: string,
  exchangeRate: number
): { amount: number; text: string; targetCurrency: string } {
  if (fromCurrency === 'PEN') {
    // PEN → USD
    const converted = exchangeRate > 0 ? amount / exchangeRate : 0
    return {
      amount: Math.round(converted * 100) / 100,
      text: `≈ $ ${formatCurrency(converted)}`,
      targetCurrency: 'USD',
    }
  } else if (fromCurrency === 'USD') {
    // USD → PEN
    const converted = amount * exchangeRate
    return {
      amount: Math.round(converted * 100) / 100,
      text: `≈ S/ ${formatCurrency(converted)}`,
      targetCurrency: 'PEN',
    }
  } else {
    // Otras monedas → PEN (asume exchangeRate es X→PEN)
    const converted = amount * exchangeRate
    return {
      amount: Math.round(converted * 100) / 100,
      text: `≈ S/ ${formatCurrency(converted)}`,
      targetCurrency: 'PEN',
    }
  }
}

/**
 * Devuelve el símbolo de una moneda por su código.
 */
export function getCurrencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    PEN: 'S/',
    USD: '$',
    EUR: '€',
    GBP: '£',
    BRL: 'R$',
    CLP: '$',
    COP: '$',
    MXN: '$',
    ARS: '$',
    BOB: 'Bs',
  }
  return symbols[code] ?? code
}

/**
 * Parsea un string formateado (#,000.00) a número.
 * @example parseCurrencyInput("5,530.50") → 5530.5
 * @example parseCurrencyInput("1.234.567,89") → 1234567.89 (formato ES)
 */
export function parseCurrencyInput(input: string): number {
  if (!input) return 0
  // Remover todo excepto dígitos, punto y coma
  const cleaned = input.replace(/[^0-9.,]/g, '')
  // Si usa coma como decimal (formato europeo/latino)
  if (cleaned.includes(',') && cleaned.indexOf(',') > cleaned.lastIndexOf('.')) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0
  }
  // Formato estándar: coma como separador de miles, punto como decimal
  return parseFloat(cleaned.replace(/,/g, '')) || 0
}

/**
 * Formatea un número para input (sin símbolo, con separadores).
 */
export function formatForInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return formatCurrency(value)
}
