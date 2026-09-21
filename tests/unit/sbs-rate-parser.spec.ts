import { expect, test } from '@playwright/test'
import { extractSbsAnnualRate } from '@/modules/loans/sbs-rate-parser'

test.describe('SBS annual rate parser', () => {
  test('reads the published daily national-currency consumption rate', () => {
    const html = '<span>Moneda Nacional</span><strong>57.25% Anual</strong>'

    expect(extractSbsAnnualRate(html, 'PEN')).toBe(57.25)
  })

  test('reads foreign currency values and returns null when absent', () => {
    expect(extractSbsAnnualRate('Moneda Extranjera 51,64 % Anual', 'USD')).toBe(51.64)
    expect(extractSbsAnnualRate('Sin resultados', 'PEN')).toBeNull()
  })
})
