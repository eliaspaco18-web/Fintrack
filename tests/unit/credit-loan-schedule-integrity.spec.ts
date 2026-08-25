import { expect, test } from '@playwright/test'
import {
  LOAN_SCHEDULE_INCOMPLETE_MESSAGE,
  LOAN_SCHEDULE_MISSING_MESSAGE,
  LOAN_SCHEDULE_REQUIRED_ERROR,
  LOAN_SCHEDULE_SEQUENCE_ERROR,
  LOAN_SCHEDULE_UNAVAILABLE_MESSAGE,
  buildManualLoanSchedule,
  getLoanScheduleIntegrity,
  getManualScheduleSubmissionIssue,
  resizeScheduleRows,
  zManualLoanInstallmentInput,
  type LoanScheduleRow,
  type ManualLoanInstallmentInput,
} from '@/modules/credits/loan-schedule-integrity'

const MANUAL_SCHEDULE: readonly ManualLoanInstallmentInput[] = Object.freeze([
  Object.freeze({
    installment_number: 1,
    due_date: '2026-09-25',
    principal_amount: 900,
    interest_amount: 80,
    insurance_amount: 15,
    other_charges: 5,
  }),
  Object.freeze({
    installment_number: 2,
    due_date: '2026-10-25',
    principal_amount: 1_100,
    interest_amount: 40,
    insurance_amount: 12,
    other_charges: 3,
  }),
])

function asStoredSchedule(
  schedule = buildManualLoanSchedule('loan-1', MANUAL_SCHEDULE),
): LoanScheduleRow[] {
  return schedule.map(item => ({
    installment_number: item.installment_number,
    due_date: item.due_date,
    principal_amount: item.principal_amount,
    interest_amount: item.interest_amount ?? 0,
    insurance_amount: item.insurance_amount ?? 0,
    other_charges: item.other_charges ?? 0,
    total_amount: item.total_amount,
  }))
}

test.describe('Credits loan schedule preservation', () => {
  test('persists principal, interest, insurance and other charges as separate components', () => {
    const before = structuredClone(MANUAL_SCHEDULE)
    const schedule = buildManualLoanSchedule('loan-1', MANUAL_SCHEDULE)

    expect(schedule).toEqual([
      expect.objectContaining({
        installment_number: 1,
        principal_amount: 900,
        interest_amount: 80,
        insurance_amount: 15,
        other_charges: 5,
        total_amount: 1_000,
      }),
      expect.objectContaining({
        installment_number: 2,
        principal_amount: 1_100,
        interest_amount: 40,
        insurance_amount: 12,
        other_charges: 3,
        total_amount: 1_155,
      }),
    ])
    expect(MANUAL_SCHEDULE).toEqual(before)
  })

  test('keeps valid stored schedule components readable and complete', () => {
    const stored = asStoredSchedule()
    const result = getLoanScheduleIntegrity({
      requiresSchedule: true,
      expectedInstallments: 2,
      installments: stored,
    })

    expect(result).toEqual({
      status: 'VERIFIED',
      expectedInstallments: 2,
      actualInstallments: 2,
      isComplete: true,
      message: null,
    })
    expect(stored[0]).toMatchObject({
      principal_amount: 900,
      interest_amount: 80,
      insurance_amount: 15,
      other_charges: 5,
    })
  })

  test('does not erase existing component entries when the form schedule expands', () => {
    const existing = MANUAL_SCHEDULE.map(item => ({ ...item }))
    const expanded = resizeScheduleRows(existing, 3, index => ({
      installment_number: index + 1,
      due_date: '2026-11-25',
      principal_amount: 0,
      interest_amount: 0,
      insurance_amount: 0,
      other_charges: 0,
    }))

    expect(expanded).toHaveLength(3)
    expect(expanded[0]).toBe(existing[0])
    expect(expanded[1]).toBe(existing[1])
    expect(expanded.slice(0, 2)).toEqual(existing)
  })

  test('blocks a direct manual submission without a schedule or with a truncated sequence', () => {
    expect(getManualScheduleSubmissionIssue({
      generateSchedule: false,
      totalInstallments: 2,
      installments: [],
    })).toBe(LOAN_SCHEDULE_REQUIRED_ERROR)

    expect(getManualScheduleSubmissionIssue({
      generateSchedule: false,
      totalInstallments: 2,
      installments: [{ installment_number: 1 }],
    })).toBe(LOAN_SCHEDULE_SEQUENCE_ERROR)

    expect(getManualScheduleSubmissionIssue({
      generateSchedule: false,
      totalInstallments: 2,
      installments: [{ installment_number: 1 }, { installment_number: 1 }],
    })).toBe(LOAN_SCHEDULE_SEQUENCE_ERROR)

    expect(getManualScheduleSubmissionIssue({
      generateSchedule: true,
      totalInstallments: 2,
    })).toBeNull()
  })

  test('rejects component values that the database would round or cannot preserve safely', () => {
    expect(zManualLoanInstallmentInput.safeParse({
      installment_number: 1,
      due_date: '2026-09-25',
      principal_amount: 100.001,
      interest_amount: 10,
      insurance_amount: 1,
      other_charges: 0,
    }).success).toBe(false)

    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(zManualLoanInstallmentInput.safeParse({
        installment_number: 1,
        due_date: '2026-09-25',
        principal_amount: 100,
        interest_amount: 10,
        insurance_amount: invalid,
        other_charges: 0,
      }).success).toBe(false)
    }
  })

  test('returns controlled truthful states without inventing missing installments', () => {
    const unavailable = getLoanScheduleIntegrity({
      requiresSchedule: true,
      expectedInstallments: 2,
      installments: [],
      verificationFailed: true,
    })
    const missing = getLoanScheduleIntegrity({
      requiresSchedule: true,
      expectedInstallments: 2,
      installments: [],
    })
    const existingRow = asStoredSchedule().slice(0, 1)
    const incomplete = getLoanScheduleIntegrity({
      requiresSchedule: true,
      expectedInstallments: 2,
      installments: existingRow,
    })

    expect(unavailable).toMatchObject({
      status: 'UNAVAILABLE',
      actualInstallments: 0,
      isComplete: false,
      message: LOAN_SCHEDULE_UNAVAILABLE_MESSAGE,
    })
    expect(missing).toMatchObject({
      status: 'MISSING',
      actualInstallments: 0,
      isComplete: false,
      message: LOAN_SCHEDULE_MISSING_MESSAGE,
    })
    expect(incomplete).toMatchObject({
      status: 'INCOMPLETE',
      actualInstallments: 1,
      isComplete: false,
      message: LOAN_SCHEDULE_INCOMPLETE_MESSAGE,
    })
    for (const message of [unavailable.message, missing.message, incomplete.message]) {
      expect(message).not.toMatch(/postgres|supabase|table|relation|policy|rls|token|secret/i)
    }
    expect(existingRow).toHaveLength(1)
  })

  test('does not describe a component-inconsistent schedule as complete', () => {
    const [first, second] = asStoredSchedule()
    if (!first || !second) throw new Error('Expected test schedule rows')

    const result = getLoanScheduleIntegrity({
      requiresSchedule: true,
      expectedInstallments: 2,
      installments: [{ ...first, total_amount: first.total_amount + 1 }, second],
    })

    expect(result.status).toBe('INCOMPLETE')
    expect(result.isComplete).toBe(false)
  })

  test('does not require or invent installments for credit cards', () => {
    expect(getLoanScheduleIntegrity({
      requiresSchedule: false,
      expectedInstallments: null,
      installments: [],
      verificationFailed: true,
    })).toEqual({
      status: 'NOT_APPLICABLE',
      expectedInstallments: null,
      actualInstallments: 0,
      isComplete: true,
      message: null,
    })
  })
})
