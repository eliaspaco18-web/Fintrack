import { z } from 'zod'
import type { TablesInsert } from '@/types/database.types'

export const LOAN_SCHEDULE_REQUIRED_ERROR =
  'El crédito bancario debe incluir un cronograma verificable o solicitar su generación.'

export const LOAN_SCHEDULE_SEQUENCE_ERROR =
  'Las cuotas deben estar numeradas de forma consecutiva y sin duplicados.'

export const LOAN_SCHEDULE_UNAVAILABLE_MESSAGE =
  'No se pudo verificar el cronograma de cuotas. Los datos del crédito siguen visibles, pero el cronograma no debe considerarse completo.'

export const LOAN_SCHEDULE_MISSING_MESSAGE =
  'El crédito no tiene cuotas verificables. El cronograma no debe considerarse completo.'

export const LOAN_SCHEDULE_INCOMPLETE_MESSAGE =
  'El cronograma disponible está incompleto o contiene componentes inconsistentes. No se generaron cuotas para completar la información.'

const zScheduleMoney = z.number().min(0).refine(
  value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
  'El importe debe tener como máximo dos decimales',
)

export const zManualLoanInstallmentInput = z.object({
  installment_number: z.number().int().min(1),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  principal_amount: zScheduleMoney,
  interest_amount: zScheduleMoney,
  insurance_amount: zScheduleMoney.default(0),
  other_charges: zScheduleMoney.default(0),
})

export type ManualLoanInstallmentInput = z.infer<typeof zManualLoanInstallmentInput>

export type LoanScheduleRow = Readonly<{
  installment_number: number
  due_date: string
  principal_amount: number
  interest_amount: number
  insurance_amount: number
  other_charges: number
  total_amount: number
}>

export type LoanScheduleIntegrityStatus =
  | 'NOT_APPLICABLE'
  | 'VERIFIED'
  | 'UNAVAILABLE'
  | 'MISSING'
  | 'INCOMPLETE'

export type LoanScheduleIntegrity = Readonly<{
  status: LoanScheduleIntegrityStatus
  expectedInstallments: number | null
  actualInstallments: number
  isComplete: boolean
  message: string | null
}>

type LoanScheduleIntegrityInput = Readonly<{
  requiresSchedule: boolean
  expectedInstallments: number | null
  installments: readonly LoanScheduleRow[]
  verificationFailed?: boolean
}>

type ManualScheduleSubmissionInput = Readonly<{
  generateSchedule: boolean
  totalInstallments: number
  installments?: readonly Pick<ManualLoanInstallmentInput, 'installment_number'>[]
}>

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function hasConsecutiveInstallmentNumbers(
  installments: readonly Pick<ManualLoanInstallmentInput, 'installment_number'>[],
  expectedCount: number,
): boolean {
  if (installments.length !== expectedCount) return false

  const numbers = installments
    .map(item => item.installment_number)
    .sort((a, b) => a - b)

  return numbers.every((number, index) => number === index + 1)
}

function hasValidStoredComponents(installment: LoanScheduleRow): boolean {
  const components = [
    installment.principal_amount,
    installment.interest_amount,
    installment.insurance_amount,
    installment.other_charges,
    installment.total_amount,
  ]

  if (components.some(value => !Number.isFinite(value) || value < 0)) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(installment.due_date)) return false

  const componentTotal = roundMoney(
    installment.principal_amount
      + installment.interest_amount
      + installment.insurance_amount
      + installment.other_charges,
  )

  return componentTotal === roundMoney(installment.total_amount)
}

export function getManualScheduleSubmissionIssue(
  input: ManualScheduleSubmissionInput,
): string | null {
  const installments = input.installments ?? []

  if (installments.length === 0) {
    return input.generateSchedule ? null : LOAN_SCHEDULE_REQUIRED_ERROR
  }

  return hasConsecutiveInstallmentNumbers(installments, input.totalInstallments)
    ? null
    : LOAN_SCHEDULE_SEQUENCE_ERROR
}

export function buildManualLoanSchedule(
  loanId: string,
  installments: readonly ManualLoanInstallmentInput[],
): TablesInsert<'installments'>[] {
  return installments.map(item => ({
    loan_id: loanId,
    transaction_id: null,
    installment_number: item.installment_number,
    principal_amount: item.principal_amount,
    interest_amount: item.interest_amount,
    insurance_amount: item.insurance_amount,
    other_charges: item.other_charges,
    total_amount: roundMoney(
      item.principal_amount
        + item.interest_amount
        + item.insurance_amount
        + item.other_charges,
    ),
    due_date: item.due_date,
    paid_date: null,
    paid_amount: null,
    status: 'PENDING',
  }))
}

export function getLoanScheduleIntegrity(
  input: LoanScheduleIntegrityInput,
): LoanScheduleIntegrity {
  const actualInstallments = input.installments.length

  if (!input.requiresSchedule) {
    return {
      status: 'NOT_APPLICABLE',
      expectedInstallments: null,
      actualInstallments,
      isComplete: true,
      message: null,
    }
  }

  if (
    input.verificationFailed
    || !Number.isInteger(input.expectedInstallments)
    || (input.expectedInstallments ?? 0) < 1
  ) {
    return {
      status: 'UNAVAILABLE',
      expectedInstallments: input.expectedInstallments,
      actualInstallments,
      isComplete: false,
      message: LOAN_SCHEDULE_UNAVAILABLE_MESSAGE,
    }
  }

  const expectedInstallments = input.expectedInstallments as number
  if (actualInstallments === 0) {
    return {
      status: 'MISSING',
      expectedInstallments,
      actualInstallments,
      isComplete: false,
      message: LOAN_SCHEDULE_MISSING_MESSAGE,
    }
  }

  const hasValidCountAndSequence = hasConsecutiveInstallmentNumbers(
    input.installments,
    expectedInstallments,
  )
  const hasValidComponents = input.installments.every(hasValidStoredComponents)

  if (!hasValidCountAndSequence || !hasValidComponents) {
    return {
      status: 'INCOMPLETE',
      expectedInstallments,
      actualInstallments,
      isComplete: false,
      message: LOAN_SCHEDULE_INCOMPLETE_MESSAGE,
    }
  }

  return {
    status: 'VERIFIED',
    expectedInstallments,
    actualInstallments,
    isComplete: true,
    message: null,
  }
}

export function resizeScheduleRows<T>(
  rows: readonly T[],
  totalInstallments: number,
  createRow: (index: number) => T,
): T[] {
  if (!Number.isInteger(totalInstallments) || totalInstallments < 1) return [...rows]
  if (rows.length >= totalInstallments) return rows.slice(0, totalInstallments)

  return [
    ...rows,
    ...Array.from(
      { length: totalInstallments - rows.length },
      (_, offset) => createRow(rows.length + offset),
    ),
  ]
}
