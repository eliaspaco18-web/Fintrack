// =============================================================================
// Billing-cycle integrity
//
// Validation shared by the card form and the billing-cycle API. The billing
// month identifies the month in which the consumption period closes; its start
// may legitimately belong to the preceding month.
// =============================================================================

export type BillingCycleIntegrityInput = {
  billing_month: number
  billing_year: number
  consumption_from: string
  consumption_to: string
  payment_date: string
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day
  ) ? date : null
}

export function getBillingCycleDateIssue(cycle: BillingCycleIntegrityInput): string | null {
  const consumptionFrom = parseIsoDate(cycle.consumption_from)
  const consumptionTo = parseIsoDate(cycle.consumption_to)
  const paymentDate = parseIsoDate(cycle.payment_date)

  if (!consumptionFrom || !consumptionTo || !paymentDate) {
    return 'Las fechas del ciclo no son válidas.'
  }

  if (consumptionFrom.getTime() > consumptionTo.getTime()) {
    return 'El inicio del consumo no puede ser posterior al cierre del periodo.'
  }

  if (paymentDate.getTime() < consumptionTo.getTime()) {
    return 'La fecha de pago no puede ser anterior al cierre del periodo.'
  }

  if (
    consumptionTo.getUTCFullYear() !== cycle.billing_year
    || consumptionTo.getUTCMonth() + 1 !== cycle.billing_month
  ) {
    return 'El mes y año del periodo deben coincidir con la fecha de cierre del consumo.'
  }

  return null
}

export function getBillingCyclesSubmissionIssue(
  cycles: BillingCycleIntegrityInput[],
): string | null {
  const seenPeriods = new Set<string>()
  const ranges: Array<{ from: Date; to: Date }> = []

  for (const cycle of cycles) {
    const dateIssue = getBillingCycleDateIssue(cycle)
    if (dateIssue) return dateIssue

    const periodKey = `${cycle.billing_year}-${cycle.billing_month}`
    if (seenPeriods.has(periodKey)) {
      return 'No puede haber dos ciclos para el mismo mes y año.'
    }
    seenPeriods.add(periodKey)

    const consumptionFrom = parseIsoDate(cycle.consumption_from)
    const consumptionTo = parseIsoDate(cycle.consumption_to)
    if (!consumptionFrom || !consumptionTo) return 'Las fechas del ciclo no son válidas.'
    ranges.push({ from: consumptionFrom, to: consumptionTo })
  }

  ranges.sort((left, right) => left.from.getTime() - right.from.getTime())
  for (let index = 1; index < ranges.length; index += 1) {
    const previous = ranges[index - 1]
    const current = ranges[index]
    if (previous && current && current.from.getTime() <= previous.to.getTime()) {
      return 'Los periodos de consumo no pueden superponerse.'
    }
  }

  return null
}
