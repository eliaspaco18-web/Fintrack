import { monthBounds } from '@/lib/transactions-month-summary'

export function resolveInitialMovementRange(input: {
  month: string
  hasExplicitDateRange: boolean
  hasOtherScope: boolean
}): { dateFrom: string; dateTo: string } | null {
  if (input.hasExplicitDateRange || input.hasOtherScope) return null
  const bounds = monthBounds(input.month)
  return bounds ? { dateFrom: bounds.start, dateTo: bounds.end } : null
}

export function isCompleteMovementMonth(dateFrom: string, dateTo: string): string | null {
  const month = dateFrom.slice(0, 7)
  const bounds = monthBounds(month)
  return bounds && dateFrom === bounds.start && dateTo === bounds.end ? month : null
}
