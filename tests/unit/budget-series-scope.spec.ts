import { expect, test } from '@playwright/test'
import {
  BUDGET_SCOPE_CHANGED_ERROR,
  BUDGET_SCOPE_REQUIRED_ERROR,
  BUDGET_SCOPE_VERIFICATION_ERROR,
  budgetRecordScopeMatches,
  checkBudgetRecordActionScope,
  createBudgetRecordActionScope,
  type BudgetRecordScopeSource,
} from '@/modules/budgets/budget-action-scope'

const FIRST_PERIOD_ID = '11111111-1111-4111-8111-111111111111'
const SECOND_PERIOD_ID = '22222222-2222-4222-8222-222222222222'
const SERIES_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CATEGORY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function periodFixture(overrides: Partial<BudgetRecordScopeSource> = {}): BudgetRecordScopeSource {
  return {
    id: FIRST_PERIOD_ID,
    series_id: SERIES_ID,
    start_date: '2026-08-01',
    end_date: '2026-08-31',
    category_id: CATEGORY_ID,
    ...overrides,
  }
}

test.describe('Budgets record-scoped edit and delete integrity', () => {
  test('verifies the exact selected record without inventing a series-wide action', () => {
    const selected = periodFixture()
    const scope = createBudgetRecordActionScope(selected)

    expect(scope).toEqual({
      kind: 'RECORD',
      record_id: FIRST_PERIOD_ID,
      series_id: SERIES_ID,
      start_date: '2026-08-01',
      end_date: '2026-08-31',
      category_id: CATEGORY_ID,
    })
    expect(budgetRecordScopeMatches(selected, scope)).toBe(true)
    expect(scope).not.toHaveProperty('amount')
    expect(scope).not.toHaveProperty('recurrence')
  })

  test('edits only the selected period and leaves another period in the series unchanged', () => {
    const periods = [
      periodFixture(),
      periodFixture({
        id: SECOND_PERIOD_ID,
        start_date: '2026-09-01',
        end_date: '2026-09-30',
      }),
    ]
    const selected = periods[0]!
    const scope = createBudgetRecordActionScope(selected)
    const before = structuredClone(periods)

    expect(budgetRecordScopeMatches(selected, scope)).toBe(true)
    const edited = periods.map(period => (
      period.id === scope.record_id
        ? { ...period, category_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }
        : period
    ))

    expect(edited[0]?.category_id).not.toBe(before[0]?.category_id)
    expect(edited[1]).toEqual(before[1])
  })

  test('deletes only the selected period and preserves past or future periods', () => {
    const periods = [
      periodFixture(),
      periodFixture({
        id: SECOND_PERIOD_ID,
        start_date: '2026-09-01',
        end_date: '2026-09-30',
      }),
    ]
    const scope = createBudgetRecordActionScope(periods[0]!)

    const remaining = periods.filter(period => period.id !== scope.record_id)

    expect(remaining).toEqual([periods[1]])
    expect(remaining[0]?.series_id).toBe(SERIES_ID)
  })

  test('blocks a record from another period even when it belongs to the same series', () => {
    const selected = periodFixture()
    const otherPeriod = periodFixture({
      id: SECOND_PERIOD_ID,
      start_date: '2026-09-01',
      end_date: '2026-09-30',
    })

    expect(budgetRecordScopeMatches(otherPeriod, createBudgetRecordActionScope(selected))).toBe(false)
  })

  test('blocks a changed series, period range or category before mutation', () => {
    const selected = periodFixture()
    const scope = createBudgetRecordActionScope(selected)
    const changedRecords = [
      periodFixture({ series_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }),
      periodFixture({ start_date: '2026-08-02' }),
      periodFixture({ end_date: '2026-09-01' }),
      periodFixture({ category_id: null }),
    ]
    let mutationCalls = 0

    for (const current of changedRecords) {
      if (budgetRecordScopeMatches(current, scope)) mutationCalls += 1
    }

    expect(mutationCalls).toBe(0)
    expect(selected).toEqual(periodFixture())
  })

  test('fails closed when the selected record cannot be verified', () => {
    const selected = periodFixture()
    const scope = createBudgetRecordActionScope(selected)
    let mutationCalls = 0

    for (const check of [
      checkBudgetRecordActionScope({ current: null, expected: scope }),
      checkBudgetRecordActionScope({ current: selected, expected: scope, verificationFailed: true }),
      checkBudgetRecordActionScope({
        current: periodFixture({ category_id: null }),
        expected: scope,
      }),
    ]) {
      if (check.status === 'VERIFIED') mutationCalls += 1
    }

    expect(mutationCalls).toBe(0)
    expect(checkBudgetRecordActionScope({ current: null, expected: scope })).toEqual({ status: 'NOT_FOUND' })
    expect(checkBudgetRecordActionScope({
      current: selected,
      expected: scope,
      verificationFailed: true,
    })).toEqual({ status: 'UNAVAILABLE' })
  })

  test('keeps controlled scope errors non-sensitive', () => {
    for (const error of [
      BUDGET_SCOPE_REQUIRED_ERROR,
      BUDGET_SCOPE_VERIFICATION_ERROR,
      BUDGET_SCOPE_CHANGED_ERROR,
    ]) {
      expect(error.message).not.toMatch(/supabase|postgres|table|relation|policy|rls|token|secret/i)
      expect(error.detail).not.toMatch(/supabase|postgres|table|relation|policy|rls|token|secret/i)
      expect(error.detail).toContain('No se aplicaron cambios')
    }
  })
})
