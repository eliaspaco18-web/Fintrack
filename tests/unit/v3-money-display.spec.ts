import { expect, test } from '@playwright/test'
import { formatV3Money } from '@/lib/finance/v3-money-display'

test.describe('V3 money presentation, no finance calculation', () => {
  test('shows PEN, USD, standard and custom codes with invariant separators', () => {
    expect(formatV3Money({ value: 1234.5, currency: 'PEN' }).text).toBe('S/ 1,234.50')
    expect(formatV3Money({ value: 1234.5, currency: 'USD' }).text).toBe('US$ 1,234.50')
    expect(formatV3Money({ value: 1234.5, currency: 'TOK' }).text).toBe('TOK 1,234.50')
    expect(formatV3Money({ value: 1234.5, currency: 'EUR', precision: 3 }).text).toBe('EUR 1,234.500')
  })

  test('never turns missing, invalid or imprecise numbers into zero', () => {
    expect(formatV3Money({ value: 0, currency: 'PEN' })).toMatchObject({ text: 'S/ 0.00', availability: 'available' })
    expect(formatV3Money({ value: -0, currency: 'PEN' }).text).toBe('S/ 0.00')
    expect(formatV3Money({ value: null, currency: 'PEN' })).toMatchObject({ text: '—', availability: 'unavailable' })
    expect(formatV3Money({ value: Number.NaN, currency: 'PEN' }).availability).toBe('unavailable')
    expect(formatV3Money({ value: Number.MAX_SAFE_INTEGER, currency: 'PEN' }).availability).toBe('unavailable')
    expect(formatV3Money({ value: 75, currency: null })).toMatchObject({ text: '75.00', availability: 'unverified' })
    expect(formatV3Money({ value: 75, currency: 'XYZ', availability: 'unverified' })).toMatchObject({ text: 'XYZ 75.00', availability: 'unverified' })
  })

  test('direction must be supplied and does not change the source value', () => {
    const source = { value: 250, currency: 'USD' }
    expect(formatV3Money({ ...source, direction: 'income' }).text).toBe('+US$ 250.00')
    expect(formatV3Money({ value: 80, currency: 'PEN', direction: 'expense' }).text).toBe('−S/ 80.00')
    expect(formatV3Money({ value: 60, currency: 'PEN', direction: 'transfer' }).text).toBe('S/ 60.00')
    expect(formatV3Money({ value: -125.5, currency: 'PEN' }).text).toBe('−S/ 125.50')
    expect(formatV3Money({ value: 0, currency: 'PEN', direction: 'income' }).text).toBe('S/ 0.00')
    expect(source).toEqual({ value: 250, currency: 'USD' })
  })

  test('rejects presentation precision outside the documented boundary', () => {
    expect(() => formatV3Money({ value: 5, currency: 'PEN', precision: 1 })).toThrow(RangeError)
    expect(() => formatV3Money({ value: 5, currency: 'PEN', precision: 9 })).toThrow(RangeError)
  })
})
