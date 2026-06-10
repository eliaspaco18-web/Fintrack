'use client'

export type ScheduleMonthOption = {
  value: string
  label: string
}

export const SCHEDULE_MONTHS: ScheduleMonthOption[] = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

export const CREDIT_CARD_SCHEDULE_COLUMN_WIDTHS = {
  period: 220,
  consumptionFrom: 150,
  consumptionTo: 150,
  paymentDate: 150,
  totalToPay: 150,
  statement: 160,
  actions: 96,
} as const

export const CREDIT_CARD_SCHEDULE_TABLE_MIN_WIDTH = 1076
export const CREDIT_CARD_DATE_INPUT_MIN_WIDTH = 136
export const CREDIT_CARD_MONTH_SELECT_MIN_WIDTH = 128
export const CREDIT_CARD_YEAR_SELECT_MIN_WIDTH = 84

export const BANK_LOAN_SCHEDULE_COLUMN_WIDTHS = {
  installmentNumber: 64,
  dueDate: 160,
  principal: 150,
  interest: 150,
  insurance: 150,
  others: 150,
  installmentTotal: 170,
} as const

export const BANK_LOAN_SCHEDULE_TABLE_MIN_WIDTH = 994
export const BANK_LOAN_DATE_INPUT_MIN_WIDTH = 136

export function getScheduleMonthLabel(monthValue: string): string {
  return SCHEDULE_MONTHS.find(month => month.value === monthValue)?.label ?? monthValue
}

export function formatBillingCycleLabel(monthValue: string, yearValue: string): string {
  return `${getScheduleMonthLabel(monthValue)} ${yearValue}`
}

export function formatScheduleDateLabel(isoDate: string | undefined): string {
  if (!isoDate) return '—'

  const parsedDate = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return isoDate

  return parsedDate.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDuplicateCycleMessage(labels: string[]): string | null {
  if (labels.length === 0) return null
  return `Revisa los períodos duplicados: ${Array.from(new Set(labels)).join(', ')}.`
}
