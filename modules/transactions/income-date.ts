const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DISPLAY_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/

export function parseIsoCalendarDate(value: string): Date | null {
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

export function formatIsoDateForDisplay(value: string): string {
  const match = ISO_DATE_PATTERN.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

export function parseDisplayDateToIso(value: string): string | null {
  const match = DISPLAY_DATE_PATTERN.exec(value.trim())
  if (!match) return null
  const [, day, month, year] = match
  const iso = `${year}-${month}-${day}`
  return parseIsoCalendarDate(iso) ? iso : null
}

export function toIsoCalendarDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function moveCalendarMonth(year: number, month: number, offset: number): { year: number; month: number } {
  const next = new Date(Date.UTC(year, month + offset, 1))
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() }
}

export function calendarMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7
  const cells = Math.ceil((mondayOffset + daysInMonth) / 7) * 7
  return Array.from({ length: cells }, (_, index) => new Date(Date.UTC(year, month, index - mondayOffset + 1)))
}
