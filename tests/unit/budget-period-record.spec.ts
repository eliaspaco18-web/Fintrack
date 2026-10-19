import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import postcss from 'postcss'
import {
  mergeBudgetPeriodItems,
  resolveBudgetPeriodAmountUrl,
  resolveBudgetPeriodEditTarget,
  resolveBudgetPeriodIdentity,
  resolveBudgetPeriodTransactionsUrl,
} from '@/lib/budgets/period-record'
import type { BudgetPeriodRecord } from '@/lib/budgets/period-record'

const LEGACY_BUDGET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const EXPLICIT_PERIOD_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

test('an inherited period keeps the budgets record id and uses legacy read/update routes', () => {
  const apiRow = { id: LEGACY_BUDGET_ID, legacy_budget_id: LEGACY_BUDGET_ID }
  const identity = resolveBudgetPeriodIdentity(apiRow)
  const period = {
    ...identity,
    series_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    period_start: '2026-08-01',
    period_end: '2026-08-31',
  }

  expect(identity).toEqual({
    id: `budget-period:${LEGACY_BUDGET_ID}`,
    legacy_budget_id: LEGACY_BUDGET_ID,
  })
  expect(resolveBudgetPeriodEditTarget(apiRow)).toEqual({ kind: 'legacy-budget', budgetId: LEGACY_BUDGET_ID })
  expect(resolveBudgetPeriodTransactionsUrl(period)).toBe(
    `/api/budgets/${LEGACY_BUDGET_ID}/transactions?period_start=2026-08-01&period_end=2026-08-31`,
  )
  expect(resolveBudgetPeriodAmountUrl(period)).toBe(`/api/budgets/${LEGACY_BUDGET_ID}`)
})

test('an explicit period linked to a legacy row edits and reads the explicit period only', () => {
  const apiRow = { id: EXPLICIT_PERIOD_ID, legacy_budget_id: LEGACY_BUDGET_ID }
  const identity = resolveBudgetPeriodIdentity(apiRow)
  const explicitPeriod = {
    ...identity,
    period_start: '2026-08-01',
    period_end: '2026-08-31',
  }
  const linkedLegacyPeriod: BudgetPeriodRecord = {
    id: LEGACY_BUDGET_ID,
    legacy_budget_id: LEGACY_BUDGET_ID,
    period_start: explicitPeriod.period_start,
    period_end: explicitPeriod.period_end,
  }
  const futureLegacyPeriod: BudgetPeriodRecord = {
    ...linkedLegacyPeriod,
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    legacy_budget_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    period_start: '2026-09-01',
    period_end: '2026-09-30',
  }

  expect(identity).toEqual({
    id: `budget-period:${EXPLICIT_PERIOD_ID}`,
    budget_period_id: EXPLICIT_PERIOD_ID,
    legacy_budget_id: LEGACY_BUDGET_ID,
  })
  expect(resolveBudgetPeriodEditTarget(apiRow)).toEqual({ kind: 'explicit-period', periodId: EXPLICIT_PERIOD_ID })
  expect(resolveBudgetPeriodTransactionsUrl(explicitPeriod)).toBe(
    `/api/budget-periods/${EXPLICIT_PERIOD_ID}/transactions`,
  )
  expect(resolveBudgetPeriodAmountUrl(explicitPeriod)).toBe(`/api/budget-periods/${EXPLICIT_PERIOD_ID}`)

  const merged = mergeBudgetPeriodItems<BudgetPeriodRecord>([linkedLegacyPeriod, futureLegacyPeriod], explicitPeriod)
  expect(merged).toHaveLength(2)
  expect(merged.find(period => period.budget_period_id === EXPLICIT_PERIOD_ID)).toEqual(explicitPeriod)
  expect(merged.some(period => period.id === LEGACY_BUDGET_ID)).toBe(false)
  expect(merged.some(period => period.id === futureLegacyPeriod.id)).toBe(true)
})

test('period table keeps five matching columns in the compact container layout', () => {
  const css = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.module.css'), 'utf8')
  const root = postcss.parse(css)
  const compact = root.nodes.find(node => node.type === 'atrule' && node.params === 'budget-period-table (max-width: 1040px)')
  expect(compact?.type).toBe('atrule')
  if (!compact || compact.type !== 'atrule') throw new Error('Compact budget table container query not found')

  const selectors = (compact.nodes ?? []).filter(node => node.type === 'rule' && node.selector === '.periodHeader,\n  .periodRow')
  expect(selectors).toHaveLength(1)
  const rule = selectors[0]
  if (!rule || rule.type !== 'rule') throw new Error('Tablet table grid rule not found')
  const grid = rule.nodes.find(node => node.type === 'decl' && node.prop === 'grid-template-columns')
  expect(grid?.type).toBe('decl')
  if (!grid || grid.type !== 'decl') throw new Error('Tablet grid columns not found')
  expect((grid.value.match(/minmax\(/g) ?? []).length).toBe(5)
})

test('budget detail year filter uses the shared AppSelect and retains the all-years option', () => {
  const source = readFileSync(join(process.cwd(), 'components/management/BudgetDetail.tsx'), 'utf8')
  expect(source).toContain("import { AppSelect } from '@/components/ui/AppSelect'")
  expect(source).toContain('options={periodYearOptions}')
  expect(source).toContain("{ value: 'all', label: 'Todos' }")
  expect(source).not.toMatch(/<select\b/)
})
