import { expect, test } from '@playwright/test'
import { monthBounds, summarizeMonth } from '@/lib/transactions-month-summary'
import { budgetSummaryForDisplay } from '@/lib/budgets/presentation'
import { readCompleteMonthRows } from '@/lib/transactions/month-summary-query'

test('month boundaries support leap years and reject invalid periods', () => {
  expect(monthBounds('2024-02')).toEqual({ start: '2024-02-01', end: '2024-02-29' })
  expect(monthBounds('2025-02')?.end).toBe('2025-02-28')
  expect(monthBounds('2025-13')).toBeNull()
})

test('monthly totals distinguish empty, incomplete and transfer records', () => {
  expect(summarizeMonth([])).toEqual({ ingresos_mes: 0, egresos_mes: 0, resultado_mensual: 0 })
  expect(summarizeMonth([{ type: 'INCOME', amount_pen: 120 }, { type: 'EXPENSE', amount_pen: '20' }, { type: 'TRANSFER', amount_pen: 999 }])).toEqual({ ingresos_mes: 120, egresos_mes: 20, resultado_mensual: 100 })
  expect(summarizeMonth([{ type: 'INCOME', amount_pen: null }, { type: 'EXPENSE', amount_pen: 20 }])).toEqual({ ingresos_mes: null, egresos_mes: 20, resultado_mensual: null })
})

test('empty budgets use the selected currency and preserve incomplete results', () => {
  expect(budgetSummaryForDisplay([], 'PEN')[0]).toMatchObject({ currency: 'PEN', assigned: 0, spent: 0, available: 0 })
  expect(budgetSummaryForDisplay([], 'USD')[0]).toMatchObject({ currency: 'USD', assigned: 0, spent: 0, available: 0 })
  expect(budgetSummaryForDisplay([{ amount: 10, spent_amount: null, remaining_amount: null, budget: { currency: 'USD' } }])[0]).toMatchObject({ spent: null, available: null, metrics_complete: false })
})

test('historical summary query reads every page and constrains every request to its authenticated user', async () => {
  const pageSizes: number[] = []
  const scopedUsers: string[] = []
  const pages = [
    Array.from({ length: 500 }, () => ({ type: 'INCOME', amount_pen: 1 })),
    [{ type: 'EXPENSE', amount_pen: 40 }],
  ]
  const db = { from: (table: string) => {
    expect(table).toBe('transactions')
    let user = ''
    let offset = 0
    const query: any = {
      select: () => query,
      eq: (column: string, value: string | boolean) => { if (column === 'user_id') user = String(value); return query },
      in: () => query,
      gte: () => query,
      lte: () => query,
      order: () => query,
      range: (from: number, to: number) => { offset = from; pageSizes.push(to - from + 1); return query },
      then: (resolve: (result: unknown) => unknown) => {
        scopedUsers.push(user)
        return Promise.resolve(resolve({ data: pages[offset / 500] ?? [], count: 501, error: null }))
      },
    }
    return query
  } }
  const rows = await readCompleteMonthRows(db, 'authenticated-user-17', { start: '2024-02-01', end: '2024-02-29' })
  expect(rows).toHaveLength(501)
  expect(pageSizes).toEqual([500, 500])
  expect(scopedUsers).toEqual(['authenticated-user-17', 'authenticated-user-17'])
  expect(summarizeMonth(rows)).toMatchObject({ ingresos_mes: 500, egresos_mes: 40, resultado_mensual: 460 })
})

test('historical query fails closed when the database count changes between pages', async () => {
  let calls = 0
  const db = { from: () => {
    const query: any = {
      select: () => query, eq: () => query, in: () => query, gte: () => query, lte: () => query, order: () => query, range: () => query,
      then: (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({ data: calls++ ? [] : [{ type: 'INCOME', amount_pen: 5 }], count: calls === 1 ? 2 : 3, error: null })),
    }
    return query
  } }
  await expect(readCompleteMonthRows(db, 'authenticated-user-17', { start: '2024-01-01', end: '2024-01-31' })).rejects.toThrow('MONTH_SUMMARY_INCOMPLETE')
})

test('initial movements scope defaults to the current month only without another explicit scope', async () => {
  const { resolveInitialMovementRange, isCompleteMovementMonth } = await import('@/modules/transactions/movement-period')
  expect(resolveInitialMovementRange({ month: '2026-10', hasExplicitDateRange: false, hasOtherScope: false })).toEqual({ dateFrom: '2026-10-01', dateTo: '2026-10-31' })
  expect(resolveInitialMovementRange({ month: '2026-10', hasExplicitDateRange: true, hasOtherScope: false })).toBeNull()
  expect(resolveInitialMovementRange({ month: '2026-10', hasExplicitDateRange: false, hasOtherScope: true })).toBeNull()
  expect(isCompleteMovementMonth('2026-10-01', '2026-10-31')).toBe('2026-10')
  expect(isCompleteMovementMonth('2026-10-02', '2026-10-31')).toBeNull()
  expect(isCompleteMovementMonth('2026-09-01', '2026-10-31')).toBeNull()
})
