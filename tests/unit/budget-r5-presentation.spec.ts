import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const source = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.tsx'), 'utf8')
const css = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.module.css'), 'utf8')

test('selected period is in the page header and uses the full year-month key', () => {
  expect(source).toContain('testId="budgets-header-period-select"')
  expect(source).toContain('<BudgetMonthPicker')
  expect(source).toContain('value={periodMonth}')
  expect(source).toContain('onChange={setPeriodMonth}')
  expect(source).not.toContain('options={periodMonthOptions}')
  expect(source).not.toContain('MONTH_OPTIONS')
  expect(source).not.toContain('className={styles.periodControls}')
  expect(source).not.toContain('ariaLabel="Seleccionar mes"')
  expect(source).not.toContain('ariaLabel="Seleccionar año"')
  expect(source).toContain('loadPeriodRows()')
})
test('period register exposes five columns with spending primary and limit secondary', () => {
  expect(source.match(/<span>Presupuesto<\/span><span>Uso del límite<\/span><span>Gasto \/ límite<\/span><span>Disponible<\/span><span className="text-right">Acciones<\/span>/g)).toHaveLength(2)
  expect(source).toContain('className={styles.periodSpentLimit}')
  expect(source).toContain('className={`${styles.summaryValue} ${styles.periodSpent} text-[13px] font-semibold')
  expect(source).toContain('className={`${styles.summaryValue} ${styles.periodLimit} text-[11px] font-medium')
  expect(css).toContain('grid-template-columns: minmax(180px, 1.35fr) minmax(160px, 1.1fr) minmax(150px, 1.05fr) minmax(132px, 0.9fr) minmax(96px, auto)')
})

test('exception band names an actual over-limit budget and opens that exact period detail', () => {
  expect(source).toContain('periodRowsReady && priorityExceededPeriod')
  expect(source).toContain('{priorityExceededPeriod.budget.name}')
  expect(source).toContain('formatBudgetCurrency(priorityExceededPeriod.spent_amount, priorityExceededPeriod.budget.currency)')
  expect(source).toContain('formatBudgetCurrency(priorityExceededPeriod.amount, priorityExceededPeriod.budget.currency)')
  expect(source).toContain('formatBudgetCurrency(priorityExceededPeriod.remaining_amount === null ? null : Math.abs(priorityExceededPeriod.remaining_amount), priorityExceededPeriod.budget.currency)')
  expect(source).toContain('onClick={() => openPeriodDetail(priorityExceededPeriod)}')
  expect(source).toContain('(right.progress_percent ?? -1) - (left.progress_percent ?? -1) || left.budget.name.localeCompare(right.budget.name)')
})
