import { expect, test } from '@playwright/test'
import {
  calendarMonthDays,
  formatIsoDateForDisplay,
  moveCalendarMonth,
  parseDisplayDateToIso,
  parseIsoCalendarDate,
  toIsoCalendarDate,
} from '@/modules/transactions/income-date'

test.describe('income calendar date conversion', () => {
  test('converts ISO and DD/MM/YYYY without timezone shifts', () => {
    expect(formatIsoDateForDisplay('2024-02-29')).toBe('29/02/2024')
    expect(parseDisplayDateToIso('29/02/2024')).toBe('2024-02-29')
    expect(parseDisplayDateToIso('31/02/2024')).toBeNull()
    expect(parseIsoCalendarDate('2025-02-29')).toBeNull()
    expect(parseIsoCalendarDate('2024-02-29')?.toISOString()).toBe('2024-02-29T00:00:00.000Z')
    expect(toIsoCalendarDate(new Date('2024-02-29T00:00:00.000Z'))).toBe('2024-02-29')
  })

  test('starts weeks on Monday and includes every displayed day', () => {
    const february = calendarMonthDays(2024, 1)
    expect(february[0]!.getUTCDay()).toBe(1)
    expect(february.some(day => day.getUTCMonth() === 1 && day.getUTCDate() === 29)).toBe(true)
    expect(february.length % 7).toBe(0)
  })

  test('navigates month and year boundaries', () => {
    expect(moveCalendarMonth(2025, 11, 1)).toEqual({ year: 2026, month: 0 })
    expect(moveCalendarMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
    expect(moveCalendarMonth(2026, 2, 12)).toEqual({ year: 2027, month: 2 })
  })
})
