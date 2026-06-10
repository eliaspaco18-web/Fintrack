export const BILLING_CYCLE_YEAR_START = 2016
export const BILLING_CYCLE_YEAR_FUTURE_OFFSET = 2

export function getBillingCycleMaxYear(referenceDate = new Date()): number {
  return referenceDate.getFullYear() + BILLING_CYCLE_YEAR_FUTURE_OFFSET
}

export function getBillingCycleYearOptions(referenceDate = new Date()) {
  const maxYear = getBillingCycleMaxYear(referenceDate)

  return Array.from(
    { length: maxYear - BILLING_CYCLE_YEAR_START + 1 },
    (_, index) => {
      const year = String(BILLING_CYCLE_YEAR_START + index)
      return { value: year, label: year }
    },
  )
}

export function isBillingCycleYearInRange(
  year: number,
  referenceDate = new Date(),
): boolean {
  return year >= BILLING_CYCLE_YEAR_START && year <= getBillingCycleMaxYear(referenceDate)
}
