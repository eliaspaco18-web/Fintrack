export const LOAN_TYPE_VALUES = [
  'CONSUMPTION',
  'VEHICLE',
  'MORTGAGE',
  'SMALL_BUSINESS',
  'MICROENTERPRISE',
  'OTHER',
] as const

export type LoanType = (typeof LOAN_TYPE_VALUES)[number]

const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  CONSUMPTION: 'Consumo personal',
  VEHICLE: 'Vehicular',
  MORTGAGE: 'Hipotecario',
  SMALL_BUSINESS: 'Pequeña empresa',
  MICROENTERPRISE: 'Microempresa',
  OTHER: 'Otro',
}

export function getLoanTypeLabel(value: string | null | undefined): string {
  return value && value in LOAN_TYPE_LABELS
    ? LOAN_TYPE_LABELS[value as LoanType]
    : 'No especificado'
}
